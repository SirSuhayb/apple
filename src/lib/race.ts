export type EatKind = "buy" | "sell" | "tap" | "kitchen";

export type Eater = {
  address: string;
  score: number;
  buyVolume: number;
  sellVolume: number;
  burned: number;
  buyCount: number;
  sellCount: number;
  tapCount: number;
  /** Act I: creator/team wallet — shown but cannot win */
  ineligible?: boolean;
  /** Act I: "dev" badge on the board */
  badge?: "dev" | null;
  dev?: boolean;
};

export type RaceEvent = {
  id: string;
  kind: EatKind;
  address: string;
  amount: number;
  score: number;
  at: number;
};

export type RacePhase = "racing" | "core" | "rot" | "preview";

export type SupplyStats = {
  prizePoolAapl: number;
  prizePoolUsd: number | null;
  aaplPriceUsd: number | null;
  eoaHeldBite: number;
  contractHeldBite: number;
  realisticallyBurnable: number;
  totalSupply: number;
  totalBurned: number;
  holderCount: number;
  bitePriceUsd: number | null;
  updatedAt?: string;
};

export type RaceState = {
  phase: RacePhase;
  live: boolean;
  burned: string;
  coreTarget: string;
  burnable: string;
  reserved: string;
  totalSupply: string;
  /** 0..1 progress toward core */
  progress: number;
  /** discrete stop-motion frame 0..9 */
  appleFrame: number;
  deadline: number;
  secondsLeft: number;
  lastEatAt: number;
  quietRotPreview: boolean;
  potAapl: string;
  eaters: Eater[];
  tape: RaceEvent[];
  message: string;
  supplyStats?: SupplyStats | null;
};

export const FRAME_COUNT = 10;

/** Map burn progress (0..1) to stop-motion frame 0..9 */
export function progressToFrame(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 1) return FRAME_COUNT - 1;
  return Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT));
}

/** Buy: 1x quote volume. Sell: 1.5x. Tap: k * bite amount. */
export const TAP_SCORE_K = 50;

export function scoreBuy(quoteVolume: number): number {
  return quoteVolume;
}

export function scoreSell(quoteVolume: number): number {
  return quoteVolume * 1.5;
}

export function scoreTap(biteAmount: number): number {
  return biteAmount * TAP_SCORE_K;
}

/**
 * Core target = fraction of burnable supply.
 * burnable = totalSupply - reservedTokens (LP floor that cannot be burned).
 */
export function computeCoreTarget(
  totalSupply: bigint,
  reservedTokens: bigint,
  fraction = 0.5,
): { burnable: bigint; coreTarget: bigint } {
  const burnable =
    totalSupply > reservedTokens ? totalSupply - reservedTokens : BigInt(0);
  const coreTarget =
    (burnable * BigInt(Math.round(fraction * 10_000))) / BigInt(10_000);
  return { burnable, coreTarget };
}