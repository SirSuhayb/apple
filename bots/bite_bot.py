"""
$BITE — Onchain Activity Bot

Monitors the $BITE token on Robinhood Chain (4663) and posts activity
to Telegram (required) and Twitter/X (optional).

Act I (PHASE=1): burn posts are deferred. Bot still polls Transfer events,
updates burn state, may post holder milestones / notable buys, and awards
accumulation/holding points for all wallets with trade/hold activity since
TRADE_SCAN_FROM_BLOCK. Telegram /link is optional identity for /points.
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
PONS_BUY_URL = os.getenv(
    "PONS_BUY_URL",
    "https://www.ponsfamily.com/launchpad/0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9",
)
CHAIN_ID = int(os.getenv("CHAIN_ID", "4663"))
KITCHEN_CONTRACT = os.getenv(
    "KITCHEN_CONTRACT",
    "0x56fEb999D829761C787581413605bf88F5Cd81e0",
)
AAPL_TOKEN = os.getenv(
    "AAPL_TOKEN",
    "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
)

# Notable Transfer→EOA posts (rough buy proxy). Explicit opt-in only to avoid spam
# on phase transitions or daemon restarts. Set POST_ACTIVITY=1 in .env deliberately.
_post_activity_env = os.getenv("POST_ACTIVITY", "").strip().lower()
if _post_activity_env in ("1", "true", "yes", "on"):
    POST_ACTIVITY = True
else:
    POST_ACTIVITY = False

MIN_SWAP_RAW = int(float(os.getenv("MIN_SWAP_AMOUNT", "500000")) * 10**18)
MIN_SWAP_USD = float(os.getenv("MIN_SWAP_USD", "50"))
MIN_BURN_RAW = int(float(os.getenv("MIN_BURN_AMOUNT", "500000")) * 10**18)
MIN_BURN_USD = float(os.getenv("MIN_BURN_USD", "50"))

# Rate limiting: minimum seconds between Telegram posts (buy/burn/milestone broadcasts).
TG_POST_COOLDOWN = int(os.getenv("TG_POST_COOLDOWN", "45"))
_last_tg_broadcast_at: float = 0.0
HOLDER_MILESTONES = [50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]
# 0.1% increments up to 5%, then 1% increments to 50%
BURN_MILESTONES = [
    *[round(i * 0.1, 1) for i in range(1, 51)],   # 0.1, 0.2, … 5.0
    *list(range(6, 51)),                             # 6, 7, … 50
]

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
LAUNCH_AT = datetime(2026, 9, 15, 17, 2, 35, tzinfo=timezone.utc)

# Public market sources (Blockscout Pro API + Dexscreener pair stats).
BLOCKSCOUT_TOKEN_URL = os.getenv(
    "BLOCKSCOUT_TOKEN_URL",
    f"https://robinhoodchain.blockscout.com/token/{BITE_CONTRACT}",
)
BLOCKSCOUT_API_KEY = os.getenv("BLOCKSCOUT_API_KEY", "").strip()
BLOCKSCOUT_API_BASE = os.getenv(
    "BLOCKSCOUT_API_BASE",
    f"https://api.blockscout.com/{CHAIN_ID}/api/v2",
).rstrip("/")
DEXSCREENER_PAIR_ID = os.getenv(
    "DEXSCREENER_PAIR_ID",
    "0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c",
)
DEXSCREENER_PAIR_URL = os.getenv(
    "DEXSCREENER_PAIR_URL",
    f"https://dexscreener.com/robinhood/{DEXSCREENER_PAIR_ID}",
)
DEXSCREENER_API_URL = (
    f"https://api.dexscreener.com/latest/dex/pairs/robinhood/{DEXSCREENER_PAIR_ID}"
)
EXPLORER_TOKEN_URL = f"https://robin.etherscan.io/address/{BITE_CONTRACT}"
EXPLORER_TX_BASE = "https://robin.etherscan.io/tx/"
BURN_PAGE_URL = f"{SITE_URL}/#burn"
BUY_ALERT_IMAGE = "https://www.bite.party/social_media/biteTaken.png"
CA_IMAGE = "https://www.bite.party/og_image.png"

# Creator / team wallets: visible on the board, scored, but ineligible to win.
# (Blockscout may flag the deployer as a contract — still keep it on the board.)
_DEFAULT_DEV_WALLETS = ("0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E",)

# Trade index: contract → EOA transfers (buys), not raw inbound to routers/LP.
TRADE_INDEX_MODE = "eoa_buys_v2"


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
    reply_markup: dict | None = None,
    parse_mode: str | None = None,
) -> bool:
    if dry_run:
        print(f"[TG dry-run] {text}")
        return True
    if not token or not chat_id:
        print(f"[TG skip] {text}")
        return False
    fields: dict[str, str] = {
        "chat_id": str(chat_id),
        "text": text,
        "disable_web_page_preview": "true",
    }
    if reply_to_message_id is not None:
        fields["reply_to_message_id"] = str(reply_to_message_id)
    if parse_mode:
        fields["parse_mode"] = parse_mode
    if reply_markup:
        fields["reply_markup"] = json.dumps(reply_markup)
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
        # Retry without reply_to if the original message was deleted
        if e.code == 400 and "message to be replied" in err and reply_to_message_id:
            fields.pop("reply_to_message_id", None)
            payload2 = urllib.parse.urlencode(fields).encode()
            req2 = urllib.request.Request(url, data=payload2, method="POST")
            try:
                with urllib.request.urlopen(req2, timeout=30) as resp2:
                    body2 = json.loads(resp2.read().decode())
                if body2.get("ok"):
                    print(f"[TG] (retry no-reply) {text[:80]}")
                    return True
            except Exception:
                pass
        return False
    except Exception as e:
        print(f"[TG error] {e}")
        return False


def tg_send_photo(
    token,
    chat_id,
    photo_url: str,
    caption: str = "",
    *,
    dry_run: bool = False,
    reply_to_message_id: int | None = None,
    reply_markup: dict | None = None,
    parse_mode: str | None = None,
) -> bool:
    """Send a photo (by URL) with optional caption, buttons, and formatting."""
    if dry_run:
        print(f"[TG photo dry-run] {caption}")
        return True
    if not token or not chat_id:
        print(f"[TG photo skip] {caption}")
        return False
    fields: dict[str, str] = {
        "chat_id": str(chat_id),
        "photo": photo_url,
    }
    if caption:
        fields["caption"] = caption
    if parse_mode:
        fields["parse_mode"] = parse_mode
    if reply_to_message_id is not None:
        fields["reply_to_message_id"] = str(reply_to_message_id)
    if reply_markup:
        fields["reply_markup"] = json.dumps(reply_markup)
    payload = urllib.parse.urlencode(fields).encode()
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    req = urllib.request.Request(url, data=payload, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
        if not body.get("ok"):
            print(f"[TG photo error] {body}")
            return False
        print(f"[TG photo] {caption[:80]}")
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        print(f"[TG photo HTTP {e.code}] {err}")
        if e.code == 400 and "message to be replied" in err and reply_to_message_id:
            fields.pop("reply_to_message_id", None)
            payload2 = urllib.parse.urlencode(fields).encode()
            req2 = urllib.request.Request(url, data=payload2, method="POST")
            try:
                with urllib.request.urlopen(req2, timeout=30) as resp2:
                    body2 = json.loads(resp2.read().decode())
                if body2.get("ok"):
                    print(f"[TG photo] (retry no-reply) {caption[:80]}")
                    return True
            except Exception:
                pass
        return False
    except Exception as e:
        print(f"[TG photo error] {e}")
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


def broadcast(
    twitter, token, chat_id, text: str, *, dry_run: bool = False,
    reply_markup: dict | None = None, photo_url: str | None = None,
    parse_mode: str | None = None,
) -> None:
    """Post to Twitter + Telegram with global rate limiting (TG_POST_COOLDOWN)."""
    global _last_tg_broadcast_at
    tweet(twitter, text) if not dry_run else print(f"[TWITTER dry-run] {text}")
    now = time.monotonic()
    elapsed = now - _last_tg_broadcast_at
    if elapsed < TG_POST_COOLDOWN and not dry_run:
        print(f"[TG rate-limit] skipping (cooldown {TG_POST_COOLDOWN}s, {elapsed:.0f}s elapsed): {text[:80]}…")
        return
    if photo_url:
        sent = tg_send_photo(
            token, chat_id, photo_url, text, dry_run=dry_run,
            reply_markup=reply_markup, parse_mode=parse_mode,
        )
    else:
        sent = tg_send(
            token, chat_id, text, dry_run=dry_run,
            reply_markup=reply_markup, parse_mode=parse_mode,
        )
    if sent and not dry_run:
        _last_tg_broadcast_at = now


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


def _bite_usd_value(raw_amount: int, state: dict) -> float | None:
    """Convert raw BITE amount to USD using Dexscreener priceUsd. None if unavailable."""
    try:
        price = float(
            (state.get("market") or {}).get("dexscreener", {}).get("priceUsd") or 0
        )
        if price > 0:
            return (raw_amount / 10**18) * price
    except (TypeError, ValueError):
        pass
    return None


def _meets_usd_threshold(
    raw_amount: int, state: dict, usd_min: float, bite_fallback_raw: int
) -> bool:
    """True when a BITE amount meets the USD minimum (BITE-amount fallback if no price)."""
    usd_val = _bite_usd_value(raw_amount, state)
    if usd_val is not None:
        return usd_val >= usd_min
    return raw_amount >= bite_fallback_raw


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


def _excluded_board_addrs(state: dict | None = None) -> set[str]:
    excluded = {
        ZERO_ADDRESS.lower(),
        DEAD_ADDRESS.lower(),
        BITE_CONTRACT.lower(),
    }
    if state:
        for a in state.get("contract_addrs") or []:
            if isinstance(a, str) and a.lower() not in DEV_WALLETS:
                excluded.add(a.lower())
    return excluded


def http_get_json(url: str, timeout: int = 30) -> dict | list | None:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "bite-bot/1.0 (+https://www.bite.party)",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[http] {url[:72]}… {e}")
        return None


def blockscout_get(path: str, params: dict | None = None) -> dict | list | None:
    """GET https://api.blockscout.com/{chain}/api/v2/... with apikey."""
    q = dict(params or {})
    if BLOCKSCOUT_API_KEY:
        q["apikey"] = BLOCKSCOUT_API_KEY
    path = path if path.startswith("/") else f"/{path}"
    url = f"{BLOCKSCOUT_API_BASE}{path}"
    if q:
        url = f"{url}?{urllib.parse.urlencode(q)}"
    return http_get_json(url, timeout=60)


def sync_dexscreener(state: dict) -> dict:
    """Pull pair txns/volume/liquidity from Dexscreener (public API)."""
    raw = http_get_json(DEXSCREENER_API_URL)
    pair = None
    if isinstance(raw, dict):
        pairs = raw.get("pairs") or []
        if pairs:
            pair = pairs[0]
    market = state.setdefault("market", {})
    if pair:
        market["dexscreener"] = {
            "pairUrl": pair.get("url") or DEXSCREENER_PAIR_URL,
            "pairId": pair.get("pairAddress") or DEXSCREENER_PAIR_ID,
            "txnsH24": (pair.get("txns") or {}).get("h24"),
            "volumeH24": (pair.get("volume") or {}).get("h24"),
            "liquidityUsd": (pair.get("liquidity") or {}).get("usd"),
            "liquidityBase": (pair.get("liquidity") or {}).get("base"),
            "priceUsd": pair.get("priceUsd"),
            "fdv": pair.get("fdv"),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
    else:
        market.setdefault(
            "dexscreener",
            {"pairUrl": DEXSCREENER_PAIR_URL, "pairId": DEXSCREENER_PAIR_ID},
        )
    return state


def sync_blockscout_holders(state: dict, *, contract=None) -> dict:
    """
    Sync current token holders from Blockscout Pro API.
    Seeds balances / contract flags; EOAs get hold points from launch time
    when they have no snapshot yet. Contracts stay off the board (except DEV).
    """
    market = state.setdefault("market", {})
    bs = market.setdefault("blockscout", {"tokenUrl": BLOCKSCOUT_TOKEN_URL})
    bs["apiBase"] = BLOCKSCOUT_API_BASE
    bs["tokenUrl"] = BLOCKSCOUT_TOKEN_URL

    if not BLOCKSCOUT_API_KEY:
        print("[blockscout] BLOCKSCOUT_API_KEY unset — skip holders sync")
        return state

    counters = blockscout_get(f"/tokens/{BITE_CONTRACT}/counters")
    if isinstance(counters, dict):
        bs["transfersCount"] = counters.get("transfers_count")
        bs["holdersCount"] = counters.get("token_holders_count")
        try:
            state["holder_count"] = max(
                int(state.get("holder_count") or 0),
                int(counters.get("token_holders_count") or 0),
            )
        except Exception:
            pass

    holders: list[dict] = []
    params: dict = {"items_count": 50}
    pages = 0
    while pages < 40:
        pages += 1
        data = blockscout_get(f"/tokens/{BITE_CONTRACT}/holders", params)
        if not isinstance(data, dict):
            break
        items = data.get("items") or []
        if not items:
            break
        for it in items:
            addr_obj = it.get("address") or {}
            if isinstance(addr_obj, str):
                addr = addr_obj
                is_contract = False
            else:
                addr = addr_obj.get("hash") or ""
                is_contract = bool(addr_obj.get("is_contract"))
            if not isinstance(addr, str) or not ADDR_RE.match(addr):
                continue
            holders.append(
                {
                    "address": addr.lower(),
                    "value": str(it.get("value") or "0"),
                    "is_contract": is_contract,
                }
            )
        nxt = data.get("next_page_params")
        if not nxt or not isinstance(nxt, dict):
            break
        params = {**nxt}
        # keep page size hint
        params.setdefault("items_count", 50)

    if not holders:
        print("[blockscout] holders sync returned 0 rows")
        bs["updatedAt"] = datetime.now(timezone.utc).isoformat()
        return state

    contracts = {a.lower() for a in (state.get("contract_addrs") or []) if isinstance(a, str)}
    eoas = {a.lower() for a in (state.get("eoa_addrs") or []) if isinstance(a, str)}
    known = set()
    now = datetime.now(timezone.utc)
    hours = max(0.0, (now - LAUNCH_AT).total_seconds() / 3600.0)

    for h in holders:
        addr = h["address"]
        is_contract = bool(h["is_contract"])
        if is_contract and addr not in DEV_WALLETS:
            contracts.add(addr)
            continue
        if is_contract and addr in DEV_WALLETS:
            contracts.add(addr)  # still flagged, but board-eligible via DEV
        else:
            eoas.add(addr)
            contracts.discard(addr)
        known.add(addr)
        try:
            bal = int(h["value"])
        except Exception:
            bal = 0
        entry = points_entry(state, addr)
        display = Web3.to_checksum_address(addr) if Web3 else addr
        entry["wallet"] = display
        prev = entry.get("last_balance_raw")
        entry["last_balance_raw"] = bal
        entry["last_snapshot_at"] = now.isoformat()
        # Seed hold points once from launch→now when never scored (or zeroed)
        if (prev is None or float(entry.get("hold_points") or 0) <= 0) and bal > 0:
            if HOLD_BITE_PER_POINT_PER_HOUR > 0:
                hold = (bal / 10**18 / HOLD_BITE_PER_POINT_PER_HOUR) * hours
                accum = float(entry.get("accum_points") or 0)
                entry["hold_points"] = hold
                entry["points"] = accum + hold
        if addr in DEV_WALLETS:
            entry["dev"] = True
            entry["ineligible"] = True

    state["contract_addrs"] = sorted(contracts)
    state["eoa_addrs"] = sorted(eoas)
    state["known_holders"] = sorted(known)
    eoa_holders = [h for h in holders if not h["is_contract"] or h["address"] in DEV_WALLETS]
    bs["holdersEoa"] = len([h for h in holders if not h["is_contract"]])
    bs["holdersTotal"] = len(holders)
    bs["synced"] = len(holders)
    bs["updatedAt"] = now.isoformat()
    print(
        f"[blockscout] holders synced: {len(holders)} total, "
        f"{bs['holdersEoa']} EOA (API holders_count={bs.get('holdersCount')})"
    )
    return state


def sync_market_sources(state: dict, *, contract=None) -> dict:
    """Refresh Dexscreener + Blockscout Pro market/holders data."""
    sync_dexscreener(state)
    sync_blockscout_holders(state, contract=contract)
    return state


def sync_supply_stats(state: dict, w3=None, contract=None) -> dict:
    """Calculate and store supply breakdown: prize pool, EOA/contract held, realistically burnable."""
    stats = state.setdefault("supply_stats", {})

    # Prize pool: AAPL balance of kitchen contract
    prize_pool_raw = 0
    if w3 and Web3 and KITCHEN_CONTRACT and AAPL_TOKEN:
        try:
            aapl_contract = w3.eth.contract(
                address=Web3.to_checksum_address(AAPL_TOKEN), abi=ERC20_ABI
            )
            prize_pool_raw = int(
                aapl_contract.functions.balanceOf(
                    Web3.to_checksum_address(KITCHEN_CONTRACT)
                ).call()
            )
        except Exception as e:
            print(f"[supply_stats] AAPL balanceOf(kitchen) error: {e}")

    stats["prize_pool_aapl_raw"] = prize_pool_raw
    stats["prize_pool_aapl"] = prize_pool_raw / 10**18

    # AAPL USD price from Dexscreener (BITE is priced in AAPL — quoteToken price)
    aapl_price_usd = None
    try:
        dex = (state.get("market") or {}).get("dexscreener") or {}
        bite_price = float(dex.get("priceUsd") or 0)
        # priceNative is BITE price in AAPL; priceUsd / priceNative = AAPL price in USD
        # But Dexscreener may not expose priceNative in our stored data. Approximate:
        # fdv = priceUsd * totalSupply_BITE; quoteToken price ≈ priceUsd / priceNative
        # Since we store priceUsd for BITE, and AAPL is the quote token,
        # we need the AAPL/USD rate. Fetch from Dexscreener pair raw if available.
    except Exception:
        pass

    # Fetch AAPL/USD from Dexscreener pair data (quoteToken.symbol == "AAPL")
    try:
        raw = http_get_json(DEXSCREENER_API_URL)
        if isinstance(raw, dict):
            pairs = raw.get("pairs") or []
            if pairs:
                pair = pairs[0]
                qt = pair.get("quoteToken") or {}
                if qt.get("symbol") == "AAPL":
                    # AAPL USD = priceUsd_BITE / priceNative_BITE
                    price_native = float(pair.get("priceNative") or 0)
                    price_usd = float(pair.get("priceUsd") or 0)
                    if price_native > 0 and price_usd > 0:
                        aapl_price_usd = price_usd / price_native
    except Exception as e:
        print(f"[supply_stats] AAPL price calc error: {e}")

    stats["aapl_price_usd"] = aapl_price_usd
    if aapl_price_usd and prize_pool_raw > 0:
        stats["prize_pool_usd"] = (prize_pool_raw / 10**18) * aapl_price_usd
    else:
        stats["prize_pool_usd"] = None

    # Supply breakdown from Blockscout holder data
    total_supply = int(state.get("total_supply") or 0)
    total_burned = int(state.get("total_burned") or 0)

    # Sum EOA balances from Blockscout holders (synced in sync_blockscout_holders)
    eoa_held = 0
    contract_held = 0
    bs_holders = (state.get("market") or {}).get("blockscout") or {}
    # Use points state which has last_balance_raw for each wallet
    eoa_addrs = set(a.lower() for a in (state.get("eoa_addrs") or []))
    contract_addrs = set(a.lower() for a in (state.get("contract_addrs") or []))
    excluded = {ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower(), BITE_CONTRACT.lower()}

    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict):
            continue
        bal = int(entry.get("last_balance_raw") or 0)
        if bal <= 0:
            continue
        key = wallet_l.lower()
        if key in excluded:
            continue
        if key in contract_addrs and key not in DEV_WALLETS:
            contract_held += bal
        else:
            eoa_held += bal

    # Anything not accounted for in points entries (LP, kitchen, etc.)
    accounted = eoa_held + contract_held + total_burned
    unaccounted = max(0, total_supply - accounted)
    contract_held += unaccounted

    stats["eoa_held_bite_raw"] = eoa_held
    stats["eoa_held_bite"] = eoa_held / 10**18
    stats["contract_held_bite_raw"] = contract_held
    stats["contract_held_bite"] = contract_held / 10**18
    stats["realistically_burnable_raw"] = eoa_held
    stats["realistically_burnable"] = eoa_held / 10**18
    stats["total_supply"] = total_supply / 10**18
    stats["total_burned"] = total_burned / 10**18
    stats["holder_count"] = int(state.get("holder_count") or 0)
    stats["updated_at"] = datetime.now(timezone.utc).isoformat()

    # BITE price for display
    try:
        stats["bite_price_usd"] = float(
            (state.get("market") or {}).get("dexscreener", {}).get("priceUsd") or 0
        ) or None
    except (TypeError, ValueError):
        stats["bite_price_usd"] = None

    state["supply_stats"] = stats
    print(
        f"[supply_stats] prize={stats['prize_pool_aapl']:.4f} AAPL"
        f" (${stats.get('prize_pool_usd') or 0:.2f})"
        f" | EOA={fmt_amount(eoa_held)} | contract={fmt_amount(contract_held)}"
        f" | burnable={fmt_amount(eoa_held)}"
    )
    return state


def classify_contracts(w3, addresses: set[str], state: dict) -> set[str]:
    """Cache eth_getCode results; contracts are excluded from the Act I board."""
    cached = {a.lower() for a in (state.get("contract_addrs") or []) if isinstance(a, str)}
    known_eoa = {
        a.lower()
        for a in (state.get("eoa_addrs") or [])
        if isinstance(a, str)
    }
    contracts = set(cached)
    eoas = set(known_eoa)
    for addr in addresses:
        a = addr.lower()
        if a in contracts or a in eoas or a in DEV_WALLETS:
            continue
        if not w3 or not Web3:
            continue
        try:
            code = w3.eth.get_code(Web3.to_checksum_address(a))
            if code and len(code) > 0:
                contracts.add(a)
            else:
                eoas.add(a)
        except Exception as e:
            print(f"get_code error {short_addr(a)}: {e}")
            eoas.add(a)
    state["contract_addrs"] = sorted(contracts)
    state["eoa_addrs"] = sorted(eoas)
    return contracts


def activity_wallet_set(state: dict) -> set[str]:
    """
    Wallets that earn trades/points and can appear on the Act I board:
    Telegram-linked, configured dev, known Transfer recipients, and anyone
    already in points. Contracts (LP/routers) are excluded — /link is identity
    only, not a gate to the board.
    """
    excluded = _excluded_board_addrs(state)
    wallets: set[str] = set()
    wallets |= linked_wallet_set(state)
    wallets |= set(DEV_WALLETS)
    for h in state.get("known_holders") or []:
        if isinstance(h, str) and h:
            wallets.add(h.lower())
    for key, entry in (state.get("points") or {}).items():
        if isinstance(key, str) and key:
            wallets.add(key.lower())
        if isinstance(entry, dict):
            w = entry.get("wallet")
            if isinstance(w, str) and w:
                wallets.add(w.lower())
    wallets -= excluded
    return wallets


def tracked_wallet_set(state: dict) -> set[str]:
    """Wallets that earn trade counts / appear on the board (all activity)."""
    return activity_wallet_set(state)


def public_leaderboard_payload(state: dict, *, limit: int | None = None) -> dict:
    """Sanitized rows for the site — wallets, points, trades only (no TG ids)."""
    ensure_dev_wallets(state)
    # Market blob is refreshed in poll/sync_market_sources; keep payload current.
    if not (state.get("market") or {}).get("dexscreener"):
        sync_dexscreener(state)
    limit = LEADERBOARD_TOP_N if limit is None else limit
    excluded = _excluded_board_addrs(state)
    rows = []
    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict):
            continue
        key = wallet_l.lower()
        if key in excluded and key not in DEV_WALLETS:
            continue
        pts = float(entry.get("points") or 0)
        trades = int(entry.get("trade_count") or 0)
        bal = int(entry.get("last_balance_raw") or 0)
        is_dev = is_dev_wallet(wallet_l, entry)
        ineligible = is_ineligible_wallet(wallet_l, entry)
        # Prefer current holders; still keep traders / dev visible
        if pts <= 0 and trades <= 0 and bal <= 0 and not is_dev:
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
    if limit:
        kept = rows[:limit]
        kept_addrs = {str(r["address"]).lower() for r in kept}
        # Always surface configured DEV wallets even when the top-N is full
        for row in rows[limit:]:
            addr = str(row["address"]).lower()
            if addr in DEV_WALLETS and addr not in kept_addrs:
                kept.append(row)
                kept_addrs.add(addr)
        rows = kept
    market = state.get("market") or {}
    supply_stats = state.get("supply_stats") or {}
    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "phase": PHASE,
        "scoring": "act1",
        "tradeFromBlock": TRADE_SCAN_FROM_BLOCK,
        "sources": {
            "blockscout": BLOCKSCOUT_TOKEN_URL,
            "dexscreener": DEXSCREENER_PAIR_URL,
        },
        "market": market,
        "supplyStats": {
            "prizePoolAapl": supply_stats.get("prize_pool_aapl") or 0,
            "prizePoolUsd": supply_stats.get("prize_pool_usd"),
            "aaplPriceUsd": supply_stats.get("aapl_price_usd"),
            "eoaHeldBite": supply_stats.get("eoa_held_bite") or 0,
            "contractHeldBite": supply_stats.get("contract_held_bite") or 0,
            "realisticallyBurnable": supply_stats.get("realistically_burnable") or 0,
            "totalSupply": supply_stats.get("total_supply") or 0,
            "totalBurned": supply_stats.get("total_burned") or 0,
            "holderCount": supply_stats.get("holder_count") or 0,
            "bitePriceUsd": supply_stats.get("bite_price_usd"),
            "updatedAt": supply_stats.get("updated_at"),
        },
        "eaters": rows,
    }


def write_public_leaderboard(state: dict) -> None:
    # Site board: keep a wide slice so unlinked accumulators are visible
    payload = public_leaderboard_payload(state, limit=max(LEADERBOARD_TOP_N, 500))
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
    Act I scoring for all activity wallets (trades/holders since launch):
      - Accumulation: +POINTS_PER_BITE_GAINED per whole $BITE balance increase
      - Holding: +1 pt per HOLD_BITE_PER_POINT_PER_HOUR $BITE held per hour
        (pro-rated by time since last snapshot)
    Decreases do not claw back points. Kitchen/burns are ignored in Act I.
    Dev wallets score visibly but stay ineligible to win.
    Telegram /link attaches identity for /points; it is not required to score.
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

    # Include every activity wallet (known holders / prior trade index)
    for wallet_l in activity_wallet_set(state):
        if wallet_l in wallets:
            continue
        display = Web3.to_checksum_address(wallet_l) if Web3 else wallet_l
        wallets[wallet_l] = display

    if not wallets:
        write_public_leaderboard(state)
        return state

    # Cap RPC load per poll; always refresh linked + dev, rotate the rest.
    score_cap = int(os.getenv("SCORE_WALLETS_PER_POLL", "120"))
    priority = linked_wallet_set(state) | set(DEV_WALLETS)
    ordered: list[tuple[str, str]] = []
    for wallet_l, wallet in wallets.items():
        if wallet_l in priority:
            ordered.append((wallet_l, wallet))
    rest = [(k, v) for k, v in wallets.items() if k not in priority]
    rest.sort(key=lambda kv: kv[0])
    cursor = int(state.get("score_cursor") or 0)
    if rest:
        cursor = cursor % len(rest)
        rotated = rest[cursor:] + rest[:cursor]
        state["score_cursor"] = (cursor + max(1, score_cap)) % len(rest)
    else:
        rotated = []
    budget = max(score_cap, len(priority))
    to_score = ordered + rotated
    to_score = to_score[:budget]

    for wallet_l, wallet in to_score:
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
    excluded = _excluded_board_addrs(state)
    rows = []
    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict):
            continue
        if wallet_l.lower() in excluded and wallet_l.lower() not in DEV_WALLETS:
            continue
        pts = float(entry.get("points") or 0)
        trades = int(entry.get("trade_count") or 0)
        bal = int(entry.get("last_balance_raw") or 0)
        is_dev = is_dev_wallet(wallet_l, entry)
        ineligible = is_ineligible_wallet(wallet_l, entry)
        if pts <= 0 and trades <= 0 and bal <= 0 and not is_dev:
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


def apply_trade_events(
    state: dict, events, tracked: set[str] | None = None, *, w3=None
) -> int:
    """Increment trade_count for EOA buys (Transfer contract → EOA).

    tracked=None → count every eligible recipient (Act I all-activity board).
    Otherwise only addresses in tracked. Returns hits.
    """
    hits = 0
    dead = DEAD_ADDRESS.lower()
    zero = ZERO_ADDRESS.lower()
    contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
    if w3 is not None:
        # Opportunistically classify event parties we haven't seen
        pending = set()
        for event in events:
            pending.add(event.args["from"].lower())
            pending.add(event.args["to"].lower())
        classify_contracts(w3, pending, state)
        contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
    excluded = _excluded_board_addrs(state)
    for event in events:
        to_addr = event.args["to"]
        from_addr = event.args["from"]
        value = int(event.args["value"])
        to_l = to_addr.lower()
        from_l = from_addr.lower()
        if to_l in excluded or from_l == zero or value <= 0:
            continue
        # Buy = tokens leaving a contract into a non-contract (EOA / dev)
        if from_l not in contracts:
            continue
        if to_l in contracts and to_l not in DEV_WALLETS:
            continue
        if tracked is not None and to_l not in tracked:
            continue
        entry = points_entry(state, to_addr)
        entry["trade_count"] = int(entry.get("trade_count") or 0) + 1
        entry["wallet"] = entry.get("wallet") or (
            Web3.to_checksum_address(to_addr) if Web3 else to_addr
        )
        hits += 1
    return hits


def backfill_trades(w3, contract, state: dict, *, force: bool = False) -> dict:
    """
    Recount EOA buys from TRADE_SCAN_FROM_BLOCK → tip.
    Runs when trades_backfilled_from / trade_index_mode are stale (or force=True).
    """
    ensure_dev_wallets(state)
    if not w3 or not contract:
        return state
    already = int(state.get("trades_backfilled_from") or 0)
    mode = state.get("trade_index_mode")
    if (
        not force
        and already == TRADE_SCAN_FROM_BLOCK
        and mode == TRADE_INDEX_MODE
    ):
        return state

    tip = int(w3.eth.block_number)
    start = max(0, TRADE_SCAN_FROM_BLOCK)
    print(
        f"[backfill] recounting EOA buys from block {start} → {tip} "
        f"(mode={TRADE_INDEX_MODE})"
    )

    # Seed contract cache from known activity, then classify
    seed = set(activity_wallet_set(state))
    for a in state.get("known_holders") or []:
        if isinstance(a, str):
            seed.add(a.lower())
    for a in (
        "0x8366a39cc670b4001a1121b8f6a443a643e40951",
        "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044",
        "0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f",
        "0x8f10b468b06c6fd214b65f87778827f7d113f996",
    ):
        seed.add(a)
    classify_contracts(w3, seed, state)

    # Reset trade counts before full recount from launch
    for _wallet_l, entry in (state.get("points") or {}).items():
        if isinstance(entry, dict):
            entry["trade_count"] = 0

    total_events = 0
    total_hits = 0
    b = start
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= tip:
        end = min(b + chunk - 1, tip)
        events = fetch_transfer_logs(contract, b, end)
        if not events and chunk > 500 and end - b > 500:
            chunk = max(500, chunk // 2)
            continue
        total_events += len(events)
        total_hits += apply_trade_events(state, events, tracked=None, w3=w3)
        known = set(a.lower() for a in (state.get("known_holders") or []))
        contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
        for event in events:
            to_l = event.args["to"].lower()
            if to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower()):
                if to_l not in contracts or to_l in DEV_WALLETS:
                    known.add(to_l)
        state["known_holders"] = list(known)
        state["holder_count"] = max(len(known), int(state.get("holder_count") or 0))
        b = end + 1

    state["trades_backfilled_from"] = TRADE_SCAN_FROM_BLOCK
    state["trade_from_block"] = TRADE_SCAN_FROM_BLOCK
    state["trade_index_mode"] = TRADE_INDEX_MODE
    state["trader_count"] = len(
        {
            k
            for k, e in (state.get("points") or {}).items()
            if isinstance(e, dict)
            and int(e.get("trade_count") or 0) > 0
            and k.lower() not in {a.lower() for a in (state.get("contract_addrs") or [])}
        }
    )
    state["last_block"] = tip
    sync_market_sources(state, contract=contract)
    write_public_leaderboard(state)
    save_state(state)
    print(
        f"[backfill] done: {total_events} transfers scanned, "
        f"{total_hits} EOA buy hits, "
        f"{state.get('trader_count')} unique traders, "
        f"{state.get('holder_count')} known holders"
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
        "check stats": "stats",
        "balance": "balance",
        "points": "points",
        "leaderboard": "leaderboard",
        "my balance": "balance",
        "my points": "points",
        "contract address": "ca",
        "ca": "ca",
        "buy": "buy",
        "how to buy": "buy",
        "where to buy": "buy",
        "burn": "burn",
        "tap": "burn",
        "stats": "stats",
        "supply": "stats",
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
        "/stats — supply breakdown + prize pool\n"
        "/burn — burn $BITE on bite.party (or /burn 1000)\n"
        "/ca — contract address + links\n"
        "/buy — how to buy $BITE\n"
        "Also: check balance / check points / check leaderboard / check stats / how to buy / burn / tap"
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
        "ca": "ca",
        "contract": "ca",
        "address": "ca",
        "buy": "buy",
        "burn": "burn",
        "tap": "burn",
        "stats": "stats",
        "supply": "stats",
        "stat": "stats",
        "info": "stats",
    }
    cmd = aliases.get(cmd, cmd)
    who = f"@{username}" if username else "you"

    if cmd == "help":
        return help_copy(private=private)

    if cmd == "burn":
        burn_pct = float(state.get("last_burn_pct") or 0)
        total_supply = int(state.get("total_supply") or 0)
        total_burned = int(state.get("total_burned") or 0)
        if total_supply > 0 and burn_pct <= 0:
            burn_pct = (total_burned / total_supply) * 100
        burn_line = f"Current burn: {burn_pct:.1f}% | Target: 50%"

        # Build deep link with optional pre-filled amount
        amount_str = arg.strip().replace(",", "")
        burn_url = f"{SITE_URL}/#burn"
        if amount_str:
            try:
                amount_val = int(float(amount_str))
                if amount_val > 0:
                    burn_url = f"{SITE_URL}/#burn?amount={amount_val}"
            except (ValueError, OverflowError):
                pass

        return {
            "text": (
                f"🔥 Burn $BITE\n"
                f"\n"
                f"Connect your wallet and burn directly on bite.party:\n"
                f"{burn_url}\n"
                f"\n"
                f"Every token burned pushes the apple closer to the core.\n"
                f"{burn_line}"
            ),
            "reply_markup": _burn_buttons(),
        }

    if cmd == "buy":
        price_line = ""
        try:
            p = float(
                (state.get("market") or {}).get("dexscreener", {}).get("priceUsd") or 0
            )
            if p > 0:
                price_line = f"💲 Current price: ${p:.6f}\n"
        except (TypeError, ValueError):
            pass
        return {
            "text": (
                f"🛒 Buy $BITE\n"
                f"\n"
                f"Buy on Pons launchpad (paired with AAPL):\n"
                f"{PONS_BUY_URL}\n"
                f"\n"
                f"Chain: Robinhood Chain ({CHAIN_ID})\n"
                f"{price_line}"
                f"\n"
                f"📊 Chart: {DEXSCREENER_PAIR_URL}\n"
                f"🍎 {SITE_URL}"
            ),
            "reply_markup": _buy_buttons(),
        }

    if cmd == "stats":
        ss = state.get("supply_stats") or {}
        ts = ss.get("total_supply") or (int(state.get("total_supply") or 0) / 10**18)
        tb = ss.get("total_burned") or (int(state.get("total_burned") or 0) / 10**18)
        burn_pct = (tb / ts * 100) if ts > 0 else 0
        eoa_held = ss.get("eoa_held_bite") or 0
        contract_held = ss.get("contract_held_bite") or 0
        realistically_burnable = ss.get("realistically_burnable") or 0
        prize_aapl = ss.get("prize_pool_aapl") or 0
        prize_usd = ss.get("prize_pool_usd")
        holders = ss.get("holder_count") or int(state.get("holder_count") or 0)
        price = ss.get("bite_price_usd")

        prize_line = f"🏆 Prize pool: {fmt_amount(int(prize_aapl * 10**18))} AAPL"
        if prize_usd:
            prize_line += f" (${prize_usd:,.2f})"

        price_line = ""
        if price and price > 0:
            price_line = f"\n💲 Price: ${price:.6f}"

        return (
            f"📊 $BITE Supply Stats\n"
            f"\n"
            f"Total supply: {fmt_amount(int(ts * 10**18))}\n"
            f"🔥 Burned: {fmt_amount(int(tb * 10**18))} ({burn_pct:.2f}%)\n"
            f"\n"
            f"👤 Held by wallets (EOA): {fmt_amount(int(eoa_held * 10**18))}\n"
            f"📦 In LP/contracts: {fmt_amount(int(contract_held * 10**18))}\n"
            f"🔥 Realistically burnable: {fmt_amount(int(realistically_burnable * 10**18))}\n"
            f"\n"
            f"{prize_line}\n"
            f"👥 Holders: {holders}"
            f"{price_line}\n"
            f"\n"
            f"📊 Chart: {DEXSCREENER_PAIR_URL}\n"
            f"🍎 {SITE_URL}"
        )

    if cmd == "ca":
        lines = [
            f"🍎 $BITE token",
            f"Chain: Robinhood Chain ({CHAIN_ID})",
            f"",
            f"`{BITE_CONTRACT}`",
        ]
        if PHASE >= 2 and KITCHEN_CONTRACT:
            lines.append(f"")
            lines.append(f"🔥 Kitchen: `{KITCHEN_CONTRACT}`")
        lines.append(f"")
        lines.append(
            f"[Explorer]({EXPLORER_TOKEN_URL}) | [Chart]({DEXSCREENER_PAIR_URL})"
            f" | [Website]({SITE_URL}) | [Dexscreener]({DEXSCREENER_PAIR_URL})"
        )
        return {
            "text": "\n".join(lines),
            "reply_markup": _ca_buttons(),
            "photo_url": CA_IMAGE,
            "parse_mode": "Markdown",
        }

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
                "Leaderboard is empty. Trade or hold $BITE — all wallets count. "
                "DM me your 0x… to claim identity for /points."
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
        if isinstance(reply, dict):
            _text = reply.get("text", "")
            _markup = reply.get("reply_markup")
            _photo = reply.get("photo_url")
            _parse = reply.get("parse_mode")
            if _photo:
                tg_send_photo(
                    token, chat_id, _photo, _text,
                    reply_to_message_id=msg_id,
                    reply_markup=_markup,
                    parse_mode=_parse,
                )
            else:
                tg_send(
                    token, chat_id, _text,
                    reply_to_message_id=msg_id,
                    reply_markup=_markup,
                    parse_mode=_parse,
                )
        else:
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
        # Tokens sent to dead address
        dead_burned = contract.functions.balanceOf(
            Web3.to_checksum_address(DEAD_ADDRESS)
        ).call()
        # Tokens burned via kitchen bite() — tracked by kitchen.burned()
        kitchen_burned = 0
        # Sweep burns: BITE sitting in kitchen (sent directly, not via bite())
        kitchen_balance = 0
        if KITCHEN_CONTRACT and Web3:
            kitchen_addr = Web3.to_checksum_address(KITCHEN_CONTRACT)
            try:
                kitchen_abi = [{"constant": True, "inputs": [], "name": "burned",
                                "outputs": [{"name": "", "type": "uint256"}], "type": "function"}]
                kc = contract.w3.eth.contract(address=kitchen_addr, abi=kitchen_abi)
                kitchen_burned = kc.functions.burned().call()
            except Exception as e:
                print(f"kitchen.burned() error: {e}")
            try:
                kitchen_balance = contract.functions.balanceOf(kitchen_addr).call()
            except Exception as e:
                print(f"kitchen balanceOf error: {e}")
        # Total burned = dead + kitchen.burned() + any BITE sitting in kitchen
        # (kitchen_balance includes tokens that _destroy sent to dead or burned,
        #  but after _destroy they're gone — so balance = only unswepped direct sends)
        burned = dead_burned + kitchen_burned + kitchen_balance
        if total == 0:
            return 0.0, 0, 0
        pct = (burned / total) * 100
        return pct, burned, total
    except Exception as e:
        print(f"Error reading burn: {e}")
        return 0.0, 0, 0


# ── Copy ──

def _inline_kb(*rows: list[tuple[str, str]]) -> dict:
    """Build Telegram InlineKeyboardMarkup from rows of (label, url) tuples."""
    return {
        "inline_keyboard": [
            [{"text": label, "url": url} for label, url in row]
            for row in rows
        ]
    }


def _buy_alert_buttons(tx_hash: str | None = None) -> dict:
    row1 = [("🍎 Buy $BITE", PONS_BUY_URL), ("📈 Chart", DEXSCREENER_PAIR_URL)]
    row2: list[tuple[str, str]] = []
    if tx_hash:
        row2.append(("🔍 Txn", f"{EXPLORER_TX_BASE}{tx_hash}"))
    row2.append(("Dexscreener", DEXSCREENER_PAIR_URL))
    return _inline_kb(row1, row2)


def _ca_buttons() -> dict:
    return _inline_kb(
        [("🍎 Buy $BITE", PONS_BUY_URL), ("🔥 Burn", BURN_PAGE_URL)]
    )


def _buy_buttons() -> dict:
    return _inline_kb(
        [("🍎 Buy $BITE", PONS_BUY_URL), ("📈 Chart", DEXSCREENER_PAIR_URL)]
    )


def _burn_buttons() -> dict:
    return _inline_kb(
        [("🔥 Burn", BURN_PAGE_URL), ("🍎 Buy", PONS_BUY_URL)]
    )


def _burn_milestone_buttons() -> dict:
    return _inline_kb(
        [("🍎 Buy", PONS_BUY_URL), ("🔥 Burn", BURN_PAGE_URL)]
    )


def swap_copy(wallet, amount, holders, phase: int, *, state: dict | None = None, tx_hash: str | None = None) -> str:
    w = short_addr(wallet)
    a = fmt_amount(amount)
    usd = _bite_usd_value(amount, state or {})
    usd_txt = f"${usd:,.2f}" if usd is not None else ""
    price_txt = ""
    try:
        p = float((state or {}).get("market", {}).get("dexscreener", {}).get("priceUsd") or 0)
        if p > 0:
            price_txt = f"💲 Price: ${p:.6f}"
    except (TypeError, ValueError):
        pass
    lines = [
        f"🟢 $BITE Buy!",
        f"🔑 {w}",
        f"🍎 {a} $BITE" + (f" ({usd_txt})" if usd_txt else ""),
    ]
    if price_txt:
        lines.append(price_txt)
    lines.append(f"👥 {holders} holders")
    lines.append(f"")
    lines.append(
        f"[Chart]({DEXSCREENER_PAIR_URL}) | [Buy]({PONS_BUY_URL}) | [Website]({SITE_URL})"
    )
    return "\n".join(lines)


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


def burn_milestone_copy(pct) -> str:
    special = {
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
    # Check int milestones for special messages
    msg = special.get(int(pct)) if pct == int(pct) else None
    if not msg:
        # Format decimal milestones nicely
        pct_str = f"{pct:.1f}" if pct != int(pct) else f"{int(pct)}"
        msg = f"{pct_str}% of the apple eaten. 🍎"
    return f"🍎 {msg}\n\n{SITE_URL}"


def act_i_ready_copy() -> str:
    return (
        f"🍎 $BITE bot is live (Act I). Watching the orchard on Robinhood Chain.\n"
        f"Leaderboard tracks all wallets accumulating $BITE. "
        f"DM me your 0x… to claim identity for /points.\n"
        f"Burn posts unlock in Act II when the kitchen opens.\n\n{SITE_URL}"
    )


# ── Poll ──

# Max block gap before poll treats the range as catch-up (no TG posting).
# Robinhood chain produces blocks fast (~1/s); 10000 ≈ ~3 hours of gap.
_CATCH_UP_BLOCK_THRESHOLD = int(os.getenv("CATCH_UP_BLOCK_THRESHOLD", "10000"))


def _seed_holder_milestone(state: dict) -> None:
    """Set last_holder_milestone to the highest milestone ≤ current holder_count
    so we don't replay already-passed milestones on restart."""
    count = int(state.get("holder_count") or 0)
    highest = 0
    for m in HOLDER_MILESTONES:
        if count >= m:
            highest = m
    prev = int(state.get("last_holder_milestone") or 0)
    if highest > prev:
        state["last_holder_milestone"] = highest
        print(f"[anti-replay] holder milestone seeded to {highest} (holders={count})")


def _seed_burn_milestone(state: dict, burn_pct: float) -> None:
    """Set last_burn_milestone to the highest milestone ≤ current burn_pct."""
    highest = 0
    for m in BURN_MILESTONES:
        if burn_pct >= m:
            highest = m
    prev = float(state.get("last_burn_milestone") or 0)
    if highest > prev:
        state["last_burn_milestone"] = highest
        print(f"[anti-replay] burn milestone seeded to {highest} (burn_pct={burn_pct:.2f}%)")


def poll(w3, contract, twitter, tg_token, tg_chat, state, *, dry_run: bool = False):
    if not w3 or not contract:
        print("Chain connection not available. Skipping poll.")
        return state

    ensure_dev_wallets(state)

    # Refresh Dexscreener pricing BEFORE processing events so USD filters work.
    if not dry_run:
        sync_dexscreener(state)

    current_block = w3.eth.block_number
    if state["last_block"] > 0:
        from_block = state["last_block"] + 1
    else:
        from_block = TRADE_SCAN_FROM_BLOCK
    from_block = max(from_block, TRADE_SCAN_FROM_BLOCK)

    # Detect catch-up: if we're more than _CATCH_UP_BLOCK_THRESHOLD blocks behind,
    # this is historical replay — index trades but suppress Telegram posts.
    block_gap = max(0, current_block - from_block)
    is_catch_up = block_gap > _CATCH_UP_BLOCK_THRESHOLD
    if is_catch_up:
        print(
            f"[catch-up] {block_gap} blocks behind ({from_block}→{current_block}). "
            f"Indexing only — Telegram posts suppressed."
        )

    transfer_filter: list = []
    if from_block <= current_block:
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

    # Seed milestones to current levels on first poll to prevent replays
    _seed_holder_milestone(state)
    _seed_burn_milestone(state, burn_pct)

    # Always track burn milestones in state; only post when PHASE >= 2
    for m in BURN_MILESTONES:
        if burn_pct >= m and m > float(state.get("last_burn_milestone") or 0):
            if PHASE >= 2 and not is_catch_up:
                broadcast(
                    twitter,
                    tg_token,
                    tg_chat,
                    burn_milestone_copy(m),
                    dry_run=dry_run,
                    reply_markup=_burn_milestone_buttons(),
                )
            else:
                print(
                    f"[PHASE {PHASE}] burn milestone {m}% reached "
                    f"({burn_pct:.2f}%) — post {'suppressed (catch-up)' if is_catch_up else 'deferred until PHASE>=2'}"
                )
            state["last_burn_milestone"] = m

    # Index EOA buys (contract → wallet), not router/LP inbound noise
    apply_trade_events(state, transfer_filter, tracked=None, w3=w3)

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
            if not _meets_usd_threshold(value, state, MIN_BURN_USD, MIN_BURN_RAW):
                continue
            if PHASE >= 2 and not is_catch_up:
                if value / 10**18 >= 10_000:
                    msg = burn_large_copy(from_addr, value, burn_pct)
                else:
                    msg = burn_tap_copy(from_addr, value, burn_pct)
                broadcast(twitter, tg_token, tg_chat, msg, dry_run=dry_run)
            else:
                print(
                    f"[PHASE {PHASE}] burn detected {fmt_amount(value)} "
                    f"from {short_addr(from_addr)} — post {'suppressed (catch-up)' if is_catch_up else 'deferred until PHASE>=2'}"
                )
            continue

        # Notable inbound transfers (rough buy proxy). Explicit opt-in only.
        if (
            POST_ACTIVITY
            and not is_catch_up
            and not is_mintish
            and to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower())
            and _meets_usd_threshold(value, state, MIN_SWAP_USD, MIN_SWAP_RAW)
        ):
            holders = max(len(known), int(state.get("holder_count") or 0))
            tx_hash = event.transactionHash.hex()
            if not tx_hash.startswith("0x"):
                tx_hash = "0x" + tx_hash
            msg = swap_copy(to_addr, value, holders, PHASE, state=state, tx_hash=tx_hash)
            broadcast(
                twitter, tg_token, tg_chat, msg, dry_run=dry_run,
                reply_markup=_buy_alert_buttons(tx_hash),
                photo_url=BUY_ALERT_IMAGE,
                parse_mode="Markdown",
            )

    holder_count = max(len(known), int(state.get("holder_count") or 0))
    state["holder_count"] = holder_count
    state["known_holders"] = list(known)

    for m in HOLDER_MILESTONES:
        if holder_count >= m and m > state.get("last_holder_milestone", 0):
            if not is_catch_up:
                broadcast(
                    twitter,
                    tg_token,
                    tg_chat,
                    holder_milestone_copy(m, PHASE),
                    dry_run=dry_run,
                )
            else:
                print(f"[catch-up] holder milestone {m} suppressed")
            state["last_holder_milestone"] = m

    state["last_block"] = current_block
    state["last_poll_at"] = datetime.now(timezone.utc).isoformat()
    state["last_burn_pct"] = burn_pct
    state["trade_from_block"] = TRADE_SCAN_FROM_BLOCK

    # Refresh Blockscout holders (Dexscreener already synced above)
    if not dry_run:
        sync_blockscout_holders(state, contract=contract)

    # Calculate supply breakdown (prize pool, EOA vs contract held, burnable)
    if not dry_run:
        sync_supply_stats(state, w3=w3, contract=contract)

    # Act I: score activity wallets from balance snapshots (accum + hold)
    if PHASE >= 1 and not dry_run:
        award_act_i_points(contract, state)
    else:
        write_public_leaderboard(state)

    save_state(state)
    print(
        f"Polled blocks {from_block}–{current_block}: "
        f"{len(transfer_filter)} transfers, ~{holder_count} holders, "
        f"{burn_pct:.2f}% burned (PHASE={PHASE})"
        f"{' [catch-up]' if is_catch_up else ''}"
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
        f"dev_wallets={len(DEV_WALLETS)}  "
        f"POST_ACTIVITY={POST_ACTIVITY}  "
        f"TG_POST_COOLDOWN={TG_POST_COOLDOWN}s  "
        f"CATCH_UP_THRESHOLD={_CATCH_UP_BLOCK_THRESHOLD} blocks"
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
        try:
            state = backfill_trades(w3, contract, state)
        except Exception as e:
            print(f"[backfill] startup backfill failed (will retry next poll): {e}")

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
        ("stats", ""),
        ("ca", ""),
        ("buy", ""),
        ("burn", ""),
        ("burn", "1000"),
        ("tap", "50000"),
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
