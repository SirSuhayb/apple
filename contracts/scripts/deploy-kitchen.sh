#!/usr/bin/env bash
# Deploy AppleKitchen to Robinhood Chain (4663).
# Requires contracts/.env with PRIVATE_KEY (never commit).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${RPC_URL:=https://rpc.mainnet.chain.robinhood.com}"
: "${BITE_TOKEN:=0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9}"
: "${AAPL_TOKEN:=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9}"
: "${DEPLOYER:=0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E}"
: "${OWNER:=$DEPLOYER}"
: "${CORE_TARGET:=500000000000000000000000000}"
: "${MIN_HOLD:=1000000000000000000}"
: "${MIN_CONSUMPTION:=1}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  echo "Add the deployer key, then re-run: ./scripts/deploy-kitchen.sh"
  exit 1
fi

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
