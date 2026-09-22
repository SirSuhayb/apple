"use client";

import { formatUnits, isAddress, type Address } from "viem";
import { useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { BITE_TOKEN } from "@/lib/config";

/**
 * Live $BITE ERC-20 balance for a wallet.
 * Used by home hero CTAs, first-bite quest, and /me profile.
 */
export function useBiteBalance(enabled: boolean, address?: string) {
  const { data, isLoading } = useReadContract({
    address: BITE_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address && isAddress(address) ? [address as Address] : undefined,
    chainId: robinhoodChain.id,
    query: {
      enabled: Boolean(enabled && address && isAddress(address) && BITE_TOKEN),
      refetchInterval: 20_000,
    },
  });

  const holdBalance =
    data != null ? Number(formatUnits(data as bigint, 18)) : null;

  return {
    holdBalance: Number.isFinite(holdBalance) ? holdBalance : null,
    holdLoading: enabled && isLoading,
  };
}
