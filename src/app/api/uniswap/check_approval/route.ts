import { NextResponse } from "next/server";
import {
  UNISWAP_TRADE_CHAIN_ID,
  parseAllowedToken,
  parseSwapAddress,
  parseWeiAmount,
} from "@/lib/uniswap-trade";
import { assertRobinhoodChain, tradeApiPost } from "@/lib/uniswap-trade-server";

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
    const token = parseAllowedToken(String(payload.token ?? ""));
    const amount = parseWeiAmount(String(payload.amount ?? ""));
    assertRobinhoodChain(payload.chainId ?? UNISWAP_TRADE_CHAIN_ID);

    const result = await tradeApiPost("check_approval", {
      walletAddress,
      token,
      amount,
      chainId: UNISWAP_TRADE_CHAIN_ID,
    });
    return NextResponse.json(result.json, {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval check failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
