import { useCallback, useEffect, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Vector3, type Group, type MeshStandardMaterial } from "three";
import { Label, Pad3D, useAnalogPointer } from "./primitives";
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
  width = 0.78,
}: {
  position: [number, number, number];
  label: string;
  accent: string;
  onChange: (value: number) => void;
  width?: number;
}) {
  const face = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const value = useRef(0);
  const onDown = useAnalogPointer((v) => {
    value.current = v;
    onChange(v);
  }, 100, 0.25);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 18);
    if (face.current) {
      face.current.position.z += value.current * 0.08 - face.current.position.z;
    }
    if (material.current) {
      material.current.emissiveIntensity +=
        (0.05 + value.current * 0.6 - material.current.emissiveIntensity) * k;
    }
  });

  return (
    <group position={position}>
      <RoundedBox
        args={[1.05, 0.16, 1.75]}
        radius={0.08}
        smoothness={5}
        position={[0, -0.1, 0.15]}
        receiveShadow
      >
        <meshStandardMaterial color="#0a0e13" metalness={0.82} roughness={0.48} />
      </RoundedBox>

      <group ref={face}>
        <RoundedBox
          args={[width, 1.18, 0.16]}
          radius={0.07}
          smoothness={5}
          position={[0, 0.48, -0.02]}
          castShadow
          onPointerDown={onDown}
        >
          <meshStandardMaterial
            ref={material}
            color="#cdd3d9"
            emissive={accent}
            emissiveIntensity={0.05}
            metalness={0.8}
            roughness={0.28}
          />
        </RoundedBox>

        {[-0.38, -0.13, 0.12, 0.37].map((z) => (
          <group key={z}>
            <mesh position={[-0.17, z + 0.18, 0.09]}>
              <sphereGeometry args={[0.055, 14, 10]} />
              <meshStandardMaterial color="#30363e" roughness={0.9} />
            </mesh>
            <mesh position={[0.17, z + 0.18, 0.09]}>
              <sphereGeometry args={[0.055, 14, 10]} />
              <meshStandardMaterial color="#30363e" roughness={0.9} />
            </mesh>
          </group>
        ))}
        <Label position={[0, -0.72, 0.1]} size={9} dim>{label}</Label>
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
  }, 90, 0.35);

  useFrame((_, dt) => {
    if (!lever.current) return;
    lever.current.rotation.x +=
      (0.08 + value.current * 0.7 - lever.current.rotation.x) * Math.min(1, dt * 14);
  });

  return (
    <group position={[4.1, -0.15, 1.1]}>
      <RoundedBox args={[1.05, 0.2, 1.55]} radius={0.1} smoothness={5} receiveShadow>
        <meshStandardMaterial color="#090d12" metalness={0.78} roughness={0.48} />
      </RoundedBox>

      <group ref={lever}>
        <mesh position={[0, 0.34, 0]} castShadow onPointerDown={onDown}>
          <boxGeometry args={[0.17, 1.45, 0.18]} />
          <meshStandardMaterial color="#8e98a3" metalness={0.95} roughness={0.24} />
        </mesh>
        <RoundedBox
          args={[0.34, 0.45, 0.34]}
          radius={0.12}
          smoothness={6}
          position={[0, 1.1, 0]}
          castShadow
          onPointerDown={onDown}
        >
          <meshStandardMaterial color="#141920" roughness={0.86} />
        </RoundedBox>
      </group>

      <Label position={[0, -0.18, 0.78]} size={8} dim>HANDBRAKE</Label>
    </group>
  );
}

function Nitro3D({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const onPress = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    set({ nitro: 1 });
    if (settings.vibration && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
    const up = () => {
      set({ nitro: 0 });
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <group position={[4.1, -0.35, -1.05]}>
      <RoundedBox
        args={[1.35, 0.22, 0.65]}
        radius={0.1}
        smoothness={6}
        castShadow
        onPointerDown={onPress}
      >
        <meshStandardMaterial color="#321746" emissive="#9c4dcc" emissiveIntensity={0.5} metalness={0.45} roughness={0.3} />
      </RoundedBox>
      <Label position={[0, 0.16, 0]} size={9}>NITRO</Label>
    </group>
  );
}

function Horn3D({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <group position={[0, 0.22, 0]}>
      <mesh
        castShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          press("horn", true);
          if (settings.vibration && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
        }}
        onPointerUp={() => press("horn", false)}
        onPointerCancel={() => press("horn", false)}
      >
        <cylinderGeometry args={[0.46, 0.46, 0.16, 48]} />
        <meshStandardMaterial color="#1b2027" metalness={0.6} roughness={0.4} />
      </mesh>
      <Label position={[0, 0.12, 0]} size={8}>HORN</Label>
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
    const listener = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0;
      emit((settings.invertTilt ? -gamma : gamma) / settings.maxTiltDeg);
    };
    window.addEventListener("deviceorientation", listener);
    return () => window.removeEventListener("deviceorientation", listener);
  }, [settings.steerMode, settings.invertTilt, settings.maxTiltDeg, emit]);

  const grabWheel = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();

      const hub = new Vector3();
      wheel.current?.getWorldPosition(hub);
      hub.project(camera);

      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + ((hub.x + 1) / 2) * size.width;
      const cy = rect.top + ((1 - hub.y) / 2) * size.height;

      const angleOf = (x: number, y: number) => Math.atan2(y - cy, x - cx);
      let last = angleOf(event.nativeEvent.clientX, event.nativeEvent.clientY);
      let accumulated = steer.current * maxRadians;
      returning.current = false;

      const move = (ev: PointerEvent) => {
        let delta = angleOf(ev.clientX, ev.clientY) - last;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        last += delta;
        accumulated = Math.max(-maxRadians, Math.min(maxRadians, accumulated + delta));
        emit(accumulated / maxRadians);
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
    <group position={[0, -0.6, 0]}>
      {/* Wheel: all geometry is authored in the X/Z plane for the top-down camera. */}
      <group ref={wheel} position={[-3.15, 0.7, 0]}>
        <mesh castShadow onPointerDown={grabWheel}>
          <torusGeometry args={[2.15, 0.29, 32, 96]} />
          <meshStandardMaterial color="#14181d" metalness={0.18} roughness={0.9} />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} castShadow>
          <torusGeometry args={[1.86, 0.12, 20, 96]} />
          <meshStandardMaterial color="#2c3239" metalness={0.32} roughness={0.68} />
        </mesh>

        {/* Three spokes matching the physical wheel silhouette. */}
        <RoundedBox
          args={[1.7, 0.22, 0.48]}
          radius={0.09}
          smoothness={5}
          position={[-0.95, 0, 0]}
          rotation={[0, 0, -0.18]}
          castShadow
        >
          <meshStandardMaterial color="#262c33" metalness={0.75} roughness={0.33} />
        </RoundedBox>
        <RoundedBox
          args={[1.7, 0.22, 0.48]}
          radius={0.09}
          smoothness={5}
          position={[0.95, 0, 0]}
          rotation={[0, 0, 0.18]}
          castShadow
        >
          <meshStandardMaterial color="#262c33" metalness={0.75} roughness={0.33} />
        </RoundedBox>
        <RoundedBox
          args={[0.52, 0.22, 1.65]}
          radius={0.09}
          smoothness={5}
          position={[0, 0, -0.82]}
          castShadow
        >
          <meshStandardMaterial color="#262c33" metalness={0.75} roughness={0.33} />
        </RoundedBox>

        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.82, 0.92, 0.25, 48]} />
          <meshStandardMaterial color="#11161c" metalness={0.78} roughness={0.35} />
        </mesh>

        <Horn3D settings={settings} press={press} />

        <mesh position={[0, 0.22, -2.02]}>
          <boxGeometry args={[0.18, 0.18, 0.28]} />
          <meshStandardMaterial color="#1db8ea" emissive="#1db8ea" emissiveIntensity={2.0} />
        </mesh>

        {/* Simple paddle shifter silhouettes, part of the wheel hardware. */}
        <RoundedBox args={[0.38, 0.18, 0.95]} radius={0.08} smoothness={5} position={[-1.45, 0.02, -1.58]} castShadow>
          <meshStandardMaterial color="#9aa1a8" metalness={0.88} roughness={0.28} />
        </RoundedBox>
        <RoundedBox args={[0.38, 0.18, 0.95]} radius={0.08} smoothness={5} position={[1.45, 0.02, -1.58]} castShadow>
          <meshStandardMaterial color="#9aa1a8" metalness={0.88} roughness={0.28} />
        </RoundedBox>
      </group>

      {/* Separate pedals, handbrake and nitro: no controller controls. */}
      <group position={[2.8, -0.05, 0.7]}>
        <RoundedBox args={[4.35, 0.25, 3.25]} radius={0.16} smoothness={6} position={[0, -0.35, 0.15]} receiveShadow>
          <meshStandardMaterial color="#090d12" metalness={0.84} roughness={0.46} />
        </RoundedBox>

        <Pedal3D position={[-1.3, 0.0, 0]} label="CLUTCH" accent="#60a5fa" onChange={(v) => set({ clutch: v })} />
        <Pedal3D position={[0, 0.0, 0]} label="BRAKE" accent="#ef4444" onChange={(v) => set({ brake: v })} width={0.9} />
        <Pedal3D position={[1.3, 0.0, 0]} label="GAS" accent="#22c55e" onChange={(v) => set({ throttle: v })} />
      </group>

      <Handbrake3D settings={settings} set={set} />
      <Nitro3D settings={settings} set={set} />
    </group>
  );
}
