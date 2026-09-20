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
  }, 105, 0.35);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 18);
    if (face.current) {
      face.current.rotation.x += (value.current * 0.12 - face.current.rotation.x) * k;
      face.current.position.z += (-value.current * 0.08 - face.current.position.z) * k;
    }
    if (material.current) {
      material.current.emissiveIntensity +=
        (0.03 + value.current * 0.5 - material.current.emissiveIntensity) * k;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.12, 1.15, 0.16]} />
        <meshStandardMaterial color="#7f8994" metalness={0.92} roughness={0.25} />
      </mesh>

      <group ref={face} rotation={[0.12, 0, 0]}>
        <RoundedBox
          args={[width, 1.25, 0.18]}
          radius={0.08}
          smoothness={5}
          position={[0, 0.56, 0.12]}
          castShadow
          onPointerDown={onDown}
        >
          <meshStandardMaterial
            ref={material}
            color="#d1d6db"
            emissive={accent}
            emissiveIntensity={0.03}
            metalness={0.82}
            roughness={0.27}
          />
        </RoundedBox>

        {[[-0.16, 0.18], [0.16, 0.18], [-0.16, 0.42], [0.16, 0.42], [-0.16, 0.66], [0.16, 0.66], [-0.16, 0.9], [0.16, 0.9]].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.23]}>
            <sphereGeometry args={[0.055, 14, 10]} />
            <meshStandardMaterial color="#30363e" roughness={0.9} />
          </mesh>
        ))}

        <Label position={[0, -0.12, 0.24]} size={9} dim>{label}</Label>
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
    const target = 0.05 + value.current * 0.7;
    lever.current.rotation.z += (target - lever.current.rotation.z) * Math.min(1, dt * 16);
  });

  return (
    <group position={[4.05, -0.95, 0.45]}>
      <RoundedBox args={[1.0, 0.24, 1.8]} radius={0.1} smoothness={5} receiveShadow>
        <meshStandardMaterial color="#090d12" metalness={0.8} roughness={0.45} />
      </RoundedBox>

      <group ref={lever}>
        <mesh position={[0, 0.65, 0]} castShadow onPointerDown={onDown}>
          <boxGeometry args={[0.16, 1.5, 0.18]} />
          <meshStandardMaterial color="#8e98a3" metalness={0.95} roughness={0.25} />
        </mesh>
        <RoundedBox
          args={[0.34, 0.5, 0.34]}
          radius={0.13}
          smoothness={6}
          position={[0, 1.4, 0]}
          castShadow
          onPointerDown={onDown}
        >
          <meshStandardMaterial color="#171b21" roughness={0.85} />
        </RoundedBox>
      </group>

      <Label position={[0, -0.38, 0.92]} size={9} dim>HANDBRAKE</Label>
    </group>
  );
}

function Nitro3D({ settings, set }: { settings: Settings; set: Props["set"] }) {
  return (
    <group position={[4.05, -1.05, -1.45]}>
      <Pad3D
        position={[0, 0, 0]}
        size={[1.35, 0.22, 0.65]}
        label="NITRO"
        glow="#a855f7"
        vibration={settings.vibration}
        onPress={(down) => set({ nitro: down ? 1 : 0 })}
      />
    </group>
  );
}

function Horn3D({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0.2, 0.1]}
      castShadow
      onPointerDown={(e) => {
        e.stopPropagation();
        press("horn", true);
        if (settings.vibration && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
      }}
      onPointerUp={() => press("horn", false)}
      onPointerCancel={() => press("horn", false)}
    >
      <cylinderGeometry args={[0.43, 0.43, 0.16, 48]} />
      <meshStandardMaterial color="#20262d" metalness={0.62} roughness={0.4} />
    </mesh>
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

  const onGrab = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();

      const hub = new Vector3();
      wheel.current?.getWorldPosition(hub);
      hub.project(camera);

      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.left + ((hub.x + 1) / 2) * size.width;
      const cy = rect.top + ((1 - hub.y) / 2) * size.height;

      const angleAt = (x: number, y: number) => Math.atan2(y - cy, x - cx);
      let last = angleAt(event.nativeEvent.clientX, event.nativeEvent.clientY);
      let accumulated = steer.current * maxRadians;
      returning.current = false;

      const move = (ev: PointerEvent) => {
        let delta = angleAt(ev.clientX, ev.clientY) - last;
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

    wheel.current.rotation.z +=
      (-steer.current * maxRadians - wheel.current.rotation.z) * Math.min(1, dt * 20);
  });

  return (
    <group position={[0, -0.6, 0]}>
      {/* Upright wheel, viewed from the driver's seat. */}
      <group ref={wheel} position={[-2.0, 0.72, 1.55]} rotation={[0, 0, 0]} scale={1.28}>
        <mesh castShadow onPointerDown={onGrab}>
          <torusGeometry args={[2.15, 0.29, 32, 96]} />
          <meshStandardMaterial color="#14181d" metalness={0.2} roughness={0.9} />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} castShadow>
          <torusGeometry args={[1.9, 0.1, 20, 96]} />
          <meshStandardMaterial color="#2d3339" metalness={0.3} roughness={0.66} />
        </mesh>

        {/* Three-spoke wheel face. */}
        <RoundedBox
          args={[1.75, 0.22, 0.48]}
          radius={0.09}
          smoothness={5}
          position={[-0.95, 0, 0]}
          rotation={[0, 0, -0.18]}
          castShadow
        >
          <meshStandardMaterial color="#262c33" metalness={0.76} roughness={0.32} />
        </RoundedBox>
        <RoundedBox
          args={[1.75, 0.22, 0.48]}
          radius={0.09}
          smoothness={5}
          position={[0.95, 0, 0]}
          rotation={[0, 0, 0.18]}
          castShadow
        >
          <meshStandardMaterial color="#262c33" metalness={0.76} roughness={0.32} />
        </RoundedBox>
        <RoundedBox
          args={[0.5, 0.22, 1.55]}
          radius={0.09}
          smoothness={5}
          position={[0, 0, -0.78]}
          castShadow
        >
          <meshStandardMaterial color="#262c33" metalness={0.76} roughness={0.32} />
        </RoundedBox>

        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.8, 0.9, 0.24, 48]} />
          <meshStandardMaterial color="#11161c" metalness={0.76} roughness={0.34} />
        </mesh>

        <Horn3D settings={settings} press={press} />
      </group>

      {/* Pedals are on the floor, below and in front of the driver. */}
      <group position={[2.35, -1.12, -0.25]}>
        <RoundedBox
          args={[4.65, 0.22, 3.1]}
          radius={0.15}
          smoothness={6}
          position={[0, -0.45, 0.15]}
          receiveShadow
        >
          <meshStandardMaterial color="#090d12" metalness={0.84} roughness={0.46} />
        </RoundedBox>

        <Pedal3D position={[-1.35, 0, 0]} label="CLUTCH" accent="#60a5fa" onChange={(v) => set({ clutch: v })} />
        <Pedal3D position={[0, 0, 0]} label="BRAKE" accent="#ef4444" onChange={(v) => set({ brake: v })} width={0.9} />
        <Pedal3D position={[1.35, 0, 0]} label="GAS" accent="#22c55e" onChange={(v) => set({ throttle: v })} />
      </group>

      <Handbrake3D settings={settings} set={set} />
      <Nitro3D settings={settings} set={set} />
    </group>
  );
}
