/**
 * Juicebox V6 ABI fragments for revnet terminal interactions on Base.
 *
 * Source: https://github.com/Bananapus/nana-core-v6/blob/main/src/JBMultiTerminal.sol
 * Source: https://github.com/rev-net/revnet-core-v6/blob/main/src/REVDeployer.sol
 */

export const jbMultiTerminalAbi = [
  {
    type: "function",
    name: "pay",
    stateMutability: "payable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "beneficiary", type: "address" },
      { name: "minReturnedTokens", type: "uint256" },
      { name: "memo", type: "string" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [{ name: "beneficiaryTokenCount", type: "uint256" }],
  },
  {
    type: "function",
    name: "addToBalanceOf",
    stateMutability: "payable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "shouldReturnHeldFees", type: "bool" },
      { name: "memo", type: "string" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cashOutTokensOf",
    stateMutability: "nonpayable",
    inputs: [
      { name: "holder", type: "address" },
      { name: "projectId", type: "uint256" },
      { name: "cashOutCount", type: "uint256" },
      { name: "token", type: "address" },
      { name: "minTokensReclaimed", type: "uint256" },
      { name: "beneficiary", type: "address" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [{ name: "reclaimAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentSurplusOf",
    stateMutability: "view",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "decimals", type: "uint256" },
      { name: "currency", type: "uint256" },
    ],
    outputs: [{ name: "surplus", type: "uint256" }],
  },
  {
    type: "event",
    name: "Pay",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: false },
      { name: "beneficiary", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "beneficiaryTokenCount", type: "uint256", indexed: false },
      { name: "memo", type: "string", indexed: false },
      { name: "metadata", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AddToBalance",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "memo", type: "string", indexed: false },
      { name: "metadata", type: "bytes", indexed: false },
    ],
  },
] as const;

export const jbTokensAbi = [
  {
    type: "function",
    name: "totalBalanceOf",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "projectId", type: "uint256" },
    ],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

export const juiceContainerNftAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tierId", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "uri", type: "string" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;
