export type ControllerState = {
  /** -1 (full left) .. 1 (full right) */
  steer: number;
  /** 0 .. 1 */
  throttle: number;
  brake: number;
  clutch: number;
  handbrake: number;
  nitro: number;
  /** left stick, -1 .. 1 */
  lx: number;
  ly: number;
  /** right stick, -1 .. 1 */
  rx: number;
  ry: number;
  /** analog triggers 0..1 */
  lt: number;
  rt: number;
  /** -1 = down shift, 0 = none, 1 = up shift (momentary) */
  gear: number;
  /** -1 = selector dial left, 0 = none, 1 = selector dial right (momentary) */
  dial: number;
  /** G29 platform selector */
  wheelPlatform: "ps3" | "ps4";
  buttons: Record<string, boolean>;
};

export const emptyState = (): ControllerState => ({
  steer: 0,
  throttle: 0,
  brake: 0,
  clutch: 0,
  handbrake: 0,
  nitro: 0,
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
  lt: 0,
  rt: 0,
  gear: 0,
  dial: 0,
  wheelPlatform: "ps4",
  buttons: {},
});

export type Settings = {
  bridgeUrl: string;
  steerMode: "tilt" | "touch";
  /** aim/stick sensitivity */
  sensitivity: number;
  /** steering sensitivity, kept separate from aim */
  steerSensitivity: number;
  deadzone: number;
  maxTiltDeg: number;
  linearity: number;
  autoCentre: boolean;
  vibration: boolean;
  /** Phone-side haptic approximation of wheel force feedback. */
  ffbHaptics: boolean;
  /** Controller packet target. 240 Hz is the low-latency ceiling; actual delivery depends on device/browser/network. */
  sendRateHz: number;
  invertTilt: boolean;
  invertLookY: boolean;
  /** visual wheel lock, matching a G29 at 900 degrees lock-to-lock */
  wheelRotationDeg: number;
  /** simulated stick tension for thumb travel */
  stickTension: number;
};

export const defaultSettings: Settings = {
  bridgeUrl: "ws://192.168.1.10:8787",
  steerMode: "touch",
  sensitivity: 1,
  steerSensitivity: 1,
  deadzone: 0.05,
  maxTiltDeg: 35,
  linearity: 1.4,
  autoCentre: false,
  vibration: true,
  ffbHaptics: true,
  sendRateHz: 240,
  invertTilt: false,
  invertLookY: false,
  wheelRotationDeg: 900,
  stickTension: 0.7,
};

/** Tuned presets so each genre feels right without manual fiddling. */
export const PRESETS: Record<string, { label: string; patch: Partial<Settings> }> = {
  gtav: {
    label: "GTA V",
    patch: { sensitivity: 1.1, steerSensitivity: 0.95, deadzone: 0.06, linearity: 1.4, maxTiltDeg: 35, wheelRotationDeg: 540 },
  },
  forza: {
    label: "Forza / Sim",
    patch: { sensitivity: 0.9, steerSensitivity: 0.8, deadzone: 0.02, linearity: 1.8, maxTiltDeg: 45, wheelRotationDeg: 900 },
  },
  arcade: {
    label: "Arcade racing",
    patch: { sensitivity: 1.2, steerSensitivity: 1.35, deadzone: 0.08, linearity: 1.1, maxTiltDeg: 25 },
  },
  fps: {
    label: "Shooter",
    patch: { sensitivity: 1.45, steerSensitivity: 1, deadzone: 0.04, linearity: 1.6 },
  },
};

export function applyCurve(v: number, deadzone: number, linearity: number, sens: number) {
  const s = Math.sign(v);
  let m = Math.abs(v);
  if (m <= deadzone) return 0;
  m = (m - deadzone) / (1 - deadzone);
  m = Math.pow(m, linearity) * sens;
  return s * Math.max(-1, Math.min(1, m));
}
