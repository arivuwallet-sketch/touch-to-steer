export type ControllerState = {
  /** -1 (full left) .. 1 (full right) */
  steer: number;
  /** 0 .. 1 */
  throttle: number;
  /** 0 .. 1 */
  brake: number;
  /** 0 .. 1 */
  clutch: number;
  /** 0 .. 1 */
  handbrake: number;
  /** left stick, -1 .. 1 */
  lx: number;
  ly: number;
  /** right stick, -1 .. 1 */
  rx: number;
  ry: number;
  /** -1 = down shift, 0 = none, 1 = up shift (momentary) */
  gear: number;
  buttons: Record<string, boolean>;
};

export const emptyState = (): ControllerState => ({
  steer: 0,
  throttle: 0,
  brake: 0,
  clutch: 0,
  handbrake: 0,
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
  gear: 0,
  buttons: {},
});

export type Settings = {
  bridgeUrl: string;
  steerMode: "tilt" | "touch";
  sensitivity: number; // 0.5 .. 2
  deadzone: number; // 0 .. 0.2
  maxTiltDeg: number; // 15 .. 60
  linearity: number; // 1 = linear, >1 = finer near centre
  autoCentre: boolean;
  vibration: boolean;
  sendRateHz: number; // 30 .. 120
  invertTilt: boolean;
};

export const defaultSettings: Settings = {
  bridgeUrl: "ws://192.168.1.10:8787",
  steerMode: "tilt",
  sensitivity: 1,
  deadzone: 0.04,
  maxTiltDeg: 35,
  linearity: 1.4,
  autoCentre: true,
  vibration: true,
  sendRateHz: 60,
  invertTilt: false,
};

export const BUTTONS = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "x", label: "X" },
  { id: "y", label: "Y" },
  { id: "lb", label: "LB" },
  { id: "rb", label: "RB" },
  { id: "start", label: "START" },
  { id: "back", label: "BACK" },
  { id: "horn", label: "HORN" },
  { id: "lights", label: "LIGHTS" },
  { id: "look", label: "LOOK" },
  { id: "reset", label: "RESET" },
] as const;

export function applyCurve(v: number, deadzone: number, linearity: number, sens: number) {
  const s = Math.sign(v);
  let m = Math.abs(v);
  if (m <= deadzone) return 0;
  m = (m - deadzone) / (1 - deadzone);
  m = Math.pow(m, linearity) * sens;
  return s * Math.max(-1, Math.min(1, m));
}
