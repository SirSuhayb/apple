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

  if (act <= 1) {
    const act1 = await fetchAct1Leaderboard();
    return <LeaderboardPage eaters={act1.eaters} mode="act1" />;
  }

  const sorted = [...state.eaters].sort((a, b) => b.score - a.score);
  return <LeaderboardPage eaters={sorted} mode="kitchen" />;
}
