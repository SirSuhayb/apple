/**
 * Weekly ATH → next-week floor for visual decay (not kitchen revealRot).
 *
 * Week boundary: Monday 00:00:00.000 UTC (ISO-8601 week). A week runs Mon–Sun.
 * On the first observation after that instant, the completed week's ATH becomes
 * `currentWeekFloorUsd` for the new week.
 *
 * Seed: if there is no prior week ATH, this week's floor starts at 50_000 USD.
 */

export const DECAY_FLOOR_SEED_USD = 50_000;

/** Known launch-week ATH (~151k) — warms next-week preview before durable store catches up. */
export const DECAY_WEEK_ATH_SEED_USD = 151_000;

export type WeeklyFloorState = {
  /** ISO week id, e.g. `2026-W39` (Monday-start UTC). */
  weekId: string;
  /** Highest mcap (USD) seen during `weekId`. Becomes next week's floor on roll. */
  weekAthMcapUsd: number;
  /** Floor for the current week (= previous week's ATH, or seed). */
  currentWeekFloorUsd: number;
};

/** Monday 00:00 UTC of the ISO week that contains `ms`. */
export function utcWeekStartMs(ms: number): number {
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() - (dayNum - 1));
  return date.getTime();
}

/**
 * ISO week id `YYYY-Www` for the Monday-start UTC week containing `ms`.
 * Week 1 is the week with the year's first Thursday (ISO-8601).
 */
export function utcWeekId(ms: number): string {
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

export function seedWeeklyFloorState(nowMs: number, mcapUsd?: number | null): WeeklyFloorState {
  const mcap = mcapUsd != null && mcapUsd > 0 ? mcapUsd : 0;
  return {
    weekId: utcWeekId(nowMs),
    weekAthMcapUsd: Math.max(mcap, DECAY_WEEK_ATH_SEED_USD),
    currentWeekFloorUsd: DECAY_FLOOR_SEED_USD,
  };
}

/**
 * Advance / refresh weekly floor state.
 * - Same `weekId`: raise `weekAthMcapUsd` with current mcap.
 * - New `weekId`: prior `weekAthMcapUsd` becomes `currentWeekFloorUsd`; ATH resets to current mcap.
 */
export function rollWeeklyFloors(
  prev: WeeklyFloorState | null | undefined,
  nowMs: number,
  mcapUsd: number | null | undefined,
): WeeklyFloorState {
  const weekId = utcWeekId(nowMs);
  const mcap = mcapUsd != null && Number.isFinite(mcapUsd) && mcapUsd > 0 ? mcapUsd : 0;

  if (!prev || !prev.weekId) {
    return seedWeeklyFloorState(nowMs, mcap || null);
  }

  const floor =
    prev.currentWeekFloorUsd > 0 ? prev.currentWeekFloorUsd : DECAY_FLOOR_SEED_USD;

  if (prev.weekId === weekId) {
    return {
      weekId,
      weekAthMcapUsd: Math.max(prev.weekAthMcapUsd || 0, mcap),
      currentWeekFloorUsd: floor,
    };
  }

  // Week rolled (crossed Monday 00:00 UTC): last week's ATH is this week's floor.
  const rolledFloor =
    prev.weekAthMcapUsd > 0 ? prev.weekAthMcapUsd : DECAY_FLOOR_SEED_USD;
  return {
    weekId,
    weekAthMcapUsd: mcap,
    currentWeekFloorUsd: rolledFloor,
  };
}

/** Running ATH this week — preview of next week's floor. */
export function nextWeekFloorUsd(state: WeeklyFloorState): number {
  return Math.max(state.weekAthMcapUsd, 0);
}

/** Compact USD for carousel copy / chart labels (`50k`, `151k`, `1.2M`). */
export function formatFloorUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 || Number.isInteger(m) ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k >= 100 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(Math.round(n));
}

export type DecayFloors = {
  weekId: string;
  thisWeekUsd: number;
  nextWeekUsd: number;
  weekAthMcapUsd: number;
  /** Compact labels for UI (`50k`, `151k`). */
  thisWeekLabel: string;
  nextWeekLabel: string;
};

export function floorsFromWeekly(weekly: WeeklyFloorState): DecayFloors {
  const next = nextWeekFloorUsd(weekly);
  return {
    weekId: weekly.weekId,
    thisWeekUsd: weekly.currentWeekFloorUsd,
    nextWeekUsd: next,
    weekAthMcapUsd: weekly.weekAthMcapUsd,
    thisWeekLabel: formatFloorUsd(weekly.currentWeekFloorUsd),
    nextWeekLabel: formatFloorUsd(next),
  };
}
