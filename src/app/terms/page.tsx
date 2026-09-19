import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Use — $BITE",
  description:
    "Terms for using bite.party and interacting with $BITE on Robinhood Chain.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Use" updated="September 19, 2026">
      <p>
        By using bite.party (the “site”), you agree to these terms. If you do
        not agree, do not use the site.
      </p>

      <h2>What this is</h2>
      <p>
        $BITE is an experimental, deflationary memecoin on Robinhood Chain.
        The site lets you view race progress, trade, provide liquidity, and
        burn tokens according to on-chain rules. Nothing here is financial,
        investment, legal, or tax advice. That is fruit.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be legally able to use crypto products where you live. You are
        solely responsible for complying with local laws, sanctions, and tax
        rules. You represent that you are not prohibited from using the site.
      </p>

      <h2>No warranty</h2>
      <p>
        The site, smart contracts, quotes, leaderboards, and related tooling
        are provided “as is.” Software can break. RPCs can lag. Quotes can
        change. Transactions can fail or be front-run. We do not guarantee
        uptime, accuracy, or any particular outcome of the race.
      </p>

      <h2>Your wallet, your risk</h2>
      <ul>
        <li>
          You alone control your wallet. Never share seed phrases or private
          keys.
        </li>
        <li>
          Review every transaction before you sign. Burns destroy tokens. Swaps
          and LP actions move value.
        </li>
        <li>
          On-chain actions are final. We cannot reverse a bad trade or a burn
          you confirmed.
        </li>
      </ul>

      <h2>Tokens and markets</h2>
      <p>
        Crypto tokens can go to zero. Liquidity can disappear. Deadlines,
        multipliers, and payouts (if any) are defined by contracts and site
        configuration—not by promises on social media. Past activity is not
        indicative of future results.
      </p>

      <h2>Prohibited use</h2>
      <p>Do not use the site to:</p>
      <ul>
        <li>Break the law or evade sanctions.</li>
        <li>Attack, scrape abusively, or disrupt the site or its APIs.</li>
        <li>Impersonate the project or phish other users.</li>
        <li>Interfere with smart contracts or other users’ wallets.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        Wallets, Uniswap, pons, explorers, and social links are third-party
        services. Their terms apply when you leave our UI or use their
        software. We are not responsible for those services.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, the operators of bite.party are
        not liable for any loss of tokens, profits, data, or goodwill arising
        from your use of the site or the $BITE contracts—including bugs,
        exploits, oracle/RPC failures, or user error.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The “Updated” date will change when we do.
        Continued use after an update constitutes acceptance.
      </p>

      <h2>Privacy</h2>
      <p>
        See the <Link href="/privacy">Privacy Policy</Link> for how limited
        data is handled.
      </p>

      <h2>Contact</h2>
      <p>
        <a
          href="https://x.com/biteparty_"
          target="_blank"
          rel="noreferrer"
        >
          X (@biteparty_)
        </a>{" "}
        ·{" "}
        <a href="https://t.me/biteparty" target="_blank" rel="noreferrer">
          Telegram
        </a>
      </p>
    </LegalDoc>
  );
}
