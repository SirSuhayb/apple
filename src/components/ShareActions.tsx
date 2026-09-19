"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { shareBody, twitterIntentUrl } from "@/lib/share";

export function ShareActions({
  text,
  url,
  className = "",
}: {
  text: string;
  url?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const canNative =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const payload = shareBody(text, url);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const onNative = async () => {
    try {
      await navigator.share({ text: payload });
    } catch {
      // user cancelled
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <a
        href={twitterIntentUrl(text, url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center rounded-full bg-[#1d1d1f] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-black"
      >
        {copy.share.postX}
      </a>
      <div className="flex gap-2">
        {canNative && (
          <button
            type="button"
            onClick={() => void onNative()}
            className="flex-1 rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            {copy.share.share}
          </button>
        )}
        <button
          type="button"
          onClick={() => void onCopy()}
          className="flex-1 rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          {copied ? copy.share.copied : copy.share.copy}
        </button>
      </div>
    </div>
  );
}
