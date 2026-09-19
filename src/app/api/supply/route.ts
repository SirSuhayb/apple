import { NextResponse } from "next/server";
import {
  fetchCirculatingSupply,
  supplyApiHeaders,
} from "@/lib/circulating-supply";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** JSON supply breakdown. Circulating = EOA holder balances only. */
export async function GET() {
  const data = await fetchCirculatingSupply();
  if (data.circulatingSupply <= 0) {
    return NextResponse.json(
      { error: "circulating supply unavailable" },
      { status: 503, headers: supplyApiHeaders },
    );
  }
  return NextResponse.json(data, { headers: supplyApiHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: supplyApiHeaders,
  });
}
