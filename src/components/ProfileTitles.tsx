"use client";

import { copy } from "@/lib/copy";
import { formatCompactAmount } from "@/lib/leaderboard-rank";
import type { ProfileTitle, TitleId } from "@/lib/profile-titles";

function titleCopy(id: TitleId) {
  return copy.profile.titles[id];
}

function statusLabel(status: ProfileTitle["status"]): string {
  switch (status) {
    case "unlocked":
      return copy.profile.unlocked;
    case "coming_soon":
      return copy.profile.comingSoon;
    case "unavailable":
      return copy.profile.unavailable;
    default:
      return copy.profile.locked;
  }
}

function TitleCard({
  title,
  selectable,
  selected,
  onSelect,
}: {
  title: ProfileTitle;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: TitleId) => void;
}) {
  const meta = titleCopy(title.id);
  const unlocked = title.status === "unlocked";
  const muted =
    title.status === "locked" ||
    title.status === "unavailable" ||
    title.status === "coming_soon";
  const canPick = Boolean(selectable && unlocked && onSelect);

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={[
            "text-[15px] font-semibold tracking-[-0.01em]",
            unlocked ? "text-[#1d1d1f]" : "text-[#6e6e73]",
          ].join(" ")}
        >
          {meta.name}
        </p>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.02em] uppercase",
            selected
              ? "bg-[#1d1d1f] text-white"
              : unlocked
                ? "bg-[#e53935]/10 text-[#e53935]"
                : title.status === "coming_soon"
                  ? "bg-[#f5f5f7] text-[#86868b]"
                  : "bg-[#f5f5f7] text-[#6e6e73]",
          ].join(" ")}
        >
          {selected ? copy.profile.forShare : statusLabel(title.status)}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-[#6e6e73]">{meta.body}</p>
      {title.threshold != null &&
      title.status !== "coming_soon" &&
      title.status !== "unavailable" &&
      title.progress != null ? (
        <p className="mt-1.5 text-[11px] tabular-nums text-[#86868b]">
          {formatCompactAmount(title.progress)} /{" "}
          {formatCompactAmount(title.threshold)} $BITE
        </p>
      ) : null}
      {canPick && !selected ? (
        <p className="mt-2 text-[11px] font-medium text-[#2997ff]">
          {copy.profile.useOnShare}
        </p>
      ) : null}
    </>
  );

  const shellClass = [
    "rounded-[14px] border px-4 py-3.5 text-left transition",
    selected
      ? "border-[#1d1d1f] bg-white shadow-[inset_0_0_0_1px_#1d1d1f]"
      : unlocked
        ? "border-[#e53935]/25 bg-[#f8f4f3]"
        : "border-[#d2d2d7] bg-[#fafafa]",
    muted ? "opacity-70" : "",
    canPick ? "cursor-pointer hover:border-[#1d1d1f]/40" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (canPick) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect?.(title.id)}
          aria-pressed={selected}
          className={`w-full ${shellClass}`}
        >
          {inner}
        </button>
      </li>
    );
  }

  return <li className={shellClass}>{inner}</li>;
}

export function ProfileTitles({
  titles,
  holdNote,
  selectable = false,
  selectedId = null,
  onSelect,
}: {
  titles: ProfileTitle[];
  holdNote?: string | null;
  selectable?: boolean;
  selectedId?: TitleId | null;
  onSelect?: (id: TitleId) => void;
}) {
  const unlockedCount = titles.filter((t) => t.status === "unlocked").length;

  return (
    <section className="mt-10">
      <p className="text-[11px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
        {copy.profile.titlesEyebrow}
      </p>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-[#1d1d1f]">
        {copy.profile.titlesHeadline}
      </h2>
      {holdNote ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">
          {holdNote}
        </p>
      ) : null}
      {selectable ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">
          {unlockedCount > 0
            ? copy.profile.titlesPickHint
            : copy.profile.titlesPickNone}
        </p>
      ) : null}
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {titles.map((title) => (
          <TitleCard
            key={title.id}
            title={title}
            selectable={selectable}
            selected={selectedId === title.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}
