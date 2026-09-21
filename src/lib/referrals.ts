import { isAddress, type Address } from "viem";
import { SITE_URL } from "./config";
import { sameWallet } from "./leaderboard-rank";
import { isTitleId, type TitleId } from "./profile-titles";

export { isTitleId };
export type { TitleId };

function titlePickKey(address: string): string {
  return `bite:share-title:${address.toLowerCase()}`;
}

/** Persist which unlocked title an address uses on share posts. */
export function loadShareTitlePick(address: string): TitleId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(titlePickKey(address));
    return isTitleId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveShareTitlePick(
  address: string,
  titleId: TitleId | null,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = titlePickKey(address);
    if (!titleId) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, titleId);
  } catch {
    // private mode / quota
  }
}

const REF_PENDING_KEY = "bite:ref-pending";
const REF_BOUND_PREFIX = "bite:ref-bound:";

export function referralHomeUrl(
  address: string,
  origin?: string | null,
): string {
  const base = (origin ?? SITE_URL).replace(/\/$/, "");
  const url = new URL("/", `${base}/`);
  url.searchParams.set("ref", address);
  return url.toString();
}

/** Shareable invite page with OG unfurl — preserves `?ref=` for attribution. */
export function referralInviteUrl(
  address: string,
  origin?: string | null,
): string {
  const base = (origin ?? SITE_URL).replace(/\/$/, "");
  const url = new URL("/invite", `${base}/`);
  url.searchParams.set("ref", address);
  return url.toString();
}

/** Capture `?ref=` into pending localStorage until a wallet connects. */
export function capturePendingReferral(
  raw: string | null | undefined,
): string | null {
  if (typeof window === "undefined") return null;
  if (!raw || !isAddress(raw)) return null;
  try {
    window.localStorage.setItem(REF_PENDING_KEY, raw);
    return raw;
  } catch {
    return null;
  }
}

export function readPendingReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REF_PENDING_KEY);
    return raw && isAddress(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REF_PENDING_KEY);
  } catch {
    // ignore
  }
}

function boundKey(address: string): string {
  return `${REF_BOUND_PREFIX}${address.toLowerCase()}`;
}

/** Who referred this connected wallet (local attribution / last known bind). */
export function readBoundReferral(address: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(boundKey(address));
    return raw && isAddress(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function markBoundReferral(address: string, referrer: string): void {
  if (typeof window === "undefined") return;
  if (!isAddress(address) || !isAddress(referrer)) return;
  try {
    window.localStorage.setItem(boundKey(address), referrer);
  } catch {
    // ignore
  }
}

/**
 * When a wallet connects: keep pending ref if present and not self.
 * Local bind is attribution UX; on-chain `bind` is submitted by ReferralCapture.
 * Returns the intended referrer (existing or pending), or null.
 */
export function bindReferralOnConnect(connected: string): string | null {
  if (typeof window === "undefined") return null;
  if (!isAddress(connected)) return null;

  const existing = readBoundReferral(connected);
  if (existing) {
    const pending = readPendingReferral();
    if (
      pending &&
      (sameWallet(pending, connected) || sameWallet(pending, existing))
    ) {
      clearPendingReferral();
    }
    return existing;
  }

  const pending = readPendingReferral();
  if (!pending) return null;
  if (sameWallet(pending, connected)) {
    clearPendingReferral();
    return null;
  }

  // Keep pending for on-chain bind; also stash locally as intent.
  markBoundReferral(connected, pending);
  return pending;
}

export function isZeroAddress(value: string | null | undefined): boolean {
  if (!value || !isAddress(value)) return true;
  return value.toLowerCase() === "0x0000000000000000000000000000000000000000";
}

export function asAddress(value: string | null | undefined): Address | null {
  if (!value || !isAddress(value)) return null;
  return value;
}
