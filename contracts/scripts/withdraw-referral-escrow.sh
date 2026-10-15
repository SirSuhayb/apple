#!/usr/bin/env bash
# Reclaim leftover $BITE from ReferralEscrow (pause + withdraw).
# Never commit .env / private keys.
#
# Usage:
#   ./scripts/withdraw-referral-escrow.sh
#   WITHDRAW_TO=0x… ./scripts/withdraw-referral-escrow.sh
#   WITHDRAW_AMOUNT=1000000000000000000000000 ./scripts/withdraw-referral-escrow.sh
#   SKIP_PAUSE=1 ./scripts/withdraw-referral-escrow.sh   # withdraw only
#
# Signer = contracts/.env PRIVATE_KEY (must be escrow owner).
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
: "${WITHDRAW_TO:=}"
: "${WITHDRAW_AMOUNT:=0}"
: "${SKIP_PAUSE:=0}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  exit 1
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "Missing cast (foundry). Install: https://getfoundry.sh"
  exit 1
fi
if ! command -v forge >/dev/null 2>&1; then
  echo "Missing forge (foundry)."
  exit 1
fi

SIGNER="$(cast wallet address --private-key "$PRIVATE_KEY")"
OWNER_ONCHAIN="$(cast call "$REFERRAL_ESCROW_PROXY" "owner()(address)" --rpc-url "$RPC_URL")"
ESCROW_BAL="$(cast call "$REFERRAL_ESCROW_PROXY" "escrowBalance()(uint256)" --rpc-url "$RPC_URL")"
REMAINING="$(cast call "$REFERRAL_ESCROW_PROXY" "remainingPayouts()(uint256)" --rpc-url "$RPC_URL")"
PAUSED="$(cast call "$REFERRAL_ESCROW_PROXY" "paused()(bool)" --rpc-url "$RPC_URL")"

echo "Withdraw ReferralEscrow"
echo "  proxy=$REFERRAL_ESCROW_PROXY"
echo "  signer=$SIGNER"
echo "  ownerOnchain=$OWNER_ONCHAIN"
echo "  escrowBite=$ESCROW_BAL"
echo "  remainingPayouts=$REMAINING"
echo "  paused=$PAUSED"
echo "  withdrawTo=${WITHDRAW_TO:-<owner>}"
echo "  withdrawAmount=${WITHDRAW_AMOUNT:-<full balance>}"
echo "  skipPause=$SKIP_PAUSE"
echo "  rpc=$RPC_URL"

SIGNER_LC="$(printf '%s' "$SIGNER" | tr '[:upper:]' '[:lower:]')"
OWNER_LC="$(printf '%s' "$OWNER_ONCHAIN" | tr '[:upper:]' '[:lower:]')"
if [[ "$SIGNER_LC" != "$OWNER_LC" ]]; then
  echo "ERROR: PRIVATE_KEY is not the escrow owner — withdraw will revert."
  exit 1
fi

if [[ "$ESCROW_BAL" == "0" ]]; then
  echo "Escrow already empty — nothing to reclaim."
  exit 0
fi

export RPC_URL REFERRAL_ESCROW_PROXY SKIP_PAUSE PRIVATE_KEY
if [[ -n "$WITHDRAW_TO" ]]; then
  export WITHDRAW_TO
fi
export WITHDRAW_AMOUNT

forge script script/WithdrawReferralEscrow.s.sol:WithdrawReferralEscrow \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv

echo "--- after ---"
cast call "$REFERRAL_ESCROW_PROXY" "escrowBalance()(uint256)" --rpc-url "$RPC_URL"
cast call "$REFERRAL_ESCROW_PROXY" "remainingPayouts()(uint256)" --rpc-url "$RPC_URL"
cast call "$REFERRAL_ESCROW_PROXY" "paused()(bool)" --rpc-url "$RPC_URL"
