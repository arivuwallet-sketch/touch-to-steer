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

let lastHapticAt = 0;

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

function phoneFallback(strongMagnitude: number, weakMagnitude: number, duration: number) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

  const energy = Math.max(strongMagnitude, weakMagnitude * 0.85);
  const ms = Math.max(8, Math.min(500, Math.round(duration * (0.35 + energy * 0.65))));

  try {
    navigator.vibrate(ms);
  } catch {
    /* unsupported / permission-restricted */
  }
}

export function playDualRumble(
  kind: DualRumbleKind = "ui",
  options: DualRumbleOptions = {},
) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const bypassRateLimit = kind === "heartbeat" || kind === "gunfire";
  if (!bypassRateLimit && now - lastHapticAt < 20) return;
  lastHapticAt = now;

  const profile = PROFILES[kind];
  const strongMagnitude = clamp01(options.strongMagnitude ?? profile.strongMagnitude);
  const weakMagnitude = clamp01(options.weakMagnitude ?? profile.weakMagnitude);
  const duration = Math.max(
    1,
    Math.min(500, Math.round(options.duration ?? profile.duration)),
  );
  const startDelay = Math.max(0, Math.min(500, Math.round(options.startDelay ?? 0)));

  const gamepads = getGamepadsWithActuators();
  let played = false;

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
      played = true;
    } catch {
      /* keep trying remaining actuators */
    }
  }

  if (!played) {
    phoneFallback(strongMagnitude, weakMagnitude, duration);
  }
}

export function playHeartbeat() {
  playDualRumble("heartbeat");
  window.setTimeout(() => playDualRumble("heartbeat"), 145);
}

export function playGunfireBurst(cycles = 1, interval = 68) {
  const count = Math.max(1, Math.min(24, Math.round(cycles)));
  for (let i = 0; i < count; i += 1) {
    window.setTimeout(() => playDualRumble("gunfire"), i * Math.max(30, interval));
  }
}

export function playEngineIdle(duration = 180) {
  playDualRumble("engine", { duration });
}
