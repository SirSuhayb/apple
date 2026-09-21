# BITE — Eat it to the core.

Timed race on Robinhood Chain: burn **50% of burnable** `$BITE` before the deadline.

- **Core** → prize pays qualified eaters (**not** the farmer).
- **Rot** → apple freezes and only the farmer gets paid.

Launch the token on [pons](https://www.ponsfamily.com/launchpad) vs AAPL. This repo is the race site + AppleKitchen.

## Order of operations

1. **Site** — `npm run dev` works in preview mode with no token.
2. **You launch** on pons vs AAPL (`buybackEnabled` off, website = this site, fees to your wallet).
3. Drop addresses into `.env.local` (see `.env.example`).
4. `npm run reserved-math` → deploy AppleKitchen with that `CORE_TARGET`.
5. At ~$500–1k fees: Dexscreener + verify, then point fees at the kitchen ([scripts/POINT_FEES.md](scripts/POINT_FEES.md)).

## Site

```bash
npm install
npm run dev
```

Apple product-page layout: hero brand + full-bleed stop-motion apple, then wager / how / core / eaters / tap / footer.

Eydeet CC-BY frames live in `public/apple/frames/0.glb`…`9.glb` (UI frame *i* → Sketchfab `frame_i`). Rebake with `npm run bake-apple`.

## Contracts

`AppleKitchen` lives in `contracts/src/AppleKitchen.sol` — `bite`, `digest` (50/50), `revealCore` (swarm minus deployer), `revealRot` (pot to deployer). Deploy **after** mint; see [scripts/POINT_FEES.md](scripts/POINT_FEES.md).

`ReferralEscrow` (`contracts/src/ReferralEscrow.sol`) is a **UUPS** escrow: fixed `$BITE` per in-app referral via attester `qualify`. Fund the **proxy** (not the implementation). Site `?ref=` → wallet `bind(referrer)`; orchard bot attests buy+burn then `qualify`.

Live proxy (Robinhood 4663): `0xc127327419D78C8546230463F8b421Bb66212660` — `rewardPerReferral` = **1000 BITE** (~1k referrals from a 1M pool; owner can `setRewardPerReferral` later). Deploy: `cd contracts && ./scripts/deploy-referral-escrow.sh` (needs `PRIVATE_KEY`; `forge install` for OZ upgradeable).

**Vercel:** `NEXT_PUBLIC_REFERRAL_ESCROW=0xc127327419D78C8546230463F8b421Bb66212660` (also defaulted in `src/lib/config.ts`).

**Railway (attester — never commit keys):**

```bash
REFERRAL_ESCROW=0xc127327419D78C8546230463F8b421Bb66212660
REFERRAL_ATTESTER_KEY=0x…   # must match on-chain attester(); or reuse PRIVATE_KEY
REFERRAL_AUTO_QUALIFY=1
# Manual: python -m bots --qualify 0xReferee…
```

```bash
cd contracts
forge test
forge test --match-contract ReferralEscrowTest
```

Deploy:

```bash
npm run reserved-math
cd contracts
forge script script/DeployKitchen.s.sol:DeployKitchen --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
# Referral escrow UUPS (fund printed PROXY):
./scripts/deploy-referral-escrow.sh
```

## Activity bot (Telegram)

Onchain watcher that posts to Telegram (Twitter optional). Buy/trade CTAs point at [bite.party/#swap](https://www.bite.party/#swap) (native swap); Pons is fallback-only. After in-app buy (kitchen fee skim) + kitchen bite for a bound referee, the bot calls `ReferralEscrow.qualify` when `REFERRAL_ATTESTER_KEY` / `PRIVATE_KEY` is set.

```bash
pip install -r bots/requirements.txt
cp bots/.env.example bots/.env   # add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (+ attester key)
python -m bots --smoke           # RPC + contract check
python -m bots --test            # live Telegram test
python -m bots --qualify 0x…     # manual referral attest
python -m bots --daemon          # always-on
```

Act I (`PHASE=1`): burn posts deferred until Act II. Put secrets in `bots/.env` — never paste them into chat.

## Disclaimer

Not affiliated with Apple Inc. or Robinhood. AAPL tokens are not shares. Experimental memecoin — you can lose everything. Write **pons** lowercase; no implied partnership.
