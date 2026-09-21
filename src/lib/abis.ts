export const appleKitchenAbi = [
  {
    type: "function",
    name: "bite",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "digest",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "revealCore",
    stateMutability: "nonpayable",
    inputs: [{ name: "merkleRoot", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revealRot",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "index", type: "uint256" },
      { name: "account", type: "address" },
      { name: "consumption", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "burned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "coreTarget",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "deadline",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "phase",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "prizePool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "deployer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "progressBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "AppleEaten",
    inputs: [
      { name: "eater", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "kind", type: "uint8", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const metaWagerAbi = [
  {
    type: "function",
    name: "betCore",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "betRot",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "totalCore",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalRot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "resolved",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "winningSide",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "coreOddsBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingPayout",
    stateMutability: "view",
    inputs: [{ name: "bettor", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bets",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "core", type: "uint256" },
      { name: "rot", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "feeCollected",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "bettor", type: "address", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Resolved",
    inputs: [
      { name: "winner", type: "uint8", indexed: false },
      { name: "winPool", type: "uint256", indexed: false },
      { name: "losePool", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "bettor", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ponsFeeEscrowAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOfToken",
    stateMutability: "view",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const bondingCurveAbi = [
  {
    type: "function",
    name: "reservedTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sellableTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** ReferralEscrow (UUPS proxy) — bind / qualify / views. */
export const referralEscrowAbi = [
  {
    type: "function",
    name: "bind",
    stateMutability: "nonpayable",
    inputs: [{ name: "referrer", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "qualify",
    stateMutability: "nonpayable",
    inputs: [{ name: "referee", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "referrerOf",
    stateMutability: "view",
    inputs: [{ name: "referee", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "paid",
    stateMutability: "view",
    inputs: [{ name: "referee", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "rewardPerReferral",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "payoutCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "remainingPayouts",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "escrowBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "attester",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "Bound",
    inputs: [
      { name: "referee", type: "address", indexed: true },
      { name: "referrer", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Qualified",
    inputs: [
      { name: "referee", type: "address", indexed: true },
      { name: "referrer", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "attester", type: "address", indexed: true },
    ],
  },
] as const;