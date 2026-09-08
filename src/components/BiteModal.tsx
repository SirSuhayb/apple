"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { appleKitchenAbi, erc20Abi } from "@/lib/abis";
import { APPLE_KITCHEN, BITE_TOKEN, KITCHEN_READY } from "@/lib/config";
import { copy } from "@/lib/copy";
import { progressToFrame, scoreTap } from "@/lib/race";

type Step = "connect" | "amount" | "burning" | "complete";

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
};

export function BiteModal({
  open,
  onClose,
  currentProgress,
  onBiteComplete,
}: BiteModalProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const [custom, setCustom] = useState("1000");
  const [amount, setAmount] = useState<bigint>(parseEther("1000"));
  const [step, setStep] = useState<Step>("connect");
  const [phase, setPhase] = useState<"approve" | "bite">("approve");
  const [result, setResult] = useState<BiteResult | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
  }, [open, isConnected, reset]);

  useEffect(() => {
    if (!open || !isSuccess || !hash) return;

    if (phase === "approve" && APPLE_KITCHEN) {
      setPhase("bite");
      writeContract({
        address: APPLE_KITCHEN,
        abi: appleKitchenAbi,
        functionName: "bite",
        args: [amount],
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
    const points = Math.round(scoreTap(eth));
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
            <button
              type="button"
              disabled={connecting}
              onClick={() => connect({ connector: connectors[0] })}
              className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#000000] disabled:opacity-50"
            >
              {connecting ? copy.tap.connecting : copy.tap.connect}
            </button>
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
              {copy.tap.modal.completePoints(result.points.toLocaleString())}
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
