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

type PermissionDeviceOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function rotateDelta(dx: number, dy: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

// --- Absolute "point where the phone points" air mouse (LG Magic Remote /
// Wiimote style) -------------------------------------------------------
//
// Earlier versions drove the pointer from devicemotion.rotationRate
// (angular *velocity*, integrated every frame) and, in parallel, from raw
// deviceorientation beta/gamma *deltas*. Two independent handlers were
// both live at once on devices that fire both events, and raw beta/gamma
// channels cross-talk once the phone isn't held at the exact reference
// attitude (tilting "up" bleeds into the gamma channel and vice versa) --
// together that produced the "moves on its own axis" / wrong-axis reports.
//
// This replaces both with one pipeline: convert each deviceorientation
// sample into a quaternion, measure the angle between the phone's current
// "pointing" direction and a calibrated center (set when gyro turns on and
// whenever CENTER SYNC is pressed), and drive the cursor to the absolute
// screen offset that angle implies. Holding the phone still holds the
// pointer still; only the phone's current attitude relative to center
// matters, not how fast it moved to get there.
type Quat = { x: number; y: number; z: number; w: number };

const POINT_BASE_PIXELS_PER_DEGREE = 42;
const POINT_MAX_PIXELS_PER_DEGREE = 140;
const POINT_DEADZONE_DEG = 0.05;
// Low-pass factor applied to the absolute angle (not a delta), so sensor
// jitter doesn't wobble the pointer while still tracking real motion with
// only a few milliseconds of filter lag.
const POINT_SMOOTHING = 0.35;

function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function rotateVector(q: Quat, v: { x: number; y: number; z: number }) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/**
 * DeviceOrientation (alpha/beta/gamma, degrees) -> quaternion, following the
 * W3C worked-example intrinsic Z-X'-Y'' composition, then re-expressed so
 * "forward" is -Z (the convention `pointingAngles` below reads back out).
 * Also compensates for the device's current screen angle so the mapping is
 * correct even on tablets/phones whose natural orientation isn't portrait.
 */
function quatFromDeviceOrientation(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
): Quat {
  const alpha = (alphaDeg * Math.PI) / 180;
  const beta = (betaDeg * Math.PI) / 180;
  const gamma = (gammaDeg * Math.PI) / 180;
  const orient = (screenAngleDeg * Math.PI) / 180;

  const cX = Math.cos(beta / 2);
  const cY = Math.cos(gamma / 2);
  const cZ = Math.cos(alpha / 2);
  const sX = Math.sin(beta / 2);
  const sY = Math.sin(gamma / 2);
  const sZ = Math.sin(alpha / 2);

  const w = cX * cY * cZ - sX * sY * sZ;
  const x = sX * cY * cZ - cX * sY * sZ;
  const y = cX * sY * cZ + sX * cY * sZ;
  const z = cX * cY * sZ + sX * sY * cZ;

  let q: Quat = quatMultiply({ x, y, z, w }, { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 });

  if (orient) {
    q = quatMultiply(q, { x: 0, y: 0, z: -Math.sin(orient / 2), w: Math.cos(orient / 2) });
  }

  return q;
}

function currentScreenAngle(): number {
  const so = (screen as Screen & { orientation?: { angle?: number } }).orientation;
  if (so && typeof so.angle === "number") return so.angle;
  const legacy = (window as Window & { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

/** Yaw/pitch (degrees) of `currentQuat`'s pointing direction relative to `referenceQuat`. */
function pointingAngles(referenceQuat: Quat, currentQuat: Quat) {
  const relative = quatMultiply(quatConjugate(referenceQuat), currentQuat);
  const forward = rotateVector(relative, { x: 0, y: 0, z: -1 });
  const yaw = (Math.atan2(forward.x, -forward.z) * 180) / Math.PI;
  const pitch = (Math.asin(clamp(forward.y, -1, 1)) * 180) / Math.PI;
  return { yaw, pitch };
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
  const activePointers = useRef(new Map<number, { x: number; y: number; button?: MouseButton }>());
  const pressedButtons = useRef(new Set<MouseButton>());
  const pointerButtonRefs = useRef(new Set<number>());
  /** Calibrated "straight ahead" attitude — set on gyro enable and on CENTER SYNC. */
  const referenceQuatRef = useRef<Quat | null>(null);
  /** Most recent device attitude, cached so CENTER SYNC can recalibrate instantly. */
  const latestQuatRef = useRef<Quat | null>(null);
  /** Absolute pixel offset from center already sent to the PC, so we can send deltas. */
  const pointerOffsetRef = useRef({ x: 0, y: 0 });
  const smoothedAngleRef = useRef({ yaw: 0, pitch: 0 });
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
      const x = rotated.x * scaled * (settings.mouseDpi / 1600) * (settings.mouseInvertX ? -1 : 1);
      const y = rotated.y * scaled * (settings.mouseDpi / 1600) * (settings.mouseInvertY ? -1 : 1);

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
      settings.mouseInvertX,
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
      const orientationApi = window.DeviceOrientationEvent as
        PermissionDeviceOrientation | undefined;

      if (orientationApi?.requestPermission) {
        const permission = await orientationApi.requestPermission();
        if (permission !== "granted") {
          setGyroPermission("denied");
          setGyroOn(false);
          return;
        }
      }

      referenceQuatRef.current = null;
      latestQuatRef.current = null;
      pointerOffsetRef.current = { x: 0, y: 0 };
      smoothedAngleRef.current = { yaw: 0, pitch: 0 };
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
    referenceQuatRef.current = null;
    latestQuatRef.current = null;
    pointerOffsetRef.current = { x: 0, y: 0 };
    smoothedAngleRef.current = { yaw: 0, pitch: 0 };
    onSettingsChange({ mouseGyroEnabled: false });
  }, [onSettingsChange]);

  const recenterGyro = useCallback(() => {
    // Whatever attitude the phone is in right now becomes the new "straight
    // ahead" — exactly like pointing a TV remote at the screen before you
    // press its center/pairing button.
    referenceQuatRef.current = latestQuatRef.current;
    pointerOffsetRef.current = { x: 0, y: 0 };
    smoothedAngleRef.current = { yaw: 0, pitch: 0 };

    // Synchronize the phone's physical mouse center with the PC cursor.
    // The bridge moves the native Windows cursor to the primary display
    // center, giving the next gyro movement a deterministic origin.
    sendMouse({ action: "center" });

    phoneFeedback();
  }, [sendMouse]);

  useEffect(() => {
    if (!gyroOn) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;
      const alpha = typeof event.alpha === "number" ? event.alpha : 0;

      const currentQuat = quatFromDeviceOrientation(
        alpha,
        event.beta,
        event.gamma,
        currentScreenAngle(),
      );
      latestQuatRef.current = currentQuat;

      if (!referenceQuatRef.current) {
        // First sample since gyro was enabled (or since the last recenter)
        // becomes "straight ahead" — nothing to move to yet.
        referenceQuatRef.current = currentQuat;
        return;
      }

      const { yaw, pitch } = pointingAngles(referenceQuatRef.current, currentQuat);

      // Smooth the absolute angle itself (not a per-frame delta) so a still
      // hand gives a still pointer instead of accumulating jitter.
      const smoothed = smoothedAngleRef.current;
      smoothed.yaw += (yaw - smoothed.yaw) * POINT_SMOOTHING;
      smoothed.pitch += (pitch - smoothed.pitch) * POINT_SMOOTHING;

      const yawDeg = Math.abs(smoothed.yaw) < POINT_DEADZONE_DEG ? 0 : smoothed.yaw;
      const pitchDeg = Math.abs(smoothed.pitch) < POINT_DEADZONE_DEG ? 0 : smoothed.pitch;

      const pixelsPerDegree = clamp(
        POINT_BASE_PIXELS_PER_DEGREE * settings.mouseGyroSensitivity,
        1,
        POINT_MAX_PIXELS_PER_DEGREE,
      );

      // Absolute target offset from the calibrated center — cursor position
      // follows where the phone is currently pointing, not how it got there.
      // Signs confirmed on-device: up->up and left->left, not derived from
      // theory (the geometric derivation got this backwards twice).
      const targetX = -yawDeg * pixelsPerDegree;
      const targetY = -pitchDeg * pixelsPerDegree;

      const offset = pointerOffsetRef.current;
      const dx = targetX - offset.x;
      const dy = targetY - offset.y;
      offset.x = targetX;
      offset.y = targetY;

      if (dx || dy) transmitMove(dx, dy);
    };

    window.addEventListener("deviceorientation", handleOrientation, { passive: true });

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
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

            <div
              className={`flat-mouse-main-click flat-mouse-main-left ${pressed === "left" ? "is-pressed" : ""}`}
            >
              <span className="flat-mouse-click-caption">LMB</span>
            </div>
            <div
              className={`flat-mouse-main-click flat-mouse-main-right ${pressed === "right" ? "is-pressed" : ""}`}
            >
              <span className="flat-mouse-click-caption">RMB</span>
            </div>

            <div className="flat-mouse-center-channel">
              <div className="flat-mouse-aim-center" aria-hidden="true">
                <span />
                <i>0</i>
              </div>
              <div className="flat-mouse-status-light" />
              <div
                className={`flat-mouse-scroll-wheel ${pressed === "middle" ? "is-pressed" : ""}`}
              >
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
            <strong>CENTER SYNC</strong>
            <small>PC CURSOR</small>
          </button>

          <button type="button" className="flat-mouse-control" onWheel={handleWheel}>
            <ScrollText />
            <strong>WHEEL</strong>
            <small>SCROLL</small>
          </button>
        </div>

        <div className="flat-mouse-help">
          <span>CENTER DOT = AIM ORIGIN</span>
          <span>DRAG BODY = MOVE</span>
          <span>LMB / RMB = CLICK</span>
          <span>LEFT EDGE = MB4 / MB5</span>
        </div>
      </div>
    </div>
  );
}
