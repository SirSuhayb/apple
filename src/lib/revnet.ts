import type { Address } from "viem";

/**
 * Juicebox V6 revnet integration on Base (chain 8453).
 *
 * A revnet supplies treasury/token rules. Commerce, game rewards, and
 * holder benefits are wired through terminal `pay` (mint tokens) and
 * `addToBalanceOf` (back existing holders without minting).
 *
 * See: https://github.com/mejango/juicebox-skills/blob/main/plugins/juicebox-v6/skills/revnet-commerce/SKILL.md
 */

export const REVNET_CHAIN_ID = 8453;

/**
 * Revnet project ID on Base. Set via NEXT_PUBLIC_REVNET_PROJECT_ID.
 * This is the Juicebox V6 project number that owns the $JUICE revnet.
 */
export const REVNET_PROJECT_ID = (() => {
  const raw = process.env.NEXT_PUBLIC_REVNET_PROJECT_ID?.trim();
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
})();

/**
 * JBMultiTerminal on Base — the entry point for `pay` and `addToBalanceOf`.
 * Deploy address from nana-core-v6 on Base.
 */
export const JB_MULTI_TERMINAL: Address =
  (process.env.NEXT_PUBLIC_JB_MULTI_TERMINAL as Address) ??
  "0x0000000000000000000000000000000000000000";

/**
 * REVDeployer on Base — revnet stage config and payout limits.
 */
export const REV_DEPLOYER: Address =
  (process.env.NEXT_PUBLIC_REV_DEPLOYER as Address) ??
  "0x0000000000000000000000000000000000000000";

/**
 * JBController on Base — project token metadata, minting rules.
 */
export const JB_CONTROLLER: Address =
  (process.env.NEXT_PUBLIC_JB_CONTROLLER as Address) ??
  "0x0000000000000000000000000000000000000000";

/** Native ETH as the terminal payment token (zero address sentinel). */
export const JB_NATIVE_TOKEN: Address =
  "0x000000000000000000000000000000000000EEEe";

/** USDC on Base (6 decimals). */
export const BASE_USDC: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** WETH on Base. */
export const BASE_WETH: Address =
  "0x4200000000000000000000000000000000000006";

export const REVNET_READY = REVNET_PROJECT_ID > 0n && JB_MULTI_TERMINAL !== "0x0000000000000000000000000000000000000000";
