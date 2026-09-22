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

/** Robinhood Chain USDG (6 decimals). */
export const USDG_TOKEN =
  (parseAddress(process.env.NEXT_PUBLIC_USDG_TOKEN) ??
    "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168") as Address;

/** Robinhood Chain WETH. */
export const WETH_TOKEN =
  (parseAddress(process.env.NEXT_PUBLIC_WETH_TOKEN) ??
    "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73") as Address;

/**
 * Native ETH sentinel for Uniswap Trading API (not an ERC-20).
 * Must stay zero — do not run through parseAddress (rejects zeroAddress).
 */
export const NATIVE_ETH_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

/** Live $BITE CA (pons vs AAPL). Override with NEXT_PUBLIC_BITE_TOKEN if needed. */
export const BITE_TOKEN = (parseAddress(process.env.NEXT_PUBLIC_BITE_TOKEN) ??
  "0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9") as Address;
export const BITE_CURVE = parseAddress(process.env.NEXT_PUBLIC_BITE_CURVE);
export const BITE_POOL = parseAddress(process.env.NEXT_PUBLIC_BITE_POOL);
export const APPLE_KITCHEN = (parseAddress(process.env.NEXT_PUBLIC_APPLE_KITCHEN) ??
  "0x56fEb999D829761C787581413605bf88F5Cd81e0") as Address;

/** Ops/marketing wallet for the swap integrator-fee split (optional). */
export const SWAP_OPS_RECIPIENT = parseAddress(
  process.env.NEXT_PUBLIC_SWAP_OPS_RECIPIENT,
);

/** Pons V2 fee escrow (claimable creator fees; display-only, never auto-claimed). */
export const PONS_FEE_ESCROW = (parseAddress(
  process.env.NEXT_PUBLIC_PONS_FEE_ESCROW,
) ?? "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e") as Address;

export const DEXSCREENER_PAIR_ID =
  process.env.NEXT_PUBLIC_DEXSCREENER_PAIR_ID ??
  "0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c";

/** Uniswap v4 pool id (same bytes as Dexscreener pair). */
export const V4_POOL_ID = DEXSCREENER_PAIR_ID;

/** Uniswap v4 PositionManager on Robinhood — LP create txs must target this. */
export const UNISWAP_POSITION_MANAGER =
  (parseAddress(process.env.NEXT_PUBLIC_UNISWAP_POSITION_MANAGER) ??
    "0x58daec3116aae6D93017bAAea7749052E8a04fA7") as Address;

/** Uniswap v4 PoolManager on Robinhood — used to list this pool's LP NFTs. */
export const UNISWAP_POOL_MANAGER =
  (parseAddress(process.env.NEXT_PUBLIC_UNISWAP_POOL_MANAGER) ??
    "0x8366a39CC670B4001A1121B8F6A443A643e40951") as Address;

/** First Initialize of the BITE/AAPL v4 pool — log scans start here. */
export const V4_POOL_INIT_BLOCK = 63_818_427n;

/** Home + /leaderboard poll the same live board (eaters + supply breakdown). */
export const LEADERBOARD_POLL_MS = 15_000;
export const META_WAGER = parseAddress(process.env.NEXT_PUBLIC_META_WAGER);
export const DEPLOYER = parseAddress(process.env.NEXT_PUBLIC_DEPLOYER);

/**
 * ReferralEscrow UUPS **proxy** (fund this, not the implementation).
 * Override with NEXT_PUBLIC_REFERRAL_ESCROW if rotated.
 */
export const REFERRAL_ESCROW = (parseAddress(
  process.env.NEXT_PUBLIC_REFERRAL_ESCROW,
) ?? "0xc127327419D78C8546230463F8b421Bb66212660") as Address;

/** First proxy deploy block on Robinhood 4663 — log scans start here. */
export const REFERRAL_ESCROW_FROM_BLOCK = 68_894_675n;

/** Display fallback when chain read is loading (live reward is 250_000 BITE). */
export const REFERRAL_REWARD_BITE = 250_000;

/** Minimum swap value (USD) for a referral to qualify. Matches bot REFERRAL_MIN_SWAP_USD. */
export const REFERRAL_MIN_SWAP_USD = 25;

/** Minimum burn value (USD) for a referral to qualify. Matches bot REFERRAL_MIN_BURN_USD. */
export const REFERRAL_MIN_BURN_USD = 5;

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
 * Localhost QA only — force visual decay 0–100 (or `fresh` / `quiet`).
 * Query `?decay=` wins. Never use this for kitchen revealRot / wager resolve.
 */
export const DECAY_PREVIEW_OVERRIDE =
  process.env.NEXT_PUBLIC_DECAY_PREVIEW?.trim() || "";

/**
 * Swap CTA surface for Trade / Buy.
 * - `native` (default): in-site buy $BITE (AAPL/USDG/WETH/ETH) + sell to AAPL via Uniswap Trading API proxy
 * - `pons`: deep-link to pons launchpad
 *
 * Robinhood Chain (`chain=robinhood`) is supported on app.uniswap.org, but `/embed`
 * is gated by Uniswap’s `frame-ancestors` allowlist — bite.party is not on it, so the
 * iframe stays blank until they approve. See docs/uniswap-embed-allowlist.md.
 */
export const SWAP_PROVIDER = (() => {
  const raw = process.env.NEXT_PUBLIC_SWAP_PROVIDER?.trim().toLowerCase();
  if (raw === "pons") return "pons" as const;
  return "native" as const;
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

export const SWAP_OPEN_REVERSE_URL =
  process.env.NEXT_PUBLIC_SWAP_OPEN_REVERSE_URL ??
  `https://app.uniswap.org/swap?chain=${UNISWAP_CHAIN}&inputCurrency=${BITE_TOKEN}&outputCurrency=${AAPL_TOKEN}`;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bite.party";

/** Static apple-themed card until per-player OG images exist. */
export const SHARE_OG_IMAGE = "/social_media/biteTaken.png";

/** Invite / referral unfurl card (iMessage, X, Telegram). */
export const INVITE_OG_IMAGE = "/og_invite_image.png";

/** @deprecated Prefer `copy` from `@/lib/copy` */
export const siteConfig = {
  name: "$BITE",
  tagline: "Eat it to the core.",
};