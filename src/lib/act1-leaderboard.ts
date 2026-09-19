import { readFile } from "fs/promises";
import path from "path";
import { SCORE_SCALE, type Eater, type SupplyStats } from "./race";
import { migrateLegacyScore, sortLeaderboard } from "./leaderboard-rank";
import { resolveHolderCount } from "./holders";
import {
  fetchLiveSupplyOverlay,
  mergeSupplyStats,
} from "./supply-stats";

export type { SupplyStats };

export type Act1LeaderboardPayload = {
  updatedAt?: string;
  phase?: number;
  scoring?: string;
  tradeFromBlock?: number;
  supplyStats?: SupplyStats;
  eaters: Eater[];
  scoreScale?: string;
};

type RawRow = {
  address?: string;
  score?: number;
  trades?: number;
  buyCount?: number;
  sellCount?: number;
  burnCount?: number;
  burned?: number;
  accumPoints?: number;
  holdPoints?: number;
  buyPoints?: number;
  sellPoints?: number;
  burnPoints?: number;
  wagered?: number;
  wagerCount?: number;
  wagerPoints?: number;
  ineligible?: boolean;
  dev?: boolean;
  badge?: string | null;
};

function rowToEater(row: RawRow, scoreScale?: string): Eater | null {
  const address = typeof row.address === "string" ? row.address : "";
  if (!address.startsWith("0x") || address.length < 10) return null;
  const buys = Math.max(0, Math.floor(Number(row.trades ?? row.buyCount ?? 0) || 0));
  const sells = Math.max(0, Math.floor(Number(row.sellCount ?? 0) || 0));
  const burns = Math.max(0, Math.floor(Number(row.burnCount ?? 0) || 0));
  const burned = Number(row.burned ?? 0) || 0;
  const buyPoints = Number(row.buyPoints ?? 0) || 0;
  const sellPoints = Number(row.sellPoints ?? 0) || 0;
  const burnPoints = Number(row.burnPoints ?? 0) || 0;
  const wagered = Number(row.wagered ?? 0) || 0;
  const wagerCount = Math.max(0, Math.floor(Number(row.wagerCount ?? 0) || 0));
  const wagerPoints = Number(row.wagerPoints ?? 0) || 0;
  const score = migrateLegacyScore({
    score: Number(row.score ?? 0) || 0,
    buyPoints,
    sellPoints,
    burnPoints,
    burned,
    wagered,
    wagerPoints,
    scale: scoreScale,
  });
  const isDev = Boolean(row.dev) || row.badge === "dev";
  const ineligible = Boolean(row.ineligible) || isDev;
  return {
    address,
    score,
    buyVolume: buyPoints,
    sellVolume: sellPoints,
    burned,
    buyCount: buys,
    sellCount: sells,
    tapCount: burns,
    wagered,
    wagerCount,
    ineligible,
    dev: isDev,
    badge: isDev ? "dev" : null,
  };
}

function fromPointsState(raw: unknown): Eater[] {
  if (!raw || typeof raw !== "object") return [];
  const scale =
    typeof (raw as { score_scale?: string }).score_scale === "string"
      ? (raw as { score_scale: string }).score_scale
      : undefined;
  const points = (
    raw as {
      points?: Record<
        string,
        RawRow & {
          wallet?: string;
          trade_count?: number;
          sell_count?: number;
          burn_count?: number;
          burned_bite?: number;
          burn_points?: number;
          buy_points?: number;
          sell_points?: number;
          wagered_bite?: number;
          wager_count?: number;
          wager_points?: number;
          points?: number;
        }
      >;
    }
  ).points;
  if (!points || typeof points !== "object") return [];
  const eaters: Eater[] = [];
  for (const [key, entry] of Object.entries(points)) {
    if (!entry || typeof entry !== "object") continue;
    const mapped = rowToEater(
      {
        address: entry.wallet || key,
        score: Number(entry.points ?? entry.score ?? 0) || 0,
        trades: Number(entry.trade_count ?? entry.trades ?? 0) || 0,
        sellCount: Number(entry.sell_count ?? entry.sellCount ?? 0) || 0,
        burnCount: Number(entry.burn_count ?? entry.burnCount ?? 0) || 0,
        burned: Number(entry.burned_bite ?? entry.burned ?? 0) || 0,
        buyPoints: Number(entry.buy_points ?? entry.buyPoints ?? 0) || 0,
        sellPoints: Number(entry.sell_points ?? entry.sellPoints ?? 0) || 0,
        burnPoints: Number(entry.burn_points ?? entry.burnPoints ?? 0) || 0,
        wagered: Number(entry.wagered_bite ?? entry.wagered ?? 0) || 0,
        wagerCount: Number(entry.wager_count ?? entry.wagerCount ?? 0) || 0,
        wagerPoints: Number(entry.wager_points ?? entry.wagerPoints ?? 0) || 0,
        ineligible: entry.ineligible,
        dev: entry.dev,
        badge: entry.badge,
      },
      scale,
    );
    if (
      mapped &&
      (mapped.score > 0 ||
        mapped.buyCount > 0 ||
        mapped.sellCount > 0 ||
        mapped.tapCount > 0 ||
        mapped.burned > 0 ||
        (mapped.wagered ?? 0) > 0 ||
        (mapped.wagerCount ?? 0) > 0 ||
        mapped.dev)
    ) {
      eaters.push(mapped);
    }
  }
  return sortLeaderboard(eaters);
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function fetchRemoteJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function parseSupplyStats(
  raw: unknown,
  market?: unknown,
): SupplyStats | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const eoaHeldBite = Number(s.eoaHeldBite ?? 0) || 0;
  const marketBs =
    market && typeof market === "object"
      ? (market as { blockscout?: { holdersEoa?: unknown } }).blockscout
      : undefined;
  const holdersEoa = Number(s.holdersEoa ?? marketBs?.holdersEoa ?? 0) || 0;
  const holderCount = resolveHolderCount({
    holderCount: Number(s.holderCount ?? 0) || 0,
    holdersEoa,
  });
  return {
    prizePoolAapl: Number(s.prizePoolAapl ?? 0) || 0,
    prizePoolUsd:
      s.prizePoolUsd != null ? Number(s.prizePoolUsd) || null : null,
    aaplPriceUsd:
      s.aaplPriceUsd != null ? Number(s.aaplPriceUsd) || null : null,
    eoaHeldBite,
    circulatingSupply: eoaHeldBite,
    contractHeldBite: Number(s.contractHeldBite ?? 0) || 0,
    realisticallyBurnable: Number(s.realisticallyBurnable ?? 0) || 0,
    totalSupply: Number(s.totalSupply ?? 0) || 0,
    totalBurned: Number(s.totalBurned ?? 0) || 0,
    holderCount,
    holdersEoa: holdersEoa || holderCount,
    allTimeRecipients: Number(s.allTimeRecipients ?? 0) || 0,
    bitePriceUsd:
      s.bitePriceUsd != null ? Number(s.bitePriceUsd) || null : null,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : undefined,
  };
}

function payloadFromRaw(publicRaw: unknown): Act1LeaderboardPayload | null {
  if (!publicRaw || typeof publicRaw !== "object") return null;
  const payload = publicRaw as {
    updatedAt?: string;
    phase?: number;
    scoring?: string;
    scoreScale?: string;
    tradeFromBlock?: number;
    supplyStats?: unknown;
    market?: unknown;
    eaters?: RawRow[];
  };
  if (!Array.isArray(payload.eaters)) return null;
  const eaters = sortLeaderboard(
    payload.eaters
      .map((row) => rowToEater(row, payload.scoreScale))
      .filter((e): e is Eater => Boolean(e)),
  );
  return {
    updatedAt: payload.updatedAt,
    phase: payload.phase,
    scoring: payload.scoring ?? "act1",
    scoreScale: SCORE_SCALE,
    tradeFromBlock: payload.tradeFromBlock,
    supplyStats: parseSupplyStats(payload.supplyStats, payload.market),
    eaters,
  };
}

async function fetchBoardPayload(): Promise<Act1LeaderboardPayload> {
  const remoteUrl = process.env.BITE_LEADERBOARD_URL?.trim();
  if (remoteUrl) {
    const remote = payloadFromRaw(await fetchRemoteJson(remoteUrl));
    if (remote) return remote;
  }

  const publicPath =
    process.env.BITE_LEADERBOARD_PUBLIC_FILE?.trim() ||
    path.join(process.cwd(), "public", "data", "act1-leaderboard.json");

  const fromPublic = payloadFromRaw(await readJsonFile(publicPath));
  if (fromPublic) return fromPublic;

  const statePath =
    process.env.BITE_BOT_STATE_FILE?.trim() ||
    path.join(process.cwd(), "bots", ".bite_bot_state.json");
  const stateRaw = await readJsonFile(statePath);
  const eaters = fromPointsState(stateRaw);
  return {
    scoring: "act1",
    scoreScale: SCORE_SCALE,
    eaters,
  };
}

/**
 * Act I trades + points leaderboard.
 * Prefers optional remote URL, then sanitized public export, then bot state.
 * Prize pool + supply totals are overlaid from live RPC / Dexscreener so
 * Vercel is not stuck on a baked public JSON snapshot.
 */
export async function fetchAct1Leaderboard(): Promise<Act1LeaderboardPayload> {
  const [board, live] = await Promise.all([
    fetchBoardPayload(),
    fetchLiveSupplyOverlay().catch(() => null),
  ]);
  return {
    ...board,
    supplyStats: mergeSupplyStats(board.supplyStats, live),
  };
}
