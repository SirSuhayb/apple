import { copy, socialLinks } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer className="page-gutter border-t border-[#d2d2d7] bg-[#fbfbfd] pt-5 pb-9 text-center">
      <p className="mx-auto max-w-[460px] text-[11px] leading-[1.7] text-[#86868b]">
        {copy.footer.disclaimer}
      </p>
      <div className="mt-3.5 flex items-center justify-center gap-[18px]">
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
      </div>
      <p className="mt-2 text-[11px] text-[#d2d2d7]">{copy.footer.colophon}</p>
    </footer>
  );
}
