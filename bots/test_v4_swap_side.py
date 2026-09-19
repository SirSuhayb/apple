"""Unit tests for Uniswap v4 buy/sell classification (no RPC)."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from bite_bot import (
    V4_POOL_ID,
    V4_SWAP_TOPIC,
    apply_trade_events,
    commit_pending_sides,
    decode_v4_swap_log,
    v4_bite_swap_side,
    _decode_int128_word,
    _strip_buy_sell_keep_burns,
    _tally_side,
)


def _word(value: int) -> bytes:
    if value < 0:
        value = (1 << 256) + value
    return value.to_bytes(32, "big")


class V4SwapSideTests(unittest.TestCase):
    def test_amount0_sign_is_caller_delta(self):
        self.assertEqual(v4_bite_swap_side(276_253 * 10**18), "buy")
        self.assertEqual(v4_bite_swap_side(-13_378_106 * 10**18), "sell")
        self.assertIsNone(v4_bite_swap_side(0))

    def test_decode_int128_negative(self):
        raw = _word(-818_729_664_503_222_739_224)
        self.assertEqual(_decode_int128_word(raw), -818_729_664_503_222_739_224)

    def test_decode_swap_log_sell(self):
        amount0 = -276_253 * 10**18
        amount1 = 38_894_074_517_120_992
        log = {
            "topics": [
                V4_SWAP_TOPIC,
                V4_POOL_ID,
                "0x" + "8876789976decbfcbbbe364623c63652db8c0904".rjust(64, "0"),
            ],
            "data": "0x" + _word(amount0).hex() + _word(amount1).hex(),
            "transactionHash": "0x" + "ab" * 32,
            "blockNumber": 67_289_866,
        }
        item = decode_v4_swap_log(log)
        self.assertIsNotNone(item)
        self.assertEqual(item["side"], "sell")
        self.assertAlmostEqual(item["bite_amount"], 276_253.0)
        self.assertEqual(item["sender"], "0x8876789976decbfcbbbe364623c63652db8c0904")

    def test_decode_swap_log_buy(self):
        amount0 = 81_872 * 10**18
        log = {
            "topics": [
                V4_SWAP_TOPIC,
                V4_POOL_ID,
                "0x" + "6aa80dbbed9ae5ab45fbf61f9644fada3b29326e".rjust(64, "0"),
            ],
            "data": "0x" + _word(amount0).hex() + _word(-1).hex(),
            "transactionHash": "0x" + "cd" * 32,
            "blockNumber": 1,
        }
        item = decode_v4_swap_log(log)
        self.assertEqual(item["side"], "buy")
        self.assertAlmostEqual(item["bite_amount"], 81_872.0)

    def test_wrong_pool_ignored(self):
        log = {
            "topics": [
                V4_SWAP_TOPIC,
                "0x" + "11" * 32,
                "0x" + "22" * 32,
            ],
            "data": "0x" + _word(1).hex() + _word(1).hex(),
            "transactionHash": "0x" + "ee" * 32,
            "blockNumber": 1,
        }
        self.assertIsNone(decode_v4_swap_log(log))


class RemapKeepsBurnsTests(unittest.TestCase):
    def test_strip_buy_sell_keeps_burns(self):
        entry = {
            "points": 100.0,
            "buy_points": 10.0,
            "sell_points": 15.0,
            "burn_points": 50.0,
            "trade_count": 3,
            "sell_count": 2,
            "burn_count": 4,
            "burned_bite": 50.0,
        }
        _strip_buy_sell_keep_burns(entry)
        self.assertEqual(entry["points"], 75.0)
        self.assertEqual(entry["trade_count"], 0)
        self.assertEqual(entry["sell_count"], 0)
        self.assertEqual(entry["buy_points"], 0.0)
        self.assertEqual(entry["sell_points"], 0.0)
        self.assertEqual(entry["burn_count"], 4)
        self.assertEqual(entry["burned_bite"], 50.0)
        self.assertEqual(entry["burn_points"], 50.0)

    def test_commit_replaces_sides_only(self):
        wallet = "0x1111111111111111111111111111111111111111"
        state = {
            "points": {
                wallet: {
                    "points": 100.0,
                    "buy_points": 20.0,
                    "sell_points": 0.0,
                    "burn_points": 80.0,
                    "trade_count": 9,
                    "sell_count": 0,
                    "burn_count": 2,
                    "burned_bite": 80.0,
                }
            }
        }
        pending = {
            wallet: {"buys": 1, "sells": 2, "buy_pts": 5.0, "sell_pts": 7.5},
        }
        commit_pending_sides(state, pending)
        entry = state["points"][wallet]
        self.assertEqual(entry["trade_count"], 1)
        self.assertEqual(entry["sell_count"], 2)
        self.assertEqual(entry["buy_points"], 5.0)
        self.assertEqual(entry["sell_points"], 7.5)
        self.assertEqual(entry["burn_count"], 2)
        self.assertEqual(entry["burned_bite"], 80.0)
        self.assertEqual(entry["burn_points"], 80.0)
        # 100 - 20 - 0 + 5 + 7.5
        self.assertAlmostEqual(entry["points"], 92.5)
        commit_pending_sides(state, pending)
        self.assertAlmostEqual(entry["points"], 92.5)
        self.assertEqual(entry["burn_count"], 2)

    def test_tally_uses_correct_multipliers(self):
        dest = {}
        _tally_side(dest, "0xabc", "buy", 100.0)
        _tally_side(dest, "0xabc", "sell", 100.0)
        row = dest["0xabc"]
        self.assertEqual(row["buys"], 1)
        self.assertEqual(row["sells"], 1)
        self.assertAlmostEqual(row["buy_pts"], 1.0)  # 100 * 0.01
        self.assertAlmostEqual(row["sell_pts"], 1.5)  # 100 * 0.015


def _xfer(frm: str, to: str, value: int, tx: str):
    return SimpleNamespace(
        args={"from": frm, "to": to, "value": value},
        transactionHash=bytes.fromhex(tx[2:] if tx.startswith("0x") else tx),
    )


class SkipSwapTxTests(unittest.TestCase):
    def test_v4_tx_transfer_is_not_double_scored(self):
        router = "0x8876789976decbfcbbbe364623c63652db8c0904"
        user = "0x425dedb12a2b5acc511f70070f321cc3f028d2a5"
        tx = "0x" + "ab" * 32
        state = {
            "contract_addrs": [router],
            "eoa_addrs": [user],
            "points": {},
        }
        events = [_xfer(router, user, 273_490 * 10**18, tx)]
        hits = apply_trade_events(state, events, skip_tx_hashes={tx})
        self.assertEqual(hits, 0)
        self.assertEqual(state["points"], {})

    def test_non_v4_buy_still_counts(self):
        router = "0x8876789976decbfcbbbe364623c63652db8c0904"
        user = "0x425dedb12a2b5acc511f70070f321cc3f028d2a5"
        tx = "0x" + "cd" * 32
        state = {
            "contract_addrs": [router],
            "eoa_addrs": [user],
            "points": {},
        }
        events = [_xfer(router, user, 100 * 10**18, tx)]
        hits = apply_trade_events(state, events, skip_tx_hashes=set())
        self.assertEqual(hits, 1)
        entry = state["points"][user]
        self.assertEqual(entry["trade_count"], 1)
        self.assertAlmostEqual(entry["buy_points"], 1.0)


if __name__ == "__main__":
    unittest.main()
