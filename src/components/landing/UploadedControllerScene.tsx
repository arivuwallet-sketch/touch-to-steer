import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, useGLTF } from "@react-three/drei";
import { ChromaticAberration, EffectComposer, Glitch, Noise, SMAA, SSAO, Scanline } from "@react-three/postprocessing";
import { GlitchMode } from "postprocessing";
import * as THREE from "three";
import controllerAsset from "@/assets/controller.glb.asset.json";

const MODEL_URL = controllerAsset.url;

/**
 * Palette auto-skinned from the uploaded Cinema 4D material library (*.mtl).
 * Materials in the GLB are matched by name and re-tuned to these values.
 */
const SKIN: Record<string, { color?: string; roughness: number; metalness: number; clearcoat?: number }> = {
  "metal bits": { color: "#b4bcbc", roughness: 0.28, metalness: 0.85 },
  "shiny black": { color: "#050505", roughness: 0.14, metalness: 0.3, clearcoat: 0.9 },
  "logo black": { color: "#050505", roughness: 0.3, metalness: 0.2 },
  "shiny white": { color: "#ffffff", roughness: 0.14, metalness: 0.06, clearcoat: 0.9 },
  "dull white": { color: "#f2f4f5", roughness: 0.42, metalness: 0.04 },
  blue: { color: "#137af0", roughness: 0.2, metalness: 0.05, clearcoat: 0.8 },
  green: { color: "#0af529", roughness: 0.2, metalness: 0.05, clearcoat: 0.8 },
  red: { color: "#f51909", roughness: 0.2, metalness: 0.05, clearcoat: 0.8 },
  yellow: { color: "#f5ce09", roughness: 0.2, metalness: 0.05, clearcoat: 0.8 },
  analogs: { roughness: 0.38, metalness: 0.12 },
  "analogs bump": { roughness: 0.38, metalness: 0.12 },
  "front button inserts": { color: "#0a0d10", roughness: 0.22, metalness: 0.1 },
};

type Drag = { mode: "rotate" | "move" | null; x: number; y: number };

function ControllerModel() {
  const { scene } = useGLTF(MODEL_URL, true);
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const drag = useRef<Drag>({ mode: null, x: 0, y: 0 });
  const spin = useRef({ x: 0.12, y: 0.35 });
  const velocity = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0 });
  const hovered = useRef(false);
  const clock = useRef(0);
  const { size, gl } = useThree();

  // Auto-skin + auto-fit: clone the GLB, retune every material from the palette,
  // then centre and normalise the model so any export scale looks right.
  const model = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      child.material = materials.map((source) => {
        const base = source as THREE.MeshStandardMaterial;
        const skin = SKIN[(base.name ?? "").trim().toLowerCase()];
        const next = new THREE.MeshPhysicalMaterial({
          name: base.name,
          color: base.color?.clone?.() ?? new THREE.Color("#ffffff"),
          map: base.map ?? null,
          normalMap: base.normalMap ?? null,
          roughnessMap: base.roughnessMap ?? null,
          metalnessMap: base.metalnessMap ?? null,
          aoMap: base.aoMap ?? null,
          roughness: base.roughness ?? 0.5,
          metalness: base.metalness ?? 0.2,
          transparent: base.transparent,
          opacity: base.opacity,
          side: base.side,
        });
        next.clearcoat = 0.35;
        next.clearcoatRoughness = 0.22;
        next.sheen = 0.12;
        next.sheenRoughness = 0.6;
        next.envMapIntensity = 0.55;
        // Anisotropic filtering: keeps textures crisp at grazing angles.
        const maxAniso = gl.capabilities.getMaxAnisotropy();
        for (const slot of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const) {
          const tex = next[slot];
          if (tex) {
            tex.anisotropy = maxAniso;
            tex.needsUpdate = true;
          }
        }
        next.aoMapIntensity = 1;
        if (skin) {
          if (skin.color) next.color = new THREE.Color(skin.color);
          next.roughness = skin.roughness;
          next.metalness = skin.metalness;
          if (skin.clearcoat !== undefined) {
            next.clearcoat = skin.clearcoat;
            next.clearcoatRoughness = 0.08;
          }
        } else {
          next.roughness = Math.min(0.85, Math.max(0.2, next.roughness));
        }
        return next;
      }) as unknown as THREE.Material;

      if (Array.isArray(materials) && materials.length === 1) {
        child.material = (child.material as unknown as THREE.Material[])[0] as THREE.Material;
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const centre = box.getCenter(new THREE.Vector3());
    const dimensions = box.getSize(new THREE.Vector3());
    const scale = 4.1 / Math.max(dimensions.x, dimensions.y, dimensions.z, 0.0001);

    clone.position.sub(centre);

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(scale);
    return wrapper;
  }, [scene]);

  // Page-wide cursor tracking: the model leans toward the cursor anywhere on the page.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const stop = () => {
      drag.current.mode = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  useEffect(() => {
    const group = shell.current;
    if (!group) return;
    group.add(model);
    return () => {
      group.remove(model);
    };
  }, [model]);

  useFrame((_, delta) => {
    const group = root.current;
    const inner = shell.current;
    if (!group || !inner) return;
    const dt = Math.min(delta, 0.05);
    clock.current += dt;

    if (drag.current.mode !== "rotate") {
      velocity.current.x *= 0.92;
      velocity.current.y *= 0.92;
      spin.current.y += velocity.current.y + dt * 0.22;
      spin.current.x = THREE.MathUtils.clamp(spin.current.x + velocity.current.x, -0.6, 0.6);
      spin.current.x = THREE.MathUtils.lerp(spin.current.x, 0.1 + pointer.current.y * 0.18, 0.03);
    }

    group.rotation.y = spin.current.y + pointer.current.x * 0.12;
    group.rotation.x = spin.current.x;
    group.position.x = THREE.MathUtils.lerp(group.position.x, offset.current.x, 0.18);
    group.position.y = THREE.MathUtils.lerp(group.position.y, offset.current.y, 0.18);

    // Ghost glitch: a short burst of displacement/flicker every 2 seconds.
    const phase = clock.current % 2;
    const glitching = phase < 0.26;
    let gx = 0;
    let gy = 0;
    let gz = 0;
    if (glitching) {
      const fade = 1 - phase / 0.26;
      gx = (Math.random() - 0.5) * 0.46 * fade;
      gy = (Math.random() - 0.5) * 0.2 * fade;
      gz = (Math.random() - 0.5) * 0.26 * fade;
      inner.visible = Math.random() > 0.18;
    } else {
      inner.visible = true;
    }

    // Hover vibration: a fast, tight shake while the cursor is on the controller.
    let hx = 0;
    let hy = 0;
    let hr = 0;
    if (hovered.current) {
      const t = clock.current * 58;
      hx = Math.sin(t) * 0.05 + (Math.random() - 0.5) * 0.02;
      hy = Math.cos(t * 1.37) * 0.04 + (Math.random() - 0.5) * 0.016;
      hr = Math.sin(t * 0.83) * 0.03;
    }

    inner.position.set(gx + hx, gy + hy, gz);
    inner.rotation.z = gz * 0.5 + hr;
  });

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hovered.current = true;
  };

  const handleOut = () => {
    hovered.current = false;
  };

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
      spin.current.x = THREE.MathUtils.clamp(spin.current.x + dy * 0.007, -0.6, 0.6);
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
    spin.current = { x: 0.12, y: 0.35 };
    velocity.current = { x: 0, y: 0 };
  };

  return (
    <group
      ref={root}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onDoubleClick={handleDouble}
    >
      <group ref={shell} />
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
          toneMappingExposure: 0.62,
        }}
        camera={{ position: [0, 0.7, 10.4], fov: 32 }}
      >
        <ambientLight intensity={0.12} />
        <directionalLight
          position={[4.5, 7, 5]}
          intensity={0.7}
          color="#cfe8ff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00015}
        />
        <directionalLight position={[-4, 2, -2]} intensity={0.16} color="#5566cc" />
        <pointLight position={[0, 2.6, 2.8]} intensity={0.35} color="#4ce8ff" distance={9} decay={2} />

        <Environment resolution={256}>
          <Lightformer intensity={1.1} position={[0, 6, 2]} scale={[10, 10, 1]} />
          <Lightformer intensity={0.5} color="#7fd4ff" position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={0.4} color="#9fb6ff" position={[6, 1, -2]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
        </Environment>

        <Suspense fallback={null}>
          <Float speed={1.1} rotationIntensity={0.05} floatIntensity={0.09}>
            <ControllerModel />
          </Float>
        </Suspense>

        <ContactShadows
          position={[0, -2.9, 0]}
          opacity={0.6}
          scale={16}
          blur={2.8}
          far={7}
          resolution={1024}
          color="#00141a"
        />

        <EffectComposer multisampling={0} enableNormalPass>
          <SSAO
            samples={24}
            radius={0.12}
            intensity={22}
            luminanceInfluence={0.5}
            color={new THREE.Color("#001018")}
            worldDistanceThreshold={8}
            worldDistanceFalloff={2}
            worldProximityThreshold={2}
            worldProximityFalloff={1}
          />
          {/* RGB split + scanline tear bursts every ~2s, like the reference glitch art. */}
          <Glitch
            mode={GlitchMode.SPORADIC}
            delay={new THREE.Vector2(1.6, 2.4)}
            duration={new THREE.Vector2(0.14, 0.32)}
            strength={new THREE.Vector2(0.18, 0.5)}
            ratio={0.82}
            columns={0.03}
          />
          <ChromaticAberration offset={new THREE.Vector2(0.0016, 0.0022)} radialModulation={false} modulationOffset={0} />
          <Scanline density={1.45} opacity={0.12} />
          <Noise opacity={0.05} premultiply />
          <SMAA />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL, true);
