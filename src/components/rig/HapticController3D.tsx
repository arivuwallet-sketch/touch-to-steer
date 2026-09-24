import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, useGLTF } from "@react-three/drei";

const MODEL_URL =
  "/__l5e/assets-v1/19b75a45-2c01-427d-8eac-7276ac4642a7/controller.glb";

type HapticEventDetail = {
  intensity?: number;
};

function ControllerBody({ pulseRef }: { pulseRef: MutableRefObject<number> }) {
  const { scene } = useGLTF(MODEL_URL);
  const root = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.envMapIntensity = Math.min(
          0.85,
          Math.max(0.32, child.material.envMapIntensity ?? 0.58),
        );
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);

    clone.position.sub(center);
    clone.scale.setScalar(3.15 / Math.max(longest, 0.001));
    clone.rotation.x = -Math.PI * 0.5;
    clone.rotation.z = Math.PI;

    return clone;
  }, [scene]);

  useFrame((state, delta) => {
    const p = pulseRef.current;
    if (!root) return;

    const time = state.clock.elapsedTime;
    const shake = p * p;
    const high = Math.sin(time * 92) * shake;
    const low = Math.sin(time * 29) * shake;

    // A visible, layered DualShock-style chassis shake: a fast buzz sits on
    // top of a slower body movement and rotational kick.
    root.position.x = high * 0.026;
    root.position.y = low * 0.018;
    root.position.z = Math.cos(time * 83) * shake * 0.012;

    root.rotation.x = -Math.PI * 0.5 + Math.sin(time * 52) * shake * 0.026;
    root.rotation.y = Math.cos(time * 71) * shake * 0.03;
    root.rotation.z = Math.sin(time * 61) * shake * 0.022;

    pulseRef.current = Math.max(0, p - delta * 4.8);
  });

  return <primitive object={root} />;
}

function HapticScene() {
  const pulseRef = useRef(0);

  useEffect(() => {
    const handleHaptic = (event: Event) => {
      const detail = (event as CustomEvent<HapticEventDetail>).detail;
      const intensity = Math.max(0.08, Math.min(1, Number(detail?.intensity) || 0.2));
      pulseRef.current = Math.max(pulseRef.current, intensity);
    };

    window.addEventListener("touch-to-steer:haptic", handleHaptic);
    return () => window.removeEventListener("touch-to-steer:haptic", handleHaptic);
  }, []);

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[-3.5, 4.5, 4]}
        intensity={0.62}
        color="#dcecf2"
        castShadow
      />
      <directionalLight
        position={[3, 1.5, -3]}
        intensity={0.16}
        color="#67d5e9"
      />
      <Environment preset="studio" background={false} environmentIntensity={0.28} />

      <ControllerBody pulseRef={pulseRef} />

      <ContactShadows
        position={[0, -1.28, 0]}
        opacity={0.22}
        scale={5.4}
        blur={2.8}
        far={4}
      />
    </>
  );
}

export function HapticController3D({ mode }: { mode: "gamepad" | "steering" }) {
  return (
    <div
      className="haptic-controller-3d"
      data-mode={mode}
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.7,
        }}
        camera={{ position: [0, 0.2, 5.7], fov: 31, near: 0.05, far: 20 }}
      >
        <HapticScene />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
