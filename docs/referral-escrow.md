# ReferralEscrow — UUPS referral payout layer (Robinhood 4663)

Escrowed `$BITE` paid to referrers when a referee completes an **in-app** buy+burn.
An **attester** confirms that path off-chain and calls `qualify`.

## Live addresses (fund the PROXY)

| | |
|---|---|
| **PROXY (fund this)** | `0xc127327419D78C8546230463F8b421Bb66212660` |
| Implementation | `0x160713Dad46ec3b8363fe8C3979e55E480C8BC6b` |
| Token (BITE) | `0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9` |
| rewardPerReferral | `1000e18` (1000 BITE) — ~1000 payouts from a 1M BITE pool |
| Owner / attester (initial) | kitchen deploy EOA `0x36B548C9F4E9A014fB5858c885Fd54cADd3011Ca` |

Do **not** fund the first mistaken proxy `0x30526A0E…783B` (owner was sirsu.eth; superseded).

Owner can raise/lower the reward later with `setRewardPerReferral` (e.g. when wager fees refill escrow).

## Minimum swap & burn for qualification

The attester enforces minimum thresholds before qualifying a referee.
This prevents dust transactions from farming referral rewards.
Swaps and burns of any size are still allowed — the minimums only gate
referral eligibility. Amounts accumulate across multiple transactions.

| Env var | Default | Description |
|---|---|---|
| `REFERRAL_MIN_SWAP_USD` | `25` | USD minimum for the referee's cumulative in-app buys |
| `REFERRAL_MIN_SWAP_BITE` | `500000` | BITE-amount fallback when Dexscreener price is unavailable |
| `REFERRAL_MIN_BURN_USD` | `5` | USD minimum for the referee's cumulative kitchen burns |
| `REFERRAL_MIN_BURN_BITE` | `100000` | BITE-amount fallback when Dexscreener price is unavailable |

When the bot has a Dexscreener price, it converts BITE to USD. If no price
is available, it falls back to the raw BITE amount threshold.
Set either to `0` to disable that minimum.

## Why an attester?

Raw transfers / DEX fills can be faked or done outside the app. Attester verifies
Trading API (integratorFees kitchen skim) + `kitchen.bite`, then `qualify(referee)`.

## Happy path

1. **Fund** — `approve` + `deposit` on the **proxy**
2. **Bind** — referee `bind(referrer)` once (site: `?ref=` → wallet connect → wagmi sign)
3. **Qualify** — attester `qualify(referee)` → pays referrer `rewardPerReferral`
4. **Leftover** — owner `withdraw`

## Site / bot env

**Vercel (public):**

```bash
NEXT_PUBLIC_REFERRAL_ESCROW=0xc127327419D78C8546230463F8b421Bb66212660
```

(Default in `src/lib/config.ts` already points at the live proxy.)

**Railway (orchard bot — secrets, never commit):**

```bash
REFERRAL_ESCROW=0xc127327419D78C8546230463F8b421Bb66212660
# Preferred: dedicated attester key (must match on-chain attester())
REFERRAL_ATTESTER_KEY=0x…
# Or reuse kitchen deploy key if that EOA is still the attester:
# PRIVATE_KEY=0x…
REFERRAL_AUTO_QUALIFY=1
# Minimum swap value to qualify a referral ($25 default, 0 to disable)
REFERRAL_MIN_SWAP_USD=25
# BITE-amount fallback when Dexscreener price unavailable (500k default)
REFERRAL_MIN_SWAP_BITE=500000
# Minimum burn value to qualify a referral ($5 default, 0 to disable)
REFERRAL_MIN_BURN_USD=5
# BITE-amount fallback when Dexscreener price unavailable (100k default)
REFERRAL_MIN_BURN_BITE=100000
```

Manual attest:

```bash
python -m bots --qualify 0xReferee…
python -m bots --qualify 0xReferee… --dry-run
```

## Upgrade later (UUPS)

Owner calls `upgradeToAndCall(newImpl, data)` on the proxy (OZ UUPS).

```bash
# deploy new implementation, then:
cast send $PROXY "upgradeToAndCall(address,bytes)" $NEW_IMPL 0x \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

Rotate attester: `setAttester(keeper)`. Optional: `transferOwnership(sirsu)`.

Change reward (e.g. after more fees land):

```bash
cast send $PROXY "setRewardPerReferral(uint256)" 1000000000000000000000 \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
cast call $PROXY "remainingPayouts()(uint256)" --rpc-url $RPC_URL
```

## Deploy / deps

```bash
cd contracts
forge install   # forge-std + openzeppelin-contracts-upgradeable
forge test --match-contract ReferralEscrowTest
./scripts/deploy-referral-escrow.sh
```

Script uses `PRIVATE_KEY` (same as kitchen) and forces owner+attester = that address.
Default `REWARD_PER_REFERRAL` is `1000e18`.
