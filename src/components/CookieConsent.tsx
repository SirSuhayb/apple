"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const STORAGE_KEY = "bite-cookie-consent";

type Consent = "accepted" | "essential" | null;

function readConsent(): Consent {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "accepted" || raw === "essential") return raw;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

function writeConsent(value: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  const choose = (value: Exclude<Consent, null>) => {
    writeConsent(value);
    setConsent(value);
  };

  return (
    <>
      {consent === "accepted" ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}

      {ready && consent === null ? (
        <div
          role="dialog"
          aria-label="Cookie preferences"
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#d2d2d7] bg-[rgba(251,251,253,0.96)] px-4 py-4 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] backdrop-blur-md sm:px-6"
        >
          <div className="mx-auto flex max-w-[720px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p className="text-[13px] leading-relaxed text-[#6e6e73]">
              We use essential storage for wallet connection, plus optional
              analytics if you allow it.{" "}
              <Link href="/privacy" className="text-[#2997ff] underline-offset-2 hover:underline">
                Privacy
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => choose("essential")}
                className="rounded-full border border-[#d2d2d7] bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f]"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => choose("accepted")}
                className="rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
