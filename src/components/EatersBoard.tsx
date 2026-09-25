"use client";

import Link from "next/link";
import type { Eater } from "@/lib/race";
import { copy } from "@/lib/copy";
import {
  HOME_BOARD_LIMIT,
  formatAppleEatenPct,
  rankedEligible,
  sameWallet,
} from "@/lib/leaderboard-rank";
import { useBoardWallet } from "@/lib/use-board-wallet";
import {
  EaterIdentity,
  EaterName,
  EaterStats,
  eaterDomId,
  youSurfaceClass,
} from "./LeaderboardRow";
import { AppleAvatar } from "./AppleAvatar";
import { YourRankCard, YourRankStickyRow } from "./YourRank";

function burnShare(burned: number, appleTotal: number) {
  return formatAppleEatenPct(burned, appleTotal);
}

/** Home board — placement is each wallet’s share of the apple burned. */
export function EatersBoard({
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
  const you = useBoardWallet();
  const eligible = rankedEligible(eaters, "burned");

  if (!eaters.length) {
    return (
      <div className="grid grid-cols-1 gap-2.5">
        <YourRankCard
          eaters={eaters}
          appleTotal={appleTotal}
          compact
          placement="burned"
        />
        <div className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-10 text-center">
          <p className="text-[17px] text-[#6e6e73]">{copy.eaters.empty}</p>
          {isAct1 && (
            <p className="mt-2 text-[13px] text-[#6e6e73]">
              {copy.leaderboard.emptyHintAct1}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Home board: top burners only. Everyone else is on /leaderboard, by points.
  const topTen = eligible.slice(0, HOME_BOARD_LIMIT);
  const top = topTen[0];
  const mid = topTen.slice(1, 3);
  const low = topTen.slice(3, 6);
  const rest = topTen.slice(6, HOME_BOARD_LIMIT);

  return (
    <div className="grid grid-cols-1 gap-2.5">
      <YourRankCard
        eaters={eaters}
        appleTotal={appleTotal}
        compact
        placement="burned"
      />

      {!top && (
        <div className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-10 text-center">
          <p className="text-[17px] text-[#6e6e73]">{copy.eaters.noBurners}</p>
        </div>
      )}

      {/* #1 */}
      {top && (
        <div
          id={eaterDomId(top.address)}
          className={youSurfaceClass(
            sameWallet(top.address, you),
            [
              "rounded-[18px] border border-[#d2d2d7] px-5 py-6",
              sameWallet(top.address, you) ? "" : "bg-[#f5f5f7]",
            ].join(" "),
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <AppleAvatar address={top.address} size="lg" className="mt-1" />
              <div className="min-w-0">
                <div className="text-[44px] font-black leading-none text-[#e53935]">
                  1
                </div>
                <EaterName
                  address={top.address}
                  topEater
                  isYou={sameWallet(top.address, you)}
                  className="mt-1 text-[17px] font-semibold text-[#1d1d1f]"
                />
                <EaterStats
                  eater={top}
                  appleTotal={appleTotal}
                  showShare={false}
                  className="mt-1.5 text-xs"
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-extrabold tabular-nums text-[#1d1d1f]">
                {burnShare(top.burned, appleTotal)}
              </div>
              <div className="text-[11px] text-[#6e6e73]">
                {copy.leaderboard.ofApple}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* #2–3 */}
      {mid.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {mid.map((e, i) => {
            const rank = i + 2;
            const isYou = sameWallet(e.address, you);
            return (
              <div
                key={e.address}
                id={eaterDomId(e.address)}
                className={youSurfaceClass(
                  isYou,
                  [
                    "rounded-[18px] border border-[#d2d2d7] px-4 py-[18px]",
                    isYou ? "" : "bg-[#f5f5f7]",
                  ].join(" "),
                )}
              >
                <div
                  className={[
                    "text-[28px] font-black leading-none",
                    rank === 2 ? "text-[#ff9500]" : "text-[#6e6e73]",
                  ].join(" ")}
                >
                  {rank}
                </div>
                <EaterIdentity
                  address={e.address}
                  isYou={isYou}
                  avatarSize="md"
                  layout="stack"
                  className="mt-2"
                  nameClassName="text-sm font-semibold text-[#1d1d1f]"
                />
                <div className="mt-0.5 text-xs font-medium tabular-nums text-[#1d1d1f]">
                  {burnShare(e.burned, appleTotal)}{" "}
                  <span className="text-[#6e6e73]">
                    {copy.leaderboard.ofApple}
                  </span>
                </div>
                <EaterStats
                  eater={e}
                  appleTotal={appleTotal}
                  showShare={false}
                  className="mt-1"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* #4–6 */}
      {low.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {low.map((e, i) => {
            const rank = i + 4;
            const isYou = sameWallet(e.address, you);
            return (
              <div
                key={e.address}
                id={eaterDomId(e.address)}
                className={youSurfaceClass(
                  isYou,
                  [
                    "rounded-[14px] border border-[#d2d2d7] px-2.5 py-3 text-center",
                    isYou ? "" : "bg-[#f5f5f7]",
                  ].join(" "),
                )}
              >
                <div className="text-xl font-extrabold text-[#6e6e73]">
                  {rank}
                </div>
                <EaterIdentity
                  address={e.address}
                  isYou={isYou}
                  avatarSize="sm"
                  layout="stack"
                  className="mt-1.5"
                  nameClassName="text-[11px] font-semibold text-[#1d1d1f]"
                />
                <div className="mt-0.5 text-[10px] tabular-nums text-[#6e6e73]">
                  {burnShare(e.burned, appleTotal)} {copy.leaderboard.ofApple}
                </div>
                <EaterStats
                  eater={e}
                  appleTotal={appleTotal}
                  showShare={false}
                  layout="stack"
                  className="mt-1 items-center text-[10px]"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* #7–10 */}
      {rest.length > 0 && (
        <ul className="mt-1 divide-y divide-[#d2d2d7] rounded-[14px] border border-[#d2d2d7] bg-white">
          {rest.map((e, i) => {
            const isYou = sameWallet(e.address, you);
            return (
            <li
              key={e.address}
              id={eaterDomId(e.address)}
              className={youSurfaceClass(
                isYou,
                "flex items-center gap-3 px-4 py-3 text-sm first:rounded-t-[14px] last:rounded-b-[14px]",
              )}
            >
              <span className="w-5 shrink-0 text-[#6e6e73]">{i + 7}</span>
              <div className="min-w-0 flex-1">
                <EaterIdentity
                  address={e.address}
                  isYou={isYou}
                  avatarSize="sm"
                  nameClassName="font-medium text-[#1d1d1f]"
                />
                <EaterStats
                  eater={e}
                  appleTotal={appleTotal}
                  showShare={false}
                  className="mt-0.5"
                />
              </div>
              <span className="shrink-0 tabular-nums text-[#1d1d1f]">
                {burnShare(e.burned, appleTotal)}
              </span>
            </li>
            );
          })}
        </ul>
      )}

      <YourRankStickyRow
        eaters={eaters}
        appleTotal={appleTotal}
        placement="burned"
      />

      {/* Full leaderboard CTA */}
      <div className="mt-2 text-center">
        <Link
          href="/leaderboard"
          className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-black"
        >
          {copy.leaderboard.viewAll}
        </Link>
        {eligible.length > HOME_BOARD_LIMIT && (
          <p className="mt-2 text-[12px] text-[#6e6e73]">
            {copy.leaderboard.viewAllHint}
          </p>
        )}
      </div>
    </div>
  );
}
