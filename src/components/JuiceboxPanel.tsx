"use client";

import { useCallback, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { baseChain } from "@/lib/chain";
import {
  JUICE_TOKEN,
  JB_MULTI_TERMINAL,
  REVNET_PROJECT_ID,
  KITCHEN_READY,
} from "@/lib/config";
import { jbMultiTerminalAbi, jbTokensAbi } from "@/lib/jb-abis";
import { erc20Abi } from "@/lib/abis";
import { copy } from "@/lib/copy";

const JB_NATIVE_TOKEN = "0x000000000000000000000000000000000000EEEe" as const;

type Tab = "pay" | "addBalance" | "cashOut";

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
  const result: Connector[] = [];
  for (const c of connectors) {
    const key = c.type === "injected" ? `injected:${c.name}` : c.type;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

export function JuiceboxPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("pay");
  const [amount, setAmount] = useState("0.01");
  const [memo, setMemo] = useState("");
  const [showWallets, setShowWallets] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const connectors = useMemo(() => dedupeConnectors(rawConnectors), [rawConnectors]);

  const onWrongChain = isConnected && chainId !== baseChain.id;

  const { data: ethBalance } = useBalance({
    address,
    chainId: baseChain.id,
    query: { enabled: Boolean(open && address) },
  });

  const { data: juiceBalance } = useReadContract({
    address: JUICE_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: baseChain.id,
    query: { enabled: Boolean(open && address && JUICE_TOKEN !== "0x0000000000000000000000000000000000000000") },
  });

  const {
    writeContract,
    data: hash,
    isPending: writing,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: baseChain.id,
  });

  const handlePay = useCallback(() => {
    if (!address || !KITCHEN_READY) return;
    setLocalError(null);
    setDone(false);
    try {
      const value = parseEther(amount || "0");
      if (value <= 0n) {
        setLocalError("Enter a valid amount.");
        return;
      }
      writeContract({
        address: JB_MULTI_TERMINAL,
        abi: jbMultiTerminalAbi,
        functionName: "pay",
        args: [
          REVNET_PROJECT_ID,
          JB_NATIVE_TOKEN,
          value,
          address,
          0n,
          memo || "Paid via juice.party",
          "0x",
        ],
        value,
        chainId: baseChain.id,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed");
    }
  }, [address, amount, memo, writeContract]);

  const handleAddToBalance = useCallback(() => {
    if (!address || !KITCHEN_READY) return;
    setLocalError(null);
    setDone(false);
    try {
      const value = parseEther(amount || "0");
      if (value <= 0n) {
        setLocalError("Enter a valid amount.");
        return;
      }
      writeContract({
        address: JB_MULTI_TERMINAL,
        abi: jbMultiTerminalAbi,
        functionName: "addToBalanceOf",
        args: [
          REVNET_PROJECT_ID,
          JB_NATIVE_TOKEN,
          value,
          false,
          memo || "Revenue deposit via juice.party",
          "0x",
        ],
        value,
        chainId: baseChain.id,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed");
    }
  }, [address, amount, memo, writeContract]);

  const handleCashOut = useCallback(() => {
    if (!address || !KITCHEN_READY) return;
    setLocalError(null);
    setDone(false);
    try {
      const tokenAmount = parseEther(amount || "0");
      if (tokenAmount <= 0n) {
        setLocalError("Enter a valid amount.");
        return;
      }
      writeContract({
        address: JB_MULTI_TERMINAL,
        abi: jbMultiTerminalAbi,
        functionName: "cashOutTokensOf",
        args: [
          address,
          REVNET_PROJECT_ID,
          tokenAmount,
          JB_NATIVE_TOKEN,
          0n,
          address,
          "0x",
        ],
        chainId: baseChain.id,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed");
    }
  }, [address, amount, writeContract]);

  if (!open) return null;

  const busy = writing || confirming;

  const tabs: { key: Tab; label: string }[] = [
    { key: "pay", label: copy.revnet.payCta },
    { key: "addBalance", label: "Add balance" },
    { key: "cashOut", label: copy.revnet.cashOutCta },
  ];

  const tabContent = {
    pay: {
      title: copy.revnet.payTitle,
      body: copy.revnet.payBody,
      cta: copy.revnet.payCta,
      action: handlePay,
      unit: "ETH",
      placeholder: "0.01",
    },
    addBalance: {
      title: copy.revnet.addBalanceTitle,
      body: copy.revnet.addBalanceBody,
      cta: copy.revnet.addBalanceCta,
      action: handleAddToBalance,
      unit: "ETH",
      placeholder: "0.01",
    },
    cashOut: {
      title: copy.revnet.cashOutTitle,
      body: copy.revnet.cashOutBody,
      cta: copy.revnet.cashOutCta,
      action: handleCashOut,
      unit: "$JUICE",
      placeholder: "1000",
    },
  };

  const current = tabContent[tab];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.revnet.headline}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[22px] border border-[#d2d2d7] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#d2d2d7] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[1.5px] text-[#f97316] uppercase">
              {copy.revnet.eyebrow}
            </p>
            <h2 className="mt-1 text-[17px] font-semibold text-[#1d1d1f]">
              {copy.revnet.headline}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#f97316]"
          >
            Close
          </button>
        </div>

        {!KITCHEN_READY ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[15px] text-[#6e6e73]">{copy.revnet.notDeployed}</p>
          </div>
        ) : (
          <>
            <div className="flex border-b border-[#d2d2d7]">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setDone(false);
                    setLocalError(null);
                    reset();
                  }}
                  className={[
                    "flex-1 py-3 text-[13px] font-medium transition",
                    tab === t.key
                      ? "border-b-2 border-[#f97316] text-[#f97316]"
                      : "text-[#6e6e73] hover:text-[#1d1d1f]",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  {current.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
                  {current.body}
                </p>
              </div>

              <label className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
                  <span>Amount</span>
                  <span>{current.unit}</span>
                </div>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setDone(false);
                  }}
                  placeholder={current.placeholder}
                  className="mt-1 w-full bg-transparent text-[28px] font-semibold tracking-[-0.03em] text-[#1d1d1f] outline-none"
                />
                {isConnected && tab !== "cashOut" && ethBalance && (
                  <p className="mt-1 text-[11px] text-[#6e6e73]">
                    Balance: {Number(formatEther(ethBalance.value)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
                  </p>
                )}
                {isConnected && tab === "cashOut" && juiceBalance !== undefined && (
                  <p className="mt-1 text-[11px] text-[#6e6e73]">
                    Balance: {Number(formatEther(juiceBalance as bigint)).toLocaleString()} $JUICE
                  </p>
                )}
              </label>

              {(tab === "pay" || tab === "addBalance") && (
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Memo (optional)"
                  className="rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#f97316]"
                />
              )}

              {localError && (
                <p className="text-center text-[13px] text-[#ff3b30]">{localError}</p>
              )}
              {writeError && (
                <p className="text-center text-[13px] text-[#ff3b30]">
                  {writeError.message?.slice(0, 160)}
                </p>
              )}
              {(isSuccess || done) && (
                <p className="text-center text-[13px] font-medium text-[#34c759]">
                  Transaction submitted.
                </p>
              )}

              {!isConnected ? (
                showWallets ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[13px] font-medium text-[#1d1d1f]">
                        Choose a wallet
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowWallets(false)}
                        className="rounded-full px-2 py-1 text-[13px] font-medium text-[#f97316]"
                      >
                        Back
                      </button>
                    </div>
                    {connectors.map((connector) => (
                      <button
                        key={connector.uid}
                        type="button"
                        disabled={connecting}
                        onClick={() => connect({ connector })}
                        className="w-full rounded-full bg-[#1d1d1f] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-black disabled:opacity-50"
                      >
                        {connecting ? "Connecting…" : connectorLabel(connector)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowWallets(true)}
                    className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black"
                  >
                    Connect wallet
                  </button>
                )
              ) : onWrongChain ? (
                <button
                  type="button"
                  onClick={() => switchChain({ chainId: baseChain.id })}
                  className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-black"
                >
                  Switch to Base
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || isSuccess}
                  onClick={current.action}
                  className="w-full rounded-full bg-[#f97316] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-40"
                >
                  {busy
                    ? confirming
                      ? "Confirming…"
                      : "Confirm in wallet…"
                    : current.cta}
                </button>
              )}

              {isConnected && (
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="text-center text-[12px] text-[#6e6e73]"
                >
                  Disconnect
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
