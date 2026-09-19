import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  type Address,
} from "viem";
import { robinhoodChain } from "./chain";
import {
  AAPL_TOKEN,
  BITE_TOKEN,
  RPC_URL,
  UNISWAP_POOL_MANAGER,
  UNISWAP_POSITION_MANAGER,
  V4_POOL_ID,
  V4_POOL_INIT_BLOCK,
} from "./config";
import { UNISWAP_TRADE_CHAIN_ID } from "./uniswap-trade";
import {
  LP_FEE_POOL_ID,
  LP_PROTOCOL,
  type LpClaimResponse,
  type LpPoolInfo,
  type LpPosition,
} from "./uniswap-lp";

const LP_API = "https://liquidity.api.uniswap.org";

/** Human-mediated: user reviews and confirms each LP tx in their wallet. */
const AGENT_INFO = JSON.stringify({
  integration_name: "swap-integration",
  decision_origin: "human_mediated",
  version: "1.5.0",
});

const ALLOWED_PATHS = new Set([
  "lp/create",
  "lp/check_approval",
  "lp/pool_info",
  "lp/claim_fees",
  "lp/decrease",
]);

const positionManagerAbi = parseAbi([
  "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, uint256 info)",
  "function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const modifyLiquidityEvent = parseAbiItem(
  "event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)",
);

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const rpcClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL, { timeout: 12_000 }),
});

const MAX_POSITIONS = 40;

function apiKey(): string {
  const key = process.env.UNISWAP_API_KEY?.trim();
  if (!key) {
    throw new Error("LP quotes are not configured.");
  }
  return key;
}

function sanitizeUpstreamError(value: unknown): string {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "detail" in value
        ? String((value as { detail: unknown }).detail)
        : value && typeof value === "object" && "message" in value
          ? String((value as { message: unknown }).message)
          : value && typeof value === "object" && "error" in value
            ? String((value as { error: unknown }).error)
            : "Uniswap request failed";
  const key = process.env.UNISWAP_API_KEY;
  return key && raw.includes(key) ? "Uniswap request failed" : raw.slice(0, 280);
}

export async function lpApiPost(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  if (!ALLOWED_PATHS.has(path)) {
    return { ok: false, status: 404, json: { error: "Not found" } };
  }

  const key = apiKey();
  let res: Response;
  try {
    res = await fetch(`${LP_API}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": key,
        "x-agent-info": AGENT_INFO,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, json: { error: "Uniswap unreachable" } };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = { error: "Invalid Uniswap response" };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      json: { error: sanitizeUpstreamError(json) },
    };
  }

  return { ok: true, status: res.status, json };
}

export function assertRobinhoodChain(chainId: unknown): void {
  const n = typeof chainId === "string" ? Number(chainId) : chainId;
  if (n !== UNISWAP_TRADE_CHAIN_ID) {
    throw new Error("Unsupported chain");
  }
}

function isThisPool(key: {
  currency0: Address;
  currency1: Address;
}): boolean {
  const tokens = new Set([key.currency0.toLowerCase(), key.currency1.toLowerCase()]);
  return tokens.has(BITE_TOKEN.toLowerCase()) && tokens.has(AAPL_TOKEN.toLowerCase());
}

function feeWeiForToken(
  token0: { tokenAddress: string; amount: string } | undefined,
  token1: { tokenAddress: string; amount: string } | undefined,
  token: string,
): string {
  const lower = token.toLowerCase();
  if (token0?.tokenAddress.toLowerCase() === lower) return token0.amount;
  if (token1?.tokenAddress.toLowerCase() === lower) return token1.amount;
  return "0";
}

async function uniqueTokenIdsFromModify(): Promise<bigint[]> {
  const toBlock = await rpcClient.getBlockNumber();
  const poolIds = [V4_POOL_ID, LP_FEE_POOL_ID] as `0x${string}`[];
  const ids = new Set<bigint>();
  for (const id of poolIds) {
    const logs = await rpcClient.getLogs({
      address: UNISWAP_POOL_MANAGER,
      event: modifyLiquidityEvent,
      args: { id },
      fromBlock: V4_POOL_INIT_BLOCK,
      toBlock,
    });
    for (const log of logs) {
      if (log.args.salt != null) ids.add(BigInt(log.args.salt));
    }
  }
  return [...ids];
}

async function uniqueTokenIdsFromTransfers(wallet: Address): Promise<bigint[]> {
  const toBlock = await rpcClient.getBlockNumber();
  const [incoming, outgoing] = await Promise.all([
    rpcClient.getLogs({
      address: UNISWAP_POSITION_MANAGER,
      event: transferEvent,
      args: { to: wallet },
      fromBlock: V4_POOL_INIT_BLOCK,
      toBlock,
    }),
    rpcClient.getLogs({
      address: UNISWAP_POSITION_MANAGER,
      event: transferEvent,
      args: { from: wallet },
      fromBlock: V4_POOL_INIT_BLOCK,
      toBlock,
    }),
  ]);
  const last = new Map<bigint, Address>();
  const ordered = [...incoming, ...outgoing].sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
    return a.blockNumber < b.blockNumber ? -1 : 1;
  });
  for (const log of ordered) {
    if (log.args.tokenId == null || !log.args.to) continue;
    last.set(log.args.tokenId, log.args.to);
  }
  const owned: bigint[] = [];
  for (const [id, to] of last) {
    if (to.toLowerCase() === wallet.toLowerCase()) owned.push(id);
  }
  return owned;
}

export async function assertWalletOwnsPoolPosition(
  wallet: Address,
  tokenId: bigint,
): Promise<void> {
  const [owner, info] = await Promise.all([
    rpcClient.readContract({
      address: UNISWAP_POSITION_MANAGER,
      abi: positionManagerAbi,
      functionName: "ownerOf",
      args: [tokenId],
    }),
    rpcClient.readContract({
      address: UNISWAP_POSITION_MANAGER,
      abi: positionManagerAbi,
      functionName: "getPoolAndPositionInfo",
      args: [tokenId],
    }),
  ]);
  if (owner.toLowerCase() !== wallet.toLowerCase()) {
    throw new Error("Not your position");
  }
  if (!isThisPool(info[0])) {
    throw new Error("Not this pool");
  }
}

export async function listWalletPoolPositions(wallet: Address): Promise<LpPosition[]> {
  let modifyIds: bigint[] = [];
  try {
    modifyIds = await uniqueTokenIdsFromModify();
  } catch {
    modifyIds = [];
  }
  let transferIds: bigint[] = [];
  try {
    transferIds = await uniqueTokenIdsFromTransfers(wallet);
  } catch {
    transferIds = [];
  }

  const merged = new Set<bigint>(modifyIds);
  if (modifyIds.length === 0 || transferIds.length <= 80) {
    for (const id of transferIds) merged.add(id);
  }
  const tokenIds = [...merged];

  const owned: Array<{
    tokenId: bigint;
    liquidity: bigint;
    feePips: number;
    hookAddress: Address;
  }> = [];
  for (const tokenId of tokenIds) {
    if (owned.length >= MAX_POSITIONS) break;
    try {
      const [owner, info, liquidity] = await Promise.all([
        rpcClient.readContract({
          address: UNISWAP_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "ownerOf",
          args: [tokenId],
        }),
        rpcClient.readContract({
          address: UNISWAP_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "getPoolAndPositionInfo",
          args: [tokenId],
        }),
        rpcClient.readContract({
          address: UNISWAP_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "getPositionLiquidity",
          args: [tokenId],
        }),
      ]);
      if (owner.toLowerCase() !== wallet.toLowerCase()) continue;
      if (!isThisPool(info[0])) continue;
      owned.push({
        tokenId,
        liquidity,
        feePips: Number(info[0].fee),
        hookAddress: info[0].hooks,
      });
    } catch {
      // burned or unreadable NFT
    }
  }

  const positions: LpPosition[] = [];
  for (const row of owned) {
    const tokenId = row.tokenId.toString();
    let biteWei = "0";
    let aaplWei = "0";
    const quoted = await lpApiPost("lp/claim_fees", {
      walletAddress: wallet,
      chainId: UNISWAP_TRADE_CHAIN_ID,
      protocol: "V4",
      tokenId,
      simulateTransaction: true,
    });
    if (quoted.ok && quoted.json && typeof quoted.json === "object") {
      const body = quoted.json as LpClaimResponse;
      biteWei = feeWeiForToken(body.token0, body.token1, BITE_TOKEN);
      aaplWei = feeWeiForToken(body.token0, body.token1, AAPL_TOKEN);
    }
    positions.push({
      tokenId,
      liquidity: row.liquidity.toString(),
      fees: { biteWei, aaplWei },
      feePips: row.feePips,
      hookAddress: row.hookAddress,
    });
  }
  return positions;
}

export async function lookupPools(ids: string[]): Promise<LpPoolInfo[]> {
  const result = await lpApiPost("lp/pool_info", {
    protocol: LP_PROTOCOL,
    chainId: UNISWAP_TRADE_CHAIN_ID,
    poolReferences: ids.map((referenceIdentifier) => ({
      protocol: LP_PROTOCOL,
      chainId: UNISWAP_TRADE_CHAIN_ID,
      referenceIdentifier,
    })),
  });
  if (!result.ok || !result.json || typeof result.json !== "object") return [];
  const pools = (result.json as { pools?: LpPoolInfo[] }).pools;
  return Array.isArray(pools) ? pools : [];
}

export function poolById(pools: LpPoolInfo[], id: string): LpPoolInfo | null {
  const lower = id.toLowerCase();
  return (
    pools.find((p) => p.poolReferenceIdentifier?.toLowerCase() === lower) ?? null
  );
}
