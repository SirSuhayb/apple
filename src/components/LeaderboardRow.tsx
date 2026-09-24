"use client";

import type { Eater } from "@/lib/race";
import { copy } from "@/lib/copy";
import { useEnsName } from "@/lib/use-ens-name";
import {
  burnCount,
  formatAppleEatenPct,
  formatCompactAmount,
  tradeCount,
} from "@/lib/leaderboard-rank";
import { AppleAvatar, type AppleAvatarSize } from "./AppleAvatar";

export function shortAddr(addr: string) {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtScore(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 10) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function eaterDomId(address: string) {
  return `eater-${address.toLowerCase()}`;
}

/** Subtle apple blush — highlight the connected wallet, not neon. */
export function youSurfaceClass(isYou: boolean, className = "") {
  return [
    "scroll-mt-16",
    className,
    isYou ? "bg-[#f8f4f3] shadow-[inset_0_0_0_1px_rgba(229,57,53,0.16)]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function YouBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full bg-[#e53935]/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.02em] text-[#e53935]",
        className,
      ].join(" ")}
    >
      {copy.leaderboard.you}
    </span>
  );
}

export function TopEaterBadge({
  label = copy.leaderboard.topEater,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full bg-[#e53935]/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.02em] text-[#e53935] ring-1 ring-[#e53935]/20",
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export function EaterName({
  address,
  topEater,
  leadLabel,
  isYou,
  className = "",
}: {
  address: string;
  topEater?: boolean;
  /** Rank-1 label for the active board. Home burn board uses `topEater`. */
  leadLabel?: string;
  isYou?: boolean;
  className?: string;
}) {
  const ens = useEnsName(address);
  const label = ens ?? shortAddr(address);
  const badge = leadLabel ?? (topEater ? copy.leaderboard.topEater : null);
  return (
    <div className={["flex min-w-0 flex-wrap items-center gap-1.5", className].join(" ")}>
      <span className="truncate" title={ens ? `${ens} · ${address}` : address}>
        {label}
      </span>
      {isYou ? <YouBadge /> : null}
      {badge ? <TopEaterBadge label={badge} /> : null}
    </div>
  );
}

/** Avatar + ENS/0x label — home mini-board, /leaderboard, Your Rank, share chips. */
export function EaterIdentity({
  address,
  topEater,
  leadLabel,
  isYou,
  avatarSize = "sm",
  layout = "row",
  className = "",
  nameClassName = "",
}: {
  address: string;
  topEater?: boolean;
  leadLabel?: string;
  isYou?: boolean;
  avatarSize?: AppleAvatarSize;
  layout?: "row" | "stack";
  className?: string;
  nameClassName?: string;
}) {
  if (layout === "stack") {
    return (
      <div className={["flex flex-col items-center", className].join(" ")}>
        <AppleAvatar address={address} size={avatarSize} />
        <EaterName
          address={address}
          topEater={topEater}
          leadLabel={leadLabel}
          isYou={isYou}
          className={["mt-1 justify-center", nameClassName].join(" ")}
        />
      </div>
    );
  }
  return (
    <div className={["flex min-w-0 items-center gap-2.5", className].join(" ")}>
      <AppleAvatar address={address} size={avatarSize} />
      <EaterName
        address={address}
        topEater={topEater}
        leadLabel={leadLabel}
        isYou={isYou}
        className={["min-w-0 flex-1", nameClassName].join(" ")}
      />
    </div>
  );
}

/** Trades, burns, and % of apple — shared by home mini-board and /leaderboard. */
export function EaterStats({
  eater,
  appleTotal,
  layout = "inline",
  className = "",
  showShare = true,
}: {
  eater: Eater;
  appleTotal: number;
  layout?: "inline" | "stack";
  className?: string;
  /** Home board already headlines the burn share, so the line can omit it. */
  showShare?: boolean;
}) {
  const items = [copy.leaderboard.trades(tradeCount(eater))];
  if (eater.burned > 0) {
    items.push(
      copy.leaderboard.burnedAmount(formatCompactAmount(eater.burned)),
    );
  }
  items.push(copy.leaderboard.burnsCount(burnCount(eater)));
  if ((eater.wagered ?? 0) > 0) {
    items.push(
      copy.leaderboard.wageredAmount(formatCompactAmount(eater.wagered ?? 0)),
    );
  }
  if (showShare && appleTotal > 0) {
    items.push(
      copy.leaderboard.eatenPct(formatAppleEatenPct(eater.burned, appleTotal)),
    );
  }

  if (layout === "stack") {
    return (
      <div
        className={["flex flex-col gap-0.5 text-[11px] leading-snug text-[#6e6e73]", className].join(
          " ",
        )}
      >
        {items.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    );
  }

  return (
    <p
      className={["text-[11px] leading-snug text-[#6e6e73]", className].join(" ")}
    >
      {items.join(" · ")}
    </p>
  );
}
