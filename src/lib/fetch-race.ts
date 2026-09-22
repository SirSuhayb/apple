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
import { fetchAct1Leaderboard } from "./act1-leaderboard";
import { fetchDecaySnapshot } from "./fetch-decay";
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
    let lastEatAt = 0;

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

    const weatherPromise = fetchDecaySnapshot().catch(() => null);

    if (APPLE_KITCHEN) {
      const [b, ct, dl, ph, pot, kitchenBiteBalance] = await Promise.all([
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
        // Sweep burns: BITE sent directly to kitchen (not via bite())
        BITE_TOKEN
          ? client.readContract({
              address: BITE_TOKEN,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [APPLE_KITCHEN],
            })
          : BigInt(0),
      ]);
      // kitchen.burned() + any BITE sitting in kitchen = total kitchen burns
      burned = b + kitchenBiteBalance;
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
    const phase = phaseFromKitchen(kitchenPhase, clamped, secondsLeft);

    const weather = await weatherPromise;
    lastEatAt = weather?.lastEatAt && weather.lastEatAt > 0 ? weather.lastEatAt : 0;
    const quietRotPreview = weather?.quietRotPreview ?? false;
    const decay = weather?.decay ?? 0;

    // Use real bot leaderboard data instead of demo eaters
    let realEaters: RaceState["eaters"] = [];
    try {
      const act1 = await fetchAct1Leaderboard();
      realEaters = act1.eaters;
    } catch {
      // fall back to empty if bot data unavailable
    }

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
      decay,
      decayBreakdown: weather?.breakdown,
      decayFloors: weather?.floors,
      lastEatSource: weather?.lastEatSource ?? null,
      potAapl: formatEther(potAapl),
      eaters: realEaters.length > 0 ? realEaters : scaffold.eaters,
      tape: [],
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