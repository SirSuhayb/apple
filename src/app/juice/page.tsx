import { JuiceAnnouncement } from "@/components/juice/JuiceAnnouncement";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "$JUICE — Phase 2",
  description:
    "The game is over. Pour your seeds into the juicer, fill your container, and earn rev share from real-world juice brand sales. Powered by Juicebox V6 on Base.",
};

export default function Page() {
  return <JuiceAnnouncement />;
}
