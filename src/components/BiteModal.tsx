"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { Connector } from "wagmi";
import { formatEther, parseEther } from "viem";
import { appleKitchenAbi, erc20Abi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { APPLE_KITCHEN, BITE_TOKEN, KITCHEN_READY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { progressToFrame, scoreTap, type Eater } from "@/lib/race";
import { rankAfterExtraScore } from "@/lib/leaderboard-rank";
import { sharePageUrl } from "@/lib/share";
import { ShareActions } from "./ShareActions";

type Step = "connect" | "amount" | "burning" | "complete";

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

export type BiteResult = {
  amountLabel: string;
  points: number;
  progress: number;
  appleFrame: number;
  demo: boolean;
};

type BiteModalProps = {
  open: boolean;
  onClose: () => void;
  currentProgress: number;
  onBiteComplete: (result: BiteResult) => void;
  /** Pre-fill amount from URL deep link (e.g. #burn?amount=1000) */
  prefillAmount?: string | null;
  eaters?: Eater[];
  earlyEater?: boolean;
};

export function BiteModal({
  open,
  onClose,
  currentProgress,
  onBiteComplete,
  prefillAmount,
  eaters = [],
  earlyEater = false,
}: BiteModalProps) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const connectors = useMemo(() => dedupeConnectors(rawConnectors), [rawConnectors]);
  const [custom, setCustom] = useState("1000");
  const [amount, setAmount] = useState<bigint>(parseEther("1000"));
  const [step, setStep] = useState<Step>("connect");
  const [phase, setPhase] = useState<"approve" | "bite">("approve");
  const [result, setResult] = useState<BiteResult | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const onWrongChain = isConnected && chainId !== robinhoodChain.id;

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setResult(null);
    setPhase("approve");
    setDemoBusy(false);
    reset();
    setStep(isConnected ? "amount" : "connect");

    // Apply prefilled amount from URL deep link
    if (prefillAmount) {
      try {
        setCustom(prefillAmount);
        setAmount(parseEther(prefillAmount));
      } catch {
        // ignore invalid values
      }
    }
  }, [open, isConnected, reset, prefillAmount]);

  useEffect(() => {
    if (!open || !isSuccess || !hash) return;

    if (phase === "approve" && APPLE_KITCHEN) {
      setPhase("bite");
      writeContract({
        address: APPLE_KITCHEN,
        abi: appleKitchenAbi,
        functionName: "bite",
        args: [amount],
        chainId: robinhoodChain.id,
      });
      return;
    }

    if (phase === "bite") {
      finishBite(amount, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish once per success hash
  }, [isSuccess, hash]);

  const amountLabel = (() => {
    try {
      return Number(formatEther(amount)).toLocaleString();
    } catch {
      return custom;
    }
  })();

  function finishBite(value: bigint, demo: boolean) {
    const eth = Number(formatEther(value));
    const points = scoreTap(eth, earlyEater);
    const bump = Math.min(0.08, Math.max(0.01, eth / 50_000));
    const progress = Math.min(1, currentProgress + bump);
    const payload: BiteResult = {
      amountLabel: Number.isFinite(eth) ? eth.toLocaleString() : custom,
      points,
      progress,
      appleFrame: progressToFrame(progress),
      demo,
    };
    setResult(payload);
    setStep("complete");
    setDemoBusy(false);
    onBiteComplete(payload);
  }

  const startApproveAndBite = (value: bigint) => {
    setLocalError(null);
    setAmount(value);
    if (!KITCHEN_READY || !APPLE_KITCHEN || !BITE_TOKEN || !address) {
      setLocalError(copy.tap.kitchenMissing);
      return;
    }
    setStep("burning");
    setPhase("approve");
    writeContract({
      address: BITE_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [APPLE_KITCHEN, value],
      chainId: robinhoodChain.id,
    });
  };

  const simulateBurn = (value: bigint) => {
    setLocalError(null);
    setAmount(value);
    setStep("burning");
    setDemoBusy(true);
    window.setTimeout(() => {
      finishBite(value, true);
    }, 900);
  };

  const parseCustom = (): bigint | null => {
    try {
      return parseEther(custom || "0");
    } catch {
      return null;
    }
  };

  if (!open) return null;

  const busy = isPending || confirming || demoBusy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={copy.tap.cta}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium tracking-[0.14em] text-[#86868b] uppercase">
              {copy.tap.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">
              {step === "complete"
                ? copy.tap.modal.completeTitle
                : copy.tap.cta}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-medium text-[#0066cc] hover:text-[#0077ed]"
          >
            {copy.tap.modal.close}
          </button>
        </div>

        {step === "connect" && (
          <div className="mt-6 space-y-4">
            <p className="text-[15px] leading-relaxed text-[#6e6e73]">
              {copy.tap.modal.stepConnect}
            </p>
            <div className="space-y-2">
              {connectors
                .filter((c) => {
                  if (c.type === "injected" && typeof window !== "undefined" && !(window as unknown as Record<string, unknown>).ethereum) return false;
                  return true;
                })
                .map((connector) => {
                const isWC = connector.type === "walletConnect";
                return (
                  <button
                    key={connector.uid}
                    type="button"
                    disabled={connecting}
                    onClick={() => connect({ connector })}
                    className={[
                      "w-full rounded-full px-6 py-3 text-[15px] font-medium transition disabled:opacity-50",
                      isWC
                        ? "border border-[#2997ff] bg-white text-[#2997ff] hover:bg-[#2997ff]/5"
                        : "bg-[#1d1d1f] text-white hover:bg-[#000000]",
                    ].join(" ")}
                  >
                    {connecting
                      ? copy.tap.connecting
                      : connectorLabel(connector)}
                  </button>
                );
              })}
            </div>
            {!KITCHEN_READY && (
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="w-full text-[13px] font-medium text-[#0066cc] hover:text-[#0077ed]"
              >
                {copy.tap.demoBurn}
              </button>
            )}
          </div>
        )}

        {step === "amount" && (
          <div className="mt-6 space-y-5">
            <p className="text-[15px] leading-relaxed text-[#6e6e73]">
              {copy.tap.modal.stepAmount}
            </p>

            {isConnected ? (
              <>
                <div className="flex items-center justify-between text-[13px] text-[#6e6e73]">
                  <span className="font-mono">
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="text-[#0066cc] hover:text-[#0077ed]"
                  >
                    {copy.tap.disconnect}
                  </button>
                </div>
                {onWrongChain && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          switchChain({ chainId: robinhoodChain.id });
                        } catch {
                          setLocalError(
                            `Switch to Robinhood Chain (${robinhoodChain.id}) in your wallet — RPC: ${robinhoodChain.rpcUrls.default.http[0]}`,
                          );
                        }
                      }}
                      className="w-full rounded-full border border-[#e53935]/40 bg-[#e53935]/10 px-4 py-2.5 text-[13px] font-medium text-[#e53935] transition hover:bg-[#e53935]/20"
                    >
                      Switch to Robinhood Chain
                    </button>
                    <p className="text-[11px] text-[#86868b]">
                      Chain ID: {robinhoodChain.id} · RPC:{" "}
                      {robinhoodChain.rpcUrls.default.http[0]}
                    </p>
                  </div>
                )}
              </>
            ) : (
              !KITCHEN_READY && (
                <p className="text-[12px] text-[#86868b]">
                  {copy.tap.modal.demoNote}
                </p>
              )
            )}

            <div className="grid grid-cols-3 gap-2">
              {copy.tap.presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const value = parseEther(p.amount);
                    setCustom(p.amount);
                    setAmount(value);
                  }}
                  className="rounded-full border border-[#d2d2d7] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition hover:border-[#1d1d1f] disabled:opacity-40"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <input
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                try {
                  setAmount(parseEther(e.target.value || "0"));
                } catch {
                  /* ignore */
                }
              }}
              placeholder={copy.tap.amountPlaceholder}
              className="w-full rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 font-mono text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
            />

            {KITCHEN_READY ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const value = parseCustom();
                  if (value == null) return;
                  startApproveAndBite(value);
                }}
                className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#000000] disabled:opacity-40"
              >
                {copy.tap.burn(amountLabel)}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const value = parseCustom();
                  if (value == null) return;
                  simulateBurn(value);
                }}
                className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#000000] disabled:opacity-40"
              >
                {copy.tap.demoBurn}
              </button>
            )}
          </div>
        )}

        {step === "burning" && (
          <div className="mt-8 space-y-3 text-center">
            <p className="text-[17px] font-medium text-[#1d1d1f]">
              {copy.tap.modal.stepBurning}
            </p>
            <p className="text-[13px] text-[#86868b]">
              {KITCHEN_READY
                ? phase === "approve"
                  ? copy.tap.approve
                  : copy.tap.burning
                : copy.tap.modal.demoNote}
            </p>
          </div>
        )}

        {step === "complete" && result && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-[15px] text-[#6e6e73]">
              {copy.tap.confirm(result.amountLabel)}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {copy.tap.modal.completePoints(
                result.points.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
              )}
            </p>
            <p className="text-[15px] text-[#6e6e73]">
              {copy.tap.modal.completeProgress(
                (result.progress * 100).toFixed(1),
              )}
            </p>
            {result.demo && (
              <p className="text-[12px] text-[#86868b]">
                {copy.tap.modal.demoNote}
              </p>
            )}
            <ShareActions
              className="mt-2 text-left"
              text={copy.share.burn(
                result.amountLabel,
                rankAfterExtraScore(eaters, address, result.points) ?? undefined,
              )}
              url={sharePageUrl({
                burn: result.amountLabel.replace(/,/g, ""),
                rank: rankAfterExtraScore(eaters, address, result.points),
                you: address,
              })}
            />
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#000000]"
            >
              {copy.tap.modal.done}
            </button>
          </div>
        )}

        {(error || localError) && step !== "complete" && (
          <p className="mt-4 text-center text-[12px] text-[#bf4800]">
            {(localError ?? error?.message ?? "").slice(0, 160)}
          </p>
        )}
      </div>
    </div>
  );
}
