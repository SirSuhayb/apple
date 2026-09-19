import { BITE_TOKEN, CHAIN_ID } from "./config";
import { fetchAct1Leaderboard } from "./act1-leaderboard";
import {
  HOLDER_COUNT_DEFINITION,
  resolveHolderCount,
} from "./holders";
import type { SupplyStats } from "./race";

export { HOLDER_COUNT_DEFINITION, resolveHolderCount };

/** Wallet-held BITE only — same figure as supplyStats.eoaHeldBite. */
export const CIRCULATING_SUPPLY_DEFINITION =
  "Wallet-held (EOA) BITE only. Excludes LP/pool contracts, kitchen, Pons escrow, dead/zero, and other contracts.";

export type CirculatingSupplyPayload = {
  circulatingSupply: number;
  circulatingSupplyWei: string;
  eoaHeldBite: number;
  contractHeldBite: number;
  totalSupply: number;
  totalBurned: number;
  holderCount: number;
  allTimeRecipients: number;
  definition: string;
  holderDefinition: string;
  token: typeof BITE_TOKEN;
  chainId: typeof CHAIN_ID;
  updatedAt: string | null;
};

export function circulatingFromStats(
  stats: SupplyStats | undefined | null,
): number {
  if (!stats) return 0;
  const n = stats.eoaHeldBite;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Whole tokens, no commas / scientific notation — CMC / CoinGecko scrapers. */
export function formatCirculatingPlain(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return String(Math.round(amount));
}

export function circulatingSupplyWei(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return (BigInt(Math.round(amount)) * 10n ** 18n).toString();
}

export async function fetchCirculatingSupply(): Promise<CirculatingSupplyPayload> {
  const board = await fetchAct1Leaderboard();
  const stats = board.supplyStats;
  const circulatingSupply = circulatingFromStats(stats);
  return {
    circulatingSupply,
    circulatingSupplyWei: circulatingSupplyWei(circulatingSupply),
    eoaHeldBite: stats?.eoaHeldBite ?? circulatingSupply,
    contractHeldBite: stats?.contractHeldBite ?? 0,
    totalSupply: stats?.totalSupply ?? 0,
    totalBurned: stats?.totalBurned ?? 0,
    holderCount: resolveHolderCount({
      holderCount: stats?.holderCount,
      holdersEoa: stats?.holdersEoa,
    }),
    allTimeRecipients: stats?.allTimeRecipients ?? 0,
    definition: CIRCULATING_SUPPLY_DEFINITION,
    holderDefinition: HOLDER_COUNT_DEFINITION,
    token: BITE_TOKEN,
    chainId: CHAIN_ID,
    updatedAt: stats?.updatedAt ?? board.updatedAt ?? null,
  };
}

export const supplyApiHeaders = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
} as const;
