/** Draft figures for the local /whitepaper page. Not a published offer. */

export const JUICE_SUPPLY = 1_000_000_000;
export const AAPL_USD = 342.06;
export const BITE_MC_USD = 11_010;
export const WALLET_BITE = 314_159_056;
export const AS_OF = "16 October 2026";

export type SliceId = "players" | "liquidity" | "otc" | "dev";

export const SLICES: {
  id: SliceId;
  label: string;
  pct: number;
  tokens: number;
  hue: string;
  flesh: string;
  line: string;
}[] = [
  {
    id: "players",
    label: "Players",
    pct: 65,
    tokens: 650_000_000,
    hue: "#e53935",
    flesh: "#ff6b63",
    line: "Pro-rata to the $BITE a wallet presses, claimed until the book opens.",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    pct: 20,
    tokens: 200_000_000,
    hue: "#f0c7a0",
    flesh: "#f8e0c8",
    line: "Paired with the AAPL the press raises, locked in a 1% Uniswap pool. Other LPs can join.",
  },
  {
    id: "otc",
    label: "Investment",
    pct: 10,
    tokens: 100_000_000,
    hue: "#7da85a",
    flesh: "#a8c98a",
    line: "Claimed until graduation, then linear over 12 months into the same escrow.",
  },
  {
    id: "dev",
    label: "Dev",
    pct: 5,
    tokens: 50_000_000,
    hue: "#8d6e63",
    flesh: "#b08980",
    line: "None at the open, then linear monthly for 24 months. The dev wallet can also press into the player slice.",
  },
];

export const OPENS = [
  { aapl: 5, label: "Thin press" },
  { aapl: 7, label: "Every wallet, once" },
  { aapl: 40, label: "Soft target" },
] as const;

export const LP_SHARE = 0.2;

export function openFdv(aapl: number, lpShare = LP_SHARE): number {
  return (aapl * AAPL_USD) / lpShare;
}

export function juicePrice(aapl: number, lpShare = LP_SHARE): number {
  return openFdv(aapl, lpShare) / JUICE_SUPPLY;
}

export const CONTAINERS = [
  { name: "Growler", oz: 32, shares: 8, count: 16, seeds: 2560, kind: "growler" },
  { name: "Mason Jar", oz: 16, shares: 4, count: 43, seeds: 1280, kind: "jar" },
  { name: "Bottle", oz: 8, shares: 2, count: 304, seeds: 640, kind: "bottle" },
  { name: "Juice Box", oz: 4, shares: 1, count: 138, seeds: 320, kind: "box" },
] as const;

export type ContainerKind = (typeof CONTAINERS)[number]["kind"];

export const TOTAL_OZ = CONTAINERS.reduce(
  (sum, tier) => sum + tier.oz * tier.count,
  0,
);

export const SEED_WALLETS = 501;
export const TREASURY_PER_BOTTLE = 1;
export const CAMPAIGN_OF_DOLLAR = 0.4;
export const DIVIDEND_OF_DOLLAR = 0.6;
export const BOTTLE_COGS = 1.45;

/** Pressed Juicery juice shelf, checked October 2026. VIP here is a poured container. */
export const REGULAR_PRICE = 6.95;
export const NFT_PRICE = 5.5;

export function companyBeforeLabor(price: number): number {
  return Math.round((price - BOTTLE_COGS - TREASURY_PER_BOTTLE) * 100) / 100;
}

export function oneContainerShare(oz: number): number {
  return oz / TOTAL_OZ;
}

export function tierShare(oz: number, count: number): number {
  return (oz * count) / TOTAL_OZ;
}

/** Dollars one container receives per 1,000 bottles, at the current 60¢ dividend. */
export function dividendPerThousand(oz: number): number {
  return oneContainerShare(oz) * 1000 * DIVIDEND_OF_DOLLAR;
}

/** Year 1 is a real payout: 10,000 bottles a quarter, on the closed ounce list. */
export const YEAR1_BOTTLES_PER_QUARTER = 10_000;
export const YEAR1_BOTTLES = YEAR1_BOTTLES_PER_QUARTER * 4;

/**
 * Pressed does not publish unit sales. Five million is an inference
 * from about 100 cafes and $14.7 million of tracked US grocery sales
 * in 2025.
 */
export const PRESSED_BOTTLES_ESTIMATE = 5_000_000;

/** Red Bull company figure for 2025. Cans, not juice bottles. */
export const RED_BULL_CANS_2025 = 13_969_000_000;

export function dividendPool(bottles: number): number {
  return bottles * DIVIDEND_OF_DOLLAR;
}

/** One container's dollars from a given number of bottles sold. */
export function containerPayout(oz: number, bottles: number): number {
  return dividendPool(bottles) * (oz / TOTAL_OZ);
}
