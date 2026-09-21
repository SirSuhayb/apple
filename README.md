# BITE — Eat it to the core.

Timed race on Robinhood Chain: burn **50% of burnable** `$BITE` before the deadline.

- **Core** → prize pays qualified eaters (**not** the farmer).
- **Rot** → apple freezes and only the farmer gets paid.

Launch the token on [pons](https://www.ponsfamily.com/launchpad) vs AAPL. This repo is the race site + AppleKitchen.

## Security (read before you clone / fork)

- **Never commit** `.env`, `.env.local`, `contracts/.env`, or `bots/.env`.
- **Never commit** private keys, seed phrases, API tokens, or Telegram bot tokens.
- Copy the `*.env.example` files and fill in **your own** values locally.
- Deploy scripts read `PRIVATE_KEY` from env only — keep that key offline / in a secret manager.
- On-chain contract addresses are public by nature; treat **EOA / ops wallets** and **API keys** as private.

## Quick start (site)

```bash
npm install
cp .env.example .env.local
# Edit .env.local — see “Environment” below. Leave secrets empty until you have them.
npm run dev
```

`npm run dev` works in preview mode with no token configured.

## Order of operations

1. **Site** — `npm run dev` works in preview mode with no token.
2. **You launch** on pons vs AAPL (`buybackEnabled` off, website = this site, fees to your wallet).
3. Drop **your** addresses into `.env.local` (see `.env.example`).
4. `npm run reserved-math` → deploy AppleKitchen with that `CORE_TARGET`.
5. At ~$500–1k fees: Dexscreener + verify, then point fees at the kitchen.

## Environment

Root template: [`.env.example`](.env.example) → copy to `.env.local`.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_RPC_URL` | Robinhood Chain RPC |
| `NEXT_PUBLIC_BITE_TOKEN` | Your `$BITE` token address |
| `NEXT_PUBLIC_APPLE_KITCHEN` | Deployed AppleKitchen address |
| `NEXT_PUBLIC_DEPLOYER` | Farmer / creator EOA (excluded from eaters) |
| `NEXT_PUBLIC_PONS_TOKEN_URL` | Pons launchpad URL for your token |
| `NEXT_PUBLIC_AAPL_TOKEN` | AAPL stock token on Robinhood Chain |
| `NEXT_PUBLIC_WC_PROJECT_ID` | [WalletConnect Cloud](https://cloud.walletconnect.com/) project id |
| `UNISWAP_API_KEY` | Server-only Uniswap Trading API key (never `NEXT_PUBLIC_`) |
| `SWAP_OPS_RECIPIENT` | Optional ops fee recipient EOA |

Example shape (placeholders only — replace with your addresses):

```bash
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_BITE_TOKEN=0xYourBiteTokenAddress000000000000000000
NEXT_PUBLIC_APPLE_KITCHEN=0xYourKitchenAddress00000000000000000000
NEXT_PUBLIC_DEPLOYER=0xYourFarmerWallet0000000000000000000000
NEXT_PUBLIC_PONS_TOKEN_URL=https://www.ponsfamily.com/launchpad/0xYourBiteTokenAddress000000000000000000
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
UNISWAP_API_KEY=
```

Apple product-page layout: hero brand + full-bleed stop-motion apple, then wager / how / core / eaters / tap / footer.

Eydeet CC-BY frames live in `public/apple/frames/0.glb`…`9.glb` (UI frame *i* → Sketchfab `frame_i`). Rebake with `npm run bake-apple`.

## Contracts

`AppleKitchen` lives in `contracts/src/AppleKitchen.sol` — `bite`, `digest` (50/50), `revealCore` (swarm minus deployer), `revealRot` (pot to deployer). Deploy **after** mint.

`ReferralEscrow` (`contracts/src/ReferralEscrow.sol`) is a **UUPS** escrow: fixed `$BITE` per in-app referral via attester `qualify`. Fund the **proxy** (not the implementation). Site `?ref=` → wallet `bind(referrer)`; orchard bot attests buy+burn then `qualify`. Default reward is **1000 BITE** (owner can `setRewardPerReferral` later).

**Vercel:** set `NEXT_PUBLIC_REFERRAL_ESCROW` to your proxy address after deploy.

**Railway / bot attester (never commit keys):**

```bash
REFERRAL_ESCROW=0xYourReferralEscrowProxy00000000000000000
REFERRAL_ATTESTER_KEY=0x…   # must match on-chain attester(); or reuse PRIVATE_KEY
REFERRAL_AUTO_QUALIFY=1
# Manual: python -m bots --qualify 0xReferee…
```

```bash
cp contracts/.env.example contracts/.env
# Set PRIVATE_KEY, BITE_TOKEN, DEPLOYER / OWNER, CORE_TARGET, etc.
# PRIVATE_KEY must never be committed.

cd contracts
forge test
forge test --match-contract ReferralEscrowTest
```

Deploy:

```bash
npm run reserved-math
cd contracts
# Fill contracts/.env first (PRIVATE_KEY + your token / deployer addresses)
./scripts/deploy-kitchen.sh
./scripts/deploy-referral-escrow.sh   # fund the printed PROXY address
```

Or with forge directly (still needs env):

```bash
forge script script/DeployKitchen.s.sol:DeployKitchen \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
```

## Activity bot (Telegram)

Onchain watcher that posts to Telegram (Twitter optional). Buy/trade CTAs point at your site’s native swap; Pons is fallback-only. After in-app buy (kitchen fee skim) + kitchen bite for a bound referee, the bot calls `ReferralEscrow.qualify` when `REFERRAL_ATTESTER_KEY` / `PRIVATE_KEY` is set.

**Native-swap KPI** (in-app only — not all-chain DEX volume):

| Read | How |
|------|-----|
| Telegram | DM the bot `/kitchen` (admin chat only) or scheduled admin DM |
| Bot HTTP | `GET /swap-stats.json` (also `swapStats` on `/leaderboard.json`) |
| Site | `GET /api/swap-stats` |

Definition: SwapModal / Trading API execute with `integratorFees` → kitchen (0.5% of output). On-chain proxy = Transfer→kitchen from Uniswap routers. Volume ≈ fee ÷ 0.5%. SwapModal POSTs successful txs to `/api/swap-stats` (forwards to Railway `POST /native-swap` when `BITE_LEADERBOARD_URL` is set).

```bash
pip install -r bots/requirements.txt
cp bots/.env.example bots/.env
# Add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (+ attester key and chain/token addresses)
python -m bots --smoke           # RPC + contract check
python -m bots --test            # live Telegram test
python -m bots --qualify 0x…     # manual referral attest
python -m bots --admin-report    # kitchen + native-swap KPI DM
python -m bots --daemon          # always-on
```

Act I (`PHASE=1`): burn posts deferred until Act II. Put secrets in `bots/.env` — never paste them into chat or commit them.

## Disclaimer

Not affiliated with Apple Inc. or Robinhood. AAPL tokens are not shares. Experimental memecoin — you can lose everything. Write **pons** lowercase; no implied partnership.
