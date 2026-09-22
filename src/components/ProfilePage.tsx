"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Connector } from "wagmi";
import { useAccount, useConnect } from "wagmi";
import { copy } from "@/lib/copy";
import type { Eater, SupplyStats } from "@/lib/race";
import {
  formatCompactAmount,
  lookupConnectedRank,
  resolveAppleTotal,
  sameWallet,
} from "@/lib/leaderboard-rank";
import {
  resolveProfileTitles,
  type TitleId,
} from "@/lib/profile-titles";
import {
  loadShareTitlePick,
  saveShareTitlePick,
} from "@/lib/referrals";
import { sharePageUrl } from "@/lib/share";
import { useBiteBalance } from "@/lib/use-bite-balance";
import { useBoardWallet } from "@/lib/use-board-wallet";
import { useLeaderboardLive } from "@/lib/use-leaderboard";
import {
  EaterIdentity,
  EaterStats,
  fmtScore,
  youSurfaceClass,
} from "./LeaderboardRow";
import { FirstBiteQuestCard } from "./FirstBiteQuestBanner";
import {
  ProfileReferrals,
  useReferralPayoutCount,
} from "./ProfileReferrals";
import { ProfileTitles } from "./ProfileTitles";
import { ShareActions } from "./ShareActions";
import { SiteFooter } from "./SiteFooter";
import { TitleBadge } from "./TitleBadge";

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

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[14px] border border-[#d2d2d7] bg-white px-3 py-3 text-center">
      <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#1d1d1f]">
        {value}
      </div>
      {hint ? (
        <div className="text-[10px] text-[#6e6e73]">{hint}</div>
      ) : null}
    </div>
  );
}

function ConnectPanel() {
  const { connect, connectors: rawConnectors, isPending } = useConnect();
  const [open, setOpen] = useState(false);
  const connectors = useMemo(
    () => dedupeConnectors(rawConnectors),
    [rawConnectors],
  );

  return (
    <div className="mx-auto mt-10 max-w-md rounded-[18px] border border-[#d2d2d7] bg-white px-5 py-6 text-left shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
        {copy.profile.title}
      </p>
      <p className="mt-2 text-[17px] text-[#1d1d1f]">
        {copy.profile.connectHint}
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-black"
        >
          {copy.profile.connectCta}
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              disabled={isPending}
              onClick={() => connect({ connector })}
              className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            >
              {isPending ? copy.tap.connecting : connectorLabel(connector)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileShell({
  children,
  backHref = "/",
}: {
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fbfbfd] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-[#d2d2d7] bg-[rgba(251,251,253,0.82)] backdrop-blur-[20px] backdrop-saturate-150">
        <div className="page-gutter mx-auto flex h-12 max-w-[980px] items-center justify-between">
          <Link href="/" className="text-[17px] font-semibold">
            {copy.brand}
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="hidden text-[13px] font-medium text-[#2997ff] sm:block"
            >
              {copy.nav.leaderboard}
            </Link>
            <Link
              href={backHref}
              className="text-[13px] font-medium text-[#2997ff]"
            >
              {copy.profile.back}
            </Link>
          </div>
        </div>
      </header>
      <main className="page-gutter mx-auto w-full max-w-[680px] flex-1 pt-12 pb-16">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function useShareTitlePick(
  address: string | undefined,
  unlockedIds: TitleId[],
) {
  const [picked, setPicked] = useState<TitleId | null>(null);

  useEffect(() => {
    if (!address) {
      setPicked(null);
      return;
    }
    const unlocked = new Set(unlockedIds);
    const stored = loadShareTitlePick(address);
    if (stored && unlocked.has(stored)) {
      setPicked(stored);
      return;
    }
    setPicked(null);
    if (stored && !unlocked.has(stored)) {
      saveShareTitlePick(address, null);
    }
  }, [address, unlockedIds]);

  const select = (id: TitleId) => {
    if (!address) return;
    if (!unlockedIds.includes(id)) return;
    const next = picked === id ? null : id;
    setPicked(next);
    saveShareTitlePick(address, next);
  };

  return { picked, select };
}

function ProfileBody({
  address,
  isOwn,
  eaters,
  appleTotal,
  holdBalance,
  holdLoading,
}: {
  address: string;
  isOwn: boolean;
  eaters: Eater[];
  appleTotal: number;
  holdBalance: number | null;
  holdLoading: boolean;
}) {
  const status = lookupConnectedRank(eaters, address);
  const eater =
    status && status.kind !== "absent" ? status.eater : undefined;
  const rank = status?.kind === "ranked" ? status.rank : null;
  const total = status?.kind === "ranked" ? status.total : null;

  const titlesHold: number | null | undefined = !isOwn
    ? null
    : holdLoading
      ? undefined
      : (holdBalance ?? 0);

  const { count: referralPayoutsRaw } = useReferralPayoutCount(
    isOwn ? address : undefined,
  );
  const titlesReferrals: number | null | undefined = !isOwn
    ? null
    : referralPayoutsRaw;

  const titles = useMemo(
    () =>
      resolveProfileTitles({
        eater,
        holdBalance: titlesHold,
        referralPayouts: titlesReferrals,
      }),
    [eater, titlesHold, titlesReferrals],
  );

  const unlockedIds = useMemo(
    () =>
      titles
        .filter((t) => t.status === "unlocked")
        .map((t) => t.id),
    [titles],
  );

  const { picked, select } = useShareTitlePick(
    isOwn ? address : undefined,
    unlockedIds,
  );

  const holdNote = !isOwn
    ? copy.profile.holdUnavailable
    : holdLoading
      ? copy.profile.holdLoading
      : null;

  const shareRank = rank ?? undefined;
  const shareText = shareRank
    ? copy.share.rank(shareRank)
    : copy.share.fallback;

  return (
    <>
      <p className="mb-2 text-center text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
        {copy.profile.title}
      </p>
      <h1 className="text-center text-[clamp(32px,8vw,48px)] font-bold leading-[1.05] tracking-[-0.03em]">
        {isOwn ? copy.profile.headline : copy.profile.headlinePublic}
      </h1>
      <p className="mx-auto mt-2 max-w-[420px] text-center text-[15px] leading-relaxed text-[#6e6e73]">
        {copy.profile.subtitle}
      </p>

      <div
        className={youSurfaceClass(
          isOwn,
          "mt-8 rounded-[18px] border border-[#d2d2d7] bg-white px-5 py-5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <EaterIdentity
              address={address}
              isYou={isOwn}
              avatarSize="lg"
              nameClassName="text-[17px] font-semibold text-[#1d1d1f]"
            />
            {rank != null && total != null ? (
              <p className="mt-2 text-[13px] text-[#6e6e73]">
                {copy.leaderboard.rankOf(rank, total)}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-[#6e6e73]">
                {copy.profile.notOnBoard}
              </p>
            )}
            {eater ? (
              <EaterStats
                eater={eater}
                appleTotal={appleTotal}
                className="mt-1.5"
              />
            ) : (
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#6e6e73]">
                {copy.profile.notOnBoardHint}
              </p>
            )}
            {picked ? (
              <div className="mt-2.5">
                <TitleBadge titleId={picked} size="md" />
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[36px] font-black leading-none tabular-nums text-[#1d1d1f]">
              {rank ?? "—"}
            </div>
            <div className="mt-1 text-[11px] text-[#6e6e73]">
              {copy.profile.rankLabel}
            </div>
            {eater ? (
              <>
                <div className="mt-3 text-[22px] font-extrabold tabular-nums text-[#1d1d1f]">
                  {fmtScore(eater.score)}
                </div>
                <div className="text-[11px] text-[#6e6e73]">
                  {copy.leaderboard.pts}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCell
            label={copy.profile.scoreLabel}
            value={eater ? fmtScore(eater.score) : "—"}
          />
          <StatCell
            label={copy.profile.burnedLabel}
            value={
              eater && eater.burned > 0
                ? formatCompactAmount(eater.burned)
                : "0"
            }
          />
          <StatCell
            label={copy.profile.buysLabel}
            value={eater ? String(eater.buyCount) : "0"}
          />
          <StatCell
            label={copy.profile.sellsLabel}
            value={eater ? String(eater.sellCount) : "0"}
          />
        </div>

        {isOwn && holdBalance != null ? (
          <p className="mt-3 text-[13px] text-[#6e6e73]">
            {copy.profile.holdLabel}:{" "}
            <span className="font-medium tabular-nums text-[#1d1d1f]">
              {formatCompactAmount(holdBalance)} $BITE
            </span>
          </p>
        ) : null}

        <ShareActions
          className="mt-5"
          text={shareText}
          url={sharePageUrl({
            rank: shareRank,
            you: address,
            title: picked,
            ref: isOwn ? address : null,
          })}
        />
      </div>

      <ProfileTitles
        titles={titles}
        holdNote={holdNote}
        selectable={isOwn}
        selectedId={picked}
        onSelect={isOwn ? select : undefined}
      />

      {isOwn ? (
        <FirstBiteQuestCard
          eaters={eaters}
          holdBalance={holdBalance}
          enabled
        />
      ) : null}

      {isOwn ? <ProfileReferrals address={address} /> : null}
    </>
  );
}

export function ProfileMePage({
  initialEaters,
  initialCoreTarget = 0,
  initialSupplyStats,
}: {
  initialEaters: Eater[];
  initialCoreTarget?: number;
  initialSupplyStats?: SupplyStats;
}) {
  const { address, isConnected } = useAccount();
  const qaOrWallet = useBoardWallet();
  const profileAddress = address ?? qaOrWallet;
  const { eaters, supplyStats, coreTarget } = useLeaderboardLive(
    initialEaters,
    initialSupplyStats,
    initialCoreTarget,
  );
  const appleTotal = resolveAppleTotal(
    coreTarget,
    supplyStats?.totalSupply,
  );
  const { holdBalance, holdLoading } = useBiteBalance(
    Boolean(profileAddress),
    profileAddress,
  );

  if (!profileAddress) {
    return (
      <ProfileShell>
        <p className="mb-2 text-center text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
          {copy.profile.title}
        </p>
        <h1 className="text-center text-[clamp(32px,8vw,48px)] font-bold leading-[1.05] tracking-[-0.03em]">
          {copy.profile.headline}
        </h1>
        <p className="mx-auto mt-2 max-w-[420px] text-center text-[15px] leading-relaxed text-[#6e6e73]">
          {copy.profile.subtitle}
        </p>
        <ConnectPanel />
      </ProfileShell>
    );
  }

  return (
    <ProfileShell>
      <ProfileBody
        address={profileAddress}
        isOwn
        eaters={eaters}
        appleTotal={appleTotal}
        holdBalance={holdBalance}
        holdLoading={holdLoading}
      />
      {isConnected && address ? (
        <p className="mt-8 text-center">
          <Link
            href={`/u/${address}`}
            className="text-[13px] font-medium text-[#2997ff] hover:text-[#0077ed]"
          >
            {copy.profile.viewPublic}
          </Link>
        </p>
      ) : null}
    </ProfileShell>
  );
}

export function ProfilePublicPage({
  address,
  initialEaters,
  initialCoreTarget = 0,
  initialSupplyStats,
}: {
  address: string;
  initialEaters: Eater[];
  initialCoreTarget?: number;
  initialSupplyStats?: SupplyStats;
}) {
  const { address: connected } = useAccount();
  const isOwn = sameWallet(connected, address);
  const { eaters, supplyStats, coreTarget } = useLeaderboardLive(
    initialEaters,
    initialSupplyStats,
    initialCoreTarget,
  );
  const appleTotal = resolveAppleTotal(
    coreTarget,
    supplyStats?.totalSupply,
  );
  const { holdBalance, holdLoading } = useBiteBalance(isOwn, address);

  return (
    <ProfileShell backHref="/leaderboard">
      <ProfileBody
        address={address}
        isOwn={isOwn}
        eaters={eaters}
        appleTotal={appleTotal}
        holdBalance={isOwn ? holdBalance : null}
        holdLoading={isOwn && holdLoading}
      />
    </ProfileShell>
  );
}
