import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, PerspectiveCamera, RoundedBox, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const backdropVertexShader = \`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
\`;

const backdropFragmentShader = \`
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float glow(vec2 uv, vec2 p, float size) {
    float d = length(uv - p);
    return exp(-d * d / size);
  }
  void main() {
    vec2 uv = vUv;
    vec3 color = vec3(0.002, 0.007, 0.013);
    color += vec3(0.018, 0.14, 0.18) * glow(uv, vec2(0.24, 0.46), 0.15);
    color += vec3(0.05, 0.018, 0.15) * glow(uv, vec2(0.78, 0.56), 0.18);
    color += vec3(0.01, 0.15, 0.22) * glow(uv, vec2(0.53, 0.16), 0.2);
    vec2 grid = fract(uv * vec2(42.0, 25.0) + vec2(uTime * 0.01, -uTime * 0.005));
    float lines = smoothstep(0.03, 0.0, min(grid.x, grid.y));
    color += vec3(0.015, 0.08, 0.11) * lines * 0.28;
    float star = step(0.9973, hash(floor(uv * 180.0)));
    color += vec3(0.12, 0.62, 0.76) * star * (0.55 + 0.45 * sin(uTime * 2.0 + uv.x * 40.0));
    float vignette = smoothstep(0.8, 0.12, length((uv - 0.5) * vec2(1.28, 1.0)));
    color *= 0.74 + vignette * 0.46;
    gl_FragColor = vec4(color, 1.0);
  }
\`;

const spectralVertexShader = \`
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
\`;

const spectralFragmentShader = \`
  uniform float uTime;
  uniform float uOpacity;
  uniform float uOffset;
  varying vec3 vNormal;
  varying vec3 vWorld;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.12);
    float scan = 0.5 + 0.5 * sin(vWorld.y * 32.0 - uTime * 7.5 + uOffset * 4.0);
    float glitch = step(0.84, fract(vWorld.y * 10.0 + uTime * 0.45 + uOffset));
    float noise = hash(floor(vWorld.xy * 12.0 + uTime * 4.0 + uOffset * 6.0));
    vec3 cyan = vec3(0.08, 0.87, 1.0);
    vec3 violet = vec3(0.5, 0.18, 1.0);
    vec3 color = mix(cyan, violet, 0.5 + 0.5 * sin(uTime * 1.2 + uOffset * 3.0));
    color += vec3(0.15, 0.95, 0.65) * glitch * 0.15;
    float alpha = uOpacity * (0.08 + fresnel * 0.88);
    alpha *= 0.72 + scan * 0.28;
    alpha *= 0.72 + noise * 0.28;
    gl_FragColor = vec4(color, alpha);
  }
\`;

const particleVertexShader = \`
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (230.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
\`;

const particleFragmentShader = \`
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float soft = smoothstep(0.5, 0.02, length(uv));
    vec3 color = mix(vec3(0.22, 0.95, 1.0), vec3(0.64, 0.26, 1.0), uv.x + 0.5);
    gl_FragColor = vec4(color, soft * vAlpha);
  }
\`;

function BackdropPlane() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh position={[0, 0, -5.2]}>
      <planeGeometry args={[18, 11]} />
      <shaderMaterial uniforms={uniforms} vertexShader={backdropVertexShader} fragmentShader={backdropFragmentShader} depthWrite={false} />
    </mesh>
  );
}

function GhostShell({ offset, scale, opacity }: { offset: number; scale: number; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: opacity },
    uOffset: { value: offset },
  }), [offset, opacity]);

  useFrame((state) => {
    const material = ref.current?.material as THREE.ShaderMaterial | undefined;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = opacity * (0.82 + Math.sin(state.clock.elapsedTime * 2.1 + offset) * 0.12);
  });

  return (
    <RoundedBox ref={ref} args={[4.08, 0.76, 2.16]} radius={0.34} smoothness={10} scale={scale}>
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
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.18 + Math.sin(t * 0.33) * 0.035, 1.7, delta);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.09, 1.7, delta);
    group.current.rotation.z += delta * 0.018;
  });

  return (
    <group ref={group} position={[0, -0.2, -0.4]}>
      <GhostShell offset={0.2} scale={1.05} opacity={0.18} />
      <GhostShell offset={1.15} scale={1.085} opacity={0.11} />
      <GhostShell offset={2.55} scale={1.13} opacity={0.06} />
      {[2.45, 3.15, 3.95].map((radius, index) => (
        <mesh key={radius} position={[0, -0.82, -1]} rotation={[-Math.PI / 2, 0, index * 0.18]}>
          <torusGeometry args={[radius, index === 0 ? 0.012 : 0.006, 8, 160]} />
          <meshBasicMaterial color={index === 2 ? "#8e68ff" : "#34e8ff"} transparent opacity={index === 0 ? 0.24 : 0.11} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function SpectralParticles() {
  const count = 300;
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.9 + Math.pow(Math.random(), 0.58) * 4.1;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3.2 - 1.3;
      sizes[i] = 0.016 + Math.random() * 0.04;
      alphas[i] = 0.18 + Math.random() * 0.75;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    return g;
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
  }), []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.012;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.16) * 0.025;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <points ref={ref} geometry={geometry} material={material} />;
}

function SignalArcs() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * 0.008;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.21) * 0.045;
  });
  return (
    <group ref={ref} position={[0, -1.65, -1.4]} rotation={[Math.PI / 2.72, 0, 0]}>
      {[2.7, 3.45, 4.25].map((radius, index) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, 0.004, 6, 128]} />
          <meshBasicMaterial color={index === 2 ? "#7a5cff" : "#49e8ff"} transparent opacity={0.05 + index * 0.015} />
        </mesh>
      ))}
    </group>
  );
}

function BackgroundPostFX() {
  const composerRef = useRef<EffectComposer | null>(null);
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    composer.setSize(size.width, size.height);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.72, 0.7, 0.08));
    composer.addPass(new OutputPass());
    composerRef.current = composer;
    return () => {
      composerRef.current = null;
      composer.dispose();
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size.height, size.width]);

  useFrame(() => composerRef.current?.render(), 1);
  return null;
}

function BackgroundScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.32, 7.4]} fov={36} />
      <ambientLight intensity={0.18} />
      <hemisphereLight args={["#b9fbff", "#02050b", 0.42]} />
      <directionalLight position={[4, 5, 4]} intensity={1.65} color="#dffcff" />
      <pointLight position={[-3, 1.5, 1]} intensity={2.8} distance={8} color="#21dfff" />
      <pointLight position={[3, -1, 0]} intensity={1.7} distance={7} color="#7555ff" />
      <BackdropPlane />
      <Sparkles count={140} scale={[9, 5, 8]} size={2} speed={0.18} color="#65efff" />
      <SignalArcs />
      <SpectralParticles />
      <SpectralGhost />
      <mesh position={[0, -1.92, -2.4]}>
        <ringGeometry args={[2.8, 2.815, 160]} />
        <meshBasicMaterial color="#39e8ff" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <BackgroundPostFX />
    </>
  );
}

function createApexShellGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-2.7, 0.82);
  shape.bezierCurveTo(-2.5, 1.2, -1.88, 1.42, -1.2, 1.36);
  shape.bezierCurveTo(-0.58, 1.32, -0.36, 1.05, 0, 1.02);
  shape.bezierCurveTo(0.36, 1.05, 0.58, 1.32, 1.2, 1.36);
  shape.bezierCurveTo(1.88, 1.42, 2.5, 1.2, 2.7, 0.82);
  shape.bezierCurveTo(2.88, 0.36, 2.82, -0.12, 2.76, -0.48);
  shape.bezierCurveTo(2.66, -1.12, 2.48, -1.75, 2.05, -2.0);
  shape.bezierCurveTo(1.66, -2.23, 1.3, -1.92, 1.05, -1.55);
  shape.bezierCurveTo(0.76, -1.12, 0.42, -0.97, 0, -0.97);
  shape.bezierCurveTo(-0.42, -0.97, -0.76, -1.12, -1.05, -1.55);
  shape.bezierCurveTo(-1.3, -1.92, -1.66, -2.23, -2.05, -2.0);
  shape.bezierCurveTo(-2.48, -1.75, -2.66, -1.12, -2.76, -0.48);
  shape.bezierCurveTo(-2.82, -0.12, -2.88, 0.36, -2.7, 0.82);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.58,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: 0.12,
    bevelThickness: 0.1,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -0.29);
  geometry.computeVertexNormals();
  return geometry;
}

function ApexStick({ position, phase }: { position: [number, number, number]; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, Math.sin(t * 1.0 + phase) * 0.055, 5, delta);
    ref.current.rotation.z = THREE.MathUtils.damp(ref.current.rotation.z, Math.cos(t * 0.92 + phase) * 0.07, 5, delta);
  });
  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.095, 56]} />
        <meshPhysicalMaterial color="#d7e1e8" metalness={0.48} roughness={0.2} clearcoat={0.85} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.175, 0.21, 0.14, 56]} />
        <meshPhysicalMaterial color="#ffffff" metalness={0.2} roughness={0.15} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      <mesh position={[0, 0.21, 0]} castShadow>
        <sphereGeometry args={[0.185, 48, 34]} />
        <meshPhysicalMaterial color="#d8e1e7" metalness={0.55} roughness={0.24} clearcoat={0.94} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <torusGeometry args={[0.175, 0.015, 10, 48]} />
        <meshBasicMaterial color="#3ddfff" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.255, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.055, 0.064, 36]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.68} />
      </mesh>
    </group>
  );
}

function ApexButton({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.175, 0.21, 0.12, 46]} />
        <meshPhysicalMaterial color="#dbe4eb" metalness={0.18} roughness={0.22} clearcoat={0.95} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.08, 46]} />
        <meshPhysicalMaterial color="#f7fbff" metalness={0.12} roughness={0.18} clearcoat={1} clearcoatRoughness={0.07} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.128, 0.142, 44]} />
        <meshBasicMaterial color={accent} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.043, 0.051, 24]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function ApexDPad() {
  return (
    <group position={[-1.55, -0.23, 0.42]}>
      <RoundedBox args={[0.22, 0.68, 0.17]} radius={0.08} smoothness={7} castShadow>
        <meshPhysicalMaterial color="#dce5eb" metalness={0.18} roughness={0.19} clearcoat={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.68, 0.22, 0.17]} radius={0.08} smoothness={7} castShadow>
        <meshPhysicalMaterial color="#e8eef2" metalness={0.14} roughness={0.2} clearcoat={0.95} />
      </RoundedBox>
      <mesh position={[0, 0, 0.092]}>
        <ringGeometry args={[0.07, 0.09, 40]} />
        <meshBasicMaterial color="#62dcff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function Apex5Controller() {
  const root = useRef<THREE.Group>(null);
  const shellGroup = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const motion = useRef({ x: 0, y: 0, scroll: 0 });
  const target = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Vector3());
  const shellGeometry = useMemo(() => createApexShellGeometry(), []);
  const accentCurve = useMemo(() => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.02, -0.82, 0.31),
      new THREE.Vector3(-1.18, -1.15, 0.33),
      new THREE.Vector3(0, -1.34, 0.34),
      new THREE.Vector3(1.18, -1.15, 0.33),
      new THREE.Vector3(2.02, -0.82, 0.31),
    ]),
    96, 0.028, 10, false,
  ), []);

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      motion.current.x = THREE.MathUtils.clamp((event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1, -1, 1);
      motion.current.y = THREE.MathUtils.clamp(1 - (event.clientY / Math.max(window.innerHeight, 1)) * 2, -1, 1);
    };
    const handleScroll = () => {
      const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      motion.current.scroll = THREE.MathUtils.clamp(window.scrollY / range, 0, 1);
    };
    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => () => shellGeometry.dispose(), [shellGeometry]);
  useEffect(() => () => accentCurve.dispose(), [accentCurve]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const { x, y, scroll } = motion.current;
    target.current.set(x * 1.48, y * 1.12 + (0.22 - scroll) * 0.2, -0.2 + Math.abs(x) * 0.14);
    targetRotation.current.set(-y * 0.18, x * 0.42, x * 0.12);

    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, target.current.x, 4.8, delta);
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, target.current.y, 4.8, delta);
    root.current.position.z = THREE.MathUtils.damp(root.current.position.z, target.current.z, 3.6, delta);
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, targetRotation.current.x, 4.2, delta);
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, targetRotation.current.y, 4.2, delta);
    root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, targetRotation.current.z, 5.0, delta);

    if (shellGroup.current) shellGroup.current.rotation.z += delta * 0.012;
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.58 + Math.sin(state.clock.elapsedTime * 2.4) * 0.16;
    }
  });

  return (
    <group ref={root} position={[0.15, 0, 0]} scale={1.18}>
      <group ref={shellGroup}>
        <mesh geometry={shellGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial color="#edf3f7" metalness={0.14} roughness={0.19} clearcoat={1} clearcoatRoughness={0.07} reflectivity={0.8} envMapIntensity={1.5} />
        </mesh>

        <RoundedBox args={[3.12, 0.1, 1.32]} radius={0.14} smoothness={10} position={[0, 0.5, 0.36]} castShadow>
          <meshPhysicalMaterial color="#f8fbfd" metalness={0.1} roughness={0.14} clearcoat={1} clearcoatRoughness={0.05} />
        </RoundedBox>
        <RoundedBox args={[1.06, 0.1, 0.67]} radius={0.13} smoothness={8} position={[0, 0.69, 0.43]}>
          <meshPhysicalMaterial color="#f3f8fa" metalness={0.24} roughness={0.13} clearcoat={1} clearcoatRoughness={0.04} />
        </RoundedBox>
        <RoundedBox args={[0.72, 0.035, 0.33]} radius={0.06} smoothness={6} position={[0, 0.742, 0.48]}>
          <meshPhysicalMaterial color="#0b141c" metalness={0.55} roughness={0.17} clearcoat={0.85} />
        </RoundedBox>

        {[-1.58, -0.76, 0.76, 1.58].map((x) => (
          <RoundedBox key={x} args={[0.44, 0.12, 0.18]} radius={0.07} smoothness={6} position={[x, 0.99, 0.27]} rotation={[0, x < 0 ? 0.04 : -0.04, x * 0.035]} castShadow>
            <meshPhysicalMaterial color="#d6e0e7" metalness={0.25} roughness={0.19} clearcoat={0.94} />
          </RoundedBox>
        ))}
        {[-1, 1].map((side) => (
          <RoundedBox key={side} args={[0.74, 0.13, 0.32]} radius={0.08} smoothness={7} position={[side * 1.45, 1.08, 0.08]} rotation={[0, side * 0.04, side * -0.08]} castShadow>
            <meshPhysicalMaterial color="#eaf1f5" metalness={0.17} roughness={0.2} clearcoat={0.96} />
          </RoundedBox>
        ))}

        <ApexStick position={[-1.05, 0.2, 0.52]} phase={0.4} />
        <ApexStick position={[0.9, -0.14, 0.53]} phase={1.15} />
        <ApexDPad />

        <group position={[1.55, 0.25, 0.47]}>
          <ApexButton position={[0, 0.33, 0]} accent="#5ac8ff" />
          <ApexButton position={[-0.33, 0, 0]} accent="#ff6a84" />
          <ApexButton position={[0.33, 0, 0]} accent="#ffd66a" />
          <ApexButton position={[0, -0.33, 0]} accent="#74e8a6" />
        </group>

        <mesh position={[0, -0.04, 0.51]}>
          <boxGeometry args={[0.035, 0.56, 0.035]} />
          <meshBasicMaterial color="#8a9ca9" transparent opacity={0.38} />
        </mesh>
        <mesh position={[0, 0.29, 0.52]}>
          <torusGeometry args={[0.44, 0.018, 12, 64]} />
          <meshBasicMaterial color="#62eaff" transparent opacity={0.18} />
        </mesh>

        <mesh ref={glowRef} geometry={accentCurve} position={[0, 0, 0]}>
          <meshBasicMaterial color="#31ddff" transparent opacity={0.72} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, -1.02, 0.47]}>
          <boxGeometry args={[1.35, 0.025, 0.18]} />
          <meshBasicMaterial color="#6aeaff" transparent opacity={0.32} />
        </mesh>

        {[[-2.18, 0.12, 0.37], [2.18, 0.12, 0.37], [-1.9, -0.93, 0.38], [1.9, -0.93, 0.38]].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]}>
            <cylinderGeometry args={[0.035, 0.035, 0.018, 20]} />
            <meshBasicMaterial color="#7f909d" transparent opacity={0.72} />
          </mesh>
        ))}
      </group>

      <mesh position={[0, -0.08, -0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.85, 0.018, 8, 150]} />
        <meshBasicMaterial color="#36e7ff" transparent opacity={0.11} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -0.1, -0.9]} rotation={[-Math.PI / 2, 0, Math.PI / 9]}>
        <torusGeometry args={[3.1, 0.009, 8, 150]} />
        <meshBasicMaterial color="#8b62ff" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function ControllerBloom() {
  const composerRef = useRef<EffectComposer | null>(null);
  const { gl, scene, camera, size } = useThree();
  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    composer.setSize(size.width, size.height);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.3, 0.42, 0.18));
    composer.addPass(new OutputPass());
    composerRef.current = composer;
    return () => {
      composerRef.current = null;
      composer.dispose();
    };
  }, [camera, gl, scene]);
  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size.height, size.width]);
  useFrame(() => composerRef.current?.render(), 1);
  return null;
}

export function LandingBackground() {
  return (
    <div className="landing-3d-background" aria-hidden="true">
      <Canvas dpr={[1, 1.65]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}>
        <BackgroundScene />
      </Canvas>
    </div>
  );
}

export function Apex5ControllerScene() {
  return (
    <div className="landing-3d-controller" aria-hidden="true">
      <Canvas dpr={[1, 1.7]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }} shadows>
        <PerspectiveCamera makeDefault position={[0, 0.18, 7.8]} fov={30} />
        <ambientLight intensity={0.24} />
        <hemisphereLight args={["#f4fdff", "#081018", 0.85]} />
        <directionalLight position={[4.5, 5.3, 6]} intensity={3.8} color="#ffffff" castShadow />
        <directionalLight position={[-4.2, 2.0, 3.5]} intensity={1.75} color="#d9f9ff" />
        <pointLight position={[-2.4, 0.6, 3.4]} intensity={4.4} distance={8} color="#4edfff" />
        <pointLight position={[2.8, 1.4, 1.2]} intensity={2.3} distance={6.5} color="#7a5cff" />
        <pointLight position={[0, -1.6, 2.8]} intensity={1.8} distance={5.5} color="#bfefff" />
        <Apex5Controller />
        <ContactShadows position={[0, -1.96, 0.15]} opacity={0.34} scale={5.7} blur={2.9} far={4.7} resolution={512} />
        <Sparkles count={28} scale={[6.4, 4.8, 5.4]} size={1.3} speed={0.12} color="#8cefff" />
        <ControllerBloom />
      </Canvas>
    </div>
  );
}
