"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";

/** QA: `/leaderboard?you=0x…` highlights a wallet without connecting. */
const QA_PARAM = "you";

/**
 * Connected wagmi address, or a valid `?you=` query for local QA.
 * Wallet always wins when both are present.
 */
export function useBoardWallet(): string | undefined {
  const { address } = useAccount();
  const [qa, setQa] = useState<string | undefined>(undefined);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(QA_PARAM);
    if (raw && isAddress(raw)) setQa(raw);
  }, []);

  return address ?? qa;
}
