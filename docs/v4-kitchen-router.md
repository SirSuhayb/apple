# V4KitchenRouter — digest buy-and-burn adapter

AppleKitchen is **immutable**. `digest()` always calls Uniswap V2

`swapExactTokensForTokens(amountIn, 0, [AAPL, BITE], kitchen, deadline)`

on `kitchen.router` after `AAPL.approve(router, amountIn)`. There is no V2 pair for BITE/AAPL on Robinhood 4663 — liquidity is the live Uniswap **v4** pool. Pointing `setRouter` at UniswapV2Router02 or Universal Router 2.1.1 will revert (wrong interface / Permit2), and a reverting swap makes `digest` **park no prize**.

This adapter is the missing V2 surface. Internally it `unlock`s PoolManager, exact-input swaps AAPL→BITE on the live pool, and sends BITE to `to` (the kitchen). Kitchen then burns that BITE.

## Deployed (4663) — not wired yet

| | |
|---|---|
| **V4KitchenRouter** | `0xE219BA4608B66280d8FD00f6A89f6e7Df3955E48` |
| Deploy tx | `0xdd5d20671ffa6dd77031b5a28c4ed9d70f79491ef97e52c31f5cca6ed235557d` |
| Deployer (not owner) | `0x36B548C9F4E9A014fB5858c885Fd54cADd3011Ca` |
| `kitchen.router()` | still `address(0)` — **setRouter has not been sent** |

## Live pool (Robinhood 4663)

| | |
|---|---|
| Kitchen | `0x56fEb999D829761C787581413605bf88F5Cd81e0` |
| Kitchen owner | sirsu.eth `0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E` |
| AAPL | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` |
| BITE | `0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9` |
| PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| Pool id | `0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c` |
| Fee / tickSpacing / hooks | `0` / `200` / `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044` |
| token0 / token1 | BITE / AAPL (`zeroForOne = false` for AAPL→BITE) |

Universal Router 2.1.1 (`0x8876789976dEcBfCbBbe364623C63652db8C0904`) is **not** the kitchen router. Kitchen never calls `execute()`.

## Adapter behavior

1. Revert unless `path = [AAPL, BITE]`, `amountIn > 0`, `to != 0`, `deadline >= now`.
2. `transferFrom` caller’s AAPL (kitchen already approved `amountIn`).
3. `poolManager.unlock` → `swap` exact-in, `sync` + pay AAPL, `take` BITE to `to`.
4. Return `amounts` with `amounts[0] = amountIn` and `amounts[last] = BITE out` (what kitchen burns).
5. Sweep leftover AAPL to the payer and leftover BITE to `to` so nothing sticks on the adapter.
6. Slippage: digest passes `amountOutMin = 0`. A normal v4 swap must not revert (hook `afterSwap` fees are settled from the returned delta).

If the swap *does* revert, kitchen's `catch` leaves all free AAPL unparked for a later digest. Fork tests on 4663 already pass against this adapter.

## Deploy (not setRouter)

Deploying can be any funded key. **`setRouter` is owner-only** — do not send it from a non-owner key.

```bash
cd contracts
./scripts/deploy-v4-kitchen-router.sh
```

After broadcast, note `V4KitchenRouter` in the logs. This script never calls `setRouter`.

## `setRouter` for sirsu.eth

From the kitchen owner (`0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E`):

```text
to:       0x56fEb999D829761C787581413605bf88F5Cd81e0
function: setRouter(address)
argument: 0xE219BA4608B66280d8FD00f6A89f6e7Df3955E48
```

Calldata (owner-only; sirsu.eth `0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E`):

```text
cast calldata "setRouter(address)" 0xE219BA4608B66280d8FD00f6A89f6e7Df3955E48
```

```text
to:   0x56fEb999D829761C787581413605bf88F5Cd81e0
data: 0xc0d78655000000000000000000000000e219ba4608b66280d8fd00f6a89f6e7df3955e48
```

Do **not** treat deploy as wiring. Until owner sends that tx, `digest()` still no-ops the swap (`router == address(0)` parks 50% as prize and leaves the burn side sitting).

## Tests

```bash
cd contracts
forge test -vvv
# fork tests hit https://rpc.mainnet.chain.robinhood.com (skip if RPC is down)
```

Fork tests impersonate owner to `setRouter` **on the fork only**, and `digest` a tiny dealt surplus. They do not broadcast.

## Do not

- Rewrite AppleKitchen
- `setRouter` to UniswapV2Router02 or Universal Router
- Call `digest` with real surplus on mainnet from this work
- LP or ship `/challenge` as part of this adapter
