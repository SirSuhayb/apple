import {
  type Address,
  createPublicClient,
  fallback,
  http,
  isAddress,
} from "viem";
import { mainnet } from "viem/chains";

const HIT_TTL_MS = 60 * 60 * 1000;
const MISS_TTL_MS = 15 * 60 * 1000;
const CONCURRENCY = 8;
const MAX_BATCH = 80;

const FALLBACK_RPCS = [
  "https://1rpc.io/eth",
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com",
];

type CacheEntry = { name: string | null; expires: number };

const cache = new Map<string, CacheEntry>();

function ensRpcUrls(): string[] {
  const preferred = [
    process.env.ENS_RPC_URL?.trim(),
    process.env.MAINNET_RPC_URL?.trim(),
  ].filter((u): u is string => Boolean(u));
  const rest = FALLBACK_RPCS.filter((u) => !preferred.includes(u));
  return [...preferred, ...rest];
}

let client: ReturnType<typeof createPublicClient> | null = null;

function mainnetClient() {
  if (!client) {
    client = createPublicClient({
      chain: mainnet,
      transport: fallback(ensRpcUrls().map((url) => http(url))),
    });
  }
  return client;
}

function peek(addr: string): string | null | undefined {
  const hit = cache.get(addr);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(addr);
    return undefined;
  }
  return hit.name;
}

function remember(addr: string, name: string | null) {
  cache.set(addr, {
    name,
    expires: Date.now() + (name ? HIT_TTL_MS : MISS_TTL_MS),
  });
}

async function lookupOne(address: Address): Promise<string | null> {
  const cached = peek(address);
  if (cached !== undefined) return cached;
  try {
    const name = await mainnetClient().getEnsName({ address });
    const normalized = name && name.length > 0 ? name : null;
    remember(address, normalized);
    return normalized;
  } catch {
    // RPC / CCIP failures are not "no ENS" — retry next request.
    return peek(address) ?? null;
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export function normalizeEnsAddresses(raw: unknown): Address[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const key = value.trim().toLowerCase();
    if (!isAddress(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_BATCH) break;
  }
  return out;
}

/** Reverse-resolve mainnet ENS names. Cached; misses do not throw. */
export async function resolveEnsNames(
  addresses: Address[],
): Promise<Record<string, string | null>> {
  const names: Record<string, string | null> = {};
  await mapPool(addresses, CONCURRENCY, async (address) => {
    names[address] = await lookupOne(address);
  });
  return names;
}
