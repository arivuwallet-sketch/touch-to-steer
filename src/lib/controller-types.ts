import type { PadBindings, SavedGameProfile } from "./game-profiles";
export type WheelOutput = "rt" | "lt" | "a" | "b" | "x" | "y" | "lb" | "rb" | "l3" | "r3" | "none";
export const defaultWheelBindings = {
  throttle: "rt", brake: "lt", handbrake: "a", nitro: "lb", clutch: "x",
  gearUp: "rb", gearDown: "lb", horn: "l3",
} satisfies Record<string, WheelOutput>;
export type WheelBindings = Record<keyof typeof defaultWheelBindings, WheelOutput>;

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

export type JoystickTensionGf = 30 | 50 | 80 | 100;

export const FORCEFLEX_TENSIONS: JoystickTensionGf[] = [30, 50, 80, 100];

export const FORCEFLEX_DESCRIPTIONS: Record<JoystickTensionGf, string> = {
  30: "FEATHER • OPEN WORLD / RPG",
  50: "BALANCED • MARKET TENSION",
  80: "FIRM • PRECISION CONTROL",
  100: "HEAVY • FPS / COMPETITIVE",
};

/**
 * Software ForceFlex response curve for the virtual stick.
 *
 * The old implementation stacked the ForceFlex exponent on top of the
 * global linearity exponent. At higher GF values that compounded into an
 * overly compressed stick (especially around 100 gf), making the analog
 * range feel slow and "sticky". ForceFlex now owns one calibrated response
 * curve and lightly blends the user's linearity control into that curve.
 *
 * 30 gf  = feather / faster centre response
 * 50 gf  = neutral / balanced
 * 80 gf  = firm / precision
 * 100 gf = heavy / controlled, while still reaching full lock cleanly
 */
export function applyForceFlex(
  v: number,
  tensionGf: JoystickTensionGf,
  linearity = 1,
) {
  if (!Number.isFinite(v)) return 0;

  const magnitude = Math.max(0, Math.min(1, Math.abs(v)));
  const baseExponent =
    tensionGf === 30 ? 0.65 :
    tensionGf === 50 ? 1 :
    tensionGf === 80 ? 1.55 :
    2.2;

  // Blend, rather than multiply, the general linearity control so the
  // ForceFlex detents remain distinct at every GF setting.
  const line = Math.max(1, Math.min(2.5, Number.isFinite(linearity) ? linearity : 1));
  const exponent = baseExponent + (line - 1) * 0.35;

  // Guarantee exact endpoints for a predictable virtual Hall-stick travel.
  if (magnitude <= 0) return 0;
  if (magnitude >= 1) return Math.sign(v);
  return Math.sign(v) * Math.pow(magnitude, exponent);
}

export type Settings = {
  wheelBindings: WheelBindings;
  padBindings: PadBindings;
  autoGameProfiles: boolean;
  asphaltAcceleration: "auto" | "manual";
  gameProfiles: Record<string, SavedGameProfile>;
  bridgeUrl: string;
  /** Virtual PC controller output. Universal creates synchronized XInput + DirectInput/HID-compatible targets for broad legacy/modern coverage. */
  outputMode: "xinput" | "ds4" | "universal";
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
  /** Controller transport target. The bridge currently supports 60–1000 Hz (1000 selects a 1 ms target). */
  sendRateHz: 60 | 120 | 144 | 180 | 240 | 333 | 1000;
  invertTilt: boolean;
  invertLookY: boolean;
  /** visual wheel lock, matching a G29 at 900 degrees lock-to-lock */
  wheelRotationDeg: number;
  /** Virtual ForceFlex tension detent. Touchscreen cannot change physical spring force. */
  joystickTensionGf: JoystickTensionGf;
  /** Software response weight, not physical torque. Zero preserves linear steering. */
  steeringTension: number;
  /** Legacy scalar retained for saved-setting compatibility. */
  stickTension: number;
  /** Virtual mouse profile. Values are software output scaling, not physical sensor characteristics. */
  mouseDpi: number;
  mousePollingRate: 125 | 250 | 500 | 1000 | 2000 | 4000 | 8000;
  mouseSensitivity: number;
  mouseGyroSensitivity: number;
  mouseGyroEnabled: boolean;
  mouseInvertY: boolean;
  mouseInvertX: boolean;
  mouseRotationDeg: number;
  mouseDynamicSensitivity: boolean;
  mouseDynamicMaxMultiplier: number;
  mouseSmartTracking: boolean;
  mouseLiftOffLevel: number;
  mouseLandingLevel: number;
  mouseProfile: string;
};

export const defaultSettings: Settings = {
  bridgeUrl: "ws://192.168.1.10:8787",
  outputMode: "xinput",
  steerMode: "touch",
  sensitivity: 1,
  steerSensitivity: 1,
  deadzone: 0.05,
  maxTiltDeg: 35,
  linearity: 1.4,
  autoCentre: true,
  vibration: true,
  ffbHaptics: true,
  sendRateHz: 1000,
  wheelBindings: { ...defaultWheelBindings },
  padBindings: {},
  autoGameProfiles: true,
  asphaltAcceleration: "auto",
  gameProfiles: {},
  invertTilt: false,
  invertLookY: false,
  wheelRotationDeg: 900,
  joystickTensionGf: 50,
  steeringTension: 0,
  stickTension: 0.7,
  mouseDpi: 1600,
  mousePollingRate: 8000,
  mouseSensitivity: 1,
  mouseGyroSensitivity: 0.65,
  mouseGyroEnabled: false,
  mouseInvertY: false,
  mouseInvertX: false,
  mouseRotationDeg: 0,
  mouseDynamicSensitivity: false,
  mouseDynamicMaxMultiplier: 2.5,
  mouseSmartTracking: true,
  mouseLiftOffLevel: 0,
  mouseLandingLevel: 0,
  mouseProfile: "viper-v4-pro",
};

/** Tuned presets so each genre feels right without manual fiddling. */
export const PRESETS: Record<string, { label: string; patch: Partial<Settings> }> = {
  gtav: {
    label: "GTA V",
    patch: {
      sensitivity: 1.1,
      steerSensitivity: 0.95,
      deadzone: 0.06,
      linearity: 1.4,
      maxTiltDeg: 35,
      wheelRotationDeg: 540,
    },
  },
  forza: {
    label: "Forza / Sim",
    patch: {
      sensitivity: 0.9,
      steerSensitivity: 0.8,
      deadzone: 0.02,
      linearity: 1.8,
      maxTiltDeg: 45,
      wheelRotationDeg: 900,
    },
  },
  arcade: {
    label: "Arcade racing",
    patch: {
      sensitivity: 1.2,
      steerSensitivity: 1.35,
      deadzone: 0.08,
      linearity: 1.1,
      maxTiltDeg: 25,
    },
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

/** Radial shaping preserves stick direction and a circular full-travel boundary. */
export function applyStickResponse(x: number, y: number, settings: Settings): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];

  const radius = Math.hypot(x, y);
  if (!radius || radius <= settings.deadzone) return [0, 0];

  // Normalize once after deadzone removal, then apply the ForceFlex response
  // exactly once. This keeps diagonal travel circular and prevents the
  // linearity + ForceFlex exponents from compounding into a sluggish 100 gf.
  const normalized =
    Math.min(1, radius) - settings.deadzone <= 0
      ? 0
      : (Math.min(1, radius) - settings.deadzone) / Math.max(0.001, 1 - settings.deadzone);

  const forceFlex = applyForceFlex(
    normalized,
    settings.joystickTensionGf,
    settings.linearity,
  );

  const shaped = Math.min(
    1,
    Math.max(0, forceFlex * Math.max(0, settings.sensitivity)),
  );

  return [x / radius * shaped, y / radius * shaped];
}

export function applySteeringTension(value: number, tension = 0) {
  if (!Number.isFinite(value)) return 0;
  const weight = Number.isFinite(tension) ? Math.max(0, Math.min(1, tension)) : 0;
  return Math.sign(value) * Math.pow(Math.min(1, Math.abs(value)), 1 + weight * 0.8);
}
