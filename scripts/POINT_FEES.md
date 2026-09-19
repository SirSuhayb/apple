# Point pons creator fees at AppleKitchen

Deploy **after** mint when you have the `$BITE` address. Full flow:

1. Launch on pons vs AAPL (`buybackEnabled` **false**).
2. `npm run reserved-math` → note `CORE_TARGET` / `DEADLINE`.
3. Deploy kitchen (below), set `NEXT_PUBLIC_APPLE_KITCHEN` + `NEXT_PUBLIC_BITE_TOKEN`.
4. After ~$500–1k creator fees: Dexscreener + verify, then redirect fees here.

## Contract surface (`contracts/src/AppleKitchen.sol`)

| Call | Who | Effect |
| ---- | --- | ------ |
| `bite(amount)` | anyone | pull+burn caller BITE; counts toward core |
| `digest()` | anyone | free AAPL fees → 50% swap+burn BITE, 50% prize |
| `revealCore(merkleRoot)` | anyone | if `burned >= coreTarget` before deadline → Core; swarm claims (deployer excluded) |
| `revealRot()` | anyone | after deadline without core → entire pot to **deployer only** |
| `claim(...)` | eaters | Core payout; reverts if `account == deployer` |

Tests: `cd contracts && forge test` (or `npm run test:contracts`).

## Deploy

```bash
cd contracts
export BITE_TOKEN=0x...
export AAPL_TOKEN=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9
export DEPLOYER=0x...
export CORE_TARGET=$(node ../scripts/reserved-math.mjs | jq -r .forgeEnv.CORE_TARGET)
export DEADLINE=$(node ../scripts/reserved-math.mjs | jq -r .forgeEnv.DEADLINE)
forge script script/DeployKitchen.s.sol:DeployKitchen --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
```

## Redirect fees (pons v2)

As the current `creatorFeeRecipient`, call on the pons factory (or the UI “fee recipient” control):

```text
transferCreatorFeeRecipient(token, appleKitchen)
```

Factory (check [docs.ponsfamily.com/v2](https://docs.ponsfamily.com/v2) for the live address):

```text
0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
```

Leave `buybackEnabled` **false** — pons buybacks vest, they do not burn.

## After redirect

- Anyone can call `AppleKitchen.digest()` to split incoming AAPL: 50% buy+burn BITE, 50% prize pot.
- Set `setRouter(adapter)` to **V4KitchenRouter** (not Universal Router / V2 router) so digests can buy-and-burn on the live v4 pool. See [docs/v4-kitchen-router.md](../docs/v4-kitchen-router.md).
- When `burned >= coreTarget` before deadline → `revealCore(merkleRoot)` → eaters claim (deployer excluded).
- If deadline passes first → `revealRot()` → entire pot to deployer only.