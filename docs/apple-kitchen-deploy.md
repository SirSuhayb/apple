# AppleKitchen (Act II) — deploy & first burn

## Deploy (Robinhood 4663)

1. Copy `contracts/.env.example` → `contracts/.env`
2. Set `PRIVATE_KEY` for deployer `0xEB95ff72…b42E` (needs RH gas)
3. Confirm params:
   - `BITE_TOKEN=0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9`
   - `AAPL_TOKEN=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9`
   - `CORE_TARGET=5e26` (500M = 50% of 1B supply; adjust if LP floor should be excluded)
   - `DEADLINE` optional — defaults to now+30d in the script
4. From `contracts/`:

```bash
./scripts/deploy-kitchen.sh
```

5. Note the printed `AppleKitchen` address.

## Wire site + bot

```bash
# .env.local + Vercel production
NEXT_PUBLIC_APPLE_KITCHEN=<kitchen>
NEXT_PUBLIC_DEPLOYER=0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E
NEXT_PUBLIC_DAY_ONE=false
# Leave SITE_ACT unset — Act II auto-resolves when kitchen is set
# Or force: NEXT_PUBLIC_SITE_ACT=2
NEXT_PUBLIC_ACT_II_STARTED_AT=<unix now>

# bots/.env
PHASE=2
```

Redeploy the site (`npx vercel --prod`). Restart the bot daemon.

## Pons creator fee recipient

On pons (token admin): set **creator fee recipient** → kitchen address.  
Keep **buybackEnabled = false**. After fees accumulate, kitchen `digest()` splits 50/50 burn/prize.

Buy-and-burn uses [V4KitchenRouter](./v4-kitchen-router.md) at `0xE219BA4608B66280d8FD00f6A89f6e7Df3955E48`. Do **not** `setRouter` to Universal Router. Owner (sirsu.eth) still needs to send `setRouter(adapter)` — deploy did not wire it.

## First burn on bite.party

1. Refresh site — badge should move to Act II / burns open
2. Connect wallet holding `$BITE`
3. Tap / burn → approve kitchen → `bite(amount)`
4. Confirm on [Blockscout](https://robinhoodchain.blockscout.com/) + leaderboard burn columns
