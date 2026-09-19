import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { CHAIN_ID, V4_POOL_ID } from "@/lib/config";
import {
  LP_FEE_POOL_ID,
  LP_PROTOCOL,
  LP_SEED_TICK_SPACING,
  LP_SLIPPAGE_PERCENT,
  existingPoolBody,
  fullRangeTicks,
  newFeePoolBody,
  parseLpIndependent,
  parseHumanAmount,
  parseSwapAddress,
  parseWeiAmount,
} from "@/lib/uniswap-lp";
import { QUOTE_SWAPPER_FALLBACK } from "@/lib/uniswap-trade";
import { lookupPools, lpApiPost, poolById } from "@/lib/uniswap-lp-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveAmount(amount: string | null, amountWei: string | null): string {
  if (amountWei) return parseWeiAmount(amountWei);
  if (amount) return parseHumanAmount(amount);
  throw new Error("Missing amount");
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const independentToken = parseLpIndependent(
      String(payload.tokenIn ?? payload.independentToken ?? "bite"),
    );
    const amount = resolveAmount(
      typeof payload.amount === "string" ? payload.amount : null,
      typeof payload.amountWei === "string" ? payload.amountWei : null,
    );

    let walletAddress = QUOTE_SWAPPER_FALLBACK;
    if (typeof payload.walletAddress === "string" && isAddress(payload.walletAddress)) {
      walletAddress = parseSwapAddress(payload.walletAddress);
    }

    const pools = await lookupPools([LP_FEE_POOL_ID, V4_POOL_ID]);
    const feePool = poolById(pools, LP_FEE_POOL_ID);
    const livePool = poolById(pools, V4_POOL_ID);
    const ticks = fullRangeTicks(LP_SEED_TICK_SPACING);

    const body: Record<string, unknown> = {
      walletAddress,
      chainId: CHAIN_ID,
      protocol: LP_PROTOCOL,
      independentToken: { tokenAddress: independentToken, amount },
      tickBounds: ticks,
      slippageTolerance: LP_SLIPPAGE_PERCENT,
      simulateTransaction: false,
    };

    if (feePool) {
      body.existingPool = existingPoolBody(LP_FEE_POOL_ID);
    } else {
      const initialPrice = livePool?.sqrtRatioX96;
      if (!initialPrice || !/^\d+$/.test(initialPrice)) {
        throw new Error("Couldn’t price the 1% pool from the live pair.");
      }
      body.newPool = newFeePoolBody(initialPrice);
    }

    const signature =
      typeof payload.signature === "string" ? payload.signature : undefined;
    if (signature) {
      if (!signature.startsWith("0x") || signature.length < 10 || signature.length > 2000) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
      body.signature = signature;
    }
    if (
      payload.batchPermitData &&
      typeof payload.batchPermitData === "object" &&
      signature
    ) {
      body.batchPermitData = payload.batchPermitData;
    }

    const result = await lpApiPost("lp/create", body);
    return NextResponse.json(result.json, {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LP create failed";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
