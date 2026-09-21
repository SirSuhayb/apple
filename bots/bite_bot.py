"""
$BITE — Onchain Activity Bot

Monitors the $BITE token on Robinhood Chain (4663) and posts activity
to Telegram (required) and Twitter/X (optional).

Act I (PHASE=1): burn posts are deferred. Bot still polls Transfer events,
updates burn state, may post holder milestones / notable buys, and awards
accumulation/holding points for all wallets with trade/hold activity since
TRADE_SCAN_FROM_BLOCK. Telegram /link is optional identity for /points.
Commands: /link, /balance, /points, /leaderboard (daemon polls getUpdates).
Admin DM: /kitchen (or /report) — kitchen + native-swap KPI + fee skim
  (TELEGRAM_ADMIN_CHAT_ID only). Native swap = in-app Trading API path
  (integratorFees → kitchen), not all-chain DEX volume.
Act II+ (PHASE>=2): burn trades, tap burns, and burn milestones are posted.

Run from repo root:
  python -m bots --test
  python -m bots --commands-test
  python -m bots --admin-report
  python -m bots --qualify 0xReferee…
  python -m bots --daemon
  python -m bots

Native-swap KPI: HTTP GET /swap-stats.json (also embedded in /leaderboard.json),
Telegram /kitchen, site /api/swap-stats. Client confirms via POST /native-swap.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
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

from bots.referral_escrow import maybe_qualify_referees, send_qualify
from bots.native_swaps import (
    NATIVE_SWAP_INDEX_MODE,
    ensure_native_swaps,
    ingest_client_swap,
    make_tx_from_lookup,
    note_fee_skims_from_aapl_transfers,
    note_fee_skims_from_bite_transfers,
    summarize_native_swaps,
)
# ── Config ──

RPC_URL = os.getenv("RPC_URL", "https://rpc.mainnet.chain.robinhood.com")
BITE_CONTRACT = os.getenv("BITE_CONTRACT", "").strip()
DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
PHASE = int(os.getenv("PHASE", "1"))
STATE_FILE = Path(
    os.getenv("BITE_BOT_STATE_FILE", Path(__file__).resolve().parent / ".bite_bot_state.json")
)
SITE_URL = os.getenv("SITE_URL", "https://www.bite.party")
# Primary buy CTA → native swap on bite.party (#swap opens SwapModal).
BUY_URL = os.getenv("BUY_URL", f"{SITE_URL.rstrip('/')}/#swap")
# Secondary fallback only (explicitly labeled as pons when shown).
PONS_BUY_URL = os.getenv("PONS_BUY_URL", "").strip()
CHAIN_ID = int(os.getenv("CHAIN_ID", "4663"))
KITCHEN_CONTRACT = os.getenv("KITCHEN_CONTRACT", "").strip()
META_WAGER_CONTRACT = os.getenv("META_WAGER_CONTRACT", "").strip()
AAPL_TOKEN = os.getenv(
    "AAPL_TOKEN",
    "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
)
PONS_FEE_ESCROW = os.getenv("PONS_FEE_ESCROW", "").strip()
UNISWAP_POSITION_MANAGER = os.getenv(
    "UNISWAP_POSITION_MANAGER",
    "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
)
UNISWAP_POOL_MANAGER = os.getenv(
    "UNISWAP_POOL_MANAGER",
    "0x8366a39CC670B4001A1121B8F6A443A643e40951",
)
# Known Uniswap/Pons routers that have received BITE in Transfer logs.
_DEFAULT_PROTOCOL_ADDRS = (
    "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044",
    "0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f",
    "0x8f10b468b06c6fd214b65f87778827f7d113f996",
    "0x8876789976decbfcbbbe364623c63652db8c0904",  # Universal Router 2.1.1
    "0x6aa80dbbed9ae5ab45fbf61f9644fada3b29326e",  # v4 unlock/locker
)
# Integrator fee (PAY_PORTION) senders for native-swap KPI — UR + v4 locker only.
# Do NOT use the full protocol-hold set (PM / token / escrow) — those are not fee skims.
_NATIVE_SWAP_FEE_SENDERS = (
    "0x8876789976decbfcbbbe364623c63652db8c0904",  # Universal Router 2.1.1
    "0x6aa80dbbed9ae5ab45fbf61f9644fada3b29326e",  # v4 unlock/locker
)
# Last known kitchen-attributed escrow claimable (~0.539 AAPL / $178). RPC fallback only.
LAST_KNOWN_ESCROW_CLAIMABLE_AAPL_RAW = int(0.539059 * 10**18)

PONS_FEE_ESCROW_ABI = [
    {
        "inputs": [
            {"name": "recipient", "type": "address"},
            {"name": "token", "type": "address"},
        ],
        "name": "balanceOfToken",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Kitchen view helpers for admin DM reports (burn progress + digest prize).
KITCHEN_VIEW_ABI = [
    {
        "inputs": [],
        "name": "burned",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "coreTarget",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "deadline",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "phase",
        "outputs": [{"type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "prizePool",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "progressBps",
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Private admin DM reports (kitchen + swap/fee skim). Reuses TELEGRAM_BOT_TOKEN.
# TELEGRAM_CHAT_ID stays the public channel; DMs go to TELEGRAM_ADMIN_CHAT_ID.
TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "").strip()
# Default every 6 hours. Set 0 to disable scheduled DMs (still allow --admin-report).
ADMIN_REPORT_INTERVAL_SEC = int(os.getenv("ADMIN_REPORT_INTERVAL_SEC", "21600"))
# First-run / forced lookback when no prior report block is stored (~6h @ ~1s blocks).
ADMIN_REPORT_LOOKBACK_BLOCKS = int(os.getenv("ADMIN_REPORT_LOOKBACK_BLOCKS", "25000"))
_KITCHEN_PHASE_NAMES = {0: "None", 1: "Racing", 2: "Core", 3: "Rot"}

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
# Points: every kitchen burn scores (default $0). Telegram posts still use MIN_BURN_USD.
MIN_BURN_SCORE_USD = float(os.getenv("MIN_BURN_SCORE_USD", "0"))
MIN_BURN_SCORE_RAW = int(
    float(os.getenv("MIN_BURN_SCORE_AMOUNT", "0")) * 10**18
)

# Rate limiting: minimum seconds between Telegram posts (buy/burn/milestone broadcasts).
TG_POST_COOLDOWN = int(os.getenv("TG_POST_COOLDOWN", "45"))
_last_tg_broadcast_at: float = 0.0
HOLDER_MILESTONES = [50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]
# 0.1% increments up to 5%, then 1% increments to 50%
BURN_MILESTONES = [
    *[round(i * 0.1, 1) for i in range(1, 51)],   # 0.1, 0.2, … 5.0
    *list(range(6, 51)),                             # 6, 7, … 50
]

# Points: accumulation (balance growth) + holding (time-weighted balance).
# Act II adds buy/sell/burn scoring.
POINTS_PER_BITE_GAINED = float(os.getenv("POINTS_PER_BITE_GAINED", "0.01"))
HOLD_BITE_PER_POINT_PER_HOUR = float(os.getenv("HOLD_BITE_PER_POINT_PER_HOUR", "10000"))
# Act II: trades take moderate bites, burns take bigger bites.
BUY_SCORE_MULT = float(os.getenv("BUY_SCORE_MULT", "0.01"))
SELL_SCORE_MULT = float(os.getenv("SELL_SCORE_MULT", "0.015"))
BURN_SCORE_MULT = float(os.getenv("BURN_SCORE_MULT", "1"))
# Side bet, not a bite — 10× lighter than a buy so wagers cannot lead.
WAGER_SCORE_MULT = float(os.getenv("WAGER_SCORE_MULT", "0.001"))
EARLY_EATER_BURN_MULT = float(os.getenv("EARLY_EATER_BURN_MULT", "2"))
EARLY_EATER_HOURS = int(os.getenv("EARLY_EATER_HOURS", "72"))
_ACT_II_STARTED_RAW = os.getenv("ACT_II_STARTED_AT", "").strip()
ACT_II_STARTED_AT = int(_ACT_II_STARTED_RAW) if _ACT_II_STARTED_RAW.isdigit() else 0
SCORE_SCALE = "v2_burn_lead_wager"
SCORE_SCALE_BURN_LEAD = "v2_burn_lead"
SCORE_SCALE_CENTI = "v2_centi"
ACCUM_HOLD_SCALE = 0.01
LEGACY_BUY_MULT = 1.0
LEGACY_SELL_MULT = 1.5
LEGACY_BURN_MULT = 50.0
CENTI_BURN_MULT = 0.1
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
DEXSCREENER_PAIR_ID = os.getenv("DEXSCREENER_PAIR_ID", "").strip()
DEXSCREENER_PAIR_URL = os.getenv(
    "DEXSCREENER_PAIR_URL",
    f"https://dexscreener.com/robinhood/{DEXSCREENER_PAIR_ID}" if DEXSCREENER_PAIR_ID else "",
)
DEXSCREENER_API_URL = (
    f"https://api.dexscreener.com/latest/dex/pairs/robinhood/{DEXSCREENER_PAIR_ID}"
    if DEXSCREENER_PAIR_ID
    else ""
)
EXPLORER_TOKEN_URL = f"https://robin.etherscan.io/address/{BITE_CONTRACT}"
EXPLORER_TX_BASE = "https://robin.etherscan.io/tx/"
BURN_PAGE_URL = f"{SITE_URL}/#burn"
BUY_ALERT_IMAGE = "https://www.bite.party/social_media/biteTaken.png"
BURN_ALERT_IMAGE = "https://www.bite.party/social_media/burn_alert.png"
CA_IMAGE = "https://www.bite.party/og_image.png"

# Creator / team wallets: visible on the board, scored, but ineligible to win.
# (Blockscout may flag the deployer as a contract — still keep it on the board.)
# Set via DEV_WALLETS env (comma-separated). No hardcoded production EOAs.
_DEFAULT_DEV_WALLETS: tuple[str, ...] = ()

# Trade index: EOA buys + sells + burns (kitchen/dead/zero). Bump to force recount.
# v4: EIP-7702 delegated EOAs (0xef0100||address) are wallets, not contracts.
TRADE_INDEX_MODE = "eoa_trades_burns_v4"
# Buy/sell side from Uniswap v4 Swap BalanceDelta (token0=BITE). Does not bump
# TRADE_INDEX_MODE so kitchen burns are not wiped and re-scanned.
TRADE_SIDE_MODE = "v4_swap_delta_v1"
# Visibility pass: kitchen.bite() under MIN_BURN_USD still records burned_bite /
# burn_count so the site can show participation. Does not add points and does
# not bump TRADE_INDEX_MODE (keeps the v4 7702 classification).
DUST_BURN_INDEX_MODE = "dust_burns_v1"
# MetaWager BetPlaced backfill. Does not bump TRADE_INDEX_MODE.
WAGER_INDEX_MODE = "wager_bets_v1"
# Native (in-app) swap fee-skim index. Does not bump TRADE_INDEX_MODE.

# Uniswap v4 PoolManager.Swap — BITE is currency0 / token0 on this pool.
# keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)")
V4_SWAP_TOPIC = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f"
V4_POOL_ID = os.getenv("DEXSCREENER_PAIR_ID", DEXSCREENER_PAIR_ID).lower()
if not str(V4_POOL_ID).startswith("0x"):
    V4_POOL_ID = "0x" + V4_POOL_ID


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

META_WAGER_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "totalCore",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "totalRot",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "resolved",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "winningSide",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "coreOddsBps",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "bettor", "type": "address"},
            {"indexed": False, "name": "side", "type": "uint8"},
            {"indexed": False, "name": "netAmount", "type": "uint256"},
            {"indexed": False, "name": "fee", "type": "uint256"},
        ],
        "name": "BetPlaced",
        "type": "event",
    },
]

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
        # Native in-app swaps (fee skim → kitchen); see bots/native_swaps.py
        "native_swaps": {},
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
    ensure_native_swaps(state)
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


def _burn_destinations() -> set[str]:
    """Addresses whose inbound BITE is a user burn (kitchen bite, sweep, or dead/zero)."""
    dest = {DEAD_ADDRESS.lower(), ZERO_ADDRESS.lower()}
    if KITCHEN_CONTRACT:
        dest.add(KITCHEN_CONTRACT.lower())
    return dest


def _excluded_board_addrs(state: dict | None = None) -> set[str]:
    excluded = {
        ZERO_ADDRESS.lower(),
        DEAD_ADDRESS.lower(),
        BITE_CONTRACT.lower(),
    }
    if KITCHEN_CONTRACT:
        excluded.add(KITCHEN_CONTRACT.lower())
    if state:
        for a in state.get("contract_addrs") or []:
            if isinstance(a, str) and a.lower() not in DEV_WALLETS:
                excluded.add(a.lower())
    return excluded


def _protocol_hold_addrs() -> set[str]:
    """Contracts that can hold BITE but are not people.

    Kitchen, escrow, Uniswap pool/PositionManager, known routers, dead/zero.
    EIP-7702 delegated EOAs are *not* listed here — they still count as holders.
    """
    excluded = {
        ZERO_ADDRESS.lower(),
        DEAD_ADDRESS.lower(),
        BITE_CONTRACT.lower(),
    }
    for raw in (
        KITCHEN_CONTRACT,
        PONS_FEE_ESCROW,
        META_WAGER_CONTRACT,
        UNISWAP_POSITION_MANAGER,
        UNISWAP_POOL_MANAGER,
        *_DEFAULT_PROTOCOL_ADDRS,
    ):
        if isinstance(raw, str) and ADDR_RE.match(raw):
            excluded.add(raw.lower())
    return excluded


def _raw_balance(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def is_valid_eoa_holder(
    addr: str,
    balance_raw: int,
    *,
    is_contract: bool = False,
    contract_addrs: set[str] | None = None,
) -> bool:
    """A holder is an address with BITE > 0 that is a person, not a protocol contract.

    EIP-7702 (0xef0100||address) must be passed as is_contract=False.
    """
    if balance_raw <= 0 or not isinstance(addr, str):
        return False
    key = addr.lower()
    if not ADDR_RE.match(key):
        return False
    if key in _protocol_hold_addrs():
        return False
    if is_contract:
        return False
    if contract_addrs and key in contract_addrs:
        return False
    return True


def eoa_holder_balances(state: dict) -> list[tuple[str, int]]:
    """Current EOA (incl. EIP-7702) balances. Prefers Blockscout rows, else snapshots.

    Single source for holder_count and eoa_held so they cannot diverge.
    """
    contracts = {
        a.lower()
        for a in (state.get("contract_addrs") or [])
        if isinstance(a, str)
    }
    out: list[tuple[str, int]] = []
    seen: set[str] = set()
    rows = state.get("current_token_holders")
    if isinstance(rows, list) and rows:
        for h in rows:
            if not isinstance(h, dict):
                continue
            addr = str(h.get("address") or "").lower()
            if addr in seen:
                continue
            bal = _raw_balance(h.get("value"))
            if not is_valid_eoa_holder(
                addr,
                bal,
                is_contract=bool(h.get("is_contract")),
                contract_addrs=contracts,
            ):
                continue
            seen.add(addr)
            out.append((addr, bal))
        return out

    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict) or not isinstance(wallet_l, str):
            continue
        key = wallet_l.lower()
        if key in seen:
            continue
        bal = _raw_balance(entry.get("last_balance_raw"))
        if not is_valid_eoa_holder(key, bal, contract_addrs=contracts):
            continue
        seen.add(key)
        out.append((key, bal))
    return out


def count_eoa_holders(state: dict) -> int:
    return len(eoa_holder_balances(state))


def all_time_recipients(state: dict) -> int:
    """FOMO-style count: unique addresses that ever received BITE."""
    known = {
        a.lower()
        for a in (state.get("known_holders") or [])
        if isinstance(a, str) and ADDR_RE.match(a)
    }
    return len(known)


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
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")[:240]
        except Exception:
            pass
        print(f"[http] {url[:72]}… HTTP {e.code} {body}")
        if body:
            try:
                parsed = json.loads(body)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
        return None
    except Exception as e:
        print(f"[http] {url[:72]}… {e}")
        return None


def _blockscout_payload_ok(data) -> bool:
    """Reject credit/auth error bodies that still parse as JSON objects."""
    if not isinstance(data, dict):
        return False
    err = data.get("error") or data.get("message")
    if isinstance(err, str) and err.strip():
        return False
    return True


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


def _reclassify_cached_contracts(w3, state: dict, *, budget_sec: float = 8.0) -> int:
    """Re-check cached contract_addrs for EIP-7702 false positives (budgeted)."""
    if not w3 or not Web3:
        return 0
    protocol = _protocol_hold_addrs()
    suspects = [
        a.lower()
        for a in (state.get("contract_addrs") or [])
        if isinstance(a, str) and a.lower() not in protocol
    ]
    if not suspects:
        return 0
    # Prefer not-yet-cleared suspects; skip ones already confirmed EOA this process.
    eoas = {
        a.lower() for a in (state.get("eoa_addrs") or []) if isinstance(a, str)
    }
    pending = [a for a in suspects if a not in eoas]
    if not pending:
        return 0
    started = datetime.now(timezone.utc)
    batch: set[str] = set()
    for addr in pending:
        if (datetime.now(timezone.utc) - started).total_seconds() >= max(2.0, budget_sec):
            break
        batch.add(addr)
        if len(batch) >= 40:
            classify_contracts(w3, batch, state, recheck=True)
            batch.clear()
    if batch:
        classify_contracts(w3, batch, state, recheck=True)
    return len(pending)


def _fallback_rpc_holders(state: dict, *, contract=None, reason: str) -> dict:
    print(f"[blockscout] {reason} — falling back to RPC holder sync")
    # Drop the frozen Blockscout snapshot *before* any RPC work so the
    # public board immediately recounts from points (not a stale 173-row list).
    state.pop("current_token_holders", None)
    state["current_token_holders_complete"] = False
    market = state.setdefault("market", {})
    bs = market.setdefault("blockscout", {"tokenUrl": BLOCKSCOUT_TOKEN_URL})
    w3 = _w3_from_contract(contract)
    # Unstick EIP-7702 wallets poisoned into contract_addrs before publishing.
    if w3 is not None:
        _reclassify_cached_contracts(w3, state, budget_sec=8.0)
    eoa_count = count_eoa_holders(state)
    state["holder_count"] = eoa_count
    bs["holdersEoa"] = eoa_count
    bs["source"] = "rpc" if contract is not None else "stale"
    bs["updatedAt"] = datetime.now(timezone.utc).isoformat()
    ss = state.get("supply_stats")
    if isinstance(ss, dict):
        ss["holder_count"] = eoa_count
    if contract is not None:
        return sync_rpc_holder_balances(state, contract=contract)
    return state


def sync_blockscout_holders(state: dict, *, contract=None) -> dict:
    """
    Sync current token holders from Blockscout Pro API.
    Seeds balances / contract flags; EOAs get hold points from launch time
    when they have no snapshot yet. Contracts stay off the board (except DEV).

    On API credit/auth failure, falls back to RPC balanceOf + getCode so
    holder_count cannot freeze on a stale current_token_holders snapshot.
    """
    market = state.setdefault("market", {})
    bs = market.setdefault("blockscout", {"tokenUrl": BLOCKSCOUT_TOKEN_URL})
    bs["apiBase"] = BLOCKSCOUT_API_BASE
    bs["tokenUrl"] = BLOCKSCOUT_TOKEN_URL

    if not BLOCKSCOUT_API_KEY:
        return _fallback_rpc_holders(
            state, contract=contract, reason="BLOCKSCOUT_API_KEY unset"
        )

    counters = blockscout_get(f"/tokens/{BITE_CONTRACT}/counters")
    if _blockscout_payload_ok(counters):
        bs["transfersCount"] = counters.get("transfers_count")
        # Explorer "holders" = any address with balance > 0, including LP/contracts.
        # Do not promote that to holder_count (FOMO-style overcount).
        bs["holdersCount"] = counters.get("token_holders_count")
    elif counters is not None:
        err = counters.get("error") or counters.get("message") or "unknown"
        return _fallback_rpc_holders(
            state, contract=contract, reason=f"counters error: {err}"
        )

    holders: list[dict] = []
    params: dict = {"items_count": 50}
    pages = 0
    holder_page_cap = 80
    finished = False
    truncated = False
    api_error = None
    w3 = _w3_from_contract(contract)
    while pages < holder_page_cap:
        pages += 1
        data = blockscout_get(f"/tokens/{BITE_CONTRACT}/holders", params)
        if not _blockscout_payload_ok(data):
            if isinstance(data, dict) and (data.get("error") or data.get("message")):
                api_error = data.get("error") or data.get("message")
            truncated = True
            break
        items = data.get("items") or []
        if not items:
            finished = True
            break
        for it in items:
            addr_obj = it.get("address") or {}
            if isinstance(addr_obj, str):
                addr = addr_obj
                is_contract = False
            else:
                addr = addr_obj.get("hash") or ""
                is_contract = _blockscout_addr_is_contract(addr_obj)
            if not isinstance(addr, str) or not ADDR_RE.match(addr):
                continue
            addr_l = addr.lower()
            # Re-check explorer contract flags — EIP-7702 is often is_contract=true
            # without a reliable proxy_type, which permanently poisoned contract_addrs.
            if is_contract and w3 and Web3 and addr_l not in DEV_WALLETS:
                try:
                    code = w3.eth.get_code(Web3.to_checksum_address(addr_l))
                    if not _bytecode_is_contract(code):
                        is_contract = False
                except Exception as e:
                    print(f"[blockscout] get_code {short_addr(addr_l)}: {e}")
            holders.append(
                {
                    "address": addr_l,
                    "value": str(it.get("value") or "0"),
                    "is_contract": is_contract,
                }
            )
        nxt = data.get("next_page_params")
        if not nxt or not isinstance(nxt, dict):
            finished = True
            break
        params = {**nxt}
        # keep page size hint
        params.setdefault("items_count", 50)
    else:
        truncated = True

    if api_error:
        return _fallback_rpc_holders(
            state, contract=contract, reason=f"holders error: {api_error}"
        )

    if not holders:
        return _fallback_rpc_holders(
            state, contract=contract, reason="holders sync returned 0 rows"
        )

    complete = finished and not truncated
    contracts = {a.lower() for a in (state.get("contract_addrs") or []) if isinstance(a, str)}
    eoas = {a.lower() for a in (state.get("eoa_addrs") or []) if isinstance(a, str)}
    known = {a.lower() for a in (state.get("known_holders") or []) if isinstance(a, str)}
    now = datetime.now(timezone.utc)
    hours = max(0.0, (now - LAUNCH_AT).total_seconds() / 3600.0)
    present: set[str] = set()

    for h in holders:
        addr = h["address"]
        is_contract = bool(h["is_contract"])
        present.add(addr)
        if is_contract and addr not in DEV_WALLETS:
            contracts.add(addr)
            eoas.discard(addr)
            known.add(addr)
            # Still seed balance so RPC fallback candidates stay complete.
            bal = _raw_balance(h.get("value"))
            entry = points_entry(state, addr)
            entry["wallet"] = Web3.to_checksum_address(addr) if Web3 else addr
            entry["last_balance_raw"] = bal
            entry["last_snapshot_at"] = now.isoformat()
            continue
        if is_contract and addr in DEV_WALLETS:
            contracts.add(addr)  # still flagged, but board-eligible via DEV
        else:
            eoas.add(addr)
            contracts.discard(addr)
        known.add(addr)
        bal = _raw_balance(h.get("value"))
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

    # Full holder list: anyone missing sold out — zero stale snapshots so
    # circulating / holder_count do not keep FOMO leftovers.
    if complete:
        for wallet_l, entry in (state.get("points") or {}).items():
            if not isinstance(entry, dict) or not isinstance(wallet_l, str):
                continue
            if wallet_l.lower() not in present:
                entry["last_balance_raw"] = 0

    if complete:
        state["current_token_holders"] = holders
    else:
        state.pop("current_token_holders", None)
    state["current_token_holders_complete"] = complete
    state["contract_addrs"] = sorted(contracts)
    state["eoa_addrs"] = sorted(eoas)
    state["known_holders"] = sorted(known)

    # Blockscout's holder index can lag / omit wallets that still hold BITE.
    # Reconcile known Transfer recipients via balanceOf so EOA count cannot
    # freeze below the real on-chain set (incl. EIP-7702).
    if complete and contract is not None and w3 and Web3:
        present_set = set(present)
        extra = 0
        for addr in sorted(known | eoas):
            if addr in present_set:
                continue
            if addr in _protocol_hold_addrs() and addr not in DEV_WALLETS:
                continue
            bal = read_balance_raw(contract, addr)
            if bal is None or bal <= 0:
                continue
            is_contract = False
            if addr in contracts and addr not in DEV_WALLETS:
                try:
                    code = w3.eth.get_code(Web3.to_checksum_address(addr))
                    is_contract = _bytecode_is_contract(code)
                except Exception:
                    is_contract = True
            if is_contract:
                contracts.add(addr)
                eoas.discard(addr)
            else:
                eoas.add(addr)
                contracts.discard(addr)
            holders.append(
                {
                    "address": addr,
                    "value": str(bal),
                    "is_contract": is_contract,
                }
            )
            present_set.add(addr)
            entry = points_entry(state, addr)
            entry["wallet"] = Web3.to_checksum_address(addr)
            entry["last_balance_raw"] = bal
            entry["last_snapshot_at"] = now.isoformat()
            extra += 1
        if extra:
            print(f"[blockscout] reconciled +{extra} holders via RPC balanceOf")
            state["current_token_holders"] = holders
            state["contract_addrs"] = sorted(contracts)
            state["eoa_addrs"] = sorted(eoas)

    eoa_count = count_eoa_holders(state)
    state["holder_count"] = eoa_count
    bs["holdersEoa"] = eoa_count
    bs["holdersTotal"] = len(holders)
    bs["holdersComplete"] = complete
    bs["synced"] = len(holders)
    bs["source"] = "blockscout"
    bs["updatedAt"] = now.isoformat()
    print(
        f"[blockscout] holders synced: {len(holders)} total, "
        f"{eoa_count} EOA (explorer holders_count={bs.get('holdersCount')}"
        f"{'' if complete else ', truncated'})"
    )
    # Incomplete pages still leave a frozen-ish snapshot risk — heal via RPC.
    if not complete and contract is not None:
        return sync_rpc_holder_balances(state, contract=contract)
    return state


def sync_market_sources(state: dict, *, contract=None) -> dict:
    """Refresh Dexscreener + Blockscout Pro market/holders data."""
    sync_dexscreener(state)
    sync_blockscout_holders(state, contract=contract)
    return state


def sync_supply_stats(state: dict, w3=None, contract=None) -> dict:
    """Calculate and store supply breakdown: prize pool, EOA/contract held, realistically burnable."""
    stats = state.setdefault("supply_stats", {})

    # Displayed prize pool = kitchen AAPL + kitchen-attributed Pons escrow claimable.
    # Display only — never claim. Do not use the escrow's total AAPL balance.
    kitchen_raw = 0
    escrow_raw = 0
    escrow_ok = False
    if w3 and Web3 and KITCHEN_CONTRACT and AAPL_TOKEN:
        kitchen_addr = Web3.to_checksum_address(KITCHEN_CONTRACT)
        aapl_addr = Web3.to_checksum_address(AAPL_TOKEN)
        try:
            aapl_contract = w3.eth.contract(address=aapl_addr, abi=ERC20_ABI)
            kitchen_raw = int(aapl_contract.functions.balanceOf(kitchen_addr).call())
        except Exception as e:
            print(f"[supply_stats] AAPL balanceOf(kitchen) error: {e}")
        if PONS_FEE_ESCROW:
            try:
                escrow = w3.eth.contract(
                    address=Web3.to_checksum_address(PONS_FEE_ESCROW),
                    abi=PONS_FEE_ESCROW_ABI,
                )
                escrow_raw = int(
                    escrow.functions.balanceOfToken(kitchen_addr, aapl_addr).call()
                )
                escrow_ok = True
            except Exception as e:
                print(f"[supply_stats] escrow balanceOfToken(kitchen, AAPL) error: {e}")
        if not escrow_ok:
            prev = int(stats.get("escrow_claimable_aapl_raw") or 0)
            escrow_raw = prev if prev > 0 else LAST_KNOWN_ESCROW_CLAIMABLE_AAPL_RAW
            print(
                f"[supply_stats] escrow claimable fallback="
                f"{escrow_raw / 10**18:.6f} AAPL"
            )

    prize_pool_raw = kitchen_raw + escrow_raw
    stats["kitchen_aapl_raw"] = kitchen_raw
    stats["escrow_claimable_aapl_raw"] = escrow_raw
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

    # Supply breakdown from current EOA balances (same set as holder_count)
    total_supply = int(state.get("total_supply") or 0)
    total_burned = int(state.get("total_burned") or 0)

    eoa_held = 0
    holder_count = 0
    for _addr, bal in eoa_holder_balances(state):
        eoa_held += bal
        holder_count += 1

    accounted = eoa_held + total_burned
    contract_held = max(0, total_supply - accounted)

    stats["eoa_held_bite_raw"] = eoa_held
    stats["eoa_held_bite"] = eoa_held / 10**18
    stats["contract_held_bite_raw"] = contract_held
    stats["contract_held_bite"] = contract_held / 10**18
    stats["realistically_burnable_raw"] = eoa_held
    stats["realistically_burnable"] = eoa_held / 10**18
    stats["total_supply"] = total_supply / 10**18
    stats["total_burned"] = total_burned / 10**18
    stats["holder_count"] = holder_count
    stats["all_time_recipients"] = all_time_recipients(state)
    stats["updated_at"] = datetime.now(timezone.utc).isoformat()
    state["holder_count"] = holder_count
    market = state.setdefault("market", {})
    bs = market.setdefault("blockscout", {})
    bs["holdersEoa"] = holder_count

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
        f" (kitchen={kitchen_raw / 10**18:.4f} + escrow={escrow_raw / 10**18:.4f})"
        f" (${stats.get('prize_pool_usd') or 0:.2f})"
        f" | EOA={fmt_amount(eoa_held)} | contract={fmt_amount(contract_held)}"
        f" | burnable={fmt_amount(eoa_held)}"
    )
    return state


def _as_bytecode(code) -> bytes:
    if not code:
        return b""
    if isinstance(code, (bytes, bytearray)):
        return bytes(code)
    text = str(code).strip()
    if text.startswith(("0x", "0X")):
        text = text[2:]
    if not text:
        return b""
    try:
        return bytes.fromhex(text)
    except ValueError:
        return b""


def _is_eip7702_delegation(code) -> bool:
    """EIP-7702 designator is 0xef0100 || address (23 bytes). Still an EOA."""
    raw = _as_bytecode(code)
    return len(raw) == 23 and raw[:3] == b"\xef\x01\x00"


def _bytecode_is_contract(code) -> bool:
    raw = _as_bytecode(code)
    if not raw or _is_eip7702_delegation(raw):
        return False
    return True


def _blockscout_addr_is_contract(addr_obj) -> bool:
    """Blockscout flags EIP-7702 delegated EOAs as is_contract; those still score."""
    if not isinstance(addr_obj, dict):
        return False
    proxy = str(addr_obj.get("proxy_type") or "").lower().replace("-", "").replace("_", "")
    if "eip7702" in proxy or proxy in ("7702", "delegated"):
        return False
    # Some explorer payloads put the designator under implementations / name.
    for key in ("name", "ens_domain_name", "implementation_name"):
        label = str(addr_obj.get(key) or "").lower()
        if "eip-7702" in label or "eip7702" in label:
            return False
    return bool(addr_obj.get("is_contract"))


def _w3_from_contract(contract):
    if contract is None:
        return None
    return getattr(contract, "w3", None)


def _holder_candidate_addrs(state: dict) -> set[str]:
    """Addresses that may currently hold BITE (for RPC recount)."""
    out: set[str] = set()
    for key in ("known_holders", "eoa_addrs", "contract_addrs"):
        for a in state.get(key) or []:
            if isinstance(a, str) and ADDR_RE.match(a):
                out.add(a.lower())
    for wallet_l, entry in (state.get("points") or {}).items():
        if isinstance(wallet_l, str) and ADDR_RE.match(wallet_l):
            out.add(wallet_l.lower())
        if isinstance(entry, dict):
            w = entry.get("wallet")
            if isinstance(w, str) and ADDR_RE.match(w):
                out.add(w.lower())
    for h in state.get("current_token_holders") or []:
        if not isinstance(h, dict):
            continue
        addr = str(h.get("address") or "").lower()
        if ADDR_RE.match(addr):
            out.add(addr)
    out |= _protocol_hold_addrs()
    return out


def sync_rpc_holder_balances(state: dict, *, contract=None) -> dict:
    """Recount holders via balanceOf + eth_getCode when Blockscout is unavailable.

    Incremental: each call spends at most RPC_HOLDER_SYNC_BUDGET_SEC so the
    daemon keeps polling / serving health. Clears stale Blockscout snapshots
    immediately so holder_count is not frozen on an old row list.
    """
    w3 = _w3_from_contract(contract)
    if not contract or not w3 or not Web3:
        print("[rpc-holders] no contract/w3 — cannot refresh holder snapshot")
        return state

    market = state.setdefault("market", {})
    bs = market.setdefault("blockscout", {"tokenUrl": BLOCKSCOUT_TOKEN_URL})
    now = datetime.now(timezone.utc)
    interval = int(os.getenv("RPC_HOLDER_SYNC_INTERVAL_SEC", "180"))
    budget_sec = float(os.getenv("RPC_HOLDER_SYNC_BUDGET_SEC", "20"))
    last_raw = state.get("rpc_holders_synced_at")
    # Interval short-circuit *before* wiping a completed snapshot.
    if (
        last_raw
        and state.get("rpc_holders_pass_complete")
        and state.get("current_token_holders_complete")
        and isinstance(state.get("current_token_holders"), list)
        and state.get("current_token_holders")
        and bs.get("source") == "rpc"
    ):
        try:
            last_dt = datetime.fromisoformat(str(last_raw))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt).total_seconds() < max(30, interval):
                eoa_count = count_eoa_holders(state)
                state["holder_count"] = eoa_count
                bs["holdersEoa"] = eoa_count
                return state
        except Exception:
            pass

    # Unfreeze Blockscout rows while a chunked RPC pass is in flight.
    state.pop("current_token_holders", None)
    state["current_token_holders_complete"] = False

    candidates = sorted(_holder_candidate_addrs(state))
    if not candidates:
        print("[rpc-holders] no candidate addresses")
        return state

    # Resume chunked pass across polls.
    cursor = int(state.get("rpc_holders_cursor") or 0)
    if cursor < 0 or cursor >= len(candidates):
        cursor = 0
        state["rpc_holders_partial"] = []
    # Reclassify EIP-7702 false positives only when starting a pass — doing
    # hundreds of eth_getCode calls every 30s poll starved the balanceOf chunk
    # and left the daemon stuck mid-pass (source=rpc, count frozen).
    if cursor == 0:
        _reclassify_cached_contracts(w3, state, budget_sec=min(8.0, budget_sec))

    contracts = {
        a.lower()
        for a in (state.get("contract_addrs") or [])
        if isinstance(a, str)
    }
    eoas = {
        a.lower() for a in (state.get("eoa_addrs") or []) if isinstance(a, str)
    }
    known = {
        a.lower()
        for a in (state.get("known_holders") or [])
        if isinstance(a, str)
    }
    protocol = _protocol_hold_addrs()
    partial = state.get("rpc_holders_partial")
    if not isinstance(partial, list):
        partial = []
    holders_by_addr = {
        str(h.get("address") or "").lower(): h
        for h in partial
        if isinstance(h, dict) and ADDR_RE.match(str(h.get("address") or ""))
    }
    checked = 0
    started = datetime.now(timezone.utc)
    idx = cursor
    while idx < len(candidates):
        if (datetime.now(timezone.utc) - started).total_seconds() >= max(5.0, budget_sec):
            break
        addr = candidates[idx]
        idx += 1
        bal = read_balance_raw(contract, addr)
        if bal is None:
            continue
        checked += 1
        is_protocol = addr in protocol and addr not in DEV_WALLETS
        is_contract = is_protocol or (addr in contracts and addr not in DEV_WALLETS)
        if is_contract:
            contracts.add(addr)
            eoas.discard(addr)
        else:
            eoas.add(addr)
            contracts.discard(addr)
        holders_by_addr[addr] = {
            "address": addr,
            "value": str(bal),
            "is_contract": is_contract,
        }
        known.add(addr)
        entry = points_entry(state, addr)
        entry["wallet"] = Web3.to_checksum_address(addr)
        entry["last_balance_raw"] = bal
        entry["last_snapshot_at"] = now.isoformat()
        if addr in DEV_WALLETS:
            entry["dev"] = True
            entry["ineligible"] = True

    complete = idx >= len(candidates)
    holders = list(holders_by_addr.values())
    state["rpc_holders_cursor"] = 0 if complete else idx
    state["rpc_holders_partial"] = [] if complete else holders
    state["rpc_holders_pass_complete"] = complete

    if complete:
        present_pos = {
            h["address"] for h in holders if _raw_balance(h.get("value")) > 0
        }
        checked_set = {h["address"] for h in holders}
        for wallet_l, entry in (state.get("points") or {}).items():
            if not isinstance(entry, dict) or not isinstance(wallet_l, str):
                continue
            key = wallet_l.lower()
            if key in checked_set and key not in present_pos:
                entry["last_balance_raw"] = 0

        state["current_token_holders"] = holders
        state["current_token_holders_complete"] = True
        state["contract_addrs"] = sorted(contracts | (protocol - set(DEV_WALLETS)))
        state["eoa_addrs"] = sorted(eoas - protocol)
        state["known_holders"] = sorted(known)
        state["rpc_holders_synced_at"] = now.isoformat()
        bs["holdersTotal"] = len(present_pos)
        bs["holdersComplete"] = True
        bs["synced"] = len(holders)
    else:
        # Partial pass: keep points-based count; persist progress.
        state["contract_addrs"] = sorted(contracts | (protocol - set(DEV_WALLETS)))
        state["eoa_addrs"] = sorted(eoas - protocol)
        state["known_holders"] = sorted(known)
        bs["holdersComplete"] = False
        bs["synced"] = len(holders)

    eoa_count = count_eoa_holders(state)
    state["holder_count"] = eoa_count
    bs["holdersEoa"] = eoa_count
    bs["source"] = "rpc"
    bs["updatedAt"] = now.isoformat()
    ss = state.get("supply_stats")
    if isinstance(ss, dict):
        ss["holder_count"] = eoa_count
    print(
        f"[rpc-holders] checked+{checked} cursor={idx}/{len(candidates)} "
        f"EOA={eoa_count}{' complete' if complete else ' (chunked)'}"
    )
    return state


def classify_contracts(
    w3, addresses: set[str], state: dict, *, recheck: bool = False
) -> set[str]:
    """Cache eth_getCode results; contracts are excluded from the Act I board.

    EIP-7702 delegated EOAs have temporary code but still sign as wallets —
    do not treat them like LP/router contracts (that dropped kitchen burns).
    """
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
        if a in DEV_WALLETS:
            continue
        if not recheck and (a in contracts or a in eoas):
            continue
        if not w3 or not Web3:
            continue
        try:
            code = w3.eth.get_code(Web3.to_checksum_address(a))
            if _bytecode_is_contract(code):
                contracts.add(a)
                eoas.discard(a)
            else:
                eoas.add(a)
                contracts.discard(a)
        except Exception as e:
            print(f"get_code error {short_addr(a)}: {e}")
            if a not in contracts:
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


def burn_score_mult_now() -> float:
    """Base 1 / $BITE, 2× during the 72h early-eater window if ACT_II_STARTED_AT is set."""
    if ACT_II_STARTED_AT > 0 and EARLY_EATER_BURN_MULT > 1:
        end = ACT_II_STARTED_AT + EARLY_EATER_HOURS * 3600
        if time.time() < end:
            return BURN_SCORE_MULT * EARLY_EATER_BURN_MULT
    return BURN_SCORE_MULT


def rescale_points_v2(state: dict) -> None:
    """Remap stored points onto buy 0.01 / sell 0.015 / burn 1.0 + scaled Act I.

    Wager points are added by backfill_wagers / apply_wager_events, not here —
    so a restart with score_scale already at v2_burn_lead_wager does not
    double-divide burns or re-apply the 0.001 side-bet.
    """
    prev = state.get("score_scale")
    if prev == SCORE_SCALE:
        return
    if prev == SCORE_SCALE_BURN_LEAD:
        return
    for entry in (state.get("points") or {}).values():
        if not isinstance(entry, dict):
            continue
        buy = float(entry.get("buy_points") or 0)
        sell = float(entry.get("sell_points") or 0)
        burn_pts = float(entry.get("burn_points") or 0)
        burned = float(entry.get("burned_bite") or 0)
        pts = float(entry.get("points") or 0)
        if prev == SCORE_SCALE_CENTI:
            remainder = pts - buy - sell - max(burn_pts, burned * CENTI_BURN_MULT)
            new_buy, new_sell = buy, sell
            new_burn = burned * BURN_SCORE_MULT
            new_pts = remainder * ACCUM_HOLD_SCALE + new_buy + new_sell + new_burn
        else:
            remainder = pts - buy - sell - max(burn_pts, burned * LEGACY_BURN_MULT)
            new_buy = buy * (BUY_SCORE_MULT / LEGACY_BUY_MULT) if LEGACY_BUY_MULT else 0
            new_sell = (
                sell * (SELL_SCORE_MULT / LEGACY_SELL_MULT) if LEGACY_SELL_MULT else 0
            )
            new_burn = burned * BURN_SCORE_MULT
            new_pts = remainder * ACCUM_HOLD_SCALE + new_buy + new_sell + new_burn
        entry["buy_points"] = new_buy
        entry["sell_points"] = new_sell
        entry["burn_points"] = new_burn
        entry["points"] = max(0.0, new_pts)
        if "accum_points" in entry:
            entry["accum_points"] = float(entry.get("accum_points") or 0) * ACCUM_HOLD_SCALE
        if "hold_points" in entry:
            entry["hold_points"] = float(entry.get("hold_points") or 0) * ACCUM_HOLD_SCALE
    state["score_scale"] = SCORE_SCALE_BURN_LEAD


def sync_burn_points_from_visible(state: dict) -> None:
    """Score every recorded kitchen burn at BURN_SCORE_MULT, including former dust."""
    if BURN_SCORE_MULT <= 0:
        return
    for entry in (state.get("points") or {}).values():
        if not isinstance(entry, dict):
            continue
        burned = float(entry.get("burned_bite") or 0)
        expected = burned * BURN_SCORE_MULT
        current = float(entry.get("burn_points") or 0)
        delta = expected - current
        if abs(delta) < 1e-6:
            continue
        entry["burn_points"] = expected
        entry["points"] = max(0.0, float(entry.get("points") or 0) + delta)


def public_leaderboard_payload(state: dict, *, limit: int | None = None) -> dict:
    """Sanitized rows for the site — wallets, points, trades only (no TG ids)."""
    ensure_dev_wallets(state)
    rescale_points_v2(state)
    sync_burn_points_from_visible(state)
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
        sell_count = int(entry.get("sell_count") or 0)
        burn_count = int(entry.get("burn_count") or 0)
        bal = int(entry.get("last_balance_raw") or 0)
        is_dev = is_dev_wallet(wallet_l, entry)
        ineligible = is_ineligible_wallet(wallet_l, entry)
        burned_bite = float(entry.get("burned_bite") or 0)
        wagered_bite = float(entry.get("wagered_bite") or 0)
        wager_count = int(entry.get("wager_count") or 0)
        # Prefer current holders; still keep traders / burners / wagerers / dev visible
        if (
            pts <= 0
            and trades <= 0
            and sell_count <= 0
            and burn_count <= 0
            and burned_bite <= 0
            and wagered_bite <= 0
            and wager_count <= 0
            and bal <= 0
            and not is_dev
        ):
            continue
        display = entry.get("wallet") or wallet_l
        rows.append(
            {
                "address": display,
                "score": round(pts, 4),
                "trades": trades,
                "sellCount": sell_count,
                "burnCount": burn_count,
                "burned": round(burned_bite, 4),
                "accumPoints": round(float(entry.get("accum_points") or 0), 4),
                "holdPoints": round(float(entry.get("hold_points") or 0), 4),
                "buyPoints": round(float(entry.get("buy_points") or 0), 4),
                "sellPoints": round(float(entry.get("sell_points") or 0), 4),
                "burnPoints": round(float(entry.get("burn_points") or 0), 4),
                "wagered": round(wagered_bite, 4),
                "wagerCount": wager_count,
                "wagerPoints": round(float(entry.get("wager_points") or 0), 4),
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
        "scoring": "act2" if PHASE >= 2 else "act1",
        "scoreScale": state.get("score_scale") or SCORE_SCALE,
        "tradeSideMode": state.get("trade_side_mode") or None,
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
            "circulatingSupply": supply_stats.get("eoa_held_bite") or 0,
            "contractHeldBite": supply_stats.get("contract_held_bite") or 0,
            "realisticallyBurnable": supply_stats.get("realistically_burnable") or 0,
            "totalSupply": supply_stats.get("total_supply") or 0,
            "totalBurned": supply_stats.get("total_burned") or 0,
            "holderCount": supply_stats.get("holder_count") or 0,
            "holdersEoa": supply_stats.get("holder_count") or 0,
            "allTimeRecipients": supply_stats.get("all_time_recipients") or 0,
            "bitePriceUsd": supply_stats.get("bite_price_usd"),
            "updatedAt": supply_stats.get("updated_at"),
        },
        "swapStats": _public_swap_stats(state),
        "eaters": rows,
    }


def _public_swap_stats(state: dict) -> dict:
    """Native in-app swap KPI for leaderboard /swap-stats consumers."""
    supply = state.get("supply_stats") or {}
    dex = (state.get("market") or {}).get("dexscreener") or {}
    bite_px = aapl_px = None
    try:
        bite_px = float(dex.get("priceUsd") or supply.get("bite_price_usd") or 0) or None
    except (TypeError, ValueError):
        pass
    try:
        aapl_px = float(supply.get("aapl_price_usd") or 0) or None
    except (TypeError, ValueError):
        pass
    return summarize_native_swaps(
        state, bite_price_usd=bite_px, aapl_price_usd=aapl_px
    )


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
    Score all activity wallets (trades/holders since launch):
      - Accumulation: +POINTS_PER_BITE_GAINED per whole $BITE balance increase
      - Holding: +1 pt per HOLD_BITE_PER_POINT_PER_HOUR $BITE held per hour
      Act II also scores buys (1×), sells (1.5×), burns (50×) via apply_trade_events.
    Decreases do not claw back points.
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
        sell_count = int(entry.get("sell_count") or 0)
        burn_count = int(entry.get("burn_count") or 0)
        bal = int(entry.get("last_balance_raw") or 0)
        is_dev = is_dev_wallet(wallet_l, entry)
        ineligible = is_ineligible_wallet(wallet_l, entry)
        if (
            pts <= 0
            and trades <= 0
            and sell_count <= 0
            and burn_count <= 0
            and bal <= 0
            and not is_dev
        ):
            continue
        display = entry.get("wallet") or wallet_l
        rows.append((display, pts, trades, ineligible, is_dev))
    rows.sort(key=lambda r: (1 if r[3] else 0, -r[1], -r[2]))
    if limit is None:
        return rows[:LEADERBOARD_TOP_N]
    if limit <= 0:
        return rows
    return rows[:limit]


class LogFetchError(Exception):
    """RPC eth_getLogs failed — caller must retry, not skip the range."""

    def __init__(self, message: str, *, rate_limited: bool = False):
        super().__init__(message)
        self.rate_limited = rate_limited


def _is_rate_limit_error(err: BaseException) -> bool:
    text = str(err).lower()
    return "429" in text or "too many requests" in text or "rate limit" in text


def fetch_transfer_logs(contract, from_block: int, to_block: int) -> list:
    if from_block > to_block:
        return []
    delays = (0, 3, 8, 15, 30, 45, 60)
    last_err: Exception | None = None
    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
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
                last_err = e
        except Exception as e:
            last_err = e
        if last_err is not None and not _is_rate_limit_error(last_err):
            print(f"Error fetching events {from_block}-{to_block}: {last_err}")
            raise LogFetchError(str(last_err)) from last_err
        print(
            f"[logs] rate-limited {from_block}-{to_block} "
            f"(attempt {attempt + 1}/{len(delays)})"
        )
    print(f"Error fetching events {from_block}-{to_block}: {last_err}")
    raise LogFetchError(str(last_err), rate_limited=True) from last_err


def fetch_transfer_logs_to(
    contract, from_block: int, to_block: int, to_addr: str
) -> list:
    """Transfer logs with `to` filtered — used to recount burns without a full scan."""
    if from_block > to_block:
        return []
    dest = Web3.to_checksum_address(to_addr) if Web3 else to_addr
    delays = (0, 3, 8, 15, 30, 45, 60)
    last_err: Exception | None = None
    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
        try:
            return list(
                contract.events.Transfer.get_logs(
                    from_block=from_block,
                    to_block=to_block,
                    argument_filters={"to": dest},
                )
            )
        except TypeError:
            try:
                return list(
                    contract.events.Transfer.get_logs(
                        fromBlock=from_block,
                        toBlock=to_block,
                        argument_filters={"to": dest},
                    )
                )
            except Exception as e:
                last_err = e
        except Exception as e:
            last_err = e
        if last_err is not None and not _is_rate_limit_error(last_err):
            print(
                f"Error fetching burn logs {from_block}-{to_block} to={dest}: {last_err}"
            )
            raise LogFetchError(str(last_err)) from last_err
        print(
            f"[logs] rate-limited burn {from_block}-{to_block} "
            f"(attempt {attempt + 1}/{len(delays)})"
        )
    print(f"Error fetching burn logs {from_block}-{to_block}: {last_err}")
    raise LogFetchError(str(last_err), rate_limited=True) from last_err


def iter_burn_logs(contract, from_block: int, to_block: int):
    """Yield (chunk_end, events) for Transfer → kitchen/dead/zero only."""
    if from_block > to_block:
        return
    dests = list(_burn_destinations())
    b = from_block
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= to_block:
        end = min(b + chunk - 1, to_block)
        try:
            events: list = []
            for dest in dests:
                events.extend(fetch_transfer_logs_to(contract, b, end, dest))
        except LogFetchError as e:
            if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                print(
                    f"[dust-burns] backing off 20s on {b}-{end}; keeping chunk={chunk}"
                )
                time.sleep(20)
                continue
            if chunk > 200 and end - b > 200:
                chunk = max(200, chunk // 2)
                print(
                    f"[dust-burns] shrinking chunk to {chunk} after error on {b}-{end}"
                )
                continue
            print(
                f"[dust-burns] giving up on {b}–{end}; not advancing past {b - 1}"
            )
            return
        yield end, events
        b = end + 1
        time.sleep(0.15)


def iter_transfer_logs(contract, from_block: int, to_block: int):
    """Yield (chunk_end, events). Stops before a range that cannot be fetched."""
    if from_block > to_block:
        return
    b = from_block
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= to_block:
        end = min(b + chunk - 1, to_block)
        try:
            events = fetch_transfer_logs(contract, b, end)
        except LogFetchError as e:
            if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                print(
                    f"[logs] backing off 20s on {b}-{end}; keeping chunk={chunk}"
                )
                time.sleep(20)
                continue
            if chunk > 200 and end - b > 200:
                chunk = max(200, chunk // 2)
                print(f"[logs] shrinking chunk to {chunk} after error on {b}-{end}")
                continue
            print(
                f"[logs] giving up on {b}–{end}; not advancing past {b - 1}"
            )
            return
        yield end, events
        b = end + 1
        time.sleep(0.35)


def _norm_hex(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "hex"):
        text = value.hex()
    else:
        text = str(value)
    text = text.lower()
    if not text.startswith("0x"):
        text = "0x" + text
    return text


def _topic_address(topic) -> str:
    raw = _norm_hex(topic)
    return "0x" + raw[-40:]


def _decode_int128_word(word: bytes) -> int:
    """ABI-encoded int128 is a 32-byte sign-extended word."""
    if len(word) < 32:
        word = word.rjust(32, b"\x00")
    value = int.from_bytes(word[:32], "big")
    if value >= 1 << 255:
        value -= 1 << 256
    return value


def v4_bite_swap_side(amount0: int) -> str | None:
    """Buy vs sell from a v4 Swap amount0 (BITE is token0).

    Uniswap v4 BalanceDelta is from the *caller's* perspective:
    +amount0 = caller received BITE = buy; −amount0 = caller paid BITE = sell.
    Swap.sender is the router/locker — the swapper is tx.from.
    """
    if amount0 > 0:
        return "buy"
    if amount0 < 0:
        return "sell"
    return None


def decode_v4_swap_log(log) -> dict | None:
    """Parse a PoolManager Swap log for the BITE/AAPL pool."""
    topics = log.get("topics") if isinstance(log, dict) else getattr(log, "topics", None)
    if not topics or len(topics) < 3:
        return None
    topic0 = _norm_hex(topics[0])
    if topic0 != V4_SWAP_TOPIC:
        return None
    pool = _norm_hex(topics[1])
    if pool != V4_POOL_ID:
        return None
    data = log.get("data") if isinstance(log, dict) else getattr(log, "data", b"")
    if isinstance(data, str):
        data = bytes.fromhex(data[2:] if data.startswith("0x") else data)
    elif not isinstance(data, (bytes, bytearray)):
        return None
    if len(data) < 64:
        return None
    amount0 = _decode_int128_word(data[0:32])
    amount1 = _decode_int128_word(data[32:64])
    tx_hash = _norm_hex(
        log.get("transactionHash") if isinstance(log, dict) else getattr(log, "transactionHash", "")
    )
    block = log.get("blockNumber") if isinstance(log, dict) else getattr(log, "blockNumber", 0)
    return {
        "tx_hash": tx_hash,
        "sender": _topic_address(topics[2]),
        "amount0": amount0,
        "amount1": amount1,
        "side": v4_bite_swap_side(amount0),
        "bite_amount": abs(amount0) / 10**18,
        "block": int(block or 0),
    }


def fetch_v4_swap_logs(w3, from_block: int, to_block: int) -> list:
    if not w3 or from_block > to_block:
        return []
    delays = (0, 3, 8, 15, 30, 45, 60)
    last_err: Exception | None = None
    params = {
        "fromBlock": from_block,
        "toBlock": to_block,
        "address": Web3.to_checksum_address(UNISWAP_POOL_MANAGER) if Web3 else UNISWAP_POOL_MANAGER,
        "topics": [V4_SWAP_TOPIC, V4_POOL_ID],
    }
    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
        try:
            return list(w3.eth.get_logs(params))
        except Exception as e:
            last_err = e
            if not _is_rate_limit_error(e):
                print(f"Error fetching v4 swaps {from_block}-{to_block}: {e}")
                raise LogFetchError(str(e)) from e
            print(
                f"[logs] rate-limited v4 swaps {from_block}-{to_block} "
                f"(attempt {attempt + 1}/{len(delays)})"
            )
    print(f"Error fetching v4 swaps {from_block}-{to_block}: {last_err}")
    raise LogFetchError(str(last_err), rate_limited=True) from last_err


def iter_v4_swap_logs(w3, from_block: int, to_block: int):
    """Yield (chunk_end, decoded swaps)."""
    if from_block > to_block:
        return
    b = from_block
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= to_block:
        end = min(b + chunk - 1, to_block)
        try:
            raw = fetch_v4_swap_logs(w3, b, end)
        except LogFetchError as e:
            if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                print(f"[v4-swaps] backing off 20s on {b}-{end}")
                time.sleep(20)
                continue
            if chunk > 200 and end - b > 200:
                chunk = max(200, chunk // 2)
                print(f"[v4-swaps] shrinking chunk to {chunk} after error on {b}-{end}")
                continue
            print(f"[v4-swaps] giving up on {b}–{end}; not advancing past {b - 1}")
            return
        decoded = []
        for log in raw:
            item = decode_v4_swap_log(log)
            if item and item.get("side"):
                decoded.append(item)
        yield end, decoded
        b = end + 1
        time.sleep(0.2)


def resolve_swapper(w3, tx_hash: str, cache: dict) -> str | None:
    key = _norm_hex(tx_hash)
    if key in cache:
        return cache[key]
    if not w3 or not key:
        return None
    try:
        tx = w3.eth.get_transaction(key)
        sender = (tx.get("from") if isinstance(tx, dict) else tx["from"]).lower()
    except Exception as e:
        print(f"[v4-swaps] get_transaction {key[:12]}…: {e}")
        sender = None
    cache[key] = sender
    return sender


def _empty_side_tally() -> dict:
    return {"buys": 0, "sells": 0, "buy_pts": 0.0, "sell_pts": 0.0}


def _tally_side(dest: dict, wallet: str, side: str, bite_amount: float) -> None:
    if side not in ("buy", "sell") or bite_amount <= 0:
        return
    row = dest.setdefault(wallet.lower(), _empty_side_tally())
    if side == "buy":
        row["buys"] = int(row.get("buys") or 0) + 1
        if PHASE >= 1 and BUY_SCORE_MULT > 0:
            row["buy_pts"] = float(row.get("buy_pts") or 0) + bite_amount * BUY_SCORE_MULT
    else:
        row["sells"] = int(row.get("sells") or 0) + 1
        if PHASE >= 1 and SELL_SCORE_MULT > 0:
            row["sell_pts"] = float(row.get("sell_pts") or 0) + bite_amount * SELL_SCORE_MULT


def _credit_side_live(state: dict, wallet: str, side: str, bite_amount: float) -> None:
    entry = points_entry(state, wallet)
    entry["wallet"] = entry.get("wallet") or (
        Web3.to_checksum_address(wallet) if Web3 else wallet
    )
    if side == "buy":
        entry["trade_count"] = int(entry.get("trade_count") or 0) + 1
        if PHASE >= 1 and BUY_SCORE_MULT > 0:
            pts = bite_amount * BUY_SCORE_MULT
            entry["buy_points"] = float(entry.get("buy_points") or 0) + pts
            entry["points"] = float(entry.get("points") or 0) + pts
    elif side == "sell":
        entry["sell_count"] = int(entry.get("sell_count") or 0) + 1
        if PHASE >= 1 and SELL_SCORE_MULT > 0:
            pts = bite_amount * SELL_SCORE_MULT
            entry["sell_points"] = float(entry.get("sell_points") or 0) + pts
            entry["points"] = float(entry.get("points") or 0) + pts


def apply_v4_swap_events(
    state: dict,
    swaps,
    *,
    w3=None,
    pending: dict | None = None,
    tx_cache: dict | None = None,
) -> int:
    """Score v4 swaps for the actual swapper (tx.from), not Swap.sender."""
    cache = tx_cache if tx_cache is not None else {}
    hits = 0
    excluded = _excluded_board_addrs(state)
    for item in swaps:
        side = item.get("side")
        bite_amount = float(item.get("bite_amount") or 0)
        if side not in ("buy", "sell") or bite_amount <= 0:
            continue
        swapper = item.get("swapper") or resolve_swapper(w3, item.get("tx_hash") or "", cache)
        if not swapper:
            continue
        swapper_l = swapper.lower()
        if swapper_l in excluded and swapper_l not in DEV_WALLETS:
            continue
        item["swapper"] = swapper_l
        if pending is not None:
            _tally_side(pending, swapper_l, side, bite_amount)
        else:
            _credit_side_live(state, swapper_l, side, bite_amount)
        hits += 1
    return hits


def _strip_buy_sell_keep_burns(entry: dict) -> None:
    """Drop buy/sell tallies and points. Leave kitchen burns untouched."""
    buy_pts = float(entry.get("buy_points") or 0)
    sell_pts = float(entry.get("sell_points") or 0)
    pts = float(entry.get("points") or 0)
    entry["points"] = max(0.0, pts - buy_pts - sell_pts)
    entry["trade_count"] = 0
    entry["sell_count"] = 0
    entry["buy_points"] = 0.0
    entry["sell_points"] = 0.0


def commit_pending_sides(state: dict, pending: dict) -> None:
    """Replace buy/sell with remapped tallies. Idempotent. Burns stay."""
    for entry in (state.get("points") or {}).values():
        if isinstance(entry, dict):
            _strip_buy_sell_keep_burns(entry)
    for wallet, tally in (pending or {}).items():
        if not isinstance(tally, dict):
            continue
        entry = points_entry(state, wallet)
        buy_n = int(tally.get("buys") or 0)
        sell_n = int(tally.get("sells") or 0)
        buy_pts = float(tally.get("buy_pts") or 0)
        sell_pts = float(tally.get("sell_pts") or 0)
        entry["trade_count"] = buy_n
        entry["sell_count"] = sell_n
        entry["buy_points"] = buy_pts
        entry["sell_points"] = sell_pts
        entry["points"] = float(entry.get("points") or 0) + buy_pts + sell_pts


def apply_trade_events(
    state: dict,
    events,
    tracked: set[str] | None = None,
    *,
    w3=None,
    skip_tx_hashes: set[str] | None = None,
    pending: dict | None = None,
) -> int:
    """Score and count buys, sells, and burns from Transfer events.

    Buy = contract → EOA: +1 trade_count, +BUY_SCORE_MULT × BITE amount
    Sell = EOA → contract: +1 sell_count, +SELL_SCORE_MULT × BITE amount
    Burn = EOA → kitchen/dead/zero: +1 burn_count, burned_bite += amount
      (kitchen.bite(), sweep-to-kitchen, and token.burn() / dead).
      Contract→kitchen (digest) is skipped.
      Points: +BURN_SCORE_MULT × BITE when the burn meets $MIN_BURN_SCORE_USD
      (default 0 — all kitchen burns score). Telegram still uses MIN_BURN_USD.

    skip_tx_hashes: v4 Swap txs — buy/sell come from amount0, not Transfer hops.
    pending: tally buy/sell into this dict instead of live points (remap).
    Burns are never written to pending (historical burns stay on the row).

    tracked=None → count every eligible address.
    Returns total scored events.
    """
    hits = 0
    zero = ZERO_ADDRESS.lower()
    burn_dests = _burn_destinations()
    skip_txs = {_norm_hex(h) for h in (skip_tx_hashes or set()) if h}
    remap_only = pending is not None
    contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
    if w3 is not None:
        discovered = set()
        for event in events:
            discovered.add(event.args["from"].lower())
            discovered.add(event.args["to"].lower())
        classify_contracts(w3, discovered, state)
        contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
    excluded = _excluded_board_addrs(state)
    for event in events:
        to_addr = event.args["to"]
        from_addr = event.args["from"]
        value = int(event.args["value"])
        to_l = to_addr.lower()
        from_l = from_addr.lower()
        if from_l == zero or value <= 0:
            continue
        bite_amount = value / 10**18
        tx_hash = _norm_hex(getattr(event, "transactionHash", None))

        wager_l = (META_WAGER_CONTRACT or "").lower()
        # MetaWager stake / fee / claim are not buys or sells. BetPlaced scores
        # the EOA who entered; payouts are not a bite.
        if wager_l and (to_l == wager_l or from_l == wager_l):
            continue

        # Burn before the contract-exclusion skip so kitchen (a contract) counts.
        if to_l in burn_dests:
            if remap_only:
                continue
            if from_l in contracts and from_l not in DEV_WALLETS:
                continue  # contract-to-kitchen (digest), not a user burn
            if tracked is not None and from_l not in tracked:
                continue
            entry = points_entry(state, from_addr)
            entry["burn_count"] = int(entry.get("burn_count") or 0) + 1
            entry["burned_bite"] = float(entry.get("burned_bite") or 0) + bite_amount
            entry["wallet"] = entry.get("wallet") or (
                Web3.to_checksum_address(from_addr) if Web3 else from_addr
            )
            if (
                _meets_usd_threshold(
                    value, state, MIN_BURN_SCORE_USD, MIN_BURN_SCORE_RAW
                )
                and PHASE >= 1
                and burn_score_mult_now() > 0
            ):
                burn_pts = bite_amount * burn_score_mult_now()
                entry["burn_points"] = float(entry.get("burn_points") or 0) + burn_pts
                entry["points"] = float(entry.get("points") or 0) + burn_pts
            hits += 1
            continue

        if tx_hash and tx_hash in skip_txs:
            continue

        # Sell before the contract-exclusion skip. Destinations are contracts
        # (routers/LP), which are excluded from the board as *rows* but must
        # still credit the seller.
        if from_l not in contracts and to_l in contracts:
            if tracked is not None and from_l not in tracked:
                continue
            if remap_only:
                _tally_side(pending, from_l, "sell", bite_amount)
            else:
                _credit_side_live(state, from_addr, "sell", bite_amount)
            hits += 1
            continue

        if to_l in excluded:
            continue

        # Buy: contract → EOA (or DEV)
        if from_l in contracts and (to_l not in contracts or to_l in DEV_WALLETS):
            if tracked is not None and to_l not in tracked:
                continue
            if remap_only:
                _tally_side(pending, to_l, "buy", bite_amount)
            else:
                _credit_side_live(state, to_addr, "buy", bite_amount)
            hits += 1
            continue
    return hits


def _reset_trade_score_fields(entry: dict) -> None:
    """Drop buy/sell/burn tallies before a full recount. Keep accum/hold."""
    buy_pts = float(entry.get("buy_points") or 0)
    sell_pts = float(entry.get("sell_points") or 0)
    burn_pts = float(entry.get("burn_points") or 0)
    pts = float(entry.get("points") or 0)
    entry["points"] = max(0.0, pts - buy_pts - sell_pts - burn_pts)
    entry["trade_count"] = 0
    entry["sell_count"] = 0
    entry["burn_count"] = 0
    entry["burned_bite"] = 0.0
    entry["buy_points"] = 0.0
    entry["sell_points"] = 0.0
    entry["burn_points"] = 0.0


def backfill_trades(w3, contract, state: dict, *, force: bool = False) -> dict:
    """
    Recount EOA buys, sells, and burns from TRADE_SCAN_FROM_BLOCK → tip.
    Runs when trades_backfilled_from / trade_index_mode are stale (or force=True).
    """
    ensure_dev_wallets(state)
    if not w3 or not contract:
        return state
    already = int(state.get("trades_backfilled_from") or 0)
    mode = state.get("trade_index_mode")
    # v4 on disk can be a skipped pass (mode flipped without 7702 reclassify).
    if (
        not force
        and already == TRADE_SCAN_FROM_BLOCK
        and mode == TRADE_INDEX_MODE
        and state.get("trade_index_7702")
    ):
        return state

    tip = int(w3.eth.block_number)
    start = max(0, TRADE_SCAN_FROM_BLOCK)
    # Resume only an interrupted current-mode recount. Do not reuse last_block
    # (v3 leaves that near tip, which would skip the whole v4 pass).
    cursor = int(state.get("trade_index_cursor") or 0)
    resume = (
        not force
        and state.get("trade_index_building") == TRADE_INDEX_MODE
        and mode != TRADE_INDEX_MODE
        and cursor >= start
        and cursor < tip
        and int(state.get("trades_backfilled_from") or 0) == TRADE_SCAN_FROM_BLOCK
    )
    scan_from = cursor + 1 if resume else start
    if scan_from > tip:
        if mode == TRADE_INDEX_MODE:
            return state
        scan_from = start
        resume = False
    print(
        f"[backfill] {'resuming' if resume else 'recounting'} EOA buys/sells/burns "
        f"from block {scan_from} → {tip} (mode={TRADE_INDEX_MODE}, chunk={LOG_CHUNK_SIZE})"
    )

    sync_dexscreener(state)

    # Seed contract cache from known activity, then classify
    seed = set(activity_wallet_set(state))
    for a in state.get("known_holders") or []:
        if isinstance(a, str):
            seed.add(a.lower())
    if KITCHEN_CONTRACT:
        seed.add(KITCHEN_CONTRACT.lower())
    for a in (
        "0x8366a39cc670b4001a1121b8f6a443a643e40951",
        "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044",
        "0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f",
        "0x8f10b468b06c6fd214b65f87778827f7d113f996",
    ):
        seed.add(a)
    classify_contracts(w3, seed, state, recheck=False)
    # Recheck cached contracts so v3 EIP-7702 false-positives become EOAs.
    if not resume:
        cached_contracts = {
            a.lower()
            for a in (state.get("contract_addrs") or [])
            if isinstance(a, str)
        }
        if cached_contracts:
            print(
                f"[backfill] rechecking {len(cached_contracts)} cached contracts "
                "for EIP-7702"
            )
            classify_contracts(w3, cached_contracts, state, recheck=True)

    if not resume:
        state["trade_index_building"] = TRADE_INDEX_MODE
        state["trade_index_cursor"] = scan_from - 1
        for _wallet_l, entry in (state.get("points") or {}).items():
            if isinstance(entry, dict):
                _reset_trade_score_fields(entry)
        save_state(state)

    total_events = 0
    total_hits = 0
    scanned_to = scan_from - 1
    chunks_done = 0
    burn_dests = _burn_destinations()
    for end, events in iter_transfer_logs(contract, scan_from, tip):
        total_events += len(events)
        total_hits += apply_trade_events(state, events, tracked=None, w3=w3)
        known = set(a.lower() for a in (state.get("known_holders") or []))
        contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
        for event in events:
            to_l = event.args["to"].lower()
            from_l = event.args["from"].lower()
            if to_l in burn_dests:
                if from_l not in contracts or from_l in DEV_WALLETS:
                    known.add(from_l)
            elif to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower()):
                if to_l not in contracts or to_l in DEV_WALLETS:
                    known.add(to_l)
        state["known_holders"] = list(known)
        scanned_to = end
        state["trade_index_cursor"] = end
        chunks_done += 1
        span = max(1, tip - start)
        if chunks_done == 1 or chunks_done % 5 == 0 or end >= tip:
            pct = 100.0 * (end - start + 1) / span
            print(
                f"[backfill] {end}/{tip} ({pct:.1f}%) "
                f"events={total_events} hits={total_hits}"
            )
            save_state(state)

    if scanned_to < tip:
        print(
            f"[backfill] incomplete ({scanned_to} < tip {tip}) — "
            "not flipping trade_index_mode; rerun to finish"
        )
        if scanned_to >= scan_from:
            state["trade_index_cursor"] = scanned_to
            save_state(state)
        return state

    state["trades_backfilled_from"] = TRADE_SCAN_FROM_BLOCK
    state["trade_from_block"] = TRADE_SCAN_FROM_BLOCK
    state["trade_index_mode"] = TRADE_INDEX_MODE
    state["trade_index_7702"] = True
    state.pop("trade_index_building", None)
    state.pop("trade_index_cursor", None)
    state["trader_count"] = len(
        {
            k
            for k, e in (state.get("points") or {}).items()
            if isinstance(e, dict)
            and int(e.get("trade_count") or 0) > 0
            and k.lower() not in {a.lower() for a in (state.get("contract_addrs") or [])}
        }
    )
    state["last_block"] = scanned_to
    sync_market_sources(state, contract=contract)
    sync_supply_stats(state, w3=w3, contract=contract)
    write_public_leaderboard(state)
    save_state(state)
    print(
        f"[backfill] done: {total_events} transfers scanned, "
        f"{total_hits} scored events, "
        f"{state.get('trader_count')} unique traders, "
        f"{state.get('holder_count')} EOA holders "
        f"({all_time_recipients(state)} all-time recipients), "
        f"last_block={scanned_to}"
    )
    return state


def backfill_burn_visibility(w3, contract, state: dict) -> dict:
    """Re-sum ALL user burns into burn_count / burned_bite without touching points.

    v4 skipped kitchen.bite() under MIN_BURN_USD entirely. This pass fills those
    in so the board can show dust participation. Scored burns keep their points.
    Scans TRADE_SCAN_FROM_BLOCK → last_block (already-indexed range) so a later
    poll from last_block+1 does not double-count. Does not bump TRADE_INDEX_MODE.
    """
    if not w3 or not contract:
        return state
    if state.get("dust_burn_index_mode") == DUST_BURN_INDEX_MODE:
        return state
    if state.get("trade_index_mode") != TRADE_INDEX_MODE or not state.get(
        "trade_index_7702"
    ):
        return state
    end = int(state.get("last_block") or 0)
    start = max(0, TRADE_SCAN_FROM_BLOCK)
    if end < start:
        return state

    cursor = int(state.get("dust_burn_cursor") or (start - 1))
    totals = state.get("dust_burn_totals")
    if not isinstance(totals, dict):
        totals = {}
    scan_from = cursor + 1 if cursor >= start - 1 else start
    if scan_from > end:
        scan_from = start
        totals = {}

    print(
        f"[dust-burns] summing kitchen/dead/zero burns {scan_from} → {end} "
        f"(visibility + score; TG floor ${MIN_BURN_USD:.0f})"
    )

    seed = set(activity_wallet_set(state))
    for a in state.get("known_holders") or []:
        if isinstance(a, str):
            seed.add(a.lower())
    if KITCHEN_CONTRACT:
        seed.add(KITCHEN_CONTRACT.lower())
    classify_contracts(w3, seed, state, recheck=False)
    cached_contracts = {
        a.lower()
        for a in (state.get("contract_addrs") or [])
        if isinstance(a, str)
    }
    if cached_contracts and not state.get("dust_burn_cursor"):
        classify_contracts(w3, cached_contracts, state, recheck=True)

    zero = ZERO_ADDRESS.lower()
    burn_dests = _burn_destinations()
    scanned_to = scan_from - 1
    chunks_done = 0
    hits = 0
    for chunk_end, events in iter_burn_logs(contract, scan_from, end):
        contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
        pending = set()
        for event in events:
            pending.add(event.args["from"].lower())
            pending.add(event.args["to"].lower())
        if pending:
            classify_contracts(w3, pending, state)
            contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
        for event in events:
            to_l = event.args["to"].lower()
            from_l = event.args["from"].lower()
            value = int(event.args["value"])
            if to_l not in burn_dests or from_l == zero or value <= 0:
                continue
            if from_l in contracts and from_l not in DEV_WALLETS:
                continue
            bite_amount = value / 10**18
            slot = totals.get(from_l)
            if not isinstance(slot, dict):
                wallet = event.args["from"]
                slot = {
                    "count": 0,
                    "amount": 0.0,
                    "wallet": (
                        Web3.to_checksum_address(wallet) if Web3 else wallet
                    ),
                }
            slot["count"] = int(slot.get("count") or 0) + 1
            slot["amount"] = float(slot.get("amount") or 0) + bite_amount
            totals[from_l] = slot
            hits += 1
        scanned_to = chunk_end
        state["dust_burn_cursor"] = chunk_end
        state["dust_burn_totals"] = totals
        chunks_done += 1
        if chunks_done == 1 or chunks_done % 5 == 0 or chunk_end >= end:
            span = max(1, end - start + 1)
            pct = 100.0 * (chunk_end - start + 1) / span
            print(
                f"[dust-burns] {chunk_end}/{end} ({pct:.1f}%) "
                f"burn-events={hits} wallets={len(totals)}"
            )
            save_state(state)

    if scanned_to < end:
        print(
            f"[dust-burns] incomplete ({scanned_to} < {end}) — rerun to finish"
        )
        save_state(state)
        return state

    seen = set()
    for addr_l, slot in totals.items():
        if not isinstance(slot, dict):
            continue
        wallet = slot.get("wallet") or addr_l
        entry = points_entry(state, wallet)
        entry["burn_count"] = int(slot.get("count") or 0)
        entry["burned_bite"] = float(slot.get("amount") or 0)
        seen.add(addr_l.lower())
    for wallet_l, entry in (state.get("points") or {}).items():
        if not isinstance(entry, dict):
            continue
        if wallet_l.lower() in seen:
            continue
        entry["burn_count"] = 0
        entry["burned_bite"] = 0.0

    state["dust_burn_index_mode"] = DUST_BURN_INDEX_MODE
    state.pop("dust_burn_cursor", None)
    state.pop("dust_burn_totals", None)
    write_public_leaderboard(state)
    save_state(state)
    print(
        f"[dust-burns] done: {len(seen)} wallets with burns, "
        f"{hits} burn events (points unchanged)"
    )
    return state


def _wager_contract(w3):
    if not w3 or not Web3 or not META_WAGER_CONTRACT:
        return None
    try:
        return w3.eth.contract(
            address=Web3.to_checksum_address(META_WAGER_CONTRACT),
            abi=META_WAGER_ABI,
        )
    except Exception as e:
        print(f"[wager] contract init error: {e}")
        return None


def fetch_wager_logs(wager, from_block: int, to_block: int) -> list:
    if from_block > to_block or wager is None:
        return []
    delays = (0, 3, 8, 15, 30, 45, 60)
    last_err: Exception | None = None
    for attempt, delay in enumerate(delays):
        if delay:
            time.sleep(delay)
        try:
            return list(
                wager.events.BetPlaced.get_logs(
                    from_block=from_block,
                    to_block=to_block,
                )
            )
        except TypeError:
            try:
                return list(
                    wager.events.BetPlaced.get_logs(
                        fromBlock=from_block,
                        toBlock=to_block,
                    )
                )
            except Exception as e:
                last_err = e
        except Exception as e:
            last_err = e
        if last_err is not None and not _is_rate_limit_error(last_err):
            print(
                f"[wager] error fetching BetPlaced {from_block}-{to_block}: {last_err}"
            )
            raise LogFetchError(str(last_err)) from last_err
        print(
            f"[wager] rate-limited BetPlaced {from_block}-{to_block} "
            f"(attempt {attempt + 1}/{len(delays)})"
        )
    print(f"[wager] error fetching BetPlaced {from_block}-{to_block}: {last_err}")
    raise LogFetchError(str(last_err), rate_limited=True) from last_err


def iter_wager_logs(wager, from_block: int, to_block: int):
    if from_block > to_block or wager is None:
        return
    b = from_block
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= to_block:
        end = min(b + chunk - 1, to_block)
        try:
            events = fetch_wager_logs(wager, b, end)
        except LogFetchError as e:
            if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                print(f"[wager] backing off 20s on {b}-{end}")
                time.sleep(20)
                continue
            if chunk > 200 and end - b > 200:
                chunk = max(200, chunk // 2)
                print(f"[wager] shrinking chunk to {chunk} after error on {b}-{end}")
                continue
            print(f"[wager] giving up on {b}–{end}; not advancing past {b - 1}")
            return
        yield end, events
        b = end + 1
        time.sleep(0.1)


def apply_wager_events(state: dict, events, *, w3=None, undo_sells: bool = False) -> int:
    """Score BetPlaced on the EOA who entered. Gross stake = net + 10% entry fee.

    0.001 pts / $BITE staked — a side bet, not a bite. Contracts are skipped
    (7702 delegated EOAs still count). If the stake was previously indexed as a
    sell (EOA → MetaWager Transfer), undo that sell so it is not double-counted.
    """
    if WAGER_SCORE_MULT <= 0:
        return 0
    hits = 0
    pending = set()
    parsed: list[tuple[str, float]] = []
    for event in events:
        try:
            bettor = event.args["bettor"]
            net = int(event.args["netAmount"])
            fee = int(event.args["fee"])
        except Exception:
            continue
        if not bettor:
            continue
        gross_raw = net + fee
        if gross_raw <= 0:
            continue
        pending.add(bettor.lower())
        parsed.append((bettor, gross_raw / 10**18))
    if w3 is not None and pending:
        classify_contracts(w3, pending, state)
    contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
    for bettor, gross in parsed:
        bettor_l = bettor.lower()
        if bettor_l in contracts and bettor_l not in DEV_WALLETS:
            continue
        entry = points_entry(state, bettor)
        entry["wallet"] = entry.get("wallet") or (
            Web3.to_checksum_address(bettor) if Web3 else bettor
        )
        if undo_sells:
            sell_pts = gross * SELL_SCORE_MULT
            have = float(entry.get("sell_points") or 0)
            take = min(sell_pts, have)
            if take > 0:
                entry["sell_points"] = have - take
                entry["points"] = max(0.0, float(entry.get("points") or 0) - take)
            sc = int(entry.get("sell_count") or 0)
            if sc > 0:
                entry["sell_count"] = sc - 1
        entry["wager_count"] = int(entry.get("wager_count") or 0) + 1
        entry["wagered_bite"] = float(entry.get("wagered_bite") or 0) + gross
        wager_pts = gross * WAGER_SCORE_MULT
        entry["wager_points"] = float(entry.get("wager_points") or 0) + wager_pts
        entry["points"] = float(entry.get("points") or 0) + wager_pts
        hits += 1
    return hits


def backfill_wagers(w3, state: dict) -> dict:
    """Index all MetaWager BetPlaced events. Does not bump TRADE_INDEX_MODE."""
    if state.get("wager_index_mode") == WAGER_INDEX_MODE:
        if state.get("score_scale") != SCORE_SCALE:
            state["score_scale"] = SCORE_SCALE
        return state
    if not META_WAGER_CONTRACT:
        state["wager_index_mode"] = WAGER_INDEX_MODE
        state["score_scale"] = SCORE_SCALE
        return state
    wager = _wager_contract(w3)
    if wager is None:
        print("[wager] contract unavailable — will retry")
        return state
    rescale_points_v2(state)
    # Flip scale before scoring bets so HTTP/client remap cannot double-add
    # wagered * 0.001 on top of points the bot is about to credit.
    state["score_scale"] = SCORE_SCALE
    end = int(state.get("last_block") or 0)
    if end <= 0 and w3:
        try:
            end = int(w3.eth.block_number)
        except Exception:
            end = 0
    start = max(TRADE_SCAN_FROM_BLOCK, 64_490_000)
    if end < start:
        print(f"[wager] wait for last_block ({end}) to pass {start}")
        return state

    cursor = int(state.get("wager_cursor") or (start - 1))
    scan_from = cursor + 1
    if scan_from > end:
        state["wager_index_mode"] = WAGER_INDEX_MODE
        state["score_scale"] = SCORE_SCALE
        state.pop("wager_cursor", None)
        write_public_leaderboard(state)
        save_state(state)
        print(f"[wager] already scanned through {end}; scale={SCORE_SCALE}")
        return state

    print(
        f"[wager] indexing BetPlaced {scan_from} → {end} "
        f"(+{WAGER_SCORE_MULT} pts / $BITE staked on entry)"
    )
    scanned_to = scan_from - 1
    hits = 0
    for chunk_end, events in iter_wager_logs(wager, scan_from, end):
        hits += apply_wager_events(state, events, w3=w3, undo_sells=True)
        scanned_to = chunk_end
        state["wager_cursor"] = chunk_end
        save_state(state)

    if scanned_to < end:
        print(f"[wager] incomplete ({scanned_to} < {end}) — rerun to finish")
        save_state(state)
        return state

    state["wager_index_mode"] = WAGER_INDEX_MODE
    state["score_scale"] = SCORE_SCALE
    state.pop("wager_cursor", None)
    write_public_leaderboard(state)
    save_state(state)
    print(f"[wager] done: {hits} BetPlaced scored, scale={SCORE_SCALE}")
    return state


def backfill_v4_swap_sides(w3, contract, state: dict) -> dict:
    """Remap buy/sell from v4 Swap amount0 + leftover Transfer hops.

    Does not bump TRADE_INDEX_MODE and does not touch burn_count / burned_bite
    / burn_points. Commit is idempotent so a crash mid-replace cannot double-score.
    """
    pending = state.get("trade_side_pending")
    if state.get("trade_side_mode") == TRADE_SIDE_MODE and not pending:
        return state
    if not w3:
        return state
    if state.get("trade_index_mode") != TRADE_INDEX_MODE or not state.get(
        "trade_index_7702"
    ):
        return state

    if state.get("trade_side_mode") == TRADE_SIDE_MODE and isinstance(pending, dict):
        commit_pending_sides(state, pending)
        state.pop("trade_side_pending", None)
        state.pop("trade_side_cursor", None)
        state.pop("trade_side_tx_cache", None)
        write_public_leaderboard(state)
        save_state(state)
        print(f"[v4-side] finished interrupted commit ({TRADE_SIDE_MODE})")
        return state

    end = int(state.get("last_block") or 0)
    if end <= 0:
        try:
            end = int(w3.eth.block_number)
        except Exception:
            end = 0
    start = max(0, TRADE_SCAN_FROM_BLOCK)
    if end < start:
        print(f"[v4-side] wait for last_block ({end}) to pass {start}")
        return state

    if not isinstance(pending, dict):
        pending = {}
        state["trade_side_pending"] = pending
        state["trade_side_cursor"] = start - 1
        save_state(state)

    cursor = int(state.get("trade_side_cursor") or (start - 1))
    scan_from = cursor + 1 if cursor >= start - 1 else start
    if scan_from > end:
        state["trade_side_mode"] = TRADE_SIDE_MODE
        commit_pending_sides(state, pending)
        state.pop("trade_side_pending", None)
        state.pop("trade_side_cursor", None)
        write_public_leaderboard(state)
        save_state(state)
        print(f"[v4-side] already scanned through {end}; mode={TRADE_SIDE_MODE}")
        return state

    print(
        f"[v4-side] remapping buy/sell from Swap amount0 {scan_from} → {end} "
        f"(token0=BITE, +amount0=buy, burns kept, mode={TRADE_SIDE_MODE})"
    )
    tx_cache = {}
    scanned_to = scan_from - 1
    swap_hits = 0
    xfer_hits = 0
    chunks_done = 0
    b = scan_from
    chunk = max(200, LOG_CHUNK_SIZE)
    while b <= end:
        chunk_end = min(b + chunk - 1, end)
        try:
            raw_swaps = fetch_v4_swap_logs(w3, b, chunk_end)
            transfers = fetch_transfer_logs(contract, b, chunk_end) if contract else []
        except LogFetchError as e:
            if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                print(f"[v4-side] backing off 20s on {b}-{chunk_end}")
                time.sleep(20)
                continue
            if chunk > 200 and chunk_end - b > 200:
                chunk = max(200, chunk // 2)
                print(f"[v4-side] shrinking chunk to {chunk} after error on {b}-{chunk_end}")
                continue
            print(f"[v4-side] giving up on {b}–{chunk_end}; not advancing past {b - 1}")
            save_state(state)
            return state
        swaps = []
        skip_txs: set[str] = set()
        for log in raw_swaps:
            item = decode_v4_swap_log(log)
            if item and item.get("side"):
                swaps.append(item)
                if item.get("tx_hash"):
                    skip_txs.add(item["tx_hash"])
        swap_hits += apply_v4_swap_events(
            state, swaps, w3=w3, pending=pending, tx_cache=tx_cache
        )
        xfer_hits += apply_trade_events(
            state, transfers, tracked=None, w3=w3, skip_tx_hashes=skip_txs, pending=pending
        )
        scanned_to = chunk_end
        state["trade_side_pending"] = pending
        state["trade_side_cursor"] = chunk_end
        chunks_done += 1
        if chunks_done == 1 or chunks_done % 5 == 0 or chunk_end >= end:
            span = max(1, end - start + 1)
            pct = 100.0 * (chunk_end - start + 1) / span
            print(
                f"[v4-side] {chunk_end}/{end} ({pct:.1f}%) "
                f"swaps={swap_hits} transfer_sides={xfer_hits} wallets={len(pending)}"
            )
            save_state(state)
        b = chunk_end + 1
        time.sleep(0.2)

    if scanned_to < end:
        print(f"[v4-side] incomplete ({scanned_to} < {end}) — rerun to finish")
        save_state(state)
        return state

    state["trade_side_mode"] = TRADE_SIDE_MODE
    commit_pending_sides(state, pending)
    state.pop("trade_side_pending", None)
    state.pop("trade_side_cursor", None)
    write_public_leaderboard(state)
    save_state(state)
    print(
        f"[v4-side] done: {swap_hits} v4 swaps + {xfer_hits} non-v4 transfers, "
        f"{len(pending)} wallets, burns kept, mode={TRADE_SIDE_MODE}"
    )
    return state


def native_swap_fee_senders() -> set[str]:
    """Addresses that PAY_PORTION integrator fees to kitchen on native swaps."""
    return {a.lower() for a in _NATIVE_SWAP_FEE_SENDERS}


def backfill_native_swaps(w3, bite_contract, state: dict) -> dict:
    """Index Transfer→kitchen from UR/locker as native-swap fee skims (BITE + AAPL).

    Incremental cursor in state['native_swaps']['cursor']. Safe to re-run;
    record_native_swap dedupes by tx hash. Wallet = tx.from (cached).
    """
    if not w3 or not Web3 or not bite_contract or not KITCHEN_CONTRACT:
        return state
    ns = ensure_native_swaps(state)
    tip = int(w3.eth.block_number)
    start = max(TRADE_SCAN_FROM_BLOCK, int(ns.get("cursor") or 0) + 1)
    if start > tip:
        ns["mode"] = NATIVE_SWAP_INDEX_MODE
        return state

    fee_senders = native_swap_fee_senders()
    # Buy-recipient inference needs protocol/contract set; fee filter stays narrow.
    contracts = {a.lower() for a in (state.get("contract_addrs") or [])} | set(
        _DEFAULT_PROTOCOL_ADDRS
    )
    tx_cache: dict = {}
    lookup = make_tx_from_lookup(w3, tx_cache)

    aapl_c = None
    if AAPL_TOKEN:
        try:
            aapl_c = w3.eth.contract(
                address=Web3.to_checksum_address(AAPL_TOKEN),
                abi=ERC20_ABI,
            )
        except Exception as e:
            print(f"[native-swap] AAPL contract init failed: {e}")

    print(
        f"[native-swap] indexing fee skims {start} → {tip} "
        f"(mode={NATIVE_SWAP_INDEX_MODE}, senders={len(fee_senders)})"
    )
    b = start
    chunk = max(200, LOG_CHUNK_SIZE)
    scanned_to = start - 1
    bite_hits = aapl_hits = 0
    chunks_done = 0
    while b <= tip:
        end = min(b + chunk - 1, tip)
        try:
            bite_ev = fetch_transfer_logs_to(
                bite_contract, b, end, KITCHEN_CONTRACT
            )
            aapl_ev = []
            if aapl_c is not None:
                aapl_ev = fetch_transfer_logs_to(aapl_c, b, end, KITCHEN_CONTRACT)
        except LogFetchError as e:
            if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                time.sleep(20)
                continue
            if chunk > 200 and end - b > 200:
                chunk = max(200, chunk // 2)
                continue
            print(f"[native-swap] giving up on {b}–{end}: {e}")
            break
        bite_hits += note_fee_skims_from_bite_transfers(
            state,
            bite_ev,
            kitchen=KITCHEN_CONTRACT,
            protocol_addrs=fee_senders,
            contract_addrs=contracts,
            tx_from_lookup=lookup,
        )
        aapl_hits += note_fee_skims_from_aapl_transfers(
            state,
            aapl_ev,
            kitchen=KITCHEN_CONTRACT,
            protocol_addrs=fee_senders,
            tx_from_lookup=lookup,
        )
        scanned_to = end
        ns["cursor"] = end
        chunks_done += 1
        if chunks_done == 1 or chunks_done % 10 == 0 or end >= tip:
            summary = summarize_native_swaps(state)
            at = summary.get("allTime") or {}
            print(
                f"[native-swap] {end}/{tip} buys+{bite_hits} sells+{aapl_hits} "
                f"unique={at.get('uniqueWallets')} txs={at.get('swapCount')}"
            )
            save_state(state)
        b = end + 1
        time.sleep(0.08)

    ns["mode"] = NATIVE_SWAP_INDEX_MODE
    if scanned_to >= tip:
        ns["cursor"] = tip
    save_state(state)
    print(
        f"[native-swap] done cursor={ns.get('cursor')} "
        f"bite_hits={bite_hits} aapl_hits={aapl_hits}"
    )
    return state


def apply_native_swap_poll(
    state: dict,
    w3,
    bite_events,
    *,
    from_block: int,
    to_block: int,
) -> dict:
    """Live poll: index BITE fee skims from Transfer filter + AAPL kitchen inflows."""
    if not KITCHEN_CONTRACT or to_block < from_block:
        return state
    fee_senders = native_swap_fee_senders()
    contracts = {a.lower() for a in (state.get("contract_addrs") or [])} | set(
        _DEFAULT_PROTOCOL_ADDRS
    )
    tx_cache: dict = {}
    lookup = make_tx_from_lookup(w3, tx_cache) if w3 else None

    note_fee_skims_from_bite_transfers(
        state,
        bite_events,
        kitchen=KITCHEN_CONTRACT,
        protocol_addrs=fee_senders,
        contract_addrs=contracts,
        tx_from_lookup=lookup,
    )

    if w3 and Web3 and AAPL_TOKEN:
        try:
            aapl_c = w3.eth.contract(
                address=Web3.to_checksum_address(AAPL_TOKEN),
                abi=ERC20_ABI,
            )
            aapl_ev = fetch_transfer_logs_to(
                aapl_c, from_block, to_block, KITCHEN_CONTRACT
            )
            note_fee_skims_from_aapl_transfers(
                state,
                aapl_ev,
                kitchen=KITCHEN_CONTRACT,
                protocol_addrs=fee_senders,
                tx_from_lookup=lookup,
            )
        except Exception as e:
            print(f"[native-swap] poll AAPL skim error: {e}")

    ns = ensure_native_swaps(state)
    ns["cursor"] = max(int(ns.get("cursor") or 0), to_block)
    ns["mode"] = NATIVE_SWAP_INDEX_MODE
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
        "kitchen": "kitchen",
        "kitchen stats": "kitchen",
        "swap stats": "kitchen",
        "report": "kitchen",
        "wager": "wager",
        "odds": "wager",
        "bet": "wager",
        "meta wager": "wager",
    }
    for phrase, cmd in natural.items():
        if lower == phrase or lower.startswith(phrase + " "):
            arg = raw[len(phrase) :].strip()
            return cmd, arg
    if lower.startswith("link "):
        return "link", raw[5:].strip()
    return None, ""


def help_copy(*, private: bool = False, admin: bool = False) -> str:
    link_line = (
        "Paste your 0x… wallet here (DM only) — or /link 0x…"
        if private
        else "DM me your 0x… wallet to link (don't paste addresses in the group)"
    )
    lines = [
        "🍎 $BITE commands (Act I)",
        link_line,
        "/unlink — remove your link",
        "/balance — your $BITE balance",
        "/points — your Act I points",
        "/leaderboard — top traders by points",
        "/wager — meta wager live odds (Core vs Rot)",
        "/stats — supply breakdown + prize pool",
        "/burn — burn $BITE on bite.party (or /burn 1000)",
        "/ca — contract address + links",
        "/buy — how to buy $BITE",
    ]
    if admin and private:
        lines.append(
            "/kitchen — admin: native-swap KPI + kitchen + fee skim (also /report)"
        )
    lines.append(
        "Also: check balance / check points / check leaderboard / check stats / how to buy / burn / tap / wager / odds"
    )
    return "\n".join(lines)


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
    chat_id=None,
) -> str | dict | None:
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
        "kitchen": "kitchen",
        "report": "kitchen",
        "kitchenstats": "kitchen",
        "swapstats": "kitchen",
        "adminreport": "kitchen",
        "wager": "wager",
        "bet": "wager",
        "odds": "wager",
        "metawager": "wager",
    }
    cmd = aliases.get(cmd, cmd)
    who = f"@{username}" if username else "you"
    admin = is_telegram_admin(tg_user_id, chat_id)

    if cmd == "help":
        return help_copy(private=private, admin=admin)

    if cmd == "kitchen":
        # Admin-only kitchen + swap report. Never post the body to the public channel.
        if not admin:
            return None
        w3, bite = get_web3()
        bite = bite or contract
        try:
            if w3 and bite:
                sync_dexscreener(state)
                sync_supply_stats(state, w3=w3, contract=bite)
        except Exception as e:
            print(f"[kitchen-cmd] market refresh warning: {e}")
        try:
            text = build_admin_report(state, w3, bite)
        except Exception as e:
            print(f"[kitchen-cmd] build failed: {e}")
            return "Could not build kitchen report — check bot logs."
        # Always deliver to the admin DM chat, even if the command was typed in a group.
        return {
            "text": text,
            "parse_mode": "Markdown",
            "admin_dm": True,
        }

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
                f"Trade on bite.party (native swap):\n"
                f"{BUY_URL}\n"
                f"\n"
                f"Fallback — Pons launchpad:\n"
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

    if cmd == "wager":
        w3, _ = get_web3()
        ws = get_wager_state(w3)
        if not ws:
            return (
                "🍎⚔️🪱 Meta Wager\n"
                "\n"
                "The meta wager contract is not available yet.\n"
                f"Check back at {SITE_URL}"
            )
        total_core = ws["totalCore"]
        total_rot = ws["totalRot"]
        total = total_core + total_rot
        core_pct = (ws["coreOddsBps"] / 100) if total > 0 else 50.0
        rot_pct = 100 - core_pct

        if ws["resolved"]:
            winner = "🍎 CORE" if ws["winningSide"] == 1 else "🪱 ROT"
            return (
                f"🍎⚔️🪱 Meta Wager — RESOLVED\n"
                f"\n"
                f"Winner: {winner}\n"
                f"Core pool: {fmt_amount(total_core)} $BITE\n"
                f"Rot pool: {fmt_amount(total_rot)} $BITE\n"
                f"\n"
                f"Claim your winnings at {SITE_URL}"
            )

        return {
            "text": (
                f"🍎⚔️🪱 Meta Wager — Live Odds\n"
                f"\n"
                f"🍎 CORE: {core_pct:.1f}% ({fmt_amount(total_core)} $BITE)\n"
                f"🪱 ROT: {rot_pct:.1f}% ({fmt_amount(total_rot)} $BITE)\n"
                f"Total staked: {fmt_amount(total)} $BITE\n"
                f"\n"
                f"Will the eaters reach 50% burn, or will time run out?\n"
                f"Place your bet at {SITE_URL}"
            ),
            "reply_markup": _inline_kb(
                [("🍎 Bet CORE", f"{SITE_URL}/#wager"), ("🪱 Bet ROT", f"{SITE_URL}/#wager")],
                [("📈 Chart", DEXSCREENER_PAIR_URL)],
            ),
        }

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
        buy_pts = float(entry.get("buy_points") or 0)
        sell_pts = float(entry.get("sell_points") or 0)
        burn_pts = float(entry.get("burn_points") or 0)
        trades = int(entry.get("trade_count") or 0)
        sells = int(entry.get("sell_count") or 0)
        burns = int(entry.get("burn_count") or 0)
        burned_bite = float(entry.get("burned_bite") or 0)
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
        lines = [f"🏆 {who}: {fmt_points(pts)} pts{rank_txt}"]
        # Breakdown
        parts = []
        if accum > 0:
            parts.append(f"accum {fmt_points(accum)}")
        if hold > 0:
            parts.append(f"hold {fmt_points(hold)}")
        if buy_pts > 0:
            parts.append(f"buys {fmt_points(buy_pts)}")
        if sell_pts > 0:
            parts.append(f"sells {fmt_points(sell_pts)}")
        if burn_pts > 0:
            parts.append(f"burns {fmt_points(burn_pts)}")
        if parts:
            lines.append(f"({' · '.join(parts)})")
        activity = []
        if trades > 0:
            activity.append(f"{trades} buys")
        if sells > 0:
            activity.append(f"{sells} sells")
        if burns > 0:
            activity.append(f"{burns} burns ({fmt_amount(int(burned_bite * 10**18))} BITE)")
        if activity:
            lines.append(f"{' · '.join(activity)}")
        lines.append(f"Wallet {short_addr(wallet)}")
        return "\n".join(lines)

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

    return help_copy(private=private, admin=admin)


def process_telegram_commands(
    token,
    contract,
    state: dict,
    *,
    dry_run: bool = False,
) -> dict:
    """Poll getUpdates and reply to /balance /points /leaderboard /link /kitchen (and aliases)."""
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
            chat_id=chat_id,
        )
        if reply is None:
            # Unauthorized /kitchen etc. — no reply (no leak to channel).
            continue
        if isinstance(reply, dict):
            _text = reply.get("text", "")
            _markup = reply.get("reply_markup")
            _photo = reply.get("photo_url")
            _parse = reply.get("parse_mode")
            # Admin kitchen/report: always DM TELEGRAM_ADMIN_CHAT_ID, never the public chat.
            if reply.get("admin_dm"):
                admin_chat = get_admin_chat_id()
                if not admin_chat:
                    print("[kitchen-cmd] TELEGRAM_ADMIN_CHAT_ID missing — skip send")
                    continue
                target = admin_chat
                reply_to = msg_id if private and str(chat_id) == str(admin_chat) else None
                tg_send(
                    token,
                    target,
                    _text,
                    reply_to_message_id=reply_to,
                    reply_markup=_markup,
                    parse_mode=_parse,
                )
                if not private and str(chat_id) != str(admin_chat):
                    # Brief ack in the group without leaking numbers.
                    tg_send(
                        token,
                        chat_id,
                        "📊 Kitchen report sent to your DM.",
                        reply_to_message_id=msg_id,
                    )
                continue
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


def get_wager_state(w3) -> dict | None:
    """Read MetaWager contract state: totalCore, totalRot, resolved, winningSide, coreOddsBps."""
    if not w3 or not Web3 or not META_WAGER_CONTRACT:
        return None
    try:
        wager = w3.eth.contract(
            address=Web3.to_checksum_address(META_WAGER_CONTRACT),
            abi=META_WAGER_ABI,
        )
        total_core = int(wager.functions.totalCore().call())
        total_rot = int(wager.functions.totalRot().call())
        is_resolved = bool(wager.functions.resolved().call())
        winning_side = int(wager.functions.winningSide().call())
        core_odds_bps = int(wager.functions.coreOddsBps().call())
        return {
            "totalCore": total_core,
            "totalRot": total_rot,
            "resolved": is_resolved,
            "winningSide": winning_side,
            "coreOddsBps": core_odds_bps,
        }
    except Exception as e:
        print(f"[wager] read error: {e}")
        return None


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
    row1 = [("🍎 Buy $BITE", BUY_URL), ("📈 Chart", DEXSCREENER_PAIR_URL)]
    row2: list[tuple[str, str]] = []
    if tx_hash:
        row2.append(("🔍 Txn", f"{EXPLORER_TX_BASE}{tx_hash}"))
    row2.append(("Dexscreener", DEXSCREENER_PAIR_URL))
    return _inline_kb(row1, row2)


def _ca_buttons() -> dict:
    return _inline_kb(
        [("🍎 Buy $BITE", BUY_URL), ("🔥 Burn", BURN_PAGE_URL)]
    )


def _buy_buttons() -> dict:
    return _inline_kb(
        [("🍎 Buy $BITE", BUY_URL), ("📈 Chart", DEXSCREENER_PAIR_URL)],
        [("Pons (fallback)", PONS_BUY_URL)],
    )


def _burn_buttons() -> dict:
    return _inline_kb(
        [("🔥 Burn", BURN_PAGE_URL), ("🍎 Buy", BUY_URL)]
    )


def _burn_milestone_buttons() -> dict:
    return _inline_kb(
        [("🍎 Buy", BUY_URL), ("🔥 Burn", BURN_PAGE_URL)]
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
        f"[Chart]({DEXSCREENER_PAIR_URL}) | [Buy]({BUY_URL}) | [Website]({SITE_URL})"
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
    # Also refresh holders before buy alerts so Telegram/site never post a
    # volume-persisted stale holderCount (e.g. frozen 173) on the first poll.
    if not dry_run:
        sync_dexscreener(state)
        sync_blockscout_holders(state, contract=contract)
        sync_supply_stats(state, w3=w3, contract=contract)

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
    scanned_to = from_block - 1
    if from_block <= current_block:
        for end, part in iter_transfer_logs(contract, from_block, current_block):
            transfer_filter.extend(part)
            scanned_to = end
        if scanned_to < from_block:
            print(
                f"[poll] log fetch incomplete; keeping last_block="
                f"{state.get('last_block')}"
            )

    v4_swaps = []
    skip_swap_txs: set[str] = set()
    if scanned_to >= from_block:
        try:
            for log in fetch_v4_swap_logs(w3, from_block, scanned_to):
                item = decode_v4_swap_log(log)
                if item and item.get("side"):
                    v4_swaps.append(item)
                    if item.get("tx_hash"):
                        skip_swap_txs.add(item["tx_hash"])
        except Exception as e:
            print(
                f"[v4-swaps] poll fetch failed: {e} — "
                "keeping last_block so this range is retried"
            )
            return state

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
                    photo_url=BURN_ALERT_IMAGE,
                )
            else:
                print(
                    f"[PHASE {PHASE}] burn milestone {m}% reached "
                    f"({burn_pct:.2f}%) — post {'suppressed (catch-up)' if is_catch_up else 'deferred until PHASE>=2'}"
                )
            state["last_burn_milestone"] = m

    # v4 Swap amount0 is the buy/sell truth. Transfer hops on those txs are
    # skipped so a sell is not also counted as a contract→EOA "buy".
    if scanned_to >= from_block and v4_swaps:
        tx_cache = {}
        apply_v4_swap_events(state, v4_swaps, w3=w3, tx_cache=tx_cache)
        if POST_ACTIVITY and not is_catch_up:
            holders = int(
                (state.get("supply_stats") or {}).get("holder_count")
                or state.get("holder_count")
                or 0
            )
            for item in v4_swaps:
                if item.get("side") != "buy" or not item.get("swapper"):
                    continue
                raw = int(round(float(item.get("bite_amount") or 0) * 10**18))
                if not _meets_usd_threshold(raw, state, MIN_SWAP_USD, MIN_SWAP_RAW):
                    continue
                tx_hash = item.get("tx_hash") or ""
                msg = swap_copy(
                    item["swapper"],
                    raw,
                    holders,
                    PHASE,
                    state=state,
                    tx_hash=tx_hash,
                )
                broadcast(
                    twitter,
                    tg_token,
                    tg_chat,
                    msg,
                    dry_run=dry_run,
                    reply_markup=_buy_alert_buttons(tx_hash),
                    photo_url=BUY_ALERT_IMAGE,
                    parse_mode="Markdown",
                )
    apply_trade_events(
        state, transfer_filter, tracked=None, w3=w3, skip_tx_hashes=skip_swap_txs
    )
    if META_WAGER_CONTRACT and scanned_to >= from_block:
        wager = _wager_contract(w3)
        if wager is not None:
            wager_hits = 0
            for _, events in iter_wager_logs(wager, from_block, scanned_to):
                wager_hits += apply_wager_events(
                    state, events, w3=w3, undo_sells=False
                )
            if wager_hits:
                print(f"[wager] poll +{wager_hits} BetPlaced")

    # ReferralEscrow: in-app buy (kitchen fee skim) + kitchen burn → attester qualify
    if transfer_filter and KITCHEN_CONTRACT and not is_catch_up:
        try:
            protocol = _protocol_hold_addrs() | set(_DEFAULT_PROTOCOL_ADDRS)
            contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
            state = maybe_qualify_referees(
                state,
                w3,
                transfer_filter,
                kitchen=KITCHEN_CONTRACT,
                protocol_addrs=protocol,
                contract_addrs=contracts,
                dev_wallets=DEV_WALLETS,
                dry_run=dry_run,
            )
        except Exception as e:
            print(f"[referral] qualify pass error: {e}")

    # Native-swap KPI: fee skim Transfer→kitchen (BITE buys + AAPL sells)
    if transfer_filter and KITCHEN_CONTRACT and scanned_to >= from_block:
        try:
            state = apply_native_swap_poll(
                state,
                w3,
                transfer_filter,
                from_block=from_block,
                to_block=scanned_to,
            )
        except Exception as e:
            print(f"[native-swap] poll error: {e}")

    for event in transfer_filter:
        from_addr = event.args["from"]
        to_addr = event.args["to"]
        value = int(event.args["value"])

        to_l = to_addr.lower()
        from_l = from_addr.lower()
        contracts = {a.lower() for a in (state.get("contract_addrs") or [])}
        is_burn = to_l in _burn_destinations() and (
            from_l not in contracts or from_l in DEV_WALLETS
        )
        is_mintish = from_l == ZERO_ADDRESS.lower()

        if is_burn:
            known.add(from_l)
        elif to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower()):
            known.add(to_l)

        if is_burn:
            if not _meets_usd_threshold(value, state, MIN_BURN_USD, MIN_BURN_RAW):
                continue
            if PHASE >= 2 and not is_catch_up:
                if value / 10**18 >= 10_000:
                    msg = burn_large_copy(from_addr, value, burn_pct)
                else:
                    msg = burn_tap_copy(from_addr, value, burn_pct)
                broadcast(
                    twitter,
                    tg_token,
                    tg_chat,
                    msg,
                    dry_run=dry_run,
                    reply_markup=_burn_buttons(),
                    photo_url=BURN_ALERT_IMAGE,
                )
            else:
                print(
                    f"[PHASE {PHASE}] burn detected {fmt_amount(value)} "
                    f"from {short_addr(from_addr)} — post {'suppressed (catch-up)' if is_catch_up else 'deferred until PHASE>=2'}"
                )
            continue

        # Notable inbound transfers (rough buy proxy). Explicit opt-in only.
        # Never announce a v4 swap Transfer hop — those include sells and
        # router refunds that used to post as "Buy!".
        tx_hash = _norm_hex(event.transactionHash)
        if tx_hash in skip_swap_txs:
            continue
        contracts_now = {a.lower() for a in (state.get("contract_addrs") or [])}
        is_real_buy = from_l in contracts_now and (
            to_l not in contracts_now or to_l in DEV_WALLETS
        )
        if (
            POST_ACTIVITY
            and not is_catch_up
            and not is_mintish
            and is_real_buy
            and to_l not in (ZERO_ADDRESS.lower(), DEAD_ADDRESS.lower())
            and _meets_usd_threshold(value, state, MIN_SWAP_USD, MIN_SWAP_RAW)
        ):
            holders = int(
                (state.get("supply_stats") or {}).get("holder_count")
                or state.get("holder_count")
                or 0
            )
            msg = swap_copy(to_addr, value, holders, PHASE, state=state, tx_hash=tx_hash)
            broadcast(
                twitter, tg_token, tg_chat, msg, dry_run=dry_run,
                reply_markup=_buy_alert_buttons(tx_hash),
                photo_url=BUY_ALERT_IMAGE,
                parse_mode="Markdown",
            )

    state["known_holders"] = list(known)

    if scanned_to >= from_block:
        state["last_block"] = scanned_to
    state["last_poll_at"] = datetime.now(timezone.utc).isoformat()
    state["last_burn_pct"] = burn_pct
    state["trade_from_block"] = TRADE_SCAN_FROM_BLOCK

    # Holders / supply already refreshed at poll start (before buy alerts).

    holder_count = int(
        (state.get("supply_stats") or {}).get("holder_count")
        or state.get("holder_count")
        or 0
    )
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


# ── Admin DM report (kitchen + swap/fee skim) ──

def get_admin_chat_id() -> str | None:
    """Private Telegram chat for ops reports. Never falls back to the public channel."""
    chat = TELEGRAM_ADMIN_CHAT_ID or os.getenv("TELEGRAM_ADMIN_CHAT_ID", "").strip()
    return chat or None


def is_telegram_admin(tg_user_id, chat_id=None) -> bool:
    """True when the sender (or chat) matches TELEGRAM_ADMIN_CHAT_ID."""
    admin = get_admin_chat_id()
    if not admin:
        return False
    admin_s = str(admin).strip()
    for candidate in (tg_user_id, chat_id):
        if candidate is None:
            continue
        if str(candidate).strip() == admin_s:
            return True
    return False


def _fmt_token(raw: int, decimals: int = 18, *, places: int = 4) -> str:
    val = raw / (10**decimals)
    if val >= 1_000_000:
        return f"{val / 1_000_000:.2f}M"
    if val >= 1_000:
        return f"{val / 1_000:.2f}K"
    if val >= 1:
        return f"{val:.{places}f}"
    if val > 0:
        return f"{val:.6f}"
    return "0"


def _fmt_usd(val: float | None) -> str:
    if val is None:
        return "—"
    if abs(val) >= 1000:
        return f"${val:,.0f}"
    return f"${val:,.2f}"


def _kitchen_contract(w3):
    if not w3 or not Web3 or not KITCHEN_CONTRACT:
        return None
    return w3.eth.contract(
        address=Web3.to_checksum_address(KITCHEN_CONTRACT),
        abi=KITCHEN_VIEW_ABI,
    )


def read_kitchen_live(w3, bite_contract) -> dict:
    """Live kitchen balances + burn progress + digestable AAPL + escrow claimable."""
    out: dict = {
        "kitchen": KITCHEN_CONTRACT,
        "bite_balance_raw": 0,
        "burned_raw": 0,
        "burned_effective_raw": 0,
        "core_target_raw": 0,
        "progress_bps": 0,
        "progress_bps_effective": 0,
        "phase": None,
        "phase_name": "—",
        "deadline": 0,
        "seconds_left": None,
        "aapl_balance_raw": 0,
        "prize_pool_raw": 0,
        "digestable_aapl_raw": 0,
        "escrow_claimable_aapl_raw": 0,
        "escrow_ok": False,
        "errors": [],
    }
    if not w3 or not Web3 or not KITCHEN_CONTRACT:
        out["errors"].append("no kitchen/web3")
        return out

    kitchen_addr = Web3.to_checksum_address(KITCHEN_CONTRACT)
    kc = _kitchen_contract(w3)

    if bite_contract is not None:
        try:
            out["bite_balance_raw"] = int(
                bite_contract.functions.balanceOf(kitchen_addr).call()
            )
        except Exception as e:
            out["errors"].append(f"BITE balanceOf: {e}")

    if kc is not None:
        for key, fn in (
            ("burned_raw", "burned"),
            ("core_target_raw", "coreTarget"),
            ("progress_bps", "progressBps"),
            ("prize_pool_raw", "prizePool"),
            ("deadline", "deadline"),
        ):
            try:
                out[key] = int(getattr(kc.functions, fn)().call())
            except Exception as e:
                out["errors"].append(f"kitchen.{fn}: {e}")
        try:
            phase = int(kc.functions.phase().call())
            out["phase"] = phase
            out["phase_name"] = _KITCHEN_PHASE_NAMES.get(phase, str(phase))
        except Exception as e:
            out["errors"].append(f"kitchen.phase: {e}")

    if out["deadline"]:
        now = int(time.time())
        out["seconds_left"] = max(0, int(out["deadline"]) - now)

    # progressBps is burned/coreTarget only (excludes sweep BITE sitting in kitchen).
    # Match site: burned + kitchen BITE balance vs coreTarget.
    burned_eff = int(out["burned_raw"]) + int(out["bite_balance_raw"])
    target = int(out["core_target_raw"])
    if target > 0:
        out["progress_bps_effective"] = min(10_000, (burned_eff * 10_000) // target)
    else:
        out["progress_bps_effective"] = int(out.get("progress_bps") or 0)
    out["burned_effective_raw"] = burned_eff

    if AAPL_TOKEN:
        try:
            aapl = w3.eth.contract(
                address=Web3.to_checksum_address(AAPL_TOKEN),
                abi=ERC20_ABI,
            )
            out["aapl_balance_raw"] = int(aapl.functions.balanceOf(kitchen_addr).call())
        except Exception as e:
            out["errors"].append(f"AAPL balanceOf: {e}")

    free = max(0, int(out["aapl_balance_raw"]) - int(out["prize_pool_raw"]))
    out["digestable_aapl_raw"] = free

    if PONS_FEE_ESCROW and AAPL_TOKEN:
        try:
            escrow = w3.eth.contract(
                address=Web3.to_checksum_address(PONS_FEE_ESCROW),
                abi=PONS_FEE_ESCROW_ABI,
            )
            out["escrow_claimable_aapl_raw"] = int(
                escrow.functions.balanceOfToken(
                    kitchen_addr,
                    Web3.to_checksum_address(AAPL_TOKEN),
                ).call()
            )
            out["escrow_ok"] = True
        except Exception as e:
            out["errors"].append(f"escrow claimable: {e}")

    return out


def _sum_transfers_to(
    token_contract,
    to_addr: str,
    from_block: int,
    to_block: int,
    *,
    protocol_from: set[str],
) -> dict:
    """Sum ERC-20 Transfer → to_addr, split by protocol-from vs other."""
    totals = {
        "protocol_raw": 0,
        "other_raw": 0,
        "protocol_n": 0,
        "other_n": 0,
        "from_block": from_block,
        "to_block": to_block,
    }
    if not token_contract or from_block > to_block:
        return totals
    b = from_block
    chunk = max(200, LOG_CHUNK_SIZE)
    try:
        while b <= to_block:
            end = min(b + chunk - 1, to_block)
            try:
                events = fetch_transfer_logs_to(token_contract, b, end, to_addr)
            except LogFetchError as e:
                if getattr(e, "rate_limited", False) or _is_rate_limit_error(e):
                    time.sleep(20)
                    continue
                if chunk > 200 and end - b > 200:
                    chunk = max(200, chunk // 2)
                    continue
                totals["error"] = str(e)
                return totals
            totals["to_block"] = end
            for ev in events:
                raw = int(ev.args["value"])
                frm = str(ev.args["from"]).lower()
                if frm in protocol_from:
                    totals["protocol_raw"] += raw
                    totals["protocol_n"] += 1
                else:
                    totals["other_raw"] += raw
                    totals["other_n"] += 1
            b = end + 1
            time.sleep(0.1)
    except Exception as e:
        totals["error"] = str(e)
    return totals


def _resolve_fee_scan_range(w3, state: dict) -> tuple[int, int]:
    tip = int(w3.eth.block_number)
    prev = int(state.get("last_admin_report_block") or 0)
    if prev > 0 and prev < tip:
        return prev + 1, tip
    # First run: cap lookback so a cold start doesn't stall the daemon for minutes.
    lookback = max(1000, min(ADMIN_REPORT_LOOKBACK_BLOCKS, 12_000))
    return max(TRADE_SCAN_FROM_BLOCK, tip - lookback), tip


def aggregate_indexed_trades(state: dict) -> dict:
    """Best-effort tallies from the bot's points/trade index (not pure fee accounting)."""
    buys = sells = burns = 0
    burned_bite = 0.0
    for entry in (state.get("points") or {}).values():
        if not isinstance(entry, dict):
            continue
        buys += int(entry.get("trade_count") or 0)
        sells += int(entry.get("sell_count") or 0)
        burns += int(entry.get("burn_count") or 0)
        try:
            burned_bite += float(entry.get("burned_bite") or 0)
        except (TypeError, ValueError):
            pass
    return {
        "buy_events": buys,
        "sell_events": sells,
        "burn_events": burns,
        "burned_bite": burned_bite,
    }


def build_admin_report(state: dict, w3, bite_contract) -> str:
    """Compose a private Telegram DM with kitchen + swap/fee stats."""
    now = datetime.now(timezone.utc)
    kitchen = read_kitchen_live(w3, bite_contract)
    supply = state.get("supply_stats") or {}
    dex = (state.get("market") or {}).get("dexscreener") or {}
    trades = aggregate_indexed_trades(state)

    bite_px = None
    try:
        bite_px = float(dex.get("priceUsd") or 0) or None
    except (TypeError, ValueError):
        bite_px = None
    if bite_px is None:
        try:
            bite_px = float(supply.get("bite_price_usd") or 0) or None
        except (TypeError, ValueError):
            pass
    aapl_px = None
    try:
        aapl_px = float(supply.get("aapl_price_usd") or 0) or None
    except (TypeError, ValueError):
        pass

    bite_bal = int(kitchen["bite_balance_raw"])
    burned_eff = int(kitchen["burned_effective_raw"])
    target = int(kitchen["core_target_raw"])
    progress = int(kitchen.get("progress_bps_effective") or 0) / 100
    aapl_bal = int(kitchen["aapl_balance_raw"])
    prize = int(kitchen["prize_pool_raw"])
    digestable = int(kitchen["digestable_aapl_raw"])
    escrow = int(kitchen["escrow_claimable_aapl_raw"])
    # Displayed prize = kitchen AAPL wallet + escrow claimable (matches site).
    # prizePool is the digest-locked subset of kitchen AAPL.
    display_prize = aapl_bal + escrow
    display_prize_usd = (display_prize / 10**18) * aapl_px if aapl_px else None

    secs_left = kitchen.get("seconds_left")
    if secs_left is None:
        deadline_txt = "—"
    else:
        days = secs_left // 86400
        hrs = (secs_left % 86400) // 3600
        deadline_txt = f"{days}d {hrs}h left" if secs_left > 0 else "expired"

    vol_h24 = dex.get("volumeH24")
    try:
        vol_h24_f = float(vol_h24) if vol_h24 is not None else None
    except (TypeError, ValueError):
        vol_h24_f = None
    # Theoretical upper bound if ALL pair volume were in-app at 0.5% — not measured fees.
    skim_upper = (vol_h24_f * 0.005) if vol_h24_f is not None else None

    fee_lines: list[str] = []
    fee_note = (
        "Inbound Transfer→kitchen over the report window. "
        "Protocol-from BITE/AAPL ≈ integrator fee skim + router hops; "
        "other-from BITE ≈ user bites/sweeps. Not exact Trading API fee accounting."
    )
    if w3 and Web3 and KITCHEN_CONTRACT and bite_contract is not None:
        from_b, to_b = _resolve_fee_scan_range(w3, state)
        protocol = _protocol_hold_addrs() | set(_DEFAULT_PROTOCOL_ADDRS)
        # Kitchen itself / dead are not fee senders.
        protocol.discard(KITCHEN_CONTRACT.lower())
        protocol.discard(DEAD_ADDRESS.lower())
        protocol.discard(ZERO_ADDRESS.lower())

        bite_in = _sum_transfers_to(
            bite_contract, KITCHEN_CONTRACT, from_b, to_b, protocol_from=protocol
        )
        aapl_in = {"protocol_raw": 0, "other_raw": 0, "protocol_n": 0, "other_n": 0}
        if AAPL_TOKEN:
            aapl_c = w3.eth.contract(
                address=Web3.to_checksum_address(AAPL_TOKEN),
                abi=ERC20_ABI,
            )
            aapl_in = _sum_transfers_to(
                aapl_c, KITCHEN_CONTRACT, from_b, to_b, protocol_from=protocol
            )

        blocks = f"{from_b}→{to_b}"
        fee_lines = [
            f"Window: blocks `{blocks}`",
            f"BITE from routers/contracts: {_fmt_token(bite_in['protocol_raw'])} "
            f"({bite_in['protocol_n']} txs)"
            + (
                f" (~{_fmt_usd((bite_in['protocol_raw'] / 10**18) * bite_px)})"
                if bite_px
                else ""
            ),
            f"BITE from other (bites/sweeps): {_fmt_token(bite_in['other_raw'])} "
            f"({bite_in['other_n']} txs)",
            f"AAPL from routers/contracts: {_fmt_token(aapl_in['protocol_raw'])} "
            f"({aapl_in['protocol_n']} txs)"
            + (
                f" (~{_fmt_usd((aapl_in['protocol_raw'] / 10**18) * aapl_px)})"
                if aapl_px
                else ""
            ),
            f"AAPL from other: {_fmt_token(aapl_in['other_raw'])} "
            f"({aapl_in['other_n']} txs)",
        ]
        if bite_in.get("error") or aapl_in.get("error"):
            fee_lines.append(
                f"Scan note: {bite_in.get('error') or aapl_in.get('error')}"
            )
    else:
        fee_lines = ["(chain unavailable — skipped inbound fee scan)"]

    swap = summarize_native_swaps(
        state, bite_price_usd=bite_px, aapl_price_usd=aapl_px
    )
    at = swap.get("allTime") or {}
    h24 = swap.get("h24") or {}

    def _swap_block(label: str, block: dict) -> list[str]:
        fee_bite_raw = int(block.get("feeBiteRaw") or 0)
        fee_aapl_raw = int(block.get("feeAaplRaw") or 0)
        vol_bite = float(block.get("estVolumeBite") or 0)
        vol_aapl = float(block.get("estVolumeAapl") or 0)
        vol_line = (
            _fmt_usd(block.get("estVolumeUsd"))
            if block.get("estVolumeUsd") is not None
            else (
                f"{vol_bite:,.2f} BITE"
                + (f" + {vol_aapl:,.4f} AAPL" if vol_aapl > 0 else "")
            )
        )
        return [
            f"{label}: *{int(block.get('uniqueWallets') or 0)}* wallets · "
            f"*{int(block.get('swapCount') or 0)}* txs "
            f"(buys {int(block.get('buyCount') or 0)} / "
            f"sells {int(block.get('sellCount') or 0)})",
            f"  Fee skimmed: {_fmt_token(fee_bite_raw)} BITE"
            + (f" + {_fmt_token(fee_aapl_raw)} AAPL" if fee_aapl_raw else "")
            + (
                f" (~{_fmt_usd(block.get('feeUsd'))})"
                if block.get("feeUsd") is not None
                else ""
            ),
            f"  Est. output vol (fee÷0.5%): {vol_line}",
            f"  Client-confirmed: {int(block.get('clientConfirmed') or 0)}",
        ]

    lines = [
        f"🍎 *Kitchen + swap report*",
        f"_{now.strftime('%Y-%m-%d %H:%M')} UTC_",
        "",
        "*Kitchen*",
        f"Phase: `{kitchen['phase_name']}` · deadline {deadline_txt}",
        f"Progress: *{progress:.2f}%* "
        f"({_fmt_token(burned_eff)} / {_fmt_token(target)} BITE)",
        f"kitchen.burned(): {_fmt_token(int(kitchen['burned_raw']))}",
        f"BITE sitting in kitchen: {_fmt_token(bite_bal)}",
        f"AAPL in kitchen: {_fmt_token(aapl_bal)}"
        + (f" (prizePool locked {_fmt_token(prize)})" if prize else ""),
        f"Digestable AAPL (free − prizePool): {_fmt_token(digestable)}",
        f"Pons escrow claimable: {_fmt_token(escrow)}"
        + (" ✓" if kitchen.get("escrow_ok") else " (fallback/err)"),
        f"Displayed prize (kitchen AAPL + escrow): {_fmt_token(display_prize)}"
        + (f" (~{_fmt_usd(display_prize_usd)})" if display_prize_usd else ""),
        "",
        "*Native swaps (in-app)*",
        "SwapModal / Trading API → integratorFees to kitchen. "
        "Not all-chain DEX trades.",
        *_swap_block("All-time", at),
        *_swap_block("24h", h24),
        f"Index cursor block: `{swap.get('cursor') or 0}`",
        "",
        "*Fee skim window (best-effort)*",
        fee_note,
        *fee_lines,
        "",
        "*Market / index context*",
        f"Dex pair vol 24h: {_fmt_usd(vol_h24_f)}",
        f"0.5% of that vol (upper bound if 100% in-app): {_fmt_usd(skim_upper)}",
        f"Indexed buys/sells/burns (all-chain): "
        f"{trades['buy_events']} / {trades['sell_events']} / {trades['burn_events']}",
        f"BITE {_fmt_usd(bite_px)}" if bite_px else "BITE price: —",
        f"AAPL {_fmt_usd(aapl_px)}" if aapl_px else "AAPL price: —",
        "",
        f"[Site]({SITE_URL}) · [Chart]({DEXSCREENER_PAIR_URL})",
        f"`{KITCHEN_CONTRACT}`",
    ]
    if kitchen.get("errors"):
        lines.append("")
        lines.append("_Read errors: " + "; ".join(kitchen["errors"][:3]) + "_")
    return "\n".join(lines)


def maybe_send_admin_report(
    state: dict,
    w3,
    bite_contract,
    tg_token: str | None,
    *,
    dry_run: bool = False,
    force: bool = False,
) -> dict:
    """DM TELEGRAM_ADMIN_CHAT_ID on interval (or force). Never posts to the public channel."""
    admin_chat = get_admin_chat_id()
    if not admin_chat and not dry_run:
        if force:
            print(
                "[admin-report] TELEGRAM_ADMIN_CHAT_ID not set — "
                "DM the bot, then read chat.id from getUpdates "
                "(https://api.telegram.org/bot<TOKEN>/getUpdates)."
            )
        return state

    interval = ADMIN_REPORT_INTERVAL_SEC
    if not force and interval <= 0:
        return state

    last_raw = state.get("last_admin_report_at") or ""
    if not force and last_raw:
        try:
            last_dt = datetime.fromisoformat(str(last_raw).replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if elapsed < interval:
                return state
        except (TypeError, ValueError):
            pass

    if not tg_token and not dry_run:
        print("[admin-report] no TELEGRAM_BOT_TOKEN — skip")
        return state

    try:
        text = build_admin_report(state, w3, bite_contract)
    except Exception as e:
        print(f"[admin-report] build failed: {e}")
        return state

    sent = tg_send(
        tg_token,
        admin_chat or "ADMIN",
        text,
        dry_run=dry_run,
        parse_mode="Markdown",
    )
    if sent or dry_run:
        state["last_admin_report_at"] = datetime.now(timezone.utc).isoformat()
        try:
            if w3:
                state["last_admin_report_block"] = int(w3.eth.block_number)
        except Exception:
            pass
        if not dry_run:
            save_state(state)
        print(
            f"[admin-report] {'dry-run ' if dry_run else ''}sent to admin chat "
            f"(interval={interval}s)"
        )
    else:
        print("[admin-report] send failed — will retry next interval")
    return state


# ── Leaderboard HTTP server (for Railway / remote hosting) ──

_http_state_ref: dict | None = None


class _LeaderboardHandler(BaseHTTPRequestHandler):
    """Tiny handler: /leaderboard.json, /swap-stats.json, /native-swap, /health."""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = (self.path or "/").split("?", 1)[0]
        if path == "/health":
            self._json_response(200, {"status": "ok"})
            return
        if path in ("/swap-stats.json", "/swap-stats", "/native-swaps"):
            state = _http_state_ref
            if state is None:
                self._json_response(503, {"error": "state not ready"})
                return
            self._json_response(200, _public_swap_stats(state))
            return
        if path in ("/leaderboard.json", "/leaderboard", "/"):
            state = _http_state_ref
            # Stay 503 until the trade index is current so Vercel does not
            # pick up a partial recount. Wager backfill is a small add-on on
            # top of v2_burn_lead — keep serving the live board meanwhile.
            if (
                state is None
                or state.get("trade_index_mode") != TRADE_INDEX_MODE
                or not state.get("trade_index_7702")
            ):
                self._json_response(503, {"error": "index not ready"})
                return
            payload = public_leaderboard_payload(state, limit=max(LEADERBOARD_TOP_N, 500))
            self._json_response(200, payload)
            return
        self._json_response(404, {"error": "not found"})

    def do_POST(self):
        path = (self.path or "/").split("?", 1)[0]
        if path not in ("/native-swap", "/swap-stats", "/swap-log"):
            self._json_response(404, {"error": "not found"})
            return
        state = _http_state_ref
        if state is None:
            self._json_response(503, {"error": "state not ready"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 32_000:
            self._json_response(400, {"error": "invalid body"})
            return
        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self._json_response(400, {"error": "invalid JSON"})
            return
        if not isinstance(payload, dict):
            self._json_response(400, {"error": "expected object"})
            return
        result = ingest_client_swap(state, payload)
        if result.get("ok"):
            try:
                save_state(state)
            except Exception as e:
                print(f"[native-swap] ingest save failed: {e}")
            self._json_response(200, result)
            return
        self._json_response(400, result)

    def _json_response(self, code: int, body: dict | list) -> None:
        data = json.dumps(body, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=15")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass


def start_leaderboard_http(state: dict, port: int) -> None:
    """Start the leaderboard HTTP server in a daemon thread."""
    global _http_state_ref
    _http_state_ref = state
    server = HTTPServer(("0.0.0.0", port), _LeaderboardHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(
        f"[http] leaderboard server on :{port} — "
        f"/leaderboard.json /swap-stats.json /native-swap /health"
    )


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
        help="Connect RPC, load contract, print burn %%, exit (no posts)",
    )
    parser.add_argument(
        "--commands-test",
        action="store_true",
        help="Dry-run command handlers (link/balance/points/leaderboard) without Telegram",
    )
    parser.add_argument(
        "--admin-report",
        action="store_true",
        help="Send one kitchen+swap stats DM to TELEGRAM_ADMIN_CHAT_ID and exit",
    )
    parser.add_argument(
        "--qualify",
        metavar="REFEREE",
        help="Manually attest ReferralEscrow.qualify(referee) with attester key and exit",
    )
    args = parser.parse_args(argv)

    twitter = None if args.dry_run or args.smoke or args.commands_test else get_twitter()
    tg_token, tg_chat = (
        (None, None)
        if args.dry_run or args.smoke or args.commands_test
        else get_telegram()
    )
    # Admin report only needs the bot token (DM chat is separate from public channel).
    if args.admin_report and not args.dry_run and not tg_token:
        tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip() or None
        tg_chat = os.getenv("TELEGRAM_CHAT_ID", "").strip() or None
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
            f"hold {HOLD_BITE_PER_POINT_PER_HOUR} BITE·h = 1 pt (Act I scaled)."
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

    if args.admin_report:
        if not args.dry_run and not tg_token:
            print(
                "Cannot --admin-report without TELEGRAM_BOT_TOKEN. "
                "Also set TELEGRAM_ADMIN_CHAT_ID to your private chat id."
            )
            return 1
        if not get_admin_chat_id() and not args.dry_run:
            print(
                "TELEGRAM_ADMIN_CHAT_ID not set.\n"
                "1) Message your orchard bot in Telegram (open a DM).\n"
                "2) GET https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates\n"
                "3) Copy message.chat.id (your user id) into TELEGRAM_ADMIN_CHAT_ID.\n"
                "   (Same bot as TELEGRAM_BOT_TOKEN — do not create a new bot.)"
            )
            return 1
        # Refresh prices / supply once so the report is useful offline.
        if w3 and contract and not args.dry_run:
            try:
                sync_dexscreener(state)
                sync_supply_stats(state, w3=w3, contract=contract)
            except Exception as e:
                print(f"[admin-report] market refresh warning: {e}")
        state = maybe_send_admin_report(
            state, w3, contract, tg_token, dry_run=args.dry_run, force=True
        )
        return 0

    if args.qualify:
        raw = (args.qualify or "").strip()
        if not ADDR_RE.match(raw):
            print("Usage: python -m bots --qualify 0xRefereeAddress")
            return 1
        if not w3:
            print("Cannot --qualify without RPC / web3.")
            return 1
        result = send_qualify(w3, raw, dry_run=args.dry_run)
        if result.get("ok"):
            print(f"[referral] qualify ok: {result}")
            return 0
        print(f"[referral] qualify failed: {result}")
        return 1

    ensure_dev_wallets(state)

    # Drop a volume-persisted Blockscout EOA snapshot immediately so the early
    # HTTP server cannot keep serving a frozen holderCount (e.g. 173) while the
    # first poll's RPC pass catches up. Points + EIP-7702 reclassify run in poll.
    if isinstance(state.get("current_token_holders"), list):
        bs = (state.get("market") or {}).get("blockscout") or {}
        # Only clear when we are not on a fresh completed RPC snapshot.
        if bs.get("source") != "rpc" or not state.get("rpc_holders_pass_complete"):
            state.pop("current_token_holders", None)
            state["current_token_holders_complete"] = False
            eoa_now = count_eoa_holders(state)
            state["holder_count"] = eoa_now
            ss = state.get("supply_stats")
            if isinstance(ss, dict):
                ss["holder_count"] = eoa_now
            print(f"[startup] cleared stale holder snapshot → EOA={eoa_now}")

    # Start HTTP server early so Railway healthcheck passes during backfill
    if args.daemon:
        http_port = os.getenv("PORT") or os.getenv("LEADERBOARD_HTTP_PORT")
        if http_port:
            start_leaderboard_http(state, int(http_port))

    if not args.test and not args.dry_run:
        try:
            state = backfill_trades(w3, contract, state)
        except Exception as e:
            print(f"[backfill] startup backfill failed (will retry next poll): {e}")
        try:
            state = backfill_burn_visibility(w3, contract, state)
        except Exception as e:
            print(f"[dust-burns] startup pass failed (will retry next poll): {e}")
        try:
            state = backfill_wagers(w3, state)
        except Exception as e:
            print(f"[wager] startup pass failed (will retry next poll): {e}")
        try:
            state = backfill_v4_swap_sides(w3, contract, state)
        except Exception as e:
            print(f"[v4-side] startup pass failed (will retry next poll): {e}")
        try:
            state = backfill_native_swaps(w3, contract, state)
        except Exception as e:
            print(f"[native-swap] startup pass failed (will retry next poll): {e}")

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
                if (
                    state.get("trade_index_mode") != TRADE_INDEX_MODE
                    or not state.get("trade_index_7702")
                ):
                    # Finish the mode recount before poll() so last_block is
                    # not jumped to tip on a partial pass (drops burns).
                    state = backfill_trades(w3, contract, state)
                    if (
                        state.get("trade_index_mode") != TRADE_INDEX_MODE
                        or not state.get("trade_index_7702")
                    ):
                        time.sleep(args.interval)
                        continue
                if state.get("dust_burn_index_mode") != DUST_BURN_INDEX_MODE:
                    # Finish visibility recount before poll() so last_block+1
                    # burns are not double-counted into burn_count.
                    state = backfill_burn_visibility(w3, contract, state)
                    if state.get("dust_burn_index_mode") != DUST_BURN_INDEX_MODE:
                        time.sleep(args.interval)
                        continue
                if state.get("wager_index_mode") != WAGER_INDEX_MODE:
                    state = backfill_wagers(w3, state)
                    if state.get("wager_index_mode") != WAGER_INDEX_MODE:
                        time.sleep(args.interval)
                        continue
                if state.get("trade_side_mode") != TRADE_SIDE_MODE:
                    # Finish buy/sell remap before poll() so last_block+1
                    # swaps are not scored on top of the old Transfer sides.
                    state = backfill_v4_swap_sides(w3, contract, state)
                    if state.get("trade_side_mode") != TRADE_SIDE_MODE:
                        time.sleep(args.interval)
                        continue
                state = process_telegram_commands(
                    tg_token, contract, state, dry_run=args.dry_run
                )
                state = poll(
                    w3, contract, twitter, tg_token, tg_chat, state, dry_run=args.dry_run
                )
                try:
                    state = maybe_send_admin_report(
                        state, w3, contract, tg_token, dry_run=args.dry_run
                    )
                except Exception as e:
                    print(f"[admin-report] error: {e}")
            except Exception as e:
                print(f"Poll error: {e}")
            time.sleep(args.interval)
    else:
        if state.get("dust_burn_index_mode") != DUST_BURN_INDEX_MODE:
            state = backfill_burn_visibility(w3, contract, state)
            if state.get("dust_burn_index_mode") != DUST_BURN_INDEX_MODE:
                print("[dust-burns] not finished — skip poll this run")
                return 0
        if state.get("wager_index_mode") != WAGER_INDEX_MODE:
            state = backfill_wagers(w3, state)
            if state.get("wager_index_mode") != WAGER_INDEX_MODE:
                print("[wager] not finished — skip poll this run")
                return 0
        if state.get("trade_side_mode") != TRADE_SIDE_MODE:
            state = backfill_v4_swap_sides(w3, contract, state)
            if state.get("trade_side_mode") != TRADE_SIDE_MODE:
                print("[v4-side] not finished — skip poll this run")
                return 0
        state = process_telegram_commands(
            tg_token, contract, state, dry_run=args.dry_run
        )
        state = poll(
            w3, contract, twitter, tg_token, tg_chat, state, dry_run=args.dry_run
        )
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
        ("wager", ""),
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
