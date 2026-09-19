import { NextResponse } from "next/server";
import { parseSwapAddress } from "@/lib/uniswap-lp";
import { listWalletPoolPositions } from "@/lib/uniswap-lp-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handlePositions(walletRaw: string | null) {
  try {
    const walletAddress = parseSwapAddress(String(walletRaw ?? ""));
    const positions = await listWalletPoolPositions(walletAddress);
    return NextResponse.json(
      { positions },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Positions failed";
    return NextResponse.json(
      { error: message, positions: [] },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handlePositions(url.searchParams.get("walletAddress"));
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON", positions: [] }, { status: 400 });
  }
  return handlePositions(
    typeof payload.walletAddress === "string" ? payload.walletAddress : null,
  );
}
