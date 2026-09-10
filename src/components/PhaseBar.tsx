"use client";

import { copy } from "@/lib/copy";
import type { SiteAct } from "@/lib/phase";

/** Phase strip: Prologue (0) then Acts I–III */
export function PhaseBar({ act }: { act: SiteAct }) {
  const stages: { id: SiteAct; label: string }[] = [
    { id: 0, label: copy.phases.prologue },
    { id: 1, label: copy.phases.labels[0] },
    { id: 2, label: copy.phases.labels[1] },
    { id: 3, label: copy.phases.labels[2] },
  ];

  return (
    <div className="page-gutter flex flex-wrap items-center justify-center gap-1.5 py-4">
      {stages.map((stage, i) => {
        const active = stage.id === act;
        const past = stage.id < act;
        const display = stage.id === 0 ? "P" : String(stage.id);
        return (
          <div key={stage.id} className="flex items-center gap-1.5">
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
              {past ? "✓" : display}
            </div>
            <span
              className={[
                "text-xs",
                active ? "font-bold text-[#1d1d1f]" : "font-normal text-[#86868b]",
              ].join(" ")}
            >
              {stage.label}
            </span>
            {i < stages.length - 1 && (
              <div className="mx-0.5 h-px w-5 bg-[#d2d2d7]" />
            )}
          </div>
        );
      })}
    </div>
  );
}
