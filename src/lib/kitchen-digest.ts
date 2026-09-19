import { formatEther } from "viem";

/** AppleKitchen.digest() no-ops below this (needs at least 2 wei surplus). */
export const DIGEST_MIN_SURPLUS_WEI = 2n;

export function kitchenSurplusWei(
  aaplBalance: bigint,
  prizePool: bigint,
): bigint {
  return aaplBalance > prizePool ? aaplBalance - prizePool : 0n;
}

export function canCallDigest(phase: number, surplusWei: bigint): boolean {
  return phase === 0 && surplusWei >= DIGEST_MIN_SURPLUS_WEI;
}

export function formatSurplusAapl(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 10) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
