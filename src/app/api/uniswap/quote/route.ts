import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  QUOTE_SWAPPER_FALLBACK,
  SWAP_SLIPPAGE_PERCENT,
  UNISWAP_TRADE_CHAIN_ID_STR,
  assertAllowedSwapPair,
  parseAllowedToken,
  parseHumanAmount,
  parseSwapAddress,
  parseWeiAmount,
  swapIntegratorFees,
  SWAP_TOKENS,
  type SwapSide,
} from "@/lib/uniswap-trade";
import { assertRobinhoodChain, tradeApiPost } from "@/lib/uniswap-trade-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sideToAddress(side: string): `0x${string}` {
  const key = side.trim().toLowerCase();
  if (key in SWAP_TOKENS) {
    return SWAP_TOKENS[key as SwapSide].address;
  }
  return parseAllowedToken(side);
}

function resolveAmount(
  amount: string | null,
  amountWei: string | null,
  decimals: number,
): string {
  if (amountWei) return parseWeiAmount(amountWei);
  if (amount) return parseHumanAmount(amount, decimals);
  throw new Error("Missing amount");
}

function quoteBody(params: {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  swapper?: string | null;
}) {
  const tokenIn = sideToAddress(params.tokenIn);
  const tokenOut = sideToAddress(params.tokenOut);
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    throw new Error("Choose two different tokens");
  }
  assertAllowedSwapPair(tokenIn, tokenOut);
  let swapper = QUOTE_SWAPPER_FALLBACK;
  if (params.swapper && isAddress(params.swapper)) {
    swapper = parseSwapAddress(params.swapper);
  }
  const integratorFees = swapIntegratorFees();
  return {
    swapper,
    tokenIn,
    tokenOut,
    tokenInChainId: UNISWAP_TRADE_CHAIN_ID_STR,
    tokenOutChainId: UNISWAP_TRADE_CHAIN_ID_STR,
    amount: params.amount,
    type: "EXACT_INPUT",
    slippageTolerance: SWAP_SLIPPAGE_PERCENT,
    routingPreference: "BEST_PRICE",
    protocols: ["V4"],
    ...(integratorFees.length ? { integratorFees } : {}),
  };
}

async function handleQuote(params: {
  tokenIn: string | null;
  tokenOut: string | null;
  amount: string | null;
  amountWei: string | null;
  swapper: string | null;
}) {
  try {
    assertRobinhoodChain(UNISWAP_TRADE_CHAIN_ID_STR);
    const tokenIn = params.tokenIn ?? "aapl";
    const tokenOut = params.tokenOut ?? "bite";
    const tokenInAddress = sideToAddress(tokenIn);
    const tokenInMeta =
      Object.values(SWAP_TOKENS).find(
        (t) => t.address.toLowerCase() === tokenInAddress.toLowerCase(),
      ) ?? SWAP_TOKENS.aapl;
    const amount = resolveAmount(params.amount, params.amountWei, tokenInMeta.decimals);
    const body = quoteBody({
      tokenIn,
      tokenOut,
      amount,
      swapper: params.swapper,
    });
    const result = await tradeApiPost("quote", body);
    return NextResponse.json(result.json, {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote failed";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/** Quote without a wallet — used by SwapModal and curl verification. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleQuote({
    tokenIn: url.searchParams.get("tokenIn"),
    tokenOut: url.searchParams.get("tokenOut"),
    amount: url.searchParams.get("amount"),
    amountWei: url.searchParams.get("amountWei"),
    swapper: url.searchParams.get("swapper"),
  });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  return handleQuote({
    tokenIn: typeof payload.tokenIn === "string" ? payload.tokenIn : null,
    tokenOut: typeof payload.tokenOut === "string" ? payload.tokenOut : null,
    amount: typeof payload.amount === "string" ? payload.amount : null,
    amountWei: typeof payload.amountWei === "string" ? payload.amountWei : null,
    swapper: typeof payload.swapper === "string" ? payload.swapper : null,
  });
}
