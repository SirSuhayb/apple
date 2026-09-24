import {
  ACCUM_HOLD_SCALE,
  CENTI_BURN_K,
  LEGACY_BURN_K,
  LEGACY_BUY_K,
  LEGACY_SELL_K,
  SCORE_SCALE,
  SCORE_SCALE_BURN_LEAD,
  SCORE_SCALE_CENTI,
  SELL_SCORE_K,
  BUY_SCORE_K,
  TAP_SCORE_K,
  WAGER_SCORE_K,
  type Eater,
} from "./race";

export function isLeaderboardDev(e: Eater): boolean {
  return Boolean(e.dev) || e.badge === "dev";
}

export function isLeaderboardIneligible(e: Eater): boolean {
  return Boolean(e.ineligible) || isLeaderboardDev(e);
}

export function totalTrades(e: Eater): number {
  return e.buyCount + e.sellCount + e.tapCount;
}

/** Buys + sells only — burns are shown separately on each row. */
export function tradeCount(e: Eater): number {
  return e.buyCount + e.sellCount;
}

export function tradeVolume(e: Eater): number {
  return (e.buyVolume || 0) + (e.sellVolume || 0);
}

/** Kitchen `bite()` / dead / zero burns attributed to this wallet. */
export function burnCount(e: Eater): number {
  return e.tapCount;
}

export type LeaderboardSortKey = "score" | "trades" | "burned";

/** Official points rank, or the home board’s burn-share order. */
export type LeaderboardRankKey = "score" | "burned";

/**
 * Board-tab order. Points = combined score; trades = buy+sell count
 * (volume tiebreak); burns = $BITE burned (count tiebreak).
 */
export function compareLeaderboardSort(
  a: Eater,
  b: Eater,
  key: LeaderboardSortKey,
): number {
  if (key === "trades") {
    return (
      tradeCount(b) - tradeCount(a) ||
      tradeVolume(b) - tradeVolume(a) ||
      b.score - a.score ||
      a.address.localeCompare(b.address)
    );
  }
  if (key === "burned") {
    return (
      b.burned - a.burned ||
      burnCount(b) - burnCount(a) ||
      b.score - a.score ||
      a.address.localeCompare(b.address)
    );
  }
  return (
    b.score - a.score ||
    tradeCount(b) - tradeCount(a) ||
    b.burned - a.burned ||
    a.address.localeCompare(b.address)
  );
}

export function sortLeaderboardBy(
  eaters: Eater[],
  key: LeaderboardSortKey,
): Eater[] {
  return [...eaters].sort((a, b) => compareLeaderboardSort(a, b, key));
}

/**
 * Convert kitchen wei strings (coreTarget, burned) to token units.
 * Truncates fractional wei — leaderboard percents only need whole $BITE.
 */
export function weiToTokens(wei: string | null | undefined): number {
  if (!wei) return 0;
  try {
    return Number(BigInt(wei) / 10n ** 18n);
  } catch {
    return 0;
  }
}

/**
 * Denominator for "% of apple eaten".
 * Same as on-site race progress: kitchen burned / coreTarget.
 * Falls back to total supply (the supply-card burned %) if core is unknown.
 */
export function resolveAppleTotal(
  coreTarget?: number | null,
  totalSupply?: number | null,
): number {
  if (coreTarget && coreTarget > 0) return coreTarget;
  if (totalSupply && totalSupply > 0) return totalSupply;
  return 0;
}

/** Person's share of the apple: their $BITE burned / core target. */
export function appleEatenPct(biteBurned: number, appleTotal: number): number {
  if (!(appleTotal > 0) || !Number.isFinite(biteBurned) || biteBurned <= 0) {
    return 0;
  }
  return (biteBurned / appleTotal) * 100;
}

export function formatAppleEatenPct(
  biteBurned: number,
  appleTotal: number,
): string {
  const pct = appleEatenPct(biteBurned, appleTotal);
  if (pct <= 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

/** Compact $BITE / gap amounts — 6k, 12.4M. */
export function formatCompactAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const abs = Math.abs(n);
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1_000_000_000) return `${trim(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(abs / 1_000)}k`;
  if (abs >= 10) {
    return abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return abs.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Extra $BITE to burn at TAP_SCORE_K (1, or 2 in the early-eater window)
 * to pass the current rank-10 score.
 * `max(0, (score10 − score) / TAP_SCORE_K)`. Null when the board has no 10th.
 */
export function biteToSecureTop10(
  score: number,
  eaters: Eater[],
): number | null {
  const { eligible } = partitionLeaderboard(eaters);
  const tenth = eligible[HOME_BOARD_LIMIT - 1];
  if (!tenth) return null;
  const pts = Number.isFinite(score) ? score : 0;
  return Math.max(0, (tenth.score - pts) / TAP_SCORE_K);
}

/**
 * Extra $BITE to burn to pass the home board’s 10th place.
 * Home placement is burn share, so the gap is tokens, not points.
 * Null when fewer than 10 eligible wallets are on the board.
 */
export function biteToSecureTop10ByBurn(
  burned: number,
  eaters: Eater[],
): number | null {
  const tenth = rankedEligible(eaters, "burned")[HOME_BOARD_LIMIT - 1];
  if (!tenth) return null;
  const mine = Number.isFinite(burned) ? burned : 0;
  return Math.max(0, tenth.burned - mine);
}

/** Default board order: eligible first, then score, then trades. */
export function compareLeaderboardRows(a: Eater, b: Eater): number {
  const ai = isLeaderboardIneligible(a) ? 1 : 0;
  const bi = isLeaderboardIneligible(b) ? 1 : 0;
  if (ai !== bi) return ai - bi;
  return (
    b.score - a.score ||
    totalTrades(b) - totalTrades(a) ||
    a.address.localeCompare(b.address)
  );
}

export function sortLeaderboard(eaters: Eater[]): Eater[] {
  return [...eaters].sort(compareLeaderboardRows);
}

export function partitionLeaderboard(eaters: Eater[]): {
  eligible: Eater[];
  ineligible: Eater[];
} {
  const sorted = sortLeaderboard(eaters);
  return {
    eligible: sorted.filter((e) => !isLeaderboardIneligible(e) && e.score > 0),
    ineligible: sorted.filter((e) => isLeaderboardIneligible(e)),
  };
}

/** Home mini-board shows this many wallets, ordered by burn share. */
export const HOME_BOARD_LIMIT = 10;

/**
 * Eligible wallets in the order used for a rank.
 * Score is the full board: burners and non-burners by points.
 * Burned is the home board: only wallets that have eaten, by share of the apple.
 */
export function rankedEligible(
  eaters: Eater[],
  by: LeaderboardRankKey = "score",
): Eater[] {
  const { eligible } = partitionLeaderboard(eaters);
  if (by === "burned") {
    return sortLeaderboardBy(
      eligible.filter((e) => e.burned > 0),
      "burned",
    );
  }
  return eligible;
}

export function topLeaderboard(eaters: Eater[], limit = HOME_BOARD_LIMIT): Eater[] {
  return rankedEligible(eaters, "burned").slice(0, limit);
}

export function sameWallet(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export type ConnectedRank =
  | { kind: "ranked"; rank: number; total: number; eater: Eater }
  | { kind: "ineligible"; eater: Eater }
  | { kind: "unranked"; eater: Eater }
  | { kind: "absent" };

/**
 * Rank after adding `extraScore` (e.g. a just-confirmed kitchen burn at TAP_SCORE_K).
 * Skips ineligible wallets. Null if the projected score is still 0.
 */
export function rankAfterExtraScore(
  eaters: Eater[],
  address: string | undefined | null,
  extraScore: number,
): number | null {
  if (!address) return null;
  const { eligible } = partitionLeaderboard(eaters);
  const existing = eligible.find((e) => sameWallet(e.address, address));
  const newScore = (existing?.score ?? 0) + (Number.isFinite(extraScore) ? extraScore : 0);
  if (newScore <= 0) return null;
  let ahead = 0;
  for (const e of eligible) {
    if (sameWallet(e.address, address)) continue;
    if (e.score > newScore) ahead += 1;
  }
  return ahead + 1;
}

/**
 * Kitchen burns used to skip the $50 scoring floor. Credit any burned $BITE
 * that isn't already in `burnPoints` so the board matches TAP_SCORE_K × burned.
 */
export function creditUnscoredBurns(score: number, burned: number, burnPoints: number): number {
  const expected = Math.max(0, burned) * TAP_SCORE_K;
  const already = Math.max(0, burnPoints);
  return score + Math.max(0, expected - already);
}

/**
 * Remap stored rows onto buy 0.01 / sell 0.015 / burn 1.0 / wager 0.001.
 * Act I accum/hold remainder is also scaled by ACCUM_HOLD_SCALE so buy books
 * cannot outrank kitchen burns. Wagers on v2_burn_lead rows are added here
 * so baked JSON picks them up before the bot persists v2_burn_lead_wager.
 */
export function migrateLegacyScore(opts: {
  score: number;
  buyPoints: number;
  sellPoints: number;
  burnPoints: number;
  burned: number;
  wagered?: number;
  wagerPoints?: number;
  scale?: string | null;
}): number {
  const score = Number.isFinite(opts.score) ? opts.score : 0;
  const buy = Math.max(0, opts.buyPoints || 0);
  const sell = Math.max(0, opts.sellPoints || 0);
  const burnPts = Math.max(0, opts.burnPoints || 0);
  const burned = Math.max(0, opts.burned || 0);
  const wagered = Math.max(0, opts.wagered || 0);
  const wagerPts = Math.max(0, opts.wagerPoints || 0);
  const wagerAdd = wagerPts > 0 ? wagerPts : wagered * WAGER_SCORE_K;
  if (opts.scale === SCORE_SCALE) {
    return creditUnscoredBurns(score, burned, burnPts);
  }
  if (opts.scale === SCORE_SCALE_BURN_LEAD) {
    return creditUnscoredBurns(score, burned, burnPts) + wagerAdd;
  }
  if (opts.scale === SCORE_SCALE_CENTI) {
    const remainder = score - buy - sell - Math.max(burnPts, burned * CENTI_BURN_K);
    return Math.max(
      0,
      remainder * ACCUM_HOLD_SCALE + buy + sell + burned * TAP_SCORE_K + wagerAdd,
    );
  }
  const remainder = score - buy - sell - Math.max(burnPts, burned * LEGACY_BURN_K);
  return Math.max(
    0,
    remainder * ACCUM_HOLD_SCALE +
      buy * (BUY_SCORE_K / LEGACY_BUY_K) +
      sell * (SELL_SCORE_K / LEGACY_SELL_K) +
      burned * TAP_SCORE_K +
      wagerAdd,
  );
}

/**
 * Rank for a connected wallet.
 * Default is the official points order. `"burned"` matches the home board.
 * Rank is 1-based among eligible (score > 0) rows.
 */
export function lookupConnectedRank(
  eaters: Eater[],
  address: string | undefined | null,
  by: LeaderboardRankKey = "score",
): ConnectedRank | null {
  if (!address) return null;
  const { ineligible } = partitionLeaderboard(eaters);
  const eligible = rankedEligible(eaters, by);
  const rankedIdx = eligible.findIndex((e) => sameWallet(e.address, address));
  if (rankedIdx >= 0) {
    return {
      kind: "ranked",
      rank: rankedIdx + 1,
      total: eligible.length,
      eater: eligible[rankedIdx],
    };
  }
  const ineligibleHit = ineligible.find((e) => sameWallet(e.address, address));
  if (ineligibleHit) return { kind: "ineligible", eater: ineligibleHit };
  const raw = eaters.find((e) => sameWallet(e.address, address));
  if (raw) return { kind: "unranked", eater: raw };
  return { kind: "absent" };
}

function normalizeAddrQuery(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "").replace(/[.…\s]/g, "");
}

/** Partial address match — full 0x, last-4, or the shortened 0x1234…abcd form. */
export function matchesAddressQuery(address: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const full = address.toLowerCase();
  if (full.includes(q)) return true;
  const needle = normalizeAddrQuery(q);
  if (!needle) return true;
  return normalizeAddrQuery(full).includes(needle);
}
