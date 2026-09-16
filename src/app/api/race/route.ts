import { NextResponse } from "next/server";
import { fetchRaceState } from "@/lib/fetch-race";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [state, act1] = await Promise.all([
    fetchRaceState(),
    fetchAct1Leaderboard(),
  ]);
  return NextResponse.json(
    { ...state, supplyStats: act1.supplyStats ?? null },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}