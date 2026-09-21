"use client";

import { useEffect, useRef } from "react";
import { isAddress, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { referralEscrowAbi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { REFERRAL_ESCROW } from "@/lib/config";
import { sameWallet } from "@/lib/leaderboard-rank";
import {
  bindReferralOnConnect,
  capturePendingReferral,
  clearPendingReferral,
  markBoundReferral,
  readPendingReferral,
} from "@/lib/referrals";

/**
 * Captures `?ref=` into localStorage and submits on-chain `bind(referrer)`
 * when a wallet connects with a pending invite (user signs via wagmi).
 */
export function ReferralCapture() {
  const { address, isConnected } = useAccount();
  const attemptedFor = useRef<string | null>(null);

  const {
    writeContract,
    data: hash,
    reset,
    isPending,
  } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: robinhoodChain.id,
  });

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ref");
    if (raw) capturePendingReferral(raw);
  }, []);

  useEffect(() => {
    if (!isConnected || !address) return;
    bindReferralOnConnect(address);
  }, [isConnected, address]);

  const pending = isConnected && address ? readPendingReferral() : null;
  const referrerCandidate =
    pending && isAddress(pending) && address && !sameWallet(pending, address)
      ? pending
      : null;

  const { data: onChainReferrer, isFetched } = useReadContract({
    address: REFERRAL_ESCROW,
    abi: referralEscrowAbi,
    functionName: "referrerOf",
    args: address && isAddress(address) ? [address] : undefined,
    chainId: robinhoodChain.id,
    query: {
      enabled: Boolean(isConnected && address && REFERRAL_ESCROW),
    },
  });

  const alreadyBound =
    typeof onChainReferrer === "string" &&
    isAddress(onChainReferrer) &&
    onChainReferrer !== zeroAddress;

  useEffect(() => {
    if (!isConnected || !address || !isFetched) return;
    if (alreadyBound && typeof onChainReferrer === "string") {
      markBoundReferral(address, onChainReferrer);
      clearPendingReferral();
      return;
    }
    if (!referrerCandidate || isPending || hash) return;

    const key = `${address.toLowerCase()}:${referrerCandidate.toLowerCase()}`;
    if (attemptedFor.current === key) return;
    attemptedFor.current = key;

    reset();
    writeContract({
      address: REFERRAL_ESCROW,
      abi: referralEscrowAbi,
      functionName: "bind",
      args: [referrerCandidate as `0x${string}`],
      chainId: robinhoodChain.id,
    });
  }, [
    isConnected,
    address,
    isFetched,
    alreadyBound,
    onChainReferrer,
    referrerCandidate,
    isPending,
    hash,
    reset,
    writeContract,
  ]);

  useEffect(() => {
    if (!isSuccess || !address || !referrerCandidate) return;
    markBoundReferral(address, referrerCandidate);
    clearPendingReferral();
  }, [isSuccess, address, referrerCandidate]);

  return null;
}
