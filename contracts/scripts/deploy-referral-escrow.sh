#!/usr/bin/env bash
# Deploy ReferralEscrow (UUPS proxy) to Robinhood Chain (4663).
# Uses the same PRIVATE_KEY as AppleKitchen deploy. Never commit .env.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:=https://rpc.mainnet.chain.robinhood.com}"
: "${REWARD_PER_REFERRAL:=100000000000000000000}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  echo "Add the kitchen deployer key (same as deploy-kitchen.sh), then re-run:"
  echo "  ./scripts/deploy-referral-escrow.sh"
  exit 1
fi

if [[ -z "${BITE_TOKEN:-}" ]]; then
  echo "Missing BITE_TOKEN in contracts/.env — set your token address."
  exit 1
fi

DEPLOYER_ADDR="$(cast wallet address --private-key "$PRIVATE_KEY")"
# Always owner+attester = signing deployer so UUPS upgrades work with this key.
# Rotate later via setAttester / transferOwnership if desired.
OWNER="$DEPLOYER_ADDR"
ATTESTER="$DEPLOYER_ADDR"

export RPC_URL BITE_TOKEN REWARD_PER_REFERRAL OWNER ATTESTER PRIVATE_KEY

echo "Deploying ReferralEscrow (UUPS)…"
echo "  token=$BITE_TOKEN"
echo "  owner=$OWNER"
echo "  attester=$ATTESTER"
echo "  rewardPerReferral=$REWARD_PER_REFERRAL"
echo "  deployer=$DEPLOYER_ADDR"
echo "  rpc=$RPC_URL"

forge script script/DeployReferralEscrow.s.sol:DeployReferralEscrow \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv
