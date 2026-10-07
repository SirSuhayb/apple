import { defineChain } from "viem";
import { CHAIN_ID, RPC_URL } from "./config";

export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://robin.etherscan.io",
    },
    blockscout: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});