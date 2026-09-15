"use client";

import Link from "next/link";
import type { Eater } from "@/lib/race";
import { copy } from "@/lib/copy";
import { Leaderboard } from "@/components/Leaderboard";
import { SiteFooter } from "@/components/SiteFooter";

export function LeaderboardPage({ eaters }: { eaters: Eater[] }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fbfbfd] text-[#1d1d1f]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#d2d2d7] bg-[rgba(251,251,253,0.82)] backdrop-blur-[20px] backdrop-saturate-150">
        <div className="page-gutter mx-auto flex h-12 max-w-[980px] items-center justify-between">
          <Link href="/" className="text-[17px] font-semibold">
            {copy.brand}
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium text-[#2997ff]"
          >
            {copy.leaderboard.back}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="page-gutter bg-[#fbfbfd] pt-[48px] pb-6 text-center">
        <p className="mb-2 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {copy.leaderboard.title}
        </p>
        <h1 className="text-[clamp(32px,8vw,56px)] font-bold leading-[1.05] tracking-[-0.03em]">
          {copy.leaderboard.headline}
        </h1>
        <p className="mx-auto mt-2 max-w-[440px] text-[17px] leading-relaxed text-[#86868b]">
          {copy.leaderboard.subtitle}
        </p>
      </section>

      {/* Board */}
      <section className="page-gutter flex-1 pb-16">
        <div className="mx-auto max-w-[580px]">
          <Leaderboard eaters={eaters} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
