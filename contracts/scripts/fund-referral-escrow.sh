#!/usr/bin/env bash
# Set Windfall reward (default 250k BITE) and optionally deposit into ReferralEscrow proxy.
# Never commit .env / private keys.
#
# Usage:
#   ./scripts/fund-referral-escrow.sh                  # set reward only
#   DEPOSIT_AMOUNT=4000000000000000000000000 ./scripts/fund-referral-escrow.sh
#   # ^ 4M BITE (top up existing 1M → 5M = 20 × 250k)
#
# Signer = contracts/.env PRIVATE_KEY (must be escrow owner for setReward).
# Deposit requires that same wallet to hold enough $BITE (+ gas).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:=https://rpc.mainnet.chain.robinhood.com}"
: "${REFERRAL_ESCROW_PROXY:=0xc127327419D78C8546230463F8b421Bb66212660}"
# 250_000 BITE
: "${REWARD_PER_REFERRAL:=250000000000000000000000}"
# 0 = skip deposit
: "${DEPOSIT_AMOUNT:=0}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  exit 1
fi

if [[ -z "${BITE_TOKEN:-}" ]]; then
  echo "Missing BITE_TOKEN in contracts/.env"
  exit 1
fi

SIGNER="$(cast wallet address --private-key "$PRIVATE_KEY")"
OWNER_ONCHAIN="$(cast call "$REFERRAL_ESCROW_PROXY" "owner()(address)" --rpc-url "$RPC_URL")"
BAL="$(cast call "$BITE_TOKEN" "balanceOf(address)(uint256)" "$SIGNER" --rpc-url "$RPC_URL")"
ESCROW_BAL="$(cast call "$REFERRAL_ESCROW_PROXY" "escrowBalance()(uint256)" --rpc-url "$RPC_URL")"
OLD_REWARD="$(cast call "$REFERRAL_ESCROW_PROXY" "rewardPerReferral()(uint256)" --rpc-url "$RPC_URL")"

echo "Fund ReferralEscrow"
echo "  proxy=$REFERRAL_ESCROW_PROXY"
echo "  token=$BITE_TOKEN"
echo "  signer=$SIGNER"
echo "  ownerOnchain=$OWNER_ONCHAIN"
echo "  signerBite=$BAL"
echo "  escrowBite=$ESCROW_BAL"
echo "  oldReward=$OLD_REWARD"
echo "  newReward=$REWARD_PER_REFERRAL"
echo "  deposit=$DEPOSIT_AMOUNT"
echo "  rpc=$RPC_URL"

SIGNER_LC="$(printf '%s' "$SIGNER" | tr '[:upper:]' '[:lower:]')"
OWNER_LC="$(printf '%s' "$OWNER_ONCHAIN" | tr '[:upper:]' '[:lower:]')"
if [[ "$SIGNER_LC" != "$OWNER_LC" ]]; then
  echo "ERROR: PRIVATE_KEY is not the escrow owner — setReward will revert."
  exit 1
fi

if [[ "$DEPOSIT_AMOUNT" != "0" ]]; then
  # Compare as integers via python (bash can't do bigints).
  python3 - "$BAL" "$DEPOSIT_AMOUNT" <<'PY'
import sys
bal, need = int(sys.argv[1]), int(sys.argv[2])
if bal < need:
    print(f"ERROR: signer BITE balance {bal} < DEPOSIT_AMOUNT {need}")
    print("Fund the owner wallet, then re-run with DEPOSIT_AMOUNT set.")
    sys.exit(1)
PY
fi

export RPC_URL BITE_TOKEN REFERRAL_ESCROW_PROXY REWARD_PER_REFERRAL DEPOSIT_AMOUNT PRIVATE_KEY

forge script script/FundReferralEscrow.s.sol:FundReferralEscrow \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv

echo "--- after ---"
cast call "$REFERRAL_ESCROW_PROXY" "rewardPerReferral()(uint256)" --rpc-url "$RPC_URL"
cast call "$REFERRAL_ESCROW_PROXY" "escrowBalance()(uint256)" --rpc-url "$RPC_URL"
cast call "$REFERRAL_ESCROW_PROXY" "remainingPayouts()(uint256)" --rpc-url "$RPC_URL"
