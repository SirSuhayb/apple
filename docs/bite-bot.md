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
6. Get the **chat ID**:
   - DM: message the bot, then open  
     `https://api.telegram.org/bot<TOKEN>/getUpdates`  
     and read `result[].message.chat.id`.
   - Channel: often `-100…` — post once, then check `getUpdates`, or forward a channel post to [@userinfobot](https://t.me/userinfobot) / similar.
7. Put secrets in a local env file (never commit, never paste into chat):

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

# Dry-run: format posts, no network send
python -m bots --test --dry-run
python -m bots --dry-run

# Live test post (needs TELEGRAM_* in bots/.env)
python -m bots --test

# One poll cycle
python -m bots

# Always-on
python -m bots --daemon
python -m bots --daemon --interval 30
```

Module entrypoints: `python -m bots` or `python -m bots.bite_bot` (package is `bots/`, not `docs/bite-bot.py`).

## 3. Env vars

| Var | Required | Notes |
|-----|----------|--------|
| `TELEGRAM_BOT_TOKEN` | for live posts | from BotFather |
| `TELEGRAM_CHAT_ID` | for live posts | channel/group/DM id |
| `BITE_CONTRACT` | no | defaults to live CA |
| `RPC_URL` | no | defaults to Robinhood mainnet RPC |
| `PHASE` | no | `1` Act I; `2+` enable burn posts |
| Twitter keys | no | skipped if missing |

## 4. Hosting (always-on)

Run `--daemon` on a small always-on host:

- **Railway / Fly.io / Render**: deploy a worker that runs `python -m bots --daemon`; set env vars in the platform dashboard (same names as `bots/.env.example`).
- **cron**: less ideal (misses short windows); if used, call `python -m bots` every minute.
- Persist `bots/.bite_bot_state.json` (or set `BITE_BOT_STATE_FILE`) so restarts do not re-announce old events.

## 5. Flip to Act II

When the kitchen opens and burns matter:

```bash
# in bots/.env
PHASE=2
```

Restart the daemon. Burn transfers to the dead address and burn % milestones will post to Telegram.
