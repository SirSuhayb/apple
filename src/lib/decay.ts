/**
 * Visual decay is looks on the skin — not kitchen revealRot.
 * 0 = ripe red. 100 = brown / quiet tape. Never resolves a wager.
 */

export type DecayInputs = {
  nowSec: number;
  /** Unix seconds of last kitchen AppleEaten or meaningful v4 swap. */
  lastEatAt: number | null;
  volumeH24: number | null;
  volumeH6: number | null;
  peakVolumeH24: number | null;
  peakVolumeH6: number | null;
  mcapUsd: number | null;
  peakMcapUsd: number | null;
};

export type DecayBreakdown = {
  idle: number;
  volume: number;
  mcap: number;
  hoursSince: number | null;
  volumeH24: number | null;
  volumeH6: number | null;
  peakVolumeH24: number | null;
  mcapUsd: number | null;
  peakMcapUsd: number | null;
};

export type DecayScore = {
  /** 0–100 visual rot. Not kitchen revealRot. */
  decay: number;
  breakdown: DecayBreakdown;
  /** True when tape has been quiet > 48h — preview only, not legal rot. */
  quietRotPreview: boolean;
};

export const DECAY_IDLE_HOURS_FULL = 48;
export const DECAY_IDLE_GRACE_HOURS = 1;
export const DECAY_WEIGHT_IDLE = 0.5;
export const DECAY_WEIGHT_VOLUME = 0.35;
export const DECAY_WEIGHT_MCAP = 0.15;
/** 6h volume ≥ this share of the 6h peak counts as a burst (pulls toward red). */
export const DECAY_BURST_RATIO = 0.35;
/** Kitchen bite or swap in this window yanks decay down hard. */
export const DECAY_FRESH_HOURS = 2;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function ratioToDryness(current: number | null, peak: number | null): number | null {
  if (current == null || peak == null || peak <= 0) return null;
  return clamp(1 - current / peak, 0, 1);
}

/**
 * Score visual decay 0–100 from idle tape, volume vs peak, optional mcap.
 * A fresh kitchen bite or 6h volume burst pulls the apple back toward red.
 */
export function scoreDecay(input: DecayInputs): DecayScore {
  const hoursSince =
    input.lastEatAt != null && input.lastEatAt > 0
      ? Math.max(0, (input.nowSec - input.lastEatAt) / 3600)
      : null;

  let idle = 0.45;
  if (hoursSince != null) {
    const afterGrace = Math.max(0, hoursSince - DECAY_IDLE_GRACE_HOURS);
    idle = clamp(afterGrace / (DECAY_IDLE_HOURS_FULL - DECAY_IDLE_GRACE_HOURS), 0, 1);
  }

  const dry24 = ratioToDryness(input.volumeH24, input.peakVolumeH24);
  const dry6 = ratioToDryness(input.volumeH6, input.peakVolumeH6);
  const volumeParts = [dry24, dry6].filter((n): n is number => n != null);
  const volume =
    volumeParts.length > 0
      ? volumeParts.reduce((a, b) => a + b, 0) / volumeParts.length
      : 0.4;

  const mcapDry = ratioToDryness(input.mcapUsd, input.peakMcapUsd);
  const mcap = mcapDry ?? volume;

  let decay01 =
    DECAY_WEIGHT_IDLE * idle +
    DECAY_WEIGHT_VOLUME * volume +
    DECAY_WEIGHT_MCAP * mcap;

  const vol6 = input.volumeH6 ?? 0;
  const peak6 = input.peakVolumeH6 ?? 0;
  const burst = peak6 > 0 && vol6 / peak6 >= DECAY_BURST_RATIO;
  if (burst) {
    decay01 *= 0.45;
  }

  if (hoursSince != null && hoursSince < DECAY_FRESH_HOURS) {
    const freshness = 1 - hoursSince / DECAY_FRESH_HOURS;
    decay01 *= 1 - 0.75 * freshness;
  }

  const decay = Math.round(clamp(decay01, 0, 1) * 100);
  return {
    decay,
    quietRotPreview: hoursSince != null && hoursSince > 48,
    breakdown: {
      idle: Math.round(idle * 100),
      volume: Math.round(volume * 100),
      mcap: Math.round(mcap * 100),
      hoursSince,
      volumeH24: input.volumeH24,
      volumeH6: input.volumeH6,
      peakVolumeH24: input.peakVolumeH24,
      mcapUsd: input.mcapUsd,
      peakMcapUsd: input.peakMcapUsd,
    },
  };
}

/** Query / env QA only on localhost. Production always uses live decay. */
export function isLocalDecayHost(hostname?: string): boolean {
  const host =
    hostname ??
    (typeof window === "undefined" ? "" : window.location.hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Query / env QA: `?decay=80` or `fresh` / `quiet`. Null = use live score. */
export function parseDecayOverride(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (!v || v === "live" || v === "off") return null;
  if (v === "fresh" || v === "healthy") return 8;
  if (v === "quiet" || v === "brown") return 82;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(clamp(n, 0, 100));
}

/** Decay at or above this reads ROTTING on the hero banner. Below is FRESH. */
export const DECAY_ROTTING_THRESHOLD = 50;

/**
 * Stated weekly rotting floors for the explainer carousel.
 * Not wired into `scoreDecay` — ladder math is still WIP.
 */
export const DECAY_FLOOR_THIS_WEEK_USD = 50_000;
export const DECAY_FLOOR_NEXT_WEEK_USD = 150_000;
export const DECAY_FLOOR_AIM_USD = 1_000_000;

/** Skin looks rotting — not a kitchen CORE/ROT verdict. */
export function appleLooksRotting(decay: number): boolean {
  return clamp(decay, 0, 100) >= DECAY_ROTTING_THRESHOLD;
}

/**
 * CSS filter for 2D bitmaps (cutouts / stills). Do not put this on the
 * WebGL canvas — filters flatten transparent pixels into a square plate.
 */
export function decayCssFilter(decay: number, legalRot: boolean): string {
  if (legalRot) {
    return "saturate(0.45) sepia(0.55) hue-rotate(-18deg) brightness(0.78)";
  }
  const d = clamp(decay, 0, 100) / 100;
  const sat = 1.18 - d * 0.85;
  const sepia = d * 0.42;
  const hue = -14 * d;
  const bright = 1 - d * 0.16;
  return `saturate(${sat.toFixed(3)}) sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg) brightness(${bright.toFixed(3)})`;
}
