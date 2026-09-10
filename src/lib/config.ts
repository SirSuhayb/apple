import { type Address, isAddress, zeroAddress } from "viem";

function envAddress(key: string): Address | undefined {
  const value = process.env[key];
  if (!value || !isAddress(value) || value === zeroAddress) return undefined;
  return value;
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Robinhood Chain */
export const CHAIN_ID = 4663;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://rpc.mainnet.chain.robinhood.com";

export const AAPL_TOKEN =
  (envAddress("NEXT_PUBLIC_AAPL_TOKEN") ??
    "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9") as Address;

export const BITE_TOKEN = envAddress("NEXT_PUBLIC_BITE_TOKEN");
export const BITE_CURVE = envAddress("NEXT_PUBLIC_BITE_CURVE");
export const BITE_POOL = envAddress("NEXT_PUBLIC_BITE_POOL");
export const APPLE_KITCHEN = envAddress("NEXT_PUBLIC_APPLE_KITCHEN");
export const DEPLOYER = envAddress("NEXT_PUBLIC_DEPLOYER");

export const PONS_TOKEN_URL =
  process.env.NEXT_PUBLIC_PONS_TOKEN_URL ??
  (BITE_TOKEN
    ? `https://www.ponsfamily.com/token/${BITE_TOKEN}`
    : "https://www.ponsfamily.com/launchpad");

/** Default race length if kitchen is not live yet */
export const DEFAULT_DEADLINE_DAYS = envNumber(
  "NEXT_PUBLIC_DEADLINE_DAYS",
  30,
);

/**
 * Core target as a fraction of burnable supply (0.5 = 50%).
 * Burnable = totalSupply - reservedTokens (LP floor).
 */
export const CORE_TARGET_FRACTION = envNumber(
  "NEXT_PUBLIC_CORE_TARGET_FRACTION",
  0.5,
);

export const TOTAL_SUPPLY = BigInt(1_000_000_000) * BigInt(10) ** BigInt(18);

export const isLive = Boolean(BITE_TOKEN);

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/**
 * Day-one / launch preview: auto stop-motion playthrough, hide burn CTA.
 * Prefer NEXT_PUBLIC_DAY_ONE; NEXT_PUBLIC_DEMO_PLAYTHROUGH is an alias.
 * Default true until kitchen + token are live.
 */
export const DAY_ONE_PLAYTHROUGH = envBool(
  "NEXT_PUBLIC_DAY_ONE",
  envBool("NEXT_PUBLIC_DEMO_PLAYTHROUGH", !APPLE_KITCHEN || !BITE_TOKEN),
);

/** Kitchen + token configured — real approve+bite path available */
export const KITCHEN_READY = Boolean(APPLE_KITCHEN && BITE_TOKEN);

/**
 * Narrative act override for QA / preview / mint flip.
 * 0 = Prologue · 1 = Finding the apple · 2 = First bite · 3 = To the core
 * Omit to auto-resolve (Prologue when no token CA; see `lib/phase.ts`).
 */
export const SITE_ACT_OVERRIDE = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_ACT?.trim();
  if (raw === "0" || raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as 0 | 1 | 2 | 3;
  }
  return null;
})();

/** Unix timestamp when Act II (burn race) started — drives 72h early-eater 2× window */
export const ACT_II_STARTED_AT = (() => {
  const raw = process.env.NEXT_PUBLIC_ACT_II_STARTED_AT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

/** Burn progress (0–1) at which meta wager unlocks — default 10% */
export const META_WAGER_THRESHOLD = envNumber(
  "NEXT_PUBLIC_META_WAGER_THRESHOLD",
  0.1,
);

/**
 * Swap CTA surface for Trade / Buy.
 * - `pons` (default, day 1): deep-link to pons token/launchpad only
 * - `uniswap` (opt-in): Uniswap modal deep-link / optional iframe for QA later
 */
export const SWAP_PROVIDER = (() => {
  const raw = process.env.NEXT_PUBLIC_SWAP_PROVIDER?.trim().toLowerCase();
  if (raw === "uniswap") return "uniswap" as const;
  return "pons" as const;
})();

/**
 * Show Uniswap `/embed` iframe. Default off — Uniswap CSP `frame-ancestors` blocks
 * framing until your origin is allowlisted (see docs/uniswap-embed-allowlist.md).
 * Set `NEXT_PUBLIC_SWAP_EMBED_ENABLED=true` only after allowlisting.
 */
export const SWAP_EMBED_ENABLED = (() => {
  const raw = process.env.NEXT_PUBLIC_SWAP_EMBED_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();

/** Mainnet USDC — Uniswap widget demo pair until BITE address exists */
export const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

/** Swap-only embed; same prefill params as Custom Linking / SWAP_OPEN_URL */
export const SWAP_EMBED_URL =
  process.env.NEXT_PUBLIC_SWAP_EMBED_URL ??
  `https://app.uniswap.org/embed?view=swap&chain=ethereum&inputCurrency=ETH&outputCurrency=${USDC_MAINNET}`;

export const SWAP_OPEN_URL =
  process.env.NEXT_PUBLIC_SWAP_OPEN_URL ??
  `https://app.uniswap.org/swap?chain=ethereum&inputCurrency=ETH&outputCurrency=${USDC_MAINNET}`;

/** @deprecated Prefer `copy` from `@/lib/copy` */
export const siteConfig = {
  name: "$BITE",
  tagline: "Eat it to the core.",
};