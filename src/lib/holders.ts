/** Current people holding BITE — not lifetime transfer recipients (FOMO-style). */
export const HOLDER_COUNT_DEFINITION =
  "Current EOA wallets with BITE balance > 0. Excludes contracts (except EIP-7702 delegated EOAs), Uniswap pool/PositionManager, kitchen, escrow, known routers, and dead/zero. Not lifetime transfer recipients.";

/**
 * Prefer the bot's EOA holder snapshot when the published holderCount is still
 * the old ever-received (FOMO) counter.
 */
export function resolveHolderCount(opts: {
  holderCount?: number | null;
  holdersEoa?: number | null;
}): number {
  const published = Number(opts.holderCount);
  const eoa = Number(opts.holdersEoa);
  const publishedOk = Number.isFinite(published) && published > 0;
  const eoaOk = Number.isFinite(eoa) && eoa > 0;
  if (eoaOk && (!publishedOk || published > eoa)) {
    return Math.floor(eoa);
  }
  return publishedOk ? Math.floor(published) : 0;
}
