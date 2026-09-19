import { NextResponse } from "next/server";
import { V4_POOL_ID } from "@/lib/config";
import {
  LP_FEE_POOL_ID,
  LP_SEED_FEE_PIPS,
  LP_SEED_HOOK,
  LP_SEED_TICK_SPACING,
  syntheticSeedPool,
} from "@/lib/uniswap-lp";
import { lookupPools, poolById } from "@/lib/uniswap-lp-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handlePoolInfo() {
  try {
    const pools = await lookupPools([LP_FEE_POOL_ID, V4_POOL_ID]);
    const seed = poolById(pools, LP_FEE_POOL_ID);
    const liveZeroFee = poolById(pools, V4_POOL_ID);
    return NextResponse.json(
      {
        pools,
        seed: {
          exists: Boolean(seed),
          fee: LP_SEED_FEE_PIPS,
          tickSpacing: LP_SEED_TICK_SPACING,
          hookAddress: LP_SEED_HOOK,
          poolId: LP_FEE_POOL_ID,
          pool: seed ?? syntheticSeedPool(),
        },
        liveZeroFee,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pool lookup failed";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET() {
  return handlePoolInfo();
}

export async function POST() {
  return handlePoolInfo();
}
