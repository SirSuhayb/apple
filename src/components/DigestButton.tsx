"use client";

import { useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import {
  useAccount,
  useConnect,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { appleKitchenAbi, erc20Abi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { AAPL_TOKEN, APPLE_KITCHEN, KITCHEN_READY } from "@/lib/config";
import { copy } from "@/lib/copy";
import {
  canCallDigest,
  formatSurplusAapl,
  kitchenSurplusWei,
} from "@/lib/kitchen-digest";

function connectorLabel(c: Connector): string {
  if (c.name && c.name !== "Injected") return c.name;
  if (c.type === "injected") return "Browser Wallet";
  if (c.type === "walletConnect") return "WalletConnect";
  if (c.type === "coinbaseWalletSDK") return "Coinbase Wallet";
  return c.name || c.type;
}

function hideInjectedOnThisDevice(): boolean {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent;
  const phone = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  );
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (phone || (coarse && window.innerWidth < 900)) return true;
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
  return !ethereum;
}

export function DigestButton() {
  const { isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { switchChain } = useSwitchChain();
  const [hideInjected, setHideInjected] = useState(true);
  const [showWallets, setShowWallets] = useState(false);
  const onWrongChain = isConnected && chainId !== robinhoodChain.id;

  useEffect(() => {
    setHideInjected(hideInjectedOnThisDevice());
  }, []);

  const { data } = useReadContracts({
    contracts: [
      {
        address: AAPL_TOKEN,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [APPLE_KITCHEN],
        chainId: robinhoodChain.id,
      },
      {
        address: APPLE_KITCHEN,
        abi: appleKitchenAbi,
        functionName: "prizePool",
        chainId: robinhoodChain.id,
      },
      {
        address: APPLE_KITCHEN,
        abi: appleKitchenAbi,
        functionName: "phase",
        chainId: robinhoodChain.id,
      },
    ],
    query: {
      enabled: KITCHEN_READY,
      refetchInterval: 15_000,
    },
  });

  const aaplBal = data?.[0]?.result;
  const prizePool = data?.[1]?.result;
  const phase = data?.[2]?.result;

  const surplus =
    aaplBal !== undefined && prizePool !== undefined
      ? kitchenSurplusWei(aaplBal, prizePool)
      : 0n;
  const racing = phase === undefined || Number(phase) === 0;
  const canDigest = canCallDigest(Number(phase ?? 0), surplus);

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: robinhoodChain.id,
  });

  const visibleConnectors = useMemo(() => {
    const seen = new Set<string>();
    const list: Connector[] = [];
    for (const c of connectors) {
      if (c.type === "injected" && hideInjected) continue;
      const key = c.type === "injected" ? `injected:${c.name}` : c.type;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(c);
    }
    return list;
  }, [connectors, hideInjected]);

  if (!KITCHEN_READY) return null;

  const runDigest = () => {
    reset();
    writeContract({
      address: APPLE_KITCHEN,
      abi: appleKitchenAbi,
      functionName: "digest",
      chainId: robinhoodChain.id,
    });
  };

  const busy = isPending || confirming;
  const status = !racing
    ? copy.digest.racingOnly
    : canDigest
      ? copy.digest.ready(formatSurplusAapl(surplus))
      : copy.digest.none;

  return (
    <div className="mt-3 rounded-[14px] border border-[#d2d2d7] bg-white px-4 py-3 text-left">
      <p className="text-[10px] font-semibold tracking-[1.2px] text-[#86868b] uppercase">
        {copy.digest.label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#86868b]">{status}</p>

      {showWallets && !isConnected ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-[#1d1d1f]">
              {copy.digest.chooseWallet}
            </p>
            <button
              type="button"
              onClick={() => setShowWallets(false)}
              className="text-[13px] font-medium text-[#2997ff]"
            >
              {copy.digest.back}
            </button>
          </div>
          {visibleConnectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              disabled={connecting}
              onClick={() => connect({ connector })}
              className="w-full rounded-full bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {connecting ? copy.digest.connecting : connectorLabel(connector)}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !canDigest}
          onClick={() => {
            if (!canDigest) return;
            if (!isConnected) {
              setShowWallets(true);
              return;
            }
            if (onWrongChain) {
              switchChain({ chainId: robinhoodChain.id });
              return;
            }
            runDigest();
          }}
          className="mt-3 w-full rounded-full bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
        >
          {canDigest && !isConnected
            ? copy.digest.connect
            : canDigest && onWrongChain
              ? copy.digest.switchNetwork
              : busy
                ? copy.digest.pending
                : copy.digest.cta}
        </button>
      )}

      {error && (
        <p className="mt-2 text-center text-[12px] text-[#ff3b30]">
          {error.message.slice(0, 160) || copy.digest.failed}
        </p>
      )}
      {isSuccess && (
        <p className="mt-2 text-center text-[12px] font-medium text-[#34c759]">
          {copy.digest.complete}
        </p>
      )}
    </div>
  );
}
