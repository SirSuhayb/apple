"""ReferralEscrow attester helpers for the orchard bot.

After a referee completes an **in-app** buy (Trading API integratorFees skim
to kitchen in the same tx as a BITE buy) **and** a kitchen burn (EOA → kitchen),
the attester calls `qualify(referee)` so the referrer is paid.

Env (never commit secrets):
  REFERRAL_ESCROW          proxy address (default live proxy)
  REFERRAL_ATTESTER_KEY    preferred signer key (attester / owner EOA)
  PRIVATE_KEY              fallback if REFERRAL_ATTESTER_KEY unset (kitchen deploy)
  REFERRAL_AUTO_QUALIFY    1 (default) to auto-qualify in poll; 0 to disable
  REFERRAL_MIN_SWAP_USD    minimum swap value in USD to qualify (default 25)
  REFERRAL_MIN_SWAP_BITE   BITE-amount fallback when no price (default 500000)
"""

from __future__ import annotations

import os
import re
import time
from typing import Any

ADDR_RE = re.compile(r"^0x[a-fA-F0-9]{40}$", re.I)

REFERRAL_ESCROW = os.getenv(
    "REFERRAL_ESCROW",
    "0xc127327419D78C8546230463F8b421Bb66212660",
).strip()
REFERRAL_AUTO_QUALIFY = os.getenv("REFERRAL_AUTO_QUALIFY", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

REFERRAL_MIN_SWAP_USD = float(os.getenv("REFERRAL_MIN_SWAP_USD", "25"))
REFERRAL_MIN_SWAP_BITE_RAW = int(os.getenv("REFERRAL_MIN_SWAP_BITE", "500000")) * 10**18

REFERRAL_ESCROW_ABI = [
    {
        "inputs": [{"name": "referrer", "type": "address"}],
        "name": "bind",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "referee", "type": "address"}],
        "name": "qualify",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "referee", "type": "address"}],
        "name": "referrerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "referee", "type": "address"}],
        "name": "paid",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "attester",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "rewardPerReferral",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _attester_key() -> str | None:
    for name in ("REFERRAL_ATTESTER_KEY", "PRIVATE_KEY"):
        raw = (os.getenv(name) or "").strip()
        if raw:
            return raw
    return None


def _zero(addr: str) -> bool:
    return addr.lower() == "0x0000000000000000000000000000000000000000"


def _norm_tx(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return "0x" + value.hex()
    s = str(value).lower()
    if s.startswith("0x"):
        return s
    return "0x" + s


def referral_contract(w3):
    if not w3 or not REFERRAL_ESCROW or not ADDR_RE.match(REFERRAL_ESCROW):
        return None
    try:
        from web3 import Web3

        return w3.eth.contract(
            address=Web3.to_checksum_address(REFERRAL_ESCROW),
            abi=REFERRAL_ESCROW_ABI,
        )
    except Exception as e:
        print(f"[referral] contract init failed: {e}")
        return None


def note_in_app_buys_from_transfers(
    state: dict,
    events,
    *,
    kitchen: str | None,
    protocol_addrs: set[str],
    contract_addrs: set[str],
) -> int:
    """Mark EOAs that bought in a tx that also skims BITE integrator fees to kitchen.

    In-app Trading API buys PAY_PORTION BITE → kitchen from a router/protocol in
    the same transaction as the user receiving BITE. External DEX fills without
    our fee recipient do not match.
    """
    if not kitchen or not events:
        return 0
    kitchen_l = kitchen.lower()
    protocol = {a.lower() for a in protocol_addrs}
    contracts = {a.lower() for a in contract_addrs} | protocol

    by_tx: dict[str, list] = {}
    for event in events:
        tx = _norm_tx(getattr(event, "transactionHash", None))
        if not tx:
            continue
        by_tx.setdefault(tx, []).append(event)

    buyers = state.setdefault("in_app_buyers", {})
    if not isinstance(buyers, dict):
        buyers = {}
        state["in_app_buyers"] = buyers

    hits = 0
    for tx, logs in by_tx.items():
        fee_to_kitchen = False
        buy_amounts: dict[str, int] = {}
        for event in logs:
            from_l = event.args["from"].lower()
            to_l = event.args["to"].lower()
            value = int(event.args["value"])
            if value <= 0:
                continue
            if to_l == kitchen_l and from_l in protocol:
                fee_to_kitchen = True
            # Buy hop: protocol/contract → EOA (not kitchen / not another contract)
            if from_l in contracts and to_l not in contracts and to_l != kitchen_l:
                buy_amounts[to_l] = buy_amounts.get(to_l, 0) + value
        if not fee_to_kitchen or not buy_amounts:
            continue
        for addr, amount in buy_amounts.items():
            prev = buyers.get(addr)
            prev_raw = int(prev.get("bite_raw") or 0) if isinstance(prev, dict) else 0
            buyers[addr] = {
                "tx": tx,
                "at": time.time(),
                "bite_raw": prev_raw + amount,
            }
            hits += 1
    return hits


def kitchen_burn_referees_from_transfers(
    events,
    *,
    kitchen: str | None,
    contract_addrs: set[str],
    dev_wallets: set[str] | None = None,
) -> list[str]:
    """EOAs that sent BITE to kitchen (bite / sweep). Skips contract→kitchen digest."""
    if not kitchen or not events:
        return []
    kitchen_l = kitchen.lower()
    contracts = {a.lower() for a in contract_addrs}
    devs = {a.lower() for a in (dev_wallets or set())}
    out: list[str] = []
    seen: set[str] = set()
    for event in events:
        from_l = event.args["from"].lower()
        to_l = event.args["to"].lower()
        value = int(event.args["value"])
        if value <= 0 or to_l != kitchen_l:
            continue
        if from_l in contracts and from_l not in devs:
            continue
        if from_l in seen:
            continue
        seen.add(from_l)
        out.append(from_l)
    return out


def read_referral_status(w3, referee: str) -> dict[str, Any]:
    c = referral_contract(w3)
    if c is None:
        return {"ok": False, "error": "no contract"}
    try:
        from web3 import Web3

        ref = Web3.to_checksum_address(referee)
        referrer = c.functions.referrerOf(ref).call()
        paid = bool(c.functions.paid(ref).call())
        return {
            "ok": True,
            "referee": ref,
            "referrer": referrer,
            "bound": not _zero(referrer),
            "paid": paid,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def send_qualify(w3, referee: str, *, dry_run: bool = False) -> dict[str, Any]:
    """Attester `qualify(referee)`. Returns status dict; never prints keys."""
    key = _attester_key()
    if not key:
        return {
            "ok": False,
            "error": "missing REFERRAL_ATTESTER_KEY / PRIVATE_KEY — set on Railway",
        }
    c = referral_contract(w3)
    if c is None:
        return {"ok": False, "error": "no ReferralEscrow contract"}
    if not w3:
        return {"ok": False, "error": "no web3"}

    try:
        from eth_account import Account
        from web3 import Web3

        account = Account.from_key(key)
        referee_cs = Web3.to_checksum_address(referee)
        status = read_referral_status(w3, referee_cs)
        if not status.get("ok"):
            return status
        if status.get("paid"):
            return {"ok": True, "skipped": "already_paid", **status}
        if not status.get("bound"):
            return {"ok": False, "error": "not_bound", **status}

        onchain_attester = c.functions.attester().call()
        if account.address.lower() != onchain_attester.lower():
            return {
                "ok": False,
                "error": (
                    f"signer {account.address} is not on-chain attester "
                    f"{onchain_attester}"
                ),
            }

        if dry_run:
            return {
                "ok": True,
                "dry_run": True,
                "would_qualify": referee_cs,
                "referrer": status.get("referrer"),
                "signer": account.address,
            }

        nonce = w3.eth.get_transaction_count(account.address)
        tx = c.functions.qualify(referee_cs).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "chainId": int(w3.eth.chain_id),
            }
        )
        if "gas" not in tx:
            tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
        signed = account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or getattr(
            signed, "rawTransaction", None
        )
        tx_hash = w3.eth.send_raw_transaction(raw)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        ok = int(receipt.get("status", 0) or 0) == 1
        return {
            "ok": ok,
            "tx": tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash),
            "block": receipt.get("blockNumber"),
            "referee": referee_cs,
            "referrer": status.get("referrer"),
            "signer": account.address,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _bite_usd_price(state: dict) -> float | None:
    """Read BITE price in USD from Dexscreener market data (same as bite_bot)."""
    try:
        price = float(
            (state.get("market") or {}).get("dexscreener", {}).get("priceUsd") or 0
        )
        return price if price > 0 else None
    except (TypeError, ValueError):
        return None


def _meets_referral_min_swap(bite_raw: int, state: dict) -> bool:
    """True when a buyer's BITE amount meets the referral minimum ($25 default)."""
    if REFERRAL_MIN_SWAP_USD <= 0:
        return True
    price = _bite_usd_price(state)
    if price is not None:
        usd_val = (bite_raw / 10**18) * price
        return usd_val >= REFERRAL_MIN_SWAP_USD
    return bite_raw >= REFERRAL_MIN_SWAP_BITE_RAW


def maybe_qualify_referees(
    state: dict,
    w3,
    events,
    *,
    kitchen: str | None,
    protocol_addrs: set[str],
    contract_addrs: set[str],
    dev_wallets: set[str] | None = None,
    dry_run: bool = False,
) -> dict:
    """After Transfer scan: note in-app buys, then qualify bound referees who burned."""
    if not REFERRAL_AUTO_QUALIFY:
        return state
    if not REFERRAL_ESCROW or not kitchen:
        return state

    note_in_app_buys_from_transfers(
        state,
        events,
        kitchen=kitchen,
        protocol_addrs=protocol_addrs,
        contract_addrs=contract_addrs,
    )

    buyers = state.get("in_app_buyers") or {}
    if not isinstance(buyers, dict):
        buyers = {}

    done = state.setdefault("referral_qualified", [])
    if not isinstance(done, list):
        done = []
        state["referral_qualified"] = done
    done_set = {a.lower() for a in done if isinstance(a, str)}

    candidates = kitchen_burn_referees_from_transfers(
        events,
        kitchen=kitchen,
        contract_addrs=contract_addrs,
        dev_wallets=dev_wallets,
    )

    for addr in candidates:
        if addr in done_set:
            continue
        if addr not in buyers:
            continue
        buyer_info = buyers[addr]
        bite_raw = int(buyer_info.get("bite_raw") or 0) if isinstance(buyer_info, dict) else 0
        if not _meets_referral_min_swap(bite_raw, state):
            print(
                f"[referral] skip {addr}: swap below ${REFERRAL_MIN_SWAP_USD} min "
                f"({bite_raw / 10**18:.1f} BITE)"
            )
            continue
        result = send_qualify(w3, addr, dry_run=dry_run)
        if result.get("ok") and (
            result.get("skipped") == "already_paid" or result.get("tx") or result.get("dry_run")
        ):
            done.append(addr)
            done_set.add(addr)
            print(
                f"[referral] qualify {addr}: "
                f"{'dry-run' if result.get('dry_run') else result.get('skipped') or result.get('tx')}"
            )
        elif not result.get("ok"):
            err = result.get("error") or "failed"
            if err in ("not_bound",):
                continue
            print(f"[referral] qualify skip {addr}: {err}")

    return state
