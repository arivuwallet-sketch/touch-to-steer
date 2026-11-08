// Physical return ("spring-back") for the touch sticks and triggers.
//
// A real DualSense stick or trigger never teleports to rest when you let go: a
// spring drives it home over a few tens of milliseconds, and the game sees a
// continuous fall instead of a single 1 -> 0 step. This module reproduces that
// on the way OUT only.
//
//   * Pressing and moving are never touched: no filter, no smoothing, no delay.
//     The first report of a press / every move goes out exactly as before.
//   * Only a clean finger lift (pointerup) animates. Anything that means "stop
//     now" (pointercancel, lost capture, blur, tab hidden, bridge disconnect,
//     mode switch) is a hard release and zeroes the control in the same task.
//   * A hard deadline guarantees the control reaches exactly 0 even if timers
//     stall, so a return can never leave a stuck value.
//
// `returnMs` is the settle time (time to reach ~2 % of the starting deflection).
// 0 selects the original instant behaviour, which stays fully supported.

export const ANALOG_RETURN_PRESETS = [0, 25, 45, 80] as const;
export const DEFAULT_ANALOG_RETURN_MS = 45;
export const MAX_ANALOG_RETURN_MS = 200;

/** Below this deflection the return snaps to exactly zero (2 % of travel). */
export const RETURN_SNAP = 0.02;
/** Target spacing between return samples. ~4 ms is the browser timer floor. */
export const RETURN_STEP_MS = 4;

// ln(1 / RETURN_SNAP): an exponential decay reaches RETURN_SNAP after SETTLE_TAUS time constants.
const SETTLE_TAUS = Math.log(1 / RETURN_SNAP);

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Accepts anything a saved settings blob might contain. */
export function normalizeReturnMs(value: unknown): number {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(n)) return DEFAULT_ANALOG_RETURN_MS;
  return Math.max(0, Math.min(MAX_ANALOG_RETURN_MS, Math.round(n)));
}

/** Exponential time constant (ms) for a given settle time. */
export function returnTauMs(returnMs: number): number {
  return Math.max(0.001, normalizeReturnMs(returnMs) / SETTLE_TAUS);
}

/**
 * One analytic decay step. Exact for any dt, so the curve is identical at 60 Hz,
 * 250 Hz or with a hitching main thread.
 */
export function decayStep(value: number, dtMs: number, returnMs: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const dt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  return value * Math.exp(-dt / returnTauMs(returnMs));
}

export type ReturnRunner = {
  /** Begin a return from the given deflection (unit disc, or just `x` for a trigger). */
  start(x: number, y?: number): void;
  /** Stop without emitting; the caller owns whatever happens next (new press, hard reset). */
  cancel(): void;
  readonly active: boolean;
};

export type ReturnRunnerOptions = {
  /** Called for every sample. `done` is true exactly once, with (0, 0). */
  emit: (x: number, y: number, done: boolean) => void;
  /** Read live so a settings change applies to the next release. */
  getReturnMs: () => number;
  clock?: () => number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  unschedule?: (handle: unknown) => void;
};

export function createReturnRunner(options: ReturnRunnerOptions): ReturnRunner {
  const clock = options.clock ?? nowMs;
  // Resolve timers at call time so fake timers installed after import still apply.
  const schedule = options.schedule ?? ((cb: () => void, ms: number) => globalThis.setTimeout(cb, ms));
  const unschedule = options.unschedule ?? ((h: unknown) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>));

  let handle: unknown = null;
  let active = false;
  let x = 0;
  let y = 0;
  let last = 0;
  let elapsed = 0;
  let returnMs = 0;

  const stop = () => {
    if (handle !== null) unschedule(handle);
    handle = null;
    active = false;
  };

  const finish = () => {
    stop();
    options.emit(0, 0, true);
  };

  const tick = () => {
    handle = null;
    if (!active) return;
    const now = clock();
    // Never advance by less than 1 ms so a frozen clock cannot spin forever, and
    // never by more than 50 ms so one stalled frame cannot skip the whole curve.
    const dt = Math.min(50, Math.max(1, now - last));
    last = now;
    elapsed += dt;
    x = decayStep(x, dt, returnMs);
    y = decayStep(y, dt, returnMs);
    if (Math.hypot(x, y) < RETURN_SNAP || elapsed >= returnMs * 2 + 40) {
      finish();
      return;
    }
    options.emit(x, y, false);
    handle = schedule(tick, RETURN_STEP_MS);
  };

  return {
    start(startX: number, startY = 0) {
      stop();
      returnMs = normalizeReturnMs(options.getReturnMs());
      x = Number.isFinite(startX) ? startX : 0;
      y = Number.isFinite(startY) ? startY : 0;
      if (returnMs <= 0 || Math.hypot(x, y) < RETURN_SNAP) {
        options.emit(0, 0, true);
        return;
      }
      active = true;
      last = clock();
      elapsed = 0;
      handle = schedule(tick, RETURN_STEP_MS);
    },
    cancel: stop,
    get active() {
      return active;
    },
  };
}
