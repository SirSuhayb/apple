import { readFile, writeFile } from "fs/promises";
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

function seedHighWater(): HighWater {
  return {
    peakVolumeH24: 235_125,
    peakVolumeH6: 235_125,
    peakMcapUsd: 37_706,
    updatedAt: new Date(0).toISOString(),
  };
}

async function readHighWater(): Promise<HighWater> {
  const seed = seedHighWater();
  try {
    const raw = JSON.parse(await readFile(HIGHWATER_PATH, "utf8")) as Partial<HighWater>;
    return {
      peakVolumeH24: Math.max(seed.peakVolumeH24, num(raw.peakVolumeH24) ?? 0),
      peakVolumeH6: Math.max(seed.peakVolumeH6, num(raw.peakVolumeH6) ?? 0),
      peakMcapUsd: Math.max(seed.peakMcapUsd, num(raw.peakMcapUsd) ?? 0),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : seed.updatedAt,
    };
  } catch {
    return seed;
  }
}

async function writeHighWater(next: HighWater): Promise<void> {
  try {
    await writeFile(HIGHWATER_PATH, JSON.stringify(next, null, 2));
  } catch {
    // localhost-only cache; ignore if the tree is read-only
  }
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
    readHighWater(),
  ]);

  const nextWater: HighWater = {
    peakVolumeH24: Math.max(water.peakVolumeH24, tape.volumeH24 ?? 0),
    peakVolumeH6: Math.max(water.peakVolumeH6, tape.volumeH6 ?? 0),
    peakMcapUsd: Math.max(water.peakMcapUsd, tape.mcapUsd ?? 0),
    updatedAt: new Date().toISOString(),
  };
  if (
    nextWater.peakVolumeH24 > water.peakVolumeH24 ||
    nextWater.peakVolumeH6 > water.peakVolumeH6 ||
    nextWater.peakMcapUsd > water.peakMcapUsd
  ) {
    void writeHighWater(nextWater);
  }

  const last = await fetchLastEatAt(nowSec, tape);
  const scored = scoreDecay({
    nowSec,
    lastEatAt: last.at,
    volumeH24: tape.volumeH24,
    volumeH6: tape.volumeH6,
    peakVolumeH24: nextWater.peakVolumeH24,
    peakVolumeH6: nextWater.peakVolumeH6,
    mcapUsd: tape.mcapUsd,
    peakMcapUsd: nextWater.peakMcapUsd,
  });

  const value: DecaySnapshot = {
    ...scored,
    lastEatAt: last.at,
    lastEatSource: last.source,
  };
  snapshotCache = { at: nowMs, value };
  return value;
}
