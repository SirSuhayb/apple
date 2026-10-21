"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ContainerMint } from "./ContainerMint";
import { RevShareDashboard } from "./RevShareDashboard";
import type { SeedMap } from "@/lib/use-leaderboard";
import { JUICE_LIVE, AAPLC_TOKEN, JUICE_TOKEN } from "@/lib/juice-config";

export function JuicePage() {
  const { address } = useAccount();
  const [seedMap, setSeedMap] = useState<SeedMap>({});
  const [loading, setLoading] = useState(true);

  const fetchSeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { seedMap?: SeedMap | null };
      if (data.seedMap) setSeedMap(data.seedMap);
    } catch {
      /* best effort */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSeeds();
  }, [fetchSeeds]);

  const seeds = address ? (seedMap[address.toLowerCase()] ?? 0) : 0;

  return (
    <div className="mx-auto min-h-screen max-w-[520px] px-4 pb-20 pt-12">
      {/* Header */}
      <header className="mb-8 text-center">
        <p className="text-[11px] font-semibold tracking-[2px] text-[#f97316] uppercase">
          Post-game commerce
        </p>
        <h1 className="mt-2 text-[34px] font-black leading-tight tracking-tight text-[#1d1d1f]">
          $JUICE
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">
          The bite.party game is over. Your seeds live on — pour them into NFT
          containers and earn rev share from real-world juice brand sales, all
          backed by the Juicebox V6 revnet on Base.
        </p>

        {/* Token info pills */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#0052FF]/10 px-3 py-1 text-[11px] font-semibold text-[#0052FF]">
            Base (8453)
          </span>
          {JUICE_LIVE && (
            <a
              href={`https://basescan.org/token/${JUICE_TOKEN}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-[#f97316]/10 px-3 py-1 text-[11px] font-semibold text-[#f97316] hover:bg-[#f97316]/20"
            >
              $JUICE
            </a>
          )}
          <a
            href={`https://basescan.org/token/${AAPLC_TOKEN}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-[#1d1d1f]/10 px-3 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#1d1d1f]/20"
          >
            AAPLc
          </a>
        </div>
      </header>

      {loading ? (
        <p className="text-center text-[14px] text-[#6e6e73]">
          Loading seed data…
        </p>
      ) : (
        <div className="space-y-8">
          {/* Container mint */}
          <ContainerMint seeds={seeds} />

          {/* Flow explainer */}
          <div className="rounded-[22px] border border-[#d2d2d7] bg-white px-6 py-6">
            <p className="text-[10px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
              How it works
            </p>
            <ol className="mt-3 space-y-3 text-[13px] leading-relaxed text-[#6e6e73]">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f97316]/10 text-[11px] font-bold text-[#f97316]">
                  1
                </span>
                <span>
                  <strong className="text-[#1d1d1f]">Seeds → Container.</strong>{" "}
                  Your $BITE activity earned seeds. Seeds fill containers (Juice
                  Box, Bottle, Mason Jar, Growler). Mint your container as an
                  NFT on Base.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f97316]/10 text-[11px] font-bold text-[#f97316]">
                  2
                </span>
                <span>
                  <strong className="text-[#1d1d1f]">
                    Real-world sales → Treasury.
                  </strong>{" "}
                  Juice brand sales (Shopify, POS, manual) are logged. A
                  percentage of revenue is deposited into the Juicebox V6 revnet
                  via <code className="rounded bg-[#f5f5f7] px-1 py-0.5 text-[11px]">addToBalanceOf</code>,
                  backing $JUICE holders without minting new tokens.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f97316]/10 text-[11px] font-bold text-[#f97316]">
                  3
                </span>
                <span>
                  <strong className="text-[#1d1d1f]">
                    NFT holders earn rev share.
                  </strong>{" "}
                  Container NFT holders receive distributions from treasury
                  deposits proportional to their container tier.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f97316]/10 text-[11px] font-bold text-[#f97316]">
                  4
                </span>
                <span>
                  <strong className="text-[#1d1d1f]">$JUICE paired with AAPLc.</strong>{" "}
                  $JUICE is paired with Coinbase AAPLc (tokenized Apple stock)
                  on Base, creating a commerce-linked token backed by real
                  revenue.
                </span>
              </li>
            </ol>
          </div>

          {/* Rev share dashboard */}
          <RevShareDashboard />

          {/* Back to bite.party */}
          <div className="text-center">
            <a
              href="/"
              className="text-[13px] font-medium text-[#6e6e73] underline decoration-[#d2d2d7] underline-offset-4 hover:text-[#1d1d1f]"
            >
              ← Back to bite.party
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
