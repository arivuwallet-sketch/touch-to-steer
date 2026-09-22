import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, ContactShadows, Float, PerspectiveCamera, RoundedBox, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import * as THREE from "three";

function HoloRing({ radius, y, speed = 0.25, opacity = 0.28 }: { radius: number; y: number; speed?: number; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * speed;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.55 + y) * 0.08;
  });

  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[Math.PI / 2.6, 0, 0]}>
      <torusGeometry args={[radius, 0.008, 12, 96]} />
      <meshBasicMaterial color="#36e7ff" transparent opacity={opacity} />
    </mesh>
  );
}

function Button({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.11, 0.14, 0.065, 32]} />
        <meshStandardMaterial color="#1b222c" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.105, 0.055, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} metalness={0.2} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.071, 0]}>
        <torusGeometry args={[0.091, 0.008, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.101, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.01, 0.01]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.028, 16]} />
        <meshBasicMaterial color="#f8fbff" transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function Stick({ position, tilt = 0 }: { position: [number, number, number]; tilt?: number }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.x = Math.sin(t * 1.3 + tilt) * 0.08;
    group.current.rotation.z = Math.cos(t * 1.1 + tilt) * 0.08;
  });

  return (
    <group ref={group} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.08, 40]} />
        <meshStandardMaterial color="#101720" metalness={0.68} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.16, 40, 24]} />
        <meshStandardMaterial color="#313d49" metalness={0.58} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.205, 0]}>
        <torusGeometry args={[0.16, 0.012, 8, 40]} />
        <meshBasicMaterial color="#39e7ff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

const spectralVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spectralFragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uOffset;
  uniform vec2 uPointer;

  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vec3(0.0, 0.0, 1.0)))), 2.2);
    float scan = 0.5 + 0.5 * sin(vWorld.y * 32.0 - uTime * 7.0 + uOffset * 3.0);
    float signal = smoothstep(0.0, 1.0, scan);
    float jitter = hash(floor(vWorld.xy * 7.0 + uTime * 5.0 + uOffset * 11.0));
    float bands = step(0.72, fract(vWorld.y * 8.0 + uTime * 0.55 + uOffset));
    float pointerEnergy = length(uPointer) * 0.45;

    vec3 cyan = vec3(0.12, 0.92, 1.0);
    vec3 violet = vec3(0.53, 0.22, 1.0);
    vec3 green = vec3(0.32, 1.0, 0.76);
    vec3 color = mix(cyan, violet, 0.5 + 0.5 * sin(uTime * 1.7 + uOffset * 4.0));
    color = mix(color, green, bands * 0.24);
    color += vec3(pointerEnergy * 0.13);

    float alpha = uOpacity * (0.16 + fresnel * 0.8) * (0.72 + signal * 0.28);
    alpha *= mix(0.72, 1.2, jitter);
    alpha *= 0.92 + pointerEnergy * 0.18;

    gl_FragColor = vec4(color, alpha);
  }
`;

function SpectralGhostShell({
  position,
  rotation,
  opacity,
  scale,
  offset,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  opacity: number;
  scale: number;
  offset: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const { pointer } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uOffset: { value: offset },
      uPointer: { value: new THREE.Vector2() },
    }),
    [opacity, offset],
  );

  useFrame((state) => {
    const material = ref.current?.material as THREE.ShaderMaterial | undefined;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPointer.value.lerp(new THREE.Vector2(pointer.x, pointer.y), 0.12);
    material.uniforms.uOpacity.value = opacity * (0.84 + Math.sin(state.clock.elapsedTime * 2.1 + offset) * 0.12);
  });

  return (
    <RoundedBox
      ref={ref}
      args={[3.94, 0.76, 2.14]}
      radius={0.34}
      smoothness={8}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={spectralVertexShader}
        fragmentShader={spectralFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </RoundedBox>
  );
}

function SpectralTrail() {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.z += delta * (0.16 + Math.abs(pointer.x) * 0.05);
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.x * 0.26 + Math.sin(t * 0.45) * 0.05,
      0.035,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -pointer.y * 0.16,
      0.035,
    );
  });

  return (
    <group ref={group} position={[0, -0.24, -0.1]}>
      <SpectralGhostShell position={[-0.16, 0.03, -0.08]} rotation={[0.02, -0.16, -0.01]} opacity={0.16} scale={1.02} offset={0.2} />
      <SpectralGhostShell position={[0.1, -0.02, -0.18]} rotation={[-0.02, 0.12, 0.01]} opacity={0.12} scale={1.035} offset={1.3} />
      <SpectralGhostShell position={[-0.03, 0.01, -0.32]} rotation={[0.01, -0.06, 0]} opacity={0.075} scale={1.05} offset={2.7} />

      <mesh position={[0, 0.02, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.014, 8, 128]} />
        <meshBasicMaterial color="#31e8ff" transparent opacity={0.22} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.02, -0.56]} rotation={[-Math.PI / 2, 0, Math.PI / 8]}>
        <torusGeometry args={[2.55, 0.008, 8, 128]} />
        <meshBasicMaterial color="#8f5dff" transparent opacity={0.14} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function TouchToSteerPostFX() {
  const composerRef = useRef<EffectComposer | null>(null);
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    composer.setSize(size.width, size.height);

    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.72,
      0.68,
      0.22,
    );

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    return () => {
      composerRef.current = null;
      composer.dispose();
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size.height, size.width]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
}

function ControllerModel() {
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    if (!root.current || !shell.current) return;
    const t = state.clock.elapsedTime;
    const targetY = pointer.x * 0.28 + Math.sin(t * 0.28) * 0.035;
    const targetX = -pointer.y * 0.2 + Math.cos(t * 0.23) * 0.028;

    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, targetY, 0.055);
    root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, targetX, 0.055);
    root.current.position.y = Math.sin(t * 0.65) * 0.06;
    shell.current.rotation.z = Math.sin(t * 0.42) * 0.012;
  });

  return (
    <group ref={root} position={[0, -0.2, 0]} rotation={[-0.08, 0.18, 0.01]}>
      <group ref={shell}>
        <RoundedBox args={[3.9, 0.72, 2.1]} radius={0.33} smoothness={8} position={[0, 0, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#111922"
            metalness={0.8}
            roughness={0.2}
            clearcoat={0.8}
            clearcoatRoughness={0.13}
            envMapIntensity={1.35}
          />
        </RoundedBox>

        <RoundedBox args={[3.5, 0.18, 1.72]} radius={0.12} smoothness={6} position={[0, 0.39, 0]} castShadow>
          <meshPhysicalMaterial color="#1b2530" metalness={0.58} roughness={0.24} clearcoat={0.55} clearcoatRoughness={0.18} />
        </RoundedBox>

        <RoundedBox args={[1.08, 0.24, 0.68]} radius={0.16} smoothness={6} position={[0, 0.47, 0.03]}>
          <meshStandardMaterial color="#070b10" metalness={0.7} roughness={0.18} />
        </RoundedBox>

        <mesh position={[0, 0.6, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.62, 0.24]} />
          <meshBasicMaterial color="#0fdcf7" transparent opacity={0.65} />
        </mesh>

        <Stick position={[-1.18, 0.5, 0.25]} tilt={0.4} />
        <Stick position={[0.96, 0.5, 0.2]} tilt={1.3} />

        <group position={[1.4, 0.48, 0.22]}>
          <Button position={[0, 0.33, 0]} color="#f0c93d" />
          <Button position={[-0.3, 0, 0]} color="#61b7ff" />
          <Button position={[0.3, 0, 0]} color="#ff5e69" />
          <Button position={[0, -0.33, 0]} color="#63e68a" />
        </group>

        <group position={[-1.35, 0.48, 0.15]}>
          {[
            [-0.24, 0.24, 0],
            [0, 0, 0],
            [0.24, 0.24, 0],
            [0, 0.48, 0],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} castShadow>
              <boxGeometry args={[0.18, 0.045, 0.18]} />
              <meshStandardMaterial color="#2b3540" metalness={0.42} roughness={0.3} />
            </mesh>
          ))}
        </group>

        {[[-1.42, 0.48, -0.65], [-0.72, 0.48, -0.65], [0.72, 0.48, -0.65], [1.42, 0.48, -0.65]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <RoundedBox args={[0.44, 0.1, 0.18]} radius={0.07} smoothness={4}>
              <meshStandardMaterial color="#28333e" metalness={0.56} roughness={0.23} />
            </RoundedBox>
          </mesh>
        ))}

        <mesh position={[0, 0.13, -0.94]}>
          <boxGeometry args={[2.45, 0.08, 0.05]} />
          <meshBasicMaterial color="#24e5ff" transparent opacity={0.34} />
        </mesh>
      </group>
    </group>
  );
}

export function LandingScene() {
  const stars = useMemo(() => Array.from({ length: 80 }, (_, i) => i), []);

  return (
    <div className="landing-3d-canvas" aria-hidden="true">
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <PerspectiveCamera makeDefault position={[0, 0.55, 7]} fov={34} />
        <ambientLight intensity={0.3} />
        <hemisphereLight args={["#8beeff", "#07101d", 0.52]} />
        <directionalLight position={[4, 5, 5]} intensity={2.25} color="#e7fbff" castShadow />
        <directionalLight position={[-4, 1.5, 2]} intensity={1.1} color="#3bdfff" />
        <pointLight position={[0, -1.2, 2.8]} intensity={3.6} distance={9} color="#23dcff" />

        <AdaptiveDpr pixelated />
        <Sparkles count={120} scale={[9, 5, 8]} size={2.1} speed={0.22} color="#70efff" />
        <HoloRing radius={2.65} y={-0.55} speed={0.28} />
        <HoloRing radius={3.2} y={-1.1} speed={-0.17} opacity={0.16} />
        <HoloRing radius={2.1} y={0.8} speed={0.16} opacity={0.14} />

        {stars.map((i) => (
          <Float key={i} speed={0.4 + (i % 5) * 0.12} rotationIntensity={0.08} floatIntensity={0.35}>
            <mesh position={[((i * 37) % 13) - 6.5, ((i * 23) % 7) - 3.5, -3 - ((i * 17) % 7)]}>
              <sphereGeometry args={[0.008 + (i % 3) * 0.004, 8, 8]} />
              <meshBasicMaterial color={i % 4 === 0 ? "#7cffcf" : "#73dff6"} transparent opacity={0.55} />
            </mesh>
          </Float>
        ))}

        <SpectralTrail />
        <ControllerModel />
        <ContactShadows position={[0, -1.35, 0]} opacity={0.4} scale={5.5} blur={2.6} far={4.5} resolution={512} />
        <TouchToSteerPostFX />
      </Canvas>
    </div>
  );
}
