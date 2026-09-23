import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, PerspectiveCamera, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function BackgroundWorld() {
  const world = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((state, delta) => {
    if (!world.current) return;
    const t = state.clock.elapsedTime;
    world.current.rotation.y = THREE.MathUtils.damp(
      world.current.rotation.y,
      pointer.x * 0.055,
      1.15,
      delta,
    );
    world.current.rotation.x = THREE.MathUtils.damp(
      world.current.rotation.x,
      -pointer.y * 0.035,
      1.15,
      delta,
    );
    world.current.position.y = Math.sin(t * 0.18) * 0.045;
  });

  return (
    <group ref={world}>
      <mesh position={[0, 1.18, -4.3]} scale={[2.7, 2.7, 2.7]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#06111f"
          emissive="#12385b"
          emissiveIntensity={0.72}
          metalness={0.12}
          roughness={0.6}
        />
      </mesh>

      <Float speed={0.32} floatIntensity={0.18} rotationIntensity={0.04}>
        <mesh position={[0, 1.18, -4.02]} rotation={[0.2, 0.22, -0.27]}>
          <torusGeometry args={[2.94, 0.022, 10, 180]} />
          <meshBasicMaterial color="#51e7ff" transparent opacity={0.56} />
        </mesh>
        <mesh position={[0, 1.18, -4.06]} rotation={[0.2, -0.14, -0.27]}>
          <torusGeometry args={[3.22, 0.009, 8, 180]} />
          <meshBasicMaterial color="#8c64ff" transparent opacity={0.34} />
        </mesh>
        <mesh position={[0, 1.18, -4.1]} rotation={[0.46, 0.12, 0.12]}>
          <torusGeometry args={[3.65, 0.006, 8, 180]} />
          <meshBasicMaterial color="#53ffc6" transparent opacity={0.16} />
        </mesh>
      </Float>

      {[
        [-4.8, -1.1, -2.2],
        [-3.5, -1.45, -2.8],
        [3.8, -1.28, -2.5],
        [4.9, -0.84, -3.5],
        [-1.05, -1.52, -3.1],
        [1.95, -1.43, -2.9],
      ].map(([x, y, z], index) => (
        <mesh
          key={index}
          position={[x, y, z]}
          rotation={[0.1 * index, 0.14 * index, -0.08 * index]}
        >
          <icosahedronGeometry args={[0.38 + (index % 3) * 0.12, 2]} />
          <meshStandardMaterial
            color="#07111a"
            emissive="#092a3d"
            emissiveIntensity={0.46}
            roughness={0.86}
            metalness={0.2}
          />
        </mesh>
      ))}

      <mesh position={[0, -1.52, -2.65]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 7, 64, 32]} />
        <meshStandardMaterial
          color="#02070c"
          emissive="#041827"
          emissiveIntensity={0.34}
          metalness={0.16}
          roughness={0.98}
        />
      </mesh>

      <mesh position={[0, -1.47, -2.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.52, 2.56, 160]} />
        <meshBasicMaterial color="#31e8ff" transparent opacity={0.3} />
      </mesh>

      <mesh
        position={[0, -1.43, -2.42]}
        rotation={[-Math.PI / 2, 0, Math.PI / 8]}
      >
        <ringGeometry args={[3.22, 3.225, 160]} />
        <meshBasicMaterial color="#8167ff" transparent opacity={0.19} />
      </mesh>

      <Sparkles count={190} scale={[10, 5.8, 9]} size={2.5} speed={0.18} color="#6deaff" />
      <Sparkles count={55} scale={[8, 4.6, 7]} size={4} speed={0.08} color="#bba8ff" />
    </group>
  );
}

export function LandingScene() {
  return (
    <div className="landing-3d-canvas landing-3d-canvas-spectral" aria-hidden="true">
      <div className="landing-scanline-overlay" />
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0.3, 8.8]} fov={35} />
        <ambientLight intensity={0.16} />
        <hemisphereLight args={["#78e9ff", "#020509", 0.48]} />
        <directionalLight position={[4, 6, 5]} intensity={2.05} color="#d9f8ff" />
        <directionalLight position={[-4, 2, 2]} intensity={1.15} color="#43e7ff" />
        <pointLight position={[0, -0.8, 2.8]} intensity={3.1} distance={9} color="#1ccfff" />
        <pointLight position={[2.5, 1.8, -1.6]} intensity={2.1} distance={7} color="#7156ff" />
        <BackgroundWorld />
      </Canvas>
    </div>
  );
}
