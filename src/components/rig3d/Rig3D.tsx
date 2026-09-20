import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { PadScene } from "./PadScene";
import { WheelScene } from "./WheelScene";
import type { ControllerState, Settings } from "@/lib/controller-types";

function CameraRig({ mode }: { mode: "pad" | "wheel" }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (mode === "pad") {
      camera.position.set(0, 11.8, 0.01);
      camera.lookAt(0, 0, 0);
    } else {
      // Driver-seat eye point: slightly above the wheel, looking forward/down.
      camera.position.set(0, 1.65, 11.6);
      camera.lookAt(0, 0.0, 0.35);
    }
    camera.updateProjectionMatrix();
  }, [mode, camera]);
  return null;
}

export default function Rig3D({
  mode,
  settings,
  set,
  press,
}: {
  mode: "pad" | "wheel";
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
}) {
  return (
    <Canvas
      shadows
      dpr={1}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 1.65, 11.6], fov: 46 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#080b11"]} />
      <fog attach="fog" args={["#080b11", 16, 34]} />

      <CameraRig mode={mode} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#bcd8ff", "#12161f", 1.3]} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[0, 5, 9]} intensity={2.2} color="#dfe9ff" />
      <pointLight position={[-6, 3, 4]} intensity={70} color="#38bdf8" distance={22} />
      <pointLight position={[6, 3, 4]} intensity={55} color="#f97316" distance={20} />
      <spotLight position={[0, 0, 10]} angle={0.8} penumbra={1} intensity={120} color="#c7d9ff" />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 8, 0]} scale={[12, 12, 1]} />
        <Lightformer intensity={1.2} color="#77bfff" position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} />
      </Environment>

      <group scale={mode === "pad" ? 1.05 : 1.0} position={[0, mode === "pad" ? 0.1 : 0.25, 0]}>
        {mode === "pad" ? (
          <PadScene settings={settings} set={set} press={press} />
        ) : (
          <WheelScene settings={settings} set={set} press={press} />
        )}
      </group>

      <ContactShadows resolution={256} frames={1} position={[0, -1.6, 0]} opacity={0.6} scale={26} blur={2.6} far={8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0e15" metalness={0.4} roughness={0.85} />
      </mesh>
    </Canvas>
  );
}
