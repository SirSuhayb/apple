"""
$BITE — Onchain Activity Bot

Monitors the $BITE token on Robinhood Chain (4663) and posts activity
to Telegram (required) and Twitter/X (optional).

Act I (PHASE=1): burn posts are deferred. Bot still polls Transfer events,
updates burn state, may post holder milestones / notable buys, and awards
accumulation/holding points for Telegram-linked wallets.
Commands: /link, /balance, /points, /leaderboard (daemon polls getUpdates).
Act II+ (PHASE>=2): burn trades, tap burns, and burn milestones are posted.

Run from repo root:
  python -m bots --test
  python -m bots --commands-test
  python -m bots --daemon
  python -m bots
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import tweepy
except ImportError:
    tweepy = None

try:
    from web3 import Web3
except ImportError:
    Web3 = None

try:
    from dotenv import load_dotenv

    # Prefer bots/.env, then repo-root .env / .env.local
    _bots_dir = Path(__file__).resolve().parent
    _repo_root = _bots_dir.parent
    for candidate in (
        _bots_dir / ".env",
        _repo_root / ".env",
        _repo_root / ".env.local",
    ):
        if candidate.exists():
            load_dotenv(candidate, override=False)
    load_dotenv(override=False)
except ImportError:
    pass

# ── Config ──

RPC_URL = os.getenv("RPC_URL", "https://rpc.mainnet.chain.robinhood.com")
BITE_CONTRACT = os.getenv(
    "BITE_CONTRACT",
    "0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9",
)
DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
PHASE = int(os.getenv("PHASE", "1"))
STATE_FILE = Path(
    os.getenv("BITE_BOT_STATE_FILE", Path(__file__).resolve().parent / ".bite_bot_state.json")
)
SITE_URL = os.getenv("SITE_URL", "https://www.bite.party")
CHAIN_ID = int(os.getenv("CHAIN_ID", "4663"))

# Notable Transfer→EOA posts (rough buy proxy). Off in Act I by default to avoid spam.
_post_activity_env = os.getenv("POST_ACTIVITY", "").strip().lower()
if _post_activity_env in ("1", "true", "yes", "on"):
    POST_ACTIVITY = True
elif _post_activity_env in ("0", "false", "no", "off"):
    POST_ACTIVITY = False
else:
    POST_ACTIVITY = PHASE >= 2

MIN_SWAP_RAW = int(float(os.getenv("MIN_SWAP_AMOUNT", "50")) * 10**18)
MIN_BURN_RAW = int(float(os.getenv("MIN_BURN_AMOUNT", "100")) * 10**18)
HOLDER_MILESTONES = [50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]
BURN_MILESTONES = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 49, 50]

# Act I points: accumulation (balance growth) + holding (time-weighted balance).
# Kitchen/burns do not earn points until Act II+.
POINTS_PER_BITE_GAINED = float(os.getenv("POINTS_PER_BITE_GAINED", "1"))
HOLD_BITE_PER_POINT_PER_HOUR = float(os.getenv("HOLD_BITE_PER_POINT_PER_HOUR", "100"))
LEADERBOARD_TOP_N = int(os.getenv("LEADERBOARD_TOP_N", "10"))
ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
# Sanitized Act I board for the site (no Telegram user ids). Default: public/data/
_LEADERBOARD_PUBLIC_DEFAULT = (
    Path(__file__).resolve().parent.parent / "public" / "data" / "act1-leaderboard.json"
)
LEADERBOARD_PUBLIC_FILE = Path(
    os.getenv("BITE_LEADERBOARD_PUBLIC_FILE", str(_LEADERBOARD_PUBLIC_DEFAULT))
)

# First mint / TokenLaunched for live $BITE on Robinhood Chain (pons V2 factory).
# eth_getLogs: Transfer from 0x0 at block 63818043 (2026-09-15T17:02:35Z).
DEFAULT_TRADE_FROM_BLOCK = 63818043
TRADE_SCAN_FROM_BLOCK = int(
    os.getenv("TRADE_SCAN_FROM_BLOCK", str(DEFAULT_TRADE_FROM_BLOCK))
)
LOG_CHUNK_SIZE = int(os.getenv("LOG_CHUNK_SIZE", "10000"))

# Creator / team wallets: visible on the board, scored, but ineligible to win.
_DEFAULT_DEV_WALLETS = ("0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E",)


def _parse_address_set(raw: str | None, defaults: tuple[str, ...] = ()) -> set[str]:
    out: set[str] = set()
    for part in (raw or "").split(","):
        a = part.strip()
        if ADDR_RE.match(a):
            out.add(a.lower())
    if not out:
        for a in defaults:
            if ADDR_RE.match(a):
                out.add(a.lower())
    return out


DEV_WALLETS = _parse_address_set(os.getenv("DEV_WALLETS"), _DEFAULT_DEV_WALLETS)
INELIGIBLE_WALLETS = _parse_address_set(os.getenv("INELIGIBLE_WALLETS")) | DEV_WALLETS

ERC20_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"},
        ],
        "name": "Transfer",
        "type": "event",
    },
]


# ── State ──

def default_state() -> dict:
    return {
        "last_block": 0,
        "holder_count": 0,
        "last_holder_milestone": 0,
        "last_burn_milestone": 0,
        "total_burned": 0,
        "total_supply": 0,
        "known_holders": [],
        "phase_note_posted": False,
        # Telegram user_id (str) -> checksum wallet
        "wallet_links": {},
        # wallet lower -> {points, last_balance_raw, last_snapshot_at, tg_user_id, ...}
        "points": {},
        "tg_update_offset": 0,
        "tg_commands_primed": False,
    }


def load_state() -> dict:
    state = default_state()
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            loaded = json.load(f)
        if isinstance(loaded, dict):
            state.update(loaded)
    state.setdefault("wallet_links", {})
    state.setdefault("points", {})
    state.setdefault("tg_update_offset", 0)
    state.setdefault("tg_commands_primed", False)
    return state


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Cap known_holders list size in state
    holders = state.get("known_holders") or []
    if len(holders) > 5000:
        state["known_holders"] = holders[-5000:]
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ── Twitter (optional) ──

def get_twitter():
    if not tweepy:
        return None
    keys = (
        "TWITTER_API_KEY",
        "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN",
        "TWITTER_ACCESS_SECRET",
    )
    if not all(os.getenv(k) for k in keys):
        print("Twitter credentials not set — skipping Twitter.")
        return None
    try:
        return tweepy.Client(
            consumer_key=os.environ["TWITTER_API_KEY"],
            consumer_secret=os.environ["TWITTER_API_SECRET"],
            access_token=os.environ["TWITTER_ACCESS_TOKEN"],
            access_token_secret=os.environ["TWITTER_ACCESS_SECRET"],
        )
    except Exception as e:
        print(f"Twitter client init failed: {e}")
        return None


def tweet(client, text: str) -> None:
    if not client:
        print(f"[TWITTER skip] {text}")
        return
    try:
        client.create_tweet(text=text)
        print(f"[TWITTER] {text}")
    except Exception as e:
        print(f"[TWITTER error] {e}")


# ── Telegram (HTTP API — sync, no PTB version fights) ──

def get_telegram():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("Telegram credentials not set (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).")
        return None, None
    return token, chat_id


def tg_send(
    token,
    chat_id,
    text: str,
    *,
    dry_run: bool = False,
    reply_to_message_id: int | None = None,
) -> bool:
    if dry_run:
        print(f"[TG dry-run] {text}")
        return True
    if not token or not chat_id:
        print(f"[TG skip] {text}")
        return False
    fields = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": "true",
    }
    if reply_to_message_id is not None:
        fields["reply_to_message_id"] = str(reply_to_message_id)
    payload = urllib.parse.urlencode(fields).encode()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    req = urllib.request.Request(url, data=payload, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
        if not body.get("ok"):
            print(f"[TG error] {body}")
            return False
        print(f"[TG] {text}")
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        print(f"[TG HTTP {e.code}] {err}")
        return False
    except Exception as e:
        print(f"[TG error] {e}")
        return False


def tg_get_updates(token: str, offset: int, *, timeout: int = 0) -> list:
    """Fetch inbound Telegram updates (commands / DMs). Non-blocking by default."""
    if not token:
        return []
    params = urllib.parse.urlencode(
        {
            "offset": offset,
            "timeout": timeout,
            "allowed_updates": json.dumps(["message"]),
        }
    )
    url = f"https://api.telegram.org/bot{token}/getUpdates?{params}"
    try:
        with urllib.request.urlopen(url, timeout=max(10, timeout + 5)) as resp:
            body = json.loads(resp.read().decode())
        if not body.get("ok"):
            print(f"[TG getUpdates error] {body}")
            return []
        return body.get("result") or []
    except Exception as e:
        print(f"[TG getUpdates error] {e}")
        return []


def broadcast(twitter, token, chat_id, text: str, *, dry_run: bool = False) -> None:
    tweet(twitter, text) if not dry_run else print(f"[TWITTER dry-run] {text}")
    tg_send(token, chat_id, text, dry_run=dry_run)


# ── Chain ──

def get_web3():
    if not Web3:
        print("web3 not installed. Chain monitoring disabled.")
        return None, None
    w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 30}))
    if not BITE_CONTRACT:
        print("BITE_CONTRACT not set.")
        return w3, None
    try:
        connected = w3.is_connected()
    except Exception:
        connected = False
    if not connected:
        print(f"RPC not reachable: {RPC_URL}")
        return w3, None
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(BITE_CONTRACT),
        abi=ERC20_ABI,
    )
    return w3, contract


def short_addr(addr: str) -> str:
    a = str(addr)
    return a[:6] + "..." + a[-4:]


def fmt_amount(raw: int, decimals: int = 18) -> str:
    val = raw / (10**decimals)
    if val >= 1_000_000:
        return f"{val / 1_000_000:.1f}M"
    if val >= 1_000:
        return f"{val / 1_000:.1f}K"
    if val >= 10:
        return f"{val:.0f}"
    return f"{val:.2f}"


def fmt_points(pts: float) -> str:
    if pts >= 1000:
        return f"{pts:,.0f}"
    if pts >= 10:
        return f"{pts:.1f}"
    return f"{pts:.2f}"


def normalize_address(text: str) -> str | None:
    if not text:
        return None
    m = ADDR_RE.search(text.strip())
    if not m:
        return None
    addr = m.group(0)
    if Web3:
        try:
            return Web3.to_checksum_address(addr)
        except Exception:
            return addr
    return addr


def linked_wallet(state: dict, tg_user_id) -> str | None:
    links = state.get("wallet_links") or {}
    return links.get(str(tg_user_id))


def points_entry(state: dict, wallet: str) -> dict:
    key = wallet.lower()
    points = state.setdefault("points", {})
    entry = points.get(key)
    if not entry:
        entry = {
            "points": 0.0,
            "accum_points": 0.0,
            "hold_points": 0.0,
            "trade_count": 0,
            "last_balance_raw": None,
            "last_snapshot_at": None,
            "tg_user_id": None,
        }
        points[key] = entry
    entry.setdefault("trade_count", 0)
    if key in DEV_WALLETS:
        entry["dev"] = True
        entry["ineligible"] = True
        if Web3:
            try:
                entry["wallet"] = entry.get("wallet") or Web3.to_checksum_address(wallet)
            except Exception:
                entry["wallet"] = entry.get("wallet") or wallet
        else:
            entry["wallet"] = entry.get("wallet") or wallet
    elif key in INELIGIBLE_WALLETS:
        entry["ineligible"] = True
    return entry


def is_ineligible_wallet(wallet: str, entry: dict | None = None) -> bool:
    key = (wallet or "").lower()
    if key in INELIGIBLE_WALLETS or key in DEV_WALLETS:
        return True
    if entry and (entry.get("ineligible") or entry.get("dev")):
        return True
    return False


def is_dev_wallet(wallet: str, entry: dict | None = None) -> bool:
    key = (wallet or "").lower()
    if key in DEV_WALLETS:
        return True
    if entry and entry.get("dev"):
        return True
    return False


def ensure_dev_wallets(state: dict) -> None:
    """Always track configured creator wallets (visible + scored, ineligible)."""
    for w in DEV_WALLETS:
        display = Web3.to_checksum_address(w) if Web3 else w
        entry = points_entry(state, display)
        entry["dev"] = True
        entry["ineligible"] = True
        entry["wallet"] = display


def linked_wallet_set(state: dict) -> set[str]:
    return {
        w.lower()
        for w in (state.get("wallet_links") or {}).values()
        if isinstance(w, str) and w
    }


def tracked_wallet_set(state: dict) -> set[str]:
    """Wallets that earn trade counts / appear on the board (linked + dev)."""
    return linked_wallet_set(state) | set(DEV_WALLETS)


def public_leaderboard_payload(state: dict, *, limit: int | None = None) -> dict:
    """Sanitized rows for the site — wallets, points, trades only (no TG ids)."""
    ensure_dev_wallets(state)
    limit = LEADERBOARD_TOP_N if limit is None else limit
    rows = []
    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict):
            continue
        pts = float(entry.get("points") or 0)
        trades = int(entry.get("trade_count") or 0)
        is_dev = is_dev_wallet(wallet_l, entry)
        ineligible = is_ineligible_wallet(wallet_l, entry)
        # Always surface configured dev wallets even before first points/trades
        if pts <= 0 and trades <= 0 and not is_dev:
            continue
        display = entry.get("wallet") or wallet_l
        rows.append(
            {
                "address": display,
                "score": round(pts, 4),
                "trades": trades,
                "accumPoints": round(float(entry.get("accum_points") or 0), 4),
                "holdPoints": round(float(entry.get("hold_points") or 0), 4),
                "dev": is_dev,
                "ineligible": ineligible,
                "badge": "dev" if is_dev else None,
            }
        )
    # Eligible first by score, then ineligible (still visible, not winning)
    rows.sort(
        key=lambda r: (
            1 if r.get("ineligible") else 0,
            -r["score"],
            -r["trades"],
        )
    )
    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "phase": PHASE,
        "scoring": "act1",
        "tradeFromBlock": TRADE_SCAN_FROM_BLOCK,
        "eaters": rows[:limit] if limit else rows,
    }


def write_public_leaderboard(state: dict) -> None:
    payload = public_leaderboard_payload(state, limit=max(LEADERBOARD_TOP_N, 50))
    try:
        LEADERBOARD_PUBLIC_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LEADERBOARD_PUBLIC_FILE, "w") as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        print(f"[leaderboard export] {e}")


def read_balance_raw(contract, wallet: str) -> int | None:
    if not contract or not Web3:
        return None
    try:
        return int(
            contract.functions.balanceOf(Web3.to_checksum_address(wallet)).call()
        )
    except Exception as e:
        print(f"balanceOf error for {short_addr(wallet)}: {e}")
        return None


def award_act_i_points(contract, state: dict, *, now: datetime | None = None) -> dict:
    """
    Act I scoring for linked + configured dev wallets:
      - Accumulation: +POINTS_PER_BITE_GAINED per whole $BITE balance increase
      - Holding: +1 pt per HOLD_BITE_PER_POINT_PER_HOUR $BITE held per hour
        (pro-rated by time since last snapshot)
    Decreases do not claw back points. Kitchen/burns are ignored in Act I.
    Dev wallets score visibly but stay ineligible to win.
    """
    if PHASE < 1:
        write_public_leaderboard(state)
        return state
    now = now or datetime.now(timezone.utc)
    ensure_dev_wallets(state)
    links = state.get("wallet_links") or {}
    if not contract:
        write_public_leaderboard(state)
        return state

    # One wallet may be linked by multiple users; award once per wallet per cycle.
    wallets: dict[str, str] = {}
    for tg_uid, wallet in links.items():
        if not wallet:
            continue
        wallets[wallet.lower()] = wallet
        entry = points_entry(state, wallet)
        entry["tg_user_id"] = str(tg_uid)
    for w in DEV_WALLETS:
        display = Web3.to_checksum_address(w) if Web3 else w
        wallets.setdefault(w, display)

    if not wallets:
        write_public_leaderboard(state)
        return state

    for wallet_l, wallet in wallets.items():
        bal = read_balance_raw(contract, wallet)
        if bal is None:
            continue
        entry = points_entry(state, wallet_l)
        prev_raw = entry.get("last_balance_raw")
        prev_at = entry.get("last_snapshot_at")

        # Holding points based on previous balance over elapsed time
        if prev_raw is not None and prev_at:
            try:
                prev_dt = datetime.fromisoformat(prev_at)
                if prev_dt.tzinfo is None:
                    prev_dt = prev_dt.replace(tzinfo=timezone.utc)
                hours = max(0.0, (now - prev_dt).total_seconds() / 3600.0)
            except Exception:
                hours = 0.0
            if hours > 0 and HOLD_BITE_PER_POINT_PER_HOUR > 0:
                prev_bite = int(prev_raw) / 10**18
                hold = (prev_bite / HOLD_BITE_PER_POINT_PER_HOUR) * hours
                if hold > 0:
                    entry["hold_points"] = float(entry.get("hold_points") or 0) + hold
                    entry["points"] = float(entry.get("points") or 0) + hold

            # Accumulation: positive whole-$BITE delta since last snapshot
            delta_bite = (bal - int(prev_raw)) / 10**18
            if delta_bite >= 1 and POINTS_PER_BITE_GAINED > 0:
                gained = int(delta_bite) * POINTS_PER_BITE_GAINED
                entry["accum_points"] = float(entry.get("accum_points") or 0) + gained
                entry["points"] = float(entry.get("points") or 0) + gained

        entry["last_balance_raw"] = bal
        entry["last_snapshot_at"] = now.isoformat()
        entry["wallet"] = wallet

    write_public_leaderboard(state)
    return state


def leaderboard_rows(
    state: dict, limit: int | None = None
) -> list[tuple[str, float, int, bool, bool]]:
    """Return (wallet, points, trade_count, ineligible, is_dev) sorted for display.

    Eligible wallets first (by points), then ineligible/dev. Winning ranks ignore
    ineligible rows.

    limit=None → LEADERBOARD_TOP_N; limit<=0 → all rows.
    """
    ensure_dev_wallets(state)
    rows = []
    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict):
            continue
        pts = float(entry.get("points") or 0)
        trades = int(entry.get("trade_count") or 0)
        is_dev = is_dev_wallet(wallet_l, entry)
        ineligible = is_ineligible_wallet(wallet_l, entry)
        if pts <= 0 and trades <= 0 and not is_dev:
            continue
        display = entry.get("wallet") or wallet_l
        rows.append((display, pts, trades, ineligible, is_dev))
    rows.sort(key=lambda r: (1 if r[3] else 0, -r[1], -r[2]))
    if limit is None:
        return rows[:LEADERBOARD_TOP_N]
    if limit <= 0:
        return rows
    return rows[:limit]


def fetch_transfer_logs(contract, from_block: int, to_block: int) -> list:
    if from_block > to_block:
        return []
    try:
        return list(
            contract.events.Transfer.get_logs(
                from_block=from_block,
                to_block=to_block,
            )
        )
    except TypeError:
        try:
            return list(
                contract.events.Transfer.get_logs(
                    fromBlock=from_block,
                    toBlock=to_block,
                )
            )
        except Exception as e:
            print(f"Error fetching events {from_block}-{to_block}: {e}")
            return []
    except Exception as e:
        print(f"Error fetching events {from_block}-{to_block}: {e}")
        return []


def apply_trade_events(state: dict, events, tracked: set[str]) -> int:
    """Increment trade_count for inbound transfers to tracked wallets. Returns hits."""
    hits = 0
    dead = DEAD_ADDRESS.lower()
    zero = ZERO_ADDRESS.lower()
    for event in events:
        to_addr = event.args["to"]
        from_addr = event.args["from"]
        value = int(event.args["value"])
        to_l = to_addr.lower()
        from_l = from_addr.lower()
        if (
            to_l in tracked
            and from_l != zero
            and to_l != dead
            and value > 0
        ):
            entry = points_entry(state, to_addr)
            entry["trade_count"] = int(entry.get("trade_count") or 0) + 1
            entry["wallet"] = entry.get("wallet") or (
                Web3.to_checksum_address(to_addr) if Web3 else to_addr
            )
            hits += 1
    return hits


def backfill_trades(w3, contract, state: dict, *, force: bool = False) -> dict:
    """
    Recount inbound trades for tracked wallets from TRADE_SCAN_FROM_BLOCK → tip.
    Runs when trades_backfilled_from != TRADE_SCAN_FROM_BLOCK (or force=True).
    """
    ensure_dev_wallets(state)
    if not w3 or not contract:
        return state
    already = int(state.get("trades_backfilled_from") or 0)
    if not force and already == TRADE_SCAN_FROM_BLOCK:
        return state

    tracked = tracked_wallet_set(state)
    if not tracked:
        state["trades_backfilled_from"] = TRADE_SCAN_FROM_BLOCK
        write_public_leaderboard(state)
        save_state(state)
        return state

    # Reset trade counts before full recount from launch
    for wallet_l, entry in (state.get("points") or {}).items():
        if isinstance(entry, dict) and wallet_l in tracked:
            entry["trade_count"] = 0

    tip = int(w3.eth.block_number)
    start = max(0, TRADE_SCAN_FROM_BLOCK)
    print(
        f"[backfill] recounting trades from block {start} → {tip} "
        f"for {len(tracked)} wallet(s)"
    )
    total_events = 0
    total_hits = 0
    b = start
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= tip:
        end = min(b + chunk - 1, tip)
        events = fetch_transfer_logs(contract, b, end)
        if not events and chunk > 500 and end - b > 500:
            # RPC range too large — shrink and retry
            chunk = max(500, chunk // 2)
            continue
        total_events += len(events)
        total_hits += apply_trade_events(state, events, tracked)
        # Also collect holders
        known = set(a.lower() for a in (state.get("known_holders") or []))
        for event in events:
            to_l = event.args["to"].lower()
            if to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower()):
                known.add(to_l)
        state["known_holders"] = list(known)
        state["holder_count"] = max(len(known), int(state.get("holder_count") or 0))
        b = end + 1

    state["trades_backfilled_from"] = TRADE_SCAN_FROM_BLOCK
    state["trade_from_block"] = TRADE_SCAN_FROM_BLOCK
    # Keep last_block at tip so poll continues forward (don't re-scan for burns spam)
    state["last_block"] = tip
    write_public_leaderboard(state)
    save_state(state)
    print(
        f"[backfill] done: {total_events} transfers scanned, "
        f"{total_hits} trade hits for tracked wallets"
    )
    return state


def parse_command(text: str) -> tuple[str | None, str]:
    """Return (command_name, arg_tail). command_name is lowercased without leading /."""
    raw = (text or "").strip()
    if not raw:
        return None, ""
    # Strip bot mention: /balance@MyBot
    first, _, rest = raw.partition(" ")
    first = first.strip()
    rest = rest.strip()
    if first.startswith("/"):
        cmd = first[1:].split("@", 1)[0].lower()
        return cmd, rest

    lower = raw.lower()
    natural = {
        "check balance": "balance",
        "check points": "points",
        "check leaderboard": "leaderboard",
        "balance": "balance",
        "points": "points",
        "leaderboard": "leaderboard",
        "my balance": "balance",
        "my points": "points",
    }
    for phrase, cmd in natural.items():
        if lower == phrase or lower.startswith(phrase + " "):
            arg = raw[len(phrase) :].strip()
            return cmd, arg
    if lower.startswith("link "):
        return "link", raw[5:].strip()
    return None, ""


def help_copy(*, private: bool = False) -> str:
    link_line = (
        "Paste your 0x… wallet here (DM only) — or /link 0x…"
        if private
        else "DM me your 0x… wallet to link (don't paste addresses in the group)"
    )
    return (
        "🍎 $BITE commands (Act I)\n"
        f"{link_line}\n"
        "/unlink — remove your link\n"
        "/balance — your $BITE balance\n"
        "/points — your Act I points\n"
        "/leaderboard — top traders by points\n"
        "Also: check balance / check points / check leaderboard"
    )


def is_private_chat(chat: dict | None) -> bool:
    return (chat or {}).get("type") == "private"


def handle_command(
    cmd: str,
    arg: str,
    *,
    tg_user_id,
    username: str | None,
    contract,
    state: dict,
    private: bool = True,
) -> str:
    cmd = (cmd or "").lower()
    aliases = {
        "bal": "balance",
        "pts": "points",
        "point": "points",
        "lb": "leaderboard",
        "board": "leaderboard",
        "start": "help",
        "help": "help",
        "commands": "help",
    }
    cmd = aliases.get(cmd, cmd)
    who = f"@{username}" if username else "you"

    if cmd == "help":
        return help_copy(private=private)

    if cmd == "link":
        if not private:
            return (
                "🔒 Link privately — DM me your wallet address (just paste 0x…).\n"
                "Don't paste addresses in the group. Then use /points here to show your score."
            )
        addr = normalize_address(arg)
        if not addr:
            return (
                "Paste your wallet address (0x…, 40 hex chars) in this DM to link.\n"
                "Or send `/link 0xYourWallet`."
            )
        # Unlink this wallet from other Telegram users (one owner).
        links = state.setdefault("wallet_links", {})
        for uid, w in list(links.items()):
            if w and w.lower() == addr.lower() and uid != str(tg_user_id):
                del links[uid]
        links[str(tg_user_id)] = addr
        entry = points_entry(state, addr)
        entry["tg_user_id"] = str(tg_user_id)
        entry["wallet"] = addr
        # Seed snapshot without awarding (no phantom accum on first link)
        bal = read_balance_raw(contract, addr) if contract else None
        if bal is not None:
            entry["last_balance_raw"] = bal
            entry["last_snapshot_at"] = datetime.now(timezone.utc).isoformat()
        save_state(state)
        write_public_leaderboard(state)
        bal_txt = fmt_amount(bal) if bal is not None else "—"
        return (
            f"🔗 Linked {short_addr(addr)} privately for {who}.\n"
            f"Balance now: {bal_txt} $BITE.\n"
            f"Act I points accrue from accumulation + holding.\n"
            f"In the group, use /points or /leaderboard — no need to paste 0x again."
        )

    if cmd == "unlink":
        links = state.setdefault("wallet_links", {})
        removed = links.pop(str(tg_user_id), None)
        save_state(state)
        write_public_leaderboard(state)
        if removed:
            return f"Unlinked {short_addr(removed)}. Points stay on the wallet."
        return "No wallet linked. DM me your 0x… address to link."

    wallet = linked_wallet(state, tg_user_id)
    if cmd in ("balance", "points") and not wallet:
        # One-shot address arg only in private DMs (avoid public 0x paste)
        maybe = normalize_address(arg) if private else None
        if maybe:
            wallet = maybe
        else:
            hint = (
                "Paste your 0x… wallet in this DM to link first."
                if private
                else "DM me your 0x… wallet to link, then /points here."
            )
            return f"No wallet linked yet. {hint}"

    if cmd == "balance":
        bal = read_balance_raw(contract, wallet) if contract else None
        if bal is None:
            return f"Could not read balance for {short_addr(wallet)}. RPC may be down."
        return f"🍎 {short_addr(wallet)} holds {fmt_amount(bal)} $BITE."

    if cmd == "points":
        entry = points_entry(state, wallet)
        pts = float(entry.get("points") or 0)
        accum = float(entry.get("accum_points") or 0)
        hold = float(entry.get("hold_points") or 0)
        trades = int(entry.get("trade_count") or 0)
        rows = leaderboard_rows(state, limit=0)
        eligible_rank = 0
        rank = None
        ineligible = is_ineligible_wallet(wallet, entry)
        for w, _, _, row_inelig, _ in rows:
            if not row_inelig:
                eligible_rank += 1
            if w.lower() == wallet.lower():
                rank = None if row_inelig else eligible_rank
                break
        if ineligible:
            rank_txt = " · ineligible (dev)" if is_dev_wallet(wallet, entry) else " · ineligible"
        elif rank:
            rank_txt = f" · rank #{rank}"
        else:
            rank_txt = ""
        return (
            f"🏆 {who}: {fmt_points(pts)} pts{rank_txt}\n"
            f"(accum {fmt_points(accum)} · hold {fmt_points(hold)} · {trades} trades)\n"
            f"Wallet {short_addr(wallet)}"
        )

    if cmd == "leaderboard":
        rows = leaderboard_rows(state)
        if not rows:
            return (
                "Leaderboard is empty. DM me your 0x… to link, then accumulate $BITE."
            )
        lines = ["🍎 Act I leaderboard (points · trades)"]
        my_wallet = linked_wallet(state, tg_user_id)
        my_shown = False
        eligible_rank = 0
        for w, pts, trades, ineligible, is_dev in rows:
            mark = ""
            if my_wallet and w.lower() == my_wallet.lower():
                mark = " ← you"
                my_shown = True
            if ineligible:
                label = "Dev · ineligible" if is_dev else "ineligible"
                lines.append(
                    f"—. {short_addr(w)} — {fmt_points(pts)} pts · {trades} trades "
                    f"({label}){mark}"
                )
            else:
                eligible_rank += 1
                lines.append(
                    f"{eligible_rank}. {short_addr(w)} — {fmt_points(pts)} pts · "
                    f"{trades} trades{mark}"
                )
        if my_wallet and not my_shown:
            entry = points_entry(state, my_wallet)
            pts = float(entry.get("points") or 0)
            trades = int(entry.get("trade_count") or 0)
            all_rows = leaderboard_rows(state, limit=0)
            eligible_rank = 0
            rank = None
            for w, _, _, row_inelig, _ in all_rows:
                if not row_inelig:
                    eligible_rank += 1
                if w.lower() == my_wallet.lower():
                    rank = None if row_inelig else eligible_rank
                    break
            if is_ineligible_wallet(my_wallet, entry):
                rank_txt = "ineligible"
            else:
                rank_txt = f"#{rank}" if rank else "—"
            lines.append(
                f"\nYou ({short_addr(my_wallet)}): {fmt_points(pts)} pts · "
                f"{trades} trades · rank {rank_txt}"
            )
        elif not my_wallet:
            lines.append("\nDM me your 0x… to link and track your score.")
        lines.append(f"\n{SITE_URL}/leaderboard")
        return "\n".join(lines)

    return help_copy(private=private)


def process_telegram_commands(
    token,
    contract,
    state: dict,
    *,
    dry_run: bool = False,
) -> dict:
    """Poll getUpdates and reply to /balance /points /leaderboard /link (and aliases)."""
    if not token or dry_run:
        return state
    offset = int(state.get("tg_update_offset") or 0)
    # First time enabling commands: drain backlog without answering (avoid spam).
    if not state.get("tg_commands_primed"):
        pending = tg_get_updates(token, offset + 1 if offset else 0, timeout=0)
        if pending:
            state["tg_update_offset"] = max(int(u.get("update_id") or 0) for u in pending)
        state["tg_commands_primed"] = True
        save_state(state)
        print(f"[TG] primed commands; skipped {len(pending)} backlog update(s)")
        return state

    updates = tg_get_updates(token, offset + 1 if offset else 0, timeout=0)
    if not updates:
        return state

    for upd in updates:
        upd_id = int(upd.get("update_id") or 0)
        state["tg_update_offset"] = max(int(state.get("tg_update_offset") or 0), upd_id)
        msg = upd.get("message") or {}
        text = msg.get("text") or ""
        chat = msg.get("chat") or {}
        chat_id = chat.get("id")
        user = msg.get("from") or {}
        tg_user_id = user.get("id")
        username = user.get("username")
        msg_id = msg.get("message_id")
        private = is_private_chat(chat)
        if chat_id is None or tg_user_id is None or not text:
            continue

        cmd, arg = parse_command(text)
        # Bare 0x… → link only in private DMs (ignore/redirect in public)
        if not cmd:
            if ADDR_RE.fullmatch(text.strip()):
                if private:
                    cmd, arg = "link", text.strip()
                else:
                    tg_send(
                        token,
                        chat_id,
                        "🔒 DM me that address privately to link — don't paste 0x in the group.\n"
                        "Then /points here shows your score.",
                        reply_to_message_id=msg_id,
                    )
                    continue
        if not cmd:
            continue

        # In groups, ignore non-command chatter that somehow parsed (safety)
        if not private and cmd == "link" and not arg:
            # /link with no arg in group → point to DM
            reply = (
                "🔒 To link: open a DM with me and paste your 0x… wallet.\n"
                "Then use /points or /leaderboard here."
            )
            tg_send(token, chat_id, reply, reply_to_message_id=msg_id)
            continue

        reply = handle_command(
            cmd,
            arg,
            tg_user_id=tg_user_id,
            username=username,
            contract=contract,
            state=state,
            private=private,
        )
        tg_send(
            token,
            chat_id,
            reply,
            reply_to_message_id=msg_id,
        )

    save_state(state)
    return state


def get_burn_pct(contract):
    try:
        total = contract.functions.totalSupply().call()
        burned = contract.functions.balanceOf(
            Web3.to_checksum_address(DEAD_ADDRESS)
        ).call()
        if total == 0:
            return 0.0, 0, 0
        pct = (burned / total) * 100
        return pct, burned, total
    except Exception as e:
        print(f"Error reading burn: {e}")
        return 0.0, 0, 0


# ── Copy ──

def swap_copy(wallet, amount, holders, phase: int) -> str:
    w = short_addr(wallet)
    a = fmt_amount(amount)
    if phase == 1:
        return f"🍎 {w} bought {a} $BITE. {holders} holders in the orchard.\n\n{SITE_URL}"
    if phase == 2:
        return f"🍎 {w} bought {a} $BITE. {holders} holders. The race is on.\n\n{SITE_URL}"
    return f"🍎 {w} bought {a} $BITE. The orchard grows.\n\n{SITE_URL}"


def burn_tap_copy(wallet, amount, pct, time_left: str = "—") -> str:
    w = short_addr(wallet)
    a = fmt_amount(amount)
    return f"🔥 {w} burned {a} $BITE. {pct:.1f}% to the core. {time_left} left.\n\n{SITE_URL}"


def burn_large_copy(wallet, amount, pct) -> str:
    w = short_addr(wallet)
    a = fmt_amount(amount)
    return f"🔥🔥 {w} BURNED {a} $BITE. {pct:.1f}% — the core is close.\n\n{SITE_URL}"


def holder_milestone_copy(count: int, phase: int) -> str:
    if phase == 1:
        return f"🌱 {count} holders. The orchard grows.\n\n{SITE_URL}"
    return f"🍎 {count} holders in the orchard. The race continues.\n\n{SITE_URL}"


def burn_milestone_copy(pct: int) -> str:
    messages = {
        1: "The first percent. It begins.",
        5: "Five percent eaten.",
        10: "The skin is breaking. 🔥",
        15: "Fifteen percent gone.",
        20: "A fifth of the supply, eaten.",
        25: "Quarter eaten. The core is showing. 🍎",
        30: "Thirty percent. Past the point of no return.",
        35: "More than a third, gone.",
        40: "Almost there. Ten percent to go. 🔥",
        45: "Forty-five percent. Five to go.",
        49: "One percent. The whole orchard is watching. 🍎🔥",
        50: "🔥 CORE REACHED. The eaters win.",
    }
    msg = messages.get(pct, f"{pct}% eaten.")
    return f"🍎 {msg}\n\n{SITE_URL}"


def act_i_ready_copy() -> str:
    return (
        f"🍎 $BITE bot is live (Act I). Watching the orchard on Robinhood Chain.\n"
        f"DM me your 0x… wallet to link (private). Then /points · /leaderboard here.\n"
        f"Burn posts unlock in Act II when the kitchen opens.\n\n{SITE_URL}"
    )


# ── Poll ──

def poll(w3, contract, twitter, tg_token, tg_chat, state, *, dry_run: bool = False):
    if not w3 or not contract:
        print("Chain connection not available. Skipping poll.")
        return state

    ensure_dev_wallets(state)
    current_block = w3.eth.block_number
    if state["last_block"] > 0:
        from_block = state["last_block"] + 1
    else:
        from_block = TRADE_SCAN_FROM_BLOCK
    from_block = max(from_block, TRADE_SCAN_FROM_BLOCK)

    transfer_filter: list = []
    if from_block <= current_block:
        # Chunk so catch-up after downtime does not hit RPC range limits
        b = from_block
        chunk = max(200, LOG_CHUNK_SIZE)
        while b <= current_block:
            end = min(b + chunk - 1, current_block)
            part = fetch_transfer_logs(contract, b, end)
            if not part and chunk > 500 and end - b > 500:
                chunk = max(500, chunk // 2)
                continue
            transfer_filter.extend(part)
            b = end + 1

    known = set(a.lower() for a in (state.get("known_holders") or []))
    burn_pct, total_burned, total_supply = get_burn_pct(contract)
    state["total_burned"] = total_burned
    state["total_supply"] = total_supply
    tracked = tracked_wallet_set(state)

    # Always track burn milestones in state; only post when PHASE >= 2
    for m in BURN_MILESTONES:
        if burn_pct >= m and m > state.get("last_burn_milestone", 0):
            if PHASE >= 2:
                broadcast(
                    twitter,
                    tg_token,
                    tg_chat,
                    burn_milestone_copy(m),
                    dry_run=dry_run,
                )
            else:
                print(
                    f"[PHASE {PHASE}] burn milestone {m}% reached "
                    f"({burn_pct:.2f}%) — Telegram post deferred until PHASE>=2"
                )
            state["last_burn_milestone"] = m

    apply_trade_events(state, transfer_filter, tracked)

    for event in transfer_filter:
        from_addr = event.args["from"]
        to_addr = event.args["to"]
        value = int(event.args["value"])

        to_l = to_addr.lower()
        from_l = from_addr.lower()
        is_burn = to_l == DEAD_ADDRESS.lower()
        is_mintish = from_l == ZERO_ADDRESS.lower()

        if to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower()):
            known.add(to_l)

        if is_burn:
            # Always detect; post only Act II+
            if value < MIN_BURN_RAW:
                continue
            if PHASE >= 2:
                if value / 10**18 >= 10_000:
                    msg = burn_large_copy(from_addr, value, burn_pct)
                else:
                    msg = burn_tap_copy(from_addr, value, burn_pct)
                broadcast(twitter, tg_token, tg_chat, msg, dry_run=dry_run)
            else:
                print(
                    f"[PHASE {PHASE}] burn detected {fmt_amount(value)} "
                    f"from {short_addr(from_addr)} — post deferred until PHASE>=2"
                )
            continue

        # Notable inbound transfers (rough buy proxy). Default off in Act I.
        if (
            POST_ACTIVITY
            and not is_mintish
            and value >= MIN_SWAP_RAW
            and to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower())
        ):
            holders = max(len(known), int(state.get("holder_count") or 0))
            msg = swap_copy(to_addr, value, holders, PHASE)
            broadcast(twitter, tg_token, tg_chat, msg, dry_run=dry_run)

    holder_count = max(len(known), int(state.get("holder_count") or 0))
    state["holder_count"] = holder_count
    state["known_holders"] = list(known)

    for m in HOLDER_MILESTONES:
        if holder_count >= m and m > state.get("last_holder_milestone", 0):
            broadcast(
                twitter,
                tg_token,
                tg_chat,
                holder_milestone_copy(m, PHASE),
                dry_run=dry_run,
            )
            state["last_holder_milestone"] = m

    state["last_block"] = current_block
    state["last_poll_at"] = datetime.now(timezone.utc).isoformat()
    state["last_burn_pct"] = burn_pct
    state["trade_from_block"] = TRADE_SCAN_FROM_BLOCK

    # Act I: score linked + dev wallets from balance snapshots (accum + hold)
    if PHASE >= 1 and not dry_run:
        award_act_i_points(contract, state)
    else:
        write_public_leaderboard(state)

    save_state(state)
    print(
        f"Polled blocks {from_block}–{current_block}: "
        f"{len(transfer_filter)} transfers, ~{holder_count} holders, "
        f"{burn_pct:.2f}% burned (PHASE={PHASE})"
    )
    return state


# ── CLI ──

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="$BITE activity bot (Telegram + optional Twitter)")
    parser.add_argument("--daemon", action="store_true", help="Run continuously")
    parser.add_argument("--test", action="store_true", help="Post a test message")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print posts without sending (no Telegram/Twitter credentials needed)",
    )
    parser.add_argument("--interval", type=int, default=30, help="Poll interval seconds")
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Connect RPC, load contract, print burn %, exit (no posts)",
    )
    parser.add_argument(
        "--commands-test",
        action="store_true",
        help="Dry-run command handlers (link/balance/points/leaderboard) without Telegram",
    )
    args = parser.parse_args(argv)

    twitter = None if args.dry_run or args.smoke or args.commands_test else get_twitter()
    tg_token, tg_chat = (
        (None, None) if args.dry_run or args.smoke or args.commands_test else get_telegram()
    )
    w3, contract = get_web3()
    state = load_state()

    print(f"PHASE={PHASE}  contract={BITE_CONTRACT}  rpc={RPC_URL}  chain_id={CHAIN_ID}")
    print(
        f"TRADE_SCAN_FROM_BLOCK={TRADE_SCAN_FROM_BLOCK}  "
        f"dev_wallets={len(DEV_WALLETS)}"
    )
    if PHASE < 2:
        print(
            "Act I: burn Telegram posts deferred until PHASE>=2. "
            f"POST_ACTIVITY={POST_ACTIVITY} (holder milestones still tracked). "
            f"Points: +{POINTS_PER_BITE_GAINED}/BITE gained, "
            f"hold {HOLD_BITE_PER_POINT_PER_HOUR} BITE·h = 1 pt."
        )

    if args.commands_test:
        return run_commands_test(contract, state)

    if args.smoke:
        if not w3 or not contract:
            print("Smoke failed: no web3/contract.")
            return 1
        try:
            block = w3.eth.block_number
            pct, burned, total = get_burn_pct(contract)
            print(f"RPC ok. block={block} burn={pct:.4f}% burned={burned} supply={total}")
            return 0
        except Exception as e:
            print(f"Smoke failed: {e}")
            return 1

    ensure_dev_wallets(state)
    if not args.test and not args.dry_run:
        state = backfill_trades(w3, contract, state)

    if args.test:
        if PHASE == 1:
            msg = act_i_ready_copy()
        else:
            msg = f"🍎 $BITE bot is live. Monitoring Robinhood Chain.\n\n{SITE_URL}"
        if args.dry_run:
            broadcast(None, None, None, msg, dry_run=True)
        else:
            if not tg_token:
                print("Cannot --test without TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env")
                print("Put secrets in bots/.env or repo-root .env (see docs/bite-bot.md).")
                return 1
            broadcast(twitter, tg_token, tg_chat, msg, dry_run=False)
        print("Test message done.")
        return 0

    if args.daemon:
        print(f"$BITE bot daemon. Polling every {args.interval}s. dry_run={args.dry_run}")
        while True:
            try:
                state = process_telegram_commands(
                    tg_token, contract, state, dry_run=args.dry_run
                )
                state = poll(
                    w3, contract, twitter, tg_token, tg_chat, state, dry_run=args.dry_run
                )
            except Exception as e:
                print(f"Poll error: {e}")
            time.sleep(args.interval)
    else:
        state = process_telegram_commands(
            tg_token, contract, state, dry_run=args.dry_run
        )
        state = poll(w3, contract, twitter, tg_token, tg_chat, state, dry_run=args.dry_run)
    return 0


def run_commands_test(contract, state: dict) -> int:
    """Local smoke test for command parsing / replies (no Telegram sends)."""
    fake_uid = 999001
    before_points = json.loads(json.dumps(state.get("points") or {}))
    before_links = json.loads(json.dumps(state.get("wallet_links") or {}))

    # Prefer a known holder with balance so /balance + scoring demo are meaningful
    sample = BITE_CONTRACT
    for h in (state.get("known_holders") or [])[:40]:
        bal = read_balance_raw(contract, h) if contract else None
        if bal and bal >= 10**18:
            sample = Web3.to_checksum_address(h) if Web3 else h
            break

    cases = [
        ("help", ""),
        ("link", sample),
        ("balance", ""),
        ("points", ""),
        ("leaderboard", ""),
        ("bal", ""),
        ("check balance", ""),
    ]
    print("--- commands-test ---")
    for cmd, arg in cases:
        if cmd == "check balance":
            parsed_cmd, parsed_arg = parse_command("check balance")
            reply = handle_command(
                parsed_cmd or cmd,
                parsed_arg,
                tg_user_id=fake_uid,
                username="tester",
                contract=contract,
                state=state,
                private=True,
            )
        else:
            reply = handle_command(
                cmd,
                arg,
                tg_user_id=fake_uid,
                username="tester",
                contract=contract,
                state=state,
                private=True,
            )
        print(f"\n> /{cmd} {arg}".rstrip())
        print(reply)

    # Public group must not bind from /link
    print("\n> /link (public group — should refuse)")
    print(
        handle_command(
            "link",
            sample,
            tg_user_id=fake_uid + 1,
            username="groupie",
            contract=contract,
            state=state,
            private=False,
        )
    )

    # Simulate scoring: backdate snapshot with balance-50 BITE, then re-award
    entry = points_entry(state, sample)
    cur = entry.get("last_balance_raw")
    if cur is None and contract:
        cur = read_balance_raw(contract, sample)
        entry["last_balance_raw"] = cur
    if cur is not None and int(cur) >= 50 * 10**18:
        entry["last_balance_raw"] = int(cur) - 50 * 10**18
        entry["last_snapshot_at"] = (
            datetime.now(timezone.utc) - timedelta(hours=1)
        ).isoformat()
        award_act_i_points(contract, state)
        print("\n> after simulated +50 BITE / 1h hold")
        print(
            handle_command(
                "points",
                "",
                tg_user_id=fake_uid,
                username="tester",
                contract=contract,
                state=state,
                private=True,
            )
        )
        print(
            handle_command(
                "leaderboard",
                "",
                tg_user_id=fake_uid,
                username="tester",
                contract=contract,
                state=state,
                private=True,
            )
        )
    else:
        # Synthetic demo when RPC balance is too small
        entry["points"] = 55.0
        entry["accum_points"] = 50.0
        entry["hold_points"] = 5.0
        entry["trade_count"] = 3
        entry["wallet"] = sample
        print("\n> synthetic points demo (wallet balance < 50 BITE on RPC)")
        print(
            handle_command(
                "points",
                "",
                tg_user_id=fake_uid,
                username="tester",
                contract=contract,
                state=state,
                private=True,
            )
        )
        print(
            handle_command(
                "leaderboard",
                "",
                tg_user_id=fake_uid,
                username="tester",
                contract=contract,
                state=state,
                private=True,
            )
        )

    state["points"] = before_points
    state["wallet_links"] = before_links
    (state.get("wallet_links") or {}).pop(str(fake_uid), None)
    save_state(state)
    print("\ncommands-test done (restored points/links).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
