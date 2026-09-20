import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { PadScene } from "./PadScene";
import { WheelScene } from "./WheelScene";
import type { ControllerState, Settings } from "@/lib/controller-types";

function CameraRig({ mode }: { mode: "pad" | "wheel" }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (mode === "pad") camera.position.set(0, 7.2, 5.6);
    else camera.position.set(0, 6.2, 8.8);
    camera.lookAt(0, 0, 0);
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
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: mode === "pad" ? [0, 6.8, 4.8] : [0, 6.6, 8.2], fov: 42 }}
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
      <directionalLight position={[0, 4, 9]} intensity={1.6} color="#dfe9ff" />
      <pointLight position={[-6, 3, 4]} intensity={70} color="#38bdf8" distance={22} />
      <pointLight position={[6, 3, 4]} intensity={55} color="#f97316" distance={20} />
      <spotLight position={[0, 10, 0]} angle={0.8} penumbra={1} intensity={110} color="#c7d9ff" />

      <group scale={mode === "pad" ? 0.92 : 0.8} position={[0, mode === "pad" ? 0 : 0.5, 0]}>
        {mode === "pad" ? (
          <PadScene settings={settings} set={set} press={press} />
        ) : (
          <WheelScene settings={settings} set={set} press={press} />
        )}
      </group>

      <ContactShadows position={[0, -1.6, 0]} opacity={0.6} scale={26} blur={2.6} far={8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0e15" metalness={0.4} roughness={0.85} />
      </mesh>
    </Canvas>
  );
}
