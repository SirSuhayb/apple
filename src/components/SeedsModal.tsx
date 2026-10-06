"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import { useAccount, useConnect } from "wagmi";
import { bestContainer, seedsToNextTier, seedsToOz } from "@/lib/seeds";
import type { SeedMap } from "@/lib/use-leaderboard";

const DISMISSED_KEY = "bite:seeds-modal-dismissed";

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // no-op
  }
}

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

export function SeedsModal({ seedMap }: { seedMap: SeedMap }) {
  const [open, setOpen] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors: rawConnectors, isPending } = useConnect();
  const connectors = useMemo(
    () => dedupeConnectors(rawConnectors),
    [rawConnectors],
  );

  const seeds = address
    ? (seedMap[address.toLowerCase()] ?? 0)
    : 0;

  useEffect(() => {
    if (wasDismissed()) return;
    const timer = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    markDismissed();
  }, []);

  if (!open) return null;

  const container = bestContainer(seeds);
  const next = seedsToNextTier(seeds);
  const oz = seedsToOz(seeds);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative mx-4 mb-4 w-full max-w-[420px] overflow-hidden rounded-[22px] bg-white shadow-2xl sm:mb-0">
        <div className="px-6 pt-7 pb-6">
          <p className="text-[10px] font-semibold tracking-[1.5px] text-[#34c759] uppercase">
            Phase 2 preview
          </p>
          <h2 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#1d1d1f]">
            Something grows from what remains.
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">
            Every trade, hold, and burn earns seeds. Your seeds determine what
            happens after the game ends. Connect your wallet to see yours.
          </p>

          {!isConnected ? (
            <div className="mt-5">
              {!showWallets ? (
                <button
                  type="button"
                  onClick={() => setShowWallets(true)}
                  className="w-full rounded-full bg-[#34c759] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#2db84e]"
                >
                  Check your seeds
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={isPending}
                      onClick={() => connect({ connector })}
                      className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                    >
                      {isPending ? "Connecting…" : connectorLabel(connector)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : seeds > 0 ? (
            <div className="mt-5">
              <div className="rounded-[14px] border border-[#34c759]/20 bg-[#34c759]/5 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[1px] text-[#34c759] uppercase">
                      Your seeds
                    </p>
                    <p className="mt-0.5 text-[28px] font-black tabular-nums leading-none text-[#1d1d1f]">
                      {seeds.toLocaleString()}
                    </p>
                    <p className="mt-1 text-[12px] text-[#6e6e73]">
                      {oz} oz{container ? ` · ${container.emoji} ${container.name}` : ""}
                    </p>
                  </div>
                  <span className="text-[44px]">
                    {container?.emoji ?? "🌱"}
                  </span>
                </div>
                {next && (
                  <p className="mt-2.5 text-[12px] text-[#6e6e73]">
                    {next.needed.toLocaleString()} more seeds to reach{" "}
                    {next.tier.emoji} {next.tier.name}
                  </p>
                )}
              </div>
              <a
                href="/me"
                className="mt-3 block w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-center text-[15px] font-semibold text-white hover:bg-black"
              >
                View full profile
              </a>
            </div>
          ) : (
            <div className="mt-5">
              <div className="rounded-[14px] border border-dashed border-[#d2d2d7] bg-[#fafafa] px-4 py-4 text-center">
                <span className="text-[28px] opacity-30">🌱</span>
                <p className="mt-1 text-[14px] font-semibold text-[#1d1d1f]">
                  No seeds yet
                </p>
                <p className="mt-1 text-[12px] text-[#6e6e73]">
                  Buy $BITE and burn to start earning seeds.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="mt-3 w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-[15px] font-semibold text-white hover:bg-black"
              >
                Start earning
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#e5e5ea] text-[#6e6e73] hover:bg-[#d2d2d7]"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
