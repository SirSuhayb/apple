import { createPublicClient, formatEther, http } from "viem";
import { appleKitchenAbi, erc20Abi, ponsFeeEscrowAbi } from "./abis";
import { robinhoodChain } from "./chain";
import {
  AAPL_TOKEN,
  APPLE_KITCHEN,
  BITE_TOKEN,
  DEXSCREENER_PAIR_ID,
  PONS_FEE_ESCROW,
  RPC_URL,
} from "./config";
import type { SupplyStats } from "./race";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

/** Last known kitchen-attributed escrow claimable (~0.539 AAPL / $178). Used only if RPC fails. */
const LAST_KNOWN_ESCROW_CLAIMABLE_AAPL = 0.539059;

const DEXSCREENER_API_URL = `https://api.dexscreener.com/latest/dex/pairs/robinhood/${DEXSCREENER_PAIR_ID}`;

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL, { timeout: 8_000 }),
});

export type LiveSupplyOverlay = {
  prizePoolAapl: number;
  prizePoolUsd: number | null;
  aaplPriceUsd: number | null;
  bitePriceUsd: number | null;
  totalSupply: number | null;
  totalBurned: number | null;
  updatedAt: string;
};

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

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function readAaplPriceUsd(): Promise<{
  aaplPriceUsd: number | null;
  bitePriceUsd: number | null;
}> {
  const raw = await fetchJson(DEXSCREENER_API_URL);
  if (!raw || typeof raw !== "object") {
    return { aaplPriceUsd: null, bitePriceUsd: null };
  }
  const pairs = (raw as { pairs?: unknown[] }).pairs;
  const pair = Array.isArray(pairs) ? pairs[0] : null;
  if (!pair || typeof pair !== "object") {
    return { aaplPriceUsd: null, bitePriceUsd: null };
  }
  const p = pair as {
    priceUsd?: unknown;
    priceNative?: unknown;
    quoteToken?: { symbol?: string };
  };
  const priceUsd = num(p.priceUsd);
  const priceNative = num(p.priceNative);
  const aaplPriceUsd =
    p.quoteToken?.symbol === "AAPL" &&
    priceUsd != null &&
    priceNative != null &&
    priceNative > 0
      ? priceUsd / priceNative
      : null;
  return { aaplPriceUsd, bitePriceUsd: priceUsd };
}

let overlayCache: { at: number; value: LiveSupplyOverlay | null } | null = null;
const OVERLAY_TTL_MS = 5_000;

/**
 * Displayed prize pool = kitchen AAPL + Pons escrow claimable for the kitchen.
 * Does not claim. Does not use the escrow's total AAPL (other creators).
 */
export async function fetchLiveSupplyOverlay(): Promise<LiveSupplyOverlay | null> {
  const now = Date.now();
  if (overlayCache && now - overlayCache.at < OVERLAY_TTL_MS) {
    return overlayCache.value;
  }
  const value = await fetchLiveSupplyOverlayUncached();
  overlayCache = { at: now, value };
  return value;
}

async function fetchLiveSupplyOverlayUncached(): Promise<LiveSupplyOverlay | null> {
  const [kitchenBal, escrowClaimable, totalSupply, deadBal, kitchenBurned, kitchenBite, prices] =
    await Promise.all([
      client
        .readContract({
          address: AAPL_TOKEN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [APPLE_KITCHEN],
        })
        .catch(() => null),
      client
        .readContract({
          address: PONS_FEE_ESCROW,
          abi: ponsFeeEscrowAbi,
          functionName: "balanceOfToken",
          args: [APPLE_KITCHEN, AAPL_TOKEN],
        })
        .catch(() => null),
      client
        .readContract({
          address: BITE_TOKEN,
          abi: erc20Abi,
          functionName: "totalSupply",
        })
        .catch(() => null),
      client
        .readContract({
          address: BITE_TOKEN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [DEAD_ADDRESS],
        })
        .catch(() => null),
      client
        .readContract({
          address: APPLE_KITCHEN,
          abi: appleKitchenAbi,
          functionName: "burned",
        })
        .catch(() => null),
      client
        .readContract({
          address: BITE_TOKEN,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [APPLE_KITCHEN],
        })
        .catch(() => null),
      readAaplPriceUsd(),
    ]);

  const kitchenAapl =
    kitchenBal != null ? Number(formatEther(kitchenBal)) : 0;
  const escrowAapl =
    escrowClaimable != null
      ? Number(formatEther(escrowClaimable))
      : LAST_KNOWN_ESCROW_CLAIMABLE_AAPL;
  const prizePoolAapl = kitchenAapl + escrowAapl;
  const aaplPriceUsd = prices.aaplPriceUsd;
  const prizePoolUsd =
    aaplPriceUsd != null && prizePoolAapl > 0
      ? prizePoolAapl * aaplPriceUsd
      : null;

  const burnedRaw =
    deadBal != null || kitchenBurned != null || kitchenBite != null
      ? (deadBal ?? BigInt(0)) +
        (kitchenBurned ?? BigInt(0)) +
        (kitchenBite ?? BigInt(0))
      : null;

  return {
    prizePoolAapl,
    prizePoolUsd,
    aaplPriceUsd,
    bitePriceUsd: prices.bitePriceUsd,
    totalSupply: totalSupply != null ? Number(formatEther(totalSupply)) : null,
    totalBurned: burnedRaw != null ? Number(formatEther(burnedRaw)) : null,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeSupplyStats(
  base: SupplyStats | undefined,
  live: LiveSupplyOverlay | null,
): SupplyStats | undefined {
  if (!base && !live) return undefined;
  const eoaHeldBite = base?.eoaHeldBite ?? 0;
  const fallback: SupplyStats = base ?? {
    prizePoolAapl: 0,
    prizePoolUsd: null,
    aaplPriceUsd: null,
    eoaHeldBite: 0,
    circulatingSupply: 0,
    contractHeldBite: 0,
    realisticallyBurnable: 0,
    totalSupply: 0,
    totalBurned: 0,
    holderCount: 0,
    bitePriceUsd: null,
  };
  const withCirculating: SupplyStats = {
    ...fallback,
    eoaHeldBite,
    circulatingSupply: eoaHeldBite,
  };
  if (!live) return withCirculating;
  return {
    ...withCirculating,
    prizePoolAapl: live.prizePoolAapl,
    prizePoolUsd: live.prizePoolUsd ?? withCirculating.prizePoolUsd,
    aaplPriceUsd: live.aaplPriceUsd ?? withCirculating.aaplPriceUsd,
    bitePriceUsd: live.bitePriceUsd ?? withCirculating.bitePriceUsd,
    totalSupply: live.totalSupply ?? withCirculating.totalSupply,
    totalBurned: live.totalBurned ?? withCirculating.totalBurned,
    updatedAt: live.updatedAt,
  };
}
