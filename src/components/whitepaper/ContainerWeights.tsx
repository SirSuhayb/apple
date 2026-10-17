"use client";

import { useState } from "react";
import {
  CONTAINERS,
  dividendPerThousand,
  oneContainerShare,
  tierShare,
  type ContainerKind,
} from "@/lib/whitepaper";

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function Vessel({ kind, fill }: { kind: ContainerKind; fill: number }) {
  const juice = Math.max(0.08, Math.min(1, fill));
  if (kind === "box") {
    return (
      <svg viewBox="0 0 80 120" className="h-28 w-auto" aria-hidden>
        <rect x="18" y="28" width="44" height="78" rx="4" fill="#f7f4ef" stroke="#d2d2d7" />
        <clipPath id="box-juice">
          <rect x="18" y="28" width="44" height="78" rx="4" />
        </clipPath>
        <rect
          x="18"
          y={28 + 78 * (1 - juice)}
          width="44"
          height={78 * juice}
          fill="#e53935"
          clipPath="url(#box-juice)"
        />
        <path
          d="M40 32 V14 H54"
          fill="none"
          stroke="#c62828"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "bottle") {
    return (
      <svg viewBox="0 0 80 120" className="h-32 w-auto" aria-hidden>
        <path
          d="M34 8h12v16c8 6 16 16 16 32v40c0 8-8 14-22 14s-22-6-22-14V56c0-16 8-26 16-32V8z"
          fill="#f7f4ef"
          stroke="#d2d2d7"
        />
        <clipPath id="bottle-juice">
          <path d="M34 8h12v16c8 6 16 16 16 32v40c0 8-8 14-22 14s-22-6-22-14V56c0-16 8-26 16-32V8z" />
        </clipPath>
        <rect
          x="16"
          y={28 + 80 * (1 - juice)}
          width="48"
          height={80 * juice}
          fill="#e53935"
          clipPath="url(#bottle-juice)"
          opacity="0.9"
        />
      </svg>
    );
  }
  if (kind === "jar") {
    return (
      <svg viewBox="0 0 90 120" className="h-32 w-auto" aria-hidden>
        <rect x="24" y="16" width="42" height="12" rx="2" fill="#d7ccc8" />
        <rect x="28" y="12" width="34" height="8" rx="2" fill="#efebe9" />
        <path
          d="M26 28h38v62c0 12-8 20-19 20s-19-8-19-20V28z"
          fill="#f7f4ef"
          stroke="#d2d2d7"
        />
        <clipPath id="jar-juice">
          <path d="M26 28h38v62c0 12-8 20-19 20s-19-8-19-20V28z" />
        </clipPath>
        <rect
          x="24"
          y={30 + 78 * (1 - juice)}
          width="42"
          height={78 * juice}
          fill="#e53935"
          clipPath="url(#jar-juice)"
          opacity="0.9"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 120" className="h-36 w-auto" aria-hidden>
      <path
        d="M30 18h28l6 10v68c0 14-8 22-20 22s-20-8-20-22V28l6-10z"
        fill="#f7f4ef"
        stroke="#d2d2d7"
      />
      <rect x="38" y="8" width="18" height="12" rx="2" fill="#8d6e63" />
      <clipPath id="growler-juice">
        <path d="M30 18h28l6 10v68c0 14-8 22-20 22s-20-8-20-22V28l6-10z" />
      </clipPath>
      <rect
        x="22"
        y={24 + 86 * (1 - juice)}
        width="56"
        height={86 * juice}
        fill="#c62828"
        clipPath="url(#growler-juice)"
        opacity="0.92"
      />
    </svg>
  );
}

export function ContainerWeights() {
  const [mode, setMode] = useState<"one" | "tier">("one");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("one")}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium"
          style={{
            background: mode === "one" ? "#1d1d1f" : "#fff",
            color: mode === "one" ? "#fff" : "#1d1d1f",
            border: "1px solid #d2d2d7",
          }}
        >
          One container
        </button>
        <button
          type="button"
          onClick={() => setMode("tier")}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium"
          style={{
            background: mode === "tier" ? "#1d1d1f" : "#fff",
            color: mode === "tier" ? "#fff" : "#1d1d1f",
            border: "1px solid #d2d2d7",
          }}
        >
          Whole tier today
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CONTAINERS.map((tier) => {
          const share =
            mode === "one"
              ? oneContainerShare(tier.oz)
              : tierShare(tier.oz, tier.count);
          const fill = mode === "one" ? tier.shares / 8 : share;
          return (
            <li
              key={tier.name}
              className="flex flex-col items-center rounded-[20px] bg-white px-3 py-5 text-center"
            >
              <Vessel kind={tier.kind} fill={mode === "one" ? fill : 0.72} />
              <p className="mt-3 text-[15px] font-semibold">{tier.name}</p>
              <p className="mt-1 font-mono text-[20px] tracking-[-0.03em]">
                {pct(share)}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-[#6e6e73]">
                {tier.shares} {tier.shares === 1 ? "share" : "shares"}
                {mode === "one"
                  ? ` · ${usd(dividendPerThousand(tier.oz))} / 1,000 bottles`
                  : ` · ${tier.count} poured`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
