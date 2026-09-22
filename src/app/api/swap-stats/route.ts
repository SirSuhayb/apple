import { NextResponse } from "next/server";
import { supplyApiHeaders } from "@/lib/circulating-supply";
import {
  emptyNativeSwapStats,
  fetchNativeSwapStats,
  forwardClientSwapLog,
  type ClientSwapLog,
} from "@/lib/native-swap-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET() {
  try {
    const stats = await fetchNativeSwapStats();
    return NextResponse.json(stats, {
      headers: {
        ...supplyApiHeaders,
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (e) {
    const fallback = emptyNativeSwapStats();
    fallback.limits = e instanceof Error ? e.message : "failed to load";
    return NextResponse.json(fallback, {
      status: 200,
      headers: supplyApiHeaders,
    });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const txHash = String(body.txHash || body.tx || body.hash || "");
  const wallet = String(body.wallet || body.address || "");
  if (!TX_RE.test(txHash)) {
    return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });
  }
  if (!ADDR_RE.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const sideRaw = String(body.side || "").toLowerCase();
  const side =
    sideRaw === "buy" || sideRaw === "sell"
      ? sideRaw
      : ("unknown" as const);

  const payload: ClientSwapLog = {
    txHash: txHash.toLowerCase(),
    wallet: wallet.toLowerCase(),
    side,
    tokenIn: String(body.tokenIn || body.token_in || ""),
    tokenOut: String(body.tokenOut || body.token_out || ""),
    amountIn: String(body.amountIn || body.amount_in || ""),
    amountOut: String(body.amountOut || body.amount_out || ""),
    feeToken:
      body.feeToken === "AAPL" || body.feeToken === "BITE"
        ? body.feeToken
        : undefined,
  };

  const result = await forwardClientSwapLog(payload);
  return NextResponse.json(
    {
      ok: result.ok,
      forwarded: result.forwarded ?? false,
      txHash: payload.txHash,
      error: result.error,
    },
    {
      status: result.ok ? 200 : 502,
      headers: { ...supplyApiHeaders, "Cache-Control": "no-store" },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: supplyApiHeaders,
  });
}
