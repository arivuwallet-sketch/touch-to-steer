import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group, MeshStandardMaterial } from "three";
import { Button3D, Label, Pad3D, Stick3D, useAnalogPointer } from "./primitives";
import type { ControllerState, Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

/** Analog shoulder trigger that swings on a hinge as you press it. */
function Trigger3D({
  position,
  label,
  onChange,
}: {
  position: [number, number, number];
  label: string;
  onChange: (v: number) => void;
}) {
  const g = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const v = useRef(0);
  const onDown = useAnalogPointer((val) => {
    v.current = val;
    onChange(val);
  }, 90, 0.55);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 20);
    if (g.current) g.current.rotation.x += (v.current * 0.7 - g.current.rotation.x) * k;
    if (mat.current)
      mat.current.emissiveIntensity += (0.15 + v.current * 1.8 - mat.current.emissiveIntensity) * k;
  });

  return (
    <group position={position}>
      <group ref={g}>
        <RoundedBox
          args={[0.85, 0.16, 0.7]}
          radius={0.07}
          smoothness={4}
          position={[0, 0, 0.32]}
          castShadow
          onPointerDown={onDown}
        >
          <meshStandardMaterial
            ref={mat}
            color="#1e2533"
            emissive="#f97316"
            emissiveIntensity={0.15}
            metalness={0.6}
            roughness={0.3}
          />
        </RoundedBox>
        <Label position={[0, 0.16, 0.32]} size={10}>{label}</Label>
      </group>
    </group>
  );
}

export function PadScene({ settings, set, press }: Props) {
  return (
    <group position={[0, -0.2, 0]} rotation={[0.16, 0, 0]}>
      {/* main shell */}
      <RoundedBox args={[8.2, 1.0, 3.6]} radius={0.34} smoothness={6} receiveShadow castShadow>
        <meshStandardMaterial color="#28313f" metalness={0.35} roughness={0.45} />
      </RoundedBox>
      {/* grips */}
      {[-2.8, 2.8].map((x) => (
        <mesh key={x} position={[x, -0.5, 1.15]} rotation={[0.5, x > 0 ? -0.25 : 0.25, 0]} castShadow>
          <capsuleGeometry args={[0.62, 1.15, 8, 24]} />
          <meshStandardMaterial color="#212936" metalness={0.25} roughness={0.7} />
        </mesh>
      ))}
      {/* accent light bar */}
      <mesh position={[0, 0.5, -1.62]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[3.2, 0.05, 0.12]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={2.2} />
      </mesh>

      {/* shoulders + triggers */}
      <Pad3D
        position={[-2.6, 0.52, -1.5]}
        label="LB"
        vibration={settings.vibration}
        onPress={(d) => press("lb", d)}
      />
      <Pad3D
        position={[2.6, 0.52, -1.5]}
        label="RB"
        vibration={settings.vibration}
        onPress={(d) => press("rb", d)}
      />
      <Trigger3D position={[-2.6, 0.5, -2.05]} label="LT" onChange={(v) => set({ lt: v })} />
      <Trigger3D position={[2.6, 0.5, -2.05]} label="RT" onChange={(v) => set({ rt: v })} />

      {/* left stick + d-pad */}
      <Stick3D
        position={[-2.6, 0.52, -0.35]}
        label="MOVE"
        vibration={settings.vibration}
        onMove={(x, y) => set({ lx: x, ly: y })}
        onClick3={(d) => press("l3", d)}
      />
      <group position={[-1.0, 0.52, 0.95]}>
        {(
          [
            ["up", [0, 0, -0.42]],
            ["down", [0, 0, 0.42]],
            ["left", [-0.42, 0, 0]],
            ["right", [0.42, 0, 0]],
          ] as const
        ).map(([dir, p]) => (
          <Pad3D
            key={dir}
            position={p as [number, number, number]}
            size={dir === "up" || dir === "down" ? [0.38, 0.14, 0.44] : [0.44, 0.14, 0.38]}
            color="#1c2231"
            glow="#22d3ee"
            vibration={settings.vibration}
            onPress={(d) => press(`dpad_${dir}`, d)}
          />
        ))}
      </group>

      {/* centre */}
      <Button3D
        position={[-0.55, 0.52, -0.5]}
        radius={0.19}
        label="BACK"
        labelSize={8}
        vibration={settings.vibration}
        onPress={(d) => press("back", d)}
      />
      <Button3D
        position={[0.55, 0.52, -0.5]}
        radius={0.19}
        label="START"
        labelSize={8}
        vibration={settings.vibration}
        onPress={(d) => press("start", d)}
      />
      <mesh position={[0, 0.54, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.3, 32]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} />
      </mesh>

      {/* ABXY diamond */}
      <group position={[2.6, 0.52, -0.35]}>
        <Button3D position={[0, 0, -0.62]} label="Y" glow="#facc15" color="#3a3320" vibration={settings.vibration} onPress={(d) => press("y", d)} />
        <Button3D position={[-0.62, 0, 0]} label="X" glow="#60a5fa" color="#1f2c44" vibration={settings.vibration} onPress={(d) => press("x", d)} />
        <Button3D position={[0.62, 0, 0]} label="B" glow="#f87171" color="#3a2023" vibration={settings.vibration} onPress={(d) => press("b", d)} />
        <Button3D position={[0, 0, 0.62]} label="A" glow="#4ade80" color="#1e3527" vibration={settings.vibration} onPress={(d) => press("a", d)} />
      </group>

      {/* right stick */}
      <Stick3D
        position={[1.0, 0.52, 0.95]}
        label="AIM"
        vibration={settings.vibration}
        onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? -y : y })}
        onClick3={(d) => press("r3", d)}
      />
    </group>
  );
}
