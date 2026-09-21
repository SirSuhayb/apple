import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { SHARE_OG_IMAGE, SITE_URL } from "@/lib/config";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { fetchRaceState } from "@/lib/fetch-race";
import { sortLeaderboard, weiToTokens } from "@/lib/leaderboard-rank";
import { isTitleId, titleArtSrc, type TitleId } from "@/lib/profile-titles";
import { SharePlayerCard } from "@/components/SharePlayerCard";
import { isAddress } from "viem";

type Search = {
  burn?: string;
  rank?: string;
  you?: string;
  title?: string;
  ref?: string;
};

function parseRank(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseBurn(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseTitle(raw: string | undefined): TitleId | undefined {
  return raw && isTitleId(raw) ? raw : undefined;
}

function shareCopy(sp: Search): string {
  const rank = parseRank(sp.rank);
  const burn = sp.burn?.trim();
  if (burn) return copy.share.burn(burn, rank);
  if (rank) return copy.share.rank(rank);
  return copy.share.fallback;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const description = shareCopy(sp);
  const rank = parseRank(sp.rank);
  const burn = sp.burn?.trim();
  const title = burn
    ? copy.share.ogBurnTitle(burn, rank)
    : rank
      ? copy.share.ogRankTitle(rank)
      : copy.meta.title;
  const url = new URL("/share", SITE_URL);
  for (const [k, v] of Object.entries(sp)) {
    if (v) url.searchParams.set(k, v);
  }
  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: url.toString(),
      siteName: copy.brand,
      title,
      description,
      images: [{ url: SHARE_OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_OG_IMAGE],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const you = sp.you?.startsWith("0x") && isAddress(sp.you) ? sp.you : undefined;
  const ref =
    sp.ref?.startsWith("0x") && isAddress(sp.ref) ? sp.ref : you;
  const rank = parseRank(sp.rank);
  const burn = parseBurn(sp.burn);
  const titleId = parseTitle(sp.title);
  const titleFallbackName = titleId
    ? copy.profile.titles[titleId].name
    : undefined;
  const boardHref = you
    ? `/leaderboard?you=${encodeURIComponent(you)}`
    : "/leaderboard";
  const homeHref = ref ? `/?ref=${encodeURIComponent(ref)}` : "/";
  const [state, act1] = await Promise.all([
    fetchRaceState(),
    fetchAct1Leaderboard(),
  ]);
  const eaters =
    act1.eaters.length > 0 ? act1.eaters : sortLeaderboard(state.eaters);

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-[#fbfbfd] px-6 py-16 text-center">
      <img
        src={SHARE_OG_IMAGE}
        alt="$BITE — Eat it to the core."
        className="h-auto w-full max-w-[420px] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
      />
      {titleId && !titleArtSrc(titleId) && titleFallbackName ? (
        <p className="mt-8 text-[13px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
          {titleFallbackName}
        </p>
      ) : null}
      <SharePlayerCard
        you={you}
        queryRank={rank}
        queryBurn={burn}
        titleId={titleId}
        initialEaters={eaters}
        initialCoreTarget={weiToTokens(state.coreTarget)}
        initialSupplyStats={act1.supplyStats ?? undefined}
      />
      <p className="mt-8 max-w-md text-[19px] leading-snug tracking-[-0.02em] text-[#1d1d1f]">
        {copy.share.pitch}
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
        <Link
          href={boardHref}
          className="rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white hover:bg-black"
        >
          {copy.share.takeSpot}
        </Link>
        <Link
          href={ref ? `${homeHref}#burn` : "/#burn"}
          className="rounded-full border border-[#d2d2d7] bg-white px-6 py-3.5 text-[15px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          {copy.tap.cta}
        </Link>
      </div>
      <Link
        href={homeHref}
        className="mt-8 text-[15px] font-medium text-[#2997ff] hover:text-[#0077ed]"
      >
        {copy.share.home}
      </Link>
    </main>
  );
}
