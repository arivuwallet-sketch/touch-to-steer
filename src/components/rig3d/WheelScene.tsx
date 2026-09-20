import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Vector3, type Group, type MeshStandardMaterial } from "three";
import { Button3D, Label, Pad3D, useAnalogPointer } from "./primitives";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

/** Hinged pedal: tap to press, slide up/down for fine throttle control. */
function Pedal3D({
  position,
  label,
  accent,
  onChange,
}: {
  position: [number, number, number];
  label: string;
  accent: string;
  onChange: (v: number) => void;
}) {
  const arm = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const v = useRef(0);
  const onDown = useAnalogPointer((val) => {
    v.current = val;
    onChange(val);
  }, 110, 0.6);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 16);
    if (arm.current) arm.current.rotation.x += (v.current * 0.55 - arm.current.rotation.x) * k;
    if (mat.current)
      mat.current.emissiveIntensity += (0.12 + v.current * 2 - mat.current.emissiveIntensity) * k;
  });

  return (
    <group position={position}>
      {/* base plate */}
      <RoundedBox args={[0.95, 0.12, 1.5]} radius={0.05} smoothness={4} position={[0, -0.36, 0.25]} receiveShadow>
        <meshStandardMaterial color="#0f141d" metalness={0.8} roughness={0.5} />
      </RoundedBox>
      <group ref={arm} position={[0, -0.3, 0.85]}>
        {/* arm */}
        <mesh position={[0, 0.42, -0.35]} castShadow>
          <boxGeometry args={[0.16, 0.9, 0.16]} />
          <meshStandardMaterial color="#8a939f" metalness={0.95} roughness={0.28} />
        </mesh>
        {/* pedal face */}
        <group position={[0, 0.85, -0.42]} rotation={[-0.25, 0, 0]}>
          <RoundedBox args={[0.7, 0.1, 1.05]} radius={0.05} smoothness={4} castShadow onPointerDown={onDown}>
            <meshStandardMaterial
              ref={mat}
              color="#343d4a"
              emissive={accent}
              emissiveIntensity={0.12}
              metalness={0.75}
              roughness={0.35}
            />
          </RoundedBox>
          {/* grip ribs */}
          {[-0.34, -0.11, 0.12, 0.35].map((z) => (
            <mesh key={z} position={[0, 0.06, z]}>
              <boxGeometry args={[0.56, 0.04, 0.07]} />
              <meshStandardMaterial color="#0c1016" roughness={0.95} />
            </mesh>
          ))}
          <Label position={[0, 0.3, 0]} size={10}>{label}</Label>
        </group>
      </group>
    </group>
  );
}

/** Real handbrake: grab and pull it back. */
function Handbrake3D({ onChange }: { onChange: (v: number) => void }) {
  const lever = useRef<Group>(null);
  const v = useRef(0);
  const onDown = useAnalogPointer((val) => {
    v.current = val;
    onChange(val > 0.4 ? 1 : 0);
  }, 90, 0.7);

  useFrame((_, dt) => {
    if (!lever.current) return;
    lever.current.rotation.x += (0.2 + v.current * 0.85 - lever.current.rotation.x) * Math.min(1, dt * 16);
  });

  return (
    <group position={[0, -0.35, 0.6]}>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[0.5, 0.12, 0.9]} />
        <meshStandardMaterial color="#10151d" metalness={0.7} roughness={0.5} />
      </mesh>
      <group ref={lever}>
        <mesh position={[0, 0.5, 0.1]} rotation={[0.25, 0, 0]} castShadow onPointerDown={onDown}>
          <capsuleGeometry args={[0.11, 0.85, 8, 20]} />
          <meshStandardMaterial color="#9aa3b0" metalness={0.98} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.95, 0.22]} rotation={[0.25, 0, 0]} castShadow onPointerDown={onDown}>
          <capsuleGeometry args={[0.15, 0.4, 8, 20]} />
          <meshStandardMaterial color="#14181f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.2, 0.3]}>
          <sphereGeometry args={[0.1, 20, 16]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.4} />
        </mesh>
      </group>
      <Label position={[0, -0.25, 0.6]} size={9} dim>HANDBRAKE</Label>
    </group>
  );
}

export function WheelScene({ settings, set, press }: Props) {
  const wheel = useRef<Group>(null);
  const steer = useRef(0);
  const tiltRef = useRef(0);
  const returning = useRef(false);
  const maxWheelRadians = (settings.wheelRotationDeg * Math.PI) / 360;

  const emit = useCallback(
    (raw: number) => {
      const v = applyCurve(
        Math.max(-1, Math.min(1, raw)),
        settings.deadzone,
        settings.linearity,
        settings.steerSensitivity,
      );
      steer.current = v;
      set({ steer: v });
    },
    [set, settings.deadzone, settings.linearity, settings.steerSensitivity],
  );

  /* tilt steering */
  useEffect(() => {
    if (settings.steerMode !== "tilt") return;
    const onOrient = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      const raw = (settings.invertTilt ? -g : g) / settings.maxTiltDeg;
      tiltRef.current = raw;
      emit(raw);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [settings.steerMode, settings.invertTilt, settings.maxTiltDeg, emit]);

  /* Continuous multi-turn steering: every orbit of the thumb adds a full turn. */
  const { camera, size, gl } = useThree();
  const onGrab = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      // screen position of the wheel hub
      const hub = new Vector3();
      wheel.current?.getWorldPosition(hub);
      hub.project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + ((hub.x + 1) / 2) * size.width;
      const cy = rect.top + ((1 - hub.y) / 2) * size.height;

      const angleOf = (x: number, y: number) => Math.atan2(y - cy, x - cx);
      let last = angleOf(e.nativeEvent.clientX, e.nativeEvent.clientY);
      let acc = steer.current * maxWheelRadians;
      returning.current = false;

      const move = (ev: PointerEvent) => {
        const a = angleOf(ev.clientX, ev.clientY);
        let d = a - last;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        last = a;
        acc = Math.max(-maxWheelRadians, Math.min(maxWheelRadians, acc + d));
        emit(acc / maxWheelRadians);
      };
      const up = () => {
        returning.current = settings.autoCentre;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [emit, settings.autoCentre, camera, size.width, size.height, gl, maxWheelRadians],
  );

  useFrame((_, dt) => {
    if (!wheel.current) return;
    if (returning.current && Math.abs(steer.current) > 0.002) {
      emit(steer.current * Math.exp(-4.5 * Math.min(dt, 0.05)));
    } else if (returning.current) {
      returning.current = false;
      emit(0);
    }
    const goal = -steer.current * maxWheelRadians;
    wheel.current.rotation.z += (goal - wheel.current.rotation.z) * Math.min(1, dt * 22);
  });

  return (
    <group position={[0, -0.4, 0]}>
      {/* ---------------- wheel ---------------- */}
      <group position={[-3.1, 0.25, 0.5]} rotation={[-Math.PI / 2, 0, 0]} scale={0.86}>
        {/* column */}
        <mesh position={[0, 0, -0.6]} castShadow>
          <cylinderGeometry args={[0.28, 0.4, 1.1, 24]} />
          <meshStandardMaterial color="#0f141c" metalness={0.6} roughness={0.6} />
        </mesh>
        <group ref={wheel}>
          {/* rim */}
          <mesh castShadow onPointerDown={onGrab}>
            <torusGeometry args={[2.0, 0.24, 24, 72]} />
            <meshStandardMaterial color="#242b36" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* leather grips */}
          {[-1, 1].map((s) => (
            <mesh key={s} rotation={[0, 0, (s * Math.PI) / 2]} onPointerDown={onGrab} castShadow>
              <torusGeometry args={[2.0, 0.3, 20, 40, Math.PI * 0.5]} />
              <meshStandardMaterial color="#3a2b24" roughness={0.9} metalness={0.05} />
            </mesh>
          ))}
          {/* spokes */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.0, -0.15, 0.06]} rotation={[0, 0, s * 0.25]} castShadow>
              <boxGeometry args={[2.0, 0.42, 0.18]} />
              <meshStandardMaterial color="#2a303c" metalness={0.85} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, -1.1, 0.06]} castShadow>
            <boxGeometry args={[0.5, 1.4, 0.18]} />
            <meshStandardMaterial color="#2a303c" metalness={0.85} roughness={0.3} />
          </mesh>
          {/* hub */}
          <mesh position={[0, 0, 0.14]} castShadow>
            <cylinderGeometry args={[0.72, 0.8, 0.22, 36]} />
            <meshStandardMaterial color="#1b212c" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.64, 40]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.8} />
          </mesh>
          {/* centre marker */}
          <mesh position={[0, 1.9, 0.14]}>
            <boxGeometry args={[0.16, 0.3, 0.1]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={1.6} />
          </mesh>
          {/* G29-style RPM strip */}
          {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => (
            <mesh key={x} position={[x, 0.78, 0.31]}>
              <sphereGeometry args={[0.055, 12, 8]} />
              <meshStandardMaterial
                color={i < 3 ? "#22c55e" : i === 3 ? "#facc15" : "#ef4444"}
                emissive={i < 3 ? "#22c55e" : i === 3 ? "#facc15" : "#ef4444"}
                emissiveIntensity={1.8}
              />
            </mesh>
          ))}
          {/* horn pad on the hub */}
          <group position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <Button3D
              position={[0, 0, 0]}
              radius={0.34}
              color="#20252f"
              glow="#fbbf24"
              label="HORN"
              labelSize={8}
              vibration={settings.vibration}
              onPress={(d) => press("horn", d)}
            />
          </group>
          {/* face controls and D-pad rotate with the wheel, like the G29 */}
          <group position={[-0.9, 0.12, 0.34]} scale={0.62}>
            {([
              ["dpad_up", [0, 0, -0.38]],
              ["dpad_down", [0, 0, 0.38]],
              ["dpad_left", [-0.38, 0, 0]],
              ["dpad_right", [0.38, 0, 0]],
            ] as const).map(([id, p]) => (
              <Pad3D key={id} position={p as [number, number, number]} size={[0.38, 0.12, 0.38]} glow="#38bdf8" vibration={settings.vibration} onPress={(d) => press(id, d)} />
            ))}
          </group>
          <group position={[0.95, 0.12, 0.34]} scale={0.62}>
            <Button3D position={[0, 0, -0.42]} radius={0.2} label="△" glow="#4ade80" vibration={settings.vibration} onPress={(d) => press("y", d)} />
            <Button3D position={[-0.42, 0, 0]} radius={0.2} label="□" glow="#f472b6" vibration={settings.vibration} onPress={(d) => press("x", d)} />
            <Button3D position={[0.42, 0, 0]} radius={0.2} label="○" glow="#f87171" vibration={settings.vibration} onPress={(d) => press("b", d)} />
            <Button3D position={[0, 0, 0.42]} radius={0.2} label="×" glow="#60a5fa" vibration={settings.vibration} onPress={(d) => press("a", d)} />
          </group>
          ))}
        </group>
      </group>

      {/* ---------------- pedal box ---------------- */}
      <group position={[3.15, 0.1, 0.45]} rotation={[0, 0, 0]} scale={1.05}>
        <Pedal3D position={[-1.1, 0, 0]} label="CLUTCH" accent="#60a5fa" onChange={(v) => set({ clutch: v })} />
        <Pedal3D position={[0, 0, 0]} label="BRAKE" accent="#ef4444" onChange={(v) => set({ brake: v })} />
        <Pedal3D position={[1.1, 0, 0]} label="GAS" accent="#22c55e" onChange={(v) => set({ throttle: v })} />
      </group>

      {/* ---------------- handbrake + extras ---------------- */}
      <group position={[1.0, 0.15, 0.45]} rotation={[0, 0, 0]} scale={1.0}>
        <Handbrake3D onChange={(v) => set({ handbrake: v })} />
      </group>


      <group position={[1.05, 0.15, 1.95]}>
        <Pad3D position={[0, 0, 0]} size={[1.25, 0.16, 0.55]} glow="#a855f7" label="NITRO" vibration={settings.vibration} onPress={(d) => set({ nitro: d ? 1 : 0 })} />
      </group>
    </group>
  );
}
