"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  ContactShadows,
  Environment,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Shared visual radius so every stop-motion stage matches frame 0 framing. */
const TARGET_RADIUS = 0.92;

/**
 * Eydeet frames ship with the bite cavity facing away from the default camera.
 * Yaw tuned so the bite opening faces the viewer (not the left/back) through the loop.
 */
const APPLE_FACE_YAW = Math.PI * 0.32;
const APPLE_FACE_PITCH = 0.05;

/**
 * Tunables — richer, slightly wetter Eydeet apple skin (keep photoreal, not plastic).
 * Shared conceptually with `scripts/export-apple-stills.mjs`.
 *
 * Note: Eydeet GLBs use white baseColor × albedo map and roughness=1. Skin polish
 * is applied via name match + color multiply (not HSL on the white factor alone).
 */
/** Extra HSL saturation on the post-tint color (1 = none). */
const SATURATION_BOOST = 1.2;
/** Multiply GLTF roughness (source is ~1.0; lower = shinier). */
const ROUGHNESS_SCALE = 0.28;
/** Added metalness for a subtle wet sheen. */
const METALNESS_BOOST = 0.08;
/**
 * Multiplied onto white baseColor so the albedo map reads redder/more saturated.
 * Lower G/B = richer red from the texture.
 */
const RED_TINT = new THREE.Color(1.18, 0.52, 0.48);
const ENV_INTENSITY = 1.55;

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

function measureSphereRadius(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return Math.max(sphere.radius, 1e-6);
}

function appleColor(rot: boolean, quietPreview?: boolean) {
  const strength = rot ? 1 : quietPreview ? 0.35 : 0;
  const base = new THREE.Color("#e01820");
  const rotten = new THREE.Color("#5c3a1a");
  return base.clone().lerp(rotten, strength * 0.85);
}

function isAppleSkinColor(c: THREE.Color): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const redHue = hsl.h < 0.08 || hsl.h > 0.92;
  return redHue && hsl.s > 0.12 && hsl.l > 0.06 && hsl.l < 0.75;
}

function isAppleSkinMaterial(
  mat: THREE.MeshStandardMaterial,
  meshName: string,
): boolean {
  const label = `${mat.name || ""} ${meshName}`.toLowerCase();
  if (/apple/.test(label)) return true;
  if (mat.userData._origColor) {
    return isAppleSkinColor(mat.userData._origColor as THREE.Color);
  }
  return false;
}

/** One-time polish of GLTF materials toward a juicier, shinier apple. */
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
      const origRough = m.userData._origRoughness as number;
      const origMetal = m.userData._origMetalness as number;

      if (isAppleSkinMaterial(m, mesh.name || "")) {
        // White base × albedo map: tint multiply saturates reds in the texture.
        m.color.multiply(RED_TINT);
        const hsl = { h: 0, s: 0, l: 0 };
        m.color.getHSL(hsl);
        // Keep lightness; push chroma for a juicier red without darkening.
        m.color.setHSL(
          hsl.h,
          Math.min(1, hsl.s * SATURATION_BOOST),
          Math.min(0.62, hsl.l * 1.05),
        );
        m.roughness = Math.max(0.18, origRough * ROUGHNESS_SCALE);
        m.metalness = Math.min(0.2, origMetal + METALNESS_BOOST);
        if ("envMapIntensity" in m) {
          m.envMapIntensity = ENV_INTENSITY;
        }
      } else {
        m.roughness = Math.max(0.28, origRough * 0.92);
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

/** Load frame 0 once and publish a shared fit scale for all stages. */
function FrameScaleBootstrap({
  onScale,
}: {
  onScale: (scale: number) => void;
}) {
  const { scene } = useGLTF(FRAME_URL(0), true, true);
  useEffect(() => {
    const radius = measureSphereRadius(scene);
    onScale(TARGET_RADIUS / radius);
  }, [scene, onScale]);
  return null;
}

function GltfFrame({
  frame,
  rot,
  quietPreview,
  fitScale,
}: {
  frame: number;
  rot: boolean;
  quietPreview?: boolean;
  fitScale: number;
}) {
  const path = FRAME_URL(frame);
  const { scene } = useGLTF(path, true, true);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    applyRotTint(cloned, rot, quietPreview);
  }, [cloned, rot, quietPreview]);

  return (
    <group
      position={[0, 0.22, 0]}
      rotation={[APPLE_FACE_PITCH, APPLE_FACE_YAW, 0]}
    >
      <Center cacheKey={`frame-${frame}-s${fitScale.toFixed(4)}`}>
        <group scale={fitScale}>
          <primitive object={cloned} />
        </group>
      </Center>
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
  fitScale,
}: AppleSceneProps & { useGltf: boolean; fitScale: number | null }) {
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[5, 7, 4]} intensity={2.05} castShadow />
      <directionalLight position={[-4, 3, -2]} intensity={0.45} />
      <hemisphereLight args={["#ffffff", "#e8e8ed", 0.38]} />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.55} />
        {useGltf ? (
          fitScale != null ? (
            <GltfFrame
              frame={frame}
              rot={rot}
              quietPreview={quietPreview}
              fitScale={fitScale}
            />
          ) : null
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
  const [fitScale, setFitScale] = useState<number | null>(null);
  const onScale = useCallback((scale: number) => {
    setFitScale(scale);
  }, []);

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
        {useGltf && (
          <Suspense fallback={null}>
            <FrameScaleBootstrap onScale={onScale} />
          </Suspense>
        )}
        <SceneContent
          frame={safeFrame}
          rot={rot}
          quietPreview={quietPreview}
          juicePulse={juicePulse}
          enableOrbit={enableOrbit}
          useGltf={useGltf}
          fitScale={fitScale}
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
