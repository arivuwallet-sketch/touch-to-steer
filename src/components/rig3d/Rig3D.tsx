import { useCallback, useEffect, useRef } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Mode = "pad" | "wheel";
type Rect = readonly [number, number, number, number];

const PAD_SIZE = { width: 1080, height: 541, aspect: 1080 / 541 };
const WHEEL_SIZE = { width: 1080, height: 536, aspect: 1080 / 536 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function buzz(enabled: boolean, ms = 10) {
  if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

function frameRect(rect: Rect, size: { width: number; height: number }) {
  return {
    left: `${(rect[0] / size.width) * 100}%`,
    top: `${(rect[1] / size.height) * 100}%`,
    width: `${(rect[2] / size.width) * 100}%`,
    height: `${(rect[3] / size.height) * 100}%`,
  };
}

function imagePoint(
  event: React.PointerEvent,
  frame: HTMLDivElement,
  size: { width: number; height: number },
) {
  const bounds = frame.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * size.width,
    y: ((event.clientY - bounds.top) / bounds.height) * size.height,
  };
}

function HitButton({
  rect,
  size,
  label,
  vibration,
  onPress,
  onClick,
}: {
  rect: Rect;
  size: { width: number; height: number };
  label: string;
  vibration: boolean;
  onPress?: (down: boolean) => void;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        buzz(vibration);
        onPress?.(true);
      }}
      onPointerUp={() => {
        onPress?.(false);
        onClick?.();
      }}
      onPointerCancel={() => onPress?.(false)}
      className="absolute touch-none appearance-none border-0 bg-transparent p-0 outline-none"
      style={frameRect(rect, size)}
    />
  );
}

function AnalogZone({
  frameRef,
  rect,
  size,
  vibration,
  onChange,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
  rect: Rect;
  size: { width: number; height: number };
  vibration: boolean;
  onChange: (x: number, y: number) => void;
}) {
  const active = useRef(false);

  const update = (event: React.PointerEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    const p = imagePoint(event, frame, size);
    const cx = rect[0] + rect[2] / 2;
    const cy = rect[1] + rect[3] / 2;
    const rx = Math.max(1, rect[2] / 2);
    const ry = Math.max(1, rect[3] / 2);
    let x = (p.x - cx) / rx;
    let y = (p.y - cy) / ry;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    onChange(clamp(x, -1, 1), clamp(-y, -1, 1));
  };

  const end = () => {
    active.current = false;
    onChange(0, 0);
  };

  return (
    <div
      role="button"
      aria-label="Analog stick"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        active.current = true;
        buzz(vibration);
        update(event);
      }}
      onPointerMove={(event) => {
        if (active.current) update(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute touch-none"
      style={frameRect(rect, size)}
    />
  );
}

function VerticalAnalogZone({
  rect,
  size,
  vibration,
  mode,
  onChange,
}: {
  rect: Rect;
  size: { width: number; height: number };
  vibration: boolean;
  mode: "trigger" | "pedal";
  onChange: (value: number) => void;
}) {
  const active = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const update = (event: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const progress = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
    onChange(mode === "trigger" ? progress : 1 - progress);
  };

  const end = () => {
    active.current = false;
    onChange(0);
  };

  return (
    <div
      ref={ref}
      role="button"
      aria-label={mode}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        active.current = true;
        buzz(vibration);
        update(event);
      }}
      onPointerMove={(event) => {
        if (active.current) update(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute touch-none"
      style={frameRect(rect, size)}
    />
  );
}

function SteeringZone({
  frameRef,
  rect,
  size,
  vibration,
  maxRotationDeg,
  autoCentre,
  onSteer,
  requestTiltPermission,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
  rect: Rect;
  size: { width: number; height: number };
  vibration: boolean;
  maxRotationDeg: number;
  autoCentre: boolean;
  onSteer: (value: number) => void;
  requestTiltPermission: () => void;
}) {
  const drag = useRef<{ last: number; accumulated: number } | null>(null);
  const current = useRef(0);
  const maxRadians = (maxRotationDeg * Math.PI) / 360;

  const emit = useCallback(
    (raw: number) => {
      const value = applyCurve(clamp(raw, -1, 1), 0.05, 1.2, 1);
      current.current = value;
      onSteer(value);
    },
    [onSteer],
  );

  const angleAt = (event: React.PointerEvent) => {
    const frame = frameRef.current;
    if (!frame) return 0;
    const p = imagePoint(event, frame, size);
    const cx = rect[0] + rect[2] / 2;
    const cy = rect[1] + rect[3] / 2;
    return Math.atan2(p.y - cy, p.x - cx);
  };

  return (
    <div
      role="button"
      aria-label="Steering wheel"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        buzz(vibration);
        requestTiltPermission();
        if (!frameRef.current) return;
        drag.current = {
          last: angleAt(event),
          accumulated: current.current * maxRadians,
        };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const next = angleAt(event);
        let delta = next - drag.current.last;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        drag.current.last = next;
        drag.current.accumulated = clamp(
          drag.current.accumulated + delta,
          -maxRadians,
          maxRadians,
        );
        emit(drag.current.accumulated / maxRadians);
      }}
      onPointerUp={() => {
        drag.current = null;
        if (autoCentre) emit(0);
      }}
      onPointerCancel={() => {
        drag.current = null;
        if (autoCentre) emit(0);
      }}
      className="absolute touch-none"
      style={frameRect(rect, size)}
    />
  );
}

export default function Rig3D({
  mode,
  settings,
  set,
  press,
  onOpenSettings,
  onModeToggle,
  connectionStatus,
  onConnectToggle,
}: {
  mode: Mode;
  settings: Settings;
  set: (patch: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
  onOpenSettings: () => void;
  onModeToggle: () => void;
  connectionStatus?: "idle" | "connecting" | "connected" | "error";
  onConnectToggle?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  const emitStick = useCallback(
    (left: boolean, x: number, y: number) => {
      const sx = applyCurve(x, settings.deadzone, settings.linearity, settings.sensitivity);
      const sy = applyCurve(y, settings.deadzone, settings.linearity, settings.sensitivity);
      if (left) set({ lx: sx, ly: sy });
      else set({ rx: sx, ry: settings.invertLookY ? -sy : sy });
    },
    [
      set,
      settings.deadzone,
      settings.linearity,
      settings.sensitivity,
      settings.invertLookY,
    ],
  );

  const steerRef = useRef(0);

  const setSteer = useCallback((value: number) => {
    steerRef.current = value;
    set({ steer: value });
  }, [set]);

  useEffect(() => {
    if (mode !== "wheel" || settings.steerMode !== "tilt") return;

    const handler = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0;
      const raw = (settings.invertTilt ? -gamma : gamma) / Math.max(1, settings.maxTiltDeg);
      const curved = applyCurve(
        clamp(raw, -1, 1),
        settings.deadzone,
        settings.linearity,
        settings.steerSensitivity,
      );
      steerRef.current = curved;
      set({ steer: curved });
    };

    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, [
    mode,
    set,
    settings.deadzone,
    settings.invertTilt,
    settings.linearity,
    settings.maxTiltDeg,
    settings.steerMode,
    settings.steerSensitivity,
  ]);

  const requestTiltPermission = useCallback(() => {
    if (settings.steerMode !== "tilt" || typeof window === "undefined") return;
    const orientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof orientation.requestPermission === "function") {
      void orientation.requestPermission().catch(() => undefined);
    }
  }, [settings.steerMode]);

  const size = mode === "pad" ? PAD_SIZE : WHEEL_SIZE;

  return (
    <div className="grid h-full w-full place-items-center overflow-hidden bg-black">
      <div
        ref={frameRef}
        className="relative shrink-0 overflow-hidden"
        style={{
          width: `min(100vw, ${size.aspect * 100}dvh)`,
          aspectRatio: `${size.width} / ${size.height}`,
        }}
      >
        <img
          src={mode === "pad" ? "/rig-skins/gamepad-mode.webp" : "/rig-skins/steering-wheel-mode.webp"}
          alt={mode === "pad" ? "Gamepad controller" : "Steering wheel controller"}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-fill"
        />

        {mode === "pad" ? (
          <>
            <HitButton rect={[112, 117, 94, 52]} size={size} label="LB" vibration={settings.vibration} onPress={(d) => press("lb", d)} />
            <VerticalAnalogZone rect={[219, 88, 61, 110]} size={size} vibration={settings.vibration} mode="trigger" onChange={(v) => set({ lt: v })} />
            <VerticalAnalogZone rect={[795, 88, 61, 110]} size={size} vibration={settings.vibration} mode="trigger" onChange={(v) => set({ rt: v })} />
            <HitButton rect={[872, 117, 91, 54]} size={size} label="RB" vibration={settings.vibration} onPress={(d) => press("rb", d)} />

            <AnalogZone
              frameRef={frameRef}
              rect={[92, 229, 139, 139]}
              size={size}
              vibration={settings.vibration}
              onChange={(x, y) => emitStick(true, x, y)}
            />
            {([
              ["up", [300, 322, 81, 37] as Rect],
              ["down", [300, 390, 81, 37] as Rect],
              ["left", [292, 347, 43, 61] as Rect],
              ["right", [379, 347, 43, 61] as Rect],
            ] as const).map(([dir, rect]) => (
              <HitButton
                key={dir}
                rect={rect}
                size={size}
                label={`D-pad ${dir}`}
                vibration={settings.vibration}
                onPress={(d) => press(`dpad_${dir}`, d)}
              />
            ))}

            <HitButton rect={[447, 362, 58, 61]} size={size} label="Back" vibration={settings.vibration} onPress={(d) => press("back", d)} />
            <HitButton rect={[574, 362, 60, 61]} size={size} label="Start" vibration={settings.vibration} onPress={(d) => press("start", d)} />

            <AnalogZone
              frameRef={frameRef}
              rect={[660, 311, 132, 132]}
              size={size}
              vibration={settings.vibration}
              onChange={(x, y) => emitStick(false, x, y)}
            />

            <HitButton rect={[882, 215, 67, 62]} size={size} label="Y" vibration={settings.vibration} onPress={(d) => press("y", d)} />
            <HitButton rect={[833, 261, 64, 62]} size={size} label="X" vibration={settings.vibration} onPress={(d) => press("x", d)} />
            <HitButton rect={[933, 261, 66, 62]} size={size} label="B" vibration={settings.vibration} onPress={(d) => press("b", d)} />
            <HitButton rect={[882, 311, 67, 64]} size={size} label="A" vibration={settings.vibration} onPress={(d) => press("a", d)} />

            <HitButton rect={[194, 428, 95, 42]} size={size} label="Left stick click" vibration={settings.vibration} onPress={(d) => press("l3", d)} />
            <HitButton rect={[794, 428, 91, 42]} size={size} label="Right stick click" vibration={settings.vibration} onPress={(d) => press("r3", d)} />
            <HitButton rect={[973, 41, 60, 61]} size={size} label="Settings" vibration={settings.vibration} onClick={onOpenSettings} />
            <HitButton rect={[966, 421, 68, 69]} size={size} label="Change controller mode" vibration={settings.vibration} onClick={onModeToggle} />
          </>
        ) : (
          <>
            <HitButton rect={[69, 49, 77, 44]} size={size} label="Menu" vibration={settings.vibration} onClick={onOpenSettings} />
            <HitButton rect={[154, 44, 54, 55]} size={size} label="Nitro" vibration={settings.vibration} onPress={(d) => set({ nitro: d ? 1 : 0 })} />
            <HitButton rect={[220, 44, 56, 55]} size={size} label="Lights" vibration={settings.vibration} onPress={(d) => press("lights", d)} />
            <HitButton rect={[281, 43, 57, 57]} size={size} label="Camera" vibration={settings.vibration} onPress={(d) => press("look", d)} />

            {(["4", "5", "6"] as const).map((key, index) => (
              <HitButton
                key={key}
                rect={[[427, 48, 68, 36], [503, 48, 70, 36], [578, 48, 71, 36]][index] as Rect}
                size={size}
                label={key}
                vibration={settings.vibration}
                onPress={(d) => press(`m${key}`, d)}
              />
            ))}

            <HitButton
              rect={[840, 45, 58, 53]}
              size={size}
              label={connectionStatus === "connected" ? "Disconnect" : "Connect"}
              vibration={settings.vibration}
              onClick={onConnectToggle}
            />
            <HitButton rect={[909, 44, 61, 55]} size={size} label="Map" vibration={settings.vibration} onPress={(d) => press("map", d)} />
            <HitButton rect={[968, 43, 61, 59]} size={size} label="Settings" vibration={settings.vibration} onClick={onOpenSettings} />

            <SteeringZone
              frameRef={frameRef}
              rect={[91, 286, 194, 179]}
              size={size}
              vibration={settings.vibration}
              maxRotationDeg={settings.wheelRotationDeg}
              autoCentre={settings.autoCentre}
              onSteer={setSteer}
              requestTiltPermission={requestTiltPermission}
            />

            <HitButton rect={[447, 366, 51, 52]} size={size} label="Previous" vibration={settings.vibration} onPress={(d) => press("back", d)} />
            <HitButton rect={[503, 366, 74, 48]} size={size} label="Enter" vibration={settings.vibration} onPress={(d) => press("home", d)} />
            <HitButton rect={[579, 366, 51, 52]} size={size} label="Next" vibration={settings.vibration} onPress={(d) => press("start", d)} />

            {(["1", "2", "3"] as const).map((key, index) => (
              <HitButton
                key={key}
                rect={[[427, 420, 68, 39], [503, 420, 71, 39], [578, 420, 71, 39]][index] as Rect}
                size={size}
                label={key}
                vibration={settings.vibration}
                onPress={(d) => press(`m${key}`, d)}
              />
            ))}

            <HitButton rect={[687, 419, 60, 57]} size={size} label="Change controller mode" vibration={settings.vibration} onClick={onModeToggle} />

            <VerticalAnalogZone
              rect={[835, 344, 78, 151]}
              size={size}
              vibration={settings.vibration}
              mode="pedal"
              onChange={(v) => set({ brake: v })}
            />
            <VerticalAnalogZone
              rect={[946, 303, 62, 185]}
              size={size}
              vibration={settings.vibration}
              mode="pedal"
              onChange={(v) => set({ throttle: v })}
            />

            <HitButton
              rect={[941, 162, 73, 78]}
              size={size}
              label="Handbrake"
              vibration={settings.vibration}
              onPress={(d) => set({ handbrake: d ? 1 : 0 })}
            />
          </>
        )}
      </div>
    </div>
  );
}
