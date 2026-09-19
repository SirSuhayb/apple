"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { metaWagerAbi, erc20Abi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { META_WAGER, BITE_TOKEN } from "@/lib/config";
import { copy } from "@/lib/copy";
import { META_WAGER_THRESHOLD } from "@/lib/phase";

function fmtBite(raw: bigint): string {
  const n = Number(formatEther(raw));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 10) return `${n.toFixed(0)}`;
  return `${n.toFixed(2)}`;
}

export function MetaWagerInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#d2d2d7] text-[11px] font-bold text-[#86868b]"
        aria-label="About the meta wager"
      >
        ?
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-5"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-[#fbfbfd] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[19px] font-bold text-[#1d1d1f]">
                {copy.metaWager.infoTitle}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f7] text-base text-[#86868b]"
              >
                ×
              </button>
            </div>
            <p className="text-[15px] leading-relaxed text-[#86868b]">
              {copy.metaWager.infoBody}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export function MetaWagerEmpty({ progress }: { progress: number }) {
  const ofThreshold = Math.min(
    100,
    (progress / META_WAGER_THRESHOLD) * 100,
  );
  const pctLabel = (progress * 100).toFixed(1);

  return (
    <div className="rounded-[18px] border-[1.5px] border-dashed border-[#d2d2d7] bg-[#f5f5f7] px-5 py-7 text-center">
      <div className="mb-2 text-[32px] leading-none">🍎 ⚔️ 🪱</div>
      <div className="mb-1.5 text-[17px] font-bold text-[#1d1d1f]">
        {copy.metaWager.emptyTitle}
      </div>
      <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-[#86868b]">
        {copy.metaWager.emptyBody}
      </p>
      <div className="mt-4 inline-block rounded-full bg-[#d2d2d7] px-4 py-1.5 text-xs font-semibold text-[#86868b]">
        {copy.metaWager.opensAt}
      </div>
      <div className="mt-3.5">
        <div className="mx-auto h-1.5 max-w-[200px] overflow-hidden rounded bg-[#d2d2d7]">
          <div
            className="h-full rounded bg-[#86868b]/50"
            style={{ width: `${ofThreshold}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-[#d2d2d7]">
          {copy.metaWager.thresholdProgress(pctLabel)}
        </div>
      </div>
    </div>
  );
}

/** Live odds UI — connected to the MetaWager contract */
export function MetaWagerLive() {
  const wagerReady = Boolean(META_WAGER && BITE_TOKEN);

  // ── Contract reads ──
  const { data: contractData, refetch } = useReadContracts({
    contracts: META_WAGER
      ? [
          {
            address: META_WAGER,
            abi: metaWagerAbi,
            functionName: "totalCore",
            chainId: robinhoodChain.id,
          },
          {
            address: META_WAGER,
            abi: metaWagerAbi,
            functionName: "totalRot",
            chainId: robinhoodChain.id,
          },
          {
            address: META_WAGER,
            abi: metaWagerAbi,
            functionName: "resolved",
            chainId: robinhoodChain.id,
          },
          {
            address: META_WAGER,
            abi: metaWagerAbi,
            functionName: "winningSide",
            chainId: robinhoodChain.id,
          },
        ]
      : [],
    query: { enabled: wagerReady, refetchInterval: 12_000 },
  });

  const totalCore =
    contractData?.[0]?.status === "success"
      ? (contractData[0].result as bigint)
      : BigInt(0);
  const totalRot =
    contractData?.[1]?.status === "success"
      ? (contractData[1].result as bigint)
      : BigInt(0);
  const isResolved =
    contractData?.[2]?.status === "success"
      ? (contractData[2].result as boolean)
      : false;
  const winningSide =
    contractData?.[3]?.status === "success"
      ? Number(contractData[3].result)
      : 0;

  const totalStaked = totalCore + totalRot;
  const corePct =
    totalStaked > BigInt(0)
      ? Number((totalCore * BigInt(10000)) / totalStaked) / 100
      : 50;
  const rotPct = 100 - corePct;

  // ── Wallet ──
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const onWrongChain = isConnected && chainId !== robinhoodChain.id;

  // ── User bet data ──
  const { data: userBet } = useReadContract({
    address: META_WAGER!,
    abi: metaWagerAbi,
    functionName: "bets",
    args: address ? [address] : undefined,
    chainId: robinhoodChain.id,
    query: { enabled: wagerReady && !!address, refetchInterval: 12_000 },
  });
  const userCore = userBet ? (userBet as [bigint, bigint, boolean])[0] : BigInt(0);
  const userRot = userBet ? (userBet as [bigint, bigint, boolean])[1] : BigInt(0);
  const userClaimed = userBet ? (userBet as [bigint, bigint, boolean])[2] : false;

  // ── Betting state ──
  const [betAmount, setBetAmount] = useState("10000");
  const [betSide, setBetSide] = useState<"core" | "rot" | null>(null);
  const [step, setStep] = useState<"idle" | "approving" | "betting" | "claiming">("idle");

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      if (step === "approving" && betSide) {
        setStep("betting");
        const amount = parseEther(betAmount || "0");
        writeContract({
          address: META_WAGER!,
          abi: metaWagerAbi,
          functionName: betSide === "core" ? "betCore" : "betRot",
          args: [amount],
          chainId: robinhoodChain.id,
        });
      } else {
        setStep("idle");
        setBetSide(null);
        void refetch();
      }
    }
  }, [isSuccess]);

  const startBet = (side: "core" | "rot") => {
    if (!META_WAGER || !BITE_TOKEN || !address) return;
    const amount = parseEther(betAmount || "0");
    if (amount <= BigInt(0)) return;
    reset();
    setBetSide(side);
    setStep("approving");
    writeContract({
      address: BITE_TOKEN,
      abi: erc20Abi,
      functionName: "approve",
      args: [META_WAGER, amount],
      chainId: robinhoodChain.id,
    });
  };

  const doClaim = () => {
    if (!META_WAGER) return;
    reset();
    setStep("claiming");
    writeContract({
      address: META_WAGER,
      abi: metaWagerAbi,
      functionName: "claim",
      chainId: robinhoodChain.id,
    });
  };

  const busy = isPending || confirming;

  // Winner label
  const winnerLabel =
    winningSide === 1 ? "🍎 CORE" : winningSide === 2 ? "🪱 ROT" : "";

  return (
    <div className="rounded-[18px] border border-[#d2d2d7] bg-white px-5 py-[22px]">
      {/* Odds bar */}
      <div className="mb-2.5 flex justify-between">
        <span className="text-[15px] font-bold text-[#34c759]">
          🍎 CORE {corePct.toFixed(1)}%
        </span>
        <span className="text-[15px] font-bold text-[#86868b]">
          ROT {rotPct.toFixed(1)}% 🪱
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-[5px] bg-[#f5f5f7]">
        <div
          className="bg-[#34c759] transition-[width] duration-500"
          style={{ width: `${corePct}%` }}
        />
        <div
          className="bg-[#d4a04a] transition-[width] duration-500"
          style={{ width: `${rotPct}%` }}
        />
      </div>

      {/* Staked totals */}
      <div className="mt-2 flex justify-between text-[11px] text-[#86868b]">
        <span>{fmtBite(totalCore)} $BITE on Core</span>
        <span>{fmtBite(totalRot)} $BITE on Rot</span>
      </div>

      {/* Resolved state */}
      {isResolved && (
        <div className="mt-3 rounded-[10px] bg-[#f5f5f7] p-3 text-center">
          <p className="text-sm font-bold text-[#1d1d1f]">
            Resolved — {winnerLabel} wins
          </p>
          {address && (userCore > BigInt(0) || userRot > BigInt(0)) && !userClaimed && (
            <button
              type="button"
              onClick={doClaim}
              disabled={busy}
              className="mt-2 rounded-[10px] bg-[#1d1d1f] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Claiming…" : "Claim winnings"}
            </button>
          )}
          {userClaimed && (
            <p className="mt-1 text-xs text-[#34c759]">✓ Claimed</p>
          )}
        </div>
      )}

      {/* Active betting */}
      {!isResolved && (
        <>
          <p className="mt-2.5 text-center text-xs leading-relaxed text-[#86868b]">
            {copy.metaWager.liveLead}
            <br />
            <span className="font-semibold text-[#1d1d1f]">
              {copy.metaWager.liveCta}
            </span>
          </p>

          {!isConnected ? (
            <div className="mt-3.5 space-y-2">
              {connectors
                .filter((c) => {
                  if (
                    c.type === "injected" &&
                    typeof window !== "undefined" &&
                    !(window as unknown as Record<string, unknown>).ethereum
                  )
                    return false;
                  return true;
                })
                .map((connector) => (
                  <button
                    key={connector.uid}
                    type="button"
                    disabled={connecting}
                    onClick={() => connect({ connector })}
                    className="w-full rounded-[10px] bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {connecting ? "Connecting…" : `Connect ${connector.name}`}
                  </button>
                ))}
            </div>
          ) : (
            <>
              {onWrongChain && (
                <button
                  type="button"
                  onClick={() => switchChain({ chainId: robinhoodChain.id })}
                  className="mt-3 w-full rounded-[10px] border border-[#e53935]/40 bg-[#e53935]/10 px-4 py-2 text-[13px] font-medium text-[#e53935]"
                >
                  Switch to Robinhood Chain
                </button>
              )}

              {/* Amount input */}
              <div className="mt-3 flex gap-2">
                <input
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="$BITE amount"
                  className="min-w-0 flex-1 rounded-[10px] border border-[#d2d2d7] bg-white px-3 py-2 font-mono text-[13px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                />
              </div>

              {/* Quick presets */}
              <div className="mt-2 flex gap-1.5">
                {["1000", "5000", "10000", "50000"].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBetAmount(amt)}
                    className={`flex-1 rounded-[8px] border px-2 py-1.5 text-[11px] font-medium transition ${
                      betAmount === amt
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                        : "border-[#d2d2d7] text-[#86868b] hover:border-[#1d1d1f]"
                    }`}
                  >
                    {Number(amt).toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Bet buttons */}
              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  disabled={busy || !wagerReady}
                  onClick={() => startBet("core")}
                  className="flex-1 rounded-[10px] border-[1.5px] border-[#34c759] bg-[#34c759]/15 py-2.5 text-sm font-bold text-[#34c759] transition hover:bg-[#34c759]/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && betSide === "core"
                    ? step === "approving"
                      ? "Approving…"
                      : "Betting…"
                    : copy.metaWager.betCore}
                </button>
                <button
                  type="button"
                  disabled={busy || !wagerReady}
                  onClick={() => startBet("rot")}
                  className="flex-1 rounded-[10px] border-[1.5px] border-[#d4a04a] bg-[#d4a04a]/15 py-2.5 text-sm font-bold text-[#d4a04a] transition hover:bg-[#d4a04a]/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && betSide === "rot"
                    ? step === "approving"
                      ? "Approving…"
                      : "Betting…"
                    : copy.metaWager.betRot}
                </button>
              </div>

              {/* User position */}
              {(userCore > BigInt(0) || userRot > BigInt(0)) && (
                <div className="mt-2.5 rounded-[10px] bg-[#f5f5f7] px-3 py-2 text-[11px] text-[#86868b]">
                  Your bets:{" "}
                  {userCore > BigInt(0) && (
                    <span className="font-semibold text-[#34c759]">
                      {fmtBite(userCore)} on Core
                    </span>
                  )}
                  {userCore > BigInt(0) && userRot > BigInt(0) && " · "}
                  {userRot > BigInt(0) && (
                    <span className="font-semibold text-[#d4a04a]">
                      {fmtBite(userRot)} on Rot
                    </span>
                  )}
                </div>
              )}

              {/* Wallet footer */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#86868b]">
                <span className="font-mono">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="text-[#0066cc] hover:text-[#0077ed]"
                >
                  Disconnect
                </button>
              </div>
            </>
          )}

          {/* Error display */}
          {error && (
            <p className="mt-2 text-center text-[11px] text-[#bf4800]">
              {error.message.slice(0, 140)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
