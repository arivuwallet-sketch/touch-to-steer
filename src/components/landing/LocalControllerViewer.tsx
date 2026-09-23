import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";

const MODEL_URL = "/models/Controller.glb";

function ControllerModel() {
  const { scene } = useGLTF(MODEL_URL);
  const cloned = useMemo(() => {
    const root = scene.clone(true);

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.envMapIntensity = 0.6;
        child.material.roughness = Math.max(child.material.roughness, 0.24);
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 4.3 / Math.max(size.x, size.y, size.z);

    root.position.sub(center);
    root.scale.setScalar(scale);
    root.rotation.x = -Math.PI * 0.5;
    root.rotation.z = Math.PI;

    return root;
  }, [scene]);

  return <primitive object={cloned} />;
}

function CinematicLights() {
  const { scene } = useThree();

  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Light) {
        child.castShadow = true;
      }
    });
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.22} />
      <directionalLight
        castShadow
        position={[-4.5, 5.5, 4.5]}
        intensity={0.75}
        color="#d7ecf5"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={24}
      />
      <directionalLight
        position={[4.5, 1.5, -2.5]}
        intensity={0.22}
        color="#57cce8"
      />
    </>
  );
}

function ControllerStage() {
  return (
    <>
      <CinematicLights />
      <Environment preset="studio" background={false} environmentIntensity={0.35} />
      <Suspense fallback={null}>
        <ControllerModel />
      </Suspense>

      <ContactShadows
        position={[0, -2.0, 0]}
        opacity={0.34}
        scale={6.5}
        blur={2.4}
        far={4.5}
      />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        autoRotate
        autoRotateSpeed={0.42}
        minPolarAngle={Math.PI * 0.30}
        maxPolarAngle={Math.PI * 0.70}
      />
    </>
  );
}

export function LocalControllerViewer() {
  return (
    <div className="spectral-local-controller-shell" data-render-quality="glb-pbr-hd-aa-shadow">
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.78,
        }}
        camera={{ position: [0, 0.15, 6.5], fov: 30, near: 0.05, far: 40 }}
      >
        <ControllerStage />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
