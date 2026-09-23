import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useLoader } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function ControllerModel() {
  const gltf = useLoader(GLTFLoader, "/models/Controller.glb");

  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 4.25 / Math.max(size.x, size.y, size.z);

    root.position.sub(center);
    root.scale.setScalar(scale);
    root.rotation.x = -Math.PI * 0.5;
    root.rotation.z = Math.PI;

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      child.material = materials.map((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;
        const upgraded = material.clone();
        upgraded.roughness = Math.min(upgraded.roughness ?? 0.45, 0.48);
        upgraded.metalness = Math.min(Math.max(upgraded.metalness ?? 0.05, 0.04), 0.3);
        upgraded.envMapIntensity = 0.55;
        return upgraded;
      });
    });

    return root;
  }, [gltf]);

  return <primitive object={scene} />;
}

function ControllerScene() {
  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight
        castShadow
        position={[-5, 6, 4]}
        intensity={0.82}
        color="#d8eef7"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={22}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <directionalLight
        position={[4, 1, -4]}
        intensity={0.14}
        color="#45d9ff"
      />
      <Environment
        preset="city"
        background={false}
        blur={0.95}
        environmentIntensity={0.38}
      />

      <Suspense fallback={null}>
        <ControllerModel />
      </Suspense>

      <ContactShadows
        position={[0, -2.03, 0]}
        opacity={0.28}
        scale={6.4}
        blur={2.8}
        far={4.4}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.55}
        rotateSpeed={0.72}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.75}
      />
    </>
  );
}

export function LocalControllerViewer() {
  return (
    <div
      className="spectral-local-controller-shell"
      data-render-quality="pbr-ao-aa-af-hd"
      aria-label="Interactive 3D controller"
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.78,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          position: [0, 0.22, 6.4],
          fov: 30,
          near: 0.05,
          far: 32,
        }}
      >
        <color attach="background" args={["#000000"]} />
        <ControllerScene />
      </Canvas>
    </div>
  );
}
