import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AccumulativeShadows,
  ContactShadows,
  Float,
  PerspectiveCamera,
  RandomizedLight,
  RoundedBox,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function createApex5Body() {
  const shape = new THREE.Shape();

  shape.moveTo(-3.18, 1.12);
  shape.bezierCurveTo(-2.92, 1.58, -2.2, 1.83, -1.3, 1.68);
  shape.bezierCurveTo(-0.55, 1.55, 0.55, 1.55, 1.3, 1.68);
  shape.bezierCurveTo(2.2, 1.83, 2.92, 1.58, 3.18, 1.12);
  shape.bezierCurveTo(3.46, 0.66, 3.42, 0.05, 3.14, -0.52);
  shape.bezierCurveTo(2.9, -1.03, 2.58, -1.62, 2.18, -1.9);
  shape.bezierCurveTo(1.83, -2.14, 1.46, -2.02, 1.16, -1.56);
  shape.bezierCurveTo(0.9, -1.16, 0.68, -0.78, 0.34, -0.6);
  shape.bezierCurveTo(0.09, -0.47, -0.09, -0.47, -0.34, -0.6);
  shape.bezierCurveTo(-0.68, -0.78, -0.9, -1.16, -1.16, -1.56);
  shape.bezierCurveTo(-1.46, -2.02, -1.83, -2.14, -2.18, -1.9);
  shape.bezierCurveTo(-2.58, -1.62, -2.9, -1.03, -3.14, -0.52);
  shape.bezierCurveTo(-3.42, 0.05, -3.46, 0.66, -3.18, 1.12);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.72,
    steps: 4,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.12,
    bevelSegments: 9,
    curveSegments: 20,
  });

  geometry.center();
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createLabelTexture(text: string, accent: string) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, 256, 256);
  context.fillStyle = "rgba(0,0,0,0)";
  context.fillRect(0, 0, 256, 256);

  context.fillStyle = "#eaf1f4";
  context.font = "700 96px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = accent;
  context.shadowBlur = 16;
  context.fillText(text, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
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
  const texture = useMemo(() => createLabelTexture(label, accent), [accent, label]);

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.31, 0.34, 0.13, 64]} />
        <meshPhysicalMaterial
          color="#9ea8af"
          metalness={0.28}
          roughness={0.24}
          clearcoat={0.95}
          clearcoatRoughness={0.07}
        />
      </mesh>

      <mesh position={[0, 0.075, 0]} castShadow>
        <cylinderGeometry args={[0.258, 0.245, 0.105, 64]} />
        <meshPhysicalMaterial
          color="#f5f7f8"
          metalness={0.1}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.055}
        />
      </mesh>

      <mesh position={[0, 0.131, 0]}>
        <torusGeometry args={[0.226, 0.012, 10, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.52} />
      </mesh>

      {texture ? (
        <mesh position={[0, 0.136, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.255, 0.255]} />
          <meshBasicMaterial map={texture} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function DPad() {
  return (
    <group position={[-1.98, 0.54, 0.05]} rotation={[0, 0.04, 0]}>
      <RoundedBox args={[0.37, 0.14, 0.97]} radius={0.09} smoothness={8} castShadow>
        <meshPhysicalMaterial
          color="#e6eaec"
          metalness={0.08}
          roughness={0.2}
          clearcoat={0.95}
          clearcoatRoughness={0.06}
        />
      </RoundedBox>

      <RoundedBox args={[0.97, 0.14, 0.37]} radius={0.09} smoothness={8} castShadow>
        <meshPhysicalMaterial
          color="#e6eaec"
          metalness={0.08}
          roughness={0.2}
          clearcoat={0.95}
          clearcoatRoughness={0.06}
        />
      </RoundedBox>

      <mesh position={[0, 0.086, 0]}>
        <torusGeometry args={[0.22, 0.035, 12, 64]} />
        <meshPhysicalMaterial
          color="#adb6bc"
          metalness={0.16}
          roughness={0.28}
          clearcoat={0.8}
        />
      </mesh>
    </group>
  );
}

function Stick({
  position,
  accent,
  phase,
}: {
  position: [number, number, number];
  accent: string;
  phase: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const targetX = Math.sin(t * 0.92 + phase) * 0.036;
    const targetZ = Math.cos(t * 1.03 + phase) * 0.042;

    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, targetX, 4.0, delta);
    ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, targetZ, 4.0, delta);
  });

  return (
    <group ref={ref} position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.33, 0.37, 0.105, 64]} />
        <meshPhysicalMaterial
          color="#d7dde1"
          metalness={0.08}
          roughness={0.23}
          clearcoat={0.95}
          clearcoatRoughness={0.06}
        />
      </mesh>

      <mesh position={[0, 0.105, 0]} castShadow>
        <cylinderGeometry args={[0.235, 0.2, 0.22, 64]} />
        <meshPhysicalMaterial
          color="#4a535c"
          metalness={0.74}
          roughness={0.2}
          clearcoat={0.72}
          clearcoatRoughness={0.08}
        />
      </mesh>

      <mesh position={[0, 0.23, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.235, 0.22, 64]} />
        <meshPhysicalMaterial
          color="#edf1f3"
          metalness={0.1}
          roughness={0.19}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>

      <mesh position={[0, 0.35, 0]}>
        <torusGeometry args={[0.245, 0.026, 10, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.98} />
      </mesh>

      <mesh position={[0, 0.405, 0]}>
        <torusGeometry args={[0.21, 0.011, 8, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function Trigger({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <RoundedBox
      args={[0.78, 0.17, 0.28]}
      radius={0.09}
      smoothness={8}
      position={position}
      rotation={rotation}
      castShadow
    >
      <meshPhysicalMaterial
        color="#f0f3f4"
        metalness={0.06}
        roughness={0.2}
        clearcoat={0.95}
        clearcoatRoughness={0.07}
      />
    </RoundedBox>
  );
}

function GripPanels() {
  return (
    <>
      <RoundedBox
        args={[1.04, 0.16, 0.68]}
        radius={0.22}
        smoothness={9}
        position={[-2.1, 0.37, 0.24]}
        rotation={[0.06, -0.1, -0.08]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#273038"
          metalness={0.05}
          roughness={0.58}
          clearcoat={0.18}
        />
      </RoundedBox>

      <RoundedBox
        args={[1.04, 0.16, 0.68]}
        radius={0.22}
        smoothness={9}
        position={[2.1, 0.37, 0.24]}
        rotation={[0.06, 0.1, 0.08]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#273038"
          metalness={0.05}
          roughness={0.58}
          clearcoat={0.18}
        />
      </RoundedBox>
    </>
  );
}

function CenterBadge() {
  const texture = useMemo(() => createLabelTexture("APEX 5", "#53dcff"), []);

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <group position={[0, 0.615, 0.08]}>
      <RoundedBox args={[1.68, 0.08, 0.67]} radius={0.16} smoothness={8}>
        <meshPhysicalMaterial
          color="#d4dadd"
          metalness={0.08}
          roughness={0.25}
          clearcoat={0.94}
          clearcoatRoughness={0.06}
        />
      </RoundedBox>

      <RoundedBox
        args={[1.26, 0.025, 0.36]}
        radius={0.09}
        smoothness={7}
        position={[0, 0.055, -0.02]}
      >
        <meshPhysicalMaterial
          color="#97a2a9"
          metalness={0.16}
          roughness={0.3}
          clearcoat={0.68}
        />
      </RoundedBox>

      {texture ? (
        <mesh position={[0, 0.078, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.25]} />
          <meshBasicMaterial map={texture} transparent opacity={0.98} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function LightBand() {
  const leftCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.83, 0.1, -1.66),
        new THREE.Vector3(-2.52, 0.07, -1.76),
        new THREE.Vector3(-1.8, 0.045, -1.8),
        new THREE.Vector3(-1.02, 0.055, -1.77),
      ]),
    [],
  );

  const rightCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.02, 0.055, -1.77),
        new THREE.Vector3(1.8, 0.045, -1.8),
        new THREE.Vector3(2.52, 0.07, -1.76),
        new THREE.Vector3(2.83, 0.1, -1.66),
      ]),
    [],
  );

  const leftGeometry = useMemo(() => new THREE.TubeGeometry(leftCurve, 120, 0.029, 10, false), [leftCurve]);
  const rightGeometry = useMemo(() => new THREE.TubeGeometry(rightCurve, 120, 0.029, 10, false), [rightCurve]);

  useEffect(() => {
    return () => {
      leftGeometry.dispose();
      rightGeometry.dispose();
    };
  }, [leftGeometry, rightGeometry]);

  return (
    <>
      <mesh geometry={leftGeometry}>
        <meshBasicMaterial color="#2f8fff" transparent opacity={0.95} />
      </mesh>
      <mesh geometry={rightGeometry}>
        <meshBasicMaterial color="#29eaff" transparent opacity={0.98} />
      </mesh>
      <mesh position={[0, 0.105, -1.77]}>
        <boxGeometry args={[0.72, 0.035, 0.04]} />
        <meshBasicMaterial color="#8cf4ff" transparent opacity={0.68} />
      </mesh>
    </>
  );
}

function MicroSeams() {
  return (
    <>
      {[
        [-0.9, 0.56, 0.47],
        [0.9, 0.56, 0.47],
      ].map((position, index) => (
        <mesh key={index} position={position}>
          <torusGeometry args={[0.34, 0.006, 7, 64]} />
          <meshBasicMaterial color="#6e7981" transparent opacity={0.5} />
        </mesh>
      ))}

      {[-0.62, -0.2, 0.2, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.575, -1.12]}>
          <boxGeometry args={[0.22, 0.02, 0.038]} />
          <meshStandardMaterial color="#747f87" metalness={0.32} roughness={0.36} />
        </mesh>
      ))}
    </>
  );
}

function FlydigiApex5Model() {
  const root = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const target = useRef(new THREE.Vector2(0.35, 0.1));
  const smoothed = useRef(new THREE.Vector2(0.35, 0.1));
  const body = useMemo(createApex5Body, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      target.current.set(
        THREE.MathUtils.clamp((event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(-((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1), -1, 1),
      );
    };

    const onPointerLeave = () => {
      target.current.set(0.2, 0.05);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onPointerLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onPointerLeave);
      body.dispose();
    };
  }, [body]);

  useFrame((state, delta) => {
    if (!root.current) return;

    smoothed.current.x = THREE.MathUtils.damp(smoothed.current.x, target.current.x, 6.8, delta);
    smoothed.current.y = THREE.MathUtils.damp(smoothed.current.y, target.current.y, 6.8, delta);

    const x = smoothed.current.x;
    const y = smoothed.current.y;
    const t = state.clock.elapsedTime;

    const scale = THREE.MathUtils.clamp(viewport.width / 8.8, 0.56, 1.06);
    const targetX = x * 1.9;
    const targetY = y * 1.13 + Math.sin(t * 0.58) * 0.055;

    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, targetX, 7.2, delta);
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, targetY, 7.2, delta);
    root.current.position.z = THREE.MathUtils.damp(
      root.current.position.z,
      0.18 + Math.abs(x) * 0.08 + (1 - Math.abs(y)) * 0.035,
      5.4,
      delta,
    );

    root.current.rotation.y = THREE.MathUtils.damp(
      root.current.rotation.y,
      x * 0.58 + Math.sin(t * 0.28) * 0.018,
      6.2,
      delta,
    );
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x,
      -0.16 - y * 0.34,
      6.2,
      delta,
    );
    root.current.rotation.z = THREE.MathUtils.damp(
      root.current.rotation.z,
      -x * 0.2 + Math.sin(t * 0.38) * 0.014,
      5.5,
      delta,
    );

    const breathing = 1 + Math.sin(t * 0.95) * 0.008;
    const finalScale = scale * breathing;
    root.current.scale.x = THREE.MathUtils.damp(root.current.scale.x, finalScale, 5.2, delta);
    root.current.scale.y = THREE.MathUtils.damp(root.current.scale.y, finalScale, 5.2, delta);
    root.current.scale.z = THREE.MathUtils.damp(root.current.scale.z, finalScale, 5.2, delta);
  });

  return (
    <group ref={root} position={[0.95, 0.04, 0.18]} rotation={[-0.16, 0.16, -0.035]}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#f0f2f3"
          metalness={0.08}
          roughness={0.2}
          clearcoat={0.98}
          clearcoatRoughness={0.055}
          reflectivity={0.96}
        />
      </mesh>

      <mesh geometry={body} scale={0.987} position={[0, 0.017, 0.012]} receiveShadow>
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.025}
          roughness={0.28}
          clearcoat={0.72}
          clearcoatRoughness={0.1}
          transparent
          opacity={0.44}
        />
      </mesh>

      <RoundedBox args={[3.64, 0.14, 1.46]} radius={0.34} smoothness={11} position={[0, 0.43, 0.11]} castShadow>
        <meshPhysicalMaterial
          color="#dfe3e5"
          metalness={0.06}
          roughness={0.24}
          clearcoat={0.94}
          clearcoatRoughness={0.065}
        />
      </RoundedBox>

      <RoundedBox args={[2.9, 0.09, 0.96]} radius={0.21} smoothness={10} position={[0, 0.52, 0.19]} castShadow>
        <meshPhysicalMaterial
          color="#f7f8f8"
          metalness={0.035}
          roughness={0.19}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </RoundedBox>

      <RoundedBox args={[1.18, 0.055, 0.44]} radius={0.12} smoothness={9} position={[0, 0.565, -0.07]}>
        <meshPhysicalMaterial
          color="#b8c0c6"
          metalness={0.13}
          roughness={0.23}
          clearcoat={0.72}
        />
      </RoundedBox>

      <CenterBadge />
      <GripPanels />
      <DPad />

      <group position={[1.98, 0.56, 0.05]}>
        <FaceButton position={[0, 0.4, 0]} label="Y" accent="#e4eefc" />
        <FaceButton position={[-0.39, 0, 0]} label="X" accent="#66dfff" />
        <FaceButton position={[0.39, 0, 0]} label="B" accent="#ff6d91" />
        <FaceButton position={[0, -0.4, 0]} label="A" accent="#7ff9c4" />
      </group>

      <Stick position={[-1.04, 0.6, 0.26]} accent="#318dff" phase={0.4} />
      <Stick position={[0.88, 0.6, 0.28]} accent="#2fe8ff" phase={1.2} />

      <group position={[-0.38, 0.585, 0.74]}>
        <RoundedBox args={[0.42, 0.08, 0.24]} radius={0.075} smoothness={7}>
          <meshPhysicalMaterial color="#e8ecee" metalness={0.06} roughness={0.22} clearcoat={0.86} />
        </RoundedBox>
        <RoundedBox args={[0.42, 0.08, 0.24]} radius={0.075} smoothness={7} position={[0.76, 0, 0]}>
          <meshPhysicalMaterial color="#e8ecee" metalness={0.06} roughness={0.22} clearcoat={0.86} />
        </RoundedBox>
      </group>

      <Trigger position={[-1.68, 0.52, -0.95]} rotation={[0.04, -0.08, -0.08]} />
      <Trigger position={[1.68, 0.52, -0.95]} rotation={[0.04, 0.08, 0.08]} />

      <LightBand />
      <MicroSeams />

      <mesh position={[0, 0.07, -1.79]}>
        <boxGeometry args={[0.74, 0.035, 0.04]} />
        <meshBasicMaterial color="#8bf4ff" transparent opacity={0.68} />
      </mesh>
    </group>
  );
}

function StudioEnvironment() {
  const { scene } = useThree();

  useEffect(() => {
    const size = 96;
    const faces = Array.from({ length: 6 }, (_, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");
      if (!context) return canvas;

      const gradient = context.createRadialGradient(
        48 + (index % 3) * 10,
        34 + Math.floor(index / 3) * 8,
        6,
        48,
        48,
        72,
      );
      gradient.addColorStop(0, "#f9fcff");
      gradient.addColorStop(0.22, "#cdd7dd");
      gradient.addColorStop(0.54, "#53616b");
      gradient.addColorStop(1, "#071019");

      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      const bars = index === 0 || index === 2 ? 4 : 2;
      for (let i = 0; i < bars; i += 1) {
        context.fillStyle = i % 2 === 0 ? "rgba(255,255,255,.82)" : "rgba(47,224,255,.4)";
        context.fillRect(10, 12 + i * 18, 76, 3);
      }

      return canvas;
    });

    const cube = new THREE.CubeTexture(faces);
    cube.colorSpace = THREE.SRGBColorSpace;
    cube.needsUpdate = true;

    scene.environment = cube;
    scene.environmentIntensity = 0.86;

    return () => {
      if (scene.environment === cube) scene.environment = null;
      cube.dispose();
    };
  }, [scene]);

  return null;
}

function HeroGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[14, 9]} />
        <meshPhysicalMaterial
          color="#02070c"
          metalness={0.58}
          roughness={0.38}
          clearcoat={0.24}
          clearcoatRoughness={0.2}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.48, -0.35]}>
        <ringGeometry args={[2.7, 2.74, 180]} />
        <meshBasicMaterial color="#31e7ff" transparent opacity={0.24} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.46, -0.45]}>
        <ringGeometry args={[3.5, 3.505, 180]} />
        <meshBasicMaterial color="#795eff" transparent opacity={0.13} />
      </mesh>
    </>
  );
}

function Apex5Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0.05, 0.14, 8.45]} fov={31} />

      <StudioEnvironment />
      <HeroGround />

      <ambientLight intensity={0.26} />
      <hemisphereLight args={["#ffffff", "#041019", 0.7]} />

      <directionalLight
        castShadow
        position={[5.5, 8.5, 5.2]}
        intensity={4.4}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />

      <directionalLight position={[-5, 3, 4]} intensity={2.2} color="#6fdfff" />
      <pointLight position={[0, 2.4, 3.4]} intensity={3.8} distance={8} color="#ffffff" />
      <pointLight position={[-3.1, 0.1, 2.3]} intensity={2.8} distance={7} color="#30dcff" />
      <pointLight position={[3.4, -0.6, 2]} intensity={2.15} distance={7} color="#7c5fff" />

      <Float speed={0.38} floatIntensity={0.08} rotationIntensity={0.012}>
        <FlydigiApex5Model />
      </Float>

      <AccumulativeShadows
        temporal
        frames={40}
        color="#000000"
        opacity={0.52}
        scale={7.2}
        position={[0.8, -1.49, 0]}
      >
        <RandomizedLight amount={4} radius={5.2} ambient={0.62} intensity={3.1} position={[3, 7, 4]} />
      </AccumulativeShadows>

      <ContactShadows
        position={[0.7, -1.49, 0.1]}
        scale={6.3}
        opacity={0.46}
        blur={2.4}
        far={5.2}
        resolution={1024}
      />
    </>
  );
}

export function Apex5ControllerScene() {
  return (
    <div className="apex5-controller-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.7]}
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
        }}
      >
        <Apex5Scene />
      </Canvas>
    </div>
  );
}
