/**
 * Week-boundary + floor-pressure checks for visual decay.
 * Run: npm run test:decay
 *
 * Week rolls Monday 00:00 UTC (ISO-8601). Sunday 23:59 UTC is still the prior week.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appleLooksRotting,
  DECAY_ROTTING_THRESHOLD,
  scoreDecay,
} from "./decay.ts";
import {
  formatFloorUsd,
  nextWeekFloorUsd,
  rollWeeklyFloors,
  utcWeekId,
  utcWeekStartMs,
  DECAY_FLOOR_SEED_USD,
} from "./decay-week.ts";

describe("utc week boundary (Monday 00:00 UTC)", () => {
  it("Sunday 23:59 UTC stays in prior ISO week vs Monday 00:00", () => {
    // 2026-09-20 is Sunday; 2026-09-21 is Monday.
    const sun = Date.UTC(2026, 8, 20, 23, 59, 59);
    const mon = Date.UTC(2026, 8, 21, 0, 0, 0);
    assert.notEqual(utcWeekId(sun), utcWeekId(mon));
    assert.equal(utcWeekStartMs(mon), Date.UTC(2026, 8, 21, 0, 0, 0));
    assert.equal(utcWeekStartMs(sun), Date.UTC(2026, 8, 14, 0, 0, 0));
  });

  it("rolls prior week ATH into the next week's floor", () => {
    const sun = Date.UTC(2026, 8, 20, 12, 0, 0);
    const mon = Date.UTC(2026, 8, 21, 0, 0, 1);
    const during = rollWeeklyFloors(
      {
        weekId: utcWeekId(sun),
        weekAthMcapUsd: 151_000,
        currentWeekFloorUsd: DECAY_FLOOR_SEED_USD,
      },
      sun,
      40_000,
    );
    assert.equal(during.currentWeekFloorUsd, DECAY_FLOOR_SEED_USD);
    assert.equal(during.weekAthMcapUsd, 151_000);

    const rolled = rollWeeklyFloors(during, mon, 18_000);
    assert.equal(rolled.weekId, utcWeekId(mon));
    assert.equal(rolled.currentWeekFloorUsd, 151_000);
    assert.equal(rolled.weekAthMcapUsd, 18_000);
    assert.equal(nextWeekFloorUsd(rolled), 18_000);
  });
});

describe("scoreDecay floor pressure", () => {
  it("shows rotting under floor even after a fresh swap", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const scored = scoreDecay({
      nowSec,
      lastEatAt: nowSec - 5 * 60, // 5 minutes ago — within DECAY_FRESH_HOURS
      volumeH24: 80_000,
      volumeH6: 40_000,
      peakVolumeH24: 235_125,
      peakVolumeH6: 235_125,
      mcapUsd: 18_000,
      peakMcapUsd: 151_000,
      currentWeekFloorUsd: 50_000,
    });
    assert.equal(scored.breakdown.underFloor, true);
    assert.ok(scored.decay >= DECAY_ROTTING_THRESHOLD);
    assert.equal(appleLooksRotting(scored.decay), true);
  });

  it("can stay fresh above the floor after a recent swap", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const scored = scoreDecay({
      nowSec,
      lastEatAt: nowSec - 5 * 60,
      volumeH24: 80_000,
      volumeH6: 90_000, // burst vs peak
      peakVolumeH24: 235_125,
      peakVolumeH6: 100_000,
      mcapUsd: 80_000,
      peakMcapUsd: 151_000,
      currentWeekFloorUsd: 50_000,
    });
    assert.equal(scored.breakdown.underFloor, false);
    assert.ok(scored.decay < DECAY_ROTTING_THRESHOLD);
  });
});

describe("formatFloorUsd", () => {
  it("formats k / M labels", () => {
    assert.equal(formatFloorUsd(50_000), "50k");
    assert.equal(formatFloorUsd(151_000), "151k");
    assert.equal(formatFloorUsd(1_000_000), "1M");
  });
});
