"use client";

import { copy } from "@/lib/copy";
import type { SiteAct } from "@/lib/phase";

export function PhaseBar({ act }: { act: SiteAct }) {
  const labels = copy.phases.labels;

  return (
    <div className="page-gutter flex flex-wrap items-center justify-center gap-1.5 py-4">
      {([1, 2, 3] as const).map((n) => {
        const active = n === act;
        const past = n < act;
        return (
          <div key={n} className="flex items-center gap-1.5">
            <div
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                active
                  ? "bg-[#e53935] text-white"
                  : past
                    ? "bg-[#34c759] text-white"
                    : "border-[1.5px] border-[#d2d2d7] bg-[#f5f5f7] text-[#86868b]",
              ].join(" ")}
            >
              {past ? "✓" : n}
            </div>
            <span
              className={[
                "text-xs",
                active ? "font-bold text-[#1d1d1f]" : "font-normal text-[#86868b]",
              ].join(" ")}
            >
              {labels[n - 1]}
            </span>
            {n < 3 && <div className="mx-0.5 h-px w-5 bg-[#d2d2d7]" />}
          </div>
        );
      })}
    </div>
  );
}
