/**
 * Export square PNG stills for every stop-motion apple frame (0–9).
 * Matches AppleScene.tsx camera, lights, face yaw, and fit scale.
 *
 * Usage: node scripts/export-apple-stills.mjs
 * Out:   public/apple/stills/frame-00.png … frame-09.png (+ contact-sheet.png)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FRAMES_DIR = path.join(ROOT, "public/apple/frames");
const OUT_DIR = path.join(ROOT, "public/apple/stills");
const SIZE = 1024;
const FRAME_COUNT = 10;

const APPLE_FACE_YAW = Math.PI * 0.32;
const APPLE_FACE_PITCH = 0.05;
const TARGET_RADIUS = 0.92;
const BG = "#fbfbfd";

/** Keep in sync with AppleScene.tsx tunables. */
const SATURATION_BOOST = 1.2;
const ROUGHNESS_SCALE = 0.28;
const METALNESS_BOOST = 0.08;
const ENV_INTENSITY = 1.55;
/** RGB multiply onto white baseColor (see AppleScene RED_TINT). */
const RED_TINT_R = 1.18;
const RED_TINT_G = 0.52;
const RED_TINT_B = 0.48;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
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
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath;
    if (urlPath.startsWith("/frames/")) {
      filePath = path.join(FRAMES_DIR, urlPath.slice("/frames/".length));
    } else if (urlPath.startsWith("/three/")) {
      filePath = path.join(
        ROOT,
        "node_modules/three",
        urlPath.slice("/three/".length),
      );
    } else if (urlPath === "/" || urlPath === "/index.html") {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(RENDER_HTML);
      return;
    } else {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    const resolved = path.resolve(filePath);
    const allowed =
      resolved.startsWith(FRAMES_DIR) ||
      resolved.startsWith(path.join(ROOT, "node_modules/three"));
    if (!allowed || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(resolved).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const RENDER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: ${BG}; overflow: hidden; }
    canvas { display: block; width: 100% !important; height: 100% !important; }
  </style>
</head>
<body>
<script type="importmap">
{
  "imports": {
    "three": "/three/build/three.module.js",
    "three/addons/": "/three/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const APPLE_FACE_YAW = ${APPLE_FACE_YAW};
const APPLE_FACE_PITCH = ${APPLE_FACE_PITCH};
const TARGET_RADIUS = ${TARGET_RADIUS};
const BG = "${BG}";
const SATURATION_BOOST = ${SATURATION_BOOST};
const ROUGHNESS_SCALE = ${ROUGHNESS_SCALE};
const METALNESS_BOOST = ${METALNESS_BOOST};
const ENV_INTENSITY = ${ENV_INTENSITY};
const RED_TINT = new THREE.Color(${RED_TINT_R}, ${RED_TINT_G}, ${RED_TINT_B});

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.setClearColor(BG, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
camera.position.set(0, 0.12, 3.9);
camera.lookAt(0, 0.1, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const key = new THREE.DirectionalLight(0xffffff, 2.05);
key.position.set(5, 7, 4);
key.castShadow = true;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-4, 3, -2);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e8ed, 0.38));

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

// Soft contact-shadow stand-in (matches ContactShadows opacity/feel roughly)
const shadowGeo = new THREE.CircleGeometry(1.35, 64);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x1d1d1f,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});
const shadow = new THREE.Mesh(shadowGeo, shadowMat);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, -0.88, 0);
scene.add(shadow);

const appleRoot = new THREE.Group();
appleRoot.position.set(0, 0.22, 0);
appleRoot.rotation.set(APPLE_FACE_PITCH, APPLE_FACE_YAW, 0);
scene.add(appleRoot);

const loader = new GLTFLoader();
await MeshoptDecoder.ready;
loader.setMeshoptDecoder(MeshoptDecoder);

let fitScale = null;
let current = null;

function measureSphereRadius(root) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return Math.max(sphere.radius, 1e-6);
}

/** Match drei <Center> around a scaled GLTF root. */
function fitCentered(sceneRoot, scale) {
  const wrap = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(scale);
  scaled.add(sceneRoot);
  wrap.add(scaled);
  wrap.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(wrap);
  const c = box.getCenter(new THREE.Vector3());
  wrap.position.sub(c);
  return wrap;
}

function isAppleSkinColor(c) {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const redHue = hsl.h < 0.08 || hsl.h > 0.92;
  return redHue && hsl.s > 0.12 && hsl.l > 0.06 && hsl.l < 0.75;
}

function isAppleSkinMaterial(m, meshName) {
  const label = \`\${m.name || ""} \${meshName || ""}\`.toLowerCase();
  if (/apple/.test(label)) return true;
  if (m.userData._origColor) return isAppleSkinColor(m.userData._origColor);
  return false;
}

function polishAppleMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m?.color) return;
      if (!m.userData._origColor) {
        m.userData._origColor = m.color.clone();
        m.userData._origRoughness = m.roughness ?? 0.5;
        m.userData._origMetalness = m.metalness ?? 0;
      }
      const orig = m.userData._origColor;
      m.color.copy(orig);
      const origRough = m.userData._origRoughness;
      const origMetal = m.userData._origMetalness;
      if (isAppleSkinMaterial(m, obj.name || "")) {
        m.color.multiply(RED_TINT);
        const hsl = { h: 0, s: 0, l: 0 };
        m.color.getHSL(hsl);
        m.color.setHSL(
          hsl.h,
          Math.min(1, hsl.s * SATURATION_BOOST),
          Math.min(0.62, hsl.l * 1.05),
        );
        m.roughness = Math.max(0.18, origRough * ROUGHNESS_SCALE);
        m.metalness = Math.min(0.2, origMetal + METALNESS_BOOST);
        if ("envMapIntensity" in m) m.envMapIntensity = ENV_INTENSITY;
      } else {
        m.roughness = Math.max(0.28, origRough * 0.92);
      }
      m.needsUpdate = true;
    });
  });
}

async function ensureFitScale() {
  if (fitScale != null) return fitScale;
  const gltf = await loader.loadAsync("/frames/0.glb");
  const radius = measureSphereRadius(gltf.scene);
  fitScale = TARGET_RADIUS / radius;
  return fitScale;
}

window.__renderFrame = async function renderFrame(n) {
  const scale = await ensureFitScale();
  if (current) {
    appleRoot.remove(current);
    current.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose?.());
      }
    });
    current = null;
  }
  const gltf = await loader.loadAsync(\`/frames/\${n}.glb\`);
  polishAppleMaterials(gltf.scene);
  const wrap = fitCentered(gltf.scene, scale);
  appleRoot.add(wrap);
  current = wrap;

  // Settle a couple frames for GPU upload
  renderer.render(scene, camera);
  await new Promise((r) => requestAnimationFrame(() => {
    renderer.render(scene, camera);
    r();
  }));
  await new Promise((r) => requestAnimationFrame(() => {
    renderer.render(scene, camera);
    r();
  }));
  return true;
};

window.__ready = true;
</script>
</body>
</html>`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (let i = 0; i < FRAME_COUNT; i++) {
    const glb = path.join(FRAMES_DIR, `${i}.glb`);
    if (!fs.existsSync(glb)) {
      throw new Error(`Missing GLB: ${glb}`);
    }
  }

  const { chromium } = resolvePlaywright();
  const { server, baseUrl } = await startStaticServer();
  console.log(`Static server ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
  });

  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("CONSOLE", m.text());
  });

  await page.goto(baseUrl + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 30000,
  });

  const paths = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    await page.evaluate(async (n) => {
      await window.__renderFrame(n);
    }, i);
    // Extra paint settle
    await page.waitForTimeout?.(150);
    if (!page.waitForTimeout) {
      await new Promise((r) => setTimeout(r, 150));
    }
    const out = path.join(OUT_DIR, `frame-${String(i).padStart(2, "0")}.png`);
    await page.locator("canvas").screenshot({ path: out, type: "png" });
    const stat = fs.statSync(out);
    console.log(`Wrote ${out} (${stat.size} bytes)`);
    paths.push(out);
  }

  await browser.close();
  server.close();

  const stripPath = path.join(OUT_DIR, "contact-sheet.png");
  // Build contact sheet from the frame PNGs
  await buildContactSheet(chromium, paths, stripPath);
  paths.push(stripPath);

  console.log(JSON.stringify({ count: FRAME_COUNT, outDir: OUT_DIR, paths }, null, 2));
}

async function buildContactSheet(chromium, framePaths, stripPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: SIZE * FRAME_COUNT, height: SIZE },
    deviceScaleFactor: 1,
  });

  const dataUrls = framePaths.map((p) => {
    const b64 = fs.readFileSync(p).toString("base64");
    return `data:image/png;base64,${b64}`;
  });

  await page.setContent(`<!DOCTYPE html>
<html><body style="margin:0;background:${BG}">
<canvas id="c" width="${SIZE * FRAME_COUNT}" height="${SIZE}"></canvas>
<script>
const imgs = ${JSON.stringify(dataUrls)};
const size = ${SIZE};
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let loaded = 0;
imgs.forEach((src, i) => {
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, i * size, 0, size, size);
    loaded++;
    if (loaded === imgs.length) window.__done = true;
  };
  img.src = src;
});
</script>
</body></html>`);

  await page.waitForFunction(() => window.__done === true, null, {
    timeout: 60000,
  });
  await page.locator("canvas").screenshot({ path: stripPath, type: "png" });
  console.log(`Wrote ${stripPath} (${fs.statSync(stripPath).size} bytes)`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
