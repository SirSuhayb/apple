import Link from "next/link";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbfbfd] px-6 py-16 text-center text-[#1d1d1f]">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">
        404
      </p>
      <h1 className="mt-3 text-[clamp(40px,10vw,64px)] font-bold tracking-[-0.04em]">
        Apple not found
      </h1>
      <p className="mt-3 max-w-sm text-[17px] leading-relaxed text-[#6e6e73]">
        That path isn’t in the orchard. Head home and keep eating.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-block rounded-full bg-[#1d1d1f] px-7 py-3.5 text-[17px] font-semibold text-white transition hover:bg-black"
        >
          Back to {copy.brand}
        </Link>
        <Link
          href="/leaderboard"
          className="text-[15px] font-medium text-[#2997ff]"
        >
          {copy.nav.leaderboard}
        </Link>
      </div>
    </div>
  );
}
