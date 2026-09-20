import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { PadScene } from "./PadScene";
import { WheelScene } from "./WheelScene";
import type { ControllerState, Settings } from "@/lib/controller-types";

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
      camera={{ position: mode === "pad" ? [0, 5.4, 6.2] : [0, 5.2, 7.4], fov: 42 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#080b11"]} />
      <fog attach="fog" args={["#080b11", 12, 26]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#9ecbff", "#0a0e15", 0.7]} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-6, 3, 4]} intensity={45} color="#38bdf8" distance={20} />
      <pointLight position={[6, 3, 4]} intensity={35} color="#f97316" distance={20} />
      <spotLight position={[0, 10, 0]} angle={0.8} penumbra={1} intensity={60} color="#c7d9ff" />

      <group rotation={[0, 0, 0]}>
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
