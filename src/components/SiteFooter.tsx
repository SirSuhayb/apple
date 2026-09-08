import { copy } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer className="page-gutter border-t border-[#d2d2d7] bg-[#fbfbfd] pt-5 pb-9 text-center">
      <p className="mx-auto max-w-[460px] text-[11px] leading-[1.7] text-[#86868b]">
        {copy.footer.disclaimer}
      </p>
      <p className="mt-2 text-[11px] text-[#d2d2d7]">{copy.footer.colophon}</p>
    </footer>
  );
}
