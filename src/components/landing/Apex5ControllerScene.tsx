import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AccumulativeShadows,
  ContactShadows,
  Environment,
  Float,
  OrbitControls,
  PerspectiveCamera,
  RandomizedLight,
  RoundedBox,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function createApex5Body() {
  const shape = new THREE.Shape();

  shape.moveTo(-3.2, 1.18);
  shape.bezierCurveTo(-3.0, 1.62, -2.28, 1.86, -1.36, 1.73);
  shape.bezierCurveTo(-0.52, 1.61, 0.52, 1.61, 1.36, 1.73);
  shape.bezierCurveTo(2.28, 1.86, 3.0, 1.62, 3.2, 1.18);
  shape.bezierCurveTo(3.48, 0.68, 3.46, 0.08, 3.15, -0.5);
  shape.bezierCurveTo(2.89, -1.01, 2.55, -1.65, 2.17, -1.91);
  shape.bezierCurveTo(1.78, -2.18, 1.45, -2.05, 1.13, -1.57);
  shape.bezierCurveTo(0.84, -1.15, 0.64, -0.81, 0.33, -0.62);
  shape.bezierCurveTo(0.08, -0.47, -0.08, -0.47, -0.33, -0.62);
  shape.bezierCurveTo(-0.64, -0.81, -0.84, -1.15, -1.13, -1.57);
  shape.bezierCurveTo(-1.45, -2.05, -1.78, -2.18, -2.17, -1.91);
  shape.bezierCurveTo(-2.55, -1.65, -2.89, -1.01, -3.15, -0.5);
  shape.bezierCurveTo(-3.46, 0.08, -3.48, 0.68, -3.2, 1.18);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.78,
    steps: 5,
    bevelEnabled: true,
    bevelThickness: 0.17,
    bevelSize: 0.13,
    bevelSegments: 10,
    curveSegments: 24,
  });

  geometry.center();
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function TextTexture({ text, accent }: { text: string; accent: string }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 118px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f5f7f8";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);

    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    result.needsUpdate = true;
    return result;
  }, [accent, text]);

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <mesh position={[0, 0.02, 0.13]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.45, 0.22]} />
      <meshBasicMaterial map={texture} transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}

function FaceButton({
  position,
  label,
  accent,
}: {
  position: [number, number, number];
  label: string;
  accent: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.34, 0.36, 0.14, 72]} />
        <meshPhysicalMaterial
          color="#a4aeb4"
          metalness={0.24}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.045}
        />
      </mesh>
      <mesh position={[0, 0.085, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.25, 0.11, 72]} />
        <meshPhysicalMaterial
          color="#f5f7f8"
          metalness={0.08}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.04}
        />
      </mesh>
      <mesh position={[0, 0.139, 0]}>
        <torusGeometry args={[0.238, 0.013, 12, 72]} />
        <meshBasicMaterial color={accent} transparent opacity={0.68} />
      </mesh>
      <TextTexture text={label} accent={accent} />
    </group>
  );
}

function AnalogStick({
  position,
  accent,
  phase,
}: {
  position: [number, number, number];
  accent: string;
  phase: number;
}) {
  const root = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;

    const targetTiltX = Math.sin(t * 0.9 + phase) * 0.028;
    const targetTiltZ = Math.cos(t * 0.82 + phase) * 0.035;

    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, targetTiltX, 4.2, delta);
    root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, targetTiltZ, 4.2, delta);
  });

  return (
    <group ref={root} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.34, 0.39, 0.12, 72]} />
        <meshPhysicalMaterial
          color="#dce1e4"
          metalness={0.08}
          roughness={0.22}
          clearcoat={0.98}
          clearcoatRoughness={0.05}
        />
      </mesh>
      <mesh position={[0, 0.105, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.24, 72]} />
        <meshPhysicalMaterial
          color="#48535d"
          metalness={0.76}
          roughness={0.18}
          clearcoat={0.78}
          clearcoatRoughness={0.07}
        />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.275, 0.245, 0.23, 72]} />
        <meshPhysicalMaterial
          color="#f1f4f5"
          metalness={0.1}
          roughness={0.17}
          clearcoat={1}
          clearcoatRoughness={0.04}
        />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <torusGeometry args={[0.248, 0.027, 12, 72]} />
        <meshBasicMaterial color={accent} transparent opacity={0.98} />
      </mesh>
      <mesh position={[0, 0.424, 0]}>
        <torusGeometry args={[0.21, 0.012, 10, 72]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function DPad() {
  return (
    <group position={[-2.04, 0.53, 0.03]}>
      <RoundedBox args={[0.38, 0.15, 1.0]} radius={0.09} smoothness={10} castShadow>
        <meshPhysicalMaterial
          color="#e5eaed"
          metalness={0.08}
          roughness={0.18}
          clearcoat={0.98}
          clearcoatRoughness={0.045}
        />
      </RoundedBox>
      <RoundedBox args={[1.0, 0.15, 0.38]} radius={0.09} smoothness={10} castShadow>
        <meshPhysicalMaterial
          color="#e5eaed"
          metalness={0.08}
          roughness={0.18}
          clearcoat={0.98}
          clearcoatRoughness={0.045}
        />
      </RoundedBox>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.045, 64]} />
        <meshPhysicalMaterial
          color="#abb5bc"
          metalness={0.2}
          roughness={0.25}
          clearcoat={0.8}
        />
      </mesh>
    </group>
  );
}

function ShoulderButtons() {
  return (
    <>
      {[
        [-2.25, 0.55, -0.83, -0.11],
        [-1.52, 0.57, -0.93, -0.06],
        [1.52, 0.57, -0.93, 0.06],
        [2.25, 0.55, -0.83, 0.11],
      ].map(([x, y, z, rot], index) => (
        <RoundedBox
          key={index}
          args={[0.55, 0.14, 0.26]}
          radius={0.09}
          smoothness={8}
          position={[x, y, z]}
          rotation={[0, rot, 0]}
          castShadow
        >
          <meshPhysicalMaterial
            color="#f1f4f5"
            metalness={0.07}
            roughness={0.18}
            clearcoat={0.98}
            clearcoatRoughness={0.05}
          />
        </RoundedBox>
      ))}
    </>
  );
}

function Trigger({
  position,
  rotation,
  label,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  label: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.74, 0.18, 0.31]} radius={0.1} smoothness={10} castShadow>
        <meshPhysicalMaterial
          color="#f1f4f5"
          metalness={0.06}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </RoundedBox>
      <TextTexture text={label} accent="#6adfff" />
    </group>
  );
}

function CenterScreen() {
  const screen = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!screen.current) return;
    const material = screen.current.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    material.emissiveIntensity = 0.46 + Math.sin(t * 3.3) * 0.08;
  });

  return (
    <group position={[0, 0.68, 0.03]}>
      <RoundedBox args={[1.22, 0.065, 0.48]} radius={0.1} smoothness={10} castShadow>
        <meshPhysicalMaterial
          color="#1a2025"
          metalness={0.6}
          roughness={0.16}
          clearcoat={0.94}
        />
      </RoundedBox>
      <mesh ref={screen} position={[0, 0.04, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.02, 0.3]} />
        <meshStandardMaterial
          color="#12232d"
          emissive="#2de7ff"
          emissiveIntensity={0.46}
          metalness={0.3}
          roughness={0.16}
        />
      </mesh>
      <mesh position={[0, 0.046, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.84, 0.018]} />
        <meshBasicMaterial color="#b6fbff" transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function LightBand() {
  const leftCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.86, 0.1, -1.67),
        new THREE.Vector3(-2.5, 0.07, -1.77),
        new THREE.Vector3(-1.82, 0.045, -1.81),
        new THREE.Vector3(-1.02, 0.055, -1.79),
      ]),
    [],
  );
  const rightCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.02, 0.055, -1.79),
        new THREE.Vector3(1.82, 0.045, -1.81),
        new THREE.Vector3(2.5, 0.07, -1.77),
        new THREE.Vector3(2.86, 0.1, -1.67),
      ]),
    [],
  );

  const leftGeometry = useMemo(() => new THREE.TubeGeometry(leftCurve, 140, 0.032, 10, false), [leftCurve]);
  const rightGeometry = useMemo(() => new THREE.TubeGeometry(rightCurve, 140, 0.032, 10, false), [rightCurve]);

  useEffect(() => {
    return () => {
      leftGeometry.dispose();
      rightGeometry.dispose();
    };
  }, [leftGeometry, rightGeometry]);

  return (
    <>
      <mesh geometry={leftGeometry}>
        <meshBasicMaterial color="#2797ff" transparent opacity={0.98} />
      </mesh>
      <mesh geometry={rightGeometry}>
        <meshBasicMaterial color="#27eaff" transparent opacity={1} />
      </mesh>
      <mesh position={[0, 0.11, -1.81]}>
        <boxGeometry args={[0.74, 0.037, 0.04]} />
        <meshBasicMaterial color="#9af7ff" transparent opacity={0.74} />
      </mesh>
    </>
  );
}

function GripTexture() {
  const dots = useMemo(() => {
    const points: Array<[number, number, number]> = [];
    for (let x = -4; x <= 4; x += 1) {
      for (let z = 0; z < 8; z += 1) {
        const side = x < 0 ? -1 : 1;
        const baseX = side * (2.4 + Math.abs(x) * 0.04);
        points.push([baseX + (Math.random() - 0.5) * 0.08, 0.39 + z * 0.055, 0.34 + (Math.random() - 0.5) * 0.26]);
      }
    }
    return points;
  }, []);

  return (
    <>
      {dots.map((position, index) => (
        <mesh key={index} position={position} scale={[0.018, 0.012, 0.018]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color="#65717a" roughness={0.66} metalness={0.05} />
        </mesh>
      ))}
    </>
  );
}

function Apex5Model() {
  const root = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector2(0.28, 0.02));
  const smoothed = useRef(new THREE.Vector2(0.28, 0.02));
  const { camera, viewport } = useThree();
  const body = useMemo(createApex5Body, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const nx = THREE.MathUtils.clamp((event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1, -1, 1);
      const ny = THREE.MathUtils.clamp(-((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1), -1, 1);
      target.current.set(nx, ny);
    };

    window.addEventListener("pointermove", move, { passive: true });

    return () => {
      window.removeEventListener("pointermove", move);
      body.dispose();
    };
  }, [body]);

  useFrame((state, delta) => {
    if (!root.current) return;

    smoothed.current.x = THREE.MathUtils.damp(smoothed.current.x, target.current.x, 7.5, delta);
    smoothed.current.y = THREE.MathUtils.damp(smoothed.current.y, target.current.y, 7.5, delta);

    const x = smoothed.current.x;
    const y = smoothed.current.y;
    const t = state.clock.elapsedTime;

    const scale = THREE.MathUtils.clamp(viewport.width / 8.5, 0.54, 1.03);
    const targetPosition = new THREE.Vector3(x * 1.95, y * 1.25 + Math.sin(t * 0.62) * 0.05, 0.16 + Math.abs(x) * 0.06);
    const targetRotation = new THREE.Euler(
      -0.18 - y * 0.34,
      x * 0.56 + Math.sin(t * 0.3) * 0.018,
      -x * 0.19,
    );

    root.current.position.lerp(targetPosition, 1 - Math.exp(-7.8 * delta));
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, targetRotation.x, 7.0, delta);
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, targetRotation.y, 7.0, delta);
    root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, targetRotation.z, 6.2, delta);

    const finalScale = scale * (1 + Math.sin(t * 0.9) * 0.006);
    root.current.scale.setScalar(finalScale);

    camera.position.x = THREE.MathUtils.damp(camera.position.x, x * 0.16, 2.2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, y * 0.09, 2.2, delta);
    camera.lookAt(0.42, 0.04, 0);
  });

  return (
    <group ref={root} position={[0.95, 0.04, 0.16]} rotation={[-0.18, 0.16, -0.035]}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#eef1f2"
          metalness={0.075}
          roughness={0.19}
          clearcoat={1}
          clearcoatRoughness={0.045}
          reflectivity={0.97}
          envMapIntensity={2.1}
        />
      </mesh>

      <mesh geometry={body} scale={0.988} position={[0, 0.018, 0.012]} receiveShadow>
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.02}
          roughness={0.24}
          clearcoat={0.82}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.36}
          envMapIntensity={1.7}
        />
      </mesh>

      <RoundedBox args={[3.68, 0.14, 1.48]} radius={0.34} smoothness={12} position={[0, 0.43, 0.1]} castShadow>
        <meshPhysicalMaterial
          color="#dce1e4"
          metalness={0.06}
          roughness={0.21}
          clearcoat={0.98}
          clearcoatRoughness={0.05}
          envMapIntensity={1.8}
        />
      </RoundedBox>

      <RoundedBox args={[2.98, 0.095, 0.98]} radius={0.22} smoothness={11} position={[0, 0.515, 0.18]} castShadow>
        <meshPhysicalMaterial
          color="#f6f8f8"
          metalness={0.035}
          roughness={0.17}
          clearcoat={1}
          clearcoatRoughness={0.04}
          envMapIntensity={2}
        />
      </RoundedBox>

      <RoundedBox args={[1.28, 0.07, 0.58]} radius={0.13} smoothness={9} position={[0, 0.58, 0.04]}>
        <meshPhysicalMaterial
          color="#c6cdd1"
          metalness={0.14}
          roughness={0.2}
          clearcoat={0.9}
          clearcoatRoughness={0.06}
        />
      </RoundedBox>

      <CenterScreen />
      <DPad />

      <group position={[1.98, 0.56, 0.05]}>
        <FaceButton position={[0, 0.41, 0]} label="Y" accent="#dcecff" />
        <FaceButton position={[-0.4, 0, 0]} label="X" accent="#62dcff" />
        <FaceButton position={[0.4, 0, 0]} label="B" accent="#ff759a" />
        <FaceButton position={[0, -0.41, 0]} label="A" accent="#84f9c5" />
      </group>

      <AnalogStick position={[-1.04, 0.61, 0.26]} accent="#318eff" phase={0.6} />
      <AnalogStick position={[0.9, 0.61, 0.27]} accent="#2ce9ff" phase={1.4} />

      <group position={[-0.41, 0.57, 0.79]}>
        <RoundedBox args={[0.43, 0.08, 0.25]} radius={0.075} smoothness={8} castShadow>
          <meshPhysicalMaterial color="#e8ecee" metalness={0.05} roughness={0.18} clearcoat={0.9} />
        </RoundedBox>
        <RoundedBox args={[0.43, 0.08, 0.25]} radius={0.075} smoothness={8} position={[0.82, 0, 0]} castShadow>
          <meshPhysicalMaterial color="#e8ecee" metalness={0.05} roughness={0.18} clearcoat={0.9} />
        </RoundedBox>
      </group>

      <ShoulderButtons />
      <Trigger position={[-1.66, 0.53, -0.95]} rotation={[0.05, -0.08, -0.06]} label="LT" />
      <Trigger position={[1.66, 0.53, -0.95]} rotation={[0.05, 0.08, 0.06]} label="RT" />
      <LightBand />
      <GripTexture />

      <mesh position={[0, 0.1, -1.82]}>
        <boxGeometry args={[0.78, 0.037, 0.045]} />
        <meshBasicMaterial color="#99f8ff" transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function StudioStage() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[15, 10]} />
        <meshPhysicalMaterial
          color="#04080d"
          metalness={0.48}
          roughness={0.34}
          clearcoat={0.3}
          clearcoatRoughness={0.18}
        />
      </mesh>

      <mesh position={[0, 0.25, -2.7]} rotation={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[13, 6]} />
        <meshStandardMaterial color="#06101a" roughness={0.96} metalness={0.05} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.46, -0.38]}>
        <ringGeometry args={[2.85, 2.87, 180]} />
        <meshBasicMaterial color="#39eaff" transparent opacity={0.28} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.455, -0.46]}>
        <ringGeometry args={[3.6, 3.605, 180]} />
        <meshBasicMaterial color="#8168ff" transparent opacity={0.14} />
      </mesh>
    </>
  );
}

function StudioScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0.05, 0.14, 8.55]} fov={31} />

      <Environment preset="studio" background={false} blur={0.4} />

      <StudioStage />

      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#ffffff", "#06101a", 0.75]} />

      <directionalLight
        castShadow
        position={[5.8, 8.6, 5.6]}
        intensity={4.8}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
      />

      <directionalLight position={[-5.2, 3.6, 4.5]} intensity={2.35} color="#77deff" />
      <pointLight position={[0, 2.4, 3.2]} intensity={4.2} distance={9} color="#ffffff" />
      <pointLight position={[-3.2, 0.5, 2.0]} intensity={3.1} distance={7} color="#35dfff" />
      <pointLight position={[3.4, -0.2, 2.0]} intensity={2.6} distance={7} color="#7a5fff" />

      <Float speed={0.34} floatIntensity={0.065} rotationIntensity={0.008}>
        <Apex5Model />
      </Float>

      <AccumulativeShadows
        temporal
        frames={48}
        color="#000000"
        opacity={0.58}
        scale={7.4}
        position={[0.9, -1.48, 0.05]}
      >
        <RandomizedLight amount={6} radius={5.4} ambient={0.58} intensity={3.2} position={[3.8, 7.8, 4.8]} />
      </AccumulativeShadows>

      <ContactShadows
        position={[0.8, -1.49, 0.05]}
        scale={6.5}
        opacity={0.5}
        blur={2.2}
        far={5.4}
        resolution={1024}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.055}
        enablePan={false}
        enableZoom
        minDistance={6.4}
        maxDistance={11.5}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 1.9}
        autoRotate
        autoRotateSpeed={0.55}
      />
    </>
  );
}

export function Apex5ControllerScene() {
  return (
    <div className="apex5-controller-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.85]}
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.13,
        }}
        camera={{ position: [0.05, 0.14, 8.55], fov: 31 }}
      >
        <StudioScene />
      </Canvas>
    </div>
  );
}
