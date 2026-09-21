#!/usr/bin/env bash
# Deploy AppleKitchen to Robinhood Chain (4663).
# Requires contracts/.env with PRIVATE_KEY + BITE_TOKEN (never commit).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:=https://rpc.mainnet.chain.robinhood.com}"
: "${AAPL_TOKEN:=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9}"
: "${CORE_TARGET:=500000000000000000000000000}"
: "${MIN_HOLD:=1000000000000000000}"
: "${MIN_CONSUMPTION:=1}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  echo "Add the deployer key, then re-run: ./scripts/deploy-kitchen.sh"
  exit 1
fi

if [[ -z "${BITE_TOKEN:-}" ]]; then
  echo "Missing BITE_TOKEN in contracts/.env — set your token address."
  exit 1
fi

DEPLOYER_FROM_KEY="$(cast wallet address --private-key "$PRIVATE_KEY")"
: "${DEPLOYER:=$DEPLOYER_FROM_KEY}"
: "${OWNER:=$DEPLOYER}"

if [[ -z "${DEADLINE:-}" ]]; then
  DEADLINE=$(($(date +%s) + 30 * 24 * 60 * 60))
  echo "DEADLINE unset — using now+30d = $DEADLINE"
fi

export RPC_URL BITE_TOKEN AAPL_TOKEN DEPLOYER OWNER CORE_TARGET DEADLINE MIN_HOLD MIN_CONSUMPTION

echo "Deploying AppleKitchen…"
echo "  token=$BITE_TOKEN"
echo "  quote=$AAPL_TOKEN"
echo "  deployer=$DEPLOYER"
echo "  coreTarget=$CORE_TARGET"
echo "  deadline=$DEADLINE"

forge script script/DeployKitchen.s.sol:DeployKitchen \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv
