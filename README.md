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

`ReferralEscrow` (`contracts/src/ReferralEscrow.sol`) pays fixed `$BITE` from escrow to referrers when an **attester** confirms the referee’s in-app buy+burn. Site `?ref=` is attribution only; on-chain `bind` + `qualify` is the payout layer. Deploy script does **not** fund or mainnet-broadcast by default — see contract NatSpec + `script/DeployReferralEscrow.s.sol`.

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
# Referral escrow (dry-run unless --broadcast); set ATTESTER + OWNER; fund deposit separately
forge script script/DeployReferralEscrow.s.sol:DeployReferralEscrow --rpc-url https://rpc.mainnet.chain.robinhood.com
```

## Activity bot (Telegram)

Onchain watcher that posts to Telegram (Twitter optional). Buy/trade CTAs point at [bite.party/#swap](https://www.bite.party/#swap) (native swap); Pons is fallback-only. See [docs/bite-bot.md](docs/bite-bot.md).

```bash
pip install -r bots/requirements.txt
cp bots/.env.example bots/.env   # add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
python -m bots --smoke           # RPC + contract check
python -m bots --test            # live Telegram test
python -m bots --daemon          # always-on
```

Act I (`PHASE=1`): burn posts deferred until Act II. Put secrets in `bots/.env` — never paste them into chat.

## Disclaimer

Not affiliated with Apple Inc. or Robinhood. AAPL tokens are not shares. Experimental memecoin — you can lose everything. Write **pons** lowercase; no implied partnership.
