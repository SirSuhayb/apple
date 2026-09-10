/**
 * Export square PNG stills for every stop-motion apple frame (0–9).
 * Matches AppleScene.tsx camera, lights, face yaw, and **per-frame** normalize
 * (each GLB has a different Sketchfab node scale — never reuse frame-0 alone).
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
/** Longest AABB side after normalize — keep in sync with AppleScene.tsx */
const TARGET_MAX_EXTENT = 1.16;
const BG = "#fbfbfd";

/** Keep in sync with AppleScene.tsx — skin texels only (not flesh). */
const SATURATION_BOOST = 1.45;
const ROUGHNESS_SCALE = 0.32;
const FLESH_ROUGHNESS = 0.92;
const ENV_INTENSITY = 1.15;
/** RGB multiply onto skin texels only (see AppleScene RED_TINT). */
const RED_TINT_R = 1.22;
const RED_TINT_G = 0.58;
const RED_TINT_B = 0.52;

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
const TARGET_MAX_EXTENT = ${TARGET_MAX_EXTENT};
const BG = "${BG}";
const SATURATION_BOOST = ${SATURATION_BOOST};
const ROUGHNESS_SCALE = ${ROUGHNESS_SCALE};
const FLESH_ROUGHNESS = ${FLESH_ROUGHNESS};
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
scene.environmentIntensity = 0.4;

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

let current = null;

function measureWorldBox(root) {
  root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(root);
}

/**
 * Per-frame normalize (matches AppleScene.tsx):
 * scale longest AABB side → TARGET_MAX_EXTENT, XZ-center, shared floor.
 */
function normalizeFrame(sceneRoot) {
  const box0 = measureWorldBox(sceneRoot);
  const size = box0.getSize(new THREE.Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z, 1e-6);
  const fitScale = TARGET_MAX_EXTENT / maxExtent;

  const wrap = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(fitScale);
  scaled.add(sceneRoot);
  wrap.add(scaled);

  wrap.updateWorldMatrix(true, true);
  const box = measureWorldBox(wrap);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  wrap.position.set(-cx, -TARGET_MAX_EXTENT * 0.5 - box.min.y, -cz);
  return wrap;
}

function isAppleGltfMaterial(m, meshName) {
  const label = \`\${m.name || ""} \${meshName || ""}\`.toLowerCase();
  return /apple/.test(label);
}

function skinWeight(r, g, b) {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma < 0.07) return 0;
  const [h, s] = rgbToHsl(r, g, b);
  let redHue = 0;
  if (h <= 0.04 || h >= 0.96) redHue = 1;
  else if (h < 0.07) redHue = THREE.MathUtils.smoothstep(0.07, 0.04, h);
  else if (h > 0.93) redHue = THREE.MathUtils.smoothstep(0.93, 0.96, h);
  if (redHue < 0.05) return 0;
  const redDom = r - Math.max(g, b);
  let skin = THREE.MathUtils.smoothstep(0.04, 0.18, redDom) * redHue;
  const rgRatio = g / Math.max(r, 1e-4);
  skin *= 1 - THREE.MathUtils.smoothstep(0.55, 0.78, rgRatio);
  skin *= THREE.MathUtils.smoothstep(0.12, 0.28, s);
  skin *= 1 - THREE.MathUtils.smoothstep(0.62, 0.82, luma);
  return THREE.MathUtils.clamp(skin, 0, 1);
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function polishSkinAlbedoMaps(map) {
  if (map.userData._skinPolishedMaps) return map.userData._skinPolishedMaps;
  const img = map.image;
  if (!img) return null;
  const w = img.width;
  const h = img.height;
  if (!w || !h) return null;

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const actx = albedoCanvas.getContext("2d", { willReadFrequently: true });
  if (!actx) return null;
  actx.drawImage(img, 0, 0);
  const imageData = actx.getImageData(0, 0, w, h);
  const px = imageData.data;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rctx = roughCanvas.getContext("2d");
  if (!rctx) return null;
  const roughData = rctx.createImageData(w, h);
  const rx = roughData.data;

  const tintR = RED_TINT.r;
  const tintG = RED_TINT.g;
  const tintB = RED_TINT.b;

  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255;
    let g = px[i + 1] / 255;
    let b = px[i + 2] / 255;
    const skin = skinWeight(r, g, b);
    if (skin > 0.001) {
      let tr = Math.min(1.35, r * tintR);
      let tg = g * tintG;
      let tb = b * tintB;
      const [hh, ss, ll] = rgbToHsl(tr, tg, tb);
      const boosted = hslToRgb(hh, Math.min(1, ss * SATURATION_BOOST), Math.min(0.58, ll * 1.03));
      r = r * (1 - skin) + boosted[0] * skin;
      g = g * (1 - skin) + boosted[1] * skin;
      b = b * (1 - skin) + boosted[2] * skin;
    }
    px[i] = Math.round(THREE.MathUtils.clamp(r, 0, 1) * 255);
    px[i + 1] = Math.round(THREE.MathUtils.clamp(g, 0, 1) * 255);
    px[i + 2] = Math.round(THREE.MathUtils.clamp(b, 0, 1) * 255);
    const rough = FLESH_ROUGHNESS * (1 - skin) + ROUGHNESS_SCALE * skin;
    const rv = Math.round(THREE.MathUtils.clamp(rough, 0, 1) * 255);
    rx[i] = rv;
    rx[i + 1] = rv;
    rx[i + 2] = rv;
    rx[i + 3] = 255;
  }

  actx.putImageData(imageData, 0, 0);
  rctx.putImageData(roughData, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = map.colorSpace;
  albedo.flipY = map.flipY;
  albedo.wrapS = map.wrapS;
  albedo.wrapT = map.wrapT;
  albedo.needsUpdate = true;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.flipY = map.flipY;
  roughness.wrapS = map.wrapS;
  roughness.wrapT = map.wrapT;
  roughness.needsUpdate = true;

  const polished = { albedo, roughness };
  map.userData._skinPolishedMaps = polished;
  return polished;
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
      m.color.copy(m.userData._origColor);
      m.roughness = m.userData._origRoughness;
      m.metalness = m.userData._origMetalness;
      if (isAppleGltfMaterial(m, obj.name || "") && m.map) {
        if (!m.userData._skinPolished) {
          const polished = polishSkinAlbedoMaps(m.map);
          if (polished) {
            m.map = polished.albedo;
            m.roughnessMap = polished.roughness;
            m.userData._skinPolished = true;
          }
        }
        if (m.userData._skinPolished) {
          m.roughness = 1;
          m.metalness = 0;
          if ("envMapIntensity" in m) m.envMapIntensity = ENV_INTENSITY;
        }
      }
      m.needsUpdate = true;
    });
  });
}

window.__renderFrame = async function renderFrame(n) {
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
  const wrap = normalizeFrame(gltf.scene);
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
