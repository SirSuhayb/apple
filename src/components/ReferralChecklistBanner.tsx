"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isAddress, zeroAddress } from "viem";
import {
  useAccount,
  useConnect,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
  type Connector,
} from "wagmi";
import { referralEscrowAbi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { REFERRAL_ESCROW } from "@/lib/config";
import { copy } from "@/lib/copy";
import { sameWallet } from "@/lib/leaderboard-rank";
import type { Eater } from "@/lib/race";
import {
  clearPendingReferral,
  markBoundReferral,
  readBoundReferral,
  readPendingReferral,
} from "@/lib/referrals";

type ReferralChecklistBannerProps = {
  eaters: Eater[];
  onBuy: () => void;
  onBite: () => void;
  tradingOpen: boolean;
  burnsOpen: boolean;
  /** Fires when the invite strip is actually rendered (or not). */
  onActiveChange?: (active: boolean) => void;
};

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

function findEater(eaters: Eater[], address: string | undefined): Eater | null {
  if (!address) return null;
  return eaters.find((e) => sameWallet(e.address, address)) ?? null;
}

/**
 * Checklist for invited wallets: buy on-site → kitchen burn.
 * Visible only with pending/bound referral intent; hides after qualify or both steps.
 */
export function ReferralChecklistBanner({
  eaters,
  onBuy,
  onBite,
  tradingOpen,
  burnsOpen,
  onActiveChange,
}: ReferralChecklistBannerProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const [connectOpen, setConnectOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [localBound, setLocalBound] = useState<string | null>(null);
  const [urlRef, setUrlRef] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refreshLocal = () => {
    setPending(readPendingReferral());
    setLocalBound(address ? readBoundReferral(address) : null);
    const raw = new URLSearchParams(window.location.search).get("ref");
    setUrlRef(raw && isAddress(raw) ? raw : null);
    setHydrated(true);
  };

  useEffect(() => {
    refreshLocal();
    const onFocus = () => refreshLocal();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read when wallet changes
  }, [address]);

  const { data: escrowReads, refetch: refetchEscrow } = useReadContracts({
    contracts: [
      {
        address: REFERRAL_ESCROW,
        abi: referralEscrowAbi,
        functionName: "referrerOf",
        args: address && isAddress(address) ? [address] : undefined,
        chainId: robinhoodChain.id,
      },
      {
        address: REFERRAL_ESCROW,
        abi: referralEscrowAbi,
        functionName: "paid",
        args: address && isAddress(address) ? [address] : undefined,
        chainId: robinhoodChain.id,
      },
    ],
    query: {
      enabled: Boolean(
        REFERRAL_ESCROW && isConnected && address && isAddress(address),
      ),
      refetchInterval: 20_000,
    },
  });

  const onChainReferrer =
    escrowReads?.[0]?.status === "success" &&
    typeof escrowReads[0].result === "string"
      ? escrowReads[0].result
      : null;
  const boundOnChain =
    Boolean(onChainReferrer) &&
    isAddress(onChainReferrer!) &&
    onChainReferrer !== zeroAddress;
  const qualified =
    escrowReads?.[1]?.status === "success" && escrowReads[1].result === true;

  const referrerCandidate = useMemo(() => {
    const candidate = pending || localBound || urlRef;
    if (!candidate || !isAddress(candidate)) return null;
    if (address && sameWallet(candidate, address)) return null;
    return candidate;
  }, [pending, localBound, urlRef, address]);

  const hasReferralIntent = Boolean(
    referrerCandidate || boundOnChain || (localBound && isAddress(localBound)),
  );

  const eater = findEater(eaters, address);
  const bought = Boolean(eater && eater.buyCount > 0);
  const burned = Boolean(
    eater && (eater.burned > 0 || eater.tapCount > 0),
  );
  const stepsDone = bought && burned;

  const {
    writeContract,
    data: hash,
    isPending: binding,
    reset,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess: bindSuccess } =
    useWaitForTransactionReceipt({
      hash,
      chainId: robinhoodChain.id,
    });

  useEffect(() => {
    if (!bindSuccess || !address || !referrerCandidate) return;
    markBoundReferral(address, referrerCandidate);
    clearPendingReferral();
    setLocalBound(referrerCandidate);
    setPending(null);
    void refetchEscrow();
  }, [bindSuccess, address, referrerCandidate, refetchEscrow]);

  const onBind = () => {
    if (!REFERRAL_ESCROW || !referrerCandidate || !address || boundOnChain)
      return;
    reset();
    writeContract({
      address: REFERRAL_ESCROW,
      abi: referralEscrowAbi,
      functionName: "bind",
      args: [referrerCandidate as `0x${string}`],
      chainId: robinhoodChain.id,
    });
  };

  const active =
    hydrated && hasReferralIntent && !qualified && !stepsDone;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  if (!active) return null;

  const showBind =
    isConnected &&
    Boolean(referrerCandidate) &&
    !boundOnChain &&
    Boolean(REFERRAL_ESCROW);

  const listed = dedupeConnectors(connectors);

  return (
    <div className="page-gutter border-b border-[#2997ff]/20 bg-[#2997ff]/8 py-3">
      <div className="mx-auto flex max-w-[980px] flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-[13px] font-semibold tracking-wide text-[#1d1d1f]">
            {copy.referralChecklist.headline}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#6e6e73]">
            {copy.referralChecklist.body}
          </p>
          {showBind ? (
            <p className="mt-1 text-[11px] text-[#6e6e73]">
              {binding || confirming
                ? copy.referralChecklist.binding
                : copy.referralChecklist.bindHint}
            </p>
          ) : null}
        </div>

        <ul className="flex flex-col gap-1.5 sm:shrink-0 sm:items-end">
          {!isConnected ? (
            <li className="flex items-center justify-center gap-2 sm:justify-end">
              {!connectOpen ? (
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="rounded-full border border-[#1d1d1f]/15 bg-white px-3 py-1 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  {copy.referralChecklist.connect}
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
                  {listed.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={connecting}
                      onClick={() => connect({ connector })}
                      className="rounded-full border border-[#d2d2d7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                    >
                      {connecting
                        ? copy.referralChecklist.connecting
                        : connectorLabel(connector)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ) : null}

          <ChecklistRow
            done={bought}
            label={
              bought
                ? copy.referralChecklist.doneBuy
                : copy.referralChecklist.buy
            }
            cta={
              !bought && tradingOpen ? (
                <button
                  type="button"
                  onClick={onBuy}
                  className="rounded-full bg-[#1d1d1f] px-3 py-1 text-[12px] font-semibold text-white hover:bg-black"
                >
                  {copy.referralChecklist.buyCta}
                </button>
              ) : null
            }
          />

          <ChecklistRow
            done={burned}
            label={
              burned
                ? copy.referralChecklist.doneBurn
                : copy.referralChecklist.burn
            }
            cta={
              !burned && burnsOpen ? (
                <button
                  type="button"
                  onClick={onBite}
                  className="rounded-full border border-[#1d1d1f] bg-white px-3 py-1 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  {copy.referralChecklist.burnCta}
                </button>
              ) : null
            }
          />

          {showBind ? (
            <li className="flex justify-center sm:justify-end">
              <button
                type="button"
                onClick={onBind}
                disabled={binding || confirming}
                className="rounded-full border border-[#2997ff]/40 bg-white px-3 py-1 text-[12px] font-semibold text-[#0077ed] hover:bg-[#f0f7ff] disabled:opacity-50"
              >
                {binding || confirming
                  ? copy.referralChecklist.binding
                  : copy.referralChecklist.bindCta}
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function ChecklistRow({
  done,
  label,
  cta,
}: {
  done: boolean;
  label: string;
  cta: ReactNode;
}) {
  return (
    <li className="flex items-center justify-center gap-2 sm:justify-end">
      <span
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          done
            ? "bg-[#34c759] text-white"
            : "border border-[#d2d2d7] bg-white text-transparent",
        ].join(" ")}
        aria-hidden
      >
        {done ? "✓" : "·"}
      </span>
      <span
        className={[
          "text-[12px]",
          done ? "font-medium text-[#248a3d]" : "text-[#1d1d1f]",
        ].join(" ")}
      >
        {label}
      </span>
      {cta}
    </li>
  );
}
