# $JUICE — Squeeze every drop.

Revnet-backed game on **Base**: squeeze supply through the press, earn seeds, fill containers of juice.

- **Last Drop** → prize pays qualified squeezers.
- **Dry** → fruit dries and only the grower gets paid.

Powered by [Juicebox V6 revnets](https://github.com/rev-net/revnet-core-v6). Revenue backs the treasury. Seeds grow into NFT containers.

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
# Edit .env.local — see "Environment" below. Leave secrets empty until you have them.
npm run dev
```

`npm run dev` works in preview mode with no token configured.

## Architecture

### Juicebox V6 Revnet

$JUICE uses a Juicebox V6 revnet on Base (chain 8453) for its treasury:

- **`pay`** — Send ETH to the revnet terminal. Mint $JUICE tokens for the beneficiary based on the current issuance rate.
- **`addToBalanceOf`** — Deposit revenue that backs existing holders without minting new tokens. Increases surplus available for cash-outs.
- **`cashOutTokensOf`** — Redeem $JUICE tokens for a share of the treasury surplus. Cash-out value depends on supply, surplus, and the revnet's rules.

Protocol sources:
- [JBMultiTerminal](https://github.com/Bananapus/nana-core-v6/blob/main/src/JBMultiTerminal.sol)
- [REVDeployer](https://github.com/rev-net/revnet-core-v6/blob/main/src/REVDeployer.sol)
- [REVOwner (auto-issuance)](https://github.com/rev-net/revnet-core-v6/blob/main/src/REVOwner.sol)

### Seeds & NFT Containers

Every trade, hold, and squeeze earns seeds. Seeds fill containers of juice:

| Container  | Ounces | Seeds Required |
|------------|--------|----------------|
| Juice Box  | 4 oz   | 320            |
| Bottle     | 8 oz   | 640            |
| Mason Jar  | 16 oz  | 1,280          |
| Growler    | 32 oz  | 2,560          |

80 seeds = 1 oz of juice. Container NFTs (ERC-721 on Base) prove your squeeze history.

### Swap

In-app swaps use the Uniswap Trading API on Base. Supported pairs:
- Buy: ETH / USDC / WETH → $JUICE
- Sell: $JUICE → ETH

0.5% integrator fee flows to the revnet treasury.

## Environment

Root template: [`.env.example`](.env.example) → copy to `.env.local`.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_RPC_URL` | Base RPC |
| `NEXT_PUBLIC_JUICE_TOKEN` | $JUICE token address on Base |
| `NEXT_PUBLIC_REVNET_PROJECT_ID` | Juicebox V6 project ID |
| `NEXT_PUBLIC_JB_MULTI_TERMINAL` | JBMultiTerminal address on Base |
| `NEXT_PUBLIC_JUICE_NFT_CONTRACT` | ERC-721 container NFT contract |
| `NEXT_PUBLIC_DEPLOYER` | Grower / creator EOA (excluded from squeezers) |
| `NEXT_PUBLIC_WC_PROJECT_ID` | [WalletConnect Cloud](https://cloud.walletconnect.com/) project id |
| `UNISWAP_API_KEY` | Server-only Uniswap Trading API key (never `NEXT_PUBLIC_`) |
| `SWAP_OPS_RECIPIENT` | Optional ops fee recipient EOA |

## Contracts

`AppleKitchen` lives in `contracts/src/AppleKitchen.sol` — legacy burn contract from the BITE era. The revnet replaces this for $JUICE.

`ReferralEscrow` (`contracts/src/ReferralEscrow.sol`) is a **UUPS** escrow: fixed $JUICE per in-app referral via attester `qualify`.

```bash
cd contracts
forge test
```

## Activity bot (Telegram)

Onchain watcher that posts to Telegram. Buy/trade CTAs point at the site's native swap.

```bash
pip install -r bots/requirements.txt
cp bots/.env.example bots/.env
python -m bots --smoke
python -m bots --daemon
```

## Disclaimer

Experimental token on Base. You can lose everything. Not financial advice.
