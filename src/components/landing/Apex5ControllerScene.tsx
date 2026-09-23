import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function createApex5Body() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.15, 1.12);
  shape.bezierCurveTo(-2.85, 1.56, -2.12, 1.76, -1.3, 1.62);
  shape.bezierCurveTo(-0.54, 1.5, 0.54, 1.5, 1.3, 1.62);
  shape.bezierCurveTo(2.12, 1.76, 2.85, 1.56, 3.15, 1.12);
  shape.bezierCurveTo(3.4, 0.7, 3.35, 0.14, 3.12, -0.34);
  shape.bezierCurveTo(2.92, -0.78, 2.62, -1.5, 2.22, -1.8);
  shape.bezierCurveTo(1.88, -2.06, 1.54, -1.96, 1.22, -1.54);
  shape.bezierCurveTo(0.92, -1.15, 0.7, -0.8, 0.35, -0.62);
  shape.bezierCurveTo(0.08, -0.48, -0.08, -0.48, -0.35, -0.62);
  shape.bezierCurveTo(-0.7, -0.8, -0.92, -1.15, -1.22, -1.54);
  shape.bezierCurveTo(-1.54, -1.96, -1.88, -2.06, -2.22, -1.8);
  shape.bezierCurveTo(-2.62, -1.5, -2.92, -0.78, -3.12, -0.34);
  shape.bezierCurveTo(-3.35, 0.14, -3.4, 0.7, -3.15, 1.12);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.72,
    steps: 3,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.11,
    bevelSegments: 7,
  });

  geometry.center();
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function GlowStrip({ side }: { side: "left" | "right" }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        side === "left"
          ? [
              new THREE.Vector3(-2.72, 0.08, -1.63),
              new THREE.Vector3(-2.35, 0.06, -1.75),
              new THREE.Vector3(-1.75, 0.05, -1.78),
              new THREE.Vector3(-1.05, 0.06, -1.76),
            ]
          : [
              new THREE.Vector3(1.05, 0.06, -1.76),
              new THREE.Vector3(1.75, 0.05, -1.78),
              new THREE.Vector3(2.35, 0.06, -1.75),
              new THREE.Vector3(2.72, 0.08, -1.63),
            ],
      ),
    [side],
  );
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 96, 0.026, 8, false), [curve]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={side === "left" ? "#2c8cff" : "#2eeaff"} transparent opacity={0.96} />
    </mesh>
  );
}

function Stick({ position, accent }: { position: [number, number, number]; accent: string }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = Math.sin(t * 1.05 + position[0]) * 0.035;
    ref.current.rotation.z = Math.cos(t * 0.92 + position[0]) * 0.045;
  });

  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.31, 0.36, 0.1, 48]} />
        <meshPhysicalMaterial color="#d8dde1" metalness={0.1} roughness={0.26} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.19, 48]} />
        <meshPhysicalMaterial color="#4b555f" metalness={0.72} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.22, 0.2, 48]} />
        <meshPhysicalMaterial color="#eef2f4" metalness={0.14} roughness={0.22} clearcoat={0.82} />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <torusGeometry args={[0.24, 0.022, 10, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.98} />
      </mesh>
      <mesh position={[0, 0.365, 0]}>
        <torusGeometry args={[0.205, 0.011, 8, 56]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.84} />
      </mesh>
    </group>
  );
}

function FaceButton({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.295, 0.315, 0.105, 48]} />
        <meshPhysicalMaterial color="#b9c1c7" metalness={0.22} roughness={0.26} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.23, 0.09, 48]} />
        <meshPhysicalMaterial color="#f2f4f5" metalness={0.08} roughness={0.2} clearcoat={0.92} />
      </mesh>
      <mesh position={[0, 0.108, 0]}>
        <torusGeometry args={[0.215, 0.011, 8, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Apex5BodyModel() {
  const root = useRef<THREE.Group>(null);
  const { pointer, viewport } = useThree();
  const body = useMemo(createApex5Body, []);
  const ghostBody = useMemo(createApex5Body, []);

  useEffect(() => () => {
    body.dispose();
    ghostBody.dispose();
  }, [body, ghostBody]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    const scale = THREE.MathUtils.clamp(viewport.width / 9.1, 0.58, 1.03);
    const follow = 3.8;

    const tx = pointer.x * 1.6;
    const ty = -pointer.y * 0.98 + Math.sin(t * 0.62) * 0.055;

    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, tx, follow, delta);
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, ty, follow, delta);
    root.current.position.z = THREE.MathUtils.damp(root.current.position.z, Math.sin(t * 0.7) * 0.05, 3.0, delta);

    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, pointer.x * 0.32, 3.3, delta);
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x,
      -0.18 - pointer.y * 0.22,
      3.1,
      delta,
    );
    root.current.rotation.z = THREE.MathUtils.damp(
      root.current.rotation.z,
      pointer.x * -0.13 + Math.sin(t * 0.38) * 0.015,
      2.8,
      delta,
    );

    root.current.scale.x = THREE.MathUtils.damp(root.current.scale.x, scale, 3.0, delta);
    root.current.scale.y = THREE.MathUtils.damp(root.current.scale.y, scale, 3.0, delta);
    root.current.scale.z = THREE.MathUtils.damp(root.current.scale.z, scale, 3.0, delta);
  });

  return (
    <group ref={root} position={[1.0, 0.04, 0]} rotation={[-0.18, 0.16, -0.04]}>
      <mesh geometry={ghostBody} scale={1.018} position={[0, 0, -0.33]}>
        <meshBasicMaterial color="#50eaff" wireframe transparent opacity={0.11} />
      </mesh>

      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#eef1f2"
          metalness={0.065}
          roughness={0.22}
          clearcoat={0.96}
          clearcoatRoughness={0.07}
          reflectivity={0.82}
        />
      </mesh>

      <RoundedBox args={[3.58, 0.13, 1.45]} radius={0.31} smoothness={10} position={[0, 0.42, 0.12]}>
        <meshPhysicalMaterial color="#d9dfe2" metalness={0.075} roughness={0.28} clearcoat={0.88} />
      </RoundedBox>

      <RoundedBox args={[2.93, 0.08, 0.96]} radius={0.2} smoothness={9} position={[0, 0.5, 0.18]}>
        <meshPhysicalMaterial color="#f5f6f7" metalness={0.04} roughness={0.23} clearcoat={0.9} />
      </RoundedBox>

      <RoundedBox args={[1.18, 0.06, 0.48]} radius={0.13} smoothness={8} position={[0, 0.54, -0.04]}>
        <meshPhysicalMaterial color="#aeb7be" metalness={0.16} roughness={0.24} clearcoat={0.76} />
      </RoundedBox>

      <RoundedBox args={[1.46, 0.055, 0.58]} radius={0.12} smoothness={7} position={[0, 0.585, 0.05]}>
        <meshPhysicalMaterial color="#cbd2d6" metalness={0.12} roughness={0.28} clearcoat={0.8} />
      </RoundedBox>

      <mesh position={[0, 0.62, -0.04]}>
        <planeGeometry args={[0.82, 0.12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>

      <group position={[-1.95, 0.51, 0.01]}>
        <RoundedBox args={[0.36, 0.12, 0.98]} radius={0.08} smoothness={6}>
          <meshPhysicalMaterial color="#e6eaec" roughness={0.23} clearcoat={0.88} />
        </RoundedBox>
        <RoundedBox args={[0.98, 0.12, 0.36]} radius={0.08} smoothness={6}>
          <meshPhysicalMaterial color="#e6eaec" roughness={0.23} clearcoat={0.88} />
        </RoundedBox>
      </group>

      <group position={[1.95, 0.54, 0.05]}>
        <FaceButton position={[0, 0.39, 0]} accent="#dceeff" />
        <FaceButton position={[-0.38, 0, 0]} accent="#69dcff" />
        <FaceButton position={[0.38, 0, 0]} accent="#ff7699" />
        <FaceButton position={[0, -0.39, 0]} accent="#7fffc5" />
      </group>

      <Stick position={[-1.04, 0.58, 0.26]} accent="#308fff" />
      <Stick position={[0.88, 0.58, 0.27]} accent="#2fe8ff" />

      <group position={[0, 0.56, 0.72]}>
        <RoundedBox args={[0.38, 0.08, 0.2]} radius={0.07} smoothness={6}>
          <meshPhysicalMaterial color="#e7ebed" roughness={0.22} clearcoat={0.82} />
        </RoundedBox>
        <RoundedBox args={[0.38, 0.08, 0.2]} radius={0.07} smoothness={6} position={[0.78, 0, 0]}>
          <meshPhysicalMaterial color="#e7ebed" roughness={0.22} clearcoat={0.82} />
        </RoundedBox>
      </group>

      <group position={[0, 0.48, -0.92]}>
        <RoundedBox args={[0.9, 0.1, 0.25]} radius={0.08} smoothness={6} position={[-1.6, 0, 0]}>
          <meshPhysicalMaterial color="#f0f2f4" roughness={0.22} clearcoat={0.82} />
        </RoundedBox>
        <RoundedBox args={[0.9, 0.1, 0.25]} radius={0.08} smoothness={6} position={[1.6, 0, 0]}>
          <meshPhysicalMaterial color="#f0f2f4" roughness={0.22} clearcoat={0.82} />
        </RoundedBox>
      </group>

      <GlowStrip side="left" />
      <GlowStrip side="right" />

      <mesh position={[0, 0.09, -1.74]}>
        <boxGeometry args={[0.72, 0.035, 0.035]} />
        <meshBasicMaterial color="#7befff" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function Apex5PointerScene() {
  const cursorAura = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    if (!cursorAura.current) return;
    const t = state.clock.elapsedTime;
    cursorAura.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08 + Math.abs(pointer.x) * 0.03);
  });

  return (
    <mesh ref={cursorAura} position={[0, 0, -0.55]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.65, 2.68, 128]} />
      <meshBasicMaterial color="#32e8ff" transparent opacity={0.17} />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.05, 8.7]} fov={32} />
      <ambientLight intensity={0.78} />
      <hemisphereLight args={["#ffffff", "#061019", 0.78]} />
      <directionalLight castShadow position={[4.8, 7.8, 5.2]} intensity={3.2} color="#ffffff" />
      <directionalLight position={[-5, 2.4, 4.0]} intensity={1.55} color="#75dcff" />
      <pointLight position={[0, 1.3, 3.2]} intensity={3.4} distance={8} color="#ffffff" />
      <pointLight position={[-2.2, 0.4, 2]} intensity={2.4} distance={7} color="#3de5ff" />
      <pointLight position={[2.4, -0.4, 1.8]} intensity={1.7} distance={7} color="#7a5dff" />

      <Apex5PointerScene />
      <Apex5BodyModel />
      <ContactShadows position={[0.7, -1.48, 0]} scale={6.4} opacity={0.3} blur={2.7} far={5.3} resolution={512} />
    </>
  );
}

export function Apex5ControllerScene() {
  return (
    <div className="apex5-controller-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.6]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
