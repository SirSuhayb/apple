"use client";

import { useMemo, useState } from "react";
import type { Connector } from "wagmi";
import { useConnect } from "wagmi";
import { copy } from "@/lib/copy";
import type { Eater } from "@/lib/race";
import {
  HOME_BOARD_LIMIT,
  biteToSecureTop10,
  biteToSecureTop10ByBurn,
  formatAppleEatenPct,
  formatCompactAmount,
  lookupConnectedRank,
  type LeaderboardRankKey,
} from "@/lib/leaderboard-rank";
import { useBoardWallet } from "@/lib/use-board-wallet";
import { sharePageUrl } from "@/lib/share";
import {
  EaterIdentity,
  EaterName,
  EaterStats,
  fmtScore,
  eaterDomId,
  youSurfaceClass,
} from "./LeaderboardRow";
import { AppleAvatar } from "./AppleAvatar";
import { ShareActions } from "./ShareActions";

const CONNECTOR_LABELS: Record<string, string> = {
  injected: "Browser Wallet",
  walletConnect: "WalletConnect",
  coinbaseWalletSDK: "Coinbase Wallet",
};

function connectorLabel(c: Connector): string {
  if (c.name && c.name !== "Injected") return c.name;
  return CONNECTOR_LABELS[c.type] ?? c.name ?? c.type;
}

function dedupeConnectors(connectors: readonly Connector[]): Connector[] {
  const seen = new Set<string>();
  const result: Connector[] = [];
  for (const c of connectors) {
    const key = c.type === "injected" ? `injected:${c.name}` : c.type;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

function hideInjectedOnThisDevice(): boolean {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent;
  const phone = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  );
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (phone || (coarse && window.innerWidth < 900)) return true;
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
  return !ethereum;
}

function scrollToEater(address: string) {
  const el = document.getElementById(eaterDomId(address));
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Quiet product-page line — hidden in the top 10, or when there is no 10th yet. */
function Top10Nudge({
  eaters,
  score,
  burned = 0,
  placement = "score",
  inTop10,
  className = "mt-2 text-[13px] leading-snug text-[#6e6e73]",
}: {
  eaters: Eater[];
  score: number;
  burned?: number;
  placement?: LeaderboardRankKey;
  inTop10?: boolean;
  className?: string;
}) {
  if (inTop10) return null;
  const needed =
    placement === "burned"
      ? biteToSecureTop10ByBurn(burned, eaters)
      : biteToSecureTop10(score, eaters);
  if (needed == null || needed <= 0) return null;
  return (
    <p className={className}>
      {copy.leaderboard.top10Spot(formatCompactAmount(needed))}
    </p>
  );
}

function ConnectHint({ compact }: { compact?: boolean }) {
  const { connect, connectors: rawConnectors, isPending } = useConnect();
  const [open, setOpen] = useState(false);
  const connectors = useMemo(
    () =>
      dedupeConnectors(rawConnectors).filter((c) => {
        if (c.type === "injected" && hideInjectedOnThisDevice()) return false;
        return true;
      }),
    [rawConnectors],
  );

  if (compact && !open) {
    return (
      <p className="text-center text-[13px] text-[#6e6e73]">
        {copy.leaderboard.connectHint}{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-[#2997ff] hover:text-[#0077ed]"
        >
          {copy.leaderboard.connectCta}
        </button>
      </p>
    );
  }

  return (
    <div className="rounded-[14px] border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-4">
      <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
        {copy.leaderboard.yourRank}
      </p>
      <p className="mt-1 text-[15px] text-[#1d1d1f]">
        {copy.leaderboard.connectHint}
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black"
        >
          {copy.leaderboard.connectCta}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              disabled={isPending}
              onClick={() => connect({ connector })}
              className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            >
              {isPending ? copy.tap.connecting : connectorLabel(connector)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function YourRankCard({
  eaters,
  appleTotal,
  compact = false,
  placement = "score",
}: {
  eaters: Eater[];
  appleTotal: number;
  compact?: boolean;
  /** Home board ranks by burn share. The full leaderboard stays on points. */
  placement?: LeaderboardRankKey;
}) {
  const you = useBoardWallet();
  const status = lookupConnectedRank(eaters, you, placement);

  if (!you || !status) {
    return <ConnectHint compact={compact} />;
  }

  if (status.kind === "absent") {
    return (
      <div className="rounded-[14px] border border-dashed border-[#d2d2d7] bg-[#fafafa] px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
          {copy.leaderboard.yourRank}
        </p>
        <EaterIdentity
          address={you}
          isYou
          avatarSize="md"
          className="mt-1"
          nameClassName="text-[15px] font-semibold text-[#1d1d1f]"
        />
        <p className="mt-1 text-[15px] text-[#1d1d1f]">
          {copy.leaderboard.notOnBoard}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
          {copy.leaderboard.notOnBoardHint}
        </p>
        <Top10Nudge eaters={eaters} score={0} placement={placement} />
      </div>
    );
  }

  if (status.kind === "ineligible" || status.kind === "unranked") {
    const title =
      status.kind === "ineligible"
        ? copy.leaderboard.ineligibleYou
        : placement === "burned"
          ? copy.leaderboard.notInThePot
          : copy.leaderboard.belowThreshold;
    const hint =
      status.kind === "ineligible"
        ? copy.leaderboard.ineligibleYouHint
        : placement === "burned"
          ? copy.leaderboard.homeUnrankedHint
          : copy.leaderboard.belowThresholdHint;
    return (
      <div className="rounded-[14px] border border-dashed border-[#d2d2d7] bg-[#fafafa] px-4 py-4">
        <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
          {copy.leaderboard.yourRank}
        </p>
        <EaterIdentity
          address={status.eater.address}
          isYou
          avatarSize="md"
          className="mt-1"
          nameClassName="text-[15px] font-semibold text-[#1d1d1f]"
        />
        <p className="mt-1 text-[15px] text-[#1d1d1f]">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">{hint}</p>
        <EaterStats
          eater={status.eater}
          appleTotal={appleTotal}
          className="mt-2"
        />
        {status.kind === "unranked" ? (
          <Top10Nudge
            eaters={eaters}
            score={status.eater.score}
            burned={status.eater.burned}
            placement={placement}
          />
        ) : null}
      </div>
    );
  }

  const { eater, rank, total } = status;
  return (
    <div className={youSurfaceClass(true, "rounded-[14px] px-4 py-4")}>
      <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
        {copy.leaderboard.yourRank}
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AppleAvatar address={eater.address} size="md" className="mt-1" />
          <div className="min-w-0">
            <div className="text-[28px] font-black leading-none tabular-nums text-[#1d1d1f]">
              {rank}
            </div>
            <EaterName
              address={eater.address}
              isYou
              className="mt-1 text-[15px] font-semibold text-[#1d1d1f]"
            />
            <p className="mt-0.5 text-[12px] text-[#6e6e73]">
              {copy.leaderboard.rankOf(rank, total)}
            </p>
            <EaterStats
              eater={eater}
              appleTotal={appleTotal}
              showShare={placement !== "burned"}
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-extrabold tabular-nums text-[#1d1d1f]">
            {placement === "burned"
              ? formatAppleEatenPct(eater.burned, appleTotal)
              : fmtScore(eater.score)}
          </div>
          <div className="text-[11px] text-[#6e6e73]">
            {placement === "burned"
              ? copy.leaderboard.ofApple
              : copy.leaderboard.pts}
          </div>
          <button
            type="button"
            onClick={() => scrollToEater(eater.address)}
            className="mt-2 text-[12px] font-medium text-[#2997ff] hover:text-[#0077ed]"
          >
            {copy.leaderboard.showOnBoard}
          </button>
        </div>
      </div>
      <Top10Nudge
        eaters={eaters}
        score={eater.score}
        burned={eater.burned}
        placement={placement}
        inTop10={rank <= HOME_BOARD_LIMIT}
      />
      {!compact && (
        <ShareActions
          className="mt-4"
          text={copy.share.rank(rank)}
          url={sharePageUrl({ rank, you: eater.address })}
        />
      )}
    </div>
  );
}

/** Home mini-board: keep rank N visible when the connected wallet is outside the top 10. */
export function YourRankStickyRow({
  eaters,
  appleTotal,
  placement = "score",
}: {
  eaters: Eater[];
  appleTotal: number;
  placement?: LeaderboardRankKey;
}) {
  const you = useBoardWallet();
  const status = lookupConnectedRank(eaters, you, placement);
  if (status?.kind !== "ranked" || status.rank <= HOME_BOARD_LIMIT) return null;

  const { eater, rank } = status;
  return (
    <ul className="divide-y divide-[#d2d2d7] rounded-[14px] border border-[#d2d2d7] bg-white">
      <li
        id={eaterDomId(eater.address)}
        className={youSurfaceClass(
          true,
          "flex items-center gap-3 rounded-[14px] px-4 py-3 text-sm",
        )}
      >
        <span className="w-5 shrink-0 font-bold tabular-nums text-[#1d1d1f]">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <EaterIdentity
            address={eater.address}
            isYou
            avatarSize="sm"
            nameClassName="font-medium text-[#1d1d1f]"
          />
          <EaterStats
            eater={eater}
            appleTotal={appleTotal}
            showShare={placement !== "burned"}
            className="mt-0.5"
          />
          <Top10Nudge
            eaters={eaters}
            score={eater.score}
            burned={eater.burned}
            placement={placement}
            inTop10={false}
            className="mt-1 text-[12px] leading-snug text-[#6e6e73]"
          />
        </div>
        <span className="shrink-0 tabular-nums text-[#1d1d1f]">
          {placement === "burned"
            ? formatAppleEatenPct(eater.burned, appleTotal)
            : fmtScore(eater.score)}
        </span>
      </li>
    </ul>
  );
}
