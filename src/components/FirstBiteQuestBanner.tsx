"use client";

import { useAccount } from "wagmi";
import { copy } from "@/lib/copy";
import type { Eater } from "@/lib/race";
import { sameWallet } from "@/lib/leaderboard-rank";
import { useBiteBalance } from "@/lib/use-bite-balance";

type FirstBiteQuestBannerProps = {
  eaters: Eater[];
  onBite: () => void;
  burnsOpen: boolean;
  /** When true, invite checklist owns the strip — hide this quest. */
  suppressed?: boolean;
};

function findEater(eaters: Eater[], address: string | undefined): Eater | null {
  if (!address) return null;
  return eaters.find((e) => sameWallet(e.address, address)) ?? null;
}

function hasTakenBite(eater: Eater | null): boolean {
  return Boolean(eater && (eater.tapCount > 0 || eater.burned > 0));
}

/**
 * Home strip for connected holders who have never kitchen-tapped.
 * Completing it unlocks the existing First Bite title — no new title.
 */
export function FirstBiteQuestBanner({
  eaters,
  onBite,
  burnsOpen,
  suppressed = false,
}: FirstBiteQuestBannerProps) {
  const { address, isConnected } = useAccount();
  const { holdBalance } = useBiteBalance(Boolean(isConnected && address), address);
  const eater = findEater(eaters, address);

  if (suppressed) return null;
  if (!burnsOpen || !isConnected || !address) return null;
  if (holdBalance == null || holdBalance <= 0) return null;
  if (hasTakenBite(eater)) return null;

  return (
    <div className="page-gutter border-b border-[#e53935]/20 bg-[#e53935]/8 py-3">
      <div className="mx-auto flex max-w-[980px] flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-[13px] font-semibold tracking-wide text-[#1d1d1f]">
            {copy.firstBiteQuest.headline}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#6e6e73]">
            {copy.firstBiteQuest.body}
          </p>
        </div>
        <button
          type="button"
          onClick={onBite}
          className="mx-auto shrink-0 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black sm:mx-0"
        >
          {copy.firstBiteQuest.cta}
        </button>
      </div>
    </div>
  );
}

type FirstBiteQuestCardProps = {
  eaters: Eater[];
  holdBalance: number | null;
  /** Own profile only. */
  enabled: boolean;
};

/** /me card — same quest, deep-links to /#burn. */
export function FirstBiteQuestCard({
  eaters,
  holdBalance,
  enabled,
}: FirstBiteQuestCardProps) {
  const { address, isConnected } = useAccount();
  const eater = findEater(eaters, address);

  if (!enabled || !isConnected || !address) return null;
  if (holdBalance == null || holdBalance <= 0) return null;
  if (hasTakenBite(eater)) return null;

  return (
    <div className="mt-6 rounded-[18px] border border-[#e53935]/25 bg-[#e53935]/8 px-5 py-4">
      <p className="text-[13px] font-semibold tracking-wide text-[#1d1d1f]">
        {copy.firstBiteQuest.headline}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-[#6e6e73]">
        {copy.firstBiteQuest.body}
      </p>
      <a
        href="/#burn"
        className="mt-3 inline-flex rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black"
      >
        {copy.firstBiteQuest.cta}
      </a>
    </div>
  );
}
