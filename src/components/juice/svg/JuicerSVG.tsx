"use client";

/**
 * Top-down SVG juicer — the centrepiece of the /juice announcement.
 *
 * States: closed → open (lid lifts) → filling (seeds/chunks drop in)
 *       → blending (spin animation) → dispensing (juice pours out)
 *
 * All geometry is hand-coded SVG so it renders crisply at any size
 * and animates with CSS transitions/keyframes.
 */

import { type CSSProperties } from "react";

export type JuicerState =
  | "closed"
  | "open"
  | "filling"
  | "blending"
  | "dispensing"
  | "done";

const BLADE_COLOR = "#c0c0c0";
const JUICE_COLOR = "#f97316";
const BODY_COLOR = "#e5e5ea";
const BODY_STROKE = "#b0b0b8";
const LID_COLOR = "#d2d2d7";
const SEED_COLORS = ["#8B6914", "#6B4E12", "#A67B1C", "#7D5E1A", "#9B7118"];

export function JuicerSVG({
  state,
  onTap,
  seedCount = 0,
  pulpLevel = 0,
  className,
  style,
}: {
  state: JuicerState;
  onTap?: () => void;
  seedCount?: number;
  pulpLevel?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const isOpen = state !== "closed";
  const isBlending = state === "blending";
  const isFilling = state === "filling";
  const isDispensing = state === "dispensing" || state === "done";

  const juiceLevel = isDispensing ? 0.7 + pulpLevel * 0.1 : isFilling ? 0.15 : 0;
  const juiceY = 200 - juiceLevel * 140;

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      style={{ cursor: state === "closed" ? "pointer" : undefined, ...style }}
      onClick={state === "closed" ? onTap : undefined}
      role={state === "closed" ? "button" : undefined}
      aria-label={state === "closed" ? "Tap to open the juicer" : "Juicer"}
    >
      <defs>
        <radialGradient id="juicer-body-grad" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#f5f5f7" />
          <stop offset="100%" stopColor={BODY_COLOR} />
        </radialGradient>
        <radialGradient id="juice-grad" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="100%" stopColor={JUICE_COLOR} />
        </radialGradient>
        <radialGradient id="lid-grad" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ececec" />
          <stop offset="100%" stopColor={LID_COLOR} />
        </radialGradient>
        <filter id="juicer-shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.12" />
        </filter>
        <clipPath id="bowl-clip">
          <ellipse cx="200" cy="200" rx="120" ry="100" />
        </clipPath>

        {/* Blending spin */}
        <style>{`
          @keyframes blade-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes seed-drop {
            0% { opacity: 1; transform: translateY(0); }
            70% { opacity: 1; }
            100% { opacity: 0; transform: translateY(60px); }
          }
          @keyframes juice-wave {
            0%, 100% { d: path("M80,${juiceY} Q140,${juiceY - 8} 200,${juiceY} Q260,${juiceY + 8} 320,${juiceY} L320,300 L80,300 Z"); }
            50% { d: path("M80,${juiceY} Q140,${juiceY + 8} 200,${juiceY} Q260,${juiceY - 8} 320,${juiceY} L320,300 L80,300 Z"); }
          }
          @keyframes lid-lift {
            from { transform: translateY(0) scale(1); opacity: 1; }
            to { transform: translateY(-60px) scale(0.85); opacity: 0; }
          }
          @keyframes pulse-ring {
            0% { r: 125; opacity: 0.4; }
            100% { r: 160; opacity: 0; }
          }
          @keyframes chunk-float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-6px) rotate(15deg); }
          }
          .blade-spinning {
            animation: blade-spin 0.3s linear infinite;
            transform-origin: 200px 200px;
          }
          .lid-opening {
            animation: lid-lift 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .seed-falling {
            animation: seed-drop 1.2s ease-in forwards;
          }
          .chunk-floating {
            animation: chunk-float 2s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* Outer shadow ring */}
      <ellipse
        cx="200" cy="210" rx="140" ry="115"
        fill="none" stroke="#00000008" strokeWidth="20"
        filter="url(#juicer-shadow)"
      />

      {/* Juicer body — top-down bowl */}
      <ellipse
        cx="200" cy="200" rx="130" ry="108"
        fill="url(#juicer-body-grad)"
        stroke={BODY_STROKE}
        strokeWidth="3"
      />

      {/* Inner bowl rim */}
      <ellipse
        cx="200" cy="200" rx="120" ry="100"
        fill="#fafafa"
        stroke="#d0d0d5"
        strokeWidth="2"
      />

      {/* Juice liquid (clipped to bowl) */}
      {juiceLevel > 0 && (
        <g clipPath="url(#bowl-clip)">
          <ellipse
            cx="200"
            cy={juiceY + 50}
            rx="120"
            ry={juiceLevel * 100}
            fill="url(#juice-grad)"
            opacity="0.85"
          >
            {isBlending && (
              <animate
                attributeName="ry"
                values={`${juiceLevel * 100};${juiceLevel * 95};${juiceLevel * 100}`}
                dur="0.4s"
                repeatCount="indefinite"
              />
            )}
          </ellipse>

          {/* Pulp bits floating in juice */}
          {pulpLevel > 0 && Array.from({ length: Math.min(pulpLevel * 8, 20) }).map((_, i) => {
            const angle = (i / Math.max(pulpLevel * 8, 1)) * Math.PI * 2;
            const r = 30 + (i % 3) * 25;
            const cx = 200 + Math.cos(angle) * r;
            const cy = juiceY + 30 + Math.sin(angle) * (r * 0.5);
            return (
              <circle
                key={i}
                cx={cx} cy={cy}
                r={2 + (i % 3)}
                fill="#ffdd57"
                opacity="0.7"
                className="chunk-floating"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            );
          })}
        </g>
      )}

      {/* Blades */}
      <g className={isBlending ? "blade-spinning" : undefined}>
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <line
            key={angle}
            x1="200" y1="200"
            x2={200 + Math.cos((angle * Math.PI) / 180) * 50}
            y2={200 + Math.sin((angle * Math.PI) / 180) * 40}
            stroke={BLADE_COLOR}
            strokeWidth="3"
            strokeLinecap="round"
            opacity={isOpen ? 1 : 0.3}
          />
        ))}
        <circle cx="200" cy="200" r="8" fill={BLADE_COLOR} stroke="#999" strokeWidth="1.5" />
      </g>

      {/* Seeds dropping in */}
      {isFilling && seedCount > 0 && (
        <g clipPath="url(#bowl-clip)">
          {Array.from({ length: Math.min(seedCount, 12) }).map((_, i) => {
            const cx = 160 + ((i * 37) % 80);
            const color = SEED_COLORS[i % SEED_COLORS.length];
            return (
              <ellipse
                key={i}
                cx={cx}
                cy={130}
                rx="4" ry="6"
                fill={color}
                className="seed-falling"
                style={{ animationDelay: `${i * 0.12}s` }}
                transform={`rotate(${i * 30}, ${cx}, 130)`}
              />
            );
          })}
        </g>
      )}

      {/* Apple chunks dropping in */}
      {isFilling && (
        <g clipPath="url(#bowl-clip)">
          {[0, 1, 2].map((i) => {
            const cx = 170 + i * 30;
            return (
              <rect
                key={`chunk-${i}`}
                x={cx - 5} y={120}
                width="10" height="8"
                rx="2"
                fill="#c41e3a"
                className="seed-falling"
                style={{ animationDelay: `${0.4 + i * 0.2}s` }}
                transform={`rotate(${i * 20 + 10}, ${cx}, 124)`}
              />
            );
          })}
        </g>
      )}

      {/* Lid — covers everything when closed */}
      {state === "closed" && (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0" to="0 0"
            dur="0.01s"
          />
          {/* Tap hint pulse */}
          <circle cx="200" cy="200" r="125" fill="none" stroke={JUICE_COLOR} strokeWidth="2" opacity="0">
            <animate attributeName="r" values="125;160" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
          </circle>

          <ellipse
            cx="200" cy="200" rx="130" ry="108"
            fill="url(#lid-grad)"
            stroke={BODY_STROKE}
            strokeWidth="3"
          />
          {/* Lid handle */}
          <ellipse cx="200" cy="195" rx="30" ry="24" fill="#bbb" stroke="#999" strokeWidth="2" />
          <ellipse cx="200" cy="193" rx="18" ry="14" fill="#ccc" />
          {/* Tap label */}
          <text
            x="200" y="260"
            textAnchor="middle"
            fill="#6e6e73"
            fontSize="13"
            fontWeight="600"
            fontFamily="var(--font-display), system-ui, sans-serif"
          >
            tap to open
          </text>
        </g>
      )}

      {/* Lid lifting off animation */}
      {state === "open" && (
        <g className="lid-opening" style={{ transformOrigin: "200px 200px" }}>
          <ellipse
            cx="200" cy="200" rx="130" ry="108"
            fill="url(#lid-grad)"
            stroke={BODY_STROKE}
            strokeWidth="3"
          />
          <ellipse cx="200" cy="195" rx="30" ry="24" fill="#bbb" stroke="#999" strokeWidth="2" />
          <ellipse cx="200" cy="193" rx="18" ry="14" fill="#ccc" />
        </g>
      )}

      {/* Speed lines during blending */}
      {isBlending && (
        <g opacity="0.3">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const r1 = 100;
            const r2 = 118;
            const x1 = 200 + Math.cos((angle * Math.PI) / 180) * r1;
            const y1 = 200 + Math.sin((angle * Math.PI) / 180) * (r1 * 0.83);
            const x2 = 200 + Math.cos((angle * Math.PI) / 180) * r2;
            const y2 = 200 + Math.sin((angle * Math.PI) / 180) * (r2 * 0.83);
            return (
              <line
                key={angle}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={JUICE_COLOR}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <animate
                  attributeName="opacity"
                  values="0.5;0;0.5"
                  dur="0.3s"
                  begin={`${(angle / 360) * 0.3}s`}
                  repeatCount="indefinite"
                />
              </line>
            );
          })}
        </g>
      )}

      {/* Brand ring */}
      <ellipse
        cx="200" cy="200" rx="138" ry="114"
        fill="none"
        stroke={isOpen ? JUICE_COLOR : "#d2d2d7"}
        strokeWidth="1.5"
        opacity="0.5"
        strokeDasharray="4 6"
      />
    </svg>
  );
}
