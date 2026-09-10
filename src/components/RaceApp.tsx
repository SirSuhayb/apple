"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaceState } from "@/lib/race";
import { FRAME_COUNT } from "@/lib/race";
import { buildDemoRaceState } from "@/lib/demo-state";
import {
  BITE_TOKEN,
  DAY_ONE_PLAYTHROUGH,
  PONS_TOKEN_URL,
  SWAP_PROVIDER,
} from "@/lib/config";
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
import { EatersBoard } from "./EatersBoard";
import {
  MetaWagerEmpty,
  MetaWagerInfo,
  MetaWagerLive,
} from "./MetaWager";
import { PhaseBar } from "./PhaseBar";
import { SiteFooter } from "./SiteFooter";
import { SwapModal } from "./SwapModal";

const AppleScene = dynamic(
  () => import("./AppleScene").then((m) => m.AppleScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-[#86868b]">
        {copy.toasts.loading}
      </div>
    ),
  },
);

const FRAME_MS = 550;

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
      <div className="page-gutter border-b border-[#d2d2d7] bg-[#f5f5f7] py-2.5 text-center text-[13px] font-semibold text-[#86868b]">
        {copy.phases.banners.rot}
      </div>
    );
  }
  if (act === 0) {
    return (
      <div className="page-gutter border-b border-[#d2d2d7] bg-[#f5f5f7] py-2.5 text-center text-[13px] leading-relaxed text-[#86868b]">
        {copy.phases.banners.prologue}
      </div>
    );
  }
  if (act === 1) {
    return (
      <div className="page-gutter border-b border-[#d2d2d7] bg-[#f5f5f7] py-2.5 text-center text-[13px] leading-relaxed text-[#86868b]">
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
        <p className="max-w-[300px] break-all font-mono text-xs leading-relaxed text-[#86868b]">
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
      <div className="mt-[22px]">
        {tradingOpen ? (
          <button
            type="button"
            onClick={onBuy}
            className="inline-block rounded-full bg-[#1d1d1f] px-7 py-3.5 text-[17px] font-semibold text-white transition hover:bg-black"
          >
            {copy.take.buy}
          </button>
        ) : (
          <span className="inline-block rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-7 py-3.5 text-[17px] font-semibold text-[#86868b]">
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

function HowCards({ locked }: { locked: boolean }) {
  return (
    <div className="page-gutter mx-auto max-w-[980px]">
      <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0">
        {copy.how.items.map((item) => {
          const isLocked = locked && item.lockInAct1;
          return (
            <div
              key={item.title}
              className={[
                "relative min-w-[min(260px,78vw)] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] border border-[#d2d2d7] px-5 py-6 md:min-w-0 md:max-w-none",
                isLocked ? "bg-[#f5f5f7] opacity-55" : "bg-white",
              ].join(" ")}
            >
              {isLocked && (
                <div className="absolute top-3 right-3 rounded-full bg-[#d2d2d7] px-2.5 py-0.5 text-[10px] font-semibold text-[#86868b]">
                  {copy.how.comingAct2}
                </div>
              )}
              <div className="mb-3 text-[36px] leading-none">{item.icon}</div>
              <div
                className={[
                  "mb-1.5 text-[22px] font-bold",
                  isLocked ? "text-[#86868b]" : "text-[#1d1d1f]",
                ].join(" ")}
              >
                {item.title}
              </div>
              <div className="text-sm leading-relaxed text-[#86868b]">
                {item.body}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RaceApp({ initial }: { initial: RaceState }) {
  const [state, setState] = useState(initial);
  const [juicePulse, setJuicePulse] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const [playFrame, setPlayFrame] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/race", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as RaceState;
      setState(next);
    } catch {
      // keep current
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 12_000);
    return () => clearInterval(id);
  }, [refresh]);

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
      message: copy.toasts.burned(
        result.amountLabel,
        (result.progress * 100).toFixed(1),
      ),
    }));
    if (!result.demo) void refresh();
  };

  const flags = useMemo(
    () =>
      resolvePhaseFlags({
        progress: state.progress,
        eaterCount: state.eaters.length,
        racePhase: state.phase,
        secondsLeft: state.secondsLeft,
      }),
    [state.progress, state.eaters.length, state.phase, state.secondsLeft],
  );

  const rot =
    state.phase === "rot" ||
    (state.quietRotPreview && state.phase === "racing");
  const displayFrame = DAY_ONE_PLAYTHROUGH ? playFrame : state.appleFrame;
  const displayProgress = DAY_ONE_PLAYTHROUGH
    ? playFrame / (FRAME_COUNT - 1)
    : state.progress;
  const pct = (displayProgress * 100).toFixed(1);
  const burnedDisplay = formatTokenAmount(state.burned);
  const remainingDisplay = formatTokenAmount(state.totalSupply);
  const daysLeft = state.secondsLeft / 86_400;
  const tagline = heroTagline(flags.act, state.phase);
  const raceEnded = state.phase === "core" || state.phase === "rot";

  // Prologue + Act I leaderboard empty; Act II+ use live/demo eaters
  const boardEaters = flags.act <= 1 ? [] : state.eaters;

  /** Day 1 default: pons deep-link. Opt-in Uniswap modal via NEXT_PUBLIC_SWAP_PROVIDER=uniswap. */
  const openBuy = () => {
    if (!flags.tradingOpen) return;
    if (SWAP_PROVIDER === "uniswap") {
      setSwapOpen(true);
      return;
    }
    window.open(PONS_TOKEN_URL, "_blank", "noreferrer");
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
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                flags.act === 0 || flags.act === 1
                  ? "border-[#d2d2d7] bg-[#f5f5f7] text-[#86868b]"
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
              <span className="rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3.5 py-1.5 text-xs font-semibold text-[#86868b]">
                {copy.nav.soon}
              </span>
            )}
          </div>
        </div>
      </header>

      <PhaseBar act={flags.act} />

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
        <p className="animate-rise-delay-1 mt-2 text-[clamp(19px,4vw,28px)] font-normal text-[#86868b]">
          {tagline}
        </p>
        {(flags.act === 0 || flags.act === 1) && (
          <p className="animate-rise-delay-1 mx-auto mt-3 max-w-[420px] text-[15px] leading-relaxed text-[#86868b]">
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
                    if (e.key === "Enter" || e.key === " ") openBite();
                  }
                : undefined
            }
            role={flags.burnsOpen && !raceEnded ? "button" : undefined}
            tabIndex={flags.burnsOpen && !raceEnded ? 0 : undefined}
          >
            <AppleScene
              frame={displayFrame}
              rot={state.phase === "rot"}
              quietPreview={rot && state.phase !== "rot"}
              juicePulse={juicePulse}
              enableOrbit={flags.act >= 2 && !DAY_ONE_PLAYTHROUGH}
            />
          </div>
          {flags.burnsOpen && !raceEnded && (
            <p className="mt-1 text-[13px] text-[#86868b]">
              {copy.hero.appleLabel}
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
            <span className="rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-6 py-3 text-[15px] font-semibold text-[#86868b]">
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
          <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed text-[#86868b]">
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
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {copy.game.eyebrow}
        </p>
        <h2 className="text-[clamp(26px,6vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">
          {copy.game.headline}
        </h2>
        <div className="mx-auto mt-3.5 max-w-[460px] space-y-3 text-[17px] leading-relaxed text-[#86868b]">
          {copy.game.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      {/* Countdown + progress — Act II+ */}
      {flags.showProgress && (
        <div className="page-gutter bg-[#f5f5f7] py-7 text-center">
          <div className="mx-auto max-w-[460px]">
            <p className="mb-3.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
              {copy.core.eyebrow}
            </p>
            <Countdown
              secondsLeft={state.secondsLeft}
              deadline={state.deadline}
              urgent={flags.countdownUrgent}
            />
            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs text-[#86868b]">
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
              <div className="mt-1.5 text-right text-[11px] text-[#86868b]">
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
        <p className="mx-auto mt-3.5 max-w-[440px] text-[17px] leading-relaxed text-[#86868b]">
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
          <p className="mb-5 text-[17px] text-[#86868b]">
            {copy.how.intro[0]}{" "}
            <span className="font-bold text-[#1d1d1f]">{copy.how.intro[1]}</span>
          </p>
        </div>
        <HowCards locked={flags.howLocked} />
      </section>

      {/* Wager — Act II+ */}
      {flags.showWager && (
        <section
          id="wager"
          className="page-gutter bg-[#fbfbfd] py-20 text-center"
        >
          <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
            {copy.wager.eyebrow}
          </p>
          <h2 className="text-[clamp(26px,6vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">
            {copy.wager.headline[0]}
            <br />
            {copy.wager.headline[1]}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#86868b]">
            {copy.wager.body}
          </p>
          <p className="mt-2.5 text-[13px] text-[#86868b] italic">
            {copy.wager.clarifier}
          </p>
        </section>
      )}

      {/* Meta wager — Act II+ */}
      {flags.showMetaWager && (
        <section className="page-gutter bg-[#fbfbfd] pb-[60px]">
          <div className="mx-auto max-w-[480px]">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
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
          <p className="mb-4 text-[17px] text-[#86868b]">
            {copy.eaters.intro[0]}{" "}
            <span className="font-bold text-[#1d1d1f]">
              {copy.eaters.intro[1]}
            </span>
          </p>
          <EatersBoard eaters={boardEaters} />
          {flags.act === 0 && (
            <p className="mt-3 text-center text-[13px] text-[#86868b] italic">
              {copy.eaters.emptyHintPrologue}
            </p>
          )}
          {flags.act === 1 && (
            <p className="mt-3 text-center text-[13px] text-[#86868b] italic">
              {copy.eaters.emptyHint}
            </p>
          )}
        </div>
      </section>

      {/* Why AAPL */}
      <section id="pairing" className="page-gutter bg-[#fbfbfd] py-20">
        <div className="@container mx-auto max-w-[680px]">
          <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
            {copy.pairing.eyebrow}
          </p>
          <h2 className="text-[clamp(14px,5.4cqi,36px)] font-bold leading-[1.12] tracking-[-0.02em]">
            {copy.pairing.headline[0]}
            <br />
            {copy.pairing.headline[1]}
          </h2>
          <p className="mt-3.5 max-w-[580px] text-[15px] leading-relaxed text-[#86868b]">
            {copy.pairing.body}
          </p>
          <p className="mt-2.5 max-w-[580px] text-[15px] leading-relaxed text-[#86868b]">
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
                <div className="mb-1 text-[10px] font-semibold tracking-[1.2px] text-[#86868b] uppercase">
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

      {/* Tap section */}
      <section id="tap" className="page-gutter bg-[#fbfbfd] py-20 text-center">
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {copy.tap.eyebrow}
        </p>
        <h2 className="text-[clamp(26px,6vw,40px)] font-bold tracking-[-0.02em]">
          {copy.tap.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[440px] text-[15px] leading-relaxed text-[#86868b]">
          {copy.tap.body}
        </p>
        <div className="mt-8">
          {raceEnded ? (
            <p className="text-[15px] font-medium text-[#86868b]">
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
            <p className="text-[15px] font-medium text-[#86868b]">
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
          <ContractBlock onBuy={openBuy} tradingOpen={flags.tradingOpen} />
        </div>
      </section>

      <SiteFooter />

      {flags.burnsOpen && !raceEnded && (
        <BiteModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          currentProgress={state.progress}
          onBiteComplete={onBiteComplete}
        />
      )}

      {SWAP_PROVIDER === "uniswap" && (
        <SwapModal open={swapOpen} onClose={() => setSwapOpen(false)} />
      )}
    </div>
  );
}

export function RaceAppFallback() {
  return <RaceApp initial={buildDemoRaceState()} />;
}
