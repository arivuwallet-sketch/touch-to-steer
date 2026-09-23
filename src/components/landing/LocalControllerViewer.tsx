import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { Canvas, useLoader } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows } from "@react-three/drei";

function ControllerModel() {
  const object = useLoader(OBJLoader, "/models/Controller.obj");
  const prepared = useMemo(() => {
    const root = object.clone(true);
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.geometry.computeVertexNormals();

      const material = new THREE.MeshPhysicalMaterial({
        color: 0xe8edf1,
        roughness: 0.33,
        metalness: 0.12,
        clearcoat: 0.18,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.65,
      });
      child.material = material;
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 4.2 / Math.max(size.x, size.y, size.z);

    root.position.sub(center);
    root.scale.setScalar(scale);
    root.rotation.x = -Math.PI * 0.5;
    root.rotation.z = Math.PI;

    return root;
  }, [object]);

  return <primitive object={prepared} />;
}

function ControllerScene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={[-4, 5, 5]}
        intensity={1.1}
        color="#d9f2ff"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
      />
      <directionalLight
        position={[4, 1, -3]}
        intensity={0.35}
        color="#5fdcff"
      />
      <Environment preset="studio" background={false} blur={0.7} />
      <Suspense fallback={null}>
        <ControllerModel />
      </Suspense>
      <ContactShadows
        position={[0, -2.05, 0]}
        opacity={0.42}
        scale={7}
        blur={2.6}
        far={4.6}
      />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.62}
        rotateSpeed={0.7}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.72}
      />
    </>
  );
}

export function LocalControllerViewer() {
  return (
    <div className="spectral-local-controller-shell" data-render-quality="pbr-ssao-hd">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.82,
        }}
        camera={{ position: [0, 0.25, 6.4], fov: 30, near: 0.1, far: 30 }}
      >
        <color attach="background" args={["#000000"]} />
        <ControllerScene />
      </Canvas>
    </div>
  );
}
