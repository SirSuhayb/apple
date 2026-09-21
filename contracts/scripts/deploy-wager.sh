#!/usr/bin/env bash
# Deploy MetaWager to Robinhood Chain (4663).
# Requires contracts/.env with PRIVATE_KEY + BITE_TOKEN + KITCHEN_CONTRACT (never commit).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:=https://rpc.mainnet.chain.robinhood.com}"
: "${WAGER_FEE_BPS:=1000}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  echo "Add the deployer key, then re-run: ./scripts/deploy-wager.sh"
  exit 1
fi

if [[ -z "${BITE_TOKEN:-}" || -z "${KITCHEN_CONTRACT:-}" ]]; then
  echo "Missing BITE_TOKEN and/or KITCHEN_CONTRACT in contracts/.env."
  exit 1
fi

DEPLOYER_FROM_KEY="$(cast wallet address --private-key "$PRIVATE_KEY")"
: "${DEPLOYER:=$DEPLOYER_FROM_KEY}"
: "${OWNER:=$DEPLOYER}"

export RPC_URL BITE_TOKEN KITCHEN_CONTRACT DEPLOYER OWNER WAGER_FEE_BPS

echo "Deploying MetaWager…"
echo "  token=$BITE_TOKEN"
echo "  kitchen=$KITCHEN_CONTRACT"
echo "  farmer=$DEPLOYER"
echo "  feeBps=$WAGER_FEE_BPS"

forge script script/DeployMetaWager.s.sol:DeployMetaWager \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv
