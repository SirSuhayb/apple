import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { fetchRaceState } from "@/lib/fetch-race";
import { resolveSiteAct } from "@/lib/phase";
import { LeaderboardPage } from "./LeaderboardPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const state = await fetchRaceState();
  const act = resolveSiteAct({
    progress: state.progress,
    eaterCount: state.eaters.length,
    racePhase: state.phase,
  });

  // All acts: inclusive leaderboard (Act I points/trades carry into Act II+)
  const act1 = await fetchAct1Leaderboard();
  const eaters =
    act1.eaters.length > 0
      ? act1.eaters
      : [...state.eaters].sort((a, b) => b.score - a.score);
  return (
    <LeaderboardPage
      eaters={eaters}
      mode="act1"
      supplyStats={act1.supplyStats ?? undefined}
    />
  );
}
