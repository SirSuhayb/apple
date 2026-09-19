"use client";

import type { Eater, SupplyStats } from "@/lib/race";
import { copy } from "@/lib/copy";
import {
  appleEatenPct,
  formatAppleEatenPct,
  formatCompactAmount,
  lookupConnectedRank,
  resolveAppleTotal,
} from "@/lib/leaderboard-rank";
import { useLeaderboardLive } from "@/lib/use-leaderboard";
import { EaterIdentity, EaterStats, fmtScore } from "./LeaderboardRow";

export function SharePlayerCard({
  you,
  queryRank,
  queryBurn,
  initialEaters = [],
  initialCoreTarget = 0,
  initialSupplyStats,
}: {
  you?: string;
  queryRank?: number;
  queryBurn?: number;
  initialEaters?: Eater[];
  initialCoreTarget?: number;
  initialSupplyStats?: SupplyStats;
}) {
  if (!you && queryRank == null && queryBurn == null) return null;
  return (
    <LiveShareCard
      you={you}
      queryRank={queryRank}
      queryBurn={queryBurn}
      initialEaters={initialEaters}
      initialCoreTarget={initialCoreTarget}
      initialSupplyStats={initialSupplyStats}
    />
  );
}

function LiveShareCard({
  you,
  queryRank,
  queryBurn,
  initialEaters,
  initialCoreTarget,
  initialSupplyStats,
}: {
  you?: string;
  queryRank?: number;
  queryBurn?: number;
  initialEaters: Eater[];
  initialCoreTarget: number;
  initialSupplyStats?: SupplyStats;
}) {
  const { eaters, supplyStats, coreTarget } = useLeaderboardLive(
    initialEaters,
    initialSupplyStats,
    initialCoreTarget,
  );
  const status = you ? lookupConnectedRank(eaters, you) : null;
  const eater = status && status.kind !== "absent" ? status.eater : undefined;
  const rank = status?.kind === "ranked" ? status.rank : queryRank;
  const appleTotal = resolveAppleTotal(coreTarget, supplyStats?.totalSupply);
  const burned = eater && eater.burned > 0 ? eater.burned : queryBurn;
  const eatenPct =
    burned != null && appleEatenPct(burned, appleTotal) > 0
      ? formatAppleEatenPct(burned, appleTotal)
      : null;

  return (
    <>
      {eatenPct ? (
        <h1 className="mt-8 max-w-[420px] text-[32px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#1d1d1f]">
          {copy.share.eatenBoast(eatenPct)}
        </h1>
      ) : null}
      <ShareRow
        address={you}
        rank={rank}
        eater={eater}
        appleTotal={appleTotal}
        burn={eater ? undefined : queryBurn}
        className={eatenPct ? "mt-5" : "mt-8"}
      />
    </>
  );
}

function ShareRow({
  address,
  rank,
  eater,
  appleTotal = 0,
  burn,
  className = "mt-8",
}: {
  address?: string;
  rank?: number;
  eater?: Eater;
  appleTotal?: number;
  burn?: number;
  className?: string;
}) {
  return (
    <div
      className={`${className} w-full max-w-[420px] rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3.5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.06)]`}
    >
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-center text-sm font-bold tabular-nums text-[#6e6e73]">
          {rank ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          {address ? (
            <EaterIdentity
              address={address}
              avatarSize="sm"
              nameClassName="text-sm font-semibold text-[#1d1d1f]"
            />
          ) : null}
          {eater ? (
            <EaterStats
              eater={eater}
              appleTotal={appleTotal}
              className="mt-0.5"
            />
          ) : burn ? (
            <p className="mt-0.5 text-[11px] leading-snug text-[#6e6e73]">
              {copy.leaderboard.burnedAmount(formatCompactAmount(burn))}
            </p>
          ) : null}
        </div>
        {eater ? (
          <div className="shrink-0 text-right">
            <div className="text-sm font-bold tabular-nums text-[#1d1d1f]">
              {fmtScore(eater.score)}
            </div>
            <div className="text-[11px] text-[#6e6e73]">
              {copy.leaderboard.pts}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
