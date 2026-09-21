import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { fetchAct1Leaderboard } from "@/lib/act1-leaderboard";
import { copy } from "@/lib/copy";
import { fetchRaceState } from "@/lib/fetch-race";
import { sortLeaderboard, weiToTokens } from "@/lib/leaderboard-rank";
import { ProfilePublicPage } from "@/components/ProfilePage";

export const dynamic = "force-dynamic";

type Params = { address: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { address } = await params;
  const short =
    isAddress(address) && address.length > 10
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : address;
  return {
    title: `${short} · ${copy.profile.title} · ${copy.brand}`,
    description: copy.profile.subtitle,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const [state, act1] = await Promise.all([
    fetchRaceState(),
    fetchAct1Leaderboard(),
  ]);
  const eaters =
    act1.eaters.length > 0 ? act1.eaters : sortLeaderboard(state.eaters);

  return (
    <ProfilePublicPage
      address={address}
      initialEaters={eaters}
      initialSupplyStats={act1.supplyStats ?? undefined}
      initialCoreTarget={weiToTokens(state.coreTarget)}
    />
  );
}
