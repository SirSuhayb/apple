"use client";

import { useState } from "react";
import { SLICES, type SliceId } from "@/lib/whitepaper";

const CX = 200;
const CY = 200;
const OUTER = 148;
const INNER = 58;

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [r2(CX + Math.cos(rad) * radius), r2(CY + Math.sin(rad) * radius)];
}

function wedge(start: number, sweep: number): string {
  const gap = 1.15;
  const a0 = start + gap / 2;
  const a1 = start + sweep - gap / 2;
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(a0, OUTER);
  const [x1, y1] = polar(a1, OUTER);
  const [ix0, iy0] = polar(a0, INNER);
  const [ix1, iy1] = polar(a1, INNER);
  return [
    `M ${x0} ${y0}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${x1} ${y1}`,
    `L ${ix1} ${iy1}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${ix0} ${iy0}`,
    "Z",
  ].join(" ");
}

function tokens(n: number): string {
  return n.toLocaleString("en-US");
}

export function AppleAllocation() {
  const [active, setActive] = useState<SliceId>("players");
  const selected = SLICES.find((slice) => slice.id === active) ?? SLICES[0];

  const paths = SLICES.map((slice, index) => {
    const start = SLICES.slice(0, index).reduce(
      (sum, row) => sum + (row.pct / 100) * 360,
      0,
    );
    const sweep = (slice.pct / 100) * 360;
    const mid = start + sweep / 2;
    const [lx, ly] = polar(mid, (OUTER + INNER) / 2);
    return { slice, d: wedge(start, sweep), lx, ly };
  });

  return (
    <div className="grid items-center gap-8 md:grid-cols-[minmax(0,420px)_1fr]">
      <svg
        viewBox="0 0 400 420"
        role="img"
        aria-label="Apple cross-section split into the four token slices"
        className="mx-auto w-full max-w-[420px]"
      >
        <ellipse cx="200" cy="36" rx="7" ry="16" fill="#6d4c41" />
        <path
          d="M206 28c18-22 48-18 54-4-16 2-32 12-40 28"
          fill="#7da85a"
        />
        <circle cx="200" cy="200" r="168" fill="#c62828" />
        <circle cx="200" cy="200" r="156" fill="#f6e7d4" />
        {paths.map(({ slice, d }) => (
          <path
            key={slice.id}
            d={d}
            fill={active === slice.id ? slice.hue : slice.flesh}
            stroke="#fbfbfd"
            strokeWidth={active === slice.id ? 2 : 0}
            className="cursor-pointer transition-[fill] duration-200"
            onMouseEnter={() => setActive(slice.id)}
            onFocus={() => setActive(slice.id)}
            onClick={() => setActive(slice.id)}
            tabIndex={0}
            role="button"
            aria-pressed={active === slice.id}
            aria-label={`${slice.label}, ${slice.pct} percent`}
          />
        ))}
        <circle cx="200" cy="200" r="54" fill="#fbf6ee" />
        <circle cx="200" cy="200" r="46" fill="#f3e6cf" />
        {[0, 72, 144, 216, 288].map((deg) => {
          const [sx, sy] = polar(deg + 18, 24);
          return (
            <ellipse
              key={deg}
              cx={sx}
              cy={sy}
              rx="5.5"
              ry="8"
              transform={`rotate(${deg + 18} ${sx} ${sy})`}
              fill="#5d4037"
            />
          );
        })}
        {paths.map(({ slice, lx, ly }) =>
          slice.pct >= 10 ? (
            <text
              key={`${slice.id}-label`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={slice.id === "liquidity" ? "#6d4c41" : "#fff"}
              fontSize={slice.pct > 20 ? 18 : 13}
              fontWeight={600}
              className="pointer-events-none"
            >
              {slice.pct}%
            </text>
          ) : null,
        )}
      </svg>

      <div>
        <p className="text-[13px] font-medium tracking-[0.08em] text-[#6e6e73] uppercase">
          One billion tokens
        </p>
        <h3 className="mt-2 text-[32px] leading-none font-semibold tracking-[-0.03em]">
          {selected.pct}% {selected.label.toLowerCase()}
        </h3>
        <p className="mt-3 font-mono text-[15px] text-[#1d1d1f]">
          {tokens(selected.tokens)} $JUICE
        </p>
        <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-[#6e6e73]">
          {selected.line}
        </p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {SLICES.map((slice) => (
            <li key={slice.id}>
              <button
                type="button"
                onClick={() => setActive(slice.id)}
                className="rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
                style={{
                  borderColor: active === slice.id ? slice.hue : "#d2d2d7",
                  background: active === slice.id ? slice.flesh : "#fff",
                  color: "#1d1d1f",
                }}
              >
                {slice.label} {slice.pct}%
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
