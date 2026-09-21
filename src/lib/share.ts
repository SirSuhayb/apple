import { SITE_URL } from "./config";
import { isTitleId, type TitleId } from "./profile-titles";

export function sharePageUrl(opts: {
  burn?: string;
  rank?: number | null;
  you?: string | null;
  title?: TitleId | string | null;
  ref?: string | null;
}): string {
  const url = new URL("/share", SITE_URL);
  if (opts.burn) url.searchParams.set("burn", opts.burn);
  if (opts.rank && opts.rank > 0) url.searchParams.set("rank", String(opts.rank));
  if (opts.you) url.searchParams.set("you", opts.you);
  if (opts.title && isTitleId(opts.title)) {
    url.searchParams.set("title", opts.title);
  }
  if (opts.ref) url.searchParams.set("ref", opts.ref);
  return url.toString();
}

export function leaderboardYouUrl(address: string): string {
  const url = new URL("/leaderboard", SITE_URL);
  url.searchParams.set("you", address);
  return url.toString();
}

/** Tweet/copy body: one line of copy plus at most one URL (the share page). */
export function shareBody(text: string, pageUrl?: string): string {
  return pageUrl ? `${text}\n${pageUrl}` : text;
}

export function twitterIntentUrl(text: string, pageUrl?: string): string {
  const u = new URL("https://twitter.com/intent/tweet");
  u.searchParams.set("text", shareBody(text, pageUrl));
  return u.toString();
}
