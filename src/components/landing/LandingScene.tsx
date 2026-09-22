import { useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  PerspectiveCamera,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const spectralVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.15);
    float scan = 0.5 + 0.5 * sin(vWorld.y * 34.0 - uTime * 8.0 + uOffset * 5.0);
    float glitchLine = step(0.83, fract(vWorld.y * 10.0 + uTime * 0.5 + uOffset));
    float noise = hash(floor(vWorld.xy * 11.0 + uTime * 5.0 + uOffset * 7.0));
    float pointerEnergy = clamp(length(uPointer) * 0.7, 0.0, 1.0);

    vec3 cyan = vec3(0.10, 0.90, 1.0);
    vec3 violet = vec3(0.52, 0.18, 1.0);
    vec3 green = vec3(0.28, 1.0, 0.72);

    vec3 color = mix(cyan, violet, 0.5 + 0.5 * sin(uTime * 1.35 + uOffset * 3.1));
    color = mix(color, green, glitchLine * 0.18);
    color += pointerEnergy * 0.12;

    float alpha = uOpacity * (0.12 + fresnel * 0.8);
    alpha *= 0.72 + scan * 0.28;
    alpha *= 0.72 + noise * 0.28;
    alpha *= 0.88 + pointerEnergy * 0.18;

    gl_FragColor = vec4(color, alpha);
  }
`;

const analogFragmentShader = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uVelocity;

  varying vec2 vUv;

  float random(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float speed = clamp(uVelocity, 0.0, 1.5);

    float jitter = (random(vec2(floor(uTime * 60.0))) - 0.5) * (0.0012 + speed * 0.0035);
    uv.x += jitter;

    float line = floor(uv.y * 720.0);
    float roll = step(0.985, random(vec2(floor(uTime * 4.0) + line * 0.001)));
    uv.y += sin(uTime * 18.0 + line * 0.08) * 0.006 * roll * (0.3 + speed);

    vec2 chroma = vec2(0.0018 + speed * 0.004, 0.0);
    vec4 center = texture2D(tDiffuse, uv);
    float r = texture2D(tDiffuse, uv + chroma).r;
    float b = texture2D(tDiffuse, uv - chroma).b;
    vec3 color = vec3(r, center.g, b);

    float scan = 0.94 + 0.06 * sin(uv.y * uResolution.y * 1.15);
    float vignette = smoothstep(1.18, 0.25, length((uv - 0.5) * vec2(1.2, 1.0)));
    float grain = (random(uv * uResolution.xy + uTime * 17.0) - 0.5) * 0.018;

    color *= scan;
    color += grain;
    color *= 0.92 + vignette * 0.12;

    float edge = smoothstep(0.6, 0.0, length(uv - 0.5));
    color += vec3(0.0, 0.015, 0.025) * edge;

    gl_FragColor = vec4(color, center.a);
  }
`;

const ghostTrailVertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (240.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ghostTrailFragmentShader = `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float soft = smoothstep(0.5, 0.02, d);
    vec3 color = mix(vec3(0.22, 0.94, 1.0), vec3(0.62, 0.26, 1.0), uv.x + 0.5);
    gl_FragColor = vec4(color, soft * vAlpha);
  }
`;

function Button({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.115, 0.145, 0.07, 36]} />
        <meshStandardMaterial color="#141b22" metalness={0.72} roughness={0.23} />
      </mesh>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.088, 0.108, 0.055, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.16}
          metalness={0.22}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.074, 0]}>
        <torusGeometry args={[0.093, 0.008, 8, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.03, 16]} />
        <meshBasicMaterial color="#f7fcff" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Stick({
  position,
  phase = 0,
}: {
  position: [number, number, number];
  phase?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = Math.sin(t * 1.15 + phase) * 0.045;
    ref.current.rotation.z = Math.cos(t * 1.05 + phase) * 0.055;
  });

  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.225, 0.18, 0.085, 44]} />
        <meshStandardMaterial color="#0b1117" metalness={0.82} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.095, 0]} castShadow>
        <sphereGeometry args={[0.165, 40, 28]} />
        <meshStandardMaterial color="#323d49" metalness={0.64} roughness={0.27} />
      </mesh>
      <mesh position={[0, 0.208, 0]}>
        <torusGeometry args={[0.162, 0.012, 8, 40]} />
        <meshBasicMaterial color="#37e6ff" transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function ControllerCore() {
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((state) => {
    if (!root.current || !shell.current) return;
    const t = state.clock.elapsedTime;
    const targetY = pointer.x * 0.34 + Math.sin(t * 0.24) * 0.028;
    const targetX = -pointer.y * 0.18 + Math.cos(t * 0.27) * 0.022;

    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, targetY, 0.045);
    root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, targetX, 0.045);
    root.current.position.y = Math.sin(t * 0.58) * 0.065;
    shell.current.rotation.z = Math.sin(t * 0.36) * 0.012;
  });

  return (
    <group ref={root} position={[0, -0.18, 0]} rotation={[-0.07, 0.18, 0]}>
      <group ref={shell}>
        <RoundedBox
          args={[4.05, 0.74, 2.15]}
          radius={0.34}
          smoothness={10}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#0d151d"
            metalness={0.86}
            roughness={0.19}
            clearcoat={0.92}
            clearcoatRoughness={0.1}
            envMapIntensity={1.65}
          />
        </RoundedBox>

        <RoundedBox
          args={[3.64, 0.18, 1.74]}
          radius={0.13}
          smoothness={8}
          position={[0, 0.4, 0]}
          castShadow
        >
          <meshPhysicalMaterial
            color="#1b2631"
            metalness={0.62}
            roughness={0.22}
            clearcoat={0.7}
          />
        </RoundedBox>

        <RoundedBox
          args={[1.17, 0.25, 0.7]}
          radius={0.15}
          smoothness={7}
          position={[0, 0.5, 0.02]}
        >
          <meshStandardMaterial color="#05090e" metalness={0.76} roughness={0.16} />
        </RoundedBox>

        <mesh position={[0, 0.625, 0.045]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.66, 0.26]} />
          <meshBasicMaterial color="#3beaff" transparent opacity={0.7} />
        </mesh>

        <Stick position={[-1.2, 0.5, 0.26]} phase={0.4} />
        <Stick position={[0.98, 0.5, 0.2]} phase={1.1} />

        <group position={[1.47, 0.49, 0.2]}>
          <Button position={[0, 0.34, 0]} color="#efcf46" />
          <Button position={[-0.31, 0, 0]} color="#62b9ff" />
          <Button position={[0.31, 0, 0]} color="#ff6077" />
          <Button position={[0, -0.34, 0]} color="#5ff09d" />
        </group>

        <group position={[-1.43, 0.49, 0.16]}>
          {[
            [-0.25, 0.25, 0],
            [0, 0, 0],
            [0.25, 0.25, 0],
            [0, 0.5, 0],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} castShadow>
              <boxGeometry args={[0.2, 0.05, 0.2]} />
              <meshStandardMaterial color="#2b3844" metalness={0.48} roughness={0.26} />
            </mesh>
          ))}
        </group>

        {[
          [-1.53, 0.5, -0.68],
          [-0.77, 0.5, -0.68],
          [0.77, 0.5, -0.68],
          [1.53, 0.5, -0.68],
        ].map((p, i) => (
          <RoundedBox
            key={i}
            args={[0.46, 0.1, 0.19]}
            radius={0.07}
            smoothness={5}
            position={p as [number, number, number]}
            castShadow
          >
            <meshStandardMaterial color="#2b3742" metalness={0.62} roughness={0.21} />
          </RoundedBox>
        ))}

        <mesh position={[0, 0.13, -0.98]}>
          <boxGeometry args={[2.55, 0.085, 0.06]} />
          <meshBasicMaterial color="#3ae8ff" transparent opacity={0.42} />
        </mesh>
      </group>
    </group>
  );
}

function GhostShell({
  offset,
  scale,
  opacity,
}: {
  offset: number;
  scale: number;
  opacity: number;
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
    [offset, opacity],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const material = mesh.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPointer.value.lerp(new THREE.Vector2(pointer.x, pointer.y), 0.1);
    material.uniforms.uOpacity.value =
      opacity * (0.8 + Math.sin(state.clock.elapsedTime * 2.2 + offset) * 0.12);
  });

  return (
    <RoundedBox
      ref={ref}
      args={[4.06, 0.75, 2.16]}
      radius={0.34}
      smoothness={10}
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

function SpectralGhost() {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.x * 0.22 + Math.sin(t * 0.35) * 0.04,
      0.03,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -pointer.y * 0.12,
      0.03,
    );
    group.current.rotation.z += delta * 0.025;
  });

  return (
    <group ref={group} position={[0, -0.2, -0.12]}>
      <GhostShell offset={0.15} scale={1.025} opacity={0.18} />
      <GhostShell offset={1.1} scale={1.055} opacity={0.12} />
      <GhostShell offset={2.6} scale={1.09} opacity={0.065} />

      <mesh position={[-0.02, -0.55, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.32, 0.012, 8, 120]} />
        <meshBasicMaterial color="#35e7ff" transparent opacity={0.32} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0.16, -0.56, -0.48]} rotation={[-Math.PI / 2, 0, Math.PI / 7]}>
        <torusGeometry args={[2.68, 0.007, 8, 120]} />
        <meshBasicMaterial color="#8a5bff" transparent opacity={0.18} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function SpectralParticles() {
  const count = 220;
  const ref = useRef<THREE.Points>(null);
  const { pointer } = useThree();

  const { positions, sizes, alphas } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.8 + Math.pow(Math.random(), 0.6) * 3.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2.8 - 0.8;
      sizes[i] = 0.018 + Math.random() * 0.032;
      alphas[i] = 0.2 + Math.random() * 0.72;
    }

    return { positions, sizes, alphas };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    return g;
  }, [alphas, positions, sizes]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: ghostTrailVertexShader,
        fragmentShader: ghostTrailFragmentShader,
      }),
    [],
  );

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.015 + pointer.x * 0.12;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.16) * 0.03 + pointer.y * 0.05;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <points ref={ref} geometry={geometry} material={material} />;
}

function SignalGrid() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.z = state.clock.elapsedTime * 0.012;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.04;
  });

  return (
    <group ref={group} position={[0, -1.38, -1.7]} rotation={[Math.PI / 2.7, 0, 0]}>
      {[2.9, 3.55, 4.25].map((radius) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, 0.004, 6, 128]} />
          <meshBasicMaterial color="#67e8ff" transparent opacity={0.06} />
        </mesh>
      ))}
    </group>
  );
}

function TouchToSteerFX() {
  const composerRef = useRef<EffectComposer | null>(null);
  const analogPassRef = useRef<ShaderPass | null>(null);
  const { gl, scene, camera, size } = useThree();
  const pointerVelocity = useRef(0);
  const lastPointer = useRef(new THREE.Vector2());

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    composer.setSize(size.width, size.height);

    const renderPass = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.86,
      0.72,
      0.08,
    );
    const analog = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uPointer: { value: new THREE.Vector2() },
        uVelocity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: analogFragmentShader,
    });

    const output = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bloom);
    composer.addPass(analog);
    composer.addPass(output);

    composerRef.current = composer;
    analogPassRef.current = analog;

    return () => {
      composerRef.current = null;
      analogPassRef.current = null;
      composer.dispose();
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
    const uniforms = analogPassRef.current?.uniforms;
    uniforms?.uResolution.value.set(size.width, size.height);
  }, [size.height, size.width]);

  useFrame((state) => {
    const p = new THREE.Vector2(state.pointer.x, state.pointer.y);
    const delta = p.distanceTo(lastPointer.current);
    lastPointer.current.lerp(p, 0.5);
    pointerVelocity.current = THREE.MathUtils.lerp(pointerVelocity.current, delta * 4.5, 0.18);

    const uniforms = analogPassRef.current?.uniforms;
    if (uniforms) {
      uniforms.uTime.value = state.clock.elapsedTime;
      uniforms.uPointer.value.lerp(p, 0.08);
      uniforms.uVelocity.value = pointerVelocity.current;
    }

    composerRef.current?.render();
  }, 1);

  return null;
}

export function LandingScene() {
  return (
    <div className="landing-3d-canvas landing-3d-canvas-spectral" aria-hidden="true">
      <div className="landing-scanline-overlay" />
      <Canvas
        dpr={[1, 1.7]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0.45, 7.3]} fov={34} />
        <ambientLight intensity={0.18} />
        <hemisphereLight args={["#9eefff", "#05080f", 0.45]} />
        <directionalLight position={[4, 5, 5]} intensity={2.35} color="#f2fdff" castShadow />
        <directionalLight position={[-4, 1, 2]} intensity={1.35} color="#36e6ff" />
        <pointLight position={[0, -1.4, 2.7]} intensity={4.2} distance={9} color="#28ddff" />
        <pointLight position={[2.6, 1.1, -0.8]} intensity={2.1} distance={6} color="#7b55ff" />

        <Sparkles count={100} scale={[9, 5, 8]} size={2} speed={0.2} color="#6feeff" />
        <SignalGrid />
        <SpectralParticles />
        <SpectralGhost />
        <ControllerCore />

        <Float speed={0.45} rotationIntensity={0.06} floatIntensity={0.18}>
          <mesh position={[0, -1.42, -2.25]}>
            <ringGeometry args={[2.7, 2.715, 128]} />
            <meshBasicMaterial color="#2de8ff" transparent opacity={0.18} side={THREE.DoubleSide} />
          </mesh>
        </Float>

        <ContactShadows position={[0, -1.52, 0]} opacity={0.34} scale={5.9} blur={2.8} far={4.8} resolution={512} />
        <TouchToSteerFX />
      </Canvas>
    </div>
  );
}
