import { NextResponse } from "next/server";
import { CHAIN_ID } from "@/lib/config";
import {
  LP_PROTOCOL,
  parseAllowedToken,
  parseSwapAddress,
  parseWeiAmount,
} from "@/lib/uniswap-lp";
import { lpApiPost } from "@/lib/uniswap-lp-server";

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
    const rawTokens = Array.isArray(payload.lpTokens) ? payload.lpTokens : [];
    if (rawTokens.length === 0 || rawTokens.length > 2) {
      throw new Error("Invalid LP tokens");
    }
    const lpTokens = rawTokens.map((item) => {
      if (!item || typeof item !== "object") throw new Error("Invalid LP tokens");
      const row = item as { tokenAddress?: unknown; amount?: unknown };
      return {
        tokenAddress: parseAllowedToken(String(row.tokenAddress ?? "")),
        amount: parseWeiAmount(String(row.amount ?? "")),
      };
    });

    const result = await lpApiPost("lp/check_approval", {
      walletAddress,
      protocol: LP_PROTOCOL,
      chainId: CHAIN_ID,
      lpTokens,
      action: "CREATE",
      simulateTransaction: false,
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
