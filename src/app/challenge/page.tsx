import type { Metadata } from "next";
import { challengeCopy } from "@/lib/challenge-copy";
import { ChallengePage } from "./ChallengePage";

export const metadata: Metadata = {
  title: challengeCopy.meta.title,
  description: challengeCopy.meta.description,
  openGraph: {
    title: challengeCopy.meta.title,
    description: challengeCopy.meta.description,
    url: "https://bite.party/challenge",
  },
  twitter: {
    title: challengeCopy.meta.title,
    description: challengeCopy.meta.description,
  },
};

export default function Page() {
  return <ChallengePage />;
}
