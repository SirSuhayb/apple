import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createPublicClient, http, parseAbiItem } from "viem";
import { robinhoodChain } from "./chain";
import {
  APPLE_KITCHEN,
  DEXSCREENER_PAIR_ID,
  RPC_URL,
  UNISWAP_POOL_MANAGER,
  V4_POOL_ID,
  V4_POOL_INIT_BLOCK,
} from "./config";
import { scoreDecay, type DecayScore } from "./decay";
import {
  DECAY_FLOOR_SEED_USD,
  DECAY_WEEK_ATH_SEED_USD,
  floorsFromWeekly,
  rollWeeklyFloors,
  type DecayFloors,
} from "./decay-week";

export type { DecayFloors };

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL, { timeout: 8_000 }),
});

const DEXSCREENER_API_URL = `https://api.dexscreener.com/latest/dex/pairs/robinhood/${DEXSCREENER_PAIR_ID}`;

const v4SwapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);

const appleEatenEvent = parseAbiItem(
  "event AppleEaten(address indexed eater, uint256 amount, uint8 kind)",
);

/** Dust floor — ~1k $BITE. Kitchen bites of any size count. */
const MIN_SWAP_BITE = 1_000n * 10n ** 18n;

const HIGHWATER_PATH = path.join(
  process.cwd(),
  "bots",
  "data",
  "decay-highwater.json",
);

type HighWater = {
  peakVolumeH24: number;
  peakVolumeH6: number;
  peakMcapUsd: number;
  weekId: string;
  weekAthMcapUsd: number;
  currentWeekFloorUsd: number;
  updatedAt: string;
};

type PairTape = {
  volumeH24: number | null;
  volumeH6: number | null;
  mcapUsd: number | null;
  txnsH1: number;
  txnsM5: number;
  txnsH6: number;
  txnsH24: number;
};

export type DecaySnapshot = DecayScore & {
  lastEatAt: number | null;
  lastEatSource: "kitchen" | "v4" | "inferred" | null;
  floors: DecayFloors;
};

let snapshotCache: { at: number; value: DecaySnapshot } | null = null;
const SNAPSHOT_TTL_MS = 20_000;

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url: string, ms = 4_000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function seedHighWater(nowMs: number): HighWater {
  const weekly = rollWeeklyFloors(null, nowMs, DECAY_WEEK_ATH_SEED_USD);
  return {
    peakVolumeH24: 235_125,
    peakVolumeH6: 235_125,
    peakMcapUsd: Math.max(DECAY_WEEK_ATH_SEED_USD, 37_706),
    weekId: weekly.weekId,
    weekAthMcapUsd: weekly.weekAthMcapUsd,
    currentWeekFloorUsd: weekly.currentWeekFloorUsd,
    updatedAt: new Date(0).toISOString(),
  };
}

function parseHighWater(raw: unknown, nowMs: number): HighWater | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seed = seedHighWater(nowMs);
  const peakVolumeH24 = Math.max(seed.peakVolumeH24, num(o.peakVolumeH24) ?? 0);
  const peakVolumeH6 = Math.max(seed.peakVolumeH6, num(o.peakVolumeH6) ?? 0);
  const peakMcapUsd = Math.max(seed.peakMcapUsd, num(o.peakMcapUsd) ?? 0);
  const storedWeekId = typeof o.weekId === "string" ? o.weekId : "";
  const weekly = rollWeeklyFloors(
    {
      weekId: storedWeekId,
      weekAthMcapUsd: num(o.weekAthMcapUsd) ?? 0,
      currentWeekFloorUsd:
        num(o.currentWeekFloorUsd) ?? DECAY_FLOOR_SEED_USD,
    },
    nowMs,
    null, // do not treat all-time peakMcap as this week's print
  );
  // Same ISO week: warm weekly ATH from stored all-time peak (pre-weekly history).
  if (storedWeekId && weekly.weekId === storedWeekId) {
    weekly.weekAthMcapUsd = Math.max(weekly.weekAthMcapUsd, peakMcapUsd);
  }
  return {
    peakVolumeH24,
    peakVolumeH6,
    peakMcapUsd,
    weekId: weekly.weekId,
    weekAthMcapUsd: weekly.weekAthMcapUsd,
    currentWeekFloorUsd: weekly.currentWeekFloorUsd,
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : seed.updatedAt,
  };
}

function mergeHighWater(a: HighWater, b: HighWater, nowMs: number): HighWater {
  const peakVolumeH24 = Math.max(a.peakVolumeH24, b.peakVolumeH24);
  const peakVolumeH6 = Math.max(a.peakVolumeH6, b.peakVolumeH6);
  const peakMcapUsd = Math.max(a.peakMcapUsd, b.peakMcapUsd);
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const older = newer === a ? b : a;
  let weekly = rollWeeklyFloors(
    {
      weekId: newer.weekId,
      weekAthMcapUsd: newer.weekAthMcapUsd,
      currentWeekFloorUsd: newer.currentWeekFloorUsd,
    },
    nowMs,
    null,
  );
  if (older.weekId === weekly.weekId) {
    weekly = {
      ...weekly,
      weekAthMcapUsd: Math.max(weekly.weekAthMcapUsd, older.weekAthMcapUsd),
      currentWeekFloorUsd: Math.max(
        weekly.currentWeekFloorUsd,
        older.currentWeekFloorUsd,
      ),
    };
  }
  if (newer.weekId === weekly.weekId) {
    weekly.weekAthMcapUsd = Math.max(weekly.weekAthMcapUsd, newer.weekAthMcapUsd);
  }
  return {
    peakVolumeH24,
    peakVolumeH6,
    peakMcapUsd,
    weekId: weekly.weekId,
    weekAthMcapUsd: weekly.weekAthMcapUsd,
    currentWeekFloorUsd: weekly.currentWeekFloorUsd,
    updatedAt: newer.updatedAt >= older.updatedAt ? newer.updatedAt : older.updatedAt,
  };
}

function deriveDecayHighwaterUrls(): string[] {
  const urls: string[] = [];
  const explicit = process.env.BITE_DECAY_HIGHWATER_URL?.trim();
  if (explicit) urls.push(explicit);

  const boardUrl = process.env.BITE_LEADERBOARD_URL?.trim();
  if (boardUrl) {
    try {
      const u = new URL(boardUrl);
      u.pathname = u.pathname.replace(
        /leaderboard\.json\/?$/i,
        "decay-highwater.json",
      );
      if (!/decay-highwater\.json$/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/?$/, "/decay-highwater.json");
      }
      urls.push(u.toString());
    } catch {
      // ignore bad URL
    }
  }
  return urls;
}

async function readRemoteHighWater(nowMs: number): Promise<HighWater | null> {
  for (const url of deriveDecayHighwaterUrls()) {
    const parsed = parseHighWater(await fetchJson(url, 3_500), nowMs);
    if (parsed) return parsed;
  }
  return null;
}

async function readLocalHighWater(nowMs: number): Promise<HighWater | null> {
  try {
    const raw = JSON.parse(await readFile(HIGHWATER_PATH, "utf8")) as unknown;
    return parseHighWater(raw, nowMs);
  } catch {
    return null;
  }
}

async function readHighWater(nowMs: number): Promise<HighWater> {
  const seed = seedHighWater(nowMs);
  const [remote, local] = await Promise.all([
    readRemoteHighWater(nowMs),
    readLocalHighWater(nowMs),
  ]);
  let merged = seed;
  if (local) merged = mergeHighWater(merged, local, nowMs);
  if (remote) merged = mergeHighWater(merged, remote, nowMs);
  return merged;
}

async function writeLocalHighWater(next: HighWater): Promise<void> {
  try {
    await mkdir(path.dirname(HIGHWATER_PATH), { recursive: true });
    await writeFile(HIGHWATER_PATH, JSON.stringify(next, null, 2));
  } catch {
    // Vercel / read-only FS — ignore
  }
}

async function writeRemoteHighWater(next: HighWater): Promise<void> {
  const urls = deriveDecayHighwaterUrls();
  if (!urls.length) return;
  await Promise.all(
    urls.map(async (url) => {
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
          cache: "no-store",
          signal: AbortSignal.timeout(3_500),
        });
      } catch {
        // bot may be down; local + in-memory still score
      }
    }),
  );
}

async function persistHighWater(next: HighWater, prev: HighWater): Promise<void> {
  const changed =
    next.peakVolumeH24 > prev.peakVolumeH24 ||
    next.peakVolumeH6 > prev.peakVolumeH6 ||
    next.peakMcapUsd > prev.peakMcapUsd ||
    next.weekAthMcapUsd > prev.weekAthMcapUsd ||
    next.weekId !== prev.weekId ||
    next.currentWeekFloorUsd !== prev.currentWeekFloorUsd;
  if (!changed) return;
  void writeLocalHighWater(next);
  void writeRemoteHighWater(next);
}

export async function fetchDexscreenerTape(): Promise<PairTape> {
  const empty: PairTape = {
    volumeH24: null,
    volumeH6: null,
    mcapUsd: null,
    txnsH1: 0,
    txnsM5: 0,
    txnsH6: 0,
    txnsH24: 0,
  };
  const raw = await fetchJson(DEXSCREENER_API_URL);
  if (!raw || typeof raw !== "object") return empty;
  const pairs = (raw as { pairs?: unknown[] }).pairs;
  const pair = Array.isArray(pairs) ? pairs[0] : null;
  if (!pair || typeof pair !== "object") return empty;
  const p = pair as {
    volume?: { h24?: unknown; h6?: unknown };
    marketCap?: unknown;
    fdv?: unknown;
    txns?: Record<string, { buys?: unknown; sells?: unknown }>;
  };
  const windowTx = (key: string) => {
    const w = p.txns?.[key];
    return (num(w?.buys) ?? 0) + (num(w?.sells) ?? 0);
  };
  return {
    volumeH24: num(p.volume?.h24),
    volumeH6: num(p.volume?.h6),
    mcapUsd: num(p.marketCap) ?? num(p.fdv),
    txnsM5: windowTx("m5"),
    txnsH1: windowTx("h1"),
    txnsH6: windowTx("h6"),
    txnsH24: windowTx("h24"),
  };
}

function inferLastEatFromTape(tape: PairTape, nowSec: number): number | null {
  if (tape.txnsM5 > 0) return nowSec - 3 * 60;
  if (tape.txnsH1 > 0) return nowSec - 35 * 60;
  if (tape.txnsH6 > 0) return nowSec - 3 * 3600;
  if (tape.txnsH24 > 0) return nowSec - 14 * 3600;
  return nowSec - 60 * 3600;
}

async function blockTimestamp(blockNumber: bigint): Promise<number | null> {
  try {
    const block = await client.getBlock({ blockNumber });
    return Number(block.timestamp);
  } catch {
    return null;
  }
}

function isMeaningfulSwap(amount0: bigint): boolean {
  const abs = amount0 < 0n ? -amount0 : amount0;
  return abs >= MIN_SWAP_BITE;
}

async function latestAppleEatenAt(
  fromBlock: bigint,
  toBlock: bigint,
): Promise<number | null> {
  if (!APPLE_KITCHEN) return null;
  try {
    const logs = await client.getLogs({
      address: APPLE_KITCHEN,
      event: appleEatenEvent,
      fromBlock,
      toBlock,
    });
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    if (!last?.blockNumber) return null;
    return blockTimestamp(last.blockNumber);
  } catch {
    return null;
  }
}

async function latestMeaningfulSwapAt(
  fromBlock: bigint,
  toBlock: bigint,
): Promise<number | null> {
  try {
    const logs = await client.getLogs({
      address: UNISWAP_POOL_MANAGER,
      event: v4SwapEvent,
      args: { id: V4_POOL_ID as `0x${string}` },
      fromBlock,
      toBlock,
    });
    for (let i = logs.length - 1; i >= 0; i--) {
      const log = logs[i];
      if (!log?.blockNumber) continue;
      const amount0 = log.args.amount0;
      if (amount0 == null || !isMeaningfulSwap(amount0)) continue;
      return blockTimestamp(log.blockNumber);
    }
    if (logs.length > 0 && logs[logs.length - 1]?.blockNumber) {
      return blockTimestamp(logs[logs.length - 1]!.blockNumber);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Last kitchen bite or meaningful BITE/AAPL v4 swap.
 * Walks recent windows first so a quiet tape is not stamped as "now".
 */
export async function fetchLastEatAt(
  nowSec: number,
  tape: PairTape,
): Promise<{ at: number | null; source: DecaySnapshot["lastEatSource"] }> {
  try {
    const latest = await client.getBlockNumber();
    const lookbacks: bigint[] = [
      8_000n,
      40_000n,
      160_000n,
      latest > V4_POOL_INIT_BLOCK ? latest - V4_POOL_INIT_BLOCK : 0n,
    ];
    let cursor = latest;
    for (const span of lookbacks) {
      if (span <= 0n) continue;
      const from = cursor > span ? cursor - span : V4_POOL_INIT_BLOCK;
      const [eaten, swap] = await Promise.all([
        latestAppleEatenAt(from, latest),
        latestMeaningfulSwapAt(from, latest),
      ]);
      const at = [eaten, swap].filter((n): n is number => n != null && n > 0);
      if (at.length) {
        const best = Math.max(...at);
        return {
          at: best,
          source: eaten != null && eaten >= best ? "kitchen" : "v4",
        };
      }
      cursor = from > 0n ? from - 1n : 0n;
      if (from <= V4_POOL_INIT_BLOCK) break;
    }
  } catch {
    // fall through to tape inference
  }
  const inferred = inferLastEatFromTape(tape, nowSec);
  return { at: inferred, source: inferred != null ? "inferred" : null };
}

export async function fetchDecaySnapshot(): Promise<DecaySnapshot> {
  const nowMs = Date.now();
  if (snapshotCache && nowMs - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.value;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const [tape, water] = await Promise.all([
    fetchDexscreenerTape(),
    readHighWater(nowMs),
  ]);

  const weekly = rollWeeklyFloors(
    {
      weekId: water.weekId,
      weekAthMcapUsd: water.weekAthMcapUsd,
      currentWeekFloorUsd: water.currentWeekFloorUsd,
    },
    nowMs,
    tape.mcapUsd,
  );
  weekly.weekAthMcapUsd = Math.max(weekly.weekAthMcapUsd, tape.mcapUsd ?? 0);

  const nextWater: HighWater = {
    peakVolumeH24: Math.max(water.peakVolumeH24, tape.volumeH24 ?? 0),
    peakVolumeH6: Math.max(water.peakVolumeH6, tape.volumeH6 ?? 0),
    peakMcapUsd: Math.max(water.peakMcapUsd, tape.mcapUsd ?? 0),
    weekId: weekly.weekId,
    weekAthMcapUsd: weekly.weekAthMcapUsd,
    currentWeekFloorUsd: weekly.currentWeekFloorUsd,
    updatedAt: new Date().toISOString(),
  };
  void persistHighWater(nextWater, water);

  const last = await fetchLastEatAt(nowSec, tape);
  const floors = floorsFromWeekly(weekly);
  const scored = scoreDecay({
    nowSec,
    lastEatAt: last.at,
    volumeH24: tape.volumeH24,
    volumeH6: tape.volumeH6,
    peakVolumeH24: nextWater.peakVolumeH24,
    peakVolumeH6: nextWater.peakVolumeH6,
    mcapUsd: tape.mcapUsd,
    peakMcapUsd: nextWater.peakMcapUsd,
    currentWeekFloorUsd: weekly.currentWeekFloorUsd,
  });

  const value: DecaySnapshot = {
    ...scored,
    lastEatAt: last.at,
    lastEatSource: last.source,
    floors,
  };
  snapshotCache = { at: nowMs, value };
  return value;
}
