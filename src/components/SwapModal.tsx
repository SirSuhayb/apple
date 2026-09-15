"use client";

import { useEffect } from "react";
import {
  AAPL_TOKEN,
  BITE_TOKEN,
  PONS_TOKEN_URL,
  SWAP_EMBED_ENABLED,
  SWAP_EMBED_URL,
  SWAP_OPEN_URL,
} from "@/lib/config";
import { copy } from "@/lib/copy";

type SwapModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Opt-in Uniswap swap surface (NEXT_PUBLIC_SWAP_PROVIDER=uniswap).
 * Day-1 primary CTAs deep-link to pons and do not mount this modal.
 * Optional iframe when NEXT_PUBLIC_SWAP_EMBED_ENABLED=true after Uniswap
 * allowlists this origin — see docs/uniswap-embed-allowlist.md.
 */
export function SwapModal({ open, onClose }: SwapModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const showEmbed = SWAP_EMBED_ENABLED;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.swap.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[22px] border border-[#d2d2d7] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#d2d2d7] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              {copy.swap.title}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              {copy.swap.uniswapNote}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#2997ff]"
          >
            {copy.swap.close}
          </button>
        </div>

        {showEmbed ? (
          <>
            <div className="relative min-h-[480px] flex-1 bg-[#f5f5f7]">
              <iframe
                title={copy.swap.iframeTitle}
                src={SWAP_EMBED_URL}
                className="h-[min(560px,70dvh)] w-full border-0"
                allow="clipboard-write; clipboard-read"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="flex flex-col gap-2 border-t border-[#d2d2d7] px-5 py-4">
              <p className="text-center text-[11px] leading-relaxed text-[#86868b]">
                {copy.swap.pairLabel(AAPL_TOKEN, BITE_TOKEN)}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={SWAP_OPEN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black"
                >
                  {copy.swap.openUniswap}
                </a>
                <a
                  href={PONS_TOKEN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-[#2997ff]"
                >
                  {copy.swap.openPons}
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-8 text-center">
            <p className="text-[15px] leading-relaxed text-[#6e6e73]">
              {copy.swap.deepLinkBody}
            </p>
            <p className="text-[12px] leading-relaxed text-[#86868b]">
              {copy.swap.pairLabel(AAPL_TOKEN, BITE_TOKEN)}
            </p>
            <a
              href={SWAP_OPEN_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black"
            >
              {copy.swap.openUniswap}
            </a>
            <a
              href={PONS_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] text-[#2997ff]"
            >
              {copy.swap.openPons}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
