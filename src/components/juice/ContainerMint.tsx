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
import {
  baseChain,
  JUICE_NFT_CONTRACT,
  NFT_READY,
} from "@/lib/juice-config";
import { juiceContainerNftAbi } from "@/lib/jb-abis";
import { bestContainer, CONTAINER_TIERS, seedsToOz, seedPulp } from "@/lib/seeds";

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

export function ContainerMint({ seeds }: { seeds: number }) {
  const [showWallets, setShowWallets] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { switchChain } = useSwitchChain();
  const connectors = useMemo(() => dedupeConnectors(rawConnectors), [rawConnectors]);
  const onWrongChain = isConnected && chainId !== baseChain.id;

  const container = bestContainer(seeds);
  const oz = seedsToOz(seeds);
  const pulp = seedPulp(seeds);

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
    if (!tierId) { setLocalError("Unknown container tier."); return; }
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
    <div className="rounded-[22px] border border-[#f97316]/30 bg-[#f97316]/5 px-6 py-7">
      <p className="text-[10px] font-semibold tracking-[1.5px] text-[#f97316] uppercase">
        Pour your juice
      </p>
      <h3 className="mt-2 text-[22px] font-bold leading-tight text-[#1d1d1f]">
        Fill your container.
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6e6e73]">
        Your seeds from the $BITE game fill containers of juice. Mint your
        container NFT on Base — it proves your history and earns you rev share
        from real-world juice brand sales.
      </p>

      {/* Seed count */}
      <div className="mt-5 flex items-center justify-between rounded-[14px] bg-white/80 px-4 py-3 border border-[#f97316]/15">
        <div>
          <p className="text-[11px] font-semibold tracking-[1px] text-[#f97316] uppercase">
            Your seeds
          </p>
          <p className="mt-0.5 text-[28px] font-black tabular-nums leading-none text-[#1d1d1f]">
            {seeds.toLocaleString()}
          </p>
          <p className="mt-1 text-[12px] text-[#6e6e73]">
            {oz > 0
              ? `${oz} oz · ${pulp} pulp`
              : `${pulp} seed${pulp === 1 ? "" : "s"} toward first oz`}
          </p>
        </div>
        <span className="text-[44px]">{container?.emoji ?? "🌱"}</span>
      </div>

      {/* Tier grid */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {CONTAINER_TIERS.slice().reverse().map((tier) => {
          const reached = seeds >= tier.seeds;
          const isBest = container?.name === tier.name;
          return (
            <div
              key={tier.name}
              className={[
                "rounded-xl px-2 py-2.5 text-center text-[10px] transition",
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
              <span className="text-[9px]">{tier.oz}oz · {tier.seeds} seeds</span>
            </div>
          );
        })}
      </div>

      {/* Mint CTA */}
      <div className="mt-5">
        {!NFT_READY ? (
          <p className="text-center text-[13px] text-[#6e6e73]">
            Container NFTs coming soon. Deploy the contract and set
            NEXT_PUBLIC_JUICE_NFT_CONTRACT.
          </p>
        ) : !container ? (
          <p className="text-center text-[13px] text-[#6e6e73]">
            Earn more seeds to unlock a container. Every trade and burn from
            $BITE counts.
          </p>
        ) : isSuccess ? (
          <div className="rounded-[14px] border border-[#34c759]/30 bg-[#34c759]/10 px-4 py-4 text-center">
            <span className="text-[36px]">{container.emoji}</span>
            <p className="mt-1 text-[15px] font-semibold text-[#34c759]">
              {container.name} minted
            </p>
            <p className="mt-1 text-[12px] text-[#6e6e73]">
              You're now earning rev share from juice brand sales.
            </p>
          </div>
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
              Connect to mint {container.emoji} {container.name}
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
              ? confirming ? "Minting…" : "Confirm in wallet…"
              : `Mint ${container.emoji} ${container.name}`}
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
