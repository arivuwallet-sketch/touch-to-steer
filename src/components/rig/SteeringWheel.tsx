import { useEffect, useRef, useState } from "react";
import { applyCurve, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  onSteer: (v: number) => void;
};

/**
 * Steering wheel with two input modes:
 *  - tilt: uses device orientation (gamma) like a real wheel held flat
 *  - touch: drag/rotate the wheel with one or two fingers
 */
export function SteeringWheel({ settings, onSteer }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [angle, setAngle] = useState(0);
  const [tiltReady, setTiltReady] = useState(false);
  const zeroRef = useRef<number | null>(null);
  const dragRef = useRef<{ start: number; base: number } | null>(null);
  const rafRef = useRef(0);

  const emit = (raw: number) => {
    const v = applyCurve(raw, settings.deadzone, settings.linearity, settings.steerSensitivity);
    onSteer(v);
    setAngle(v * 140);
  };

  // --- tilt mode -----------------------------------------------------------
  useEffect(() => {
    if (settings.steerMode !== "tilt") return;
    const handler = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      if (zeroRef.current === null) zeroRef.current = g;
      const delta = (g - zeroRef.current) * (settings.invertTilt ? -1 : 1);
      const raw = Math.max(-1, Math.min(1, delta / settings.maxTiltDeg));
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => emit(raw));
      setTiltReady(true);
    };
    window.addEventListener("deviceorientation", handler);
    return () => {
      window.removeEventListener("deviceorientation", handler);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const enableTilt = async () => {
    const AnyOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof AnyOrientation.requestPermission === "function") {
      try {
        await AnyOrientation.requestPermission();
      } catch {
        /* user declined */
      }
    }
    zeroRef.current = null;
  };

  // --- touch mode ----------------------------------------------------------
  const angleFromTouch = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (settings.steerMode !== "touch") return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { start: angleFromTouch(e.clientX, e.clientY), base: angle };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    let delta = angleFromTouch(e.clientX, e.clientY) - dragRef.current.start;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const deg = Math.max(-140, Math.min(140, dragRef.current.base + delta));
    emit(deg / 140);
  };

  const onPointerUp = () => {
    dragRef.current = null;
    if (settings.autoCentre) emit(0);
  };

  const showCalibrate = settings.steerMode === "tilt";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative size-52 touch-none rounded-full sm:size-64"
        style={{ background: "var(--gradient-rim)", boxShadow: "var(--shadow-panel)" }}
      >
        <div
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="absolute inset-[7%] rounded-full border-[10px] border-secondary bg-card/60" />
          {/* spokes */}
          <div className="absolute left-1/2 top-1/2 h-3 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary" />
          <div className="absolute left-1/2 top-1/2 h-[38%] w-3 -translate-x-1/2 rounded-full bg-secondary" />
          <div className="absolute left-1/2 top-1/2 size-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-card glow" />
          {/* 12 o'clock marker */}
          <div className="absolute left-1/2 top-[8%] h-6 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
        </div>
      </div>
      {showCalibrate && (
        <button
          onClick={enableTilt}
          className="rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-secondary-foreground active:bg-muted"
        >
          {tiltReady ? "Re-centre tilt" : "Enable tilt"}
        </button>
      )}
    </div>
  );
}
