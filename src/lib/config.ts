import { type Address, isAddress, zeroAddress } from "viem";

function parseAddress(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value) || value === zeroAddress) return undefined;
  return value;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Base mainnet */
export const CHAIN_ID = 8453;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://mainnet.base.org";

/** USDC on Base (6 decimals). */
export const USDC_TOKEN =
  (parseAddress(process.env.NEXT_PUBLIC_USDC_TOKEN) ??
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as Address;

/** WETH on Base. */
export const WETH_TOKEN =
  (parseAddress(process.env.NEXT_PUBLIC_WETH_TOKEN) ??
    "0x4200000000000000000000000000000000000006") as Address;

/**
 * Native ETH sentinel for Uniswap Trading API (not an ERC-20).
 * Must stay zero — do not run through parseAddress (rejects zeroAddress).
 */
export const NATIVE_ETH_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

/**
 * $JUICE token on Base. Override with NEXT_PUBLIC_JUICE_TOKEN.
 * Placeholder until the revnet is deployed and the token address is known.
 */
export const JUICE_TOKEN = (parseAddress(process.env.NEXT_PUBLIC_JUICE_TOKEN) ??
  "0x0000000000000000000000000000000000000000") as Address;

/** @deprecated Alias during migration. */
export const BITE_TOKEN = JUICE_TOKEN;

/** Revnet project ID on Base (Juicebox V6). */
export const REVNET_PROJECT_ID = (() => {
  const raw = process.env.NEXT_PUBLIC_REVNET_PROJECT_ID?.trim();
  if (!raw) return 0n;
  try { return BigInt(raw); } catch { return 0n; }
})();

/** JBMultiTerminal on Base — pay, addToBalanceOf, cashOut. */
export const JB_MULTI_TERMINAL = (parseAddress(process.env.NEXT_PUBLIC_JB_MULTI_TERMINAL) ??
  "0x0000000000000000000000000000000000000000") as Address;

/** NFT container contract on Base — mint seed-tier NFTs. */
export const JUICE_NFT_CONTRACT = (parseAddress(process.env.NEXT_PUBLIC_JUICE_NFT_CONTRACT) ??
  "0x0000000000000000000000000000000000000000") as Address;

/** Ops/marketing wallet for the swap integrator-fee split (optional). */
export const SWAP_OPS_RECIPIENT = parseAddress(
  process.env.NEXT_PUBLIC_SWAP_OPS_RECIPIENT,
);

export const DEXSCREENER_PAIR_ID =
  process.env.NEXT_PUBLIC_DEXSCREENER_PAIR_ID ?? "";

export const DEPLOYER = parseAddress(process.env.NEXT_PUBLIC_DEPLOYER);

/** Home + /leaderboard poll the same live board. */
export const LEADERBOARD_POLL_MS = 15_000;

/** Default race length if kitchen is not live yet */
export const DEFAULT_DEADLINE_DAYS = parseNumber(
  process.env.NEXT_PUBLIC_DEADLINE_DAYS,
  30,
);

/**
 * Core target as a fraction of burnable supply (0.5 = 50%).
 * Burnable = totalSupply - reservedTokens (LP floor).
 */
export const CORE_TARGET_FRACTION = parseNumber(
  process.env.NEXT_PUBLIC_CORE_TARGET_FRACTION,
  0.5,
);

export const TOTAL_SUPPLY = BigInt(1_000_000_000) * BigInt(10) ** BigInt(18);

export const isLive = Boolean(JUICE_TOKEN && JUICE_TOKEN !== "0x0000000000000000000000000000000000000000");

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/**
 * Day-one / launch preview: auto stop-motion playthrough, hide burn CTA.
 * Default true until revnet + token are live.
 */
export const DAY_ONE_PLAYTHROUGH = parseBool(
  process.env.NEXT_PUBLIC_DAY_ONE,
  parseBool(process.env.NEXT_PUBLIC_DEMO_PLAYTHROUGH, !isLive),
);

/** Revnet + token configured — real squeeze path available */
export const KITCHEN_READY = isLive && REVNET_PROJECT_ID > 0n;

/**
 * Narrative act override for QA / preview / mint flip.
 * 0 = Prologue · 1 = Filling the press · 2 = First squeeze · 3 = To the last drop
 * Omit to auto-resolve (Prologue when no token CA; see `lib/phase.ts`).
 */
export const SITE_ACT_OVERRIDE = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_ACT?.trim();
  if (raw === "0" || raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as 0 | 1 | 2 | 3;
  }
  return null;
})();

/** Unix timestamp when Act II (squeeze race) started — drives 72h early-squeezer 2× window */
export const ACT_II_STARTED_AT = (() => {
  const raw = process.env.NEXT_PUBLIC_ACT_II_STARTED_AT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

/** Squeeze progress (0–1) at which meta wager unlocks — default 10% */
export const META_WAGER_THRESHOLD = parseNumber(
  process.env.NEXT_PUBLIC_META_WAGER_THRESHOLD,
  0.1,
);

export const DECAY_PREVIEW_OVERRIDE =
  process.env.NEXT_PUBLIC_DECAY_PREVIEW?.trim() || "";

/**
 * Swap CTA surface for Trade / Buy.
 * - `native` (default): in-site buy $JUICE via Uniswap on Base
 * - `external`: deep-link to Uniswap
 */
export const SWAP_PROVIDER = (() => {
  const raw = process.env.NEXT_PUBLIC_SWAP_PROVIDER?.trim().toLowerCase();
  if (raw === "external") return "external" as const;
  return "native" as const;
})();

export const SWAP_EMBED_ENABLED = (() => {
  const raw = process.env.NEXT_PUBLIC_SWAP_EMBED_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();

/** Interface chain slug for Uniswap on Base. */
export const UNISWAP_CHAIN = "base";

export const SWAP_OPEN_URL =
  process.env.NEXT_PUBLIC_SWAP_OPEN_URL ??
  (JUICE_TOKEN !== "0x0000000000000000000000000000000000000000"
    ? `https://app.uniswap.org/swap?chain=${UNISWAP_CHAIN}&inputCurrency=ETH&outputCurrency=${JUICE_TOKEN}`
    : `https://app.uniswap.org/swap?chain=${UNISWAP_CHAIN}`);

export const SWAP_OPEN_REVERSE_URL =
  process.env.NEXT_PUBLIC_SWAP_OPEN_REVERSE_URL ??
  (JUICE_TOKEN !== "0x0000000000000000000000000000000000000000"
    ? `https://app.uniswap.org/swap?chain=${UNISWAP_CHAIN}&inputCurrency=${JUICE_TOKEN}&outputCurrency=ETH`
    : `https://app.uniswap.org/swap?chain=${UNISWAP_CHAIN}`);

export const SWAP_EMBED_URL =
  process.env.NEXT_PUBLIC_SWAP_EMBED_URL ??
  `https://app.uniswap.org/embed?view=swap&chain=${UNISWAP_CHAIN}&inputCurrency=ETH&outputCurrency=${JUICE_TOKEN}`;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.juiceparty.xyz";

export const SHARE_OG_IMAGE = "/social_media/juiceSqueezed.png";
export const INVITE_OG_IMAGE = "/og_invite_image.png";

/** @deprecated Prefer `copy` from `@/lib/copy` */
export const siteConfig = {
  name: "$JUICE",
  tagline: "Squeeze every drop.",
};

// Legacy aliases for files that still import these
export const AAPL_TOKEN = USDC_TOKEN;
export const APPLE_KITCHEN = JB_MULTI_TERMINAL;
export const PONS_TOKEN_URL = SWAP_OPEN_URL;
export const META_WAGER = parseAddress(process.env.NEXT_PUBLIC_META_WAGER);
export const REFERRAL_ESCROW = (parseAddress(process.env.NEXT_PUBLIC_REFERRAL_ESCROW) ?? "0x0000000000000000000000000000000000000000") as Address;
export const REFERRAL_ESCROW_FROM_BLOCK = 0n;
export const REFERRAL_REWARD_BITE = 250_000;
export const REFERRAL_MIN_SWAP_USD = 25;
export const REFERRAL_MIN_BURN_USD = 5;
export const PONS_FEE_ESCROW = "0x0000000000000000000000000000000000000000" as Address;
export const V4_POOL_ID = DEXSCREENER_PAIR_ID;
export const UNISWAP_POSITION_MANAGER = "0x0000000000000000000000000000000000000000" as Address;
export const UNISWAP_POOL_MANAGER = "0x0000000000000000000000000000000000000000" as Address;
export const V4_POOL_INIT_BLOCK = 0n;
export const BITE_CURVE = undefined;
export const BITE_POOL = undefined;
