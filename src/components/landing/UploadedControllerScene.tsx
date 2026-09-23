import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";

/**
 * Palette auto-skinned from the uploaded Cinema 4D material library (*.mtl).
 * Each entry mirrors the Kd diffuse value of the matching newmtl block.
 */
const SKIN = {
  dullWhite: "#ffffff",
  shinyWhite: "#ffffff",
  shinyBlack: "#000000",
  logoBlack: "#050505",
  metalBits: "#b4bcbc",
  analogs: "#f2f4f5",
  blue: "#137af0",
  green: "#0af529",
  red: "#f51909",
  yellow: "#f5ce09",
  inserts: "#0a0d10",
} as const;

const BODY_MATERIAL = {
  color: SKIN.dullWhite,
  roughness: 0.35,
  metalness: 0.05,
};

const BLACK_MATERIAL = {
  color: SKIN.shinyBlack,
  roughness: 0.18,
  metalness: 0.18,
};

const DARK_MATERIAL = {
  color: SKIN.inserts,
  roughness: 0.32,
  metalness: 0.14,
};

function Button({
  position,
  color,
  scale = 1,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24 * scale, 0.27 * scale, 0.12 * scale, 32]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.16}
          metalness={0.04}
          clearcoat={0.85}
          clearcoatRoughness={0.14}
        />
      </mesh>
      <mesh position={[0, 0.072 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14 * scale, 0.014 * scale, 10, 32]} />
        <meshStandardMaterial color={SKIN.shinyWhite} roughness={0.2} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.078 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.11 * scale, 24]} />
        <meshStandardMaterial color={SKIN.inserts} roughness={0.25} metalness={0.05} />
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
        <meshStandardMaterial color={SKIN.logoBlack} roughness={0.24} metalness={0.2} />
      </mesh>
    </group>
  );
}

function Stick({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.31, 0.18, 32]} />
        <meshStandardMaterial color={SKIN.metalBits} roughness={0.3} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.28, 0.18, 32]} />
        <meshStandardMaterial color={SKIN.analogs} roughness={0.34} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.215, 0]}>
        <torusGeometry args={[0.16, 0.016, 12, 32]} />
        <meshStandardMaterial
          color={SKIN.blue}
          emissive={SKIN.blue}
          emissiveIntensity={0.55}
          roughness={0.22}
        />
      </mesh>
    </group>
  );
}

type Drag = {
  mode: "rotate" | "move" | null;
  x: number;
  y: number;
};

function ControllerModel() {
  const root = useRef<THREE.Group>(null);
  const drag = useRef<Drag>({ mode: null, x: 0, y: 0 });
  const spin = useRef({ x: 0.12, y: 0.18 });
  const velocity = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0 });
  const { size } = useThree();

  // Page-wide cursor tracking: the model leans toward the cursor anywhere on the page.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const stop = () => {
      drag.current.mode = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);

    if (drag.current.mode !== "rotate") {
      // Inertia from the last drag, then idle auto-spin blended with cursor lean.
      velocity.current.x *= 0.92;
      velocity.current.y *= 0.92;
      spin.current.y += velocity.current.y + dt * 0.22;
      spin.current.x = THREE.MathUtils.clamp(spin.current.x + velocity.current.x, -0.55, 0.55);

      const targetX = 0.1 + pointer.current.y * 0.16;
      spin.current.x = THREE.MathUtils.lerp(spin.current.x, targetX, 0.03);
    }

    group.rotation.y = spin.current.y + pointer.current.x * 0.12;
    group.rotation.x = spin.current.x;
    group.position.x = THREE.MathUtils.lerp(group.position.x, offset.current.x, 0.18);
    group.position.y = THREE.MathUtils.lerp(group.position.y, -0.12 + offset.current.y, 0.18);
  });

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const move = event.shiftKey || event.ctrlKey || event.button === 2 || event.button === 1;
    drag.current = { mode: move ? "move" : "rotate", x: event.clientX, y: event.clientY };
    velocity.current = { x: 0, y: 0 };
  };

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const state = drag.current;
    if (!state.mode) return;
    event.stopPropagation();
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    state.x = event.clientX;
    state.y = event.clientY;

    if (state.mode === "rotate") {
      spin.current.y += dx * 0.011;
      spin.current.x = THREE.MathUtils.clamp(spin.current.x + dy * 0.007, -0.55, 0.55);
      velocity.current = { x: dy * 0.0009, y: dx * 0.0014 };
    } else {
      const scale = 7 / Math.max(1, size.height);
      offset.current.x = THREE.MathUtils.clamp(offset.current.x + dx * scale, -2.4, 2.4);
      offset.current.y = THREE.MathUtils.clamp(offset.current.y - dy * scale, -1.4, 1.4);
    }
  };

  const handleDouble = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    offset.current = { x: 0, y: 0 };
    spin.current = { x: 0.12, y: 0.18 };
    velocity.current = { x: 0, y: 0 };
  };

  return (
    <group
      ref={root}
      scale={1.16}
      rotation={[0.08, 0.18, 0]}
      position={[0, -0.12, 0]}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onDoubleClick={handleDouble}
    >
      <RoundedBox args={[4.7, 1.32, 2.95]} radius={0.52} smoothness={8} castShadow receiveShadow>
        <meshPhysicalMaterial {...BODY_MATERIAL} clearcoat={0.3} clearcoatRoughness={0.26} />
      </RoundedBox>

      <RoundedBox
        args={[1.65, 1.08, 2.1]}
        radius={0.42}
        smoothness={7}
        position={[-1.7, -0.13, 0.32]}
        rotation={[0.06, 0, -0.11]}
        castShadow
      >
        <meshPhysicalMaterial {...BODY_MATERIAL} clearcoat={0.24} clearcoatRoughness={0.3} />
      </RoundedBox>
      <RoundedBox
        args={[1.65, 1.08, 2.1]}
        radius={0.42}
        smoothness={7}
        position={[1.7, -0.13, 0.32]}
        rotation={[0.06, 0, 0.11]}
        castShadow
      >
        <meshPhysicalMaterial {...BODY_MATERIAL} clearcoat={0.24} clearcoatRoughness={0.3} />
      </RoundedBox>

      <mesh position={[0, 0.58, -0.72]} castShadow>
        <boxGeometry args={[1.55, 0.28, 0.22]} />
        <meshStandardMaterial color={SKIN.metalBits} roughness={0.28} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.6, 0.96]} castShadow>
        <boxGeometry args={[1.8, 0.22, 0.28]} />
        <meshStandardMaterial {...DARK_MATERIAL} />
      </mesh>

      <mesh position={[0, 0.48, 0.12]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.18, 36]} />
        <meshStandardMaterial color={SKIN.logoBlack} roughness={0.2} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.61, 0.12]}>
        <cylinderGeometry args={[0.22, 0.24, 0.1, 32]} />
        <meshStandardMaterial
          color={SKIN.shinyWhite}
          emissive={SKIN.blue}
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.08}
        />
      </mesh>

      <DPad />
      <Stick position={[-0.75, 0.43, 0.56]} />
      <Stick position={[0.78, 0.43, -0.02]} />

      <group position={[1.62, 0.45, 0.5]}>
        <Button position={[0, 0, 0.36]} color={SKIN.green} />
        <Button position={[0.36, 0, 0]} color={SKIN.red} />
        <Button position={[0, 0, -0.36]} color={SKIN.yellow} />
        <Button position={[-0.36, 0, 0]} color={SKIN.blue} />
      </group>

      <mesh position={[-0.6, 0.58, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.13]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[0.6, 0.58, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.42, 0.18, 0.13]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>

      <mesh position={[-2.05, 0.62, -0.82]}>
        <boxGeometry args={[0.72, 0.24, 0.68]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[2.05, 0.62, -0.82]}>
        <boxGeometry args={[0.72, 0.24, 0.68]} />
        <meshStandardMaterial {...BLACK_MATERIAL} />
      </mesh>
      <mesh position={[-1.52, 0.57, -1.02]}>
        <boxGeometry args={[0.82, 0.24, 0.72]} />
        <meshStandardMaterial color={SKIN.metalBits} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[1.52, 0.57, -1.02]}>
        <boxGeometry args={[0.82, 0.24, 0.72]} />
        <meshStandardMaterial color={SKIN.metalBits} roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

export function UploadedControllerScene() {
  return (
    <div className="uploaded-controller-canvas" style={{ touchAction: "none", cursor: "grab" }}>
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
        <ambientLight intensity={0.38} />
        <directionalLight
          position={[4.5, 7, 5]}
          intensity={1.3}
          color="#b7ecff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00015}
        />
        <directionalLight position={[-4, 2, -2]} intensity={0.4} color="#6b7cff" />
        <pointLight position={[0, 2.6, 2.8]} intensity={0.75} color="#4ce8ff" distance={8} decay={2} />
        <Float speed={1.1} rotationIntensity={0.05} floatIntensity={0.09}>
          <ControllerModel />
        </Float>
        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.34}
          scale={8.5}
          blur={2.6}
          far={5}
          resolution={1024}
          color="#00141a"
        />
      </Canvas>
    </div>
  );
}
