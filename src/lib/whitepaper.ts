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
    line: "Pro-rata to the $BITE a wallet presses. A claim until the book opens.",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    pct: 20,
    tokens: 200_000_000,
    hue: "#f0c7a0",
    flesh: "#f8e0c8",
    line: "Paired with the AAPL the press catches. Locked. 1% Uniswap fee. Other people can LP beside it.",
  },
  {
    id: "otc",
    label: "Investment",
    pct: 10,
    tokens: 100_000_000,
    hue: "#7da85a",
    flesh: "#a8c98a",
    line: "A claim until graduation, then linear over 12 months. The check goes into the same escrow.",
  },
  {
    id: "dev",
    label: "Dev",
    pct: 5,
    tokens: 50_000_000,
    hue: "#8d6e63",
    flesh: "#b08980",
    line: "Nothing at the open. Linear monthly for 24 months. A dev wallet can still press into the player slice.",
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
