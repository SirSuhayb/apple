import { NextResponse } from "next/server";
import { prepareSwapRequest, type QuoteResponse } from "@/lib/uniswap-trade";
import { tradeApiPost } from "@/lib/uniswap-trade-server";

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
    const { signature, quote } = payload;
    const sig = typeof signature === "string" ? signature : undefined;
    if (sig && (!sig.startsWith("0x") || sig.length < 10 || sig.length > 2000)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const quoteResponse = (
      quote && typeof quote === "object" && "routing" in quote
        ? quote
        : payload.routing
          ? payload
          : null
    ) as QuoteResponse | null;

    if (!quoteResponse?.routing || !quoteResponse.quote) {
      return NextResponse.json({ error: "Missing quote" }, { status: 400 });
    }

    const body = prepareSwapRequest(quoteResponse, sig);
    const result = await tradeApiPost("swap", body);
    return NextResponse.json(result.json, {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Swap failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
