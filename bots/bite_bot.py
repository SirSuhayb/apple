"""
$BITE — Onchain Activity Bot

Monitors the $BITE token on Robinhood Chain (4663) and posts activity
to Telegram (required) and Twitter/X (optional).

Act I (PHASE=1): burn posts are deferred. Bot still polls Transfer events,
updates burn state, and may post holder milestones / notable buys.
Act II+ (PHASE>=2): burn trades, tap burns, and burn milestones are posted.

Run from repo root:
  python -m bots --test
  python -m bots --daemon
  python -m bots
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
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

def load_state() -> dict:
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {
        "last_block": 0,
        "holder_count": 0,
        "last_holder_milestone": 0,
        "last_burn_milestone": 0,
        "total_burned": 0,
        "total_supply": 0,
        "known_holders": [],
        "phase_note_posted": False,
    }


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


def tg_send(token, chat_id, text: str, *, dry_run: bool = False) -> bool:
    if dry_run:
        print(f"[TG dry-run] {text}")
        return True
    if not token or not chat_id:
        print(f"[TG skip] {text}")
        return False
    payload = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": "true",
        }
    ).encode()
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
        f"Burn posts unlock in Act II when the kitchen opens.\n\n{SITE_URL}"
    )


# ── Poll ──

def poll(w3, contract, twitter, tg_token, tg_chat, state, *, dry_run: bool = False):
    if not w3 or not contract:
        print("Chain connection not available. Skipping poll.")
        return state

    current_block = w3.eth.block_number
    from_block = state["last_block"] + 1 if state["last_block"] > 0 else max(0, current_block - 100)
    if current_block - from_block > 500:
        from_block = current_block - 500

    try:
        transfer_filter = contract.events.Transfer.get_logs(
            from_block=from_block,
            to_block=current_block,
        )
    except TypeError:
        # Older web3 used camelCase kwargs
        try:
            transfer_filter = contract.events.Transfer.get_logs(
                fromBlock=from_block,
                toBlock=current_block,
            )
        except Exception as e:
            print(f"Error fetching events: {e}")
            transfer_filter = []
    except Exception as e:
        print(f"Error fetching events: {e}")
        transfer_filter = []

    known = set(a.lower() for a in (state.get("known_holders") or []))
    burn_pct, total_burned, total_supply = get_burn_pct(contract)
    state["total_burned"] = total_burned
    state["total_supply"] = total_supply

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
    args = parser.parse_args(argv)

    twitter = None if args.dry_run or args.smoke else get_twitter()
    tg_token, tg_chat = (None, None) if args.dry_run or args.smoke else get_telegram()
    w3, contract = get_web3()
    state = load_state()

    print(f"PHASE={PHASE}  contract={BITE_CONTRACT}  rpc={RPC_URL}  chain_id={CHAIN_ID}")
    if PHASE < 2:
        print(
            "Act I: burn Telegram posts deferred until PHASE>=2. "
            f"POST_ACTIVITY={POST_ACTIVITY} (holder milestones still tracked)."
        )

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
                state = poll(
                    w3, contract, twitter, tg_token, tg_chat, state, dry_run=args.dry_run
                )
            except Exception as e:
                print(f"Poll error: {e}")
            time.sleep(args.interval)
    else:
        state = poll(w3, contract, twitter, tg_token, tg_chat, state, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
