import { type Address, isAddress, zeroAddress } from "viem";

/**
 * Parse an address value. Accepts the raw env string directly — callers MUST
 * pass `process.env.NEXT_PUBLIC_*` as a static literal so Next.js can inline
 * it into the client bundle.  Dynamic `process.env[key]` access is NOT inlined
 * and silently resolves to `undefined` on the client, which was the root cause
 * of the Act II → Act I hydration flip.
 */
function parseAddress(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value) || value === zeroAddress) return undefined;
  return value;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Robinhood Chain */
export const CHAIN_ID = 4663;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://rpc.mainnet.chain.robinhood.com";

export const AAPL_TOKEN =
  (parseAddress(process.env.NEXT_PUBLIC_AAPL_TOKEN) ??
    "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9") as Address;

/** Live $BITE CA (pons vs AAPL). Override with NEXT_PUBLIC_BITE_TOKEN if needed. */
export const BITE_TOKEN = (parseAddress(process.env.NEXT_PUBLIC_BITE_TOKEN) ??
  "0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9") as Address;
export const BITE_CURVE = parseAddress(process.env.NEXT_PUBLIC_BITE_CURVE);
export const BITE_POOL = parseAddress(process.env.NEXT_PUBLIC_BITE_POOL);
export const APPLE_KITCHEN = parseAddress(process.env.NEXT_PUBLIC_APPLE_KITCHEN);
export const DEPLOYER = parseAddress(process.env.NEXT_PUBLIC_DEPLOYER);

/** Live pons launchpad for $BITE (path is `/launchpad/:ca` — `/token/:ca` 404s). */
export const PONS_TOKEN_URL =
  process.env.NEXT_PUBLIC_PONS_TOKEN_URL ??
  `https://www.ponsfamily.com/launchpad/${BITE_TOKEN}`;

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

export const isLive = Boolean(BITE_TOKEN);

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/**
 * Day-one / launch preview: auto stop-motion playthrough, hide burn CTA.
 * Prefer NEXT_PUBLIC_DAY_ONE; NEXT_PUBLIC_DEMO_PLAYTHROUGH is an alias.
 * Default true until kitchen + token are live.
 */
export const DAY_ONE_PLAYTHROUGH = parseBool(
  process.env.NEXT_PUBLIC_DAY_ONE,
  parseBool(process.env.NEXT_PUBLIC_DEMO_PLAYTHROUGH, !APPLE_KITCHEN || !BITE_TOKEN),
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
export const META_WAGER_THRESHOLD = parseNumber(
  process.env.NEXT_PUBLIC_META_WAGER_THRESHOLD,
  0.1,
);

/**
 * Swap CTA surface for Trade / Buy.
 * - `pons` (default): deep-link to pons launchpad (works today)
 * - `uniswap` (opt-in): SwapModal deep-link / optional iframe after Uniswap allowlists us
 *
 * Robinhood Chain (`chain=robinhood`) is supported on app.uniswap.org, but `/embed`
 * is gated by Uniswap’s `frame-ancestors` allowlist — bite.party is not on it, so the
 * iframe stays blank until they approve. See docs/uniswap-embed-allowlist.md.
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

/** Interface chain slug for Uniswap Custom Linking / embed (not numeric 4663). */
export const UNISWAP_CHAIN = "robinhood";

/**
 * Prefill: AAPL → $BITE on Robinhood Chain (same pair as pons).
 * Override with NEXT_PUBLIC_SWAP_EMBED_URL / NEXT_PUBLIC_SWAP_OPEN_URL if needed.
 */
export const SWAP_EMBED_URL =
  process.env.NEXT_PUBLIC_SWAP_EMBED_URL ??
  `https://app.uniswap.org/embed?view=swap&chain=${UNISWAP_CHAIN}&inputCurrency=${AAPL_TOKEN}&outputCurrency=${BITE_TOKEN}`;

export const SWAP_OPEN_URL =
  process.env.NEXT_PUBLIC_SWAP_OPEN_URL ??
  `https://app.uniswap.org/swap?chain=${UNISWAP_CHAIN}&inputCurrency=${AAPL_TOKEN}&outputCurrency=${BITE_TOKEN}`;

/** @deprecated Prefer `copy` from `@/lib/copy` */
export const siteConfig = {
  name: "$BITE",
  tagline: "Eat it to the core.",
};