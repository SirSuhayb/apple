import {
  CORE_TARGET_FRACTION,
  DEFAULT_DEADLINE_DAYS,
  TOTAL_SUPPLY,
  isLive,
} from "./config";
import { copy } from "./copy";
import {
  type RaceState,
  computeCoreTarget,
  progressToFrame,
} from "./race";

const DEMO_EATERS = [
  {
    address: "0xFARM000000000000000000000000000000000001",
    score: 4200,
    buyVolume: 12,
    sellVolume: 4,
    burned: 80,
  },
  {
    address: "0xBITE000000000000000000000000000000000002",
    score: 3100,
    buyVolume: 20,
    sellVolume: 8,
    burned: 40,
  },
  {
    address: "0xCORE000000000000000000000000000000000003",
    score: 1800,
    buyVolume: 9,
    sellVolume: 2,
    burned: 25,
  },
  {
    address: "0xNIBL000000000000000000000000000000000004",
    score: 900,
    buyVolume: 5,
    sellVolume: 1,
    burned: 10,
  },
  {
    address: "0xJUICE00000000000000000000000000000000005",
    score: 450,
    buyVolume: 3,
    sellVolume: 0,
    burned: 5,
  },
];

function demoProgress(): number {
  // Slow crawl so the apple looks alive in preview mode.
  const started = Date.UTC(2026, 8, 5, 0, 0, 0);
  const elapsed = Math.max(0, Date.now() - started);
  const day = 86_400_000;
  return Math.min(0.42, elapsed / (DEFAULT_DEADLINE_DAYS * day));
}

export function buildDemoRaceState(): RaceState {
  const reserved = TOTAL_SUPPLY / BigInt(5); // illustrative 20% LP floor
  const { burnable, coreTarget } = computeCoreTarget(
    TOTAL_SUPPLY,
    reserved,
    CORE_TARGET_FRACTION,
  );
  const progress = demoProgress();
  const burned =
    (coreTarget * BigInt(Math.floor(progress * 10_000))) / BigInt(10_000);
  const deadline =
    Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const lastEatAt = now - 12 * 60;

  return {
    phase: "preview",
    live: false,
    burned: burned.toString(),
    coreTarget: coreTarget.toString(),
    burnable: burnable.toString(),
    reserved: reserved.toString(),
    totalSupply: TOTAL_SUPPLY.toString(),
    progress,
    appleFrame: progressToFrame(progress),
    deadline,
    secondsLeft: Math.max(0, deadline - now),
    lastEatAt,
    quietRotPreview: false,
    potAapl: "0",
    eaters: DEMO_EATERS,
    tape: [
      {
        id: "1",
        kind: "tap",
        address: DEMO_EATERS[0].address,
        amount: 12,
        score: 600,
        at: lastEatAt,
      },
      {
        id: "2",
        kind: "buy",
        address: DEMO_EATERS[1].address,
        amount: 2.4,
        score: 2.4,
        at: lastEatAt - 40,
      },
      {
        id: "3",
        kind: "sell",
        address: DEMO_EATERS[2].address,
        amount: 1.1,
        score: 1.65,
        at: lastEatAt - 95,
      },
    ],
    message: copy.messages.preview,
  };
}

export function emptyLiveScaffold(): RaceState {
  const base = buildDemoRaceState();
  return {
    ...base,
    live: isLive,
    phase: "racing",
    message: isLive ? copy.messages.kitchenWire : base.message,
  };
}