import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";

const BODY_MATERIAL = {
  color: "#d9dee1",
  roughness: 0.34,
  metalness: 0.04,
};

const BLACK_MATERIAL = {
  color: "#101419",
  roughness: 0.22,
  metalness: 0.12,
};

const DARK_MATERIAL = {
  color: "#252b31",
  roughness: 0.4,
  metalness: 0.08,
};

function Button({
  position,
  color,
  label,
  scale = 1,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  scale?: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24 * scale, 0.27 * scale, 0.12 * scale, 32]} />
        <meshStandardMaterial color={color} roughness={0.22} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.072 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14 * scale, 0.014 * scale, 10, 32]} />
        <meshStandardMaterial color="#f6f7f8" roughness={0.26} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.075 * scale, 0]}>
        <sphereGeometry args={[0.035 * scale, 14, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
      <group>
        <mesh position={[0, 0.078 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.11 * scale, 24]} />
          <meshStandardMaterial color={color} roughness={0.18} metalness={0.03} />
        </mesh>
      </group>
      <mesh position={[0, 0.16 * scale, 0]}>
        <planeGeometry args={[0.01, 0.01]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function DPad() {
  return (
    <group position={[-1.62, 0.34, 0.42]}>
      <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.22, 0.78, 0.14]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.78, 0.22, 0.14]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[0, 0.075, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.31, 0.31, 0.08]} />
        <meshStandardMaterial color="#171c21" roughness={0.3} metalness={0.12} />
      </mesh>
    </group>
  );
}

function Stick({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.31, 0.18, 32]} />
        <meshStandardMaterial {...DARK_MATERIAL} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.28, 0.18, 32]} />
        <meshStandardMaterial color="#0b1014" roughness={0.28} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.215, 0]}>
        <torusGeometry args={[0.16, 0.016, 12, 32]} />
        <meshStandardMaterial color="#4adfff" emissive="#16465a" emissiveIntensity={0.5} roughness={0.22} />
      </mesh>
    </group>
  );
}

function ControllerModel() {
  const root = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    if (!root.current) return;
    if (!dragging.current) {
      root.current.rotation.y += delta * 0.24;
      root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, 0.12, 0.025);
    }
  });

  const handleDown = (event: THREE.ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    dragging.current = true;
    pointer.current = { x: event.clientX, y: event.clientY };
  };

  const handleMove = (event: THREE.ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !root.current) return;
    event.stopPropagation();
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current = { x: event.clientX, y: event.clientY };
    root.current.rotation.y += dx * 0.012;
    root.current.rotation.x = THREE.MathUtils.clamp(root.current.rotation.x + dy * 0.007, -0.35, 0.35);
  };

  const release = (event?: THREE.ThreeEvent<PointerEvent>) => {
    event?.stopPropagation();
    dragging.current = false;
  };

  return (
    <group
      ref={root}
      scale={1.16}
      rotation={[0.08, 0.18, 0]}
      position={[0, -0.12, 0]}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerOut={release}
    >
      <RoundedBox args={[4.7, 1.32, 2.95]} radius={0.52} smoothness={8} position={[0, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...BODY_MATERIAL} clearcoat={0.16} clearcoatRoughness={0.28} />
      </RoundedBox>

      <RoundedBox
        args={[1.65, 1.08, 2.1]}
        radius={0.42}
        smoothness={7}
        position={[-1.7, -0.13, 0.32]}
        rotation={[0.06, 0, -0.11]}
        castShadow
      >
        <meshPhysicalMaterial {...BODY_MATERIAL} clearcoat={0.12} clearcoatRoughness={0.32} />
      </RoundedBox>
      <RoundedBox
        args={[1.65, 1.08, 2.1]}
        radius={0.42}
        smoothness={7}
        position={[1.7, -0.13, 0.32]}
        rotation={[0.06, 0, 0.11]}
        castShadow
      >
        <meshPhysicalMaterial {...BODY_MATERIAL} clearcoat={0.12} clearcoatRoughness={0.32} />
      </RoundedBox>

      <mesh position={[0, 0.58, -0.72]} castShadow>
        <boxGeometry args={[1.55, 0.28, 0.22]} />
        <meshStandardMaterial {...DARK_MATERIAL} />
      </mesh>
      <mesh position={[0, 0.6, 0.96]} castShadow>
        <boxGeometry args={[1.8, 0.22, 0.28]} />
        <meshStandardMaterial {...DARK_MATERIAL} />
      </mesh>

      <mesh position={[0, 0.48, 0.12]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.18, 36]} />
        <meshStandardMaterial color="#12171b" roughness={0.2} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.61, 0.12]}>
        <cylinderGeometry args={[0.22, 0.24, 0.1, 32]} />
        <meshStandardMaterial color="#73f2ff" emissive="#17495b" emissiveIntensity={0.25} roughness={0.22} metalness={0.08} />
      </mesh>

      <DPad />
      <Stick position={[-0.75, 0.43, 0.56]} />
      <Stick position={[0.78, 0.43, -0.02]} />

      <group position={[1.62, 0.45, 0.5]}>
        <Button position={[0, 0, 0.36]} color="#3ccf68" label="A" />
        <Button position={[0.36, 0, 0]} color="#d94d50" label="B" />
        <Button position={[0, 0, -0.36]} color="#e8c84a" label="Y" />
        <Button position={[-0.36, 0, 0]} color="#3f8ee8" label="X" />
      </group>

      <mesh position={[-0.6, 0.58, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.13]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[0.6, 0.58, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.13]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>

      <mesh position={[-2.05, 0.62, -0.82]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.72, 0.24, 0.68]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[2.05, 0.62, -0.82]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.72, 0.24, 0.68]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[-1.52, 0.57, -1.02]}>
        <boxGeometry args={[0.82, 0.24, 0.72]} />
        <meshStandardMaterial color="#1b2228" roughness={0.28} />
      </mesh>
      <mesh position={[1.52, 0.57, -1.02]}>
        <boxGeometry args={[0.82, 0.24, 0.72]} />
        <meshStandardMaterial color="#1b2228" roughness={0.28} />
      </mesh>

      <group position={[0, -0.07, 0.1]}>
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.56, 0.06, 0.05]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.32} />
        </mesh>
      </group>
    </group>
  );
}

export function UploadedControllerScene() {
  return (
    <div className="uploaded-controller-canvas">
      <Canvas
        dpr={[1, 2]}
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.92,
        }}
        camera={{ position: [0, 1.0, 8.8], fov: 32 }}
      >
        <ambientLight intensity={0.34} />
        <directionalLight
          position={[4.5, 7, 5]}
          intensity={1.25}
          color="#b7ecff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00015}
        />
        <directionalLight position={[-4, 2, -2]} intensity={0.38} color="#6b7cff" />
        <pointLight position={[0, 2.6, 2.8]} intensity={0.72} color="#4ce8ff" distance={8} decay={2} />
        <Float speed={1.1} rotationIntensity={0.06} floatIntensity={0.1}>
          <ControllerModel />
        </Float>
        <ContactShadows position={[0, -1.35, 0]} opacity={0.34} scale={8.5} blur={2.6} far={5} resolution={1024} color="#00141a" />
      </Canvas>
    </div>
  );
}
