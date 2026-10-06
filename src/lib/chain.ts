import { base } from "viem/chains";
import { RPC_URL } from "./config";

export const baseChain = {
  ...base,
  rpcUrls: {
    ...base.rpcUrls,
    default: { http: [RPC_URL] },
  },
} as const;

/** @deprecated Alias kept during migration — prefer `baseChain`. */
export const robinhoodChain = baseChain;
