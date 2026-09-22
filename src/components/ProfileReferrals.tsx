"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, isAddress, zeroAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { referralEscrowAbi } from "@/lib/abis";
import { shortAddr } from "@/components/LeaderboardRow";
import { robinhoodChain } from "@/lib/chain";
import {
  REFERRAL_ESCROW,
  REFERRAL_ESCROW_FROM_BLOCK,
  REFERRAL_REWARD_BITE,
} from "@/lib/config";
import { copy } from "@/lib/copy";
import { formatCompactAmount, sameWallet } from "@/lib/leaderboard-rank";
import {
  clearPendingReferral,
  markBoundReferral,
  readBoundReferral,
  readPendingReferral,
  referralInviteUrl,
} from "@/lib/referrals";

export function ProfileReferrals({ address }: { address: string }) {
  const { address: connected, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [localBound, setLocalBound] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [paidCount, setPaidCount] = useState<number | null>(null);
  const [paidLoading, setPaidLoading] = useState(true);

  const isOwnWallet =
    Boolean(isConnected && connected && sameWallet(connected, address));

  useEffect(() => {
    setLink(referralInviteUrl(address, window.location.origin));
    setLocalBound(readBoundReferral(address));
    setPending(readPendingReferral());
  }, [address]);

  const { data, refetch } = useReadContracts({
    contracts: [
      {
        address: REFERRAL_ESCROW,
        abi: referralEscrowAbi,
        functionName: "referrerOf",
        args: [address as `0x${string}`],
        chainId: robinhoodChain.id,
      },
      {
        address: REFERRAL_ESCROW,
        abi: referralEscrowAbi,
        functionName: "rewardPerReferral",
        chainId: robinhoodChain.id,
      },
      {
        address: REFERRAL_ESCROW,
        abi: referralEscrowAbi,
        functionName: "remainingPayouts",
        chainId: robinhoodChain.id,
      },
    ],
    query: {
      enabled: Boolean(REFERRAL_ESCROW && isAddress(address)),
      refetchInterval: 20_000,
    },
  });

  const onChainReferrer =
    data?.[0]?.status === "success" && typeof data[0].result === "string"
      ? data[0].result
      : null;
  const boundOnChain =
    Boolean(onChainReferrer) &&
    isAddress(onChainReferrer!) &&
    onChainReferrer !== zeroAddress;

  const rewardWei =
    data?.[1]?.status === "success" && typeof data[1].result === "bigint"
      ? data[1].result
      : null;
  const rewardBite = rewardWei
    ? Number(formatUnits(rewardWei, 18))
    : REFERRAL_REWARD_BITE;

  const remainingPayouts =
    data?.[2]?.status === "success" && typeof data[2].result === "bigint"
      ? Number(data[2].result)
      : null;

  const referrerToBind = useMemo(() => {
    if (boundOnChain) return null;
    const candidate = pending || localBound;
    if (!candidate || !isAddress(candidate)) return null;
    if (sameWallet(candidate, address)) return null;
    return candidate;
  }, [boundOnChain, pending, localBound, address]);

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

  useEffect(() => {
    if (!isSuccess || !referrerToBind) return;
    markBoundReferral(address, referrerToBind);
    clearPendingReferral();
    setLocalBound(referrerToBind);
    setPending(null);
    void refetch();
  }, [isSuccess, referrerToBind, address, refetch]);

  useEffect(() => {
    if (!publicClient || !REFERRAL_ESCROW || !isAddress(address)) {
      setPaidCount(null);
      setPaidLoading(false);
      return;
    }
    let cancelled = false;
    setPaidLoading(true);
    (async () => {
      try {
        const logs = await publicClient.getLogs({
          address: REFERRAL_ESCROW,
          event: {
            type: "event",
            name: "Qualified",
            inputs: [
              { name: "referee", type: "address", indexed: true },
              { name: "referrer", type: "address", indexed: true },
              { name: "reward", type: "uint256", indexed: false },
              { name: "attester", type: "address", indexed: true },
            ],
          },
          args: { referrer: address as `0x${string}` },
          fromBlock: REFERRAL_ESCROW_FROM_BLOCK,
          toBlock: "latest",
        });
        if (!cancelled) {
          setPaidCount(logs.length);
          setPaidLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPaidCount(null);
          setPaidLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, address, isSuccess]);

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const onShare = async () => {
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          text: copy.profile.referrals.shareText,
          url: link,
        });
        return;
      } catch (err) {
        // User dismissed the sheet — don't fall through to clipboard.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    // Desktop / browsers without Web Share: copy invite URL.
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const onBind = () => {
    if (!referrerToBind || !isOwnWallet) return;
    reset();
    writeContract({
      address: REFERRAL_ESCROW,
      abi: referralEscrowAbi,
      functionName: "bind",
      args: [referrerToBind as `0x${string}`],
      chainId: robinhoodChain.id,
    });
  };

  const earnings =
    paidCount != null && Number.isFinite(rewardBite)
      ? paidCount * rewardBite
      : null;

  const statusLine = (() => {
    if (!isOwnWallet) {
      return copy.profile.referrals.needWallet;
    }
    if (boundOnChain && onChainReferrer) {
      return copy.profile.referrals.boundNote(shortAddr(onChainReferrer));
    }
    if (isPending || confirming) {
      return copy.profile.referrals.binding;
    }
    if (isSuccess) {
      return copy.profile.referrals.bindSuccess;
    }
    if (referrerToBind) {
      return copy.profile.referrals.pendingNote(shortAddr(referrerToBind));
    }
    if (pending) {
      return copy.profile.referrals.pendingNote(shortAddr(pending));
    }
    return null;
  })();

  return (
    <section className="mt-10">
      <p className="text-[11px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
        {copy.profile.referrals.eyebrow}
      </p>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-[#1d1d1f]">
        {copy.profile.referrals.headline}
      </h2>
      <p className="mt-2 max-w-[480px] text-[13px] leading-relaxed text-[#6e6e73]">
        {copy.profile.referrals.body}
      </p>
      {remainingPayouts != null ? (
        <p
          className={[
            "mt-2 text-[13px] font-semibold",
            remainingPayouts > 0 ? "text-[#34c759]" : "text-[#e53935]",
          ].join(" ")}
        >
          {remainingPayouts > 0
            ? copy.profile.referrals.remainingCount(remainingPayouts)
            : copy.profile.referrals.remainingEmpty}
        </p>
      ) : null}

      <div className="mt-5 rounded-[18px] border border-[#d2d2d7] bg-white px-5 py-5">
        <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
          {copy.profile.referrals.linkLabel}
        </p>
        <p className="mt-2 break-all font-mono text-[13px] leading-snug text-[#1d1d1f]">
          {link || "…"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onCopy()}
            disabled={!link}
            className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            {copied
              ? copy.profile.referrals.copied
              : copy.profile.referrals.copyLink}
          </button>
          <button
            type="button"
            onClick={() => void onShare()}
            disabled={!link}
            className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            {copy.share.share}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-[14px] border border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
              {copy.profile.referrals.rewardLabel}
            </div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#1d1d1f]">
              {copy.profile.referrals.rewardAmount(
                formatCompactAmount(rewardBite),
              )}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
              {copy.profile.referrals.remainingLabel}
            </div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#1d1d1f]">
              {remainingPayouts != null
                ? formatCompactAmount(remainingPayouts)
                : "…"}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
              {copy.profile.referrals.countLabel}
            </div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#1d1d1f]">
              {paidLoading
                ? "…"
                : paidCount != null
                  ? formatCompactAmount(paidCount)
                  : copy.profile.referrals.stubZero}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
              {copy.profile.referrals.earningsLabel}
            </div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#1d1d1f]">
              {earnings != null
                ? `${formatCompactAmount(earnings)} $BITE`
                : copy.profile.referrals.stubZero}
            </div>
          </div>
        </div>

        {statusLine ? (
          <p className="mt-3 text-[12px] text-[#6e6e73]">{statusLine}</p>
        ) : null}

        {isOwnWallet && referrerToBind && !boundOnChain ? (
          <button
            type="button"
            onClick={onBind}
            disabled={isPending || confirming}
            className="mt-3 rounded-full border border-[#1d1d1f] bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            {isPending || confirming
              ? copy.profile.referrals.binding
              : copy.profile.referrals.bindCta}
          </button>
        ) : null}

        {error ? (
          <p className="mt-2 text-[12px] text-[#e53935]">
            {error.message.split("\n")[0] || copy.profile.referrals.escrowOffline}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Hook-friendly payout count for Windfall title unlock. */
export function useReferralPayoutCount(address: string | undefined): {
  count: number | null | undefined;
} {
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const [count, setCount] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!address || !isAddress(address) || !publicClient || !REFERRAL_ESCROW) {
      setCount(null);
      return;
    }
    let cancelled = false;
    setCount(undefined);
    (async () => {
      try {
        const logs = await publicClient.getLogs({
          address: REFERRAL_ESCROW,
          event: {
            type: "event",
            name: "Qualified",
            inputs: [
              { name: "referee", type: "address", indexed: true },
              { name: "referrer", type: "address", indexed: true },
              { name: "reward", type: "uint256", indexed: false },
              { name: "attester", type: "address", indexed: true },
            ],
          },
          args: { referrer: address as `0x${string}` },
          fromBlock: REFERRAL_ESCROW_FROM_BLOCK,
          toBlock: "latest",
        });
        if (!cancelled) setCount(logs.length);
      } catch {
        if (!cancelled) setCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  return { count };
}
