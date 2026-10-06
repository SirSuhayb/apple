"use client";

import { useMemo, useState } from "react";
import type { Connector } from "wagmi";
import {
  useAccount,
  useConnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { baseChain } from "@/lib/chain";
import { JUICE_NFT_CONTRACT } from "@/lib/config";
import { juiceContainerNftAbi } from "@/lib/jb-abis";
import { bestContainer, CONTAINER_TIERS, type ContainerTier } from "@/lib/seeds";
import { copy } from "@/lib/copy";

const NFT_READY =
  JUICE_NFT_CONTRACT !== "0x0000000000000000000000000000000000000000";

const TIER_IDS: Record<string, bigint> = {
  "Juice Box": 1n,
  Bottle: 2n,
  "Mason Jar": 3n,
  Growler: 4n,
};

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

export function ContainerNftMint({
  seeds,
  className = "",
}: {
  seeds: number;
  className?: string;
}) {
  const [showWallets, setShowWallets] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { switchChain } = useSwitchChain();

  const connectors = useMemo(() => dedupeConnectors(rawConnectors), [rawConnectors]);
  const onWrongChain = isConnected && chainId !== baseChain.id;

  const container = bestContainer(seeds);

  const {
    writeContract,
    data: hash,
    isPending: minting,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: baseChain.id,
  });

  const handleMint = () => {
    if (!address || !container || !NFT_READY) return;
    setLocalError(null);
    reset();

    const tierId = TIER_IDS[container.name];
    if (!tierId) {
      setLocalError("Unknown container tier.");
      return;
    }

    writeContract({
      address: JUICE_NFT_CONTRACT,
      abi: juiceContainerNftAbi,
      functionName: "mint",
      args: [address, tierId],
      chainId: baseChain.id,
    });
  };

  const busy = minting || confirming;

  return (
    <div className={`rounded-[22px] border border-[#f97316]/30 bg-[#f97316]/5 px-5 py-6 ${className}`}>
      <p className="text-[10px] font-semibold tracking-[1.5px] text-[#f97316] uppercase">
        {copy.nft.eyebrow}
      </p>
      <h3 className="mt-2 text-[20px] font-bold leading-tight text-[#1d1d1f]">
        {copy.nft.headline}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#6e6e73]">
        {copy.nft.body}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {CONTAINER_TIERS.slice()
          .reverse()
          .map((tier) => {
            const reached = seeds >= tier.seeds;
            const isBest = container?.name === tier.name;
            return (
              <div
                key={tier.name}
                className={[
                  "rounded-xl px-2 py-2 text-center text-[10px] transition",
                  isBest
                    ? "bg-[#f97316]/20 font-bold text-[#f97316] ring-2 ring-[#f97316]"
                    : reached
                      ? "bg-[#f97316]/10 font-semibold text-[#f97316]"
                      : "bg-[#f5f5f7] text-[#6e6e73]",
                ].join(" ")}
              >
                <span className="text-lg">{tier.emoji}</span>
                <br />
                {tier.name}
                <br />
                <span className="text-[9px]">{tier.oz}oz</span>
              </div>
            );
          })}
      </div>

      <div className="mt-5">
        {!NFT_READY ? (
          <p className="text-center text-[13px] text-[#6e6e73]">
            {copy.nft.notDeployed}
          </p>
        ) : !container ? (
          <p className="text-center text-[13px] text-[#6e6e73]">
            {copy.nft.notEligible}
          </p>
        ) : isSuccess ? (
          <p className="text-center text-[13px] font-medium text-[#34c759]">
            {copy.nft.minted} {container.emoji} {container.name}
          </p>
        ) : !isConnected ? (
          showWallets ? (
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={connecting}
                  onClick={() => connect({ connector })}
                  className="w-full rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                >
                  {connecting ? "Connecting…" : connectorLabel(connector)}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowWallets(true)}
              className="w-full rounded-full bg-[#f97316] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#ea580c]"
            >
              Connect to mint {container.emoji}
            </button>
          )
        ) : onWrongChain ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: baseChain.id })}
            className="w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-[15px] font-semibold text-white hover:bg-black"
          >
            Switch to Base
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={handleMint}
            className="w-full rounded-full bg-[#f97316] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-40"
          >
            {busy
              ? confirming
                ? copy.nft.minting
                : "Confirm in wallet…"
              : `${copy.nft.mintCta} · ${container.emoji} ${container.name}`}
          </button>
        )}

        {(localError || writeError) && (
          <p className="mt-2 text-center text-[12px] text-[#ff3b30]">
            {(localError ?? writeError?.message ?? "").slice(0, 160)}
          </p>
        )}
      </div>
    </div>
  );
}
