import type { Metadata } from "next";
import Link from "next/link";
import { isAddress } from "viem";
import { INVITE_OG_IMAGE, SITE_URL } from "@/lib/config";
import { copy } from "@/lib/copy";

type Search = {
  ref?: string;
};

function inviteUrl(ref?: string): string {
  const url = new URL("/invite", SITE_URL);
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const ref =
    sp.ref?.startsWith("0x") && isAddress(sp.ref) ? sp.ref : undefined;
  const title = copy.invite.title;
  const description = copy.invite.description;
  const url = inviteUrl(ref);

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url,
      siteName: copy.brand,
      title,
      description,
      images: [{ url: INVITE_OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [INVITE_OG_IMAGE],
    },
  };
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const ref =
    sp.ref?.startsWith("0x") && isAddress(sp.ref) ? sp.ref : undefined;
  const homeHref = ref ? `/?ref=${encodeURIComponent(ref)}` : "/";
  const biteHref = ref ? `${homeHref}#burn` : "/#burn";

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-[#fbfbfd] px-6 py-16 text-center">
      <p className="text-[13px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
        {copy.invite.eyebrow}
      </p>
      <h1 className="mt-3 max-w-lg text-[40px] font-bold leading-[1.05] tracking-[-0.035em] text-[#1d1d1f] sm:text-[48px]">
        {copy.invite.title}
      </h1>
      <p className="mt-4 max-w-md text-[19px] leading-snug tracking-[-0.02em] text-[#6e6e73]">
        {copy.invite.description}
      </p>
      <img
        src={INVITE_OG_IMAGE}
        alt={copy.invite.description}
        className="mt-10 h-auto w-full max-w-[420px] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
      />
      <div className="mt-10 flex w-full max-w-sm flex-col gap-2">
        <Link
          href={biteHref}
          className="rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white hover:bg-black"
        >
          {copy.invite.cta}
        </Link>
        <Link
          href={homeHref}
          className="rounded-full border border-[#d2d2d7] bg-white px-6 py-3.5 text-[15px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          {copy.invite.home}
        </Link>
      </div>
    </main>
  );
}
