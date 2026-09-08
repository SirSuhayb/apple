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

/** Inline approve+bite panel (prefer BiteModal for the product CTA flow). */
export function BitePanel({
  onBiteSubmitted,
}: {
  onBiteSubmitted?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const [custom, setCustom] = useState("1000");
  const [amount, setAmount] = useState<bigint>(parseEther("1000"));

  const kitchenReady = KITCHEN_READY;

  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) onBiteSubmitted?.();
  }, [isSuccess, onBiteSubmitted]);

  const approveAndBite = async (value: bigint) => {
    if (!APPLE_KITCHEN || !BITE_TOKEN || !address) return;
    setAmount(value);
    writeContract({
      address: BITE_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [APPLE_KITCHEN, value],
    });
  };

  const bite = () => {
    if (!APPLE_KITCHEN) return;
    writeContract({
      address: APPLE_KITCHEN,
      abi: appleKitchenAbi,
      functionName: "bite",
      args: [amount],
    });
  };

  const amountLabel = (() => {
    try {
      return Number(formatEther(amount)).toLocaleString();
    } catch {
      return custom;
    }
  })();

  return (
    <div className="space-y-5">
      {!isConnected ? (
        <button
          type="button"
          disabled={connecting}
          onClick={() => connect({ connector: connectors[0] })}
          className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#000000] disabled:opacity-50"
        >
          {connecting ? copy.tap.connecting : copy.tap.connect}
        </button>
      ) : (
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

          <div className="grid grid-cols-3 gap-2">
            {copy.tap.presets.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={!kitchenReady || isPending}
                onClick={() => void approveAndBite(parseEther(p.amount))}
                className="rounded-full border border-[#d2d2d7] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition hover:border-[#1d1d1f] disabled:opacity-40"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={copy.tap.amountPlaceholder}
              className="min-w-0 flex-1 rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 font-mono text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
            />
            <button
              type="button"
              disabled={!kitchenReady || isPending}
              onClick={() => {
                try {
                  void approveAndBite(parseEther(custom || "0"));
                } catch {
                  /* ignore parse */
                }
              }}
              className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium transition hover:border-[#1d1d1f] disabled:opacity-40"
            >
              {copy.tap.approve}
            </button>
          </div>

          <button
            type="button"
            disabled={!kitchenReady || isPending || confirming}
            onClick={bite}
            className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition hover:bg-[#000000] disabled:opacity-40"
          >
            {!kitchenReady
              ? copy.tap.kitchenMissing
              : isPending || confirming
                ? copy.tap.burning
                : copy.tap.burn(amountLabel)}
          </button>

          {error && (
            <p className="text-center text-[12px] text-[#bf4800]">
              {error.message.slice(0, 160)}
            </p>
          )}
          {isSuccess && (
            <p className="text-center text-[12px] text-[#6e6e73]">
              {copy.tap.confirm(amountLabel)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
