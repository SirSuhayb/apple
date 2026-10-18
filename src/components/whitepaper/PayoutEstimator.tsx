"use client";

import { useState } from "react";
import {
  CONTAINERS,
  PRESSED_BOTTLES_ESTIMATE,
  RED_BULL_CANS_2025,
  YEAR1_BOTTLES,
  containerPayout,
  dividendPool,
} from "@/lib/whitepaper";

const SCALES = [
  {
    id: "year1",
    label: "Year 1",
    bottles: YEAR1_BOTTLES,
    note: "10,000 a quarter",
  },
  {
    id: "pressed",
    label: "Pressed",
    bottles: PRESSED_BOTTLES_ESTIMATE,
    note: "about 5 million",
  },
  {
    id: "redbull",
    label: "Red Bull",
    bottles: RED_BULL_CANS_2025,
    note: "13.969 billion cans",
  },
] as const;

const LOG_MIN = Math.log10(1_000);
const LOG_MAX = Math.log10(20_000_000_000);

function sliderToBottles(value: number): number {
  const log = LOG_MIN + (value / 1000) * (LOG_MAX - LOG_MIN);
  return Math.max(1, Math.round(10 ** log));
}

function bottlesToSlider(bottles: number): number {
  const clamped = Math.min(10 ** LOG_MAX, Math.max(10 ** LOG_MIN, bottles));
  return Math.round(((Math.log10(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
}

function count(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)} billion`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} million`;
  return n.toLocaleString("en-US");
}

function money(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  const digits = abs >= 1_000 && Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PayoutEstimator() {
  const [bottles, setBottles] = useState(YEAR1_BOTTLES);
  const active = SCALES.find((scale) => scale.bottles === bottles)?.id;
  const pool = dividendPool(bottles);
  const perDay = bottles / 365;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SCALES.map((scale) => (
          <button
            key={scale.id}
            type="button"
            onClick={() => setBottles(scale.bottles)}
            className="rounded-full px-3 py-1.5 text-left text-[13px] font-medium"
            style={{
              background: active === scale.id ? "#1d1d1f" : "#fff",
              color: active === scale.id ? "#fff" : "#1d1d1f",
              border: "1px solid #d2d2d7",
            }}
          >
            {scale.label}
            <span className={active === scale.id ? "text-white/70" : "text-[#6e6e73]"}>
              {" "}
              · {scale.note}
            </span>
          </button>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="text-[13px] font-medium tracking-[0.08em] text-[#6e6e73] uppercase">
          Bottles in the year
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={bottlesToSlider(bottles)}
          onChange={(event) => setBottles(sliderToBottles(Number(event.target.value)))}
          aria-valuetext={count(bottles)}
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#e8e8ed] accent-[#e53935]"
        />
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[13px] text-[#6e6e73]">This year</p>
          <p className="mt-1 font-mono text-[28px] leading-none font-semibold tracking-[-0.04em]">
            {count(bottles)}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-[#6e6e73]">A day</p>
          <p className="mt-1 font-mono text-[28px] leading-none font-semibold tracking-[-0.04em]">
            {perDay >= 100 ? Math.round(perDay).toLocaleString("en-US") : perDay.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-[#6e6e73]">Dividend pool</p>
          <p className="mt-1 font-mono text-[28px] leading-none font-semibold tracking-[-0.04em]">
            {money(pool)}
          </p>
        </div>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CONTAINERS.map((tier) => {
          const year = containerPayout(tier.oz, bottles);
          return (
            <li key={tier.name} className="rounded-[20px] bg-white px-4 py-4">
              <p className="text-[14px] font-semibold">{tier.name}</p>
              <p className="mt-2 font-mono text-[22px] leading-none tracking-[-0.03em]">
                {money(year / 4)}
              </p>
              <p className="mt-1 text-[12px] text-[#6e6e73]">a quarter</p>
              <p className="mt-3 font-mono text-[13px] text-[#6e6e73]">{money(year)} a year</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
