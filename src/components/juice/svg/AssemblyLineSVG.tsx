"use client";

/**
 * Assembly line dispensing animation.
 *
 * Eye-level view: the juicer dispenses juice into containers
 * moving along a conveyor belt. Pure SVG + CSS keyframes.
 */

import { ContainerForTier } from "./ContainerSVG";

export type AssemblyStage = "idle" | "dispensing" | "filling" | "done";

export function AssemblyLineSVG({
  containerTier,
  stage,
  label,
  className,
}: {
  containerTier: string;
  stage: AssemblyStage;
  label?: string;
  className?: string;
}) {
  const filling = stage === "filling" || stage === "done";
  const done = stage === "done";

  return (
    <div className={className}>
      <svg viewBox="0 0 600 320" className="w-full">
        <defs>
          <linearGradient id="conveyor-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6e6e73" />
            <stop offset="50%" stopColor="#8e8e93" />
            <stop offset="100%" stopColor="#6e6e73" />
          </linearGradient>
          <style>{`
            @keyframes conveyor-roll {
              from { transform: translateX(0); }
              to { transform: translateX(-30px); }
            }
            @keyframes pour-juice {
              0% { height: 0; y: 80; }
              30% { height: 120; y: 80; }
              100% { height: 120; y: 80; }
            }
            @keyframes container-slide {
              0% { transform: translateX(200px); opacity: 0; }
              20% { opacity: 1; }
              40% { transform: translateX(0); }
              100% { transform: translateX(0); }
            }
            @keyframes drip {
              0%, 100% { opacity: 0; }
              20%, 80% { opacity: 1; }
            }
            .conveyor-marks {
              animation: conveyor-roll 0.5s linear infinite;
            }
            .pouring-stream {
              animation: pour-juice 2s ease-out forwards;
            }
            .container-entering {
              animation: container-slide 1.5s ease-out forwards;
            }
            .drip-drop {
              animation: drip 0.8s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* Juicer machine (eye level — simplified side view) */}
        <g>
          {/* Machine body */}
          <rect x="40" y="20" width="160" height="200" rx="12"
            fill="#e5e5ea" stroke="#b0b0b8" strokeWidth="2" />
          {/* Machine face plate */}
          <rect x="55" y="40" width="130" height="80" rx="8"
            fill="#fafafa" stroke="#d2d2d7" strokeWidth="1.5" />
          {/* Status light */}
          <circle cx="120" cy="70" r="8"
            fill={filling ? "#34c759" : stage === "dispensing" ? "#f97316" : "#d2d2d7"}>
            {filling && (
              <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
            )}
          </circle>
          {/* Display text */}
          <text x="120" y="100" textAnchor="middle" fontSize="10" fill="#6e6e73"
            fontFamily="var(--font-mono), monospace" fontWeight="500">
            {done ? "DONE" : filling ? "FILLING" : stage === "dispensing" ? "READY" : "IDLE"}
          </text>
          {/* Spout */}
          <rect x="170" y="150" width="40" height="12" rx="3" fill="#c0c0c0" stroke="#999" strokeWidth="1" />
          <rect x="200" y="155" width="16" height="50" rx="2" fill="#c0c0c0" stroke="#999" strokeWidth="1" />
        </g>

        {/* Juice pouring stream */}
        {filling && (
          <rect x="205" y="80" width="6" height="0" rx="3"
            fill="#f97316" opacity="0.9"
            className="pouring-stream"
          />
        )}

        {/* Drips */}
        {filling && [0, 1, 2].map((i) => (
          <circle key={i} cx={208} cy={200 + i * 12} r="2.5" fill="#f97316"
            className="drip-drop" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}

        {/* Conveyor belt */}
        <rect x="0" y="260" width="600" height="20" rx="4"
          fill="url(#conveyor-grad)" />
        {/* Conveyor marks */}
        <g className={stage !== "idle" ? "conveyor-marks" : undefined}>
          {Array.from({ length: 25 }).map((_, i) => (
            <rect key={i} x={i * 30} y="265" width="2" height="10" rx="1"
              fill="#555" opacity="0.4" />
          ))}
        </g>
        {/* Conveyor legs */}
        <rect x="80" y="280" width="8" height="30" rx="2" fill="#6e6e73" />
        <rect x="300" y="280" width="8" height="30" rx="2" fill="#6e6e73" />
        <rect x="510" y="280" width="8" height="30" rx="2" fill="#6e6e73" />

        {/* Container on belt */}
        <g className={stage !== "idle" ? "container-entering" : undefined}>
          <foreignObject x="250" y="140" width="120" height="120">
            <ContainerForTier
              tier={containerTier}
              fillLevel={done ? 0.85 : filling ? 0.4 : 0}
              label={label}
              selected={done}
            />
          </foreignObject>
        </g>

        {/* Completed checkmark */}
        {done && (
          <g>
            <circle cx="310" cy="130" r="16" fill="#34c759" opacity="0.9" />
            <polyline points="302,130 308,136 320,124" fill="none"
              stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>
    </div>
  );
}
