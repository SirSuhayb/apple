import { fetchRaceState } from "@/lib/fetch-race";
import { LeaderboardPage } from "./LeaderboardPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const state = await fetchRaceState();
  const sorted = [...state.eaters].sort((a, b) => b.score - a.score);
  return <LeaderboardPage eaters={sorted} />;
}
