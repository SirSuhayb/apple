"use client";

/**
 * SVG container illustrations for each seed tier.
 * Used in the container picker and the dispensing animation.
 */

const JUICE_COLOR = "#f97316";
const JUICE_LIGHT = "#ffb347";

type ContainerProps = {
  fillLevel?: number;
  label?: string;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
};

export function JuiceBoxSVG({ fillLevel = 0, label, selected, className, onClick }: ContainerProps) {
  return (
    <svg viewBox="0 0 100 140" className={className} onClick={onClick} role={onClick ? "button" : undefined}>
      <defs>
        <linearGradient id="jb-juice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={JUICE_LIGHT} />
          <stop offset="100%" stopColor={JUICE_COLOR} />
        </linearGradient>
      </defs>
      {/* Box body */}
      <rect x="20" y="25" width="60" height="85" rx="4"
        fill={selected ? "#fff5eb" : "#fafafa"}
        stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth={selected ? 2.5 : 1.5} />
      {/* Juice fill */}
      {fillLevel > 0 && (
        <rect x="22" y={108 - fillLevel * 83} width="56" height={fillLevel * 83} rx="2"
          fill="url(#jb-juice)" opacity="0.8" />
      )}
      {/* Straw */}
      <rect x="55" y="10" width="4" height="35" rx="2" fill="#e74c3c" />
      <rect x="52" y="8" width="10" height="6" rx="3" fill="#e74c3c" />
      {/* Label area */}
      {label && (
        <g>
          <rect x="28" y="55" width="44" height="20" rx="3" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="50" y="69" textAnchor="middle" fontSize="7" fill="#1d1d1f" fontWeight="600"
            fontFamily="var(--font-display), system-ui">{label}</text>
        </g>
      )}
      {/* 4oz label */}
      <text x="50" y="132" textAnchor="middle" fontSize="9" fill="#6e6e73"
        fontFamily="var(--font-display), system-ui">4oz</text>
    </svg>
  );
}

export function BottleSVG({ fillLevel = 0, label, selected, className, onClick }: ContainerProps) {
  return (
    <svg viewBox="0 0 100 160" className={className} onClick={onClick} role={onClick ? "button" : undefined}>
      <defs>
        <linearGradient id="bt-juice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={JUICE_LIGHT} />
          <stop offset="100%" stopColor={JUICE_COLOR} />
        </linearGradient>
      </defs>
      {/* Neck */}
      <rect x="40" y="10" width="20" height="25" rx="3"
        fill={selected ? "#fff5eb" : "#fafafa"}
        stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth={selected ? 2 : 1.5} />
      {/* Cap */}
      <rect x="38" y="5" width="24" height="10" rx="4" fill="#1d1d1f" />
      {/* Body */}
      <path d="M30,35 Q30,45 25,55 L25,125 Q25,135 35,135 L65,135 Q75,135 75,125 L75,55 Q70,45 70,35 Z"
        fill={selected ? "#fff5eb" : "#fafafa"}
        stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth={selected ? 2.5 : 1.5} />
      {/* Juice fill */}
      {fillLevel > 0 && (
        <clipPath id="bt-clip">
          <path d="M26,56 L26,125 Q26,134 35,134 L65,134 Q74,134 74,125 L74,56 Z" />
        </clipPath>
      )}
      {fillLevel > 0 && (
        <rect x="26" y={134 - fillLevel * 78} width="48" height={fillLevel * 78}
          fill="url(#bt-juice)" opacity="0.8" clipPath="url(#bt-clip)" />
      )}
      {/* Label */}
      {label && (
        <g>
          <rect x="30" y="75" width="40" height="22" rx="3" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="50" y="90" textAnchor="middle" fontSize="7" fill="#1d1d1f" fontWeight="600"
            fontFamily="var(--font-display), system-ui">{label}</text>
        </g>
      )}
      <text x="50" y="152" textAnchor="middle" fontSize="9" fill="#6e6e73"
        fontFamily="var(--font-display), system-ui">8oz</text>
    </svg>
  );
}

export function MasonJarSVG({ fillLevel = 0, label, selected, className, onClick }: ContainerProps) {
  return (
    <svg viewBox="0 0 110 160" className={className} onClick={onClick} role={onClick ? "button" : undefined}>
      <defs>
        <linearGradient id="mj-juice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={JUICE_LIGHT} />
          <stop offset="100%" stopColor={JUICE_COLOR} />
        </linearGradient>
      </defs>
      {/* Lid */}
      <rect x="25" y="12" width="60" height="12" rx="3" fill="#c0c0c0" stroke="#999" strokeWidth="1" />
      {/* Thread ring */}
      <rect x="23" y="22" width="64" height="8" rx="2" fill="#d0d0d0" stroke="#aaa" strokeWidth="1" />
      {/* Jar body */}
      <path d="M28,30 L28,125 Q28,140 42,140 L68,140 Q82,140 82,125 L82,30 Z"
        fill={selected ? "#fff5eb" : "rgba(250,250,250,0.9)"}
        stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth={selected ? 2.5 : 1.5} />
      {/* Juice fill */}
      {fillLevel > 0 && (
        <clipPath id="mj-clip">
          <path d="M29,31 L29,125 Q29,139 42,139 L68,139 Q81,139 81,125 L81,31 Z" />
        </clipPath>
      )}
      {fillLevel > 0 && (
        <rect x="29" y={139 - fillLevel * 108} width="52" height={fillLevel * 108}
          fill="url(#mj-juice)" opacity="0.8" clipPath="url(#mj-clip)" />
      )}
      {/* Label */}
      {label && (
        <g>
          <rect x="33" y="70" width="44" height="24" rx="3" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="55" y="86" textAnchor="middle" fontSize="7" fill="#1d1d1f" fontWeight="600"
            fontFamily="var(--font-display), system-ui">{label}</text>
        </g>
      )}
      <text x="55" y="155" textAnchor="middle" fontSize="9" fill="#6e6e73"
        fontFamily="var(--font-display), system-ui">16oz</text>
    </svg>
  );
}

export function GrowlerSVG({ fillLevel = 0, label, selected, className, onClick }: ContainerProps) {
  return (
    <svg viewBox="0 0 120 180" className={className} onClick={onClick} role={onClick ? "button" : undefined}>
      <defs>
        <linearGradient id="gr-juice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={JUICE_LIGHT} />
          <stop offset="100%" stopColor={JUICE_COLOR} />
        </linearGradient>
      </defs>
      {/* Neck */}
      <rect x="47" y="8" width="26" height="22" rx="5"
        fill={selected ? "#fff5eb" : "#fafafa"}
        stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth={selected ? 2 : 1.5} />
      {/* Handle */}
      <path d="M73,14 Q95,14 95,40 L95,65 Q95,80 82,80"
        fill="none" stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth="5" strokeLinecap="round" />
      {/* Body */}
      <path d="M30,40 Q25,50 22,65 L22,140 Q22,160 40,160 L80,160 Q98,160 98,140 L98,65 Q95,50 90,40 Z"
        fill={selected ? "#fff5eb" : "#fafafa"}
        stroke={selected ? JUICE_COLOR : "#d2d2d7"} strokeWidth={selected ? 2.5 : 1.5} />
      {/* Juice fill */}
      {fillLevel > 0 && (
        <clipPath id="gr-clip">
          <path d="M23,66 L23,140 Q23,159 40,159 L80,159 Q97,159 97,140 L97,66 Z" />
        </clipPath>
      )}
      {fillLevel > 0 && (
        <rect x="23" y={159 - fillLevel * 93} width="74" height={fillLevel * 93}
          fill="url(#gr-juice)" opacity="0.8" clipPath="url(#gr-clip)" />
      )}
      {/* Label */}
      {label && (
        <g>
          <rect x="33" y="85" width="54" height="28" rx="4" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="60" y="103" textAnchor="middle" fontSize="8" fill="#1d1d1f" fontWeight="600"
            fontFamily="var(--font-display), system-ui">{label}</text>
        </g>
      )}
      <text x="60" y="175" textAnchor="middle" fontSize="9" fill="#6e6e73"
        fontFamily="var(--font-display), system-ui">32oz</text>
    </svg>
  );
}

export function ContainerForTier({
  tier,
  ...props
}: { tier: string } & ContainerProps) {
  switch (tier) {
    case "Juice Box": return <JuiceBoxSVG {...props} />;
    case "Bottle": return <BottleSVG {...props} />;
    case "Mason Jar": return <MasonJarSVG {...props} />;
    case "Growler": return <GrowlerSVG {...props} />;
    default: return <JuiceBoxSVG {...props} />;
  }
}
