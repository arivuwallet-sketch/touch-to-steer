export type DualRumbleKind =
  | "ui"
  | "light"
  | "heavy"
  | "heartbeat"
  | "engine"
  | "gunfire";

type DualRumbleOptions = {
  strongMagnitude?: number;
  weakMagnitude?: number;
  duration?: number;
  startDelay?: number;
};

type HapticActuatorLike = {
  reset?: () => Promise<unknown> | unknown;
  playEffect?: (
    type: "dual-rumble",
    params: {
      startDelay?: number;
      duration?: number;
      strongMagnitude?: number;
      weakMagnitude?: number;
    },
  ) => Promise<unknown> | unknown;
};

type GamepadWithVibration = Gamepad & {
  vibrationActuator?: HapticActuatorLike;
};

let lastHapticAt = -Infinity;
let hapticsEnabled = true;
const effectTimers = new Set<ReturnType<typeof setTimeout>>();
let phoneDelay: ReturnType<typeof setTimeout> | null = null;

const PROFILES: Record<DualRumbleKind, Required<DualRumbleOptions>> = {
  ui: {
    strongMagnitude: 0,
    weakMagnitude: 0.2,
    duration: 40,
    startDelay: 0,
  },
  light: {
    strongMagnitude: 0.12,
    weakMagnitude: 0.28,
    duration: 70,
    startDelay: 0,
  },
  heavy: {
    strongMagnitude: 1,
    weakMagnitude: 0.8,
    duration: 380,
    startDelay: 0,
  },
  heartbeat: {
    strongMagnitude: 0.4,
    weakMagnitude: 0,
    duration: 105,
    startDelay: 0,
  },
  engine: {
    strongMagnitude: 0.2,
    weakMagnitude: 0.1,
    duration: 180,
    startDelay: 0,
  },
  gunfire: {
    strongMagnitude: 0,
    weakMagnitude: 0.9,
    duration: 55,
    startDelay: 0,
  },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function getGamepadsWithActuators(): GamepadWithVibration[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return [];
  }

  try {
    return Array.from(navigator.getGamepads()).filter(
      (gamepad): gamepad is GamepadWithVibration =>
        Boolean(gamepad?.vibrationActuator?.playEffect),
    );
  } catch {
    return [];
  }
}

function phoneFallback(
  kind: DualRumbleKind,
  strongMagnitude: number,
  weakMagnitude: number,
  duration: number,
) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

  // Phones expose one vibration motor to the browser, not two independently
  // addressable motors. Preserve the requested texture with short patterns.
  const intensity = Math.max(strongMagnitude, weakMagnitude);
  if (intensity <= 0) return;
  // Browser vibration has no amplitude control: approximate strength with duty cycle.
  const pulse: number[] = [];
  let remaining = duration;
  const period = kind === "engine" ? 35 : kind === "gunfire" ? 24 : 50;
  while (remaining > 0) {
    const segment = Math.min(period, remaining);
    const on = Math.max(1, Math.round(segment * intensity));
    pulse.push(on, Math.max(0, segment - on));
    remaining -= segment;
  }

  try {
    navigator.vibrate(pulse);
  } catch {
    /* unsupported / permission-restricted */
  }
}

function performDualRumble(
  kind: DualRumbleKind = "ui",
  options: DualRumbleOptions = {},
) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!hapticsEnabled) return;
  lastHapticAt = now;

  const profile = PROFILES[kind];
  const strongMagnitude = clamp01(options.strongMagnitude ?? profile.strongMagnitude);
  const weakMagnitude = clamp01(options.weakMagnitude ?? profile.weakMagnitude);
  if (strongMagnitude === 0 && weakMagnitude === 0) { stopHaptics(); return; }
  const duration = Math.max(
    1,
    Math.min(500, Math.round(Number.isFinite(options.duration) ? options.duration! : profile.duration)),
  );
  const startDelay = Math.max(0, Math.min(500, Math.round(Number.isFinite(options.startDelay) ? options.startDelay! : 0)));

  const gamepads = getGamepadsWithActuators();

  for (const gamepad of gamepads) {
    const actuator = gamepad.vibrationActuator;
    if (!actuator?.playEffect) continue;

    try {
      const result = actuator.playEffect("dual-rumble", {
        startDelay,
        duration,
        strongMagnitude,
        weakMagnitude,
      });
      void Promise.resolve(result).catch(() => undefined);
    } catch {
      /* keep trying remaining actuators */
    }
  }

  // Always provide phone feedback as well. This is important for the
  // TouchToSteer use case because the phone is the haptic surface even when
  // the browser has no GamepadHapticActuator exposed.
  if (phoneDelay !== null) clearTimeout(phoneDelay);
  phoneDelay = null;
  if (startDelay) phoneDelay = setTimeout(() => {
    phoneDelay = null;
    if (hapticsEnabled) phoneFallback(kind, strongMagnitude, weakMagnitude, duration);
  }, startDelay);
  else phoneFallback(kind, strongMagnitude, weakMagnitude, duration);
}

export function playHeartbeat() {
  playDualRumble("heartbeat");
  scheduleEffect(() => playDualRumble("heartbeat"), 145);
}

export function playGunfireBurst(cycles = 1, interval = 68) {
  const count = Math.max(1, Math.min(24, Math.round(cycles)));
  for (let i = 0; i < count; i += 1) {
    scheduleEffect(() => playDualRumble("gunfire"), i * Math.max(30, interval));
  }
}

export function playEngineIdle(duration = 180) {
  playDualRumble("engine", { duration });
}

// Coalesce local/game feedback; never scan Gamepads or invoke vibration APIs
// in the task that is sending a controller press/release.
let pendingHaptic: { kind: DualRumbleKind; options: DualRumbleOptions } | null = null;
let hapticTask: ReturnType<typeof setTimeout> | null = null;
export function playDualRumble(kind: DualRumbleKind = "ui", options: DualRumbleOptions = {}) {
  if (typeof window === "undefined" || !hapticsEnabled) return;
  if (options.strongMagnitude === 0 && options.weakMagnitude === 0) { stopHaptics(); return; }
  pendingHaptic = { kind, options };
  if (hapticTask !== null) return;
  hapticTask = setTimeout(() => {
    hapticTask = null;
    const request = pendingHaptic;
    pendingHaptic = null;
    if (request) performDualRumble(request.kind, request.options);
  }, Math.max(0, 20 - ((typeof performance !== "undefined" ? performance.now() : Date.now()) - lastHapticAt)));
}


function scheduleEffect(callback: () => void, delay: number) {
  if (!hapticsEnabled || typeof window === "undefined") return;
  const timer = setTimeout(() => { effectTimers.delete(timer); callback(); }, delay);
  effectTimers.add(timer);
}

/** Cancel queued work and stop both hardware paths, independently of rate limiting. */
export function stopHaptics() {
  if (hapticTask !== null) clearTimeout(hapticTask);
  if (phoneDelay !== null) clearTimeout(phoneDelay);
  hapticTask = null; phoneDelay = null; pendingHaptic = null;
  for (const timer of effectTimers) clearTimeout(timer);
  effectTimers.clear();
  lastHapticAt = -Infinity;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("touch-to-steer:haptics-stop"));
  // Do not scan gamepads on the controller input task, even when stopping.
  setTimeout(() => {
    try { navigator.vibrate?.(0); } catch { /* unavailable */ }
    for (const pad of getGamepadsWithActuators()) {
      try {
        const actuator = pad.vibrationActuator!;
        const result = actuator.reset ? actuator.reset() : actuator.playEffect?.("dual-rumble", {duration:0,strongMagnitude:0,weakMagnitude:0});
        void Promise.resolve(result).catch(() => undefined);
      } catch { /* unsupported */ }
    }
  }, 0);
}

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
  if (!enabled) stopHaptics();
}
