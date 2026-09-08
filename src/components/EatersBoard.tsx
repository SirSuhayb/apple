"use client";

import type { Eater } from "@/lib/race";
import { copy } from "@/lib/copy";

function shortAddr(addr: string) {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function burnedLabel(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Apple Store–style bento leaderboard from bite-phases.jsx */
export function EatersBoard({ eaters }: { eaters: Eater[] }) {
  if (!eaters.length) {
    return (
      <div className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-10 text-center">
        <p className="text-[17px] text-[#86868b]">{copy.eaters.empty}</p>
      </div>
    );
  }

  const top = eaters[0];
  const mid = eaters.slice(1, 3);
  const low = eaters.slice(3, 6);
  const rest = eaters.slice(6);

  return (
    <div className="grid grid-cols-1 gap-2.5">
      <div className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[44px] font-black leading-none text-[#e53935]">
              1
            </div>
            <div className="mt-1 text-[17px] font-semibold text-[#1d1d1f]">
              {shortAddr(top.address)}
            </div>
            <div className="mt-1 text-xs text-[#86868b]">
              {copy.eaters.rowMeta(
                burnedLabel(top.burned),
                String(Math.round(top.buyVolume)),
                String(Math.round(top.sellVolume)),
              )}
            </div>
          </div>
          <div className="text-[28px] font-extrabold text-[#1d1d1f]">
            {burnedLabel(top.burned)}
          </div>
        </div>
      </div>

      {mid.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {mid.map((e, i) => {
            const rank = i + 2;
            return (
              <div
                key={e.address}
                className="rounded-[18px] border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-[18px]"
              >
                <div
                  className={[
                    "text-[28px] font-black leading-none",
                    rank === 2 ? "text-[#e53935]" : "text-[#86868b]",
                  ].join(" ")}
                >
                  {rank}
                </div>
                <div className="mt-1 text-sm font-semibold text-[#1d1d1f]">
                  {shortAddr(e.address)}
                </div>
                <div className="mt-0.5 text-xs text-[#86868b]">
                  {burnedLabel(e.burned)} burned
                </div>
              </div>
            );
          })}
        </div>
      )}

      {low.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {low.map((e, i) => {
            const rank = i + 4;
            const name = shortAddr(e.address);
            return (
              <div
                key={e.address}
                className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-2.5 py-3 text-center"
              >
                <div className="text-xl font-extrabold text-[#86868b]">
                  {rank}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-[#1d1d1f]">
                  {name.length > 12 ? `${name.slice(0, 10)}…` : name}
                </div>
                <div className="mt-0.5 text-[10px] text-[#86868b]">
                  {burnedLabel(e.burned)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <ul className="mt-1 divide-y divide-[#d2d2d7] rounded-[14px] border border-[#d2d2d7] bg-white">
          {rest.map((e, i) => (
            <li
              key={e.address}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="text-[#86868b]">{i + 7}</span>
              <span className="font-medium text-[#1d1d1f]">
                {shortAddr(e.address)}
              </span>
              <span className="tabular-nums text-[#1d1d1f]">
                {burnedLabel(e.burned)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
