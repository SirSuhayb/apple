"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { copy } from "@/lib/copy";
import { FRAME_COUNT } from "@/lib/race";

type AppleSceneProps = {
  frame: number;
  rot: boolean;
  quietPreview?: boolean;
  juicePulse?: number;
  /** Orbit/spin — off for Act I time-lapse; on for later race acts. */
  enableOrbit?: boolean;
};

const FRAME_URL = (n: number) => `/apple/frames/${n}.glb`;

/**
 * Sketchfab bite stages ship with different node scales/pivots. We normalize
 * each frame independently:
 *  1) uniform scale so the longest AABB side == TARGET_MAX_EXTENT
 *  2) XZ-center + shared floor (min Y → -TARGET_MAX_EXTENT/2)
 * Reusing frame-0's fit factor alone left later stages ~20–40% wrong in world space.
 * AABB-sphere fit kept radius equal but let tall cores (8–9) read much larger.
 */
const TARGET_MAX_EXTENT = 1.16;

/**
 * Eydeet frames ship with the bite cavity facing away from the default camera.
 * Yaw tuned so the bite opening faces the viewer (not the left/back) through the loop.
 */
const APPLE_FACE_YAW = Math.PI * 0.32;
const APPLE_FACE_PITCH = 0.05;

/**
 * Tunables — richer, slightly wetter Eydeet **skin** only (not flesh/bite cavity).
 * Shared conceptually with `scripts/export-apple-stills.mjs`.
 *
 * Eydeet frames are a single white-base material + one albedo that paints both
 * red exterior and pale flesh. Global color/roughness would orange-plastic the
 * interior, so polish is applied **per texel** on the albedo (+ a roughness map).
 *
 * Skin-only: SATURATION_BOOST, RED_TINT, ROUGHNESS_SCALE, ENV_INTENSITY (mild)
 * Flesh-only: FLESH_ROUGHNESS (near original matte; no red tint / metalness)
 */
/** Extra HSL saturation on skin texels (1 = none). */
const SATURATION_BOOST = 1.45;
/** Skin texel roughness written into roughnessMap (source roughness ≈ 1). */
const ROUGHNESS_SCALE = 0.32;
/** Flesh / bite-cavity texel roughness — keep matte, not plastic. */
const FLESH_ROUGHNESS = 0.92;
/**
 * Multiplied onto skin texels only (lower G/B → richer red).
 * Never applied to flesh/cream pixels.
 */
const RED_TINT = new THREE.Color(1.22, 0.58, 0.52);
/** Mild env response; roughnessMap keeps flesh from going glossy. */
const ENV_INTENSITY = 1.15;

function useHasGltfFrames() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(FRAME_URL(0), { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/** World AABB for a loaded (or cloned) GLTF root. */
function measureWorldBox(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(root);
}

/**
 * Uniform scale + stable pose: longest AABB side → TARGET_MAX_EXTENT,
 * XZ centered, bottom on a shared floor so shadows don't bounce.
 */
function normalizeAppleRoot(source: THREE.Object3D): THREE.Group {
  const box0 = measureWorldBox(source);
  const size = box0.getSize(new THREE.Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z, 1e-6);
  const fitScale = TARGET_MAX_EXTENT / maxExtent;

  const wrap = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(fitScale);
  scaled.add(source);
  wrap.add(scaled);

  wrap.updateWorldMatrix(true, true);
  const box = measureWorldBox(wrap);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  wrap.position.set(
    -cx,
    -TARGET_MAX_EXTENT * 0.5 - box.min.y,
    -cz,
  );
  return wrap;
}

function appleColor(rot: boolean, quietPreview?: boolean) {
  const strength = rot ? 1 : quietPreview ? 0.35 : 0;
  const base = new THREE.Color("#e01820");
  const rotten = new THREE.Color("#5c3a1a");
  return base.clone().lerp(rotten, strength * 0.85);
}

function isAppleGltfMaterial(
  mat: THREE.MeshStandardMaterial,
  meshName: string,
): boolean {
  const label = `${mat.name || ""} ${meshName}`.toLowerCase();
  return /apple/.test(label);
}

/** 0 = flesh/stem/other, 1 = red exterior skin. */
function skinWeight(r: number, g: number, b: number): number {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma < 0.07) return 0;

  const [h, s] = rgbToHsl(r, g, b);
  // True red skin hue ≈ 0 / wrap; orange flesh sits ~0.06–0.14.
  let redHue = 0;
  if (h <= 0.04 || h >= 0.96) redHue = 1;
  else if (h < 0.07) redHue = THREE.MathUtils.smoothstep(0.07, 0.04, h);
  else if (h > 0.93) redHue = THREE.MathUtils.smoothstep(0.93, 0.96, h);
  if (redHue < 0.05) return 0;

  const redDom = r - Math.max(g, b);
  let skin = THREE.MathUtils.smoothstep(0.04, 0.18, redDom) * redHue;
  // Flesh/cream keeps G close to R; exterior skin has much lower G/R.
  const rgRatio = g / Math.max(r, 1e-4);
  skin *= 1 - THREE.MathUtils.smoothstep(0.55, 0.78, rgRatio);
  // Drop low-chroma noise and pale yellows.
  skin *= THREE.MathUtils.smoothstep(0.12, 0.28, s);
  skin *= 1 - THREE.MathUtils.smoothstep(0.62, 0.82, luma);

  return THREE.MathUtils.clamp(skin, 0, 1);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3),
  ];
}

type PolishedMaps = {
  albedo: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
};

/** Saturate/tint red skin texels; leave flesh; build roughnessMap (skin shiny, flesh matte). */
function polishSkinAlbedoMaps(map: THREE.Texture): PolishedMaps | null {
  if (map.userData._skinPolishedMaps) {
    return map.userData._skinPolishedMaps as PolishedMaps;
  }
  const img = map.image as
    | HTMLImageElement
    | ImageBitmap
    | HTMLCanvasElement
    | undefined;
  if (!img) return null;
  const w =
    "width" in img
      ? (img as HTMLImageElement | HTMLCanvasElement | ImageBitmap).width
      : 0;
  const h =
    "height" in img
      ? (img as HTMLImageElement | HTMLCanvasElement | ImageBitmap).height
      : 0;
  if (!w || !h) return null;

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const actx = albedoCanvas.getContext("2d", { willReadFrequently: true });
  if (!actx) return null;
  actx.drawImage(img as CanvasImageSource, 0, 0);
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
    let r = px[i]! / 255;
    let g = px[i + 1]! / 255;
    let b = px[i + 2]! / 255;
    const skin = skinWeight(r, g, b);

    if (skin > 0.001) {
      let tr = Math.min(1.35, r * tintR);
      let tg = g * tintG;
      let tb = b * tintB;
      const [hh, ss, ll] = rgbToHsl(tr, tg, tb);
      const boosted = hslToRgb(
        hh,
        Math.min(1, ss * SATURATION_BOOST),
        Math.min(0.58, ll * 1.03),
      );
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

/**
 * Skin-only polish for Eydeet apple GLTFs.
 * Materials named Apple_*: rewrite albedo skin texels + roughnessMap.
 * Flesh texels keep original color; no metalness / global RED_TINT.
 */
function polishAppleMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m?.color) return;
      if (!m.userData._origColor) {
        m.userData._origColor = m.color.clone();
        m.userData._origRoughness = m.roughness ?? 0.5;
        m.userData._origMetalness = m.metalness ?? 0;
      }
      const orig = m.userData._origColor as THREE.Color;
      m.color.copy(orig);
      m.roughness = m.userData._origRoughness as number;
      m.metalness = m.userData._origMetalness as number;

      if (isAppleGltfMaterial(m, mesh.name || "") && m.map) {
        if (!m.userData._skinPolished) {
          const polished = polishSkinAlbedoMaps(m.map);
          if (polished) {
            m.map = polished.albedo;
            m.roughnessMap = polished.roughness;
            m.userData._skinPolished = true;
          }
        }
        if (m.userData._skinPolished) {
          // Factor 1 so roughnessMap fully controls skin vs flesh.
          m.roughness = 1;
          m.metalness = 0;
          if ("envMapIntensity" in m) m.envMapIntensity = ENV_INTENSITY;
        }
      }

      m.userData._baseColor = m.color.clone();
      m.userData._baseRoughness = m.roughness;
      m.needsUpdate = true;
    });
  });
}

/** Procedural stop-motion apple — 10 discrete bite stages when glTF frames are missing. */
function ProceduralApple({
  frame,
  rot,
  quietPreview,
}: {
  frame: number;
  rot: boolean;
  quietPreview?: boolean;
}) {
  const bite = frame / (FRAME_COUNT - 1);
  const color = appleColor(rot, quietPreview);
  const biteRadius = 0.35 + bite * 0.55;
  const biteOffset = 0.55 - bite * 0.15;

  return (
    <group
      position={[0, 0.22, 0]}
      scale={0.95}
      rotation={[APPLE_FACE_PITCH, 0, 0]}
    >
      <mesh castShadow>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial
          color={color}
          roughness={0.32 + (rot ? 0.35 : 0)}
          metalness={0.12}
        />
      </mesh>

      {frame > 0 && (
        <mesh position={[biteOffset, 0.15, 0.55]}>
          <sphereGeometry args={[biteRadius, 32, 32]} />
          <meshStandardMaterial
            color={rot ? "#3a2410" : "#6b1c14"}
            roughness={0.9}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {frame > 2 && (
        <mesh position={[biteOffset * 0.7, 0.05, 0.35]}>
          <sphereGeometry args={[0.35 + bite * 0.2, 24, 24]} />
          <meshStandardMaterial
            color={rot ? "#4a3218" : "#f2d6a2"}
            roughness={0.75}
          />
        </mesh>
      )}

      {frame >= 7 && (
        <group position={[0.15, 0, 0.2]}>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[
                Math.cos((i / 3) * Math.PI * 2) * 0.08,
                Math.sin((i / 3) * Math.PI * 2) * 0.08,
                0,
              ]}
            >
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color="#2a1a0a" roughness={0.6} />
            </mesh>
          ))}
        </group>
      )}

      <mesh position={[0, 1.05, 0]} rotation={[0.2, 0, 0.1]}>
        <cylinderGeometry args={[0.04, 0.055, 0.28, 8]} />
        <meshStandardMaterial color="#3d2a14" roughness={0.8} />
      </mesh>

      {frame < 9 && (
        <mesh position={[0.18, 1.12, 0]} rotation={[0, 0, -0.6]}>
          <sphereGeometry args={[0.18, 16, 8]} />
          <meshStandardMaterial
            color={rot ? "#4a5c28" : "#3f9b3a"}
            roughness={0.55}
          />
        </mesh>
      )}

      {(rot || quietPreview) &&
        Array.from({ length: rot ? 18 : 8 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(i * 1.7) * 0.85,
              Math.cos(i * 2.1) * 0.7,
              Math.cos(i * 1.3) * 0.85,
            ]}
          >
            <sphereGeometry args={[0.04 + (i % 3) * 0.015, 8, 8]} />
            <meshStandardMaterial
              color={i % 2 ? "#6b7a3a" : "#3d2e1a"}
              transparent
              opacity={rot ? 0.9 : 0.45}
            />
          </mesh>
        ))}
    </group>
  );
}

function applyRotTint(
  root: THREE.Object3D,
  rot: boolean,
  quietPreview?: boolean,
) {
  polishAppleMaterials(root);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m?.color) return;
      const base = m.userData._baseColor as THREE.Color;
      m.color.copy(base);
      m.roughness = m.userData._baseRoughness as number;
      if (rot || quietPreview) {
        const strength = rot ? 1 : 0.35;
        m.color.lerp(new THREE.Color("#5c3a1a"), strength * 0.7);
        m.roughness = Math.min(1, m.roughness + strength * 0.3);
      }
      m.needsUpdate = true;
    });
  });
}

function GltfFrame({
  frame,
  rot,
  quietPreview,
}: {
  frame: number;
  rot: boolean;
  quietPreview?: boolean;
}) {
  const path = FRAME_URL(frame);
  const { scene } = useGLTF(path, true, true);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const normalized = useMemo(() => normalizeAppleRoot(cloned), [cloned]);

  useEffect(() => {
    applyRotTint(cloned, rot, quietPreview);
  }, [cloned, rot, quietPreview]);

  return (
    <group
      position={[0, 0.22, 0]}
      rotation={[APPLE_FACE_PITCH, APPLE_FACE_YAW, 0]}
    >
      <primitive object={normalized} />
    </group>
  );
}

function JuiceBurst({ pulse }: { pulse: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || !pulse) return;
    const t = Math.min(1, (Date.now() - pulse) / 700);
    ref.current.scale.setScalar(0.4 + t * 1.6);
    ref.current.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 1 - t);
    });
  });
  if (!pulse) return null;
  return (
    <group ref={ref} position={[0.4, 0.2, 0.6]}>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(i) * 0.2,
            Math.cos(i * 1.3) * 0.15,
            Math.cos(i) * 0.2,
          ]}
        >
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#ff6b4a" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function RotOverlay({
  rot,
  quietPreview,
}: {
  rot: boolean;
  quietPreview?: boolean;
}) {
  if (!rot && !quietPreview) return null;
  const count = rot ? 22 : 10;
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(i * 1.7) * 0.9,
            Math.cos(i * 2.1) * 0.75,
            Math.cos(i * 1.3) * 0.9,
          ]}
        >
          <sphereGeometry args={[0.035 + (i % 3) * 0.012, 8, 8]} />
          <meshStandardMaterial
            color={i % 2 ? "#6b7a3a" : "#3d2e1a"}
            transparent
            opacity={rot ? 0.85 : 0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent({
  frame,
  rot,
  quietPreview,
  juicePulse,
  enableOrbit = false,
  useGltf,
}: AppleSceneProps & { useGltf: boolean }) {
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[5, 7, 4]} intensity={2.05} castShadow />
      <directionalLight position={[-4, 3, -2]} intensity={0.45} />
      <hemisphereLight args={["#ffffff", "#e8e8ed", 0.38]} />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.4} />
        {useGltf ? (
          <GltfFrame
            frame={frame}
            rot={rot}
            quietPreview={quietPreview}
          />
        ) : (
          <ProceduralApple
            frame={frame}
            rot={rot}
            quietPreview={quietPreview}
          />
        )}
      </Suspense>
      {useGltf && <RotOverlay rot={rot} quietPreview={quietPreview} />}
      <JuiceBurst pulse={juicePulse ?? 0} />
      <ContactShadows
        position={[0, -0.88, 0]}
        opacity={0.2}
        scale={5.5}
        blur={2.4}
        far={3.2}
        color="#1d1d1f"
      />
      {enableOrbit && (
        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI * 0.35}
          maxPolarAngle={Math.PI * 0.62}
          target={[0, 0.1, 0]}
          rotateSpeed={0.7}
        />
      )}
    </>
  );
}

/** Fill most of the square; keep a clear margin under the soft shadow. */
function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const narrow = size.width < 640;
    const short = size.height < 380;
    persp.fov = narrow ? 36 : short ? 35 : 33;
    persp.position.set(0, 0.12, narrow ? 4.05 : short ? 4.2 : 3.9);
    persp.lookAt(0, 0.1, 0);
    persp.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export function AppleScene({
  frame,
  rot,
  quietPreview,
  juicePulse,
  enableOrbit = false,
}: AppleSceneProps) {
  const hasGltf = useHasGltfFrames();
  const safeFrame = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(frame)));

  useEffect(() => {
    if (!hasGltf) return;
    for (let i = 0; i < FRAME_COUNT; i++) {
      useGLTF.preload(FRAME_URL(i), true, true);
    }
  }, [hasGltf]);

  const useGltf = hasGltf === true;

  return (
    <div
      className={[
        "relative h-full w-full overflow-visible",
        enableOrbit ? "touch-none" : "pointer-events-none",
      ].join(" ")}
    >
      <Canvas
        shadows
        camera={{ position: [0, 0.12, 3.9], fov: 33, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          overflow: "visible",
        }}
      >
        <ResponsiveCamera />
        <SceneContent
          frame={safeFrame}
          rot={rot}
          quietPreview={quietPreview}
          juicePulse={juicePulse}
          enableOrbit={enableOrbit}
          useGltf={useGltf}
        />
      </Canvas>
      {hasGltf === false && (
        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-[#86868b]">
          {copy.scene.proceduralNote}
        </p>
      )}
    </div>
  );
}
