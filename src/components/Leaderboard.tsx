"use client";

import { useMemo, useState } from "react";
import type { Eater } from "@/lib/race";
import { copy } from "@/lib/copy";
import {
  isLeaderboardDev,
  matchesAddressQuery,
  partitionLeaderboard,
  sameWallet,
  sortLeaderboardBy,
  tradeCount,
  type LeaderboardSortKey,
} from "@/lib/leaderboard-rank";
import { useBoardWallet } from "@/lib/use-board-wallet";
import {
  EaterIdentity,
  EaterName,
  EaterStats,
  eaterDomId,
  fmtScore,
  youSurfaceClass,
} from "./LeaderboardRow";
import { AppleAvatar } from "./AppleAvatar";
import { YourRankCard } from "./YourRank";

function DevBadge() {
  return (
    <span className="ml-1.5 inline-flex align-middle rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#86868b] ring-1 ring-[#d2d2d7]">
      {copy.leaderboard.devBadge}
    </span>
  );
}

export function Leaderboard({
  eaters,
  mode = "kitchen",
  appleTotal = 0,
}: {
  eaters: Eater[];
  mode?: "act1" | "kitchen";
  /** Core target (same denominator as on-site apple progress). */
  appleTotal?: number;
}) {
  const isAct1 = mode === "act1";
  const [sortBy, setSortBy] = useState<LeaderboardSortKey>("score");
  const [query, setQuery] = useState("");
  const you = useBoardWallet();

  const { eligible: rankedEligible, ineligible: ineligibleList } = useMemo(
    () => partitionLeaderboard(eaters),
    [eaters],
  );
  const eligibleSorted = useMemo(
    () => sortLeaderboardBy(rankedEligible, sortBy),
    [rankedEligible, sortBy],
  );
  const ineligibleSorted = useMemo(
    () => sortLeaderboardBy(ineligibleList, sortBy),
    [ineligibleList, sortBy],
  );
  const sortRank = useMemo(() => {
    const map = new Map<string, number>();
    eligibleSorted.forEach((e, i) => map.set(e.address.toLowerCase(), i + 1));
    return map;
  }, [eligibleSorted]);
  const searching = query.trim().length > 0;
  const eligible = searching
    ? eligibleSorted.filter((e) => matchesAddressQuery(e.address, query))
    : eligibleSorted;
  const ineligibleVisible = searching
    ? ineligibleSorted.filter((e) => matchesAddressQuery(e.address, query))
    : ineligibleSorted;
  const podium = searching ? [] : eligible.slice(0, 3);
  const restEligible = searching ? eligible : eligible.slice(3);
  const noSearchHits =
    searching && eligible.length === 0 && ineligibleVisible.length === 0;

  const statTotal = rankedEligible.reduce(
    (acc, e) => ({
      points: acc.points + e.score,
      trades: acc.trades + tradeCount(e),
    }),
    { points: 0, trades: 0 },
  );

  if (!eaters.length) {
    return (
      <div className="space-y-6">
        <YourRankCard eaters={eaters} appleTotal={appleTotal} />
        <div className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-14 text-center">
          <p className="text-[17px] text-[#86868b]">{copy.leaderboard.empty}</p>
          <p className="mt-2 text-[13px] text-[#86868b]">
            {isAct1
              ? copy.leaderboard.emptyHintAct1
              : copy.leaderboard.emptyHint}
          </p>
        </div>
      </div>
    );
  }

  const sortTabs = [
    ["score", "Points"],
    ["trades", "Trades"],
    ["burned", "Burned"],
  ] as const;

  return (
    <div className="space-y-6">
      <YourRankCard eaters={eaters} appleTotal={appleTotal} />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-4 text-center">
          <div className="text-[11px] font-semibold tracking-[1px] text-[#86868b] uppercase">
            {copy.leaderboard.totalPoints}
          </div>
          <div className="mt-1 text-[28px] font-bold tabular-nums text-[#1d1d1f]">
            {fmtScore(statTotal.points)}
          </div>
        </div>
        <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-4 text-center">
          <div className="text-[11px] font-semibold tracking-[1px] text-[#86868b] uppercase">
            {copy.leaderboard.totalTrades}
          </div>
          <div className="mt-1 text-[28px] font-bold tabular-nums text-[#1d1d1f]">
            {statTotal.trades.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Address search — matches full 0x or the shortened form */}
      <label className="block">
        <span className="sr-only">{copy.leaderboard.searchPlaceholder}</span>
        <div className="flex items-center gap-2 rounded-[14px] border border-[#d2d2d7] bg-white px-3 py-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.leaderboard.searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#86868b]"
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-[13px] font-medium text-[#2997ff] hover:text-[#0077ed]"
            >
              {copy.leaderboard.searchClear}
            </button>
          ) : null}
        </div>
      </label>

      {/* Sort tabs */}
      <div className="flex gap-1.5 rounded-full border border-[#d2d2d7] bg-[#f5f5f7] p-1">
        {sortTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortBy(key)}
            className={[
              "flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
              sortBy === key
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#86868b] hover:text-[#1d1d1f]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Podium — top 3 eligible only */}
      {podium.length >= 1 && (
        <div className="grid grid-cols-3 items-end gap-2.5">
          {podium.length >= 2 ? (
            <PodiumCard
              eater={podium[1]}
              rank={2}
              appleTotal={appleTotal}
              isYou={sameWallet(podium[1].address, you)}
            />
          ) : (
            <div />
          )}
          <PodiumCard
            eater={podium[0]}
            rank={1}
            hero
            appleTotal={appleTotal}
            isYou={sameWallet(podium[0].address, you)}
          />
          {podium.length >= 3 ? (
            <PodiumCard
              eater={podium[2]}
              rank={3}
              appleTotal={appleTotal}
              isYou={sameWallet(podium[2].address, you)}
            />
          ) : (
            <div />
          )}
        </div>
      )}

      {noSearchHits && (
        <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-8 text-center text-[15px] text-[#86868b]">
          {copy.leaderboard.searchEmpty}
        </div>
      )}

      {/* Eligible rows (4+ by default; all matches while searching) */}
      {restEligible.length > 0 && (
        <ul className="divide-y divide-[#d2d2d7] rounded-[14px] border border-[#d2d2d7] bg-white">
          {restEligible.map((e) => {
            const isYou = sameWallet(e.address, you);
            const rank = sortRank.get(e.address.toLowerCase()) ?? "—";
            return (
              <li
                key={e.address}
                id={eaterDomId(e.address)}
                className={youSurfaceClass(
                  isYou,
                  "flex items-center gap-3 px-4 py-3.5 first:rounded-t-[14px] last:rounded-b-[14px]",
                )}
              >
                <span className="w-7 text-center text-sm font-bold tabular-nums text-[#86868b]">
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <EaterIdentity
                    address={e.address}
                    isYou={isYou}
                    avatarSize="sm"
                    nameClassName="text-sm font-semibold text-[#1d1d1f]"
                  />
                  <EaterStats
                    eater={e}
                    appleTotal={appleTotal}
                    className="mt-0.5"
                  />
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-[#1d1d1f]">
                    {fmtScore(e.score)}
                  </div>
                  <div className="text-[11px] text-[#86868b]">
                    {copy.leaderboard.pts}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Ineligible / Dev — visible, not ranked */}
      {ineligibleVisible.length > 0 && (
        <ul className="divide-y divide-[#d2d2d7] rounded-[14px] border border-dashed border-[#d2d2d7] bg-[#fafafa]">
          {ineligibleVisible.map((e) => {
            const isYou = sameWallet(e.address, you);
            return (
              <li
                key={e.address}
                id={eaterDomId(e.address)}
                className={youSurfaceClass(
                  isYou,
                  "flex items-center gap-3 px-4 py-3.5 first:rounded-t-[14px] last:rounded-b-[14px]",
                )}
              >
                <span className="w-7 text-center text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">
                  —
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[#1d1d1f]">
                    <AppleAvatar address={e.address} size="sm" />
                    <EaterName address={e.address} isYou={isYou} />
                    {isLeaderboardDev(e) && <DevBadge />}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#86868b]">
                    {copy.leaderboard.ineligible}
                  </div>
                  <EaterStats
                    eater={e}
                    appleTotal={appleTotal}
                    className="mt-0.5"
                  />
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-[#1d1d1f]">
                    {fmtScore(e.score)}
                  </div>
                  <div className="text-[11px] text-[#86868b]">
                    {copy.leaderboard.pts}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Scoring explainer — Act I + II inclusive */}
      <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold tracking-[1px] text-[#86868b] uppercase">
          {copy.leaderboard.scoring.eyebrow}
        </p>
        <div className="space-y-1 text-[13px] text-[#6e6e73]">
          <p>{copy.leaderboard.scoring.buy}</p>
          <p>{copy.leaderboard.scoring.sell}</p>
          <p>{copy.leaderboard.scoring.tap}</p>
          <p>{copy.leaderboard.scoring.wager}</p>
          <p>{copy.leaderboard.scoring.accum}</p>
          <p>{copy.leaderboard.scoring.hold}</p>
          <p>{copy.leaderboard.scoring.burn}</p>
          <p>{copy.leaderboard.scoring.tapFloor}</p>
          <p>{copy.leaderboard.scoring.tradesAct1}</p>
        </div>
      </div>

      {/* Eligibility tooltip */}
      <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold tracking-[1px] text-[#86868b] uppercase">
          Eligibility
        </p>
        <div className="space-y-1 text-[13px] text-[#6e6e73]">
          <p>{copy.leaderboard.scoring.eligibility}</p>
          <p>{copy.leaderboard.scoring.devNote}</p>
        </div>
      </div>
    </div>
  );
}

function PodiumCard({
  eater,
  rank,
  hero,
  appleTotal,
  isYou,
}: {
  eater: Eater;
  rank: 1 | 2 | 3;
  hero?: boolean;
  appleTotal: number;
  isYou?: boolean;
}) {
  const colors = {
    1: "text-[#e53935]",
    2: "text-[#ff9500]",
    3: "text-[#86868b]",
  } as const;

  return (
    <div
      id={eaterDomId(eater.address)}
      className={youSurfaceClass(
        Boolean(isYou),
        [
          "rounded-[18px] border border-[#d2d2d7] px-3 text-center",
          isYou ? "" : "bg-[#f5f5f7]",
          hero ? "py-6" : "py-4",
        ].join(" "),
      )}
    >
      <div
        className={[
          "font-black leading-none",
          colors[rank],
          hero ? "text-[44px]" : "text-[28px]",
        ].join(" ")}
      >
        {rank}
      </div>
      <EaterIdentity
        address={eater.address}
        topEater={rank === 1}
        isYou={isYou}
        avatarSize={hero ? "lg" : "md"}
        layout="stack"
        className="mt-2"
        nameClassName={[
          "justify-center font-semibold text-[#1d1d1f]",
          hero ? "text-[15px]" : "text-[12px]",
        ].join(" ")}
      />
      <div
        className={[
          "mt-1 font-bold tabular-nums text-[#1d1d1f]",
          hero ? "text-xl" : "text-sm",
        ].join(" ")}
      >
        {fmtScore(eater.score)}
        <span className="ml-0.5 text-[10px] font-medium text-[#86868b]">
          {copy.leaderboard.pts}
        </span>
      </div>
      <EaterStats
        eater={eater}
        appleTotal={appleTotal}
        layout="stack"
        className="mt-1.5 items-center text-[10px]"
      />
    </div>
  );
}
