import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Float,
  PerspectiveCamera,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const spectralVertex = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;

    float wave = sin(world.y * 7.0 + world.x * 3.2) * 0.012;
    vec3 displaced = position + normal * wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const spectralFragment = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uTrail;
  uniform vec2 uPointer;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.5);

    float scan = 0.5 + 0.5 * sin(vWorldPosition.y * 34.0 - uTime * 8.0 + uTrail * 4.0);
    float glitch = step(0.82, fract(vWorldPosition.x * 6.0 + vWorldPosition.y * 11.0 - uTime * 0.8));
    float grain = hash(floor(vWorldPosition.xy * 12.0 + uTime * 8.0));

    vec3 cyan = vec3(0.09, 0.90, 1.00);
    vec3 violet = vec3(0.58, 0.28, 1.00);
    vec3 mint = vec3(0.32, 1.00, 0.75);

    float phase = 0.5 + 0.5 * sin(uTime * 1.4 + uTrail * 4.5);
    vec3 spectral = mix(cyan, violet, phase);
    spectral = mix(spectral, mint, glitch * 0.2);

    float pointerEnergy = smoothstep(0.0, 1.5, length(uPointer));
    float alpha = uOpacity * (0.10 + fresnel * 0.92);
    alpha *= 0.68 + scan * 0.32;
    alpha *= 0.76 + grain * 0.24;
    alpha *= 1.0 + pointerEnergy * 0.2;

    gl_FragColor = vec4(spectral, alpha);
  }
`;

function SpectralShell({
  position,
  rotation,
  scale,
  opacity,
  trail,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  opacity: number;
  trail: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uTrail: { value: trail },
      uPointer: { value: new THREE.Vector2() },
    }),
    [opacity, trail],
  );

  useFrame((state) => {
    const material = mesh.current?.material as THREE.ShaderMaterial | undefined;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPointer.value.lerp(new THREE.Vector2(pointer.x, pointer.y), 0.16);
    material.uniforms.uOpacity.value =
      opacity * (0.84 + Math.sin(state.clock.elapsedTime * 2.2 + trail) * 0.14);
  });

  return (
    <RoundedBox
      ref={mesh}
      args={[4.04, 0.78, 2.18]}
      radius={0.35}
      smoothness={8}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={spectralVertex}
        fragmentShader={spectralFragment}
        transparent
        depthWrite={false}
        depthTest
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </RoundedBox>
  );
}

function GhostRibbon() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.12;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.32) * 0.12;
  });

  return (
    <group ref={group} position={[0, -0.12, -0.55]}>
      {[2.08, 2.45, 2.82].map((radius, index) => (
        <mesh
          key={radius}
          rotation={[-Math.PI / 2, 0, index * 0.16]}
        >
          <torusGeometry args={[radius, index === 0 ? 0.018 : 0.008, 10, 160]} />
          <meshBasicMaterial
            color={index === 1 ? "#8b62ff" : "#3be9ff"}
            transparent
            opacity={0.16 - index * 0.035}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

function SpectralParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 900;
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 2.4 + Math.random() * 4.3;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 4.3;
      values[i * 3] = Math.cos(angle) * radius;
      values[i * 3 + 1] = y;
      values[i * 3 + 2] = Math.sin(angle) * radius - 1.4;
    }
    return values;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.025;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.025;
  });

  return (
    <points ref={ref} positions={positions}>
      <pointsMaterial
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.38}
        depthWrite={false}
        color="#71eaff"
      />
    </points>
  );
}

function ControllerBody({ group }: { group: THREE.Group }) {
  return (
    <>
      <RoundedBox
        args={[4.0, 0.76, 2.18]}
        radius={0.36}
        smoothness={10}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#0e141a"
          metalness={0.86}
          roughness={0.17}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1.8}
        />
      </RoundedBox>

      <RoundedBox
        args={[3.58, 0.17, 1.78]}
        radius={0.13}
        smoothness={8}
        position={[0, 0.42, 0.02]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#1b2530"
          metalness={0.6}
          roughness={0.23}
          clearcoat={0.72}
          clearcoatRoughness={0.1}
        />
      </RoundedBox>

      <RoundedBox
        args={[1.18, 0.20, 0.73]}
        radius={0.16}
        smoothness={8}
        position={[0, 0.53, 0.04]}
      >
        <meshPhysicalMaterial color="#05090d" metalness={0.75} roughness={0.12} clearcoat={1} />
      </RoundedBox>

      <mesh position={[0, 0.638, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.72, 0.25]} />
        <meshBasicMaterial
          color="#51ecff"
          transparent
          opacity={0.72}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh position={[0, 0.19, -1.0]}>
        <boxGeometry args={[2.52, 0.075, 0.055]} />
        <meshBasicMaterial
          color="#2ceaff"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <ControllerStick position={[-1.16, 0.50, 0.27]} />
      <ControllerStick position={[0.95, 0.50, 0.23]} offset={1.4} />

      <FaceCluster position={[1.40, 0.49, 0.23]} />
      <DpadCluster position={[-1.37, 0.50, 0.18]} />

      {[-1.45, -0.72, 0.72, 1.45].map((x) => (
        <RoundedBox
          key={x}
          args={[0.46, 0.10, 0.20]}
          radius={0.07}
          smoothness={5}
          position={[x, 0.50, -0.66]}
          castShadow
        >
          <meshStandardMaterial color="#293642" metalness={0.62} roughness={0.24} />
        </RoundedBox>
      ))}
    </>
  );
}

function ControllerStick({
  position,
  offset = 0,
}: {
  position: [number, number, number];
  offset?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = Math.sin(t * 1.15 + offset) * 0.035;
    ref.current.rotation.z = Math.cos(t * 0.92 + offset) * 0.04;
  });

  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.08, 36]} />
        <meshPhysicalMaterial color="#0b1117" metalness={0.8} roughness={0.2} clearcoat={0.55} />
      </mesh>
      <mesh position={[0, 0.095, 0]} castShadow>
        <sphereGeometry args={[0.16, 36, 22]} />
        <meshPhysicalMaterial color="#34414d" metalness={0.55} roughness={0.28} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.204, 0]}>
        <torusGeometry args={[0.162, 0.012, 8, 48]} />
        <meshBasicMaterial
          color="#42eaff"
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function FaceCluster({ position }: { position: [number, number, number] }) {
  const buttons = [
    { p: [0, 0.33, 0] as [number, number, number], c: "#f2d04b" },
    { p: [-0.30, 0, 0] as [number, number, number], c: "#5cbcff" },
    { p: [0.30, 0, 0] as [number, number, number], c: "#ff657b" },
    { p: [0, -0.33, 0] as [number, number, number], c: "#61e690" },
  ];

  return (
    <group position={position}>
      {buttons.map((button) => (
        <group key={button.p.join("-")} position={button.p}>
          <mesh castShadow>
            <cylinderGeometry args={[0.11, 0.145, 0.07, 32]} />
            <meshPhysicalMaterial color="#111820" metalness={0.68} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.052, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.106, 0.055, 32]} />
            <meshPhysicalMaterial
              color={button.c}
              emissive={button.c}
              emissiveIntensity={0.18}
              metalness={0.12}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0, 0.088, 0]}>
            <torusGeometry args={[0.09, 0.008, 8, 34]} />
            <meshBasicMaterial
              color={button.c}
              transparent
              opacity={0.72}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DpadCluster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[
        [0, 0.24, 0],
        [0, -0.24, 0],
        [-0.24, 0, 0],
        [0.24, 0, 0],
      ].map((p, index) => (
        <RoundedBox
          key={index}
          args={[0.19, 0.06, index < 2 ? 0.35 : 0.35]}
          radius={0.06}
          smoothness={4}
          position={p as [number, number, number]}
          castShadow
        >
          <meshStandardMaterial color="#2a3540" metalness={0.48} roughness={0.3} />
        </RoundedBox>
      ))}
      <mesh position={[0, 0.06, 0]}>
        <torusGeometry args={[0.22, 0.008, 8, 36]} />
        <meshBasicMaterial color="#62eaff" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function SpectralController() {
  const root = useRef<THREE.Group>(null);
  const { pointer, camera } = useThree();

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    const scroll = typeof window !== "undefined" ? window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight) : 0;
    const targetY = pointer.x * 0.33 + scroll * -0.30 + Math.sin(t * 0.3) * 0.03;
    const targetX = -pointer.y * 0.18 + Math.sin(t * 0.24) * 0.025;
    const targetZ = Math.sin(t * 0.42) * 0.028;

    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, targetY, 0.045);
    root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, targetX, 0.045);
    root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, targetZ, 0.045);
    root.current.position.y = Math.sin(t * 0.72) * 0.07 - scroll * 0.45;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.42, 0.025);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.55 - pointer.y * 0.20 - scroll * 0.32, 0.025);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 7.1 - scroll * 1.0, 0.025);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={root} position={[0, -0.24, 0]} rotation={[-0.06, 0.12, 0]}>
      <SpectralShell position={[-0.18, 0.02, -0.16]} rotation={[0.01, -0.13, -0.01]} scale={1.03} opacity={0.16} trail={0.6} />
      <SpectralShell position={[0.14, -0.01, -0.30]} rotation={[-0.01, 0.10, 0.01]} scale={1.055} opacity={0.105} trail={1.8} />
      <SpectralShell position={[-0.04, 0.00, -0.48]} rotation={[0.00, -0.05, 0]} scale={1.08} opacity={0.065} trail={3.1} />
      <ControllerBody group={root.current ?? new THREE.Group()} />
    </group>
  );
}

function PostProcessing() {
  const composerRef = useRef<EffectComposer | null>(null);
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    composer.setSize(size.width, size.height);

    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(size.width, size.height),
        0.62,
        0.72,
        0.18,
      ),
    );
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    return () => {
      composerRef.current = null;
      composer.dispose();
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}

export function LandingScene() {
  return (
    <div className="landing-3d-canvas" aria-hidden="true">
      <Canvas
        dpr={[1, 1.7]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
      >
        <AdaptiveDpr pixelated />
        <PerspectiveCamera makeDefault position={[0, 0.55, 7.1]} fov={35} />
        <ambientLight intensity={0.16} />
        <hemisphereLight args={["#85eaff", "#040812", 0.48]} />
        <directionalLight position={[4.5, 4.6, 5]} intensity={2.8} color="#effcff" castShadow />
        <directionalLight position={[-4.2, 1.4, 2]} intensity={1.4} color="#3fdcff" />
        <pointLight position={[0, -1.5, 3.8]} intensity={4.0} distance={10} color="#32dcff" />
        <pointLight position={[-2.5, 1.2, 1]} intensity={1.9} distance={6} color="#8a59ff" />

        <Environment preset="city" environmentIntensity={0.45} />

        <GhostRibbon />
        <SpectralParticles />
        <Sparkles count={90} scale={[10, 5.6, 8]} size={1.7} speed={0.18} color="#75ecff" />

        <SpectralController />

        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.42}
          scale={5.8}
          blur={2.8}
          far={5}
          resolution={512}
        />

        <PostProcessing />
      </Canvas>
    </div>
  );
}
