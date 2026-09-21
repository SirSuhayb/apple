#!/usr/bin/env bash
# Deploy MetaWager to Robinhood Chain (4663).
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
: "${KITCHEN_CONTRACT:=0x56fEb999D829761C787581413605bf88F5Cd81e0}"
: "${DEPLOYER:=0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E}"
: "${OWNER:=$DEPLOYER}"
: "${WAGER_FEE_BPS:=1000}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  echo "Add the deployer key, then re-run: ./scripts/deploy-wager.sh"
  exit 1
fi

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
