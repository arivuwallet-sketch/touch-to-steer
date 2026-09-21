import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { Crosshair, Gauge, Mouse as MouseIcon, RotateCcw, Wifi, Zap } from "lucide-react";
import type { Settings } from "@/lib/controller-types";

type MouseButton = "left" | "right" | "middle" | "back" | "forward";

type MouseMessage = {
  action: "move" | "button" | "wheel" | "reset";
  dx?: number;
  dy?: number;
  button?: MouseButton;
  down?: boolean;
  delta?: number;
};

type Props = {
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  sendMouse: (message: MouseMessage) => boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function rotateDelta(dx: number, dy: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

function gainFor(settings: Settings, distance: number) {
  if (!settings.mouseDynamicSensitivity) return settings.mouseSensitivity;
  const speed = clamp(distance / 22, 0, 1);
  return settings.mouseSensitivity * (1 + speed * (settings.mouseDynamicMaxMultiplier - 1));
}

export function FlatMouse({ settings, onSettingsChange, sendMouse }: Props) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number; button?: MouseButton }>());
  const pressedButtons = useRef(new Set<MouseButton>());
  const gyroBaseline = useRef<{ alpha: number; beta: number } | null>(null);
  const gyroLast = useRef<{ alpha: number; beta: number } | null>(null);
  const [gyroOn, setGyroOn] = useState(settings.mouseGyroEnabled);
  const [gyroPermission, setGyroPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [dpiFlash, setDpiFlash] = useState(false);

  const transmitMove = useCallback((dx: number, dy: number) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    const rotated = rotateDelta(dx, dy, settings.mouseRotationDeg);
    const scaled = gainFor(settings, Math.hypot(rotated.x, rotated.y));
    const x = rotated.x * scaled * (settings.mouseDpi / 1600);
    const y = rotated.y * scaled * (settings.mouseDpi / 1600) * (settings.mouseInvertY ? -1 : 1);

    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return;
    sendMouse({ action: "move", dx: Math.round(clamp(x, -32767, 32767)), dy: Math.round(clamp(y, -32767, 32767)) });
  }, [sendMouse, settings.mouseDpi, settings.mouseDynamicMaxMultiplier, settings.mouseDynamicSensitivity, settings.mouseInvertY, settings.mouseRotationDeg, settings.mouseSensitivity]);

  const releaseButtons = useCallback(() => {
    for (const button of pressedButtons.current) {
      sendMouse({ action: "button", button, down: false });
    }
    pressedButtons.current.clear();
    activePointers.current.clear();
  }, [sendMouse]);

  const buttonForPoint = useCallback((x: number, y: number): MouseButton | undefined => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return undefined;

    const nx = (x - rect.left) / rect.width;
    const ny = (y - rect.top) / rect.height;

    if (ny < 0.33) {
      if (nx < 0.46) return "left";
      if (nx > 0.54) return "right";
    }
    return undefined;
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const button = buttonForPoint(e.clientX, e.clientY);
    activePointers.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      button,
    });

    if (button && !pressedButtons.current.has(button)) {
      pressedButtons.current.add(button);
      sendMouse({ action: "button", button, down: true });
    }
  }, [buttonForPoint, sendMouse]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const prev = activePointers.current.get(e.pointerId);
    if (!prev) return;
    e.preventDefault();

    const native = e.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const events = settings.mouseSmartTracking && native.getCoalescedEvents
      ? native.getCoalescedEvents()
      : [native];

    let lastX = prev.x;
    let lastY = prev.y;

    for (const event of events) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (dx || dy) transmitMove(dx, dy);
      lastX = event.clientX;
      lastY = event.clientY;
    }

    prev.x = e.clientX;
    prev.y = e.clientY;
  }, [settings.mouseSmartTracking, transmitMove]);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const entry = activePointers.current.get(e.pointerId);
    activePointers.current.delete(e.pointerId);
    if (entry?.button) {
      pressedButtons.current.delete(entry.button);
      sendMouse({ action: "button", button: entry.button, down: false });
    }
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, [sendMouse]);

  const handleWheel = useCallback((e: WheelEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (Math.abs(e.deltaY) < 0.5) return;
    sendMouse({ action: "wheel", delta: Math.sign(e.deltaY) * -120 });
  }, [sendMouse]);

  const cycleDpi = useCallback(() => {
    const values = [400, 800, 1200, 1600, 2400, 3200, 6400, 12800, 25600, 50000];
    const index = values.findIndex((value) => value >= settings.mouseDpi);
    const next = values[(index >= 0 ? index + 1 : 0) % values.length];
    onSettingsChange({ mouseDpi: next });
    setDpiFlash(true);
    window.setTimeout(() => setDpiFlash(false), 180);
  }, [onSettingsChange, settings.mouseDpi]);

  const requestGyro = useCallback(async () => {
    try {
      const permissionApi = (window as Window & {
        DeviceOrientationEvent?: {
          requestPermission?: () => Promise<"granted" | "denied">;
        };
      }).DeviceOrientationEvent;

      if (permissionApi?.requestPermission) {
        const permission = await permissionApi.requestPermission();
        setGyroPermission(permission);
        if (permission !== "granted") {
          setGyroOn(false);
          return;
        }
      } else {
        setGyroPermission("granted");
      }

      gyroBaseline.current = null;
      gyroLast.current = null;
      setGyroOn(true);
    } catch {
      setGyroPermission("denied");
      setGyroOn(false);
    }
  }, []);

  const recenterGyro = useCallback(() => {
    gyroBaseline.current = null;
    gyroLast.current = null;
  }, []);

  useEffect(() => {
    if (!gyroOn) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.alpha !== "number" || typeof event.beta !== "number") return;

      const current = { alpha: event.alpha, beta: event.beta };
      const last = gyroLast.current;
      if (!last) {
        gyroLast.current = current;
        gyroBaseline.current = current;
        return;
      }

      const wrap = (a: number) => ((a + 540) % 360) - 180;
      const yaw = wrap(current.alpha - last.alpha);
      const pitch = current.beta - last.beta;

      gyroLast.current = current;
      if (!gyroBaseline.current) gyroBaseline.current = current;

      transmitMove(
        yaw * settings.mouseGyroSensitivity * 7,
        pitch * settings.mouseGyroSensitivity * 7,
      );
    };

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [gyroOn, settings.mouseGyroSensitivity, transmitMove]);

  useEffect(() => {
    return () => releaseButtons();
  }, [releaseButtons]);

  useEffect(() => {
    const handleWindowBlur = () => releaseButtons();
    window.addEventListener("blur", handleWindowBlur, { passive: true });
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [releaseButtons]);

  return (
    <div className="flat-mouse-root relative h-full w-full overflow-hidden bg-[#070b09] text-white">
      <div className="flat-mouse-grid absolute inset-0" />

      <header className="flat-mouse-header absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-lime-300">
            <MouseIcon className="size-4" />
            MOUSE // VIPER V4 PRO PROFILE
          </div>
          <div className="mt-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
            <span>FOCUS PRO 50K GEN-3 PROFILE</span>
            <span>•</span>
            <span>{settings.mousePollingRate.toLocaleString()} HZ TARGET</span>
            <span>•</span>
            <span className="text-lime-300">RAW EVENT PATH</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`flat-mouse-top-button ${gyroOn ? "is-active" : ""}`}
            onClick={requestGyro}
          >
            <Crosshair className="size-4" />
            GYRO {gyroPermission === "denied" ? "BLOCKED" : gyroOn ? "ON" : "OFF"}
          </button>
          <button type="button" className="flat-mouse-top-button" onClick={recenterGyro}>
            <RotateCcw className="size-4" />
            RECENTER
          </button>
        </div>
      </header>

      <div
        ref={padRef}
        className="flat-mouse-surface absolute inset-x-[5%] top-[13%] bottom-[18%] z-10 rounded-[32px] border border-lime-300/20 bg-black/35 shadow-[0_30px_80px_rgba(0,0,0,.55)]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flat-mouse-aura absolute inset-6 rounded-[24px] border border-white/5" />

        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <div className="rounded-full border border-white/10 bg-black/35 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/45">
            TOUCH + DRAG = MOUSE MOTION
          </div>
        </div>

        <div className="pointer-events-none absolute left-[12%] top-[8%] text-[9px] font-black uppercase tracking-[0.18em] text-lime-300/70">
          LEFT CLICK ZONE
        </div>
        <div className="pointer-events-none absolute right-[12%] top-[8%] text-[9px] font-black uppercase tracking-[0.18em] text-lime-300/70">
          RIGHT CLICK ZONE
        </div>

        <div className="pointer-events-none absolute inset-x-[45%] top-[8%] bottom-[7%] border-x border-white/5">
          <div className="absolute left-1/2 top-12 bottom-12 w-px -translate-x-1/2 bg-white/5" />
          <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-lime-300/15 bg-white/[0.02]" />
          <div className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/40" />
        </div>

        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-center text-[8px] font-bold uppercase tracking-[0.16em] text-white/30">
          NO APP SMOOTHING • COALESCED POINTER EVENTS • DIRECT RELATIVE INPUT
        </div>
      </div>

      <div className="flat-mouse-controls absolute inset-x-[5%] bottom-[4%] z-20 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flat-mouse-button flat-mouse-left"
            onPointerDown={(e) => {
              e.preventDefault();
              sendMouse({ action: "button", button: "back", down: true });
            }}
            onPointerUp={() => sendMouse({ action: "button", button: "back", down: false })}
          >
            <span>BACK</span>
            <small>MB4</small>
          </button>
          <button
            type="button"
            className="flat-mouse-button flat-mouse-left"
            onPointerDown={(e) => {
              e.preventDefault();
              sendMouse({ action: "button", button: "forward", down: true });
            }}
            onPointerUp={() => sendMouse({ action: "button", button: "forward", down: false })}
          >
            <span>FORWARD</span>
            <small>MB5</small>
          </button>
        </div>

        <div className="flat-mouse-center-stack">
          <button
            type="button"
            className={`flat-mouse-dpi ${dpiFlash ? "is-flash" : ""}`}
            onClick={cycleDpi}
          >
            <Gauge className="size-4" />
            <strong>{settings.mouseDpi.toLocaleString()}</strong>
            <small>DPI</small>
          </button>

          <button
            type="button"
            className="flat-mouse-wheel"
            onWheel={handleWheel}
            onPointerDown={(e) => {
              e.preventDefault();
              sendMouse({ action: "button", button: "middle", down: true });
            }}
            onPointerUp={() => sendMouse({ action: "button", button: "middle", down: false })}
          >
            <span className="flat-mouse-wheel-rib" />
            <Zap className="size-4" />
            <small>OPTICAL WHEEL</small>
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <div className="flat-mouse-feature-readout">
            <span><b>50K</b> DPI</span>
            <span><b>930</b> IPS</span>
            <span><b>90G</b></span>
            <span><b>100M</b> CLICKS</span>
          </div>
        </div>
      </div>

      <div className="absolute left-4 bottom-3 z-20 hidden text-[8px] font-bold uppercase tracking-[0.15em] text-white/30 sm:block">
        PROFILE: {settings.mouseProfile} • {settings.mouseDynamicSensitivity ? "DYNAMIC SENS ON" : "STATIC SENS"} • SMART TRACKING {settings.mouseSmartTracking ? "ON" : "OFF"}
      </div>
    </div>
  );
}
