import { NextResponse } from "next/server";
import { fetchRaceState } from "@/lib/fetch-race";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = await fetchRaceState();
  const sorted = [...state.eaters].sort((a, b) => b.score - a.score);

  return NextResponse.json(
    {
      eaters: sorted,
      phase: state.phase,
      progress: state.progress,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
