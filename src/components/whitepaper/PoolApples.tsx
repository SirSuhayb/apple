/** How much of a forty-apple open each press actually fills. */

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

const CX = 80;
const CY = 88;
const R = 58;

function wedge(fraction: number): string {
  const sweep = Math.min(359.8, Math.max(0, fraction) * 360);
  if (sweep >= 359.8) {
    return `M ${CX} ${r2(CY - R)} A ${R} ${R} 0 1 1 ${r2(CX - 0.02)} ${r2(CY - R)} Z`;
  }
  const a0 = -Math.PI / 2;
  const a1 = a0 + (sweep * Math.PI) / 180;
  const x0 = r2(CX + Math.cos(a0) * R);
  const y0 = r2(CY + Math.sin(a0) * R);
  const x1 = r2(CX + Math.cos(a1) * R);
  const y1 = r2(CY + Math.sin(a1) * R);
  const large = sweep > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function PoolApple({
  aapl,
  label,
}: {
  aapl: number;
  label: string;
}) {
  const fraction = Math.min(1, aapl / 40);
  return (
    <svg
      viewBox="0 0 160 168"
      role="img"
      aria-label={`${label}: ${aapl} of 40 AAPL`}
      className="mx-auto h-36 w-auto"
    >
      <ellipse cx="80" cy="18" rx="4" ry="10" fill="#6d4c41" />
      <path d="M84 14c12-14 32-12 36-2-11 1-22 8-28 18" fill="#7da85a" />
      <circle cx={CX} cy={CY} r="64" fill="#c62828" />
      <circle cx={CX} cy={CY} r={R} fill="#f6e7d4" />
      <path d={wedge(fraction)} fill="#e53935" />
      <circle cx={CX} cy={CY} r="10" fill="#f3e6cf" />
      <ellipse cx="76" cy="86" rx="2.2" ry="3.4" fill="#5d4037" transform="rotate(-20 76 86)" />
      <ellipse cx="84" cy="90" rx="2.2" ry="3.4" fill="#5d4037" transform="rotate(24 84 90)" />
    </svg>
  );
}
