/**
 * Extract Sketchfab Eydeet stop-motion frames into web-ready GLBs.
 *
 * Source: public/apple/source/scene.gltf (11 Sketchfab frames: frame_10…frame_0)
 * Output: public/apple/frames/0.glb…9.glb
 *
 * Mapping (burn progress → bite stage):
 *   UI frame 0 (whole apple)  → Sketchfab frame_0  (animation start)
 *   UI frame 9 (toward core)  → Sketchfab frame_9
 *   (Sketchfab frame_10 = final bite leftover; unused for 10 UI stages)
 *
 * Run: npm run bake-apple
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  cloneDocument,
  dedup,
  prune,
  resample,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "public/apple/source/scene.gltf");
const OUT_DIR = path.join(ROOT, "public/apple/frames");

/** UI bite frame 0..9 → Sketchfab timeframe index 0..9 (animation start = whole). */
function sketchfabFrameIndex(uiFrame) {
  return uiFrame;
}

function disposeSubtree(node) {
  for (const child of [...node.listChildren()]) {
    disposeSubtree(child);
    node.removeChild(child);
  }
  node.setMesh(null);
  node.dispose();
}

async function bake() {
  await mkdir(OUT_DIR, { recursive: true });

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  console.log("Loading", SOURCE);
  const document = await io.read(SOURCE);

  document.getRoot().listAnimations().forEach((a) => a.dispose());

  for (let ui = 0; ui < 10; ui++) {
    const sf = sketchfabFrameIndex(ui);
    const keepName = `frame_${sf}`;
    console.log(`Baking UI frame ${ui} ← ${keepName}`);

    const clone = cloneDocument(document);
    const root = clone.getRoot();

    for (const node of [...root.listNodes()]) {
      const name = node.getName() || "";
      if (/^frame_\d+$/.test(name) && name !== keepName) {
        disposeSubtree(node);
      }
    }

    for (const node of root.listNodes()) {
      const name = node.getName() || "";
      if (
        name === keepName ||
        name.startsWith(`Apple_${String(sf).padStart(2, "0")}`)
      ) {
        node.setScale([1, 1, 1]);
      }
      if (name.startsWith("Object_")) {
        const kids = node.listChildren();
        if (kids.some((c) => (c.getName() || "") === keepName)) {
          node.setScale([1, 1, 1]);
        }
      }
    }

    await clone.transform(
      dedup(),
      weld(),
      resample(),
      prune(),
      textureCompress({
        encoder: sharp,
        targetFormat: "jpeg",
        resize: [1024, 1024],
        quality: 78,
        slots: /^(?!normalTexture).*$/,
      }),
      textureCompress({
        encoder: sharp,
        targetFormat: "jpeg",
        resize: [512, 512],
        quality: 70,
        slots: /normalTexture/,
      }),
      prune(),
    );

    const outPath = path.join(OUT_DIR, `${ui}.glb`);
    const bytes = await io.writeBinary(clone);
    await writeFile(outPath, bytes);
    console.log(
      `  → ${outPath} (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB)`,
    );

    const opt = spawnSync(
      "npx",
      [
        "--yes",
        "@gltf-transform/cli@4.2.1",
        "optimize",
        outPath,
        outPath,
        "--compress",
        "meshopt",
        "--texture-size",
        "1024",
        "--simplify",
        "false",
      ],
      { stdio: "inherit", cwd: ROOT },
    );
    if (opt.status !== 0) {
      console.warn("  meshopt step failed — left uncompressed GLB");
    }
  }

  const manifest = {
    source:
      "https://sketchfab.com/3d-models/apple-stop-motion-animation-a3e40e1540ed41fc95a9d6278b06c06b",
    author: "Eydeet",
    license: "CC BY",
    mapping: Array.from({ length: 10 }, (_, ui) => ({
      uiFrame: ui,
      sketchfabFrame: sketchfabFrameIndex(ui),
      path: `/apple/frames/${ui}.glb`,
      meaning:
        ui === 0
          ? "whole apple"
          : ui === 9
            ? "mostly core"
            : `bite stage ${ui}`,
    })),
  };
  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log("Done.");
}

bake().catch((err) => {
  console.error(err);
  process.exit(1);
});
