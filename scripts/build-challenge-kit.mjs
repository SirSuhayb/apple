#!/usr/bin/env node
/**
 * Packs the $BITE challenge builder media kit into
 * public/challenge/bite-builder-kit.zip
 *
 * Usage: npm run challenge-kit
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "challenge");
const outZip = join(outDir, "bite-builder-kit.zip");
const kitSrc = join(root, "public", "challenge", "builder-kit");

const addresses = {
  chainId: 4663,
  chainName: "Robinhood Chain",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  site: "https://www.bite.party",
  challenge: "https://www.bite.party/challenge",
  biteToken: "0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9",
  aaplToken: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  appleKitchen: "0x56fEb999D829761C787581413605bf88F5Cd81e0",
  ponsLaunchpad: `https://www.ponsfamily.com/launchpad/0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9`,
  apis: {
    race: "https://www.bite.party/api/race",
    leaderboard: "https://www.bite.party/api/leaderboard",
    supply: "https://www.bite.party/api/supply",
    circulatingSupply: "https://www.bite.party/api/circulating-supply",
  },
};

const brand = {
  name: "$BITE",
  tagline: "Eat it to the core.",
  colors: {
    bg: "#fbfbfd",
    bgElevated: "#ffffff",
    bgLight: "#f5f5f7",
    ink: "#1d1d1f",
    inkMuted: "#6e6e73",
    inkFaint: "#86868b",
    line: "#d2d2d7",
    accent: "#2997ff",
    bite: "#e53935",
    success: "#34c759",
  },
  fonts: {
    display: "Sora",
    mono: "JetBrains Mono",
  },
};

async function main() {
  if (!existsSync(join(root, "public", "apple", "stills"))) {
    throw new Error("Missing public/apple/stills — run npm run export-apple-stills");
  }
  if (!existsSync(join(root, "public", "apple", "frames", "0.glb"))) {
    throw new Error("Missing public/apple/frames — run npm run bake-apple");
  }

  mkdirSync(kitSrc, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(kitSrc, "addresses.json"), JSON.stringify(addresses, null, 2) + "\n");
  writeFileSync(join(kitSrc, "brand.json"), JSON.stringify(brand, null, 2) + "\n");

  writeFileSync(
    join(kitSrc, "API.md"),
    `# $BITE APIs

Base: \`https://www.bite.party\`

All endpoints are CORS-friendly JSON. No auth.

## Race

\`\`\`bash
curl -s https://www.bite.party/api/race | jq .
\`\`\`

Progress, phase (\`racing\` / \`core\` / \`rot\`), deadline, burned supply, eaters snapshot.

## Leaderboard

\`\`\`bash
curl -s https://www.bite.party/api/leaderboard | jq .
\`\`\`

Live eater ranks + supply breakdown.

## Supply

\`\`\`bash
curl -s https://www.bite.party/api/supply | jq .
\`\`\`

## Circulating supply

\`\`\`bash
curl -s https://www.bite.party/api/circulating-supply
\`\`\`

Plain number or JSON depending on consumer — see site for live shape.

## Onchain

- Chain: Robinhood Chain \`4663\`
- See \`addresses.json\` for token + AppleKitchen
- Kitchen methods: \`bite(uint256)\`, \`digest()\`, views for \`burned\`, \`coreTarget\`, \`deadline\`, \`phase\`, \`prizePool\`

## Apple assets in this kit

| Path | Use |
| --- | --- |
| \`stills/frame-00.png\` … \`frame-09.png\` | 2D stop-motion / UI |
| \`frames/0.glb\` … \`9.glb\` | 3D bite stages (meshopt) |
| \`frames/manifest.json\` | Frame metadata |

Credit Eydeet (CC BY 4.0) — see \`LICENSE-APPLE.txt\`.
`,
  );

  writeFileSync(
    join(kitSrc, "README.md"),
    `# $BITE Builder Kit

Starter media + API pack for the **1,000,000 $BITE** challenge (prizes in **$BITE**, not USD).

Site: https://www.bite.party/challenge

## What's inside

- \`stills/\` — PNG apple frames (0–9)
- \`frames/\` — GLB apple frames (0–9) + manifest
- \`brand.json\` — colors + type
- \`addresses.json\` — chain, token, kitchen, API URLs
- \`API.md\` — quickstart curls
- \`LICENSE-APPLE.txt\` — Eydeet CC BY 4.0 credit (required)

## Challenge must-haves

1. Use these official apple assets
2. Hit at least one live API or contract
3. Public demo URL + 60s video
4. Open repo (or reproducible build)

## Prize purse (paid in $BITE)

| Place | Amount |
| --- | --- |
| 1st | 400,000 $BITE |
| 2nd | 250,000 $BITE |
| 3rd | 175,000 $BITE |
| 4th | 100,000 $BITE |
| 5th | 75,000 $BITE |

**Total: 1,000,000 $BITE — not USD.**

## Rebuild this zip

From the site repo:

\`\`\`bash
npm run challenge-kit
\`\`\`
`,
  );

  const licenseSrc = join(root, "public", "apple", "LICENSE.txt");
  if (existsSync(licenseSrc)) {
    writeFileSync(join(kitSrc, "LICENSE-APPLE.txt"), readFileSync(licenseSrc));
  }

  const staging = await mkdtemp(join(tmpdir(), "bite-kit-"));
  const packRoot = join(staging, "bite-builder-kit");
  mkdirSync(packRoot, { recursive: true });

  try {
    await cp(kitSrc, packRoot, { recursive: true });
    await cp(join(root, "public", "apple", "stills"), join(packRoot, "stills"), {
      recursive: true,
    });
    await cp(join(root, "public", "apple", "frames"), join(packRoot, "frames"), {
      recursive: true,
    });

    // Prefer system zip for broad compatibility
    if (existsSync(outZip)) {
      await rm(outZip);
    }
    const result = spawnSync(
      "zip",
      ["-r", "-q", outZip, "bite-builder-kit"],
      { cwd: staging, stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error(`zip failed with status ${result.status}`);
    }

    const { statSync } = await import("node:fs");
    const mb = (statSync(outZip).size / (1024 * 1024)).toFixed(1);
    console.log(`Wrote ${outZip} (${mb} MB)`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
