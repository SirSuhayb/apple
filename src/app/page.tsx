import { RaceApp } from "@/components/RaceApp";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { fetchRaceState } from "@/lib/fetch-race";
import { sortLeaderboard } from "@/lib/leaderboard-rank";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initial, act1] = await Promise.all([
    fetchRaceState(),
    fetchAct1Leaderboard(),
  ]);
  const eaters =
    act1.eaters.length > 0
      ? act1.eaters
      : sortLeaderboard(initial.eaters);
  return (
    <RaceApp
      initial={{ ...initial, supplyStats: act1.supplyStats ?? null }}
      act1Eaters={eaters}
    />
  );
}
