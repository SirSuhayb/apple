import {
  APPLE_KITCHEN,
  BITE_TOKEN,
  KITCHEN_READY,
  DAY_ONE_PLAYTHROUGH,
} from "./config";
import type { RacePhase } from "./race";

/**
 * Narrative phases from bite-execution.md + pre-mint Prologue.
 * 0 = Prologue (no token CA / pre-launch tease)
 * 1–3 = Finding the apple · First bite · To the core
 */
export type SiteAct = 0 | 1 | 2 | 3;

export type NavBadge = "Soon" | "Preparing" | "Live" | "Racing";

export type PhaseFlags = {
  act: SiteAct;
  badge: NavBadge;
  /** Buy / Trade / PONS CTAs enabled (false in Prologue) */
  tradingOpen: boolean;
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
  /** How-card lock: Tap + Digest locked in Prologue + Act I */
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
  if (raw === "0" || raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as SiteAct;
  }
  return null;
}

function envPrologueForce(): boolean | null {
  const raw = process.env.NEXT_PUBLIC_PROLOGUE?.trim().toLowerCase();
  if (!raw) return null;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
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
 * - Force with NEXT_PUBLIC_SITE_ACT=0|1|2|3 for QA / mint flip.
 * - NEXT_PUBLIC_PROLOGUE=true forces Prologue; =false skips the no-token gate.
 * - Default: Prologue when NEXT_PUBLIC_BITE_TOKEN is unset.
 * - Act I: preparing (token set, no kitchen / day-one).
 * - Act II: kitchen live, race underway.
 * - Act III: auto when ≥5 eaters and burn ≥10% (or resolution).
 */
export function resolveSiteAct(input: {
  progress: number;
  eaterCount: number;
  racePhase: RacePhase;
}): SiteAct {
  const forced = envActForce();
  if (forced !== null) return forced;

  const prologueEnv = envPrologueForce();
  if (prologueEnv === true) return 0;

  // Default: no token CA → Prologue (unless PROLOGUE=false)
  if (!BITE_TOKEN && prologueEnv !== false) return 0;

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
  /** Pass explicit timestamp (epoch seconds) to avoid Date.now() during render
   *  which creates a server/client hydration mismatch. */
  now?: number;
}): PhaseFlags {
  const act = resolveSiteAct(input);
  const metaWagerLive = input.progress >= META_THRESHOLD;
  const started = actIiStartedAt();
  const now = input.now ?? Math.floor(Date.now() / 1000);
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
    act === 0
      ? "Soon"
      : act === 1
        ? "Preparing"
        : act === 2
          ? "Live"
          : "Racing";

  return {
    act,
    badge,
    tradingOpen: act >= 1,
    showProgress: act >= 2,
    showWager: act >= 2,
    showMetaWager: act >= 2,
    metaWagerLive: act >= 3 && metaWagerLive,
    burnsOpen: act >= 2 && !DAY_ONE_PLAYTHROUGH,
    howLocked: act <= 1,
    earlyEaterActive,
    earlyEaterSecondsLeft,
    urgencyBanner,
    countdownUrgent,
  };
}

/** Act I–III labels (Prologue is separate in PhaseBar) */
export const PHASE_LABELS = [
  "Finding the apple",
  "First bite",
  "To the core",
] as const;

export const META_WAGER_THRESHOLD = META_THRESHOLD;
