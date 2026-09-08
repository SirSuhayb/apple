import { NextResponse } from "next/server";
import { fetchRaceState } from "@/lib/fetch-race";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = await fetchRaceState();
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}