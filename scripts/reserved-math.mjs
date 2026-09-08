/**
 * Compute AppleKitchen coreTarget = 50% of burnable supply.
 *
 * burnable = totalSupply - reservedTokens (pons LP floor that cannot be burned)
 *
 * Usage (after launch):
 *   BITE_TOKEN=0x... BITE_CURVE=0x... npm run reserved-math
 */
import { createPublicClient, formatEther, http } from "viem";

const RPC =
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.RPC_URL ??
  "https://rpc.mainnet.chain.robinhood.com";

const TOKEN = process.env.BITE_TOKEN ?? process.env.NEXT_PUBLIC_BITE_TOKEN;
const CURVE = process.env.BITE_CURVE ?? process.env.NEXT_PUBLIC_BITE_CURVE;
const FRACTION = Number(process.env.CORE_TARGET_FRACTION ?? "0.5");

const erc20Abi = [
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

const curveAbi = [
  {
    type: "function",
    name: "reservedTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

function compute(totalSupply, reserved, fraction) {
  const burnable = totalSupply > reserved ? totalSupply - reserved : 0n;
  const coreTarget =
    (burnable * BigInt(Math.round(fraction * 10_000))) / 10_000n;
  return { burnable, coreTarget };
}

async function main() {
  if (!TOKEN) {
    console.log(
      "Set BITE_TOKEN (and ideally BITE_CURVE) after you launch on pons.\n",
    );
    const demoTotal = 1_000_000_000n * 10n ** 18n;
    const demoReserved = demoTotal / 5n;
    const { burnable, coreTarget } = compute(
      demoTotal,
      demoReserved,
      FRACTION,
    );
    console.log("Demo (20% LP floor):");
    console.log("  totalSupply ", formatEther(demoTotal));
    console.log("  reserved    ", formatEther(demoReserved));
    console.log("  burnable    ", formatEther(burnable));
    console.log(
      "  coreTarget  ",
      formatEther(coreTarget),
      `(${FRACTION * 100}% of burnable)`,
    );
    process.exit(0);
  }

  const client = createPublicClient({
    transport: http(RPC),
  });

  const totalSupply = await client.readContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "totalSupply",
  });

  let reserved = 0n;
  if (CURVE) {
    reserved = await client.readContract({
      address: CURVE,
      abi: curveAbi,
      functionName: "reservedTokens",
    });
  } else {
    console.warn(
      "No BITE_CURVE — reservedTokens assumed 0 (core target may be too high).",
    );
  }

  const { burnable, coreTarget } = compute(totalSupply, reserved, FRACTION);

  console.log(
    JSON.stringify(
      {
        token: TOKEN,
        curve: CURVE ?? null,
        totalSupply: totalSupply.toString(),
        reserved: reserved.toString(),
        burnable: burnable.toString(),
        coreTarget: coreTarget.toString(),
        fraction: FRACTION,
        human: {
          totalSupply: formatEther(totalSupply),
          reserved: formatEther(reserved),
          burnable: formatEther(burnable),
          coreTarget: formatEther(coreTarget),
        },
        forgeEnv: {
          CORE_TARGET: coreTarget.toString(),
          DEADLINE: String(
            Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          ),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
