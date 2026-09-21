import type { Eater } from "./race";

export const HOLD_THRESHOLDS = [1_000_000, 10_000_000, 25_000_000] as const;
export const BURN_THRESHOLDS = [1_000_000, 10_000_000, 25_000_000] as const;

export type TitleId =
  | "first_burn"
  | "first_buy"
  | "hold_1m"
  | "hold_10m"
  | "hold_25m"
  | "burn_1m"
  | "burn_10m"
  | "burn_25m"
  | "referrals";

export const TITLE_IDS: readonly TitleId[] = [
  "first_burn",
  "first_buy",
  "hold_1m",
  "hold_10m",
  "hold_25m",
  "burn_1m",
  "burn_10m",
  "burn_25m",
  "referrals",
] as const;

export function isTitleId(value: string | null | undefined): value is TitleId {
  if (!value) return false;
  return (TITLE_IDS as readonly string[]).includes(value);
}

export type TitleStatus = "unlocked" | "locked" | "unavailable" | "coming_soon";

export type ProfileTitle = {
  id: TitleId;
  status: TitleStatus;
  /** Optional threshold in $BITE for progress copy */
  threshold?: number;
  /** Current value used for unlock (burned / held) when known */
  progress?: number | null;
};

const HOLD_IDS = ["hold_1m", "hold_10m", "hold_25m"] as const;
const BURN_IDS = ["burn_1m", "burn_10m", "burn_25m"] as const;

/**
 * Titles from existing eater + optional live hold balance + referral payouts.
 *
 * Hold balance:
 * - `number` — known wallet balance
 * - `undefined` — own profile, still loading (show locked)
 * - `null` — public profile / no read (unavailable)
 *
 * Referral count (successful on-chain payouts as referrer):
 * - `number` — known
 * - `undefined` — own profile, still loading (show locked)
 * - `null` — public / unavailable
 */
export function resolveProfileTitles(opts: {
  eater?: Eater | null;
  holdBalance?: number | null;
  referralPayouts?: number | null;
}): ProfileTitle[] {
  const e = opts.eater;
  const burned = e?.burned ?? 0;
  const tapCount = e?.tapCount ?? 0;
  const buyCount = e?.buyCount ?? 0;
  const hold = opts.holdBalance;
  const referralPayouts = opts.referralPayouts;

  const titles: ProfileTitle[] = [
    {
      id: "first_burn",
      status: burned > 0 || tapCount > 0 ? "unlocked" : "locked",
      progress: burned,
    },
    {
      id: "first_buy",
      status: buyCount > 0 ? "unlocked" : "locked",
      progress: buyCount,
    },
  ];

  for (let i = 0; i < HOLD_THRESHOLDS.length; i++) {
    const threshold = HOLD_THRESHOLDS[i];
    const id = HOLD_IDS[i];
    if (hold === null) {
      titles.push({
        id,
        status: "unavailable",
        threshold,
        progress: null,
      });
    } else if (hold === undefined) {
      titles.push({
        id,
        status: "locked",
        threshold,
        progress: null,
      });
    } else {
      titles.push({
        id,
        status: hold >= threshold ? "unlocked" : "locked",
        threshold,
        progress: hold,
      });
    }
  }

  for (let i = 0; i < BURN_THRESHOLDS.length; i++) {
    const threshold = BURN_THRESHOLDS[i];
    const id = BURN_IDS[i];
    titles.push({
      id,
      status: burned >= threshold ? "unlocked" : "locked",
      threshold,
      progress: burned,
    });
  }

  if (referralPayouts === null) {
    titles.push({
      id: "referrals",
      status: "unavailable",
      progress: null,
    });
  } else if (referralPayouts === undefined) {
    titles.push({
      id: "referrals",
      status: "locked",
      progress: null,
    });
  } else {
    titles.push({
      id: "referrals",
      status: referralPayouts >= 1 ? "unlocked" : "locked",
      progress: referralPayouts,
    });
  }

  return titles;
}
