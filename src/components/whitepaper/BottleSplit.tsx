const LAYERS = [
  { label: "Cost", amount: 1.45, fill: "#d7ccc8" },
  { label: "Company, before labor", amount: 2.05, fill: "#f8e0c8" },
  { label: "Campaigns", amount: 0.4, fill: "#7da85a" },
  { label: "Container dividend", amount: 0.6, fill: "#e53935" },
] as const;

const PRICE = 4.5;

export function BottleSplit() {
  const usable = LAYERS.reduce((sum, layer) => sum + layer.amount, 0);
  const bands = LAYERS.map((layer, index) => {
    const used = LAYERS.slice(0, index).reduce(
      (sum, row) => sum + (row.amount / usable) * 196,
      0,
    );
    const height = Math.round(((layer.amount / usable) * 196) * 100) / 100;
    // Same order as the legend: cost at the neck, dividend at the base.
    const y = Math.round((40 + used) * 100) / 100;
    return { ...layer, height, y };
  });

  return (
    <div className="grid items-center gap-8 md:grid-cols-[180px_1fr]">
      <svg
        viewBox="0 0 120 280"
        role="img"
        aria-label="A $4.50 bottle split into cost, company, campaigns, and the container dividend"
        className="mx-auto h-[280px] w-auto"
      >
        <path
          d="M48 16h24v22c14 8 22 22 22 40v150c0 18-14 28-34 28s-34-10-34-28V78c0-18 8-32 22-40V16z"
          fill="#fbfbfd"
          stroke="#d2d2d7"
          strokeWidth="2"
        />
        <clipPath id="wp-bottle">
          <path d="M48 16h24v22c14 8 22 22 22 40v150c0 18-14 28-34 28s-34-10-34-28V78c0-18 8-32 22-40V16z" />
        </clipPath>
        {bands.map((layer) => (
          <rect
            key={layer.label}
            x="28"
            y={layer.y}
            width="64"
            height={layer.height + 0.5}
            fill={layer.fill}
            clipPath="url(#wp-bottle)"
          />
        ))}
        <rect x="52" y="8" width="16" height="10" rx="2" fill="#e8e8ed" />
      </svg>
      <ul className="space-y-3">
        {LAYERS.map((layer) => (
          <li key={layer.label} className="flex items-baseline justify-between gap-4 border-b border-[#d2d2d7] pb-3">
            <span className="flex items-center gap-3 text-[16px]">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: layer.fill }}
              />
              {layer.label}
            </span>
            <span className="font-mono text-[15px]">
              ${layer.amount.toFixed(2)}
              <span className="ml-2 text-[#6e6e73]">
                {Math.round((layer.amount / PRICE) * 100)}%
              </span>
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between text-[16px] font-semibold">
          <span>Shelf price used here</span>
          <span className="font-mono">$4.50</span>
        </li>
      </ul>
    </div>
  );
}
