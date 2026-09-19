import { NextResponse } from "next/server";
import {
  fetchCirculatingSupply,
  formatCirculatingPlain,
  supplyApiHeaders,
} from "@/lib/circulating-supply";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Plain circulating supply for CMC / CoinGecko.
 * Number = wallet-held (EOA) BITE only — not totalSupply, not LP.
 */
export async function GET() {
  const data = await fetchCirculatingSupply();
  if (data.circulatingSupply <= 0) {
    return new NextResponse("unavailable", {
      status: 503,
      headers: {
        ...supplyApiHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  return new NextResponse(formatCirculatingPlain(data.circulatingSupply), {
    status: 200,
    headers: {
      ...supplyApiHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: supplyApiHeaders,
  });
}
