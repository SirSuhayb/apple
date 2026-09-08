"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { META_WAGER_THRESHOLD } from "@/lib/phase";

export function MetaWagerInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#d2d2d7] text-[11px] font-bold text-[#86868b]"
        aria-label="About the meta wager"
      >
        ?
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-5"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-[#fbfbfd] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[19px] font-bold text-[#1d1d1f]">
                {copy.metaWager.infoTitle}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f7] text-base text-[#86868b]"
              >
                ×
              </button>
            </div>
            <p className="text-[15px] leading-relaxed text-[#86868b]">
              {copy.metaWager.infoBody}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export function MetaWagerEmpty({ progress }: { progress: number }) {
  const ofThreshold = Math.min(
    100,
    (progress / META_WAGER_THRESHOLD) * 100,
  );
  const pctLabel = (progress * 100).toFixed(1);

  return (
    <div className="rounded-[18px] border-[1.5px] border-dashed border-[#d2d2d7] bg-[#f5f5f7] px-5 py-7 text-center">
      <div className="mb-2 text-[32px] leading-none">🍎 ⚔️ 🪱</div>
      <div className="mb-1.5 text-[17px] font-bold text-[#1d1d1f]">
        {copy.metaWager.emptyTitle}
      </div>
      <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-[#86868b]">
        {copy.metaWager.emptyBody}
      </p>
      <div className="mt-4 inline-block rounded-full bg-[#d2d2d7] px-4 py-1.5 text-xs font-semibold text-[#86868b]">
        {copy.metaWager.opensAt}
      </div>
      <div className="mt-3.5">
        <div className="mx-auto h-1.5 max-w-[200px] overflow-hidden rounded bg-[#d2d2d7]">
          <div
            className="h-full rounded bg-[#86868b]/50"
            style={{ width: `${ofThreshold}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-[#d2d2d7]">
          {copy.metaWager.thresholdProgress(pctLabel)}
        </div>
      </div>
    </div>
  );
}

/** Live odds UI — stakes not wired until meta wager contract exists */
export function MetaWagerLive({
  corePct = 68,
}: {
  corePct?: number;
}) {
  const rotPct = 100 - corePct;
  return (
    <div className="rounded-[18px] border border-[#d2d2d7] bg-white px-5 py-[22px]">
      <div className="mb-2.5 flex justify-between">
        <span className="text-[15px] font-bold text-[#34c759]">
          🍎 CORE {corePct}%
        </span>
        <span className="text-[15px] font-bold text-[#86868b]">
          ROT {rotPct}% 🪱
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-[5px] bg-[#f5f5f7]">
        <div
          className="bg-[#34c759] transition-[width] duration-500"
          style={{ width: `${corePct}%` }}
        />
        <div
          className="bg-[#d4a04a] transition-[width] duration-500"
          style={{ width: `${rotPct}%` }}
        />
      </div>
      <p className="mt-2.5 text-center text-xs leading-relaxed text-[#86868b]">
        {copy.metaWager.liveLead}
        <br />
        <span className="font-semibold text-[#1d1d1f]">
          {copy.metaWager.liveCta}
        </span>
      </p>
      <div className="mt-3.5 flex gap-2.5">
        <button
          type="button"
          disabled
          className="flex-1 cursor-not-allowed rounded-[10px] border-[1.5px] border-[#34c759] bg-[#34c759]/15 py-2.5 text-sm font-bold text-[#34c759] opacity-70"
        >
          {copy.metaWager.betCore}
        </button>
        <button
          type="button"
          disabled
          className="flex-1 cursor-not-allowed rounded-[10px] border-[1.5px] border-[#d4a04a] bg-[#d4a04a]/15 py-2.5 text-sm font-bold text-[#d4a04a] opacity-70"
        >
          {copy.metaWager.betRot}
        </button>
      </div>
    </div>
  );
}
