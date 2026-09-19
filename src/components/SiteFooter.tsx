import Link from "next/link";
import { copy, socialLinks } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer className="page-gutter border-t border-[#d2d2d7] bg-[#fbfbfd] pt-5 pb-9 text-center">
      <p className="mx-auto max-w-[460px] text-[11px] leading-[1.7] text-[#6e6e73]">
        {copy.footer.disclaimer}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2">
        <a
          href={socialLinks.twitter}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-[#2997ff]"
        >
          {copy.take.social.twitter}
        </a>
        <a
          href={socialLinks.telegram}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-[#2997ff]"
        >
          {copy.take.social.telegram}
        </a>
        <Link href="/privacy" className="text-[13px] text-[#2997ff]">
          {copy.footer.privacy}
        </Link>
        <Link href="/terms" className="text-[13px] text-[#2997ff]">
          {copy.footer.terms}
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-[#6e6e73]">{copy.footer.colophon}</p>
    </footer>
  );
}
