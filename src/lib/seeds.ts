import type { Eater } from "./race";

/**
 * Seeds — Phase 2 preview mechanic.
 *
 * Every wallet that participated in $BITE earns seeds based on their
 * activity score. Distribution uses sqrt scaling so smaller players
 * still earn meaningful counts while top players are rewarded without
 * running away with the entire supply.
 *
 * 80 seeds = 1 oz of juice.
 * Containers: Juice Box (4 oz / 320 seeds), Bottle (8 oz / 640),
 * Mason Jar (16 oz / 1280), Growler (32 oz / 2560).
 */

const SEEDS_PER_OZ = 80;

export const CONTAINER_TIERS = [
  { name: "Growler", oz: 32, seeds: 32 * SEEDS_PER_OZ, emoji: "🫙" },
  { name: "Mason Jar", oz: 16, seeds: 16 * SEEDS_PER_OZ, emoji: "🏺" },
  { name: "Bottle", oz: 8, seeds: 8 * SEEDS_PER_OZ, emoji: "🍶" },
  { name: "Juice Box", oz: 4, seeds: 4 * SEEDS_PER_OZ, emoji: "🧃" },
] as const;

export type ContainerTier = (typeof CONTAINER_TIERS)[number];

/**
 * Target total seed supply across all wallets.
 * Tunable — this is the dial we adjust before the press opens.
 * At ~1,400 wallets (projected end state), 500K seeds with sqrt scaling
 * produces ~2,500 Genesis containers.
 */
const TARGET_TOTAL_SEEDS = 500_000;

/**
 * Compute seed count for a single wallet given the full eater list.
 * Returns 0 for wallets with no score. Minimum 1 seed for any participant.
 */
export function computeSeedCount(
  walletScore: number,
  allEaters: Eater[],
): number {
  if (walletScore <= 0) return 0;

  const sqrtScores = allEaters
    .filter((e) => e.score > 0)
    .map((e) => Math.sqrt(e.score));

  const totalSqrt = sqrtScores.reduce((sum, s) => sum + s, 0);
  if (totalSqrt <= 0) return 0;

  const scale = TARGET_TOTAL_SEEDS / totalSqrt;
  return Math.max(1, Math.floor(Math.sqrt(walletScore) * scale));
}

/**
 * Batch compute seeds for all eaters. Returns a map of address → seed count.
 */
export function computeAllSeeds(
  eaters: Eater[],
): Map<string, number> {
  const eligible = eaters.filter((e) => e.score > 0);
  const totalSqrt = eligible.reduce(
    (sum, e) => sum + Math.sqrt(e.score),
    0,
  );
  if (totalSqrt <= 0) return new Map();

  const scale = TARGET_TOTAL_SEEDS / totalSqrt;
  const result = new Map<string, number>();
  for (const e of eligible) {
    const seeds = Math.max(1, Math.floor(Math.sqrt(e.score) * scale));
    result.set(e.address.toLowerCase(), seeds);
  }
  return result;
}

/** Ounces this seed count can fill. */
export function seedsToOz(seeds: number): number {
  return Math.floor(seeds / SEEDS_PER_OZ);
}

/** Leftover seeds after filling full ounces (pulp). */
export function seedPulp(seeds: number): number {
  return seeds % SEEDS_PER_OZ;
}

/** Best single container a wallet can fill at this seed count. */
export function bestContainer(seeds: number): ContainerTier | null {
  for (const tier of CONTAINER_TIERS) {
    if (seeds >= tier.seeds) return tier;
  }
  return null;
}

/** Seeds needed to reach the next container tier. Null if already at Growler. */
export function seedsToNextTier(seeds: number): {
  tier: ContainerTier;
  needed: number;
} | null {
  for (let i = CONTAINER_TIERS.length - 1; i >= 0; i--) {
    const tier = CONTAINER_TIERS[i];
    if (seeds < tier.seeds) {
      return { tier, needed: tier.seeds - seeds };
    }
  }
  return null;
}
