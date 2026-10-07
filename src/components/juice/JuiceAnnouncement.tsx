"use client";

/**
 * Full interactive juice announcement experience.
 *
 * Flow:
 *  1. Closed juicer (SVG) — tap to open lid
 *  2. Connect wallet or enter test mode
 *  3. Seed count reveal
 *  4. Choose container (based on eligible tiers)
 *  5. Add pulp (0–3 scoops of razzle dazzle)
 *  6. Customize label (from preset images / NFT credits)
 *  7. Cost to mint in $BITE (bridge seeds+BITE → JUICE)
 *  8. Juicing animation: seeds go in, blender spins, camera pulls back
 *     to eye-level assembly line, containers fill
 *  9. Phase 2 complete — congrats
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Connector } from "wagmi";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { JuicerSVG, type JuicerState } from "./svg/JuicerSVG";
import { ContainerForTier } from "./svg/ContainerSVG";
import { AssemblyLineSVG, type AssemblyStage } from "./svg/AssemblyLineSVG";
import { bestContainer, CONTAINER_TIERS, seedsToOz, seedPulp } from "@/lib/seeds";
import { baseChain } from "@/lib/juice-config";
import type { SeedMap } from "@/lib/use-leaderboard";

/**
 * Inline juicing animation that starts its timer from a click handler
 * (same pattern as the working /juice/test page).
 */
function JuicingInline({
  seeds,
  pulpScoops,
  containerTier,
  labelName,
  onComplete,
}: {
  seeds: number;
  pulpScoops: number;
  containerTier: string;
  labelName?: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState("ready");
  const [elapsed, setElapsed] = useState(0);
  const [juicerState, setJuicerState] = useState<JuicerState>("filling");
  const [assemblyStage, setAssemblyStage] = useState<AssemblyStage>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const startAnimation = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startRef.current = Date.now();
    setPhase("filling");
    setElapsed(0);

    intervalRef.current = setInterval(() => {
      const ms = Date.now() - startRef.current;
      setElapsed(ms);

      if (ms >= 14200) {
        setPhase("done");
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        onCompleteRef.current();
      } else if (ms >= 7700) {
        setPhase("assembly-filling");
        setAssemblyStage("filling");
      } else if (ms >= 6500) {
        setPhase("assembly");
        setJuicerState("dispensing");
        setAssemblyStage("dispensing");
      } else if (ms >= 2500) {
        setPhase("blending");
        setJuicerState("blending");
      }
    }, 100);
  };

  if (phase === "ready") {
    return (
      <div className="flex flex-col items-center">
        <JuicerSVG
          state="open"
          seedCount={seeds}
          pulpLevel={pulpScoops}
          className="w-[280px] h-[280px]"
        />
        <button
          type="button"
          onClick={startAnimation}
          className="mt-6 rounded-full bg-[#f97316] px-10 py-3.5 text-[16px] font-bold text-white hover:bg-[#ea580c]"
        >
          🍊 Begin juicing
        </button>
      </div>
    );
  }

  const isAssembly = phase.startsWith("assembly");

  return (
    <div className="flex flex-col items-center w-full">
      {!isAssembly ? (
        <>
          <JuicerSVG
            state={juicerState}
            seedCount={seeds}
            pulpLevel={pulpScoops}
            className="w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]"
          />
          <p className="mt-4 text-[15px] font-semibold text-[#f97316] animate-pulse">
            {phase === "filling" && "Dropping in seeds & apple chunks…"}
            {phase === "blending" && "Blending your juice…"}
          </p>
        </>
      ) : (
        <>
          <h2 className="text-[20px] font-bold tracking-tight text-[#1d1d1f] mb-2">
            Filling your {containerTier}…
          </h2>
          <AssemblyLineSVG
            containerTier={containerTier}
            stage={assemblyStage}
            label={labelName}
            className="w-full max-w-[560px]"
          />
          <p className="mt-2 text-[13px] text-[#6e6e73] animate-pulse">
            {assemblyStage === "dispensing" && "Preparing the line…"}
            {assemblyStage === "filling" && "Juice is flowing…"}
          </p>
        </>
      )}
      {/* Progress bar */}
      <div className="mt-4 w-full max-w-[300px]">
        <div className="h-1.5 rounded-full bg-[#e5e5ea] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#f97316] transition-all duration-200"
            style={{ width: `${Math.min((elapsed / 14200) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type Step =
  | "lid"
  | "connect"
  | "seeds"
  | "container"
  | "pulp"
  | "label"
  | "cost"
  | "juicing"
  | "congrats";

const LABEL_PRESETS = [
  { id: "none", name: "No Label", preview: null },
  { id: "classic", name: "Classic Juice", preview: "🍊" },
  { id: "apple-core", name: "Apple Core", preview: "🍎" },
  { id: "golden", name: "Golden Press", preview: "✨" },
  { id: "skull", name: "Skull Juice", preview: "💀" },
  { id: "diamond", name: "Diamond", preview: "💎" },
] as const;

type LabelPreset = (typeof LABEL_PRESETS)[number];

function connectorLabel(c: Connector): string {
  if (c.name && c.name !== "Injected") return c.name;
  const labels: Record<string, string> = {
    injected: "Browser Wallet",
    walletConnect: "WalletConnect",
    coinbaseWalletSDK: "Coinbase Wallet",
  };
  return labels[c.type] ?? c.name ?? c.type;
}

function dedupeConnectors(connectors: readonly Connector[]): Connector[] {
  const seen = new Set<string>();
  return connectors.filter((c) => {
    const key = c.type === "injected" ? `injected:${c.name}` : c.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TEST_SEEDS = 1400;

export function JuiceAnnouncement() {
  const [step, setStep] = useState<Step>("lid");
  const [testMode, setTestMode] = useState(false);
  const [seedMap, setSeedMap] = useState<SeedMap>({});
  const [pulpScoops, setPulpScoops] = useState(0);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<LabelPreset>(LABEL_PRESETS[0]);
  const [juicerState, setJuicerState] = useState<JuicerState>("closed");
  const [fadeClass, setFadeClass] = useState("opacity-100");
  const [animSignal, setAnimSignal] = useState(0);

  const { address, isConnected } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { switchChain } = useSwitchChain();
  const connectors = useMemo(() => dedupeConnectors(rawConnectors), [rawConnectors]);

  const seeds = testMode
    ? TEST_SEEDS
    : address
      ? (seedMap[address.toLowerCase()] ?? 0)
      : 0;

  const container = bestContainer(seeds);
  const oz = seedsToOz(seeds);
  const pulp = seedPulp(seeds);
  const eligibleTiers = CONTAINER_TIERS.filter((t) => seeds >= t.seeds);
  const mintCostBite = selectedContainer
    ? (CONTAINER_TIERS.find((t) => t.name === selectedContainer)?.seeds ?? 0) * 100
    : 0;

  const fetchSeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { seedMap?: SeedMap | null };
      if (data.seedMap) setSeedMap(data.seedMap);
    } catch { /* best effort */ }
  }, []);

  useEffect(() => { void fetchSeeds(); }, [fetchSeeds]);

  useEffect(() => {
    if (step === "connect" && isConnected && !testMode) {
      setTimeout(() => transition("seeds"), 600);
    }
  }, [step, isConnected, testMode]);

  const transition = useCallback((to: Step) => {
    setFadeClass("opacity-0 scale-95");
    setTimeout(() => {
      setStep(to);
      setFadeClass("opacity-100 scale-100");
    }, 300);
  }, []);

  const handleOpenLid = () => {
    setJuicerState("open");
    setTimeout(() => transition("connect"), 800);
  };

  const handleTestMode = () => {
    setTestMode(true);
    transition("seeds");
  };

  const handleSeedsContinue = () => {
    if (seeds === 0) return;
    if (container) setSelectedContainer(container.name);
    transition("container");
  };

  const handleContainerSelect = (name: string) => {
    setSelectedContainer(name);
  };

  const handleContainerContinue = () => {
    if (!selectedContainer) return;
    transition("pulp");
  };

  const handlePulpContinue = () => {
    transition("label");
  };

  const handleLabelContinue = () => {
    transition("cost");
  };

  const handleStartJuicing = () => {
    setStep("juicing");
    setFadeClass("opacity-100 scale-100");
    setAnimSignal((s) => s + 1);
  };

  const handleAnimationComplete = useCallback(() => {
    setFadeClass("opacity-0 scale-95");
    setTimeout(() => {
      setStep("congrats");
      setFadeClass("opacity-100 scale-100");
    }, 400);
  }, []);

  const stepContent = () => {
    switch (step) {
      case "lid":
        return (
          <div className="flex flex-col items-center">
            <JuicerSVG
              state={juicerState}
              onTap={handleOpenLid}
              className="w-[320px] h-[320px] sm:w-[380px] sm:h-[380px] transition-transform hover:scale-[1.02]"
            />
            <p className="mt-4 text-[13px] text-[#6e6e73] animate-pulse">
              Tap the juicer to begin
            </p>
          </div>
        );

      case "connect":
        return (
          <div className="flex flex-col items-center">
            <JuicerSVG
              state="open"
              className="w-[220px] h-[220px] opacity-60"
            />
            <h2 className="mt-6 text-[26px] font-bold tracking-tight text-[#1d1d1f]">
              Ready to juice.
            </h2>
            <p className="mt-2 text-[15px] text-[#6e6e73] text-center max-w-[340px]">
              Connect your wallet to see your seed count from the $BITE game,
              or try test mode to explore.
            </p>
            <div className="mt-6 w-full max-w-[320px] space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={connecting}
                  onClick={() => connect({ connector })}
                  className="w-full rounded-2xl border border-[#d2d2d7] bg-white px-4 py-3 text-[14px] font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7] hover:border-[#f97316] disabled:opacity-50"
                >
                  {connecting ? "Connecting…" : connectorLabel(connector)}
                </button>
              ))}
              <button
                type="button"
                onClick={handleTestMode}
                className="w-full rounded-2xl border border-dashed border-[#d2d2d7] bg-[#fafafa] px-4 py-3 text-[14px] font-medium text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              >
                🧪 Test mode ({TEST_SEEDS.toLocaleString()} seeds)
              </button>
            </div>
          </div>
        );

      case "seeds":
        return (
          <div className="flex flex-col items-center">
            <div className="relative">
              <JuicerSVG
                state="open"
                seedCount={seeds}
                className="w-[200px] h-[200px] opacity-40"
              />
            </div>
            <div className="mt-4 rounded-[22px] border border-[#f97316]/20 bg-[#f97316]/5 px-8 py-6 text-center w-full max-w-[360px]">
              <p className="text-[11px] font-semibold tracking-[1.5px] text-[#f97316] uppercase">
                {testMode ? "Test mode" : "Your seeds"}
              </p>
              <p className="mt-2 text-[48px] font-black tabular-nums leading-none text-[#1d1d1f]">
                {seeds.toLocaleString()}
              </p>
              <p className="mt-2 text-[14px] text-[#6e6e73]">
                {oz > 0
                  ? `${oz} oz of juice · ${pulp} pulp`
                  : `${pulp} seed${pulp === 1 ? "" : "s"} toward first oz`}
              </p>
              {container && (
                <p className="mt-2 text-[15px] font-semibold text-[#f97316]">
                  {container.emoji} Eligible: {container.name}
                </p>
              )}
            </div>
            {seeds > 0 ? (
              <button
                type="button"
                onClick={handleSeedsContinue}
                className="mt-6 rounded-full bg-[#f97316] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#ea580c]"
              >
                Choose your container →
              </button>
            ) : (
              <p className="mt-6 text-[14px] text-[#6e6e73]">
                You need seeds from the $BITE game to continue.
              </p>
            )}
          </div>
        );

      case "container":
        return (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Pick your container.
            </h2>
            <p className="mt-2 text-[14px] text-[#6e6e73] text-center max-w-[360px]">
              Your {seeds.toLocaleString()} seeds qualify you for{" "}
              {eligibleTiers.length} container{eligibleTiers.length > 1 ? "s" : ""}.
              Bigger containers = more rev share.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 w-full max-w-[400px]">
              {CONTAINER_TIERS.slice().reverse().map((tier) => {
                const eligible = seeds >= tier.seeds;
                const isSelected = selectedContainer === tier.name;
                return (
                  <button
                    key={tier.name}
                    type="button"
                    disabled={!eligible}
                    onClick={() => handleContainerSelect(tier.name)}
                    className={[
                      "relative rounded-2xl border-2 p-4 transition-all",
                      isSelected
                        ? "border-[#f97316] bg-[#f97316]/5 shadow-lg shadow-[#f97316]/10"
                        : eligible
                          ? "border-[#d2d2d7] bg-white hover:border-[#f97316]/50"
                          : "border-[#e5e5ea] bg-[#f5f5f7] opacity-40 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <div className="h-[100px] flex items-center justify-center">
                      <ContainerForTier
                        tier={tier.name}
                        fillLevel={isSelected ? 0.3 : 0}
                        selected={isSelected}
                        className="h-full w-auto"
                      />
                    </div>
                    <p className={`mt-2 text-[13px] font-semibold ${isSelected ? "text-[#f97316]" : "text-[#1d1d1f]"}`}>
                      {tier.name}
                    </p>
                    <p className="text-[11px] text-[#6e6e73]">
                      {tier.oz}oz · {tier.seeds} seeds
                    </p>
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[#f97316] flex items-center justify-center">
                        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,8 7,12 13,4" />
                        </svg>
                      </div>
                    )}
                    {!eligible && (
                      <p className="mt-1 text-[10px] text-[#ff3b30]">
                        {tier.seeds - seeds} more seeds needed
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!selectedContainer}
              onClick={handleContainerContinue}
              className="mt-6 rounded-full bg-[#f97316] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add pulp →
            </button>
          </div>
        );

      case "pulp":
        return (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Add some pulp?
            </h2>
            <p className="mt-2 text-[14px] text-[#6e6e73] text-center max-w-[340px]">
              Pulp adds a little razzle dazzle to your juice. More pulp = more
              texture in your NFT.
            </p>
            <div className="mt-6 flex items-center gap-6">
              {/* Pulp preview */}
              <div className="relative h-[160px] w-[120px] flex items-center justify-center">
                <ContainerForTier
                  tier={selectedContainer ?? "Juice Box"}
                  fillLevel={0.4 + pulpScoops * 0.15}
                  selected
                  className="h-full w-auto"
                />
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPulpScoops(level)}
                    className={[
                      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium transition border-2",
                      pulpScoops === level
                        ? "border-[#f97316] bg-[#f97316]/5 text-[#f97316]"
                        : "border-[#e5e5ea] bg-white text-[#6e6e73] hover:border-[#f97316]/30",
                    ].join(" ")}
                  >
                    <span className="text-[18px]">
                      {level === 0 ? "🫗" : level === 1 ? "🟡" : level === 2 ? "🟡🟡" : "🟡🟡🟡"}
                    </span>
                    {level === 0 ? "No pulp (smooth)" : `${level} scoop${level > 1 ? "s" : ""}`}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handlePulpContinue}
              className="mt-6 rounded-full bg-[#f97316] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#ea580c]"
            >
              Choose label →
            </button>
          </div>
        );

      case "label":
        return (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Design your label.
            </h2>
            <p className="mt-2 text-[14px] text-[#6e6e73] text-center max-w-[360px]">
              Pick a label for your container. Collect credits from projects
              like Jack Butcher's to unlock special designs.
            </p>
            <div className="mt-6 flex items-start gap-6 w-full max-w-[420px]">
              {/* Label preview on container */}
              <div className="h-[180px] w-[130px] flex-shrink-0 flex items-center justify-center">
                <ContainerForTier
                  tier={selectedContainer ?? "Juice Box"}
                  fillLevel={0.5 + pulpScoops * 0.1}
                  label={selectedLabel.id !== "none" ? selectedLabel.name : undefined}
                  selected
                  className="h-full w-auto"
                />
              </div>
              {/* Label grid */}
              <div className="grid grid-cols-2 gap-2 flex-1">
                {LABEL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedLabel(preset)}
                    className={[
                      "rounded-xl px-3 py-3 text-center transition border-2",
                      selectedLabel.id === preset.id
                        ? "border-[#f97316] bg-[#f97316]/5"
                        : "border-[#e5e5ea] bg-white hover:border-[#f97316]/30",
                    ].join(" ")}
                  >
                    <span className="text-[24px]">{preset.preview ?? "∅"}</span>
                    <p className={`mt-1 text-[10px] font-medium ${selectedLabel.id === preset.id ? "text-[#f97316]" : "text-[#6e6e73]"}`}>
                      {preset.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[12px] text-[#6e6e73] text-center max-w-[340px]">
              NFT-gated labels coming soon — hold a Checks or Opepen to unlock
              exclusive designs.
            </p>
            <button
              type="button"
              onClick={handleLabelContinue}
              className="mt-5 rounded-full bg-[#f97316] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#ea580c]"
            >
              See cost →
            </button>
          </div>
        );

      case "cost":
        return (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Ready to squeeze.
            </h2>
            <p className="mt-2 text-[14px] text-[#6e6e73] text-center max-w-[360px]">
              Your seeds and $BITE go into the juicer. Out comes your container
              NFT filled with $JUICE on Base.
            </p>

            {/* Cost breakdown */}
            <div className="mt-6 w-full max-w-[380px] rounded-[22px] border border-[#d2d2d7] bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-[#f5f5f7]">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#6e6e73]">Container</span>
                  <span className="text-[14px] font-semibold text-[#1d1d1f]">
                    {CONTAINER_TIERS.find((t) => t.name === selectedContainer)?.emoji}{" "}
                    {selectedContainer}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 border-b border-[#f5f5f7]">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#6e6e73]">Seeds used</span>
                  <span className="text-[14px] font-semibold tabular-nums text-[#1d1d1f]">
                    {CONTAINER_TIERS.find((t) => t.name === selectedContainer)?.seeds.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 border-b border-[#f5f5f7]">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#6e6e73]">Pulp</span>
                  <span className="text-[14px] font-semibold text-[#1d1d1f]">
                    {pulpScoops === 0 ? "Smooth" : `${pulpScoops} scoop${pulpScoops > 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 border-b border-[#f5f5f7]">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#6e6e73]">Label</span>
                  <span className="text-[14px] font-semibold text-[#1d1d1f]">
                    {selectedLabel.preview ?? "∅"} {selectedLabel.name}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#f97316]/5">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-semibold text-[#f97316]">Mint cost</span>
                  <span className="text-[18px] font-bold tabular-nums text-[#f97316]">
                    {mintCostBite.toLocaleString()} $BITE
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#6e6e73]">
                  Seeds + $BITE bridge to $JUICE on Base
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartJuicing}
              className="mt-6 rounded-full bg-[#f97316] px-10 py-3.5 text-[16px] font-bold text-white transition hover:bg-[#ea580c] hover:scale-[1.02] active:scale-[0.98]"
            >
              🍊 Start juicing
            </button>
          </div>
        );

      case "juicing":
        return (
          <JuicingInline
            key={`anim-${animSignal}`}
            seeds={seeds}
            pulpScoops={pulpScoops}
            containerTier={selectedContainer ?? "Juice Box"}
            labelName={selectedLabel.id !== "none" ? selectedLabel.name : undefined}
            onComplete={handleAnimationComplete}
          />
        );

      case "congrats":
        return (
          <div className="flex flex-col items-center text-center">
            <div className="relative h-[180px] w-[140px] mb-4">
              <ContainerForTier
                tier={selectedContainer ?? "Juice Box"}
                fillLevel={0.9}
                label={selectedLabel.id !== "none" ? selectedLabel.name : undefined}
                selected
                className="h-full w-auto drop-shadow-lg"
              />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#34c759]/10 px-4 py-1.5 mb-4">
              <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#34c759]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,8 7,12 13,4" />
              </svg>
              <span className="text-[13px] font-semibold text-[#34c759]">
                Phase 2 complete
              </span>
            </div>
            <h2 className="text-[32px] font-black tracking-tight text-[#1d1d1f]">
              Congrats, you just juiced it.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73] max-w-[380px]">
              Your {selectedContainer} is filled with{" "}
              {pulpScoops > 0 ? `${pulpScoops}-scoop pulpy` : "smooth"} juice
              {selectedLabel.id !== "none" ? ` with a ${selectedLabel.name} label` : ""}.
              When the contracts go live on Base, you'll mint this as an NFT
              and start earning rev share from real-world juice brand sales.
            </p>

            <div className="mt-6 w-full max-w-[380px] rounded-[22px] border border-[#d2d2d7] bg-white px-6 py-5">
              <p className="text-[10px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
                What happens next
              </p>
              <ul className="mt-3 space-y-2 text-left text-[13px] text-[#6e6e73]">
                <li className="flex gap-2">
                  <span className="text-[#f97316]">●</span>
                  $JUICE token deploys on Base, paired with Coinbase AAPLc
                </li>
                <li className="flex gap-2">
                  <span className="text-[#f97316]">●</span>
                  NFT container contracts go live — mint your {selectedContainer}
                </li>
                <li className="flex gap-2">
                  <span className="text-[#f97316]">●</span>
                  Real-world juice brand sales start flowing into the revnet
                </li>
                <li className="flex gap-2">
                  <span className="text-[#f97316]">●</span>
                  Container holders earn rev share from every sale
                </li>
              </ul>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("lid");
                  setJuicerState("closed");
                  setPulpScoops(0);
                  setSelectedLabel(LABEL_PRESETS[0]);
                }}
                className="rounded-full border border-[#d2d2d7] bg-white px-6 py-2.5 text-[14px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                Start over
              </button>
              <a
                href="/"
                className="rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[14px] font-medium text-white hover:bg-black"
              >
                Back to bite.party
              </a>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col items-center justify-center px-4 py-12">
      {/* Step indicator */}
      {step !== "lid" && step !== "congrats" && (
        <div className="mb-8 flex items-center gap-1.5">
          {(["connect", "seeds", "container", "pulp", "label", "cost", "juicing"] as Step[]).map((s, i) => {
            const steps: Step[] = ["connect", "seeds", "container", "pulp", "label", "cost", "juicing"];
            const currentIdx = steps.indexOf(step);
            const thisIdx = i;
            return (
              <div
                key={s}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  thisIdx <= currentIdx ? "bg-[#f97316] w-6" : "bg-[#e5e5ea] w-3",
                ].join(" ")}
              />
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className={`transition-all duration-300 ease-out w-full flex flex-col items-center ${fadeClass}`}>
        {stepContent()}
      </div>

      {/* Powered by */}
      <p className="mt-12 text-[11px] text-[#d2d2d7]">
        powered by Juicebox V6 · Base
      </p>
    </div>
  );
}
