import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { Crosshair, Gauge, RotateCcw, ScrollText } from "lucide-react";
import type { Settings } from "@/lib/controller-types";

type MouseButton = "left" | "right" | "middle" | "back" | "forward";

type MouseMessage = {
  action: "move" | "button" | "wheel" | "reset" | "center";
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

type MotionEventWithRate = DeviceMotionEvent & {
  rotationRate: DeviceMotionEvent["rotationRate"] | null;
};

type PermissionDeviceMotion = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type PermissionDeviceOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// Gyro aiming is tuned for a TV-style air-mouse feel: direct angular motion,
 // high initial gain, and acceleration at faster wrist turns.
const MOTION_X_BASE_PIXELS_PER_DEGREE = 19;
const MOTION_X_MAX_PIXELS_PER_DEGREE = 48;
const MOTION_Y_BASE_PIXELS_PER_DEGREE = 27;
const MOTION_Y_MAX_PIXELS_PER_DEGREE = 62;
const ORIENTATION_X_BASE_PIXELS_PER_DEGREE = 17;
const ORIENTATION_Y_BASE_PIXELS_PER_DEGREE = 23;
const GYRO_DEADZONE_DEG_PER_SEC = 0.12;

function rotateDelta(dx: number, dy: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

function gainFor(settings: Settings, distance: number) {
  if (!settings.mouseDynamicSensitivity) return settings.mouseSensitivity;
  const speed = clamp(distance / 18, 0, 1);
  return settings.mouseSensitivity * (1 + speed * (settings.mouseDynamicMaxMultiplier - 1));
}

function phoneFeedback() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* haptics unavailable */
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2100, ctx.currentTime);
    gain.gain.setValueAtTime(0.014, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.018);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.018);
    void ctx.close().catch(() => undefined);
  } catch {
    /* optional audio feedback */
  }
}

export function FlatMouse({ settings, onSettingsChange, sendMouse }: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const activePointers = useRef(
    new Map<number, { x: number; y: number; button?: MouseButton }>(),
  );
  const pressedButtons = useRef(new Set<MouseButton>());
  const pointerButtonRefs = useRef(new Set<number>());
  const lastMotionSample = useRef(0);
  const lastOrientation = useRef<{ beta: number; gamma: number } | null>(null);
  const [gyroOn, setGyroOn] = useState(settings.mouseGyroEnabled);
  const [gyroPermission, setGyroPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [pressed, setPressed] = useState<MouseButton | null>(null);
  const [dpiFlash, setDpiFlash] = useState(false);

  useEffect(() => {
    setGyroOn(settings.mouseGyroEnabled);
  }, [settings.mouseGyroEnabled]);

  const transmitMove = useCallback(
    (dx: number, dy: number) => {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

      const rotated = rotateDelta(dx, dy, settings.mouseRotationDeg);
      const scaled = gainFor(settings, Math.hypot(rotated.x, rotated.y));
      const x = rotated.x * scaled * (settings.mouseDpi / 1600);
      const y =
        rotated.y *
        scaled *
        (settings.mouseDpi / 1600) *
        (settings.mouseInvertY ? -1 : 1);

      if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return;

      sendMouse({
        action: "move",
        dx: Math.round(clamp(x, -32767, 32767)),
        dy: Math.round(clamp(y, -32767, 32767)),
      });
    },
    [
      sendMouse,
      settings.mouseDpi,
      settings.mouseDynamicMaxMultiplier,
      settings.mouseDynamicSensitivity,
      settings.mouseInvertY,
      settings.mouseRotationDeg,
      settings.mouseSensitivity,
    ],
  );

  const setMouseButton = useCallback(
    (button: MouseButton, down: boolean) => {
      if (down) {
        pressedButtons.current.add(button);
        setPressed(button);
        phoneFeedback();
      } else {
        pressedButtons.current.delete(button);
        setPressed((current) => (current === button ? null : current));
      }
      sendMouse({ action: "button", button, down });
    },
    [sendMouse],
  );

  const releaseButtons = useCallback(() => {
    for (const button of pressedButtons.current) {
      sendMouse({ action: "button", button, down: false });
    }
    pressedButtons.current.clear();
    activePointers.current.clear();
    pointerButtonRefs.current.clear();
    setPressed(null);
  }, [sendMouse]);

  const hitTest = useCallback((clientX: number, clientY: number): MouseButton | undefined => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return undefined;

    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;

    if (ny <= 0.42) {
      if (nx < 0.485) return "left";
      if (nx > 0.515) return "right";
    }

    if (nx < 0.12 && ny > 0.34 && ny < 0.62) return "back";
    if (nx < 0.12 && ny >= 0.62 && ny < 0.77) return "forward";

    return undefined;
  }, []);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);

      const button = hitTest(e.clientX, e.clientY);
      activePointers.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        button,
      });

      if (button) {
        pointerButtonRefs.current.add(e.pointerId);
        if (!pressedButtons.current.has(button)) setMouseButton(button, true);
      }
    },
    [hitTest, setMouseButton],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const previous = activePointers.current.get(e.pointerId);
      if (!previous) return;
      e.preventDefault();

      const native = e.nativeEvent as PointerEvent & {
        getCoalescedEvents?: () => PointerEvent[];
      };
      const events =
        settings.mouseSmartTracking && native.getCoalescedEvents
          ? native.getCoalescedEvents()
          : [native];

      let lastX = previous.x;
      let lastY = previous.y;

      for (const event of events) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (dx || dy) transmitMove(dx, dy);
        lastX = event.clientX;
        lastY = event.clientY;
      }

      previous.x = e.clientX;
      previous.y = e.clientY;
    },
    [settings.mouseSmartTracking, transmitMove],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const previous = activePointers.current.get(e.pointerId);
      activePointers.current.delete(e.pointerId);

      if (previous?.button && pointerButtonRefs.current.has(e.pointerId)) {
        pointerButtonRefs.current.delete(e.pointerId);
        setMouseButton(previous.button, false);
      }

      e.currentTarget.releasePointerCapture?.(e.pointerId);
    },
    [setMouseButton],
  );

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > 0.5 ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 0.5) return;
      sendMouse({ action: "wheel", delta: Math.sign(delta) * -120 });
      phoneFeedback();
    },
    [sendMouse],
  );

  const cycleDpi = useCallback(() => {
    const values = [400, 800, 1200, 1600, 2400, 3200, 6400, 12800, 25600, 50000];
    const index = values.findIndex((value) => value >= settings.mouseDpi);
    const next = values[(index >= 0 ? index + 1 : 0) % values.length];
    onSettingsChange({ mouseDpi: next });
    setDpiFlash(true);
    phoneFeedback();
    window.setTimeout(() => setDpiFlash(false), 180);
  }, [onSettingsChange, settings.mouseDpi]);

  const requestGyro = useCallback(async () => {
    try {
      const motionApi = window.DeviceMotionEvent as PermissionDeviceMotion | undefined;
      const orientationApi =
        window.DeviceOrientationEvent as PermissionDeviceOrientation | undefined;

      if (motionApi?.requestPermission) {
        const permission = await motionApi.requestPermission();
        if (permission !== "granted") {
          setGyroPermission("denied");
          setGyroOn(false);
          return;
        }
      }

      if (orientationApi?.requestPermission) {
        const permission = await orientationApi.requestPermission();
        if (permission !== "granted") {
          setGyroPermission("denied");
          setGyroOn(false);
          return;
        }
      }

      lastMotionSample.current = 0;
      lastOrientation.current = null;
      setGyroPermission("granted");
      setGyroOn(true);
      onSettingsChange({ mouseGyroEnabled: true });
      phoneFeedback();
    } catch {
      setGyroPermission("denied");
      setGyroOn(false);
      onSettingsChange({ mouseGyroEnabled: false });
    }
  }, [onSettingsChange]);

  const disableGyro = useCallback(() => {
    setGyroOn(false);
    setGyroPermission("unknown");
    lastMotionSample.current = 0;
    lastOrientation.current = null;
    onSettingsChange({ mouseGyroEnabled: false });
  }, [onSettingsChange]);

  const recenterGyro = useCallback(() => {
    lastMotionSample.current = 0;
    lastOrientation.current = null;

    // Synchronize the phone's physical mouse center with the PC cursor.
    // The bridge moves the native Windows cursor to the primary display
    // center, giving the next gyro movement a deterministic origin.
    sendMouse({ action: "center" });

    phoneFeedback();
  }, [sendMouse]);

  useEffect(() => {
    if (!gyroOn) return;

    const handleMotion = (event: MotionEventWithRate) => {
      const rate = event.rotationRate;
      if (!rate) return;

      const beta = Number(rate.beta) || 0;
      const gamma = Number(rate.gamma) || 0;

      const angularSpeed = Math.hypot(beta, gamma);
      if (angularSpeed < GYRO_DEADZONE_DEG_PER_SEC) return;

      const now = performance.now();
      const previous = lastMotionSample.current;
      lastMotionSample.current = now;

      // Use the real elapsed sensor interval. The old 33 ms ceiling discarded
      // motion during slower mobile deliveries and made pitch feel delayed.
      const dt = previous > 0
        ? clamp((now - previous) / 1000, 0.004, 0.080)
        : 1 / 60;

      // Separate axes: horizontal stays controlled while pitch receives
      // extra authority so small upward/downward wrist turns track instantly.
      const xAcceleration = 1 + clamp(Math.abs(gamma) / 85, 0, 1) * 1.15;
      const yAcceleration = 1 + clamp(Math.abs(beta) / 65, 0, 1) * 1.25;

      const xPixelsPerDegree =
        clamp(
          MOTION_X_BASE_PIXELS_PER_DEGREE * xAcceleration,
          MOTION_X_BASE_PIXELS_PER_DEGREE,
          MOTION_X_MAX_PIXELS_PER_DEGREE,
        ) * settings.mouseGyroSensitivity;

      const yPixelsPerDegree =
        clamp(
          MOTION_Y_BASE_PIXELS_PER_DEGREE * yAcceleration,
          MOTION_Y_BASE_PIXELS_PER_DEGREE,
          MOTION_Y_MAX_PIXELS_PER_DEGREE,
        ) * settings.mouseGyroSensitivity;

      // Portrait air-mouse mapping.
      // Flip X to match the phone's physical right/left motion; keep Y
      // direct so pitching the phone upward moves the pointer upward.
      transmitMove(
        -gamma * dt * xPixelsPerDegree,
        beta * dt * yPixelsPerDegree,
      );
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (
        lastMotionSample.current > 0 &&
        performance.now() - lastMotionSample.current < 120
      ) {
        return;
      }

      if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;

      const current = { beta: event.beta, gamma: event.gamma };
      const previous = lastOrientation.current;
      lastOrientation.current = current;
      if (!previous) return;

      const dx = clamp(current.gamma - previous.gamma, -8, 8);
      const dy = clamp(current.beta - previous.beta, -8, 8);
      const distance = Math.hypot(dx, dy);
      if (distance < 0.025) return;

      const acceleration = 1 + clamp(distance / 5.5, 0, 1) * 0.65;
      const xPixelsPerDegree =
        ORIENTATION_X_BASE_PIXELS_PER_DEGREE * acceleration * settings.mouseGyroSensitivity;
      const yPixelsPerDegree =
        ORIENTATION_Y_BASE_PIXELS_PER_DEGREE * acceleration * settings.mouseGyroSensitivity;

      transmitMove(
        -dx * xPixelsPerDegree,
        dy * yPixelsPerDegree,
      );
    };

    window.addEventListener("devicemotion", handleMotion, { passive: true });
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    window.addEventListener("deviceorientationabsolute", handleOrientation, { passive: true });

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
    };
  }, [gyroOn, settings.mouseGyroSensitivity, transmitMove]);

  useEffect(() => {
    return () => releaseButtons();
  }, [releaseButtons]);

  useEffect(() => {
    const onBlur = () => releaseButtons();
    window.addEventListener("blur", onBlur, { passive: true });
    window.addEventListener("pagehide", onBlur, { passive: true });
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onBlur);
    };
  }, [releaseButtons]);

  return (
    <div className="flat-mouse-root relative flex h-full w-full items-center justify-center overflow-hidden text-white">
      <div className="flat-mouse-grid absolute inset-0" />

      <div className="flat-mouse-topbar absolute left-1/2 top-[max(10px,env(safe-area-inset-top))] z-30 -translate-x-1/2">
        <span>VIPER V4 PRO</span>
        <b>{settings.mouseDpi.toLocaleString()} DPI</b>
        <i>{gyroOn ? "GYRO" : "TOUCH"}</i>
      </div>

      <div className="flat-mouse-stage absolute inset-0 flex items-center justify-center">
        <div className="flat-mouse-viper-wrap">
          <div className="flat-mouse-side-button-visual flat-mouse-side-button-back" />
          <div className="flat-mouse-side-button-visual flat-mouse-side-button-forward" />

          <div
            ref={shellRef}
            className={`flat-mouse-viper ${pressed ? "is-clicking" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <div className="flat-mouse-shell-shadow" />

            <div className={`flat-mouse-main-click flat-mouse-main-left ${pressed === "left" ? "is-pressed" : ""}`}>
              <span className="flat-mouse-click-caption">LMB</span>
            </div>
            <div className={`flat-mouse-main-click flat-mouse-main-right ${pressed === "right" ? "is-pressed" : ""}`}>
              <span className="flat-mouse-click-caption">RMB</span>
            </div>

            <div className="flat-mouse-center-channel">
              <div className="flat-mouse-aim-center" aria-hidden="true">
                <span />
                <i>0</i>
              </div>
              <div className="flat-mouse-status-light" />
              <div className={`flat-mouse-scroll-wheel ${pressed === "middle" ? "is-pressed" : ""}`}>
                <span className="flat-mouse-scroll-ribs" />
              </div>
              <small>OPTICAL</small>
            </div>

            <div className="flat-mouse-seam" />
            <div className="flat-mouse-viper-logo">RAZER</div>
            <div className="flat-mouse-spec">FOCUS PRO 50K GEN-3</div>
          </div>
        </div>
      </div>

      <div className="flat-mouse-bottom-ui absolute inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-30">
        <div className="flat-mouse-toolbar">
          <button
            type="button"
            className={`flat-mouse-control ${dpiFlash ? "is-flash" : ""}`}
            onClick={cycleDpi}
          >
            <Gauge />
            <strong>{settings.mouseDpi.toLocaleString()}</strong>
            <small>DPI</small>
          </button>

          <button
            type="button"
            className={`flat-mouse-control ${gyroOn ? "is-active" : ""}`}
            onClick={gyroOn ? disableGyro : requestGyro}
          >
            <Crosshair />
            <strong>GYRO</strong>
            <small>{gyroPermission === "denied" ? "BLOCKED" : gyroOn ? "ON" : "OFF"}</small>
          </button>

          <button type="button" className="flat-mouse-control" onClick={recenterGyro}>
            <RotateCcw />
            <strong>RECENTER</strong>
            <small>AIR AIM</small>
          </button>

          <button type="button" className="flat-mouse-control" onWheel={handleWheel}>
            <ScrollText />
            <strong>WHEEL</strong>
            <small>SCROLL</small>
          </button>
        </div>

        <div className="flat-mouse-help">
          <span>DRAG BODY = MOVE</span>
          <span>LMB / RMB = CLICK</span>
          <span>LEFT EDGE = MB4 / MB5</span>
        </div>
      </div>
    </div>
  );
}
