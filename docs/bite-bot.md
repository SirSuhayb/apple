# $BITE Telegram / Twitter activity bot

Monitors `$BITE` on Robinhood Chain (4663) and posts to Telegram. Twitter is optional.

**Act I (`PHASE=1`):** burns are detected and logged, but **Telegram burn posts start at `PHASE=2`** (kitchen / Act II). The bot can run idle/ready after `--test`, still tracking holders and burn %. Notable Transfer “buy” posts are off by default in Act I (`POST_ACTIVITY=0`); set `POST_ACTIVITY=1` if you want them.

Live contract default: `0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9`  
Site: https://www.bite.party

## 1. Create the Telegram bot (BotFather)

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, pick a display name and a username ending in `bot`.
3. Copy the **HTTP API token** BotFather returns.
4. Add the bot to your channel/group (or start a DM with it).
5. For a **channel**: promote the bot as admin with permission to post messages.
6. For **commands** (`/balance`, etc.): use a **group** (or DM the bot). Broadcast channels do not deliver member commands to bots. In groups, BotFather → `/setprivacy` → **Disable** if you want natural phrases like `check balance` (slash commands work either way).
7. Get the **chat ID** (for activity posts):
   - DM: message the bot, then open  
     `https://api.telegram.org/bot<TOKEN>/getUpdates`  
     and read `result[].message.chat.id`.
   - Channel/supergroup: often `-100…` — post once, then check `getUpdates`, or forward a channel post to [@userinfobot](https://t.me/userinfobot) / similar.
8. Put secrets in a local env file (never commit, never paste into chat):

```bash
cp bots/.env.example bots/.env
# edit bots/.env:
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_CHAT_ID=...
```

Also accepted: repo-root `.env` or `.env.local` (same variable names). See `bots/.env.example` and the bot section in root `.env.example`.

## 2. Install & run

From the repo root:

```bash
python3 -m venv .venv-bots
source .venv-bots/bin/activate
pip install -r bots/requirements.txt

# Smoke: RPC + contract only (no Telegram secrets)
python -m bots --smoke

# Dry-run command handlers (no Telegram spam)
python -m bots --commands-test

# Dry-run: format posts, no network send
python -m bots --test --dry-run
python -m bots --dry-run

# Live test post (needs TELEGRAM_* in bots/.env)
python -m bots --test

# One poll cycle (+ drain pending Telegram commands)
python -m bots

# Always-on (chain poll + Telegram command polling)
python -m bots --daemon
python -m bots --daemon --interval 30
```

Restart after code/env changes: stop the old process, then start again:

```bash
pkill -f "python -m bots --daemon" || true
source .venv-bots/bin/activate
python -m bots --daemon
```

Module entrypoints: `python -m bots` or `python -m bots.bite_bot` (package is `bots/`, not `docs/bite-bot.py`).

## 3. Env vars

| Var | Required | Notes |
|-----|----------|--------|
| `TELEGRAM_BOT_TOKEN` | for live posts / commands | from BotFather |
| `TELEGRAM_CHAT_ID` | for live activity posts | channel/group/DM id |
| `BITE_CONTRACT` | no | defaults to live CA |
| `RPC_URL` | no | defaults to Robinhood mainnet RPC |
| `MIN_SWAP_USD` | no | default `50` — minimum USD value for buy posts (uses Dexscreener `priceUsd`; falls back to `MIN_SWAP_AMOUNT` in BITE when price unavailable) |
| `MIN_BURN_USD` | no | default `50` — minimum USD value for burn posts (same USD→BITE fallback logic) |
| `PHASE` | no | `1` Act I; `2+` enable burn posts |
| `POINTS_PER_BITE_GAINED` | no | default `1` — Act I accum points |
| `HOLD_BITE_PER_POINT_PER_HOUR` | no | default `100` — Act I hold rate |
| `LEADERBOARD_TOP_N` | no | default `10` |
| `BITE_BOT_STATE_FILE` | no | default `bots/.bite_bot_state.json` |
| `BITE_LEADERBOARD_PUBLIC_FILE` | no | default `public/data/act1-leaderboard.json` (site reads this) |
| `TRADE_SCAN_FROM_BLOCK` | no | default `63818043` — first mint / pons V2 launch of live `$BITE` (2026-09-15T17:02:35Z). Bot backfills trades from this block on startup. |
| `DEV_WALLETS` | no | comma-separated; default `0xEB95ff72…b42E`. Shown with a **Dev** badge; scored but **ineligible** to win. |
| `INELIGIBLE_WALLETS` | no | extra wallets excluded from winning (merged with `DEV_WALLETS`) |
| `BLOCKSCOUT_API_KEY` | for accurate holders | Blockscout Pro key for `https://api.blockscout.com/{CHAIN_ID}/api/v2/...` |
| `BLOCKSCOUT_API_BASE` | no | default `https://api.blockscout.com/4663/api/v2` |
| `DEXSCREENER_PAIR_ID` | no | Uniswap v4 pair id used for Dexscreener market stats |
| `BITE_LEADERBOARD_URL` | no | (site) optional remote JSON URL so Vercel can refresh without redeploy |
| Twitter keys | no | skipped if missing |

## 4. Telegram commands (Act I)

Works in **group chats** and **DMs** with the bot (not in broadcast-only channels).

| Command | Aliases | What it does |
|---------|---------|----------------|
| paste `0x…` / `/link 0x…` | bare address in **DM only** | Bind your Telegram user → wallet |
| `/unlink` | | Remove your link (points stay on the wallet) |
| `/balance` | `/bal`, `check balance` | On-chain `$BITE` balance |
| `/points` | `/pts`, `check points` | Your Act I points + rank (group-safe) |
| `/leaderboard` | `/lb`, `check leaderboard` | Top wallets by points · trades |
| `/stats` | `/supply`, `/info`, `stats`, `check stats`, `supply` | Supply breakdown: total, burned %, EOA held, LP/contract held, realistically burnable, prize pool (AAPL + USD), holders, price |
| `/burn` | `/tap`, `burn`, `tap` | Deep link to the burn UI on bite.party. `/burn 1000` pre-fills the amount. Shows current burn % and target. |
| `/ca` | `/contract`, `/address`, `contract address`, `ca` | Token contract address + chain info + links (kitchen address shown when `PHASE>=2`) |
| `/buy` | `buy`, `how to buy`, `where to buy` | How to buy $BITE — Pons launchpad link, chain, pair, current price, chart |
| `/help` | `/start` | Command list |

### Private link → public score

**Ideal flow:**

1. Open a **private DM** with the bot.
2. Paste your wallet (`0x…`) — that’s enough. Or send `/link 0x…`.
3. Bot confirms the link **in the DM only**.
4. In the **public group**, use `/points` or `/leaderboard` to show scores. If you’re linked, `/points` shows *your* score/rank and `/leaderboard` marks your row — **without pasting 0x in the group**.

**Public group paste:** if someone pastes a bare `0x…` or `/link 0x…` in the group, the bot **does not bind**. It replies briefly telling them to DM the bot instead.

**Wallet linking:** one Telegram user → one wallet. Relink anytime (in DM). If another user links the same wallet, the previous Telegram link is cleared. No signatures / off-chain auth — trust model is “honor system + public address” (fine for Act I leaderboard fun).

Links, points, and `tg_update_offset` live in `bots/.bite_bot_state.json` (gitignored).  
A sanitized board (wallets, points, trades — no Telegram ids) is written to `public/data/act1-leaderboard.json` for the site (`/leaderboard`, `/api/leaderboard`).

## 5. Buy bot

The bot doubles as a **buy bot** — reporting buys in the channel and helping users buy.

### Buy alerts (`POST_ACTIVITY=1`)

When `POST_ACTIVITY=1`, notable buys (≥ `MIN_SWAP_USD`) post a buy-bot-style alert:

```
🟢 $BITE Buy!
🔑 0xAb12...cD34
🍎 12.5K $BITE ($48.75)
💲 Price: $0.003900
👥 142 holders

🛒 Buy $BITE: https://www.ponsfamily.com/launchpad/...
📊 Chart: https://dexscreener.com/robinhood/...
🍎 https://www.bite.party
```

### `/buy` command

Users can send `/buy` (or `buy`, `how to buy`, `where to buy`) to get the Pons launchpad link, chain info, current price, and chart link.

### Env vars

| Var | Default | Notes |
|-----|---------|-------|
| `PONS_BUY_URL` | `https://www.ponsfamily.com/launchpad/0x0d6e...` | Pons launchpad link included in buy alerts + `/buy` |

## 6. Act I points (accumulation)

Kitchen bites / burns do **not** earn points in Act I. Scoring is for people **buying and holding** `$BITE` on the curve/pool.

For each wallet with **trade or hold activity** since `TRADE_SCAN_FROM_BLOCK` (not only Telegram-linked), every chain poll:

1. **Accumulation** — if `balanceOf` rose since the last snapshot, award  
   `floor(delta_BITE) × POINTS_PER_BITE_GAINED`  
   (default **+1 pt per whole $BITE gained**). Balance drops never claw back points.
2. **Holding** — using the previous snapshot balance and elapsed time:  
   `(balance_BITE / HOLD_BITE_PER_POINT_PER_HOUR) × hours`  
   (default **100 $BITE held for 1 hour = 1 pt**, pro-rated by poll interval).
3. **Trades** — each **buy** (`Transfer` from a contract / LP / router → an EOA) increments `trade_count`. Routers and the LP pool itself are **excluded** from the board (they were skewing ranks). On startup the bot backfills from `TRADE_SCAN_FROM_BLOCK`.

**Market sources:** holder/trade truth is on-chain and refreshed via **Blockscout Pro** (`BLOCKSCOUT_API_KEY` → `https://api.blockscout.com/4663/api/v2/tokens/{CA}/holders` + `/counters`; address activity via `/addresses/{address}/transactions`). Pair volume/txn stats come from [Dexscreener](https://dexscreener.com/robinhood/0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c) into the public JSON `market` field.

Telegram `/link` is **identity only**: linked users get personalized `/points` replies. Unlinked wallets still appear on the board as truncated addresses. First snapshot for a wallet seeds balance without awarding phantom accumulation.

**Dev / ineligible:** creator wallets in `DEV_WALLETS` stay on the board with a Dev badge and are excluded from winning ranks (Telegram shows `Dev · ineligible`; site ranks them as `—`).

## 7. Site Act I leaderboard

- Home “Who traded the most” + `/leaderboard` show **points + trades** only (no kitchen burn columns).
- Data source: `BITE_LEADERBOARD_URL` (optional) → `public/data/act1-leaderboard.json` → `BITE_BOT_STATE_FILE`.
- Commit / redeploy the public JSON (or set `BITE_LEADERBOARD_URL` to a hosted copy the bot updates) so production has board data.

## 8. Hosting (always-on)

Run `--daemon` on a small always-on host:

- **Railway / Fly.io / Render**: deploy a worker that runs `python -m bots --daemon`; set env vars in the platform dashboard (same names as `bots/.env.example`).
- **cron**: less ideal (misses short windows + command latency); if used, call `python -m bots` every minute.
- Persist `bots/.bite_bot_state.json` (or set `BITE_BOT_STATE_FILE`) so restarts do not re-announce old events or reset points/links.
- Persist / publish `public/data/act1-leaderboard.json` so the Next.js site can read Act I ranks.

## 9. Flip to Act II

When the kitchen opens and burns matter:

```bash
# in bots/.env
PHASE=2
```

Restart the daemon. Burn transfers to the dead address and burn % milestones will post to Telegram. (Act II kitchen points can be added later; Act I rules above stay holdings-focused.)
