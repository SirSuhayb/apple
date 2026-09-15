import { readFile } from "fs/promises";
import path from "path";
import type { Eater } from "./race";

export type Act1LeaderboardPayload = {
  updatedAt?: string;
  phase?: number;
  scoring?: string;
  tradeFromBlock?: number;
  eaters: Eater[];
};

type RawRow = {
  address?: string;
  score?: number;
  trades?: number;
  buyCount?: number;
  accumPoints?: number;
  holdPoints?: number;
  ineligible?: boolean;
  dev?: boolean;
  badge?: string | null;
};

function rowToEater(row: RawRow): Eater | null {
  const address = typeof row.address === "string" ? row.address : "";
  if (!address.startsWith("0x") || address.length < 10) return null;
  const trades = Math.max(
    0,
    Math.floor(Number(row.trades ?? row.buyCount ?? 0) || 0),
  );
  const score = Number(row.score ?? 0) || 0;
  const isDev = Boolean(row.dev) || row.badge === "dev";
  const ineligible = Boolean(row.ineligible) || isDev;
  return {
    address,
    score,
    buyVolume: 0,
    sellVolume: 0,
    burned: 0,
    buyCount: trades,
    sellCount: 0,
    tapCount: 0,
    ineligible,
    dev: isDev,
    badge: isDev ? "dev" : null,
  };
}

function sortAct1(eaters: Eater[]): Eater[] {
  return [...eaters].sort((a, b) => {
    const ai = a.ineligible ? 1 : 0;
    const bi = b.ineligible ? 1 : 0;
    if (ai !== bi) return ai - bi;
    return b.score - a.score || b.buyCount - a.buyCount;
  });
}

function fromPointsState(raw: unknown): Eater[] {
  if (!raw || typeof raw !== "object") return [];
  const points = (
    raw as {
      points?: Record<
        string,
        RawRow & {
          wallet?: string;
          trade_count?: number;
          points?: number;
        }
      >;
    }
  ).points;
  if (!points || typeof points !== "object") return [];
  const eaters: Eater[] = [];
  for (const [key, entry] of Object.entries(points)) {
    if (!entry || typeof entry !== "object") continue;
    const mapped = rowToEater({
      address: entry.wallet || key,
      score: Number(entry.points ?? entry.score ?? 0) || 0,
      trades: Number(entry.trade_count ?? entry.trades ?? 0) || 0,
      ineligible: entry.ineligible,
      dev: entry.dev,
      badge: entry.badge,
    });
    if (mapped && (mapped.score > 0 || mapped.buyCount > 0 || mapped.dev)) {
      eaters.push(mapped);
    }
  }
  return sortAct1(eaters);
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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function payloadFromRaw(publicRaw: unknown): Act1LeaderboardPayload | null {
  if (!publicRaw || typeof publicRaw !== "object") return null;
  const payload = publicRaw as {
    updatedAt?: string;
    phase?: number;
    scoring?: string;
    tradeFromBlock?: number;
    eaters?: RawRow[];
  };
  if (!Array.isArray(payload.eaters)) return null;
  const eaters = sortAct1(
    payload.eaters
      .map(rowToEater)
      .filter((e): e is Eater => Boolean(e)),
  );
  return {
    updatedAt: payload.updatedAt,
    phase: payload.phase,
    scoring: payload.scoring ?? "act1",
    tradeFromBlock: payload.tradeFromBlock,
    eaters,
  };
}

/**
 * Act I trades + points leaderboard.
 * Prefers optional remote URL, then sanitized public export, then bot state.
 */
export async function fetchAct1Leaderboard(): Promise<Act1LeaderboardPayload> {
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
    eaters,
  };
}
