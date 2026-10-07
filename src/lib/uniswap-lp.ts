import { encodeAbiParameters, keccak256, zeroAddress } from "viem";
import {
  AAPL_TOKEN,
  BITE_TOKEN,
  CHAIN_ID,
  UNISWAP_POSITION_MANAGER,
} from "./config";
import {
  SWAP_SLIPPAGE_PERCENT,
  SWAP_TOKENS,
  parseAllowedToken,
  parseHumanAmount,
  parseSwapAddress,
  parseWeiAmount,
  validateSwapBeforeBroadcast,
  type SwapTransaction,
} from "./uniswap-trade";

export const LP_PROTOCOL = "V4" as const;
export const LP_SLIPPAGE_PERCENT = SWAP_SLIPPAGE_PERCENT;
export const LP_QUOTE_MAX_AGE_MS = 25_000;

/** Seed target: 1% LP fee, no hook. Cannot be added onto the live 0% pool. */
export const LP_SEED_FEE_PIPS = 10_000;
export const LP_SEED_TICK_SPACING = 200;
export const LP_SEED_HOOK = zeroAddress;

const MIN_TICK = -887272;
const MAX_TICK = 887272;

export type LpTokenAmount = { tokenAddress: string; amount: string };

export type LpCreateResponse = {
  requestId?: string;
  token0: LpTokenAmount;
  token1: LpTokenAmount;
  tickLower: number;
  tickUpper: number;
  adjustedMinPrice?: string;
  adjustedMaxPrice?: string;
  create: SwapTransaction;
  gasFee?: string;
  error?: string;
};

export type LpApprovalTx = {
  transaction: SwapTransaction;
  cancelApproval?: boolean;
  action?: string;
};

export type PermitData = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  values: Record<string, unknown>;
  primaryType?: string;
};

export type LpApprovalResponse = {
  requestId?: string;
  transactions?: LpApprovalTx[];
  v4BatchPermitData?: PermitData | null;
  error?: string;
};

export type LpPoolInfo = {
  poolReferenceIdentifier: string;
  poolProtocol: string;
  tokenAddressA: string;
  tokenAddressB: string;
  tickSpacing: number;
  fee: number;
  hookAddress?: string;
  chainId: number;
  poolLiquidity?: string;
  currentTick?: number;
  tokenDecimalsA?: string;
  tokenDecimalsB?: string;
  sqrtRatioX96?: string;
  token0Reserves?: string;
  token1Reserves?: string;
  /** Present only if Uniswap sends it — do not invent. */
  volume24hUsd?: number | string;
  volumeUSD?: number | string;
  tvlUsd?: number | string;
  tvlUSD?: number | string;
  totalValueLockedUSD?: number | string;
  apr?: number | string;
  feeApr?: number | string;
  feeAPR?: number | string;
};

export type LpClaimResponse = {
  requestId?: string;
  token0: LpTokenAmount;
  token1: LpTokenAmount;
  claim: SwapTransaction;
  error?: string;
};

export type LpDecreaseResponse = {
  requestId?: string;
  token0: LpTokenAmount;
  token1: LpTokenAmount;
  decrease: SwapTransaction;
  error?: string;
};

export type LpPositionFees = {
  biteWei: string;
  aaplWei: string;
};

export type LpPosition = {
  tokenId: string;
  liquidity: string;
  fees: LpPositionFees;
  feePips: number;
  hookAddress: string;
};

export type LpPositionsResponse = {
  positions: LpPosition[];
  error?: string;
};

export type LpFeeEstimate = {
  sharePercent: number | null;
  feeTierPercent: number | null;
  volumeUsd24h: number | null;
  tvlUsd: number | null;
  aprPercent: number | null;
  estimatedUsdPerDay: number | null;
  hookAddress: string | null;
  /** Why the $/day line is missing, if it is. */
  gap:
    | null
    | "zero_fee"
    | "no_volume"
    | "thin_volume"
    | "no_share"
    | "empty_amount";
};

export function sortedLpPair(): {
  token0: typeof BITE_TOKEN;
  token1: typeof AAPL_TOKEN;
} {
  return BITE_TOKEN.toLowerCase() < AAPL_TOKEN.toLowerCase()
    ? { token0: BITE_TOKEN, token1: AAPL_TOKEN }
    : { token0: AAPL_TOKEN, token1: BITE_TOKEN };
}

/** v4 pool id = keccak256(abi.encode(PoolKey)). */
export function v4PoolId(params: {
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}): `0x${string}` {
  const { token0, token1 } = sortedLpPair();
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [token0, token1, params.fee, params.tickSpacing, params.hooks],
    ),
  );
}

export const LP_FEE_POOL_ID = v4PoolId({
  fee: LP_SEED_FEE_PIPS,
  tickSpacing: LP_SEED_TICK_SPACING,
  hooks: LP_SEED_HOOK,
});

export function syntheticSeedPool(): LpPoolInfo {
  const { token0, token1 } = sortedLpPair();
  return {
    poolReferenceIdentifier: LP_FEE_POOL_ID,
    poolProtocol: LP_PROTOCOL,
    tokenAddressA: token0,
    tokenAddressB: token1,
    tickSpacing: LP_SEED_TICK_SPACING,
    fee: LP_SEED_FEE_PIPS,
    hookAddress: LP_SEED_HOOK,
    chainId: CHAIN_ID,
    token0Reserves: "0",
    token1Reserves: "0",
    poolLiquidity: "0",
  };
}

/** Snap MIN/MAX tick to the pool's spacing — full-range only. */
export function fullRangeTicks(tickSpacing: number): {
  tickLower: number;
  tickUpper: number;
} {
  const spacing = Number.isInteger(tickSpacing) && tickSpacing > 0 ? tickSpacing : 200;
  return {
    tickLower: nearestUsableTick(MIN_TICK, spacing),
    tickUpper: nearestUsableTick(MAX_TICK, spacing),
  };
}

function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  if (rounded < MIN_TICK) return rounded + tickSpacing;
  if (rounded > MAX_TICK) return rounded - tickSpacing;
  return rounded;
}

export function parseLpIndependent(value: string): `0x${string}` {
  const key = value.trim().toLowerCase();
  if (key === "bite") return SWAP_TOKENS.bite.address;
  if (key === "aapl") return SWAP_TOKENS.aapl.address;
  return parseAllowedToken(value);
}

export function amountForToken(
  token0: LpTokenAmount,
  token1: LpTokenAmount,
  token: string,
): string {
  const lower = token.toLowerCase();
  if (token0.tokenAddress.toLowerCase() === lower) return token0.amount;
  if (token1.tokenAddress.toLowerCase() === lower) return token1.amount;
  throw new Error("Token not in LP quote");
}

export function validateLpCreateTx(tx: SwapTransaction): void {
  validateSwapBeforeBroadcast(tx);
  if (tx.to.toLowerCase() !== UNISWAP_POSITION_MANAGER.toLowerCase()) {
    throw new Error("Unexpected LP target");
  }
}

export function validateLpManagerTx(tx: SwapTransaction): void {
  validateLpCreateTx(tx);
}

export function parseTokenId(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed) || trimmed.length > 78) {
    throw new Error("Invalid position");
  }
  return trimmed;
}

function firstFiniteNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Uniswap v3/v4 fee is in pips (hundredths of a bip). 3000 = 0.30%. */
export function feePipsToPercent(fee: number): number {
  return fee / 10_000;
}

export function feePipsToRate(fee: number): number {
  return fee / 1_000_000;
}

const THIN_VOLUME_USD = 100;

function bigintOrZero(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
}

function reserveForToken(pool: LpPoolInfo, token: string): bigint {
  const { token0, token1 } = sortedLpPair();
  const lower = token.toLowerCase();
  if (token0.toLowerCase() === lower) return bigintOrZero(pool.token0Reserves);
  if (token1.toLowerCase() === lower) return bigintOrZero(pool.token1Reserves);
  const a = pool.tokenAddressA?.toLowerCase();
  const b = pool.tokenAddressB?.toLowerCase();
  if (a === lower) return bigintOrZero(pool.token0Reserves);
  if (b === lower) return bigintOrZero(pool.token1Reserves);
  return 0n;
}

/**
 * Full-range share of current reserves, then optional $/day from Uniswap
 * fee × volume × share (or APR if the API actually sent one).
 */
export function estimateSeedFees(params: {
  pool: LpPoolInfo | null;
  biteWei: bigint;
  aaplWei: bigint;
}): LpFeeEstimate {
  const empty: LpFeeEstimate = {
    sharePercent: null,
    feeTierPercent: null,
    volumeUsd24h: null,
    tvlUsd: null,
    aprPercent: null,
    estimatedUsdPerDay: null,
    hookAddress: null,
    gap: "empty_amount",
  };
  if (params.biteWei <= 0n || !params.pool) return empty;

  const pool = params.pool;
  const hook =
    pool.hookAddress && pool.hookAddress !== "0x0000000000000000000000000000000000000000"
      ? pool.hookAddress
      : null;
  const fee = Number.isFinite(pool.fee) ? pool.fee : null;
  const feeTierPercent = fee == null ? null : feePipsToPercent(fee);
  const record = pool as unknown as Record<string, unknown>;
  const volumeUsd24h = firstFiniteNumber(record, [
    "volume24hUsd",
    "volumeUSD",
    "volume24h",
    "volume24H",
  ]);
  const tvlUsd = firstFiniteNumber(record, [
    "tvlUsd",
    "tvlUSD",
    "totalValueLockedUSD",
  ]);
  const aprPercent = firstFiniteNumber(record, ["apr", "feeApr", "feeAPR", "lpApr"]);

  const poolBite = reserveForToken(pool, BITE_TOKEN);
  const poolAapl = reserveForToken(pool, AAPL_TOKEN);
  const postBite = poolBite + params.biteWei;
  const postAapl = poolAapl + params.aaplWei;

  let sharePercent: number | null = null;
  if (postBite > 0n && postAapl > 0n) {
    const biteShare = Number((params.biteWei * 1_000_000_000n) / postBite) / 1e9;
    const aaplShare =
      params.aaplWei > 0n
        ? Number((params.aaplWei * 1_000_000_000n) / postAapl) / 1e9
        : biteShare;
    sharePercent = ((biteShare + aaplShare) / 2) * 100;
  } else if (poolBite === 0n && poolAapl === 0n && params.biteWei > 0n) {
    sharePercent = 100;
  }

  let estimatedUsdPerDay: number | null = null;
  let gap: LpFeeEstimate["gap"] = null;

  if (sharePercent == null) {
    gap = "no_share";
  } else if (aprPercent != null && tvlUsd != null) {
    estimatedUsdPerDay = (tvlUsd * (sharePercent / 100) * (aprPercent / 100)) / 365;
  } else if (fee == null || fee <= 0) {
    gap = "zero_fee";
  } else if (volumeUsd24h == null) {
    gap = "no_volume";
  } else if (volumeUsd24h < THIN_VOLUME_USD) {
    gap = "thin_volume";
  } else {
    estimatedUsdPerDay = volumeUsd24h * feePipsToRate(fee) * (sharePercent / 100);
  }

  return {
    sharePercent,
    feeTierPercent,
    volumeUsd24h,
    tvlUsd,
    aprPercent,
    estimatedUsdPerDay,
    hookAddress: hook,
    gap,
  };
}

export function formatSharePercent(share: number): string {
  if (share >= 99.5) return "100%";
  if (share >= 10) return `${share.toFixed(1)}%`;
  if (share >= 0.01) return `${share.toFixed(2)}%`;
  return "<0.01%";
}

export function formatFeeTier(pips: number): string {
  const pct = feePipsToPercent(pips);
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

export function formatUsdEstimate(value: number): string {
  if (value >= 100) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (value >= 1) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(4)}`;
}

export function validateApprovalTx(tx: SwapTransaction, wallet: string): void {
  validateSwapBeforeBroadcast(tx);
  if (tx.from.toLowerCase() !== wallet.toLowerCase()) {
    throw new Error("Approval wallet mismatch");
  }
  const allowed = new Set([
    BITE_TOKEN.toLowerCase(),
    AAPL_TOKEN.toLowerCase(),
  ]);
  if (!allowed.has(tx.to.toLowerCase())) {
    throw new Error("Unexpected approval target");
  }
}

export function normalizePermitTypes(
  types: Record<string, unknown>,
): Record<string, Array<{ name: string; type: string }>> {
  const out: Record<string, Array<{ name: string; type: string }>> = {};
  for (const [key, value] of Object.entries(types)) {
    if (key === "EIP712Domain") continue;
    if (Array.isArray(value)) {
      out[key] = value as Array<{ name: string; type: string }>;
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      "fields" in value &&
      Array.isArray((value as { fields: unknown }).fields)
    ) {
      out[key] = (value as { fields: Array<{ name: string; type: string }> }).fields;
    }
  }
  return out;
}

export function normalizePermitDomain(
  domain: Record<string, unknown>,
  chainId: number,
): Record<string, unknown> {
  const raw = domain.chainId;
  if (typeof raw === "string" && /robinhood/i.test(raw)) {
    return { ...domain, chainId };
  }
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    return { ...domain, chainId: Number(raw) };
  }
  return domain;
}

export function existingPoolBody(poolReference: string = LP_FEE_POOL_ID) {
  const { token0, token1 } = sortedLpPair();
  return {
    token0Address: token0,
    token1Address: token1,
    poolReference,
  };
}

export function newFeePoolBody(initialPrice: string) {
  const { token0, token1 } = sortedLpPair();
  return {
    token0Address: token0,
    token1Address: token1,
    fee: LP_SEED_FEE_PIPS,
    tickSpacing: LP_SEED_TICK_SPACING,
    hookAddress: LP_SEED_HOOK,
    initialPrice,
  };
}

export {
  parseAllowedToken,
  parseHumanAmount,
  parseSwapAddress,
  parseWeiAmount,
  SWAP_TOKENS,
};
