/**
 * Native buy 2× scoring.
 * Run: node --experimental-strip-types --test src/lib/score-buy.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUY_SCORE_K, NATIVE_BUY_MULT, scoreBuy } from "./race.ts";

describe("scoreBuy", () => {
  it("scores DEX buys at BUY_SCORE_K", () => {
    assert.equal(scoreBuy(1_000), 1_000 * BUY_SCORE_K);
    assert.equal(scoreBuy(1_000, { native: false }), 1_000 * BUY_SCORE_K);
  });

  it("scores native buys at NATIVE_BUY_MULT × BUY_SCORE_K", () => {
    assert.equal(
      scoreBuy(1_000, { native: true }),
      1_000 * BUY_SCORE_K * NATIVE_BUY_MULT,
    );
    assert.equal(NATIVE_BUY_MULT, 2);
  });
});
