import {
  APPLE_KITCHEN,
  BITE_TOKEN,
  KITCHEN_READY,
  DAY_ONE_PLAYTHROUGH,
} from "./config";
import type { RacePhase } from "./race";

/** Three narrative acts from bite-execution.md */
export type SiteAct = 1 | 2 | 3;

export type NavBadge = "Preparing" | "Live" | "Racing";

export type PhaseFlags = {
  act: SiteAct;
  badge: NavBadge;
  /** Show countdown + burn progress */
  showProgress: boolean;
  /** Show the wager narrative section */
  showWager: boolean;
  /** Show meta wager block (empty or live) */
  showMetaWager: boolean;
  /** Meta wager is past 10% threshold */
  metaWagerLive: boolean;
  /** Tap / burn CTAs enabled */
  burnsOpen: boolean;
  /** How-card lock: Tap + Digest locked in Act I */
  howLocked: boolean;
  /** Early-eater 2× banner still active */
  earlyEaterActive: boolean;
  /** Seconds remaining on 72h early-eater window (0 if expired/N/A) */
  earlyEaterSecondsLeft: number;
  /** Urgency under 7 days in Act III */
  urgencyBanner: boolean;
  /** Countdown turns red */
  countdownUrgent: boolean;
};

const META_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_META_WAGER_THRESHOLD ?? "0.1",
);

const EARLY_EATER_HOURS = 72;

function envActForce(): SiteAct | null {
  const raw = process.env.NEXT_PUBLIC_SITE_ACT?.trim();
  if (raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as SiteAct;
  }
  return null;
}

function actIiStartedAt(): number | null {
  const raw = process.env.NEXT_PUBLIC_ACT_II_STARTED_AT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve narrative act.
 * - Force with NEXT_PUBLIC_SITE_ACT=1|2|3 for QA.
 * - Act I: preparing (no kitchen / day-one / token pending).
 * - Act II: kitchen live, race underway.
 * - Act III: auto when ≥5 eaters and burn ≥10% (or resolution).
 */
export function resolveSiteAct(input: {
  progress: number;
  eaterCount: number;
  racePhase: RacePhase;
}): SiteAct {
  const forced = envActForce();
  if (forced) return forced;

  if (input.racePhase === "core" || input.racePhase === "rot") return 3;

  // Act III auto-trigger from execution doc
  if (
    KITCHEN_READY &&
    input.eaterCount >= 5 &&
    input.progress >= META_THRESHOLD
  ) {
    return 3;
  }

  if (KITCHEN_READY) return 2;

  // Day-one / preview / token without kitchen → Act I
  if (DAY_ONE_PLAYTHROUGH || !BITE_TOKEN || !APPLE_KITCHEN) return 1;

  return 1;
}

export function resolvePhaseFlags(input: {
  progress: number;
  eaterCount: number;
  racePhase: RacePhase;
  secondsLeft: number;
}): PhaseFlags {
  const act = resolveSiteAct(input);
  const metaWagerLive = input.progress >= META_THRESHOLD;
  const started = actIiStartedAt();
  const now = Math.floor(Date.now() / 1000);
  const earlyWindow = EARLY_EATER_HOURS * 3600;
  let earlyEaterSecondsLeft = 0;
  let earlyEaterActive = false;
  if (act === 2 && started) {
    earlyEaterSecondsLeft = Math.max(0, started + earlyWindow - now);
    earlyEaterActive = earlyEaterSecondsLeft > 0;
  } else if (act === 2 && !started) {
    // No start timestamp yet — show bonus banner until timestamp is set
    earlyEaterActive = true;
    earlyEaterSecondsLeft = earlyWindow;
  }

  const daysLeft = input.secondsLeft / 86_400;
  const urgencyBanner = act === 3 && daysLeft < 7 && daysLeft > 0;
  const countdownUrgent = act >= 2 && daysLeft < 3;

  const badge: NavBadge =
    act === 1 ? "Preparing" : act === 2 ? "Live" : "Racing";

  return {
    act,
    badge,
    showProgress: act >= 2,
    showWager: act >= 2,
    showMetaWager: act >= 2,
    metaWagerLive: act >= 3 && metaWagerLive,
    burnsOpen: act >= 2 && !DAY_ONE_PLAYTHROUGH,
    howLocked: act === 1,
    earlyEaterActive,
    earlyEaterSecondsLeft,
    urgencyBanner,
    countdownUrgent,
  };
}

export const PHASE_LABELS = [
  "Finding the apple",
  "First bite",
  "To the core",
] as const;

export const META_WAGER_THRESHOLD = META_THRESHOLD;
