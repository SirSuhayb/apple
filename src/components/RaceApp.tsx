"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { BiteModal, type BiteResult } from "./BiteModal";
import { Countdown } from "./Countdown";
import { useLeaderboardLive } from "@/lib/use-leaderboard";
import { resolveAppleTotal, weiToTokens } from "@/lib/leaderboard-rank";
import { EatersBoard } from "./EatersBoard";
import { AppleConditionBanner } from "./AppleConditionBanner";
import {
  MetaWagerEmpty,
  MetaWagerInfo,
  MetaWagerLive,
} from "./MetaWager";
import { SiteFooter } from "./SiteFooter";
import { SwapModal } from "./SwapModal";
import { DigestButton } from "./DigestButton";

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
    <div className="page-gutter mx-auto max-w-[980px]">
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

function SupplyStatsCard({ stats }: { stats: SupplyStats }) {
  const burned = stats.totalBurned;
  const burnPct =
    stats.totalSupply > 0 ? (burned / stats.totalSupply) * 100 : 0;
  const eoaPct =
    stats.totalSupply > 0 ? (stats.eoaHeldBite / stats.totalSupply) * 100 : 0;
  const contractPct =
    stats.totalSupply > 0
      ? (stats.contractHeldBite / stats.totalSupply) * 100
      : 0;

  const prizeLabel = stats.prizePoolAapl > 0
    ? `${fmtCompact(stats.prizePoolAapl)} AAPL`
    : "0 AAPL";
  const prizeUsd =
    stats.prizePoolUsd != null && stats.prizePoolUsd > 0
      ? `$${stats.prizePoolUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : null;

  const cells = [
    {
      label: "Prize Pool",
      value: prizeLabel,
      sub: prizeUsd,
      accent: true,
    },
    {
      label: "Held by Wallets",
      value: `${fmtCompact(stats.eoaHeldBite)}`,
      sub: `${eoaPct.toFixed(1)}% of supply`,
    },
    {
      label: "In LP / Contracts",
      value: `${fmtCompact(stats.contractHeldBite)}`,
      sub: `${contractPct.toFixed(1)}% of supply`,
    },
    {
      label: "Burnable by Holders",
      value: `${fmtCompact(stats.realisticallyBurnable)}`,
      sub: `${eoaPct.toFixed(1)}% of supply`,
    },
    {
      label: "Burned",
      value: `${fmtCompact(burned)}`,
      sub: `${burnPct.toFixed(2)}%`,
    },
    {
      label: "Holders",
      value: stats.holderCount.toLocaleString(),
      sub: stats.bitePriceUsd
        ? `$${stats.bitePriceUsd.toFixed(6)}`
        : null,
    },
  ];

  return (
    <div className="mx-auto max-w-[580px]">
      <p className="mb-4 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
        Supply breakdown
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {cells.map((c) => (
          <div
            key={c.label}
            className={[
              "rounded-[14px] border px-3 py-4 text-center",
              c.accent
                ? "border-[#e53935]/30 bg-[#e53935]/5"
                : "border-[#d2d2d7] bg-white",
            ].join(" ")}
          >
            <div className="mb-1 text-[10px] font-semibold tracking-[1.2px] text-[#6e6e73] uppercase">
              {c.label}
            </div>
            <div
              className={[
                "text-[17px] font-bold leading-snug tabular-nums",
                c.accent ? "text-[#e53935]" : "text-[#1d1d1f]",
              ].join(" ")}
            >
              {c.value}
            </div>
            {c.sub && (
              <div className="mt-0.5 text-[11px] text-[#6e6e73]">{c.sub}</div>
            )}
          </div>
        ))}
      </div>
      <DigestButton />
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

  // Deep links: #swap opens native swap; #burn / #burn?amount=X opens burn section
  useEffect(() => {
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

    // Scroll to the burn section after layout settles
    requestAnimationFrame(() => {
      const el = document.getElementById("burn");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
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
  const remainingDisplay = formatTokenAmount(state.totalSupply);
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

      <AppleConditionBanner decay={displayDecay} />

      <PhaseBanner
        act={flags.act}
        racePhase={state.phase}
        progressPct={pct}
        daysLeft={daysLeft}
        earlyEaterActive={flags.earlyEaterActive}
        earlyEaterSecondsLeft={flags.earlyEaterSecondsLeft}
        urgencyBanner={flags.urgencyBanner}
      />

      {/* Hero */}
      <section
        id="top"
        className="page-gutter bg-[#fbfbfd] pt-[60px] pb-10 text-center"
      >
        <h1 className="animate-rise text-[clamp(56px,14vw,96px)] font-bold leading-none tracking-[-0.04em]">
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
          {flags.tradingOpen ? (
            <button
              type="button"
              onClick={openBuy}
              className="rounded-full bg-[#1d1d1f] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-black"
            >
              {copy.hero.ctaPrimary}
            </button>
          ) : (
            <span className="rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-6 py-3 text-[15px] font-semibold text-[#6e6e73]">
              {copy.hero.ctaPrimarySoon}
            </span>
          )}
          <a
            href={flags.act <= 1 ? "#game" : "#how"}
            className="flex items-center text-[15px] text-[#2997ff] no-underline"
          >
            {copy.hero.ctaSecondary[flags.act]}
          </a>
        </div>

        {DAY_ONE_PLAYTHROUGH && (
          <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed text-[#6e6e73]">
            {flags.act === 0
              ? copy.tap.dayOne.notePrologue
              : copy.tap.dayOne.note}
          </p>
        )}
      </section>

      {/* Game explainer — Act I first (and later acts) so stakes are clear early */}
      <section
        id="game"
        className="page-gutter bg-[#f5f5f7] py-16 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
          {copy.game.eyebrow}
        </p>
        <h2 className="text-[clamp(26px,6vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">
          {copy.game.headline}
        </h2>
        <div className="mx-auto mt-3.5 max-w-[460px] space-y-3 text-[17px] leading-relaxed text-[#6e6e73]">
          {copy.game.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      {/* Countdown + progress — Act II+ */}
      {flags.showProgress && (
        <div className="page-gutter bg-[#f5f5f7] py-7 text-center">
          <div className="mx-auto max-w-[460px]">
            <p className="mb-3.5 text-xs font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
              {copy.core.eyebrow}
            </p>
            <Countdown
              secondsLeft={state.secondsLeft}
              deadline={state.deadline}
              urgent={flags.countdownUrgent}
            />
            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs text-[#6e6e73]">
                  {copy.core.remaining(remainingDisplay)}
                </span>
                <span className="text-2xl font-bold text-[#e53935]">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-[#d2d2d7]">
                <div
                  className="progress-fill h-full rounded bg-gradient-to-r from-[#66bb6a] to-[#e53935] transition-[width] duration-1000"
                  style={{
                    width: `${Math.min(100, displayProgress * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 text-right text-[11px] text-[#6e6e73]">
                {copy.core.burned(burnedDisplay)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The line — supporting mechanics after the game stakes */}
      <section className="page-gutter bg-[#fbfbfd] py-20 text-center">
        <h2 className="text-[clamp(26px,6vw,44px)] font-bold leading-[1.1] tracking-[-0.03em] whitespace-pre-line">
          {(flags.act <= 1
            ? copy.line.headline[flags.act === 0 ? 0 : 1]
            : copy.line.headline.racing
          ).join("\n")}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[440px] text-[17px] leading-relaxed text-[#6e6e73]">
          {flags.act === 0
            ? copy.line.body[0]
            : flags.act === 1
              ? copy.line.body[1]
              : copy.line.body.racing}
        </p>
      </section>

      {/* How */}
      <section id="how" className="bg-[#f5f5f7] py-[60px]">
        <div className="page-gutter mx-auto max-w-[980px]">
          <p className="mb-5 text-[17px] text-[#6e6e73]">
            {copy.how.intro[0]}{" "}
            <span className="font-bold text-[#1d1d1f]">{copy.how.intro[1]}</span>
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

      {/* Supply stats */}
      {supplyStats && supplyStats.totalSupply > 0 && (
        <section id="supply" className="page-gutter bg-[#f5f5f7] py-10">
          <SupplyStatsCard stats={supplyStats} />
        </section>
      )}

      {/* Biggest eaters */}
      <section id="eaters" className="page-gutter bg-[#f5f5f7] py-[60px]">
        <div className="mx-auto max-w-[580px]">
          <p className="mb-4 text-[17px] text-[#6e6e73]">
            {flags.act <= 1 ? copy.eaters.intro[0] : copy.eaters.introAct2[0]}{" "}
            <span className="font-bold text-[#1d1d1f]">
              {flags.act <= 1 ? copy.eaters.intro[1] : copy.eaters.introAct2[1]}
            </span>
          </p>
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
