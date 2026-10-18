import type { Metadata } from "next";
import Link from "next/link";
import { AppleAllocation } from "@/components/whitepaper/AppleAllocation";
import { BottleSplit } from "@/components/whitepaper/BottleSplit";
import { ContainerWeights } from "@/components/whitepaper/ContainerWeights";
import { PayoutEstimator } from "@/components/whitepaper/PayoutEstimator";
import { PoolApple } from "@/components/whitepaper/PoolApples";
import { WhitepaperApple } from "@/components/whitepaper/WhitepaperApple";
import { SiteFooter } from "@/components/SiteFooter";
import {
  AAPL_USD,
  AS_OF,
  BITE_MC_USD,
  CONTAINERS,
  BOTTLE_COGS,
  DIVIDEND_OF_DOLLAR,
  JUICE_SUPPLY,
  NFT_PRICE,
  OPENS,
  REGULAR_PRICE,
  SEED_WALLETS,
  TOTAL_OZ,
  WALLET_BITE,
  YEAR1_BOTTLES,
  YEAR1_BOTTLES_PER_QUARTER,
  companyBeforeLabor,
  containerPayout,
  juicePrice,
  openFdv,
} from "@/lib/whitepaper";

export const metadata: Metadata = {
  title: "Draft — $JUICE",
  description:
    "Draft notes for the $JUICE press. Not published. Not an offer.",
  robots: { index: false, follow: false, nocache: true },
};

function usd(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function price(n: number): string {
  return `$${n.toFixed(8)}`;
}

const SECTIONS = [
  ["supply", "Supply"],
  ["book", "The book"],
  ["open", "The open"],
  ["containers", "Containers"],
  ["bottle", "The bottle"],
  ["payout", "Year 1"],
] as const;

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-[#d2d2d7] bg-[rgba(251,251,253,0.86)] backdrop-blur-[20px]">
        <div className="page-gutter mx-auto flex h-14 max-w-[1120px] items-center justify-between">
          <Link href="/" className="text-[17px] font-semibold tracking-[-0.02em]">
            $BITE
          </Link>
          <p className="text-[12px] font-medium tracking-[0.14em] text-[#e53935] uppercase">
            Draft · local only
          </p>
        </div>
      </header>

      <main className="overflow-x-clip">
        <section className="page-gutter mx-auto grid max-w-[1120px] items-center gap-6 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:py-16">
          <div>
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              From the apple
            </p>
            <h1 className="mt-3 max-w-[14ch] text-[clamp(40px,6vw,68px)] leading-[0.98] font-semibold tracking-[-0.045em]">
              A billion tokens, pressed from what was eaten.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[19px] leading-relaxed text-[#6e6e73]">
              The game on Robinhood Chain is over. $BITE stays there.
              $JUICE is a new token on Base, paired with Coinbase Apple
              stock. Until the book opens, the only way in is to press.
            </p>
          </div>
          <div>
            <WhitepaperApple />
            <p className="text-center text-[11px] leading-relaxed text-[#6e6e73]">
              Apple Stop Motion Animation by Eydeet, CC BY 4.0.
            </p>
          </div>
        </section>

        <nav className="page-gutter mx-auto flex max-w-[1120px] gap-2 overflow-x-auto pb-8">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border border-[#d2d2d7] bg-white px-3 py-1.5 text-[13px] font-medium"
            >
              {label}
            </a>
          ))}
        </nav>

        <section id="supply" className="scroll-mt-16 border-t border-[#d2d2d7] py-16 md:py-20">
          <div className="page-gutter mx-auto max-w-[1120px]">
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              Supply
            </p>
            <h2 className="mt-3 max-w-[18ch] text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              Cut the apple into four slices.
            </h2>
            <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed text-[#6e6e73]">
              {JUICE_SUPPLY.toLocaleString("en-US")} $JUICE. The slices are
              the allocation. Hover a wedge, or pick one. A Growler later
              does not come out of this apple. Containers are a claim on
              the bottle, not a fifth slice of the token.
            </p>
            <div className="mt-10">
              <AppleAllocation />
            </div>
            <p className="mt-8 max-w-[62ch] text-[15px] leading-relaxed text-[#6e6e73]">
              If all {WALLET_BITE.toLocaleString("en-US")} $BITE sitting in
              wallets were pressed into the 650 million player tokens, that
              is about 2.1 $JUICE per $BITE. Press less, and each token
              pressed is worth a larger share of that slice. It is not 1:1.
            </p>
          </div>
        </section>

        <section id="book" className="scroll-mt-16 border-t border-[#d2d2d7] bg-white py-16 md:py-20">
          <div className="page-gutter mx-auto max-w-[1120px]">
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              The book
            </p>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              Seven days, or forty apples.
            </h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {[
                ["1", "Seeds", "Seeds from the game cap how much $BITE a wallet can press."],
                ["2", "Press", "The press sells that $BITE into the Robinhood pool."],
                ["3", "Escrow", "The AAPL that comes out can only seed the $JUICE pair."],
                ["4", "Open", "Claims become tokens. One 1% pool. The press closes."],
              ].map(([n, title, body]) => (
                <li key={n} className="rounded-[20px] bg-[#fbfbfd] p-5">
                  <p className="font-mono text-[13px] text-[#e53935]">{n}</p>
                  <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.03em]">
                    {title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-[68ch] text-[17px] leading-relaxed text-[#6e6e73]">
              $JUICE is not a token anyone can transfer during the book, so
              a side pool has nothing to list. The book lasts 7 days. It
              opens early if the escrow catches 40 AAPL. On day 7 it opens
              on whatever was actually pressed. Forty is a soft target, the
              same size as the $BITE launch, not a second game the players
              have to win.
            </p>
          </div>
        </section>

        <section id="open" className="scroll-mt-16 border-t border-[#d2d2d7] py-16 md:py-20">
          <div className="page-gutter mx-auto max-w-[1120px]">
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              The open
            </p>
            <h2 className="mt-3 max-w-[18ch] text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              The pool sets the price.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-[#6e6e73]">
              With 20% of supply in the pool, fully diluted value is the
              AAPL paired there divided by 0.20. AAPL in the $BITE pool was{" "}
              {usd(AAPL_USD, 2)} on {AS_OF}. $BITE’s market cap that day was{" "}
              {usd(BITE_MC_USD)}.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {OPENS.map((row) => {
                const fdv = openFdv(row.aapl);
                const multiple = fdv / BITE_MC_USD;
                return (
                  <article
                    key={row.aapl}
                    className="rounded-[24px] bg-white p-6"
                  >
                    <PoolApple aapl={row.aapl} label={row.label} />
                    <p className="mt-4 text-[13px] font-medium text-[#6e6e73]">
                      {row.label}
                    </p>
                    <h3 className="mt-1 text-[28px] font-semibold tracking-[-0.04em]">
                      {row.aapl} AAPL
                    </h3>
                    <p className="mt-3 font-mono text-[15px]">
                      {usd(fdv)} FDV
                    </p>
                    <p className="mt-1 font-mono text-[13px] text-[#6e6e73]">
                      {price(juicePrice(row.aapl))} · {multiple.toFixed(1)}×
                      $BITE
                    </p>
                  </article>
                );
              })}
            </div>
            <p className="mt-8 max-w-[68ch] text-[15px] leading-relaxed text-[#6e6e73]">
              Forty AAPL is about {usd(40 * AAPL_USD)} in the pool. That
              open sits near {usd(openFdv(40))}, about six times today’s
              $BITE. The cheaper open is the 7-day path, when the press
              catches less than about 6.4 AAPL. Players are in before that
              price exists. Their cost is the $BITE they pressed.
            </p>
          </div>
        </section>

        <section id="containers" className="scroll-mt-16 border-t border-[#d2d2d7] bg-white py-16 md:py-20">
          <div className="page-gutter mx-auto max-w-[1120px]">
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              Containers
            </p>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              Ounces are the dividend.
            </h2>
            <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-[#6e6e73]">
              A Growler is 8 shares, a Mason Jar 4, a Bottle 2, a Juice Box
              1. Eighty seeds make an ounce. A holder’s percent is their
              shares divided by every share poured. On the live board,{" "}
              {SEED_WALLETS} wallets can each pour one container. That is{" "}
              {TOTAL_OZ.toLocaleString("en-US")} ounces. Pulp pays nothing.
              Raw $JUICE pays nothing until it is poured.
            </p>
            <div className="mt-10">
              <ContainerWeights />
            </div>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[14px]">
                <thead className="text-[12px] tracking-[0.08em] text-[#6e6e73] uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Container</th>
                    <th className="py-2 pr-4 font-medium">Seeds</th>
                    <th className="py-2 pr-4 font-medium">Shares</th>
                    <th className="py-2 pr-4 font-medium">Count</th>
                    <th className="py-2 font-medium">Tier, if each pours once</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTAINERS.map((tier) => (
                    <tr key={tier.name} className="border-t border-[#d2d2d7]">
                      <td className="py-3 pr-4 font-medium">{tier.name}</td>
                      <td className="py-3 pr-4 font-mono">{tier.seeds.toLocaleString("en-US")}</td>
                      <td className="py-3 pr-4 font-mono">{tier.shares}</td>
                      <td className="py-3 pr-4 font-mono">{tier.count}</td>
                      <td className="py-3 font-mono">
                        {((tier.oz * tier.count) / TOTAL_OZ * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 max-w-[68ch] text-[15px] leading-relaxed text-[#6e6e73]">
              Bottles take most of the pool because 304 wallets land there.
              Each Bottle still earns half a Mason Jar and a quarter of a
              Growler. The {Math.round(DIVIDEND_OF_DOLLAR * 100)}¢ dividend
              inside each treasury dollar is bought as $JUICE and AAPL and
              paid by these weights.
            </p>
          </div>
        </section>

        <section id="bottle" className="scroll-mt-16 border-t border-[#d2d2d7] py-16 md:py-20">
          <div className="page-gutter mx-auto max-w-[1120px]">
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              The bottle
            </p>
            <h2 className="mt-3 max-w-[18ch] text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              One dollar leaves every bottle.
            </h2>
            <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-[#6e6e73]">
              Pressed Juicery lists a juice at {usd(REGULAR_PRICE, 2)}, and{" "}
              {usd(NFT_PRICE, 2)} for VIP. Regular here is {usd(REGULAR_PRICE, 2)}.
              A poured container pays {usd(NFT_PRICE, 2)}. Pulp and raw $JUICE
              pay regular. Cost stays {usd(BOTTLE_COGS, 2)}. One dollar is set
              aside at both prices. Forty cents of that dollar can fund
              campaigns. Sixty cents is the container dividend. The{" "}
              {usd(REGULAR_PRICE - NFT_PRICE, 2)} discount comes out of the
              company, so the dollar does not shrink. A vote can move the
              split. The buys do not mint new $JUICE.
            </p>
            <div className="mt-10 max-w-[820px]">
              <BottleSplit />
            </div>
            <p className="mt-8 max-w-[68ch] text-[15px] leading-relaxed text-[#6e6e73]">
              After the dollar, the company keeps{" "}
              {usd(companyBeforeLabor(REGULAR_PRICE), 2)} on a regular bottle
              and {usd(companyBeforeLabor(NFT_PRICE), 2)} on an NFT bottle,
              before labor. Published bottled costs, once packaging and cold
              freight are in, often run $1.55 to $3.50. At a $3 cost the
              regular bottle still keeps $2.95 and the NFT bottle keeps $1.50.
              The dollar still leaves both.
            </p>
          </div>
        </section>

        <section id="payout" className="scroll-mt-16 border-t border-[#d2d2d7] bg-white py-16 md:py-20">
          <div className="page-gutter mx-auto max-w-[1120px]">
            <p className="text-[13px] font-medium tracking-[0.12em] text-[#6e6e73] uppercase">
              Year 1
            </p>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(32px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.04em]">
              Ten thousand bottles a quarter.
            </h2>
            <p className="mt-4 max-w-[66ch] text-[17px] leading-relaxed text-[#6e6e73]">
              That is the year 1 target. {YEAR1_BOTTLES.toLocaleString("en-US")} bottles
              in the year, about {Math.round(YEAR1_BOTTLES / 365)} a day. At 60¢,
              the quarter pays{" "}
              {usd((YEAR1_BOTTLES_PER_QUARTER * 0.6), 0)}. A Bottle holder
              receives {usd(containerPayout(8, YEAR1_BOTTLES) / 4, 2)}. The
              list is the containers already issued. January mints are not in
              it.
            </p>
            <div className="mt-10">
              <PayoutEstimator />
            </div>
            <p className="mt-8 max-w-[68ch] text-[15px] leading-relaxed text-[#6e6e73]">
              Pressed Juicery does not publish a bottle count. Five million is
              the middle of a few million, from about 100 cafes and $14.7
              million of tracked US grocery sales in the year ended 3 July
              2025. Red Bull sold 13.969 billion cans in 2025. Those are cans,
              not juice bottles. They are on the bar so the distance is visible.
            </p>
          </div>
        </section>

        <section className="border-t border-[#d2d2d7] bg-white py-16">
          <div className="page-gutter mx-auto max-w-[760px]">
            <h2 className="text-[28px] font-semibold tracking-[-0.03em]">
              What stays fixed while the dials move
            </h2>
            <ul className="mt-6 space-y-3 text-[16px] leading-relaxed text-[#6e6e73]">
              <li>No transferable $JUICE before the book opens.</li>
              <li>The escrow cannot pay a team wallet.</li>
              <li>Day 7 opens the book even if a wallet never presses.</li>
              <li>The liquidity position is locked. The fee is 1%. Other LPs can join.</li>
              <li>Seeds cap the press. A wallet that did not play cannot push $BITE through on day one.</li>
              <li>Container weight is ounces. That ratio is 8, 4, 2, 1.</li>
              <li>A poured container pays {usd(NFT_PRICE, 2)}. Everyone else pays {usd(REGULAR_PRICE, 2)}.</li>
              <li>Year 1 is {YEAR1_BOTTLES_PER_QUARTER.toLocaleString("en-US")} bottles a quarter.</li>
            </ul>
            <p className="mt-8 text-[14px] leading-relaxed text-[#6e6e73]">
              This page is a draft for reading on a local machine. It is
              not an offer, a listing, or a promise that these figures ship.
              Pool math uses the Robinhood $BITE/AAPL pool on {AS_OF}.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
