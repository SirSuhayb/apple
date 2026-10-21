import { notFound } from "next/navigation";
import { JuiceAnnouncement } from "@/components/juice/JuiceAnnouncement";
import { JUICE_ENABLED } from "@/lib/juice-config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "$JUICE — Phase 2",
  description:
    "The game is over. Pour your seeds into the juicer, fill your container, and earn rev share from real-world juice brand sales. Powered by Juicebox V6 on Base.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  // Production stays dark until NEXT_PUBLIC_JUICE_ENABLED=true.
  if (!JUICE_ENABLED) notFound();
  return <JuiceAnnouncement />;
}
