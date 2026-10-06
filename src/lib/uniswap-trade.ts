import { isAddress, isHex, parseUnits } from "viem";
import {
  USDC_TOKEN,
  JB_MULTI_TERMINAL,
  JUICE_TOKEN,
  CHAIN_ID,
  NATIVE_ETH_ADDRESS,
  SWAP_OPS_RECIPIENT,
  WETH_TOKEN,
} from "./config";

export const UNISWAP_ROUTER_VERSION = "2.1.1";
export const UNISWAP_TRADE_CHAIN_ID = CHAIN_ID;
export const SWAP_SLIPPAGE_PERCENT = 2;
export const QUOTE_MAX_AGE_MS = 25_000;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const AMOUNT_RE = /^[0-9]+\.?[0-9]*$/;
const WEI_RE = /^[0-9]+$/;
const SHELL_META_RE = /[;|&$`><\\'"()\n\r]/;

/**
 * Output skim via Trading API `integratorFees` → PAY_PORTION.
 * 50 bips (0.5%) of the *output* token, sent to the treasury.
 */
export const SWAP_PORTION_SUPPORTED = true;
export const SWAP_KITCHEN_FEE_MAX_BIPS = 500;
export const SWAP_KITCHEN_PORTION_BIPS = 50;
export const SWAP_OPS_PORTION_BIPS = 0;
export const SWAP_TOTAL_FEE_BIPS = SWAP_KITCHEN_PORTION_BIPS + SWAP_OPS_PORTION_BIPS;
export const SWAP_KITCHEN_FEE_RECIPIENT = JB_MULTI_TERMINAL;
export const SWAP_OPS_FEE_DEFAULT = SWAP_OPS_RECIPIENT;

export type IntegratorFee = {
  bips: number;
  recipient: `0x${string}`;
};

function clampFeeBips(bips: number, remaining: number): number {
  return Math.min(Math.max(0, Math.floor(bips)), remaining, SWAP_KITCHEN_FEE_MAX_BIPS);
}

export function swapOpsRecipient(): `0x${string}` | undefined {
  const server = process.env.SWAP_OPS_RECIPIENT?.trim();
  if (server && ADDRESS_RE.test(server) && isAddress(server)) {
    return server as `0x${string}`;
  }
  return SWAP_OPS_FEE_DEFAULT;
}

export function swapIntegratorFees(): IntegratorFee[] {
  if (!SWAP_PORTION_SUPPORTED) return [];
  const kitchenBips = clampFeeBips(SWAP_KITCHEN_PORTION_BIPS, SWAP_KITCHEN_FEE_MAX_BIPS);
  const opsBips = clampFeeBips(SWAP_OPS_PORTION_BIPS, SWAP_KITCHEN_FEE_MAX_BIPS - kitchenBips);
  const fees: IntegratorFee[] = [];
  if (kitchenBips > 0) {
    fees.push({ bips: kitchenBips, recipient: SWAP_KITCHEN_FEE_RECIPIENT });
  }
  const opsRecipient = swapOpsRecipient();
  if (opsBips > 0 && opsRecipient) {
    fees.push({ bips: opsBips, recipient: opsRecipient });
  }
  return fees;
}

export function formatSwapFeePercent(bips: number): string {
  return `${bips / 100}%`;
}

export function swapFeeDisclosure(outSymbol: string): string {
  if (SWAP_OPS_PORTION_BIPS > 0) {
    return `${formatSwapFeePercent(SWAP_TOTAL_FEE_BIPS)} (${formatSwapFeePercent(SWAP_KITCHEN_PORTION_BIPS)} treasury · ${formatSwapFeePercent(SWAP_OPS_PORTION_BIPS)} ops) in ${outSymbol}`;
  }
  return `${formatSwapFeePercent(SWAP_TOTAL_FEE_BIPS)} to treasury in ${outSymbol}`;
}

export type BuySide = "usdc" | "weth" | "eth";
export type SwapSide = BuySide | "juice";

export type SwapTokenMeta = {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  native?: boolean;
};

export const BUY_SIDES: readonly BuySide[] = ["usdc", "weth", "eth"] as const;

export const SWAP_TOKENS: Record<SwapSide, SwapTokenMeta> = {
  usdc: { address: USDC_TOKEN, symbol: "USDC", decimals: 6 },
  weth: { address: WETH_TOKEN, symbol: "WETH", decimals: 18 },
  eth: {
    address: NATIVE_ETH_ADDRESS,
    symbol: "ETH",
    decimals: 18,
    native: true,
  },
  juice: { address: JUICE_TOKEN, symbol: "$JUICE", decimals: 18 },
};

export function isBuySide(side: SwapSide): side is BuySide {
  return side !== "juice";
}

export function isNativeSwapToken(token: SwapTokenMeta): boolean {
  return Boolean(token.native) || token.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase();
}

export function resolveSwapPair(tokenInSide: SwapSide): {
  tokenIn: SwapTokenMeta;
  tokenOut: SwapTokenMeta;
} {
  if (tokenInSide === "juice") {
    return { tokenIn: SWAP_TOKENS.juice, tokenOut: SWAP_TOKENS.eth };
  }
  return { tokenIn: SWAP_TOKENS[tokenInSide], tokenOut: SWAP_TOKENS.juice };
}

export type AggregatedOutput = {
  token?: string;
  amount?: string;
  recipient?: string;
  bps?: number;
  minAmount?: string;
  fee?: { bips?: number; type?: string } | string;
};

export type ClassicQuoteResponse = {
  routing: "CLASSIC" | "WRAP" | "UNWRAP";
  quote: {
    input: { token: string; amount: string };
    output: { token: string; amount: string };
    slippage?: number;
    route?: unknown[];
    gasFee?: string;
    gasFeeUSD?: string;
    gasUseEstimate?: string;
    aggregatedOutputs?: AggregatedOutput[];
  };
  permitData: Record<string, unknown> | null;
};

export type UniswapXQuoteResponse = {
  routing: "DUTCH_V2" | "DUTCH_V3" | "PRIORITY";
  quote: {
    orderInfo: {
      outputs: Array<{
        token: string;
        startAmount: string;
        endAmount: string;
        recipient: string;
      }>;
      input: { token: string; startAmount: string; endAmount: string };
      deadline: number;
      nonce: string;
    };
    encodedOrder: string;
    orderHash: string;
  };
  permitData: Record<string, unknown> | null;
};

export type QuoteResponse = ClassicQuoteResponse | UniswapXQuoteResponse;

export type SwapTransaction = {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId?: number;
  gasLimit?: string;
};

const ALLOWED_TOKENS = new Set(
  Object.values(SWAP_TOKENS).map((t) => t.address.toLowerCase()),
);

const BUY_INPUT_ADDRESSES = new Set(
  BUY_SIDES.map((side) => SWAP_TOKENS[side].address.toLowerCase()),
);

export function isUniswapXQuote(q: QuoteResponse): q is UniswapXQuoteResponse {
  return q.routing === "DUTCH_V2" || q.routing === "DUTCH_V3" || q.routing === "PRIORITY";
}

export function rejectUnsafeInput(value: string, label: string): void {
  if (SHELL_META_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

export function parseSwapAddress(value: string): `0x${string}` {
  rejectUnsafeInput(value, "address");
  if (!ADDRESS_RE.test(value) || !isAddress(value)) {
    throw new Error("Invalid address");
  }
  return value as `0x${string}`;
}

export function parseAllowedToken(value: string): `0x${string}` {
  const addr = parseSwapAddress(value);
  if (!ALLOWED_TOKENS.has(addr.toLowerCase())) {
    throw new Error("Token not allowed");
  }
  return addr;
}

/**
 * Allowed pairs only:
 * - buy: USDC | WETH | ETH → $JUICE
 * - sell: $JUICE → ETH
 */
export function assertAllowedSwapPair(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
): void {
  const inL = tokenIn.toLowerCase();
  const outL = tokenOut.toLowerCase();
  const juice = JUICE_TOKEN.toLowerCase();
  const eth = NATIVE_ETH_ADDRESS.toLowerCase();

  if (BUY_INPUT_ADDRESSES.has(inL) && outL === juice) return;
  if (inL === juice && (outL === eth || outL === WETH_TOKEN.toLowerCase())) return;
  throw new Error("Pair not allowed");
}

export function parseWeiAmount(value: string): string {
  rejectUnsafeInput(value, "amount");
  if (!WEI_RE.test(value) || value.length > 78) {
    throw new Error("Invalid amount");
  }
  if (BigInt(value) <= 0n) throw new Error("Invalid amount");
  return value;
}

export function parseHumanAmount(value: string, decimals = 18): string {
  rejectUnsafeInput(value, "amount");
  const trimmed = value.trim();
  if (!AMOUNT_RE.test(trimmed)) throw new Error("Invalid amount");
  const wei = parseUnits(trimmed, decimals);
  if (wei <= 0n) throw new Error("Invalid amount");
  return wei.toString();
}

export function tokenByAddress(address: string): SwapTokenMeta {
  const lower = address.toLowerCase();
  for (const token of Object.values(SWAP_TOKENS)) {
    if (token.address.toLowerCase() === lower) return token;
  }
  throw new Error("Token not allowed");
}

export function sideByAddress(address: string): SwapSide {
  const lower = address.toLowerCase();
  for (const [side, token] of Object.entries(SWAP_TOKENS) as Array<
    [SwapSide, SwapTokenMeta]
  >) {
    if (token.address.toLowerCase() === lower) return side;
  }
  throw new Error("Token not allowed");
}

export function otherSide(side: SwapSide): SwapSide {
  return side === "juice" ? "eth" : "juice";
}

function isIntegratorOutput(output: AggregatedOutput): boolean {
  if (typeof output.fee === "string") return output.fee.toUpperCase() === "INTEGRATOR";
  if (output.fee && typeof output.fee === "object") {
    return output.fee.type?.toUpperCase() === "INTEGRATOR";
  }
  return false;
}

export function getOutputAmount(q: QuoteResponse): string {
  if (isUniswapXQuote(q)) {
    const first = q.quote.orderInfo.outputs[0];
    if (!first) throw new Error("UniswapX quote has no outputs");
    return first.startAmount;
  }
  const swapperOut = q.quote.aggregatedOutputs?.find(
    (output) => output.amount && !isIntegratorOutput(output),
  );
  if (swapperOut?.amount) return swapperOut.amount;
  return q.quote.output.amount;
}

export function getInputAmount(q: QuoteResponse): string {
  if (isUniswapXQuote(q)) return q.quote.orderInfo.input.startAmount;
  return q.quote.input.amount;
}

export function prepareSwapRequest(
  quoteResponse: QuoteResponse,
  signature?: string,
): Record<string, unknown> {
  const { permitData, permitTransaction: _permitTx, ...cleanQuote } =
    quoteResponse as QuoteResponse & { permitTransaction?: unknown };
  const request: Record<string, unknown> = { ...cleanQuote };

  if (isUniswapXQuote(quoteResponse)) {
    if (signature) request.signature = signature;
    return request;
  }

  if (signature && permitData && typeof permitData === "object") {
    request.signature = signature;
    request.permitData = permitData;
  }
  return request;
}

export function validateSwapBeforeBroadcast(swap: SwapTransaction): void {
  if (!swap.data || swap.data === "" || swap.data === "0x" || !isHex(swap.data)) {
    throw new Error("Quote expired — refresh and try again.");
  }
  if (!isAddress(swap.to) || !isAddress(swap.from)) {
    throw new Error("Invalid swap response");
  }
  if (swap.value === undefined || swap.value === null) {
    throw new Error("Invalid swap response");
  }
}

export function formatSwapAmount(wei: string, decimals = 18): string {
  try {
    const raw = Number(formatUnitsSafe(wei, decimals));
    if (!Number.isFinite(raw)) return formatUnitsSafe(wei, decimals);
    if (raw >= 1_000_000) {
      return raw.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (raw >= 1) {
      return raw.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return raw.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return wei;
  }
}

function formatUnitsSafe(wei: string, decimals: number): string {
  const value = BigInt(wei);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export const UNISWAP_TRADE_CHAIN_ID_STR = String(UNISWAP_TRADE_CHAIN_ID);
export const QUOTE_SWAPPER_FALLBACK =
  "0x0000000000000000000000000000000000000001" as `0x${string}`;
