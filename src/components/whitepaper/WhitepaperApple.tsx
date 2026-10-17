"use client";

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Frame 5 of Eydeet’s stop-motion apple — a real bite, one model only. */
const FRAME_URL = "/apple/frames/5.glb";
const FIT = 0.04005153 * 1.27;

function BittenApple({ spin }: { spin: boolean }) {
  const gltf = useGLTF(FRAME_URL);
  const turn = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const source = gltf.scene.clone(true);
    const wrap = new THREE.Group();
    const scaled = new THREE.Group();
    scaled.scale.setScalar(FIT);
    scaled.add(source);
    wrap.add(scaled);
    wrap.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(wrap);
    wrap.position.set(
      -((box.min.x + box.max.x) / 2),
      -0.58 - box.min.y,
      -((box.min.z + box.max.z) / 2),
    );
    return wrap;
  }, [gltf.scene]);

  useFrame((_, delta) => {
    if (!spin || !turn.current) return;
    turn.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={turn} rotation={[0.05, Math.PI * 0.32, 0]}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(FRAME_URL);

export function WhitepaperApple() {
  const [spin, setSpin] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setSpin(!media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <div className="relative h-[340px] w-full sm:h-[460px]">
      <Canvas
          camera={{ position: [0.55, 0.18, 3.9], fov: 33, near: 0.1, far: 40 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor("#000000", 0);
            scene.background = null;
          }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={1.15} />
          <directionalLight position={[4, 6, 4]} intensity={2.2} />
          <directionalLight position={[-4, 2, -2]} intensity={0.55} />
          <hemisphereLight args={["#fff7f2", "#f3d2c4", 0.45]} />
          <Suspense fallback={null}>
            <BittenApple spin={spin} />
            <ContactShadows
              position={[0, -0.58, 0]}
              opacity={0.35}
              scale={8}
              blur={2.4}
              far={2}
            />
          </Suspense>
        </Canvas>
    </div>
  );
}
