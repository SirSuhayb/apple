"use client";

import {
  bestContainer,
  seedsToNextTier,
  seedsToOz,
  seedPulp,
  CONTAINER_TIERS,
} from "@/lib/seeds";

export function SeedsCounter({
  seeds,
  className = "",
}: {
  seeds: number;
  className?: string;
}) {
  const oz = seedsToOz(seeds);
  const pulp = seedPulp(seeds);
  const container = bestContainer(seeds);
  const next = seedsToNextTier(seeds);

  return (
    <div
      className={`rounded-[18px] border border-[#34c759]/30 bg-[#34c759]/5 px-5 py-5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[1.5px] text-[#34c759] uppercase">
            Seeds
          </p>
          <p className="mt-1 text-[32px] font-black tabular-nums leading-none text-[#1d1d1f]">
            {seeds.toLocaleString()}
          </p>
          <p className="mt-1.5 text-[13px] text-[#6e6e73]">
            {oz > 0
              ? `${oz} oz · ${pulp} pulp`
              : `${pulp} seed${pulp === 1 ? "" : "s"} toward first oz`}
          </p>
        </div>
        <div className="text-right">
          {container ? (
            <>
              <span className="text-[36px] leading-none">
                {container.emoji}
              </span>
              <p className="mt-1 text-[11px] font-semibold text-[#1d1d1f]">
                {container.name}
              </p>
            </>
          ) : (
            <>
              <span className="text-[36px] leading-none opacity-30">🌱</span>
              <p className="mt-1 text-[11px] text-[#6e6e73]">Growing</p>
            </>
          )}
        </div>
      </div>

      {next && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#6e6e73]">
              {next.needed.toLocaleString()} seeds to{" "}
              {next.tier.emoji} {next.tier.name}
            </span>
            <span className="font-medium tabular-nums text-[#1d1d1f]">
              {seeds}/{next.tier.seeds}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e5e5ea]">
            <div
              className="h-full rounded-full bg-[#34c759] transition-all duration-500"
              style={{
                width: `${Math.min(100, (seeds / next.tier.seeds) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {CONTAINER_TIERS.slice()
          .reverse()
          .map((tier) => {
            const reached = seeds >= tier.seeds;
            return (
              <div
                key={tier.name}
                className={`rounded-lg px-2 py-1.5 text-center text-[10px] ${
                  reached
                    ? "bg-[#34c759]/10 font-semibold text-[#34c759]"
                    : "bg-[#f5f5f7] text-[#6e6e73]"
                }`}
              >
                <span className="text-sm">{tier.emoji}</span>
                <br />
                {tier.oz}oz
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function SeedsEmpty({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-[18px] border border-dashed border-[#d2d2d7] bg-[#fafafa] px-5 py-5 text-center ${className}`}
    >
      <span className="text-[32px] opacity-30">🌱</span>
      <p className="mt-2 text-[15px] font-semibold text-[#1d1d1f]">
        No seeds yet
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
        Every trade and burn earns seeds. Seeds determine what happens after the
        game ends.
      </p>
    </div>
  );
}
