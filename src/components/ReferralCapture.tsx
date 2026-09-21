"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import {
  bindReferralOnConnect,
  capturePendingReferral,
} from "@/lib/referrals";

/**
 * Captures `?ref=` into localStorage and binds it when a wallet connects.
 * No on-chain escrow — attribution UX only.
 */
export function ReferralCapture() {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ref");
    if (raw) capturePendingReferral(raw);
  }, []);

  useEffect(() => {
    if (!isConnected || !address) return;
    bindReferralOnConnect(address);
  }, [isConnected, address]);

  return null;
}
