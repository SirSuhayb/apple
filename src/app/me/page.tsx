import type { Metadata } from "next";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { copy } from "@/lib/copy";
import { fetchRaceState } from "@/lib/fetch-race";
import { sortLeaderboard, weiToTokens } from "@/lib/leaderboard-rank";
import { ProfileMePage } from "@/components/ProfilePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.profile.title} · ${copy.brand}`,
  description: copy.profile.subtitle,
};

export default async function MePage() {
  const [state, act1] = await Promise.all([
    fetchRaceState(),
    fetchAct1Leaderboard(),
  ]);
  const eaters =
    act1.eaters.length > 0 ? act1.eaters : sortLeaderboard(state.eaters);

  return (
    <ProfileMePage
      initialEaters={eaters}
      initialSupplyStats={act1.supplyStats ?? undefined}
      initialCoreTarget={weiToTokens(state.coreTarget)}
    />
  );
}
