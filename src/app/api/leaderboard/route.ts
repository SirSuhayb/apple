import { NextResponse } from "next/server";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { fetchRaceState } from "@/lib/fetch-race";
import { resolveSiteAct } from "@/lib/phase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = await fetchRaceState();
  const act = resolveSiteAct({
    progress: state.progress,
    eaterCount: state.eaters.length,
    racePhase: state.phase,
  });

  // All acts use the same real bot leaderboard data (Act I + II inclusive)
  const act1 = await fetchAct1Leaderboard();
  const eaters =
    act1.eaters.length > 0
      ? act1.eaters
      : [...state.eaters].sort((a, b) => b.score - a.score);
  return NextResponse.json(
    {
      eaters,
      phase: state.phase,
      act,
      scoring: "act1",
      updatedAt: act1.updatedAt ?? null,
      progress: state.progress,
      supplyStats: act1.supplyStats ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
