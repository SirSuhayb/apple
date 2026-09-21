#!/usr/bin/env bash
# Deploy V4KitchenRouter to Robinhood Chain (4663).
# Does NOT call kitchen.setRouter — the kitchen owner must do that.
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
: "${AAPL_TOKEN:=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9}"
: "${UNISWAP_POOL_MANAGER:=0x8366a39CC670B4001A1121B8F6A443A643e40951}"
: "${V4_POOL_FEE:=0}"
: "${V4_TICK_SPACING:=200}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  exit 1
fi

for required in BITE_TOKEN KITCHEN_CONTRACT V4_HOOKS V4_POOL_ID; do
  if [[ -z "${!required:-}" ]]; then
    echo "Missing $required in contracts/.env."
    exit 1
  fi
done

export RPC_URL BITE_TOKEN AAPL_TOKEN UNISWAP_POOL_MANAGER V4_HOOKS V4_POOL_FEE V4_TICK_SPACING V4_POOL_ID KITCHEN_CONTRACT

echo "Deploying V4KitchenRouter (will NOT call setRouter)…"
echo "  poolManager=$UNISWAP_POOL_MANAGER"
echo "  aapl=$AAPL_TOKEN"
echo "  bite=$BITE_TOKEN"
echo "  hooks=$V4_HOOKS"
echo "  kitchen=$KITCHEN_CONTRACT"

forge script script/DeployV4KitchenRouter.s.sol:DeployV4KitchenRouter \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv
