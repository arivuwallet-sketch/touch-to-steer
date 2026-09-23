import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  PerspectiveCamera,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
const analogFragmentShader = \`
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uVelocity;
  varying vec2 vUv;

  float random(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float speed = clamp(uVelocity, 0.0, 1.5);
    float jitter = (random(vec2(floor(uTime * 60.0))) - 0.5) * (0.001 + speed * 0.003);
    uv.x += jitter;

    float line = floor(uv.y * uResolution.y);
    float roll = step(0.988, random(vec2(floor(uTime * 3.0) + line * 0.002)));
    uv.y += sin(uTime * 16.0 + line * 0.06) * 0.004 * roll * (0.25 + speed);

    vec2 chroma = vec2(0.0012 + speed * 0.0035, 0.0);
    vec4 center = texture2D(tDiffuse, uv);
    float r = texture2D(tDiffuse, uv + chroma).r;
    float b = texture2D(tDiffuse, uv - chroma).b;
    vec3 color = vec3(r, center.g, b);

    float scan = 0.965 + 0.035 * sin(uv.y * uResolution.y * 1.25);
    float vignette = smoothstep(1.18, 0.2, length((uv - 0.5) * vec2(1.18, 1.0)));
    float grain = (random(uv * uResolution.xy + uTime * 15.0) - 0.5) * 0.012;

    color *= scan;
    color += grain;
    color *= 0.9 + vignette * 0.1;

    gl_FragColor = vec4(color, center.a);
  }
\`;

const controllerPulseVertexShader = \`
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
\`;

const controllerPulseFragmentShader = \`
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.8);
    float wave = 0.5 + 0.5 * sin(vWorld.x * 9.0 + uTime * 3.0);
    vec3 cyan = vec3(0.12, 0.9, 1.0);
    vec3 violet = vec3(0.58, 0.2, 1.0);
    vec3 color = mix(cyan, violet, wave * 0.28);
    gl_FragColor = vec4(color, fresnel * 0.42);
  }
\`;

function makeControllerBody() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.15, 1.18);
  shape.bezierCurveTo(-2.85, 1.62, -2.05, 1.78, -1.2, 1.68);
  shape.bezierCurveTo(-0.5, 1.58, 0.5, 1.58, 1.2, 1.68);
  shape.bezierCurveTo(2.05, 1.78, 2.85, 1.62, 3.15, 1.18);
  shape.bezierCurveTo(3.38, 0.82, 3.36, 0.26, 3.18, -0.18);
  shape.bezierCurveTo(3.0, -0.62, 2.65, -1.35, 2.25, -1.74);
  shape.bezierCurveTo(1.93, -2.03, 1.5, -2.12, 1.16, -1.78);
  shape.bezierCurveTo(0.86, -1.48, 0.7, -1.07, 0.47, -0.8);
  shape.bezierCurveTo(0.1, -0.48, -0.1, -0.48, -0.47, -0.8);
  shape.bezierCurveTo(-0.7, -1.07, -0.86, -1.48, -1.16, -1.78);
  shape.bezierCurveTo(-1.5, -2.12, -1.93, -2.03, -2.25, -1.74);
  shape.bezierCurveTo(-2.65, -1.35, -3.0, -0.62, -3.18, -0.18);
  shape.bezierCurveTo(-3.36, 0.26, -3.38, 0.82, -3.15, 1.18);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.72,
    steps: 3,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.11,
    bevelSegments: 7,
  });
  geometry.center();
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function AccentTube({
  path,
  color,
  opacity = 0.9,
  radius = 0.018,
}: {
  path: THREE.Curve<THREE.Vector3>;
  color: string;
  opacity?: number;
  radius?: number;
}) {
  const geometry = useMemo(
    () => new THREE.TubeGeometry(path, 100, radius, 8, false),
    [path, radius],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function AnalogStick({
  position,
  accent,
  phase = 0,
}: {
  position: [number, number, number];
  accent: string;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    const sway = 0.025 + Math.sin(t * 0.9 + phase) * 0.008;
    root.current.rotation.x = Math.sin(t * 1.15 + phase) * sway;
    root.current.rotation.z = Math.cos(t * 0.94 + phase) * sway;
  });

  return (
    <group ref={root} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.31, 0.35, 0.1, 56]} />
        <meshPhysicalMaterial color="#d6dce1" metalness={0.12} roughness={0.3} clearcoat={0.7} clearcoatRoughness={0.12} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.18, 48]} />
        <meshPhysicalMaterial color="#555d66" metalness={0.74} roughness={0.24} clearcoat={0.55} />
      </mesh>
      <mesh position={[0, 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.22, 0.2, 48]} />
        <meshPhysicalMaterial color="#dfe4e7" metalness={0.16} roughness={0.25} clearcoat={0.78} />
      </mesh>
      <mesh position={[0, 0.296, 0]}>
        <torusGeometry args={[0.24, 0.024, 10, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.98} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <torusGeometry args={[0.205, 0.012, 8, 56]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function FaceButton({
  position,
  accent,
  size = 0.26,
}: {
  position: [number, number, number];
  accent: string;
  size?: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[size * 1.16, size * 1.2, 0.105, 48]} />
        <meshPhysicalMaterial color="#aeb8c1" metalness={0.28} roughness={0.28} clearcoat={0.78} />
      </mesh>
      <mesh position={[0, 0.058, 0]} castShadow>
        <cylinderGeometry args={[size, size * 0.94, 0.085, 48]} />
        <meshPhysicalMaterial color="#f0f3f4" metalness={0.1} roughness={0.22} clearcoat={0.92} />
      </mesh>
      <mesh position={[0, 0.104, 0]}>
        <torusGeometry args={[size * 0.86, 0.012, 8, 40]} />
        <meshBasicMaterial color={accent} transparent opacity={0.58} />
      </mesh>
    </group>
  );
}

function DPad() {
  return (
    <group position={[-1.92, 0.48, 0.02]}>
      <RoundedBox args={[0.34, 0.12, 0.94]} radius={0.08} smoothness={6} castShadow>
        <meshPhysicalMaterial color="#e4e8ea" metalness={0.08} roughness={0.24} clearcoat={0.84} />
      </RoundedBox>
      <RoundedBox args={[0.94, 0.12, 0.34]} radius={0.08} smoothness={6} castShadow>
        <meshPhysicalMaterial color="#e4e8ea" metalness={0.08} roughness={0.24} clearcoat={0.84} />
      </RoundedBox>
      <mesh position={[0, 0.073, 0]}>
        <ringGeometry args={[0.22, 0.29, 32]} />
        <meshBasicMaterial color="#aeb6bd" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function ShoulderCluster() {
  return (
    <group>
      {[
        [-2.05, 0.49, -0.82, 0.42],
        [-1.42, 0.5, -0.92, 0.38],
        [1.42, 0.5, -0.92, 0.38],
        [2.05, 0.49, -0.82, 0.42],
      ].map(([x, y, z, width], index) => (
        <RoundedBox
          key={index}
          args={[width, 0.14, 0.26]}
          radius={0.09}
          smoothness={7}
          position={[x, y, z]}
          rotation={[0, index < 2 ? -0.08 : 0.08, 0]}
          castShadow
        >
          <meshPhysicalMaterial color="#f2f4f5" metalness={0.08} roughness={0.22} clearcoat={0.82} />
        </RoundedBox>
      ))}
    </group>
  );
}

function APEXBadge() {
  return (
    <group position={[0, 0.56, 0.07]}>
      <RoundedBox args={[1.42, 0.09, 0.64]} radius={0.12} smoothness={7}>
        <meshPhysicalMaterial color="#d6dce0" metalness={0.08} roughness={0.3} clearcoat={0.68} />
      </RoundedBox>
      <RoundedBox args={[1.12, 0.035, 0.32]} radius={0.07} smoothness={6} position={[0, 0.06, -0.015]}>
        <meshStandardMaterial color="#8f99a1" metalness={0.28} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.086, -0.09]}>
        <planeGeometry args={[0.78, 0.11]} />
        <meshBasicMaterial color="#f8fbfd" transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

function ControllerLightBand() {
  const leftPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.7, 0.1, -1.62),
        new THREE.Vector3(-2.42, 0.08, -1.72),
        new THREE.Vector3(-1.75, 0.06, -1.76),
        new THREE.Vector3(-1.05, 0.06, -1.74),
      ]),
    [],
  );
  const rightPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.05, 0.06, -1.74),
        new THREE.Vector3(1.75, 0.06, -1.76),
        new THREE.Vector3(2.42, 0.08, -1.72),
        new THREE.Vector3(2.7, 0.1, -1.62),
      ]),
    [],
  );

  return (
    <>
      <AccentTube path={leftPath} color="#3fe8ff" radius={0.023} opacity={0.9} />
      <AccentTube path={rightPath} color="#49bfff" radius={0.023} opacity={0.9} />
      <mesh position={[0, 0.08, -1.73]}>
        <boxGeometry args={[0.7, 0.035, 0.035]} />
        <meshBasicMaterial color="#82f6ff" transparent opacity={0.62} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

function ControllerMicroDetails() {
  const vents = useMemo(() => {
    const result: Array<[number, number, number]> = [];
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        result.push([-0.72 + col * 0.205, 0.55, -1.1 - row * 0.06]);
      }
    }
    return result;
  }, []);

  return (
    <>
      {vents.map((position, index) => (
        <RoundedBox key={index} args={[0.11, 0.025, 0.025]} radius={0.01} smoothness={3} position={position}>
          <meshStandardMaterial color="#7b8790" metalness={0.38} roughness={0.36} />
        </RoundedBox>
      ))}
      {[
        [-2.58, 0.58, 0.46],
        [-1.58, 0.58, 0.44],
        [1.58, 0.58, 0.44],
        [2.58, 0.58, 0.46],
      ].map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.035, 18, 18]} />
          <meshBasicMaterial color="#87939d" transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

function Apex5Model() {
  const root = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const { pointer, viewport } = useThree();
  const body = useMemo(makeControllerBody, []);

  const pulseUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  );

  useEffect(() => () => body.dispose(), [body]);

  useFrame((state, delta) => {
    if (!root.current) return;

    const t = state.clock.elapsedTime;
    const safeScale = THREE.MathUtils.clamp(viewport.width / 9.2, 0.62, 1.08);
    const targetX = pointer.x * 1.28;
    const targetY = -pointer.y * 0.78 + Math.sin(t * 0.6) * 0.045;
    const targetZ = Math.sin(t * 0.8) * 0.08;

    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, targetX, 3.25, delta);
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, targetY, 3.15, delta);
    root.current.position.z = THREE.MathUtils.damp(root.current.position.z, targetZ, 2.9, delta);

    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, pointer.x * 0.34, 2.9, delta);
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x,
      -0.12 - pointer.y * 0.19,
      2.8,
      delta,
    );
    root.current.rotation.z = THREE.MathUtils.damp(
      root.current.rotation.z,
      pointer.x * -0.11 + Math.sin(t * 0.34) * 0.018,
      2.4,
      delta,
    );
    root.current.scale.x = THREE.MathUtils.damp(root.current.scale.x, safeScale, 2.6, delta);
    root.current.scale.y = THREE.MathUtils.damp(root.current.scale.y, safeScale, 2.6, delta);
    root.current.scale.z = THREE.MathUtils.damp(root.current.scale.z, safeScale, 2.6, delta);

    pulseUniforms.uTime.value = t;

    if (shellRef.current) {
      shellRef.current.rotation.z = Math.sin(t * 0.44) * 0.01;
    }
  });

  return (
    <group ref={root} position={[0.8, 0.08, 0]} rotation={[-0.12, 0.18, -0.04]}>
      <mesh ref={shellRef} geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#edf1f3"
          metalness={0.07}
          roughness={0.22}
          clearcoat={0.95}
          clearcoatRoughness={0.08}
          reflectivity={0.78}
        />
      </mesh>

      <mesh geometry={body} scale={0.986} position={[0, 0.01, 0]}>
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.025}
          roughness={0.33}
          clearcoat={0.72}
          clearcoatRoughness={0.12}
          transparent
          opacity={0.72}
        />
      </mesh>

      <RoundedBox args={[3.58, 0.12, 1.44]} radius={0.32} smoothness={10} position={[0, 0.42, 0.12]}>
        <meshPhysicalMaterial color="#dce1e4" metalness={0.07} roughness={0.3} clearcoat={0.84} clearcoatRoughness={0.1} />
      </RoundedBox>

      <RoundedBox args={[2.88, 0.075, 0.94]} radius={0.2} smoothness={9} position={[0, 0.49, 0.19]}>
        <meshPhysicalMaterial color="#f3f5f6" metalness={0.06} roughness={0.26} clearcoat={0.9} />
      </RoundedBox>

      <RoundedBox args={[1.05, 0.055, 0.42]} radius={0.12} smoothness={7} position={[0, 0.535, -0.06]}>
        <meshPhysicalMaterial color="#b9c2c9" metalness={0.16} roughness={0.24} clearcoat={0.75} />
      </RoundedBox>

      <APEXBadge />
      <DPad />

      <group position={[1.98, 0.54, 0.05]}>
        <FaceButton position={[0, 0.38, 0]} accent="#d8eaff" size={0.245} />
        <FaceButton position={[-0.36, 0, 0]} accent="#6deaff" size={0.245} />
        <FaceButton position={[0.36, 0, 0]} accent="#ff7da0" size={0.245} />
        <FaceButton position={[0, -0.38, 0]} accent="#86ffce" size={0.245} />
      </group>

      <AnalogStick position={[-1.05, 0.59, 0.25]} accent="#2f97ff" phase={0.4} />
      <AnalogStick position={[0.88, 0.59, 0.26]} accent="#34e7ff" phase={1.1} />

      <group position={[0, 0.55, 0.7]}>
        <FaceButton position={[-0.46, 0, 0]} accent="#dce7ff" size={0.13} />
        <FaceButton position={[0.46, 0, 0]} accent="#dce7ff" size={0.13} />
      </group>

      <ShoulderCluster />
      <ControllerLightBand />
      <ControllerMicroDetails />

      <mesh position={[0, 0.63, -0.22]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.36, 2.44, 120]} />
        <shaderMaterial
          uniforms={pulseUniforms}
          vertexShader={controllerPulseVertexShader}
          fragmentShader={controllerPulseFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function ControllerGhostEcho() {
  const group = useRef<THREE.Group>(null);
  const body = useMemo(makeControllerBody, []);
  const { pointer } = useThree();

  useEffect(() => () => body.dispose(), [body]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.26, 1.8, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.11, 1.8, delta);
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, pointer.x * 1.02, 1.75, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, -pointer.y * 0.63, 1.75, delta);
    group.current.position.z = Math.sin(t * 0.7) * 0.03;
  });

  return (
    <group ref={group} position={[0.8, 0, -0.72]} scale={1.03} rotation={[-0.1, 0.1, 0]}>
      <mesh geometry={body} scale={1.01}>
        <meshBasicMaterial color="#62eaff" transparent opacity={0.08} blending={THREE.AdditiveBlending} wireframe />
      </mesh>
    </group>
  );
}

function ControllerSceneFX() {
  return null;
}

function BackgroundWorld() {
  const world = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!world.current) return;
    const t = state.clock.elapsedTime;
    world.current.rotation.y = THREE.MathUtils.damp(world.current.rotation.y, state.pointer.x * 0.035, 0.8, delta);
    world.current.rotation.x = THREE.MathUtils.damp(world.current.rotation.x, -state.pointer.y * 0.018, 0.8, delta);
    world.current.position.y = Math.sin(t * 0.18) * 0.04;
  });

  return (
    <group ref={world}>
      <mesh position={[0, 1.25, -4.1]} scale={[2.65, 2.65, 2.65]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#07121f"
          emissive="#0e2a46"
          emissiveIntensity={0.6}
          metalness={0.16}
          roughness={0.58}
        />
      </mesh>

      <Float speed={0.34} floatIntensity={0.16} rotationIntensity={0.04}>
        <mesh position={[0, 1.25, -3.87]} rotation={[0.18, 0.2, -0.25]}>
          <torusGeometry args={[2.86, 0.018, 10, 160]} />
          <meshBasicMaterial color="#54e9ff" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, 1.25, -3.9]} rotation={[0.18, -0.12, -0.25]}>
          <torusGeometry args={[3.12, 0.008, 8, 160]} />
          <meshBasicMaterial color="#8c63ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </mesh>
      </Float>

      {[
        [-4.5, -1.2, -2.0],
        [-3.2, -1.45, -2.8],
        [3.8, -1.25, -2.4],
        [4.8, -0.9, -3.6],
        [-0.8, -1.55, -2.9],
        [1.8, -1.45, -2.7],
      ].map(([x, y, z], index) => (
        <mesh key={index} position={[x, y, z]} rotation={[0.1 * index, 0.14 * index, -0.08 * index]}>
          <icosahedronGeometry args={[0.38 + (index % 3) * 0.12, 2]} />
          <meshStandardMaterial color="#08111a" emissive="#061d2a" emissiveIntensity={0.42} roughness={0.84} metalness={0.22} />
        </mesh>
      ))}

      <mesh position={[0, -1.52, -2.65]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 7, 64, 32]} />
        <meshStandardMaterial color="#03080d" emissive="#041622" emissiveIntensity={0.32} metalness={0.18} roughness={0.96} />
      </mesh>

      <mesh position={[0, -1.47, -2.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 2.56, 128]} />
        <meshBasicMaterial color="#2fe7ff" transparent opacity={0.26} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh position={[0, -1.44, -2.42]} rotation={[-Math.PI / 2, 0, Math.PI / 8]}>
        <ringGeometry args={[3.2, 3.205, 128]} />
        <meshBasicMaterial color="#7f66ff" transparent opacity={0.17} blending={THREE.AdditiveBlending} />
      </mesh>

      <Sparkles count={170} scale={[10, 5.8, 9]} size={2.5} speed={0.18} color="#66e9ff" />
      <Sparkles count={55} scale={[8, 4.6, 7]} size={4} speed={0.08} color="#b9a8ff" />
    </group>
  );
}

function BackgroundSignalFX() {
  return null;
}

export function LandingScene() {
  return (
    <div className="landing-3d-canvas landing-3d-canvas-spectral" aria-hidden="true">
      <div className="landing-scanline-overlay" />
      <Canvas
        dpr={[1, 1.6]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0.3, 8.8]} fov={35} />
        <ambientLight intensity={0.12} />
        <hemisphereLight args={["#7cecff", "#020509", 0.5]} />
        <directionalLight position={[4, 6, 5]} intensity={2.3} color="#d9f8ff" />
        <directionalLight position={[-4, 2, 2]} intensity={1.2} color="#3ee7ff" />
        <pointLight position={[0, -0.7, 2.8]} intensity={3.8} distance={9} color="#1ccfff" />
        <pointLight position={[2.5, 1.8, -1.6]} intensity={2.6} distance={7} color="#7156ff" />

        <BackgroundWorld />
        <BackgroundSignalFX />
      </Canvas>
    </div>
  );
}

export function Apex5ControllerScene() {
  return (
    <div className="apex5-controller-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.7]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.16,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0.05, 8.2]} fov={31} />
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#ffffff", "#071018", 0.72]} />
        <directionalLight position={[4.5, 7.2, 5.4]} intensity={3.8} color="#ffffff" castShadow />
        <directionalLight position={[-5, 3, 4]} intensity={1.65} color="#74dcff" />
        <pointLight position={[0, 1.5, 3.2]} intensity={2.8} distance={8} color="#ffffff" />
        <pointLight position={[-2.8, 0.2, 1.8]} intensity={2.4} distance={7} color="#3ce3ff" />
        <pointLight position={[2.7, -0.7, 1.8]} intensity={1.8} distance={7} color="#6f52ff" />

        <ControllerGhostEcho />
        <Apex5Model />
        <ContactShadows position={[0.6, -1.48, 0]} scale={6.1} opacity={0.3} blur={2.8} far={5.2} resolution={512} />
        <ControllerSceneFX />
      </Canvas>
    </div>
  );
}
