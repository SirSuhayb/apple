import { NextResponse } from "next/server";
import { CHAIN_ID } from "@/lib/config";
import {
  LP_PROTOCOL,
  parseSwapAddress,
  parseTokenId,
  sortedLpPair,
} from "@/lib/uniswap-lp";
import {
  assertWalletOwnsPoolPosition,
  lpApiPost,
} from "@/lib/uniswap-lp-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parsePercent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 100);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error("Invalid amount");
  }
  return n;
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const walletAddress = parseSwapAddress(String(payload.walletAddress ?? ""));
    const tokenId = parseTokenId(String(payload.tokenId ?? ""));
    const liquidityPercentageToDecrease = parsePercent(
      payload.liquidityPercentageToDecrease ?? payload.percent,
    );
    await assertWalletOwnsPoolPosition(walletAddress, BigInt(tokenId));

    const { token0, token1 } = sortedLpPair();
    const result = await lpApiPost("lp/decrease", {
      walletAddress,
      chainId: CHAIN_ID,
      protocol: LP_PROTOCOL,
      nftTokenId: tokenId,
      token0Address: token0,
      token1Address: token1,
      liquidityPercentageToDecrease,
      simulateTransaction: false,
    });
    return NextResponse.json(result.json, {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remove failed";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
