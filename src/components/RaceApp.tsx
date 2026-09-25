"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import type { Eater, RaceState, SupplyStats } from "@/lib/race";
import { FRAME_COUNT } from "@/lib/race";
import { buildDemoRaceState } from "@/lib/demo-state";
import {
  BITE_TOKEN,
  DAY_ONE_PLAYTHROUGH,
  DECAY_PREVIEW_OVERRIDE,
  LEADERBOARD_POLL_MS,
  PONS_TOKEN_URL,
  SWAP_PROVIDER,
} from "@/lib/config";
import { isLocalDecayHost, parseDecayOverride } from "@/lib/decay";
import {
  contractAddressDisplay,
  copy,
  formatDuration,
  formatTokenAmount,
  heroTagline,
  socialLinks,
} from "@/lib/copy";
import { resolvePhaseFlags, type SiteAct } from "@/lib/phase";
import { useBiteBalance } from "@/lib/use-bite-balance";
import { BiteModal, type BiteResult } from "./BiteModal";
import { Countdown } from "./Countdown";
import { useLeaderboardLive } from "@/lib/use-leaderboard";
import { resolveAppleTotal, sameWallet, weiToTokens } from "@/lib/leaderboard-rank";
import { EatersBoard } from "./EatersBoard";
import { AppleConditionBanner } from "./AppleConditionBanner";
import { FirstBiteQuestBanner } from "./FirstBiteQuestBanner";
import { ReferralChecklistBanner } from "./ReferralChecklistBanner";
import {
  MetaWagerEmpty,
  MetaWagerInfo,
  MetaWagerLive,
} from "./MetaWager";
import { SiteFooter } from "./SiteFooter";
import { SwapModal } from "./SwapModal";

const AppleScene = dynamic(
  () => import("./AppleScene").then((m) => m.AppleScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-[#6e6e73]">
        {copy.toasts.loading}
      </div>
    ),
  },
);

const FRAME_MS = 550;

/** Cream produce sticker — sits on the hero apple's lower-right cheek. */
function AppleProduceSticker() {
  return (
    <div className="apple-sticker" aria-hidden>
      <Image
        src="/sticker.png"
        alt="PLU produce sticker"
        width={401}
        height={274}
        className="apple-sticker-img"
        priority
      />
    </div>
  );
}

function PhaseBanner({
  act,
  racePhase,
  progressPct,
  daysLeft,
  earlyEaterActive,
  earlyEaterSecondsLeft,
  urgencyBanner,
}: {
  act: SiteAct;
  racePhase: RaceState["phase"];
  progressPct: string;
  daysLeft: number;
  earlyEaterActive: boolean;
  earlyEaterSecondsLeft: number;
  urgencyBanner: boolean;
}) {
  if (racePhase === "core") {
    return (
      <div className="page-gutter border-b border-[#e53935]/20 bg-[#e53935]/10 py-2.5 text-center text-[13px] font-semibold text-[#e53935]">
        {copy.phases.banners.core}
      </div>
    );
  }
  if (racePhase === "rot") {
    return (
      <div className="page-gutter border-b border-[#d2d2d7] bg-[#f5f5f7] py-2.5 text-center text-[13px] font-semibold text-[#6e6e73]">
        {copy.phases.banners.rot}
      </div>
    );
  }
  if (act === 0) {
    return (
      <div className="page-gutter border-b border-[#d2d2d7] bg-[#f5f5f7] py-2.5 text-center text-[13px] leading-relaxed text-[#6e6e73]">
        {copy.phases.banners.prologue}
      </div>
    );
  }
  if (act === 1) {
    return (
      <div className="page-gutter border-b border-[#d2d2d7] bg-[#f5f5f7] py-2.5 text-center text-[13px] leading-relaxed text-[#6e6e73]">
        {copy.phases.banners.act1}
      </div>
    );
  }
  if (act === 2 && earlyEaterActive) {
    const text =
      earlyEaterSecondsLeft < 72 * 3600
        ? copy.phases.banners.earlyEaterRemaining(
            formatDuration(earlyEaterSecondsLeft),
          )
        : copy.phases.banners.earlyEater;
    return (
      <div className="page-gutter border-b border-[#e53935]/20 bg-[#e53935]/10 py-2.5 text-center text-[13px] font-semibold text-[#e53935]">
        {text}
      </div>
    );
  }
  if (act === 3 && urgencyBanner) {
    const days =
      daysLeft < 1
        ? "<1"
        : String(Math.max(1, Math.floor(daysLeft)));
    return (
      <div className="page-gutter border-b border-[#e53935]/20 bg-[#e53935]/10 py-2.5 text-center text-[13px] font-semibold text-[#e53935]">
        {daysLeft < 1 && daysLeft * 24 < 1
          ? copy.phases.banners.minutes
          : daysLeft < 3
            ? copy.phases.banners.browning
            : copy.phases.banners.urgency(progressPct, days)}
      </div>
    );
  }
  return null;
}

function ContractBlock({
  onBuy,
  tradingOpen,
}: {
  onBuy: () => void;
  tradingOpen: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const address = contractAddressDisplay();
  const canCopy = Boolean(BITE_TOKEN);

  const onCopy = async () => {
    if (!BITE_TOKEN) return;
    try {
      await navigator.clipboard.writeText(BITE_TOKEN);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="inline-block rounded-2xl border border-[#d2d2d7] bg-[#f5f5f7] px-[22px] py-5">
        <p className="max-w-[300px] break-all font-mono text-xs leading-relaxed text-[#6e6e73]">
          {address}
        </p>
        <div className="mt-2.5">
          <button
            type="button"
            disabled={!canCopy}
            onClick={() => void onCopy()}
            className="text-[15px] text-[#2997ff] disabled:opacity-40"
          >
            {copied ? copy.take.copied : copy.take.copyAddress}
          </button>
        </div>
      </div>
      <div className="mt-[22px] flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {tradingOpen ? (
          <button
            type="button"
            onClick={onBuy}
            className="inline-block rounded-full bg-[#1d1d1f] px-7 py-3.5 text-[17px] font-semibold text-white transition hover:bg-black"
          >
            {copy.take.buy}
          </button>
        ) : (
          <span className="inline-block rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-7 py-3.5 text-[17px] font-semibold text-[#6e6e73]">
            {copy.take.buySoon}
          </span>
        )}
      </div>
      <div className="mt-3.5 flex items-center justify-center gap-[18px]">
        <a
          href={socialLinks.twitter}
          target="_blank"
          rel="noreferrer"
          className="text-[15px] text-[#2997ff]"
        >
          {copy.take.social.twitter}
        </a>
        <a
          href={socialLinks.telegram}
          target="_blank"
          rel="noreferrer"
          className="text-[15px] text-[#2997ff]"
        >
          {copy.take.social.telegram}
        </a>
        {tradingOpen && (
          <a
            href={socialLinks.chart}
            target="_blank"
            rel="noreferrer"
            className="text-[15px] text-[#2997ff]"
          >
            {copy.take.social.chart}
          </a>
        )}
      </div>
    </div>
  );
}

function HowCards({ act }: { act: SiteAct }) {
  return (
    <div id="how" className="page-gutter mx-auto max-w-[980px]">
      <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0">
        {copy.how.items.map((item) => {
          const isLocked = act < item.lockUntilAct;
          const lockLabel =
            item.lockUntilAct <= 1
              ? copy.how.comingAct1
              : copy.how.comingAct2;
          return (
            <div
              key={item.title}
              className={[
                "relative min-w-[min(260px,78vw)] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] border border-[#d2d2d7] px-5 py-6 md:min-w-0 md:max-w-none",
                isLocked ? "bg-[#f5f5f7] opacity-55" : "bg-white",
              ].join(" ")}
            >
              {isLocked && (
                <div className="absolute top-3 right-3 rounded-full bg-[#d2d2d7] px-2.5 py-0.5 text-[10px] font-semibold text-[#6e6e73]">
                  {lockLabel}
                </div>
              )}
              <div className="mb-3 text-[36px] leading-none">{item.icon}</div>
              <div
                className={[
                  "mb-1.5 text-[22px] font-bold",
                  isLocked ? "text-[#6e6e73]" : "text-[#1d1d1f]",
                ].join(" ")}
              >
                {item.title}
              </div>
              <div className="text-sm leading-relaxed text-[#6e6e73]">
                {item.body}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 10) return n.toFixed(0);
  return n.toFixed(2);
}

function PrizePoolBento({
  stats,
  showProgress,
  secondsLeft,
  deadline,
  urgent,
  burnedDisplay,
  progressPct,
  progress,
}: {
  stats: SupplyStats | null;
  showProgress: boolean;
  secondsLeft: number;
  deadline: number;
  urgent: boolean;
  burnedDisplay: string;
  progressPct: string;
  progress: number;
}) {
  const total = stats?.totalSupply ?? 0;
  const burned = Math.max(0, stats?.totalBurned ?? 0);
  const wallets = Math.max(0, stats?.eoaHeldBite ?? 0);
  // LP is whatever supply is left after wallets and burns, so the three parts sum to supply.
  const contracts = Math.max(0, total - wallets - burned);
  const pctOf = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const segments = [
    {
      label: "Burned",
      amount: burned,
      pct: pctOf(burned),
      bar: "bg-[#e53935]",
    },
    {
      label: "Held by wallets",
      amount: wallets,
      pct: pctOf(wallets),
      bar: "bg-[#1d1d1f]",
    },
    {
      label: "In LP / contracts",
      amount: contracts,
      pct: pctOf(contracts),
      bar: "bg-[#86868b]",
    },
  ];

  const prizeLabel =
    stats && stats.prizePoolAapl > 0
      ? `${fmtCompact(stats.prizePoolAapl)} AAPL`
      : "0 AAPL";
  const prizeUsd =
    stats?.prizePoolUsd != null && stats.prizePoolUsd > 0
      ? `$${stats.prizePoolUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : null;
  const holderCount = stats?.holderCount ?? 0;

  const tile =
    "rounded-[28px] border border-[#d2d2d7] bg-white text-[#1d1d1f]";

  return (
    <div className="grid gap-3">
      <div className={`${tile} px-6 py-7 text-center sm:px-8 sm:py-8`}>
        <p className="text-[11px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
          Prize pool
        </p>
        <p className="mt-2 text-[clamp(40px,5vw,64px)] font-bold leading-none tracking-[-0.04em] text-[#e53935] tabular-nums">
          {prizeLabel}
        </p>
        {prizeUsd && (
          <p className="mt-2 text-[17px] tabular-nums text-[#6e6e73]">
            {prizeUsd}
          </p>
        )}
        <div className="mt-6 text-left">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-[#d2d2d7]">
            {segments.map((segment) => (
              <div
                key={segment.label}
                className={segment.bar}
                style={{ width: `${Math.min(100, segment.pct)}%` }}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {segments.map((segment) => (
              <div key={segment.label}>
                <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
                  {segment.label}
                </div>
                <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-[#1d1d1f]">
                  {fmtCompact(segment.amount)}
                </div>
                <div className="text-[11px] tabular-nums text-[#6e6e73]">
                  {segment.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`${tile} flex flex-col px-4 py-5 sm:px-5`}>
          {showProgress ? (
            <Countdown
              secondsLeft={secondsLeft}
              deadline={deadline}
              urgent={urgent}
              compact
            />
          ) : (
            <p className="text-center text-[15px] font-medium leading-snug text-[#1d1d1f]">
              {copy.core.notStarted}
            </p>
          )}
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-[#6e6e73]">
                {copy.core.burned(showProgress ? burnedDisplay : "0")}
              </span>
              <span className="text-[15px] font-bold tabular-nums text-[#e53935]">
                {showProgress ? progressPct : "0.0"}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#d2d2d7]">
              <div
                className="progress-fill h-full rounded-full bg-gradient-to-r from-[#66bb6a] to-[#e53935] transition-[width] duration-1000"
                style={{
                  width: `${showProgress ? Math.min(100, progress * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className={`${tile} px-4 py-5 text-center sm:px-5`}>
          <p className="text-[11px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
            Players
          </p>
          <p className="mt-3 text-[clamp(32px,4vw,48px)] font-bold leading-none tracking-[-0.03em] tabular-nums">
            {holderCount.toLocaleString()}
          </p>
          <p className="mt-2 text-[13px] text-[#6e6e73]">
            {fmtCompact(wallets)} held
          </p>
        </div>
      </div>
    </div>
  );
}

export function RaceApp({
  initial,
  act1Eaters = [],
}: {
  initial: RaceState;
  /** Act I trades + points board (from bot state / public export) */
  act1Eaters?: Eater[];
}) {
  const [state, setState] = useState(initial);
  const {
    eaters: liveEaters,
    supplyStats: liveSupply,
    coreTarget: liveCoreTarget,
    refresh: refreshBoard,
  } = useLeaderboardLive(
    act1Eaters,
    initial.supplyStats,
    weiToTokens(initial.coreTarget),
  );
  const [supplyStats, setSupplyStats] = useState<SupplyStats | null>(
    initial.supplyStats ?? null,
  );
  const [juicePulse, setJuicePulse] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const [playFrame, setPlayFrame] = useState(0);
  const [prefillAmount, setPrefillAmount] = useState<string | null>(null);
  const [qaDecay, setQaDecay] = useState<number | null>(null);
  const [referralChecklistActive, setReferralChecklistActive] = useState(false);

  const { address, isConnected } = useAccount();
  const { holdBalance } = useBiteBalance(
    Boolean(isConnected && address),
    address,
  );

  useEffect(() => {
    if (!isLocalDecayHost()) return;
    const fromQuery = parseDecayOverride(
      new URLSearchParams(window.location.search).get("decay"),
    );
    const fromEnv = parseDecayOverride(DECAY_PREVIEW_OVERRIDE);
    if (fromQuery != null || fromEnv != null) {
      setQaDecay(fromQuery ?? fromEnv);
    }
  }, []);

  // Deep links: #swap opens native swap; #burn / #burn?amount=X opens burn modal
  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash; // e.g. "#burn?amount=1000" or "#swap"
      const base = hash.split("?")[0]?.toLowerCase() ?? "";

      if (base === "#swap") {
        if (SWAP_PROVIDER !== "pons") {
          setSwapOpen(true);
        }
        return;
      }

      if (!base.startsWith("#burn")) return;

      // Parse amount from hash params (e.g. #burn?amount=1000)
      const qIdx = hash.indexOf("?");
      if (qIdx >= 0) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        const amt = params.get("amount");
        if (amt && /^\d+$/.test(amt)) {
          setPrefillAmount(amt);
        }
      }

      // Open burn modal when burns are live; still scroll to the burn section.
      setSwapOpen(false);
      setModalOpen(true);
      requestAnimationFrame(() => {
        const el = document.getElementById("burn");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      });
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/race", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as RaceState & { supplyStats?: SupplyStats | null };
      setState(next);
      if (next.supplyStats) setSupplyStats(next.supplyStats);
    } catch {
      // keep current
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, LEADERBOARD_POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (liveSupply) setSupplyStats(liveSupply);
  }, [liveSupply]);

  // Act I: looping stop-motion 0→9→0…
  useEffect(() => {
    if (!DAY_ONE_PLAYTHROUGH) return;
    const id = window.setInterval(() => {
      setPlayFrame((prev) => (prev >= FRAME_COUNT - 1 ? 0 : prev + 1));
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  const onBiteComplete = (result: BiteResult) => {
    setJuicePulse(Date.now());
    setState((prev) => ({
      ...prev,
      progress: result.progress,
      appleFrame: result.appleFrame,
      lastEatAt: Math.floor(Date.now() / 1000),
      decay: Math.round((prev.decay ?? 0) * 0.25),
      quietRotPreview: false,
      message: copy.toasts.burned(
        result.amountLabel,
        (result.progress * 100).toFixed(1),
      ),
    }));
    if (!result.demo) {
      void refresh();
      void refreshBoard();
    }
  };

  const flags = useMemo(
    () =>
      resolvePhaseFlags({
        progress: state.progress,
        eaterCount: state.eaters.length,
        racePhase: state.phase,
        secondsLeft: state.secondsLeft,
        now: state.deadline - state.secondsLeft,
      }),
    [state.progress, state.eaters.length, state.phase, state.secondsLeft, state.deadline],
  );

  const legalRot = state.phase === "rot";
  const liveDecay = Number.isFinite(state.decay) ? state.decay : 0;
  const displayDecay = qaDecay ?? liveDecay;
  const wrinkleNudge =
    !DAY_ONE_PLAYTHROUGH && !legalRot && displayDecay >= 72 ? 1 : 0;
  const displayFrame = DAY_ONE_PLAYTHROUGH
    ? playFrame
    : Math.min(FRAME_COUNT - 1, state.appleFrame + wrinkleNudge);
  const displayProgress = DAY_ONE_PLAYTHROUGH
    ? playFrame / (FRAME_COUNT - 1)
    : state.progress;
  const pct = (displayProgress * 100).toFixed(1);
  const burnedDisplay = formatTokenAmount(state.burned);
  const daysLeft = state.secondsLeft / 86_400;
  const tagline = heroTagline(flags.act, state.phase);
  const raceEnded = state.phase === "core" || state.phase === "rot";

  // Same live rows as /leaderboard — mini board is just the top of that list.
  const boardEaters = liveEaters;
  const boardMode: "act1" | "kitchen" = "act1";
  const appleTotal = resolveAppleTotal(
    liveCoreTarget || weiToTokens(state.coreTarget),
    supplyStats?.totalSupply,
  );

  /** Default: in-site AAPL↔$BITE swap. NEXT_PUBLIC_SWAP_PROVIDER=pons keeps the launchpad deep-link. */
  const openBuy = () => {
    if (!flags.tradingOpen) return;
    if (SWAP_PROVIDER === "pons") {
      window.open(PONS_TOKEN_URL, "_blank", "noreferrer");
      return;
    }
    setSwapOpen(true);
  };

  const openBite = () => {
    if (!flags.burnsOpen || raceEnded) return;
    setModalOpen(true);
  };

  const connectedEater = useMemo(() => {
    if (!address) return null;
    return boardEaters.find((e) => sameWallet(e.address, address)) ?? null;
  }, [boardEaters, address]);

  const eaterCount = useMemo(
    () =>
      boardEaters.filter((e) => (e.tapCount ?? 0) > 0 || (e.burned ?? 0) > 0)
        .length,
    [boardEaters],
  );

  const hasTakenBite = Boolean(
    connectedEater &&
      ((connectedEater.tapCount ?? 0) > 0 || (connectedEater.burned ?? 0) > 0),
  );
  const holdingBite =
    isConnected && holdBalance != null && holdBalance > 0;

  type HeroPrimary = "soon" | "trade" | "buyThenBite" | "firstBite" | "burn";
  const heroPrimary: HeroPrimary = (() => {
    if (!flags.tradingOpen) return "soon";
    if (!flags.burnsOpen || raceEnded) return "trade";
    if (!holdingBite) return "buyThenBite";
    if (!hasTakenBite) return "firstBite";
    return "burn";
  })();

  const heroPrimaryLabel =
    heroPrimary === "soon"
      ? copy.hero.ctaPrimarySoon
      : heroPrimary === "buyThenBite"
        ? copy.hero.ctaBuyThenBite
        : heroPrimary === "firstBite"
          ? copy.hero.ctaFirstBite
          : heroPrimary === "burn"
            ? copy.hero.ctaBurn
            : copy.hero.ctaPrimary;

  const heroPrimaryAction =
    heroPrimary === "buyThenBite" || heroPrimary === "trade"
      ? openBuy
      : heroPrimary === "firstBite" || heroPrimary === "burn"
        ? openBite
        : undefined;

  const heroSecondaryIsTrade =
    heroPrimary === "firstBite" || heroPrimary === "burn";

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfbfd] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-[#d2d2d7] bg-[rgba(251,251,253,0.82)] backdrop-blur-[20px] backdrop-saturate-150">
        <div className="page-gutter mx-auto flex h-12 max-w-[980px] items-center justify-between">
          <a href="#top" className="text-[17px] font-semibold">
            {copy.brand}
          </a>
          <div className="flex items-center gap-2.5">
            <Link
              href="/leaderboard"
              className="hidden text-[13px] font-medium text-[#2997ff] sm:block"
            >
              {copy.nav.leaderboard}
            </Link>
            <Link
              href="/me"
              className="hidden text-[13px] font-medium text-[#2997ff] sm:block"
            >
              {copy.nav.profile}
            </Link>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                flags.act === 0 || flags.act === 1
                  ? "border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]"
                  : flags.act === 2
                    ? "border-[#34c759]/40 bg-[#34c759]/15 text-[#34c759]"
                    : "border-[#e53935]/40 bg-[#e53935]/15 text-[#e53935]",
              ].join(" ")}
            >
              {flags.badge}
            </span>
            {flags.tradingOpen ? (
              <button
                type="button"
                onClick={openBuy}
                className="rounded-full bg-[#2997ff] px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                {copy.nav.buy}
              </button>
            ) : (
              <span
                aria-disabled="true"
                title={copy.nav.soon}
                className="rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3.5 py-1.5 text-xs font-semibold text-[#6e6e73]"
              >
                {copy.nav.buy}
              </span>
            )}
          </div>
        </div>
      </header>

      <AppleConditionBanner decay={displayDecay} floors={state.decayFloors} />

      <PhaseBanner
        act={flags.act}
        racePhase={state.phase}
        progressPct={pct}
        daysLeft={daysLeft}
        earlyEaterActive={flags.earlyEaterActive}
        earlyEaterSecondsLeft={flags.earlyEaterSecondsLeft}
        urgencyBanner={flags.urgencyBanner}
      />

      <ReferralChecklistBanner
        eaters={boardEaters}
        onBuy={openBuy}
        onBite={openBite}
        tradingOpen={flags.tradingOpen}
        burnsOpen={flags.burnsOpen && !raceEnded}
        onActiveChange={setReferralChecklistActive}
      />
      <FirstBiteQuestBanner
        eaters={boardEaters}
        onBite={openBite}
        burnsOpen={flags.burnsOpen && !raceEnded}
        suppressed={referralChecklistActive}
      />

      {/* Hero */}
      <section
        id="top"
        className="page-gutter bg-[#fbfbfd] pt-[60px] pb-10"
      >
        <div className="mx-auto grid max-w-[1080px] items-center gap-10 lg:grid-cols-2 lg:gap-8">
        <div className="text-center">
        <h1 className="animate-rise text-[clamp(48px,8vw,72px)] font-bold leading-none tracking-[-0.04em]">
          {copy.brand}
        </h1>
        <p className="animate-rise-delay-1 mt-2 text-[clamp(19px,4vw,28px)] font-normal text-[#6e6e73]">
          {tagline}
        </p>
        {(flags.act === 0 || flags.act === 1) && (
          <p className="animate-rise-delay-1 mx-auto mt-3 max-w-[420px] text-[15px] leading-relaxed text-[#6e6e73]">
            {flags.act === 0 ? copy.hero.support[0] : copy.hero.support[1]}
          </p>
        )}

        <div className="animate-fade relative mx-auto mt-2 flex w-full max-w-[520px] flex-col items-center">
          <div
            className={[
              "relative aspect-square w-[min(100%,min(48svh,420px))]",
              flags.burnsOpen && !raceEnded ? "cursor-pointer" : "",
            ].join(" ")}
            onClick={flags.burnsOpen && !raceEnded ? openBite : undefined}
            onKeyDown={
              flags.burnsOpen && !raceEnded
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openBite();
                    }
                  }
                : undefined
            }
            role={flags.burnsOpen && !raceEnded ? "button" : undefined}
            tabIndex={flags.burnsOpen && !raceEnded ? 0 : undefined}
            aria-label={
              flags.burnsOpen && !raceEnded
                ? `${copy.hero.sticker.action} ${copy.hero.sticker.detail}`
                : undefined
            }
          >
            <AppleScene
              frame={displayFrame}
              rot={legalRot}
              decay={displayDecay}
              juicePulse={juicePulse}
              enableOrbit={flags.act >= 2 && !DAY_ONE_PLAYTHROUGH}
            />
            <AppleProduceSticker />
          </div>
          {qaDecay != null && (
            <p className="mt-2 text-[11px] font-medium tracking-wide text-[#86868b] uppercase">
              {copy.decay.qaChip(String(qaDecay))}
            </p>
          )}
        </div>

        <div className="animate-rise-delay-2 mt-3 flex flex-wrap items-center justify-center gap-3.5">
          {heroPrimary === "soon" ? (
            <span className="rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-6 py-3 text-[15px] font-semibold text-[#6e6e73]">
              {heroPrimaryLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={heroPrimaryAction}
              className="rounded-full bg-[#1d1d1f] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-black"
            >
              {heroPrimaryLabel}
            </button>
          )}
          {heroSecondaryIsTrade ? (
            <button
              type="button"
              onClick={openBuy}
              className="flex items-center text-[15px] text-[#2997ff]"
            >
              {copy.hero.ctaTradeSecondary}
            </button>
          ) : (
            <a
              href={flags.act <= 1 ? "#game" : "#how"}
              className="flex items-center text-[15px] text-[#2997ff] no-underline"
            >
              {copy.hero.ctaSecondary[flags.act]}
            </a>
          )}
        </div>
        {flags.burnsOpen && eaterCount > 0 ? (
          <p className="mx-auto mt-3 text-center text-[12px] text-[#6e6e73]">
            {copy.hero.eaterCount(eaterCount)}
          </p>
        ) : null}

        {DAY_ONE_PLAYTHROUGH && (
          <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed text-[#6e6e73]">
            {flags.act === 0
              ? copy.tap.dayOne.notePrologue
              : copy.tap.dayOne.note}
          </p>
        )}
        </div>

        <PrizePoolBento
          stats={supplyStats}
          showProgress={flags.showProgress}
          secondsLeft={state.secondsLeft}
          deadline={state.deadline}
          urgent={flags.countdownUrgent}
          burnedDisplay={burnedDisplay}
          progressPct={pct}
          progress={displayProgress}
        />
        </div>
      </section>

      {/* Game */}
      <section id="game" className="bg-[#f5f5f7] py-16 text-center">
        <div className="page-gutter mx-auto max-w-[980px]">
          <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
            {copy.game.eyebrow}
          </p>
          <h2 className="text-[clamp(26px,6vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">
            {copy.game.headline}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[440px] text-[17px] leading-relaxed text-[#6e6e73]">
            {copy.game.body}
          </p>
          <p className="mt-10 mb-5 text-[17px] font-bold text-[#1d1d1f]">
            {copy.how.intro}
          </p>
        </div>
        <HowCards act={flags.act} />
      </section>

      {/* Wager — Act II+ */}
      {flags.showWager && (
        <section
          id="wager"
          className="page-gutter bg-[#fbfbfd] py-20 text-center"
        >
          <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
            {copy.wager.eyebrow}
          </p>
          <h2 className="text-[clamp(26px,6vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">
            {copy.wager.headline[0]}
            <br />
            {copy.wager.headline[1]}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#6e6e73]">
            {copy.wager.body}
          </p>
          <p className="mt-2.5 text-[13px] text-[#6e6e73] italic">
            {copy.wager.clarifier}
          </p>
        </section>
      )}

      {/* Meta wager — Act II+ */}
      {flags.showMetaWager && (
        <section className="page-gutter bg-[#fbfbfd] pb-[60px]">
          <div className="mx-auto max-w-[480px]">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
                {copy.metaWager.eyebrow}
              </p>
              <MetaWagerInfo />
            </div>
            {flags.metaWagerLive ? (
              <MetaWagerLive />
            ) : (
              <MetaWagerEmpty progress={state.progress} />
            )}
          </div>
        </section>
      )}

      {/* Biggest eaters */}
      <section id="eaters" className="page-gutter bg-[#f5f5f7] py-[60px]">
        <div className="mx-auto max-w-[580px]">
          <div className="mb-6 text-center">
            <h2 className="text-[clamp(26px,6vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">
              {copy.eaters.introAct2[0]} {copy.eaters.introAct2[1]}
            </h2>
            <p className="mt-3 text-[15px] font-semibold leading-snug text-[#1d1d1f]">
              {copy.eaters.prizeEligible}
            </p>
          </div>
          <EatersBoard
            eaters={boardEaters}
            mode={boardMode}
            appleTotal={appleTotal}
          />
          {flags.act === 0 && boardEaters.length === 0 && (
            <p className="mt-3 text-center text-[13px] text-[#6e6e73] italic">
              {copy.eaters.emptyHintPrologue}
            </p>
          )}
          {flags.act === 1 && boardEaters.length === 0 && (
            <p className="mt-3 text-center text-[13px] text-[#6e6e73] italic">
              {copy.leaderboard.emptyHintAct1}
            </p>
          )}
        </div>
      </section>

      {/* Why AAPL */}
      <section id="pairing" className="page-gutter bg-[#fbfbfd] py-20">
        <div className="@container mx-auto max-w-[680px]">
          <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
            {copy.pairing.eyebrow}
          </p>
          <h2 className="text-[clamp(14px,5.4cqi,36px)] font-bold leading-[1.12] tracking-[-0.02em]">
            {copy.pairing.headline[0]}
            <br />
            {copy.pairing.headline[1]}
          </h2>
          <p className="mt-3.5 max-w-[580px] text-[15px] leading-relaxed text-[#6e6e73]">
            {copy.pairing.body}
          </p>
          <p className="mt-2.5 max-w-[580px] text-[15px] leading-relaxed text-[#6e6e73]">
            {copy.pairing.then}
          </p>
        </div>
      </section>

      {/* Specs */}
      <section id="specs" className="page-gutter bg-[#f5f5f7] py-10">
        <div className="mx-auto max-w-[580px]">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] bg-[#d2d2d7]">
            {(
              [
                ["Chain", copy.finePrint.chain],
                ["Standard", copy.finePrint.standard],
                ["Pair", copy.finePrint.pair],
                ["Mechanism", copy.finePrint.mechanism],
                ["Phase", copy.finePrint.phase(flags.act)],
                [
                  "Burned",
                  copy.finePrint.burned(flags.act <= 1 ? "0" : pct),
                ],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="bg-white px-2.5 py-[18px] text-center"
              >
                <div className="mb-1 text-[10px] font-semibold tracking-[1.2px] text-[#6e6e73] uppercase">
                  {label}
                </div>
                <div className="text-[15px] leading-snug font-semibold whitespace-pre-line text-[#1d1d1f]">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tap / Burn section */}
      <section id="burn" className="page-gutter bg-[#fbfbfd] py-20 text-center">
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
          {copy.tap.eyebrow}
        </p>
        <h2 className="text-[clamp(26px,6vw,40px)] font-bold tracking-[-0.02em]">
          {copy.tap.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[440px] text-[15px] leading-relaxed text-[#6e6e73]">
          {copy.tap.body}
        </p>
        <div className="mt-8">
          {raceEnded ? (
            <p className="text-[15px] font-medium text-[#6e6e73]">
              {copy.tap.raceOver}
            </p>
          ) : flags.burnsOpen ? (
            <button
              type="button"
              onClick={openBite}
              className="rounded-full bg-[#1d1d1f] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black"
            >
              {copy.tap.cta}
            </button>
          ) : (
            <p className="text-[15px] font-medium text-[#6e6e73]">
              {flags.act === 0
                ? copy.tap.ctaLockedPrologue
                : copy.tap.ctaLocked}
            </p>
          )}
        </div>
      </section>

      {/* Take a $BITE */}
      <section id="buy" className="page-gutter bg-[#fbfbfd] py-20 text-center">
        <h2 className="text-[clamp(32px,7vw,48px)] font-bold leading-[1.05] tracking-[-0.03em]">
          {flags.tradingOpen
            ? copy.take.headline
            : copy.take.headlinePrologue}
        </h2>
        <div className="mt-6">
          <ContractBlock
            onBuy={openBuy}
            tradingOpen={flags.tradingOpen}
          />
        </div>
      </section>

      <SiteFooter />

      {flags.burnsOpen && !raceEnded && (
        <BiteModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          currentProgress={state.progress}
          onBiteComplete={onBiteComplete}
          prefillAmount={prefillAmount}
          eaters={boardEaters}
          earlyEater={flags.earlyEaterActive}
        />
      )}

      {SWAP_PROVIDER !== "pons" && (
        <SwapModal open={swapOpen} onClose={() => setSwapOpen(false)} />
      )}
    </div>
  );
}

export function RaceAppFallback() {
  return <RaceApp initial={buildDemoRaceState()} />;
}
