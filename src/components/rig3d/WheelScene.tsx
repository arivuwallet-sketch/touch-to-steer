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

function Pedal3D({
  position,
  label,
  accent,
  onChange,
}: {
  position: [number, number, number];
  label: string;
  accent: string;
  onChange: (value: number) => void;
}) {
  const arm = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const value = useRef(0);

  const onDown = useAnalogPointer((v) => {
    value.current = v;
    onChange(v);
  }, 110, 0.45);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 18);
    if (arm.current) {
      arm.current.rotation.x += (value.current * 0.25 - arm.current.rotation.x) * k;
      arm.current.position.z += (-value.current * 0.08 - arm.current.position.z) * k;
    }
    if (mat.current) {
      mat.current.emissiveIntensity += (0.05 + value.current * 0.65 - mat.current.emissiveIntensity) * k;
    }
  });

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <RoundedBox args={[1.1, 0.18, 1.8]} radius={0.08} smoothness={5} position={[0, -0.7, 0.25]} receiveShadow>
        <meshStandardMaterial color="#0b0f14" metalness={0.82} roughness={0.48} />
      </RoundedBox>
      <group ref={arm}>
        <mesh position={[0, 0.08, 0]} castShadow>
          <boxGeometry args={[0.16, 1.05, 0.16]} />
          <meshStandardMaterial color="#8e98a4" metalness={0.95} roughness={0.24} />
        </mesh>
        <RoundedBox
          args={[0.72, 0.11, 1.08]}
          radius={0.06}
          smoothness={5}
          position={[0, 0.52, -0.08]}
          castShadow
          onPointerDown={onDown}
        >
          <meshStandardMaterial
            ref={mat}
            color="#cfd5da"
            emissive={accent}
            emissiveIntensity={0.05}
            metalness={0.78}
            roughness={0.3}
          />
        </RoundedBox>
        {[-0.34, -0.11, 0.12, 0.35].map((z) => (
          <group key={z}>
            <mesh position={[-0.16, 0.59, z]}>
              <sphereGeometry args={[0.055, 14, 10]} />
              <meshStandardMaterial color="#30363e" roughness={0.9} />
            </mesh>
            <mesh position={[0.16, 0.59, z]}>
              <sphereGeometry args={[0.055, 14, 10]} />
              <meshStandardMaterial color="#30363e" roughness={0.9} />
            </mesh>
          </group>
        ))}
        <Label position={[0, -0.05, 0.6]} size={9} dim>{label}</Label>
      </group>
    </group>
  );
}

function Handbrake3D({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const lever = useRef<Group>(null);
  const value = useRef(0);
  const onDown = useAnalogPointer((v) => {
    value.current = v;
    set({ handbrake: v > 0.2 ? 1 : 0 });
  }, 100, 0.45);

  useFrame((_, dt) => {
    if (!lever.current) return;
    const target = 0.15 + value.current * 0.85;
    lever.current.rotation.x += (target - lever.current.rotation.x) * Math.min(1, dt * 16);
  });

  return (
    <group position={[1.15, -0.55, 0.15]}>
      <RoundedBox args={[0.78, 0.16, 1.15]} radius={0.07} smoothness={5} position={[0, -0.55, 0.15]} receiveShadow>
        <meshStandardMaterial color="#0b0f14" metalness={0.75} roughness={0.5} />
      </RoundedBox>
      <group ref={lever}>
        <mesh position={[0, 0.3, 0]} castShadow onPointerDown={onDown}>
          <cylinderGeometry args={[0.1, 0.1, 1.2, 20]} />
          <meshStandardMaterial color="#858f9a" metalness={0.92} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.96, 0]} castShadow onPointerDown={onDown}>
          <capsuleGeometry args={[0.14, 0.38, 8, 18]} />
          <meshStandardMaterial color="#11151b" roughness={0.88} />
        </mesh>
      </group>
      <Label position={[0, -0.7, 0.8]} size={8} dim>HANDBRAKE</Label>
    </group>
  );
}

function Nitro({ settings, set }: { settings: Settings; set: Props["set"] }) {
  return (
    <group position={[1.15, -0.25, 1.55]}>
      <Pad3D
        position={[0, 0, 0]}
        size={[1.35, 0.18, 0.6]}
        glow="#a855f7"
        label="NITRO"
        vibration={settings.vibration}
        onPress={(down) => set({ nitro: down ? 1 : 0 })}
      />
    </group>
  );
}

export function WheelScene({ settings, set, press }: Props) {
  const wheel = useRef<Group>(null);
  const steer = useRef(0);
  const returning = useRef(false);
  const maxRadians = (settings.wheelRotationDeg * Math.PI) / 360;
  const { camera, size, gl } = useThree();

  const emit = useCallback(
    (raw: number) => {
      const value = applyCurve(
        Math.max(-1, Math.min(1, raw)),
        settings.deadzone,
        settings.linearity,
        settings.steerSensitivity,
      );
      steer.current = value;
      set({ steer: value });
    },
    [set, settings.deadzone, settings.linearity, settings.steerSensitivity],
  );

  useEffect(() => {
    if (settings.steerMode !== "tilt") return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0;
      emit((settings.invertTilt ? -gamma : gamma) / settings.maxTiltDeg);
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [settings.steerMode, settings.invertTilt, settings.maxTiltDeg, emit]);

  const onGrab = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const hub = new Vector3();
      wheel.current?.getWorldPosition(hub);
      hub.project(camera);
      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + ((hub.x + 1) / 2) * size.width;
      const cy = rect.top + ((1 - hub.y) / 2) * size.height;
      const angle = (x: number, y: number) => Math.atan2(y - cy, x - cx);
      let last = angle(event.nativeEvent.clientX, event.nativeEvent.clientY);
      let acc = steer.current * maxRadians;
      returning.current = false;

      const move = (ev: PointerEvent) => {
        let delta = angle(ev.clientX, ev.clientY) - last;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        last += delta;
        acc = Math.max(-maxRadians, Math.min(maxRadians, acc + delta));
        emit(acc / maxRadians);
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
    [camera, emit, gl, maxRadians, settings.autoCentre, size.height, size.width],
  );

  useFrame((_, dt) => {
    if (!wheel.current) return;
    if (returning.current && Math.abs(steer.current) > 0.002) {
      emit(steer.current * Math.exp(-4.8 * Math.min(dt, 0.05)));
    } else if (returning.current) {
      returning.current = false;
      emit(0);
    }
    const target = -steer.current * maxRadians;
    wheel.current.rotation.z += (target - wheel.current.rotation.z) * Math.min(1, dt * 20);
  });

  return (
    <group position={[0, -0.55, 0]}>
      <group position={[-2.35, 0.25, 0.1]}>
        <mesh castShadow onPointerDown={onGrab}>
          <torusGeometry args={[2.25, 0.28, 32, 96]} />
          <meshStandardMaterial color="#121519" metalness={0.22} roughness={0.9} />
        </mesh>
        <mesh castShadow>
          <torusGeometry args={[2.12, 0.1, 20, 96]} />
          <meshStandardMaterial color="#2b3036" metalness={0.18} roughness={0.7} />
        </mesh>

        {/* Deep spoke structure, intentionally without gamepad controls. */}
        {[-1, 1].map((side) => (
          <RoundedBox
            key={side}
            args={[1.85, 0.22, 0.48]}
            radius={0.09}
            smoothness={5}
            position={[side * 0.98, -0.12, 0]}
            rotation={[0, 0, side * 0.18]}
            castShadow
          >
            <meshStandardMaterial color="#262c33" metalness={0.78} roughness={0.3} />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.52, 0.22, 1.55]} radius={0.09} smoothness={5} position={[0, -0.12, -0.9]} castShadow>
          <meshStandardMaterial color="#262c33" metalness={0.78} roughness={0.3} />
        </RoundedBox>

        <mesh position={[0, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.82, 0.95, 0.28, 40]} />
          <meshStandardMaterial color="#161b21" metalness={0.78} roughness={0.34} />
        </mesh>

        <group position={[0, 0.17, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <Button3D
            position={[0, 0, 0]}
            radius={0.42}
            color="#20262d"
            glow="#fbbf24"
            label="HORN"
            labelSize={8}
            vibration={settings.vibration}
            onPress={(down) => press("horn", down)}
          />
        </group>

        <mesh position={[0, 0.17, 2.05]}>
          <boxGeometry args={[0.17, 0.2, 0.25]} />
          <meshStandardMaterial color="#1eb8ec" emissive="#1eb8ec" emissiveIntensity={2.1} />
        </mesh>
      </group>

      {/* Three-pedal unit */}
      <group position={[2.25, -0.05, 0.65]} scale={0.98}>
        <RoundedBox args={[4.5, 0.28, 3.35]} radius={0.15} smoothness={6} position={[0, -0.95, 0.25]} receiveShadow>
          <meshStandardMaterial color="#090d12" metalness={0.85} roughness={0.44} />
        </RoundedBox>
        <Pedal3D position={[-1.35, 0, 0]} label="CLUTCH" accent="#60a5fa" onChange={(v) => set({ clutch: v })} />
        <Pedal3D position={[0, 0, 0]} label="BRAKE" accent="#ef4444" onChange={(v) => set({ brake: v })} />
        <Pedal3D position={[1.35, 0, 0]} label="GAS" accent="#22c55e" onChange={(v) => set({ throttle: v })} />
      </group>

      <Handbrake3D settings={settings} set={set} />
      <Nitro settings={settings} set={set} />
    </group>
  );
}
