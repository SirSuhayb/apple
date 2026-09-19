import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy — $BITE",
  description:
    "How bite.party handles wallets, analytics, and the limited data needed to run the $BITE race.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="September 19, 2026">
      <p>
        bite.party (“we”, “the site”) is a web app for the $BITE token race on
        Robinhood Chain. This policy explains what we collect and what we don’t.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Wallet addresses you connect.</strong> When you connect a
          wallet, your public address is used in-browser to quote swaps, show
          balances, rank you on the leaderboard, and submit transactions you
          approve. Addresses are public on-chain data.
        </li>
        <li>
          <strong>On-chain activity.</strong> Burns, swaps, LP actions, and
          related events are read from public chain RPCs and explorers. We do
          not control that public ledger.
        </li>
        <li>
          <strong>Optional analytics.</strong> If you accept cookies, we may
          use Vercel Analytics and Speed Insights to understand aggregate page
          views and performance. These tools are designed to minimize
          personal data.
        </li>
        <li>
          <strong>Local preferences.</strong> Cookie consent and similar UI
          choices may be stored in your browser’s localStorage.
        </li>
      </ul>

      <h2>What we don’t collect</h2>
      <ul>
        <li>No accounts, emails, or passwords.</li>
        <li>No private keys, seed phrases, or signing passwords.</li>
        <li>No KYC documents or government IDs.</li>
      </ul>

      <h2>Third parties</h2>
      <p>
        Wallet connection may involve WalletConnect, Coinbase Wallet, or your
        browser wallet. Swaps and liquidity quotes may call Uniswap APIs from
        our server. Those services have their own privacy policies. On-chain
        transactions are irreversible and public.
      </p>

      <h2>Cookies</h2>
      <p>
        Essential storage keeps wallet connection and your consent choice
        working. Non-essential analytics run only after you accept. You can
        change your mind by clearing site data for bite.party.
      </p>

      <h2>Children</h2>
      <p>
        The site is not directed at children under 13 (or the equivalent age in
        your jurisdiction). Do not use it if you are under the applicable age.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy as the product changes. The “Updated” date
        at the top will change when we do. Continued use after an update means
        you accept the revised policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: reach the team via{" "}
        <a
          href="https://x.com/biteparty_"
          target="_blank"
          rel="noreferrer"
        >
          X (@biteparty_)
        </a>{" "}
        or{" "}
        <a href="https://t.me/biteparty" target="_blank" rel="noreferrer">
          Telegram
        </a>
        . See also our{" "}
        <Link href="/terms">Terms of Use</Link>.
      </p>
    </LegalDoc>
  );
}
