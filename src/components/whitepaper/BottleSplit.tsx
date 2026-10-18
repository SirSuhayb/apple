import {
  BOTTLE_COGS,
  CAMPAIGN_OF_DOLLAR,
  DIVIDEND_OF_DOLLAR,
  NFT_PRICE,
  REGULAR_PRICE,
  companyBeforeLabor,
} from "@/lib/whitepaper";

const FILLS = {
  cost: "#d7ccc8",
  company: "#f8e0c8",
  campaigns: "#7da85a",
  dividend: "#e53935",
} as const;

const SHELVES = [
  { id: "regular", label: "Regular", price: REGULAR_PRICE },
  { id: "nft", label: "NFT holders", price: NFT_PRICE },
] as const;

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Whole percents of the shelf price. The company line absorbs rounding so the four sum to 100. */
function percentParts(price: number): number[] {
  const amounts = [
    BOTTLE_COGS,
    companyBeforeLabor(price),
    CAMPAIGN_OF_DOLLAR,
    DIVIDEND_OF_DOLLAR,
  ];
  const rounded = amounts.map((amount) => Math.round((amount / price) * 100));
  const drift = rounded.reduce((sum, part) => sum + part, 0) - 100;
  rounded[1] = (rounded[1] ?? 0) - drift;
  return rounded;
}

function Bottle({ id, price }: { id: string; price: number }) {
  const company = companyBeforeLabor(price);
  const layers = [
    { key: "cost", amount: BOTTLE_COGS, fill: FILLS.cost },
    { key: "company", amount: company, fill: FILLS.company },
    { key: "campaigns", amount: CAMPAIGN_OF_DOLLAR, fill: FILLS.campaigns },
    { key: "dividend", amount: DIVIDEND_OF_DOLLAR, fill: FILLS.dividend },
  ];
  const bands = layers.map((layer, index) => {
    const used = layers
      .slice(0, index)
      .reduce((sum, row) => sum + (row.amount / price) * 196, 0);
    const height = Math.round(((layer.amount / price) * 196) * 100) / 100;
    const y = Math.round((40 + used) * 100) / 100;
    return { ...layer, height, y };
  });
  const clip = `wp-bottle-${id}`;

  return (
    <svg
      viewBox="0 0 120 280"
      role="img"
      aria-label={`${money(price)} bottle. Cost ${money(BOTTLE_COGS)}, company ${money(company)}, campaigns ${money(CAMPAIGN_OF_DOLLAR)}, container dividend ${money(DIVIDEND_OF_DOLLAR)}.`}
      className="mx-auto h-[260px] w-auto"
    >
      <path
        d="M48 16h24v22c14 8 22 22 22 40v150c0 18-14 28-34 28s-34-10-34-28V78c0-18 8-32 22-40V16z"
        fill="#fbfbfd"
        stroke="#d2d2d7"
        strokeWidth="2"
      />
      <clipPath id={clip}>
        <path d="M48 16h24v22c14 8 22 22 22 40v150c0 18-14 28-34 28s-34-10-34-28V78c0-18 8-32 22-40V16z" />
      </clipPath>
      {bands.map((layer) => (
        <rect
          key={layer.key}
          x="28"
          y={layer.y}
          width="64"
          height={layer.height + 0.5}
          fill={layer.fill}
          clipPath={`url(#${clip})`}
        />
      ))}
      <rect x="52" y="8" width="16" height="10" rx="2" fill="#e8e8ed" />
    </svg>
  );
}

export function BottleSplit() {
  const regularParts = percentParts(REGULAR_PRICE);
  const nftParts = percentParts(NFT_PRICE);
  const rows = [
    ["Cost", BOTTLE_COGS, BOTTLE_COGS, FILLS.cost],
    [
      "Company, before labor",
      companyBeforeLabor(REGULAR_PRICE),
      companyBeforeLabor(NFT_PRICE),
      FILLS.company,
    ],
    ["Campaigns", CAMPAIGN_OF_DOLLAR, CAMPAIGN_OF_DOLLAR, FILLS.campaigns],
    ["Container dividend", DIVIDEND_OF_DOLLAR, DIVIDEND_OF_DOLLAR, FILLS.dividend],
  ] as const;

  return (
    <div>
      <div className="grid gap-8 md:grid-cols-2">
        {SHELVES.map((shelf) => (
          <article key={shelf.id} className="text-center">
            <p className="text-[13px] font-medium tracking-[0.08em] text-[#6e6e73] uppercase">
              {shelf.label}
            </p>
            <p className="mt-1 font-mono text-[28px] font-semibold tracking-[-0.04em]">
              {money(shelf.price)}
            </p>
            <Bottle id={shelf.id} price={shelf.price} />
          </article>
        ))}
      </div>
      <div className="mt-8">
        <div className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-x-4 pb-2 text-[12px] tracking-[0.08em] text-[#6e6e73] uppercase">
          <span />
          <span className="text-right">Regular</span>
          <span className="text-right">NFT</span>
        </div>
        <ul className="space-y-3">
          {rows.map(([label, regularAmount, nftAmount, fill], index) => (
            <li
              key={label}
              className="grid grid-cols-[1fr_6.5rem_6.5rem] items-baseline gap-x-4 border-b border-[#d2d2d7] pb-3 text-[15px]"
            >
              <span className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: fill }}
                />
                {label}
              </span>
              <span className="text-right font-mono">
                {money(regularAmount)}
                <span className="ml-2 text-[#6e6e73]">{regularParts[index]}%</span>
              </span>
              <span className="text-right font-mono">
                {money(nftAmount)}
                <span className="ml-2 text-[#6e6e73]">{nftParts[index]}%</span>
              </span>
            </li>
          ))}
          <li className="grid grid-cols-[1fr_6.5rem_6.5rem] items-baseline gap-x-4 text-[15px] font-semibold">
            <span>Shelf</span>
            <span className="text-right font-mono">{money(REGULAR_PRICE)}</span>
            <span className="text-right font-mono">{money(NFT_PRICE)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
