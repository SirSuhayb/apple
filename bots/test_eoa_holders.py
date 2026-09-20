"""Unit tests for EOA holder definition (no RPC / API)."""

from __future__ import annotations

import unittest

from bite_bot import (
    DEAD_ADDRESS,
    KITCHEN_CONTRACT,
    _blockscout_addr_is_contract,
    _blockscout_payload_ok,
    all_time_recipients,
    count_eoa_holders,
    eoa_holder_balances,
    is_valid_eoa_holder,
)

EOA = "0x1111111111111111111111111111111111111111"
EOA2 = "0x2222222222222222222222222222222222222222"
SOLD_OUT = "0x3333333333333333333333333333333333333333"
POOL = "0x8366a39cc670b4001a1121b8f6a443a643e40951"


class EoaHolderDefinitionTests(unittest.TestCase):
    def test_balance_and_protocol_rules(self):
        self.assertTrue(is_valid_eoa_holder(EOA, 1))
        self.assertFalse(is_valid_eoa_holder(EOA, 0))
        self.assertFalse(is_valid_eoa_holder(KITCHEN_CONTRACT, 10**18))
        self.assertFalse(is_valid_eoa_holder(DEAD_ADDRESS, 10**18))
        self.assertFalse(is_valid_eoa_holder(POOL, 10**18))
        self.assertFalse(is_valid_eoa_holder(EOA, 1, is_contract=True))
        # EIP-7702 is classified upstream as is_contract=False
        self.assertTrue(is_valid_eoa_holder(EOA, 1, is_contract=False))
        self.assertFalse(
            is_valid_eoa_holder(EOA, 1, contract_addrs={EOA.lower()})
        )

    def test_prefers_current_blockscout_rows(self):
        state = {
            "current_token_holders": [
                {"address": EOA, "value": str(5 * 10**18), "is_contract": False},
                {
                    "address": KITCHEN_CONTRACT.lower(),
                    "value": str(9 * 10**18),
                    "is_contract": True,
                },
                {"address": SOLD_OUT, "value": "0", "is_contract": False},
            ],
            "points": {
                SOLD_OUT: {"last_balance_raw": 99 * 10**18},
                EOA2: {"last_balance_raw": 3 * 10**18},
            },
            "known_holders": [EOA, EOA2, SOLD_OUT, KITCHEN_CONTRACT],
            "contract_addrs": [KITCHEN_CONTRACT.lower(), POOL],
        }
        bals = eoa_holder_balances(state)
        self.assertEqual(bals, [(EOA, 5 * 10**18)])
        self.assertEqual(count_eoa_holders(state), 1)
        self.assertEqual(all_time_recipients(state), 4)

    def test_points_fallback_skips_sold_out_and_contracts(self):
        state = {
            "points": {
                EOA: {"last_balance_raw": 2 * 10**18},
                SOLD_OUT: {"last_balance_raw": 0},
                POOL: {"last_balance_raw": 100 * 10**18},
            },
            "contract_addrs": [POOL],
            "known_holders": [EOA, SOLD_OUT, POOL],
        }
        self.assertEqual(count_eoa_holders(state), 1)
        self.assertEqual(eoa_holder_balances(state)[0][0], EOA.lower())

    def test_blockscout_payload_rejects_credit_errors(self):
        self.assertFalse(_blockscout_payload_ok({"error": "Out of credits"}))
        self.assertFalse(_blockscout_payload_ok(None))
        self.assertTrue(_blockscout_payload_ok({"items": []}))

    def test_blockscout_eip7702_not_treated_as_contract(self):
        self.assertFalse(
            _blockscout_addr_is_contract(
                {"hash": EOA, "is_contract": True, "proxy_type": "eip7702"}
            )
        )
        self.assertFalse(
            _blockscout_addr_is_contract(
                {"hash": EOA, "is_contract": True, "proxy_type": "EIP-7702"}
            )
        )
        self.assertTrue(
            _blockscout_addr_is_contract(
                {"hash": POOL, "is_contract": True, "proxy_type": None}
            )
        )

    def test_fallback_clears_frozen_snapshot_without_rpc(self):
        from bite_bot import _fallback_rpc_holders

        state = {
            "current_token_holders": [
                {"address": EOA, "value": str(10**18), "is_contract": False},
            ],
            "current_token_holders_complete": True,
            "points": {
                EOA: {"last_balance_raw": 10**18},
                EOA2: {"last_balance_raw": 2 * 10**18},
            },
            "known_holders": [EOA, EOA2],
            "contract_addrs": [],
            "market": {},
        }
        _fallback_rpc_holders(state, contract=None, reason="test")
        self.assertNotIn("current_token_holders", state)
        self.assertEqual(state["holder_count"], 2)
        self.assertEqual(state["market"]["blockscout"]["holdersEoa"], 2)


if __name__ == "__main__":
    unittest.main()
