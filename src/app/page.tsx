import { RaceApp } from "@/components/RaceApp";
import { fetchRaceState } from "@/lib/fetch-race";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await fetchRaceState();
  return <RaceApp initial={initial} />;
}