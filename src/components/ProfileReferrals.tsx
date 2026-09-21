"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { shortAddr } from "@/components/LeaderboardRow";
import {
  readBoundReferral,
  readPendingReferral,
  referralHomeUrl,
} from "@/lib/referrals";

export function ProfileReferrals({ address }: { address: string }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [bound, setBound] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setLink(referralHomeUrl(address, window.location.origin));
    setBound(readBoundReferral(address));
    setPending(readPendingReferral());
  }, [address]);

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mt-10">
      <p className="text-[11px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
        {copy.profile.referrals.eyebrow}
      </p>
      <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-[#1d1d1f]">
        {copy.profile.referrals.headline}
      </h2>
      <p className="mt-2 max-w-[480px] text-[13px] leading-relaxed text-[#6e6e73]">
        {copy.profile.referrals.body}
      </p>

      <div className="mt-5 rounded-[18px] border border-[#d2d2d7] bg-white px-5 py-5">
        <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
          {copy.profile.referrals.linkLabel}
        </p>
        <p className="mt-2 break-all font-mono text-[13px] leading-snug text-[#1d1d1f]">
          {link || "…"}
        </p>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="mt-3 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black"
        >
          {copied
            ? copy.profile.referrals.copied
            : copy.profile.referrals.copyLink}
        </button>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-[14px] border border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
              {copy.profile.referrals.countLabel}
            </div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#86868b]">
              {copy.profile.referrals.stubZero}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#d2d2d7] bg-[#fafafa] px-3 py-3 text-center">
            <div className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
              {copy.profile.referrals.earningsLabel}
            </div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#86868b]">
              {copy.profile.referrals.stubZero}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[#86868b]">
          {copy.profile.referrals.stubNote}
        </p>

        {bound ? (
          <p className="mt-3 text-[12px] text-[#6e6e73]">
            {copy.profile.referrals.boundNote(shortAddr(bound))}
          </p>
        ) : pending ? (
          <p className="mt-3 text-[12px] text-[#6e6e73]">
            {copy.profile.referrals.pendingNote(shortAddr(pending))}
          </p>
        ) : null}
      </div>
    </section>
  );
}
