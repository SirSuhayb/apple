import { createPublicClient, formatEther, http } from "viem";
import { appleKitchenAbi, bondingCurveAbi, erc20Abi } from "./abis";
import { robinhoodChain } from "./chain";
import {
  APPLE_KITCHEN,
  BITE_CURVE,
  BITE_TOKEN,
  CORE_TARGET_FRACTION,
  DEFAULT_DEADLINE_DAYS,
  RPC_URL,
  TOTAL_SUPPLY,
  isLive,
} from "./config";
import { copy } from "./copy";
import { emptyLiveScaffold, buildDemoRaceState } from "./demo-state";
import {
  type RacePhase,
  type RaceState,
  computeCoreTarget,
  progressToFrame,
} from "./race";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC_URL),
});

function phaseFromKitchen(phase: number, progress: number, secondsLeft: number): RacePhase {
  if (phase === 1) return "core";
  if (phase === 2) return "rot";
  if (secondsLeft <= 0 && progress < 1) return "rot";
  return "racing";
}

export async function fetchRaceState(): Promise<RaceState> {
  if (!isLive || !BITE_TOKEN) {
    return buildDemoRaceState();
  }

  try {
    let burned = BigInt(0);
    let coreTarget = BigInt(0);
    let burnable = BigInt(0);
    let reserved = BigInt(0);
    let totalSupply = TOTAL_SUPPLY;
    let deadline =
      Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60;
    let potAapl = BigInt(0);
    let kitchenPhase = 0;
    let lastEatAt = Math.floor(Date.now() / 1000);

    try {
      totalSupply = await client.readContract({
        address: BITE_TOKEN,
        abi: erc20Abi,
        functionName: "totalSupply",
      });
    } catch {
      // keep default
    }

    if (BITE_CURVE) {
      try {
        reserved = await client.readContract({
          address: BITE_CURVE,
          abi: bondingCurveAbi,
          functionName: "reservedTokens",
        });
      } catch {
        reserved = BigInt(0);
      }
    }

    const computed = computeCoreTarget(
      totalSupply,
      reserved,
      CORE_TARGET_FRACTION,
    );
    burnable = computed.burnable;
    coreTarget = computed.coreTarget;

    if (APPLE_KITCHEN) {
      const [b, ct, dl, ph, pot] = await Promise.all([
        client.readContract({
          address: APPLE_KITCHEN,
          abi: appleKitchenAbi,
          functionName: "burned",
        }),
        client.readContract({
          address: APPLE_KITCHEN,
          abi: appleKitchenAbi,
          functionName: "coreTarget",
        }),
        client.readContract({
          address: APPLE_KITCHEN,
          abi: appleKitchenAbi,
          functionName: "deadline",
        }),
        client.readContract({
          address: APPLE_KITCHEN,
          abi: appleKitchenAbi,
          functionName: "phase",
        }),
        client.readContract({
          address: APPLE_KITCHEN,
          abi: appleKitchenAbi,
          functionName: "prizePool",
        }),
      ]);
      burned = b;
      coreTarget = ct;
      deadline = Number(dl);
      kitchenPhase = Number(ph);
      potAapl = pot;
    }

    const progress =
      coreTarget === BigInt(0) ? 0 : Number(burned) / Number(coreTarget);
    const clamped = Math.min(1, Math.max(0, progress));
    const now = Math.floor(Date.now() / 1000);
    const secondsLeft = Math.max(0, deadline - now);
    const quietRotPreview = now - lastEatAt > 48 * 60 * 60;
    const phase = phaseFromKitchen(kitchenPhase, clamped, secondsLeft);

    const scaffold = emptyLiveScaffold();
    return {
      ...scaffold,
      live: true,
      phase,
      burned: burned.toString(),
      coreTarget: coreTarget.toString(),
      burnable: burnable.toString(),
      reserved: reserved.toString(),
      totalSupply: totalSupply.toString(),
      progress: clamped,
      appleFrame: progressToFrame(clamped),
      deadline,
      secondsLeft,
      lastEatAt,
      quietRotPreview,
      potAapl: formatEther(potAapl),
      message:
        phase === "core"
          ? copy.messages.core
          : phase === "rot"
            ? copy.messages.rot
            : copy.messages.racing((clamped * 100).toFixed(1)),
    };
  } catch (err) {
    const fallback = buildDemoRaceState();
    return {
      ...fallback,
      live: true,
      message: copy.messages.liveFailed(
        err instanceof Error ? err.message : String(err),
      ),
    };
  }
}