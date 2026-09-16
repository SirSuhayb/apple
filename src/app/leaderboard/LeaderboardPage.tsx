"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Eater, SupplyStats } from "@/lib/race";
import { copy } from "@/lib/copy";
import { Leaderboard } from "@/components/Leaderboard";
import { SiteFooter } from "@/components/SiteFooter";

const POLL_INTERVAL_MS = 15_000;

function useLeaderboardPolling(
  initialEaters: Eater[],
  initialStats: SupplyStats | undefined,
) {
  const [eaters, setEaters] = useState(initialEaters);
  const [supplyStats, setSupplyStats] = useState(initialStats);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      if (!mountedRef.current) return;
      if (Array.isArray(data.eaters)) setEaters(data.eaters);
      if (data.supplyStats) setSupplyStats(data.supplyStats);
      if (data.updatedAt) setUpdatedAt(data.updatedAt);
    } catch {
      // silent — next poll will retry
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const kickoff = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [refresh]);

  return { eaters, supplyStats, updatedAt };
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 10) return n.toFixed(0);
  return n.toFixed(2);
}

function LeaderboardSupplyBar({ stats }: { stats: SupplyStats }) {
  const burnPct =
    stats.totalSupply > 0 ? (stats.totalBurned / stats.totalSupply) * 100 : 0;
  const prizeLabel = stats.prizePoolAapl > 0
    ? `${fmtCompact(stats.prizePoolAapl)} AAPL`
    : "—";
  const prizeUsd =
    stats.prizePoolUsd != null && stats.prizePoolUsd > 0
      ? `$${stats.prizePoolUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : null;

  return (
    <div className="grid grid-cols-3 gap-2.5 mb-6">
      <div className="rounded-[14px] border border-[#e53935]/30 bg-[#e53935]/5 px-3 py-3 text-center">
        <div className="text-[10px] font-semibold tracking-[1px] text-[#86868b] uppercase">
          Prize Pool
        </div>
        <div className="mt-0.5 text-[15px] font-bold text-[#e53935]">
          {prizeLabel}
        </div>
        {prizeUsd && (
          <div className="text-[10px] text-[#86868b]">{prizeUsd}</div>
        )}
      </div>
      <div className="rounded-[14px] border border-[#d2d2d7] bg-white px-3 py-3 text-center">
        <div className="text-[10px] font-semibold tracking-[1px] text-[#86868b] uppercase">
          Holders
        </div>
        <div className="mt-0.5 text-[15px] font-bold text-[#1d1d1f]">
          {stats.holderCount.toLocaleString()}
        </div>
        <div className="text-[10px] text-[#86868b]">
          {fmtCompact(stats.eoaHeldBite)} held
        </div>
      </div>
      <div className="rounded-[14px] border border-[#d2d2d7] bg-white px-3 py-3 text-center">
        <div className="text-[10px] font-semibold tracking-[1px] text-[#86868b] uppercase">
          Burned
        </div>
        <div className="mt-0.5 text-[15px] font-bold text-[#1d1d1f]">
          {burnPct.toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#86868b]">
          {fmtCompact(stats.totalBurned)}
        </div>
      </div>
    </div>
  );
}

export function LeaderboardPage({
  eaters: initialEaters,
  mode = "kitchen",
  supplyStats: initialStats,
}: {
  eaters: Eater[];
  mode?: "act1" | "kitchen";
  supplyStats?: SupplyStats;
}) {
  const isAct1 = mode === "act1";
  const { eaters, supplyStats, updatedAt } = useLeaderboardPolling(
    initialEaters,
    initialStats,
  );

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
          {isAct1
            ? copy.leaderboard.headlineAct1
            : copy.leaderboard.headline}
        </h1>
        <p className="mx-auto mt-2 max-w-[440px] text-[17px] leading-relaxed text-[#86868b]">
          {isAct1
            ? copy.leaderboard.subtitleAct1
            : copy.leaderboard.subtitle}
        </p>
        {updatedAt && (
          <p className="mt-1 text-[11px] text-[#86868b]">
            Updated {new Date(updatedAt).toLocaleTimeString()}
          </p>
        )}
      </section>

      {/* Board */}
      <section className="page-gutter flex-1 pb-16">
        <div className="mx-auto max-w-[580px]">
          {supplyStats && supplyStats.totalSupply > 0 && (
            <LeaderboardSupplyBar stats={supplyStats} />
          )}
          <Leaderboard eaters={eaters} mode={mode} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
