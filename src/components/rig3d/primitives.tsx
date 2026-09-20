import { useRef, useCallback } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial } from "three";

const buzz = (on: boolean, enabled = true) => {
  if (!enabled) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(on ? 12 : 4);
};

/** Pointer-down anywhere -> analog value driven by how far the finger travels. */
export function useAnalogPointer(onValue: (v: number) => void, travel = 90, initial = 0.5) {
  return useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const startY = e.nativeEvent.clientY;
      onValue(initial);
      buzz(true);
      const move = (ev: PointerEvent) => {
        const v = Math.max(0, Math.min(1, initial + (ev.clientY - startY) / travel));
        onValue(v);
      };
      const up = () => {
        onValue(0);
        buzz(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [onValue, travel, initial],
  );
}

function useHold(onPress: (down: boolean) => void, vibration = true) {
  return useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onPress(true);
      buzz(true, vibration);
      const up = () => {
        onPress(false);
        buzz(false, vibration);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [onPress, vibration],
  );
}

export function Label({
  children,
  position,
  size = 11,
  dim = false,
}: {
  children: React.ReactNode;
  position: [number, number, number];
  size?: number | undefined;
  dim?: boolean | undefined;
}) {
  return (
    <Html position={position} center transform={false} zIndexRange={[5, 0]} pointerEvents="none">
      <span
        style={{
          fontFamily: "var(--font-display, sans-serif)",
          fontSize: size,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: dim ? "rgba(235,240,255,0.5)" : "rgba(240,245,255,0.92)",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {children}
      </span>
    </Html>
  );
}

/** Round, pressable, glowing button. */
export function Button3D({
  position,
  radius = 0.26,
  color = "#2b3242",
  glow = "#7dd3fc",
  label,
  labelSize,
  vibration = true,
  onPress,
}: {
  position: [number, number, number];
  radius?: number | undefined;
  color?: string | undefined;
  glow?: string | undefined;
  label?: string | undefined;
  labelSize?: number | undefined;
  vibration?: boolean | undefined;
  onPress: (down: boolean) => void;
}) {
  const g = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const down = useRef(false);
  const handler = useHold((d) => {
    down.current = d;
    onPress(d);
  }, vibration);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 18);
    if (g.current) g.current.position.y += ((down.current ? -0.06 : 0) - g.current.position.y) * k;
    if (mat.current)
      mat.current.emissiveIntensity += ((down.current ? 1.6 : 0.25) - mat.current.emissiveIntensity) * k;
  });

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <ringGeometry args={[radius * 1.02, radius * 1.22, 32]} />
        <meshStandardMaterial color="#10141d" roughness={0.9} />
      </mesh>
      <group ref={g}>
        <mesh castShadow onPointerDown={handler}>
          <cylinderGeometry args={[radius, radius * 0.94, 0.12, 32]} />
          <meshStandardMaterial
            ref={mat}
            color={color}
            emissive={glow}
            emissiveIntensity={0.25}
            metalness={0.55}
            roughness={0.32}
          />
        </mesh>
        {label && <Label position={[0, 0.1, 0]} size={labelSize}>{label}</Label>}
      </group>
    </group>
  );
}

/** Rectangular pressable pad (shoulder buttons, start/back, extras). */
export function Pad3D({
  position,
  size = [0.9, 0.16, 0.42],
  label,
  color = "#252c3a",
  glow = "#7dd3fc",
  vibration = true,
  onPress,
}: {
  position: [number, number, number];
  size?: [number, number, number] | undefined;
  label?: string | undefined;
  color?: string | undefined;
  glow?: string | undefined;
  vibration?: boolean | undefined;
  onPress: (down: boolean) => void;
}) {
  const g = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const down = useRef(false);
  const handler = useHold((d) => {
    down.current = d;
    onPress(d);
  }, vibration);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 18);
    if (g.current) g.current.position.y += ((down.current ? -0.05 : 0) - g.current.position.y) * k;
    if (mat.current)
      mat.current.emissiveIntensity += ((down.current ? 1.4 : 0.2) - mat.current.emissiveIntensity) * k;
  });

  return (
    <group position={position}>
      <group ref={g}>
        <RoundedBox args={size} radius={0.055} smoothness={4} castShadow onPointerDown={handler}>
          <meshStandardMaterial
            ref={mat}
            color={color}
            emissive={glow}
            emissiveIntensity={0.2}
            metalness={0.5}
            roughness={0.35}
          />
        </RoundedBox>
        {label && <Label position={[0, size[1] / 2 + 0.05, 0]} size={10}>{label}</Label>}
      </group>
    </group>
  );
}

/** Thumbstick: drag the cap, it tilts like the real thing and re-centres. */
export function Stick3D({
  position,
  label,
  radius = 0.62,
  vibration = true,
  onMove,
  onClick3,
}: {
  position: [number, number, number];
  label?: string | undefined;
  radius?: number | undefined;
  vibration?: boolean | undefined;
  onMove: (x: number, y: number) => void;
  onClick3?: ((down: boolean) => void) | undefined;
}) {
  const stick = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });
  const clickHandler = useHold((d) => onClick3?.(d), vibration);

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const sx = e.nativeEvent.clientX;
      const sy = e.nativeEvent.clientY;
      const R = 70;
      buzz(true, vibration);
      const move = (ev: PointerEvent) => {
        let dx = (ev.clientX - sx) / R;
        let dy = (ev.clientY - sy) / R;
        const m = Math.hypot(dx, dy);
        if (m > 1) {
          dx /= m;
          dy /= m;
        }
        target.current = { x: dx, y: dy };
        onMove(dx, -dy);
      };
      const up = () => {
        target.current = { x: 0, y: 0 };
        onMove(0, 0);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [onMove, vibration],
  );

  useFrame((_, dt) => {
    if (!stick.current) return;
    const k = Math.min(1, dt * 20);
    const maxTilt = 0.42;
    stick.current.rotation.z += (-target.current.x * maxTilt - stick.current.rotation.z) * k;
    stick.current.rotation.x += (-target.current.y * maxTilt - stick.current.rotation.x) * k;
  });

  return (
    <group position={position}>
      {/* recessed well */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.92, radius * 1.3, 48]} />
        <meshStandardMaterial color="#0d111a" roughness={0.95} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[radius * 0.95, radius * 0.95, 0.06, 48]} />
        <meshStandardMaterial color="#141a26" roughness={0.9} />
      </mesh>
      <group ref={stick}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[radius * 0.42, radius * 0.5, 0.26, 32]} />
          <meshStandardMaterial color="#1b2130" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow onPointerDown={onDown} onDoubleClick={clickHandler}>
          <cylinderGeometry args={[radius * 0.78, radius * 0.66, 0.14, 40]} />
          <meshStandardMaterial color="#2a3142" metalness={0.35} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[radius * 0.74, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#10151f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.8, radius * 0.88, 40]} />
          <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={1.1} />
        </mesh>
      </group>
      {label && <Label position={[0, -0.2, radius * 1.6]} size={9} dim>{label}</Label>}
    </group>
  );
}
