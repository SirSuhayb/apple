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

  // Act I (and Prologue): trades + points from bot state — no kitchen burns
  if (act <= 1) {
    const act1 = await fetchAct1Leaderboard();
    return NextResponse.json(
      {
        eaters: act1.eaters,
        phase: state.phase,
        act,
        scoring: "act1",
        updatedAt: act1.updatedAt ?? null,
        progress: state.progress,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const sorted = [...state.eaters].sort((a, b) => b.score - a.score);
  return NextResponse.json(
    {
      eaters: sorted,
      phase: state.phase,
      act,
      scoring: "kitchen",
      progress: state.progress,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
