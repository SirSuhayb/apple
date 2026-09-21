#!/usr/bin/env bash
# Deploy V4KitchenRouter to Robinhood Chain (4663).
# Does NOT call kitchen.setRouter — owner (sirsu.eth) must do that.
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
: "${UNISWAP_POOL_MANAGER:=0x8366a39CC670B4001A1121B8F6A443A643e40951}"
: "${V4_HOOKS:=0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044}"
: "${V4_POOL_FEE:=0}"
: "${V4_TICK_SPACING:=200}"
: "${V4_POOL_ID:=0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c}"
: "${KITCHEN_CONTRACT:=0x56fEb999D829761C787581413605bf88F5Cd81e0}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Missing PRIVATE_KEY in contracts/.env — cannot broadcast."
  exit 1
fi

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
