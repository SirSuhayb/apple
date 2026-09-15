"use client";

import { useState } from "react";
import type { Eater } from "@/lib/race";
import { copy } from "@/lib/copy";

function shortAddr(addr: string) {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtScore(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function totalTrades(e: Eater) {
  return e.buyCount + e.sellCount + e.tapCount;
}

function isDev(e: Eater) {
  return Boolean(e.dev) || e.badge === "dev" || Boolean(e.ineligible && e.dev);
}

function isIneligible(e: Eater) {
  return Boolean(e.ineligible) || isDev(e);
}

function DevBadge() {
  return (
    <span className="ml-1.5 inline-flex align-middle rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#86868b] ring-1 ring-[#d2d2d7]">
      {copy.leaderboard.devBadge}
    </span>
  );
}

type SortKey = "score" | "trades" | "burned";

export function Leaderboard({
  eaters,
  mode = "kitchen",
}: {
  eaters: Eater[];
  mode?: "act1" | "kitchen";
}) {
  const isAct1 = mode === "act1";
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const sorted = [...eaters].sort((a, b) => {
    if (isAct1) {
      const ai = isIneligible(a) ? 1 : 0;
      const bi = isIneligible(b) ? 1 : 0;
      if (ai !== bi) return ai - bi;
    }
    if (sortBy === "trades") return totalTrades(b) - totalTrades(a);
    if (sortBy === "burned" && !isAct1) return b.burned - a.burned;
    return b.score - a.score;
  });

  const eligible = sorted.filter((e) => !isIneligible(e));
  const ineligible = isAct1 ? sorted.filter((e) => isIneligible(e)) : [];
  const podium = eligible.slice(0, 3);
  const restEligible = eligible.slice(3);

  const statTotal = eaters.reduce(
    (acc, e) => ({
      points: acc.points + e.score,
      trades: acc.trades + totalTrades(e),
    }),
    { points: 0, trades: 0 },
  );

  if (!eaters.length) {
    return (
      <div className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-14 text-center">
        <p className="text-[17px] text-[#86868b]">{copy.leaderboard.empty}</p>
        <p className="mt-2 text-[13px] text-[#86868b]">
          {isAct1
            ? copy.leaderboard.emptyHintAct1
            : copy.leaderboard.emptyHint}
        </p>
      </div>
    );
  }

  const sortTabs = (
    isAct1
      ? ([
          ["score", "Points"],
          ["trades", "Trades"],
        ] as const)
      : ([
          ["score", "Points"],
          ["trades", "Trades"],
          ["burned", "Burned"],
        ] as const)
  );

  return (
    <div className="space-y-6">
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
            <PodiumCard eater={podium[1]} rank={2} act1={isAct1} />
          ) : (
            <div />
          )}
          <PodiumCard eater={podium[0]} rank={1} hero act1={isAct1} />
          {podium.length >= 3 ? (
            <PodiumCard eater={podium[2]} rank={3} act1={isAct1} />
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Rows 4+ eligible */}
      {restEligible.length > 0 && (
        <ul className="divide-y divide-[#d2d2d7] rounded-[14px] border border-[#d2d2d7] bg-white">
          {restEligible.map((e, i) => (
            <li
              key={e.address}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <span className="w-7 text-center text-sm font-bold tabular-nums text-[#86868b]">
                {i + 4}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#1d1d1f]">
                  {shortAddr(e.address)}
                </div>
                {!isAct1 && (
                  <div className="mt-0.5 flex gap-2 text-[11px] text-[#86868b]">
                    <span>{e.buyCount}B</span>
                    <span>{e.sellCount}S</span>
                    <span>{e.tapCount}T</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums text-[#1d1d1f]">
                  {fmtScore(e.score)}
                </div>
                <div className="text-[11px] text-[#86868b]">
                  {copy.leaderboard.trades(totalTrades(e))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Ineligible / Dev — visible, not ranked */}
      {ineligible.length > 0 && (
        <ul className="divide-y divide-[#d2d2d7] rounded-[14px] border border-dashed border-[#d2d2d7] bg-[#fafafa]">
          {ineligible.map((e) => (
            <li
              key={e.address}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <span className="w-7 text-center text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">
                —
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#1d1d1f]">
                  {shortAddr(e.address)}
                  {isDev(e) && <DevBadge />}
                </div>
                <div className="mt-0.5 text-[11px] text-[#86868b]">
                  {copy.leaderboard.ineligible}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums text-[#1d1d1f]">
                  {fmtScore(e.score)}
                </div>
                <div className="text-[11px] text-[#86868b]">
                  {copy.leaderboard.trades(totalTrades(e))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Scoring explainer */}
      <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold tracking-[1px] text-[#86868b] uppercase">
          {copy.leaderboard.scoring.eyebrow}
        </p>
        <div className="space-y-1 text-[13px] text-[#6e6e73]">
          {isAct1 ? (
            <>
              <p>{copy.leaderboard.scoring.accum}</p>
              <p>{copy.leaderboard.scoring.hold}</p>
              <p>{copy.leaderboard.scoring.tradesAct1}</p>
              <p>{copy.leaderboard.scoring.devNote}</p>
            </>
          ) : (
            <>
              <p>{copy.leaderboard.scoring.buy}</p>
              <p>{copy.leaderboard.scoring.sell}</p>
              <p>{copy.leaderboard.scoring.tap}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PodiumCard({
  eater,
  rank,
  hero,
  act1,
}: {
  eater: Eater;
  rank: 1 | 2 | 3;
  hero?: boolean;
  act1?: boolean;
}) {
  const colors = {
    1: "text-[#e53935]",
    2: "text-[#ff9500]",
    3: "text-[#86868b]",
  } as const;

  return (
    <div
      className={[
        "rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-3 text-center",
        hero ? "py-6" : "py-4",
      ].join(" ")}
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
      <div
        className={[
          "mt-1 truncate font-semibold text-[#1d1d1f]",
          hero ? "text-[15px]" : "text-[12px]",
        ].join(" ")}
      >
        {shortAddr(eater.address)}
      </div>
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
      <div className="mt-1 text-[10px] text-[#86868b]">
        {act1
          ? copy.leaderboard.trades(totalTrades(eater))
          : `${eater.buyCount}B · ${eater.sellCount}S · ${eater.tapCount}T`}
      </div>
    </div>
  );
}
