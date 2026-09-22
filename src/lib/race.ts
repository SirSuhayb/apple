import type { DecayBreakdown } from "./decay";
import type { DecayFloors } from "./decay-week";

export type { DecayBreakdown, DecayFloors };

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
  /** $BITE staked on MetaWager entry (gross, including 10% fee). */
  wagered?: number;
  wagerCount?: number;
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
  /** Alias of eoaHeldBite — wallet-held circulating, excluding contracts. */
  circulatingSupply: number;
  contractHeldBite: number;
  realisticallyBurnable: number;
  totalSupply: number;
  totalBurned: number;
  holderCount: number;
  /** Same as holderCount — current EOA wallets with balance > 0. */
  holdersEoa?: number;
  /** Unique addresses that ever received BITE (FOMO-style overcount). */
  allTimeRecipients?: number;
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
  /** Visual decay 0–100. Not kitchen revealRot. */
  decay: number;
  decayBreakdown?: DecayBreakdown;
  /** Live weekly ATH floors for carousel / chart (USD mcap). */
  decayFloors?: DecayFloors;
  lastEatSource?: "kitchen" | "v4" | "inferred" | null;
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

/** Buy: 0.01 / $BITE (moderate). Burn: 1 / $BITE (bigger bite). Sell 1.5× buy. Early-eater 2× on burns. Wager: 0.001 / $BITE staked on entry — a side bet, not a bite. */
export const BUY_SCORE_K = 0.01;
export const SELL_SCORE_MULT = 1.5;
export const SELL_SCORE_K = BUY_SCORE_K * SELL_SCORE_MULT;
export const TAP_SCORE_K = 1;
export const WAGER_SCORE_K = 0.001;
export const EARLY_EATER_BURN_MULT = 2;
export const ACCUM_HOLD_SCALE = 0.01;
export const SCORE_SCALE = "v2_burn_lead_wager";
export const SCORE_SCALE_BURN_LEAD = "v2_burn_lead";
export const SCORE_SCALE_CENTI = "v2_centi";

/** Original stored points (buy 1×, sell 1.5×, burn 50×). */
export const LEGACY_BUY_K = 1;
export const LEGACY_SELL_K = 1.5;
export const LEGACY_BURN_K = 50;
/** Intermediate v2_centi burn rate before burn-lead. */
export const CENTI_BURN_K = 0.1;

export function scoreBuy(quoteVolume: number): number {
  return quoteVolume * BUY_SCORE_K;
}

export function scoreSell(quoteVolume: number): number {
  return quoteVolume * SELL_SCORE_K;
}

export function scoreTap(biteAmount: number, earlyEater = false): number {
  const base = biteAmount * TAP_SCORE_K;
  return earlyEater ? base * EARLY_EATER_BURN_MULT : base;
}

/** Side bet: 0.001 pts per $BITE staked on MetaWager entry (gross). */
export function scoreWager(biteStaked: number): number {
  return biteStaked * WAGER_SCORE_K;
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