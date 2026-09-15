import { RaceApp } from "@/components/RaceApp";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { fetchRaceState } from "@/lib/fetch-race";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initial, act1] = await Promise.all([
    fetchRaceState(),
    fetchAct1Leaderboard(),
  ]);
  return <RaceApp initial={initial} act1Eaters={act1.eaters} />;
}
