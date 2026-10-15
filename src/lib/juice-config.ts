/**
 * Post-game $JUICE commerce layer on Base.
 *
 * bite.party (the game on Robinhood Chain) is finished. This config drives
 * the post-game juice commerce: $JUICE token paired with AAPLc on Base,
 * Juicebox V6 revnet treasury, NFT containers from seeds, and real-world
 * juice brand revenue logging.
 */

import { type Address, isAddress, zeroAddress } from "viem";
import { base } from "viem/chains";

function parseAddress(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value) || value === zeroAddress) return undefined;
  return value;
}

/** Base mainnet (8453). */
export const JUICE_CHAIN_ID = 8453;

export const JUICE_RPC_URL =
  process.env.NEXT_PUBLIC_JUICE_RPC_URL ?? "https://mainnet.base.org";

export const baseChain = {
  ...base,
  rpcUrls: {
    ...base.rpcUrls,
    default: { http: [JUICE_RPC_URL] },
  },
} as const;

/**
 * Coinbase AAPLc on Base — the tokenized Apple stock.
 * 8 decimals. ~10K holders, real liquidity.
 */
export const AAPLC_TOKEN: Address =
  (parseAddress(process.env.NEXT_PUBLIC_AAPLC_TOKEN) ??
    "0xb200000000000000000000C2e324d24d7eEcd1fb") as Address;
export const AAPLC_DECIMALS = 8;

/**
 * $JUICE token on Base. Set after revnet deployment.
 * Paired with AAPLc in a Uniswap pool on Base.
 */
export const JUICE_TOKEN: Address =
  (parseAddress(process.env.NEXT_PUBLIC_JUICE_TOKEN) ??
    zeroAddress) as Address;

/** Juicebox V6 revnet project ID on Base. */
export const REVNET_PROJECT_ID = (() => {
  const raw = process.env.NEXT_PUBLIC_REVNET_PROJECT_ID?.trim();
  if (!raw) return 0n;
  try { return BigInt(raw); } catch { return 0n; }
})();

/** JBMultiTerminal on Base — pay, addToBalanceOf, cashOut. */
export const JB_MULTI_TERMINAL: Address =
  (parseAddress(process.env.NEXT_PUBLIC_JB_MULTI_TERMINAL) ??
    zeroAddress) as Address;

/** JBController on Base — token supply reads. */
export const JB_CONTROLLER: Address =
  (parseAddress(process.env.NEXT_PUBLIC_JB_CONTROLLER) ??
    zeroAddress) as Address;

/** NFT container contract on Base — mint seed-tier ERC-721s. */
export const JUICE_NFT_CONTRACT: Address =
  (parseAddress(process.env.NEXT_PUBLIC_JUICE_NFT_CONTRACT) ??
    zeroAddress) as Address;

/** Native ETH sentinel for JB terminal payments. */
export const JB_NATIVE_TOKEN: Address =
  "0x000000000000000000000000000000000000EEEe";

/** True when the revnet is deployed and terminal is configured. */
export const REVNET_READY =
  REVNET_PROJECT_ID > 0n && JB_MULTI_TERMINAL !== zeroAddress;

/** True when the NFT container contract is deployed. */
export const NFT_READY = JUICE_NFT_CONTRACT !== zeroAddress;

/** True when the $JUICE token is deployed. */
export const JUICE_LIVE = JUICE_TOKEN !== zeroAddress;
