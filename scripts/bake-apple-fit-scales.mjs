/**
 * Bake per-frame uniform scales so camera-projected silhouette height matches
 * frame 0 (same camera + face yaw/pitch as AppleScene.tsx).
 *
 * Prints a FRAME_FIT_SCALE array to paste into:
 *   - src/components/AppleScene.tsx
 *   - scripts/export-apple-stills.mjs
 *
 * Usage: node scripts/bake-apple-fit-scales.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FRAMES_DIR = path.join(ROOT, "public/apple/frames");
const FRAME_COUNT = 10;
const APPLE_FACE_YAW = Math.PI * 0.32;
const APPLE_FACE_PITCH = 0.05;
const FLOOR_Y = -0.58;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

function resolvePlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(ROOT, "node_modules/playwright"),
    "/tmp/node_modules/playwright",
    "/tmp/bite-verify/node_modules/playwright",
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  try {
    return require("playwright");
  } catch {
    throw new Error(
      "playwright not found. Run: cd /tmp && npm i playwright@1.55.0",
    );
  }
}

function startStaticServer() {
  const HTML = `<!DOCTYPE html><html><body>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const YAW = ${APPLE_FACE_YAW};
const PITCH = ${APPLE_FACE_PITCH};
const FLOOR_Y = ${FLOOR_Y};
const loader = new GLTFLoader();
await MeshoptDecoder.ready;
loader.setMeshoptDecoder(MeshoptDecoder);

function projectedHeight(root) {
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
  camera.position.set(0, 0.12, 3.9);
  camera.lookAt(0, 0.1, 0);
  camera.updateMatrixWorld(true);
  let minY = Infinity, maxY = -Infinity;
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  });
  return maxY - minY;
}

function assemble(scene, fit) {
  const wrap = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(fit);
  scaled.add(scene);
  wrap.add(scaled);
  wrap.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(wrap);
  wrap.position.set(
    -(box.min.x + box.max.x) / 2,
    FLOOR_Y - box.min.y,
    -(box.min.z + box.max.z) / 2,
  );
  const outer = new THREE.Group();
  outer.position.set(0, 0.22, 0);
  outer.rotation.set(PITCH, YAW, 0);
  outer.add(wrap);
  return outer;
}

window.__bake = async () => {
  const scenes = [];
  for (let i = 0; i < ${FRAME_COUNT}; i++) {
    scenes.push((await loader.loadAsync("/frames/" + i + ".glb")).scene);
  }
  const seeds = scenes.map((s) => {
    s.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(s);
    return 1.16 / Math.max(b.max.y - b.min.y, 1e-6);
  });
  const seedProj = seeds.map((seed, i) =>
    projectedHeight(assemble(scenes[i].clone(true), seed)),
  );
  const target = seedProj[0];
  const fits = seeds.map((seed, i) => seed * (target / seedProj[i]));
  const verify = fits.map((fit, i) => {
    const h = projectedHeight(assemble(scenes[i].clone(true), fit));
    return { n: i, fit, projHratio: h / target };
  });
  return { fits, verify };
};
window.__ready = true;
</script></body></html>`;

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/" || urlPath === "/index.html") {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(HTML);
      return;
    }
    let filePath;
    if (urlPath.startsWith("/frames/")) {
      filePath = path.join(FRAMES_DIR, urlPath.slice("/frames/".length));
    } else if (urlPath.startsWith("/three/")) {
      filePath = path.join(
        ROOT,
        "node_modules/three",
        urlPath.slice("/three/".length),
      );
    } else {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const resolved = path.resolve(filePath);
    const allowed =
      resolved.startsWith(FRAMES_DIR) ||
      resolved.startsWith(path.join(ROOT, "node_modules/three"));
    if (
      !allowed ||
      !fs.existsSync(resolved) ||
      fs.statSync(resolved).isDirectory()
    ) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
    });
    fs.createReadStream(resolved).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  for (let i = 0; i < FRAME_COUNT; i++) {
    const glb = path.join(FRAMES_DIR, `${i}.glb`);
    if (!fs.existsSync(glb)) throw new Error(`Missing GLB: ${glb}`);
  }

  const { chromium } = resolvePlaywright();
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  await page.goto(baseUrl + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 30000,
  });
  const result = await page.evaluate(() => window.__bake());
  await browser.close();
  server.close();

  console.log("const FRAME_FIT_SCALE = [");
  result.fits.forEach((f, i) => {
    console.log(`  ${Number(f.toFixed(8))}, // ${i}`);
  });
  console.log("] as const;");
  console.log("");
  result.verify.forEach((v) => {
    console.log(
      `frame ${v.n}: fit=${v.fit.toFixed(6)} projHratio=${v.projHratio.toFixed(4)}`,
    );
  });
  const maxDev = Math.max(
    ...result.verify.map((v) => Math.abs(v.projHratio - 1)),
  );
  console.log(`max projected-height deviation: ${(maxDev * 100).toFixed(3)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
