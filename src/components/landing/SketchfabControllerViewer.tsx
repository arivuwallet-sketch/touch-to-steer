import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { Box3, Color, MeshPhysicalMaterial, Object3D, Vector3 } from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

function tuneModel(root: Object3D) {
  const bounds = new Box3().setFromObject(root);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  root.position.sub(center);
  root.scale.setScalar(6.2 / Math.max(size.x, size.y, size.z, 0.001));

  root.traverse((child: any) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    child.material = mats.map((source: any) => {
      const name = String(source?.name ?? "").toLowerCase();
      const color = source?.color?.clone?.() ?? new Color("#e9eef1");
      return new MeshPhysicalMaterial({
        color,
        metalness: name.includes("metal") ? 0.78 : name.includes("black") ? 0.2 : 0.04,
        roughness: name.includes("shiny") ? 0.22 : name.includes("analog") ? 0.38 : name.includes("dull") ? 0.5 : 0.3,
        clearcoat: name.includes("shiny") ? 0.32 : 0.1,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.05,
        transparent: Boolean(source?.transparent),
        opacity: source?.opacity ?? 1,
        depthWrite: !source?.transparent,
      });
    });
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function ControllerAsset({ onError }: { onError: () => void }) {
  const [model, setModel] = useState<Object3D | null>(null);

  useEffect(() => {
    let mounted = true;
    const materials = new MTLLoader();
    materials.load(
      "/models/Controller.mtl",
      (creator) => {
        creator.preload();
        const loader = new OBJLoader();
        loader.setMaterials(creator);
        loader.load(
          "/models/Controller.obj",
          (object) => {
            if (!mounted) return;
            tuneModel(object);
            setModel(object);
          },
          undefined,
          () => mounted && onError(),
        );
      },
      undefined,
      () => mounted && onError(),
    );
    return () => {
      mounted = false;
    };
  }, [onError]);

  if (!model) return null;
  return <primitive object={model} />;
}

export function SketchfabControllerViewer() {
  const [error, setError] = useState(false);

  return (
    <div className="spectral-sketchfab-shell spectral-local-controller-shell">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.2, 10.8], fov: 34, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.28} />
        <hemisphereLight args={["#8eeaff", "#02070b", 0.72]} />
        <directionalLight
          castShadow
          position={[-5, 7, 6]}
          intensity={1.55}
          color="#dceff4"
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00025}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[5, 1, -4]} intensity={0.7} color="#62dfff" />
        <pointLight position={[0, 2, 5]} intensity={7} distance={18} decay={2} color="#bfefff" />
        <Suspense fallback={null}>
          <ControllerAsset onError={() => setError(true)} />
        </Suspense>
        <ContactShadows
          position={[0, -2.55, 0]}
          opacity={0.28}
          scale={8.5}
          blur={2.6}
          far={5.4}
          resolution={1024}
          color="#001419"
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.075}
          rotateSpeed={0.72}
          autoRotate
          autoRotateSpeed={0.52}
          minPolarAngle={Math.PI * 0.28}
          maxPolarAngle={Math.PI * 0.72}
        />
      </Canvas>

      {error ? (
        <div className="spectral-model-fallback" aria-hidden="true">
          <span>LOCAL CONTROLLER ASSET OFFLINE</span>
        </div>
      ) : null}
    </div>
  );
}
