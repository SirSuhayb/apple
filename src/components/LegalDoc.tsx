import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { copy } from "@/lib/copy";

export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fbfbfd] text-[#1d1d1f]">
      <header className="border-b border-[#d2d2d7] bg-[rgba(251,251,253,0.82)] backdrop-blur-[20px]">
        <div className="page-gutter mx-auto flex h-12 max-w-[720px] items-center justify-between">
          <Link href="/" className="text-[17px] font-semibold">
            {copy.brand}
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium text-[#2997ff]"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="page-gutter mx-auto w-full max-w-[720px] flex-1 py-12 sm:py-16">
        <h1 className="text-[clamp(32px,6vw,44px)] font-bold tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] text-[#6e6e73]">Updated {updated}</p>
        <div className="legal-prose mt-10">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
