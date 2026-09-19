import { NextResponse } from "next/server";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { supplyApiHeaders } from "@/lib/circulating-supply";
import { fetchRaceState } from "@/lib/fetch-race";
import { sortLeaderboard, weiToTokens } from "@/lib/leaderboard-rank";
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
      : sortLeaderboard(state.eaters);
  return NextResponse.json(
    {
      eaters,
      phase: state.phase,
      act,
      scoring: act1.scoring ?? "act1",
      scoreScale: act1.scoreScale ?? null,
      updatedAt: act1.updatedAt ?? null,
      progress: state.progress,
      coreTarget: weiToTokens(state.coreTarget),
      supplyStats: act1.supplyStats ?? null,
    },
    { headers: supplyApiHeaders },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: supplyApiHeaders,
  });
}
