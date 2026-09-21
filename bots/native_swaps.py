"""Native (in-app) swap KPI index.

A **native swap** is a bite.party SwapModal / Trading API execute that pays
integratorFees → kitchen (PAY_PORTION, default 50 bips of output).

This is NOT the all-chain trade index (EOA buy/sell Transfer hops). External
DEX fills without our fee recipient do not match.

Primary signal (durable, on-chain):
  ERC-20 Transfer → kitchen FROM known Uniswap/protocol routers for BITE
  (buy skim) or AAPL (sell skim). Wallet attributed via tx.from when RPC
  allows; else same-tx protocol→EOA BITE hop for buys.

Secondary signal (client confirm):
  SwapModal POSTs successful tx hashes to the bot HTTP ingest (or site API
  which forwards). Merges into the same by_tx map.

Honesty: protocol→kitchen can include rare non-fee router hops; label reports
as "fee skims ≈ in-app". Client confirms raise confidence.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Callable

NATIVE_SWAP_INDEX_MODE = "fee_skim_v1"
# Must match site SWAP_KITCHEN_PORTION_BIPS (Trading API integratorFees).
NATIVE_SWAP_FEE_BIPS = 50
# Cap stored tx detail (aggregates + wallet set still cover all-time).
NATIVE_SWAP_TX_CAP = 8_000
NATIVE_SWAP_H24_SEC = 86_400


def ensure_native_swaps(state: dict) -> dict:
    ns = state.get("native_swaps")
    if not isinstance(ns, dict):
        ns = {}
        state["native_swaps"] = ns
    ns.setdefault("mode", NATIVE_SWAP_INDEX_MODE)
    ns.setdefault("cursor", 0)
    ns.setdefault("by_tx", {})
    ns.setdefault("wallets", {})
    ns.setdefault("all_time", _empty_totals())
    return ns


def _empty_totals() -> dict:
    return {
        "swapCount": 0,
        "uniqueWallets": 0,
        "feeBiteRaw": 0,
        "feeAaplRaw": 0,
        "buyCount": 0,
        "sellCount": 0,
        "clientConfirmed": 0,
    }


def _norm_tx(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return "0x" + value.hex()
    s = str(value).lower()
    if not s.startswith("0x"):
        s = "0x" + s
    return s


def _norm_addr(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return "0x" + value.hex()[-40:]
    s = str(value).lower()
    if not s.startswith("0x"):
        s = "0x" + s
    return s


def _fee_to_volume_raw(fee_raw: int, bips: int = NATIVE_SWAP_FEE_BIPS) -> int:
    if fee_raw <= 0 or bips <= 0:
        return 0
    # fee = output * bips / 10000 → output ≈ fee * 10000 / bips
    return (fee_raw * 10_000) // bips


def _cap_by_tx(ns: dict) -> None:
    by_tx = ns.get("by_tx")
    if not isinstance(by_tx, dict) or len(by_tx) <= NATIVE_SWAP_TX_CAP:
        return
    # Drop oldest by timestamp.
    ordered = sorted(
        by_tx.items(),
        key=lambda kv: float((kv[1] or {}).get("ts") or 0),
    )
    drop = len(ordered) - NATIVE_SWAP_TX_CAP
    for tx, _ in ordered[:drop]:
        by_tx.pop(tx, None)


def _touch_wallet(ns: dict, wallet: str, *, ts: float, fee_token: str, fee_raw: int) -> None:
    if not wallet or not wallet.startswith("0x") or len(wallet) < 10:
        return
    wallets = ns.setdefault("wallets", {})
    if not isinstance(wallets, dict):
        wallets = {}
        ns["wallets"] = wallets
    entry = wallets.get(wallet)
    if not isinstance(entry, dict):
        entry = {
            "firstTs": ts,
            "lastTs": ts,
            "count": 0,
            "feeBiteRaw": 0,
            "feeAaplRaw": 0,
        }
        wallets[wallet] = entry
    entry["lastTs"] = max(float(entry.get("lastTs") or 0), ts)
    if not entry.get("firstTs"):
        entry["firstTs"] = ts
    entry["count"] = int(entry.get("count") or 0) + 1
    if fee_token == "BITE":
        entry["feeBiteRaw"] = int(entry.get("feeBiteRaw") or 0) + int(fee_raw)
    elif fee_token == "AAPL":
        entry["feeAaplRaw"] = int(entry.get("feeAaplRaw") or 0) + int(fee_raw)


def _recompute_all_time(ns: dict) -> None:
    """Rebuild all_time from wallets + by_tx (authoritative after merges)."""
    totals = _empty_totals()
    by_tx = ns.get("by_tx") or {}
    if isinstance(by_tx, dict):
        for rec in by_tx.values():
            if not isinstance(rec, dict):
                continue
            totals["swapCount"] += 1
            side = str(rec.get("side") or "")
            if side == "buy":
                totals["buyCount"] += 1
            elif side == "sell":
                totals["sellCount"] += 1
            if rec.get("clientConfirmed"):
                totals["clientConfirmed"] += 1
            token = str(rec.get("feeToken") or "")
            fee = int(rec.get("feeRaw") or 0)
            if token == "BITE":
                totals["feeBiteRaw"] += fee
            elif token == "AAPL":
                totals["feeAaplRaw"] += fee
    wallets = ns.get("wallets") or {}
    if isinstance(wallets, dict):
        totals["uniqueWallets"] = len(wallets)
        # Prefer wallet rollups for fee sums when by_tx was capped.
        bite_w = sum(int(v.get("feeBiteRaw") or 0) for v in wallets.values() if isinstance(v, dict))
        aapl_w = sum(int(v.get("feeAaplRaw") or 0) for v in wallets.values() if isinstance(v, dict))
        if bite_w >= totals["feeBiteRaw"]:
            totals["feeBiteRaw"] = bite_w
        if aapl_w >= totals["feeAaplRaw"]:
            totals["feeAaplRaw"] = aapl_w
        swap_w = sum(int(v.get("count") or 0) for v in wallets.values() if isinstance(v, dict))
        if swap_w >= totals["swapCount"]:
            totals["swapCount"] = swap_w
    ns["all_time"] = totals


def record_native_swap(
    state: dict,
    *,
    tx_hash: str,
    wallet: str | None,
    side: str,
    fee_token: str,
    fee_raw: int,
    block: int | None = None,
    ts: float | None = None,
    source: str = "chain",
    amount_in: str | None = None,
    amount_out: str | None = None,
    token_in: str | None = None,
    token_out: str | None = None,
    client_confirmed: bool = False,
) -> bool:
    """Upsert one native-swap tx. Returns True if new or materially updated."""
    tx = _norm_tx(tx_hash)
    if not tx or len(tx) < 10:
        return False
    ns = ensure_native_swaps(state)
    by_tx = ns.setdefault("by_tx", {})
    if not isinstance(by_tx, dict):
        by_tx = {}
        ns["by_tx"] = by_tx

    now = float(ts if ts is not None else time.time())
    wallet_l = _norm_addr(wallet) if wallet else ""
    fee_raw_i = max(0, int(fee_raw or 0))
    existing = by_tx.get(tx)
    is_new = not isinstance(existing, dict)

    if is_new:
        rec = {
            "wallet": wallet_l or None,
            "side": side if side in ("buy", "sell", "unknown") else "unknown",
            "feeToken": fee_token if fee_token in ("BITE", "AAPL") else fee_token,
            "feeRaw": fee_raw_i,
            "block": int(block) if block is not None else None,
            "ts": now,
            "source": source,
            "clientConfirmed": bool(client_confirmed),
        }
        if amount_in:
            rec["amountIn"] = str(amount_in)
        if amount_out:
            rec["amountOut"] = str(amount_out)
        if token_in:
            rec["tokenIn"] = str(token_in)
        if token_out:
            rec["tokenOut"] = str(token_out)
        by_tx[tx] = rec
        if wallet_l:
            _touch_wallet(ns, wallet_l, ts=now, fee_token=str(rec["feeToken"]), fee_raw=fee_raw_i)
        _cap_by_tx(ns)
        _recompute_all_time(ns)
        return True

    # Merge enrichment (client confirm / better wallet / higher fee observation).
    changed = False
    if client_confirmed and not existing.get("clientConfirmed"):
        existing["clientConfirmed"] = True
        existing["source"] = "client" if source == "client" else existing.get("source") or source
        changed = True
    if wallet_l and not existing.get("wallet"):
        existing["wallet"] = wallet_l
        _touch_wallet(
            ns,
            wallet_l,
            ts=float(existing.get("ts") or now),
            fee_token=str(existing.get("feeToken") or fee_token),
            fee_raw=int(existing.get("feeRaw") or fee_raw_i),
        )
        changed = True
    if fee_raw_i > int(existing.get("feeRaw") or 0):
        # Prefer larger observed fee (shouldn't happen often); adjust wallet rollup lightly.
        delta = fee_raw_i - int(existing.get("feeRaw") or 0)
        existing["feeRaw"] = fee_raw_i
        w = _norm_addr(existing.get("wallet"))
        if w and isinstance(ns.get("wallets"), dict) and w in ns["wallets"]:
            token = str(existing.get("feeToken") or fee_token)
            entry = ns["wallets"][w]
            if token == "BITE":
                entry["feeBiteRaw"] = int(entry.get("feeBiteRaw") or 0) + delta
            elif token == "AAPL":
                entry["feeAaplRaw"] = int(entry.get("feeAaplRaw") or 0) + delta
        changed = True
    if side in ("buy", "sell") and existing.get("side") in (None, "unknown"):
        existing["side"] = side
        changed = True
    for key, val in (
        ("amountIn", amount_in),
        ("amountOut", amount_out),
        ("tokenIn", token_in),
        ("tokenOut", token_out),
    ):
        if val and not existing.get(key):
            existing[key] = str(val)
            changed = True
    if block is not None and existing.get("block") is None:
        existing["block"] = int(block)
        changed = True
    if changed:
        _recompute_all_time(ns)
    return changed


def note_fee_skims_from_bite_transfers(
    state: dict,
    events,
    *,
    kitchen: str | None,
    protocol_addrs: set[str],
    contract_addrs: set[str],
    tx_from_lookup: Callable[[str], str | None] | None = None,
) -> int:
    """Index BITE Transfer→kitchen from protocol as native-swap buy fee skims."""
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

    hits = 0
    for tx, logs in by_tx.items():
        fee_raw = 0
        fee_block = None
        buy_recipients: set[str] = set()
        for event in logs:
            from_l = _norm_addr(event.args["from"])
            to_l = _norm_addr(event.args["to"])
            value = int(event.args["value"])
            if value <= 0:
                continue
            if to_l == kitchen_l and from_l in protocol:
                fee_raw += value
                try:
                    fee_block = int(getattr(event, "blockNumber", None) or 0) or fee_block
                except (TypeError, ValueError):
                    pass
            if from_l in contracts and to_l not in contracts and to_l != kitchen_l:
                buy_recipients.add(to_l)
        if fee_raw <= 0:
            continue
        wallet = None
        if tx_from_lookup:
            try:
                wallet = tx_from_lookup(tx)
            except Exception:
                wallet = None
        if not wallet and len(buy_recipients) == 1:
            wallet = next(iter(buy_recipients))
        elif not wallet and buy_recipients:
            # Prefer non-contract recipient already filtered.
            wallet = sorted(buy_recipients)[0]
        if record_native_swap(
            state,
            tx_hash=tx,
            wallet=wallet,
            side="buy",
            fee_token="BITE",
            fee_raw=fee_raw,
            block=fee_block,
            source="chain",
        ):
            hits += 1
    return hits


def note_fee_skims_from_aapl_transfers(
    state: dict,
    events,
    *,
    kitchen: str | None,
    protocol_addrs: set[str],
    tx_from_lookup: Callable[[str], str | None] | None = None,
) -> int:
    """Index AAPL Transfer→kitchen from protocol as native-swap sell fee skims."""
    if not kitchen or not events:
        return 0
    kitchen_l = kitchen.lower()
    protocol = {a.lower() for a in protocol_addrs}

    hits = 0
    for event in events:
        from_l = _norm_addr(event.args["from"])
        to_l = _norm_addr(event.args["to"])
        value = int(event.args["value"])
        if value <= 0 or to_l != kitchen_l or from_l not in protocol:
            continue
        tx = _norm_tx(getattr(event, "transactionHash", None))
        if not tx:
            continue
        block = None
        try:
            block = int(getattr(event, "blockNumber", None) or 0) or None
        except (TypeError, ValueError):
            pass
        wallet = None
        if tx_from_lookup:
            try:
                wallet = tx_from_lookup(tx)
            except Exception:
                wallet = None
        if record_native_swap(
            state,
            tx_hash=tx,
            wallet=wallet,
            side="sell",
            fee_token="AAPL",
            fee_raw=value,
            block=block,
            source="chain",
        ):
            hits += 1
    return hits


def ingest_client_swap(state: dict, payload: dict) -> dict:
    """Merge a client-confirmed SwapModal success into the index."""
    tx = _norm_tx(payload.get("txHash") or payload.get("tx") or payload.get("hash"))
    if not tx:
        return {"ok": False, "error": "missing txHash"}
    wallet = _norm_addr(payload.get("wallet") or payload.get("address"))
    side_raw = str(payload.get("side") or "").lower()
    if side_raw in ("buy", "sell"):
        side = side_raw
    else:
        # Infer from token symbols when possible.
        token_out = str(payload.get("tokenOut") or payload.get("token_out") or "").upper()
        token_in = str(payload.get("tokenIn") or payload.get("token_in") or "").upper()
        if "BITE" in token_out or token_out == "$BITE":
            side = "buy"
        elif "BITE" in token_in or token_in == "$BITE":
            side = "sell"
        else:
            side = "unknown"
    fee_token = str(payload.get("feeToken") or "").upper()
    if fee_token not in ("BITE", "AAPL"):
        fee_token = "BITE" if side == "buy" else "AAPL" if side == "sell" else "BITE"
    try:
        fee_raw = int(payload.get("feeRaw") or payload.get("fee_raw") or 0)
    except (TypeError, ValueError):
        fee_raw = 0
    record_native_swap(
        state,
        tx_hash=tx,
        wallet=wallet or None,
        side=side,
        fee_token=fee_token,
        fee_raw=fee_raw,
        block=payload.get("block"),
        ts=payload.get("ts"),
        source="client",
        amount_in=payload.get("amountIn") or payload.get("amount_in"),
        amount_out=payload.get("amountOut") or payload.get("amount_out"),
        token_in=payload.get("tokenIn") or payload.get("token_in"),
        token_out=payload.get("tokenOut") or payload.get("token_out"),
        client_confirmed=True,
    )
    return {"ok": True, "txHash": tx}


def _window_totals(ns: dict, *, since_ts: float) -> dict:
    totals = _empty_totals()
    wallets: set[str] = set()
    by_tx = ns.get("by_tx") or {}
    if not isinstance(by_tx, dict):
        return totals
    for rec in by_tx.values():
        if not isinstance(rec, dict):
            continue
        ts = float(rec.get("ts") or 0)
        if ts < since_ts:
            continue
        totals["swapCount"] += 1
        side = str(rec.get("side") or "")
        if side == "buy":
            totals["buyCount"] += 1
        elif side == "sell":
            totals["sellCount"] += 1
        if rec.get("clientConfirmed"):
            totals["clientConfirmed"] += 1
        token = str(rec.get("feeToken") or "")
        fee = int(rec.get("feeRaw") or 0)
        if token == "BITE":
            totals["feeBiteRaw"] += fee
        elif token == "AAPL":
            totals["feeAaplRaw"] += fee
        w = _norm_addr(rec.get("wallet"))
        if w:
            wallets.add(w)
    totals["uniqueWallets"] = len(wallets)
    return totals


def summarize_native_swaps(
    state: dict,
    *,
    bite_price_usd: float | None = None,
    aapl_price_usd: float | None = None,
) -> dict:
    """Public KPI payload for /swap-stats and admin reports."""
    ns = ensure_native_swaps(state)
    _recompute_all_time(ns)
    now = time.time()
    all_time = dict(ns.get("all_time") or _empty_totals())
    h24 = _window_totals(ns, since_ts=now - NATIVE_SWAP_H24_SEC)

    def enrich(block: dict) -> dict:
        fee_bite = int(block.get("feeBiteRaw") or 0)
        fee_aapl = int(block.get("feeAaplRaw") or 0)
        vol_bite = _fee_to_volume_raw(fee_bite)
        vol_aapl = _fee_to_volume_raw(fee_aapl)
        out = {
            **block,
            "feeBite": fee_bite / 10**18,
            "feeAapl": fee_aapl / 10**18,
            "estVolumeBite": vol_bite / 10**18,
            "estVolumeAapl": vol_aapl / 10**18,
            "feeBips": NATIVE_SWAP_FEE_BIPS,
        }
        usd = 0.0
        usd_ok = False
        if bite_price_usd and fee_bite:
            usd += (fee_bite / 10**18) * bite_price_usd
            usd_ok = True
        if aapl_price_usd and fee_aapl:
            usd += (fee_aapl / 10**18) * aapl_price_usd
            usd_ok = True
        out["feeUsd"] = round(usd, 4) if usd_ok else None
        vol_usd = 0.0
        vol_ok = False
        if bite_price_usd and vol_bite:
            vol_usd += (vol_bite / 10**18) * bite_price_usd
            vol_ok = True
        if aapl_price_usd and vol_aapl:
            vol_usd += (vol_aapl / 10**18) * aapl_price_usd
            vol_ok = True
        out["estVolumeUsd"] = round(vol_usd, 2) if vol_ok else None
        return out

    return {
        "definition": (
            "Native swap = bite.party SwapModal / Trading API path with "
            f"integratorFees → kitchen ({NATIVE_SWAP_FEE_BIPS} bips of output). "
            "On-chain proxy: Transfer→kitchen from Uniswap routers (fee skim ≈ in-app). "
            "Not all-chain DEX volume."
        ),
        "mode": ns.get("mode") or NATIVE_SWAP_INDEX_MODE,
        "cursor": int(ns.get("cursor") or 0),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "allTime": enrich(all_time),
        "h24": enrich(h24),
        "limits": (
            "Fee-skim proxy can include rare non-fee router hops to kitchen; "
            "volume is estimated as fee × 10000/bips. Client-confirmed txs "
            "are marked when SwapModal reports success."
        ),
    }


def make_tx_from_lookup(w3, cache: dict | None = None) -> Callable[[str], str | None]:
    """Cached eth_getTransactionByHash → from."""
    store = cache if cache is not None else {}

    def lookup(tx_hash: str) -> str | None:
        key = _norm_tx(tx_hash)
        if key in store:
            return store[key]
        if not w3:
            store[key] = None
            return None
        try:
            tx = w3.eth.get_transaction(key)
            frm = _norm_addr(tx.get("from") if isinstance(tx, dict) else getattr(tx, "from", None))
            store[key] = frm or None
            return store[key]
        except Exception:
            store[key] = None
            return None

    return lookup
