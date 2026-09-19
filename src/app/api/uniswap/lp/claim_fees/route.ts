import { NextResponse } from "next/server";
import { CHAIN_ID } from "@/lib/config";
import { LP_PROTOCOL, parseSwapAddress, parseTokenId } from "@/lib/uniswap-lp";
import {
  assertWalletOwnsPoolPosition,
  lpApiPost,
} from "@/lib/uniswap-lp-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    await assertWalletOwnsPoolPosition(walletAddress, BigInt(tokenId));

    const result = await lpApiPost("lp/claim_fees", {
      walletAddress,
      chainId: CHAIN_ID,
      protocol: LP_PROTOCOL,
      tokenId,
      simulateTransaction: false,
    });
    return NextResponse.json(result.json, {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
