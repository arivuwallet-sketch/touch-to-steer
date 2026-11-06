// Lowest-latency pointer tracking.
// `pointerrawupdate` (Chromium/Android) fires as soon as the touch sample
// arrives instead of waiting for the next animation frame like `pointermove`,
// which saves up to one full frame (~8–16 ms) per analog update.
// `pointermove` stays attached as a fallback for browsers that never fire raw
// updates; when a raw sample was just handled, the duplicate move is skipped.
export const RAW_DUPLICATE_WINDOW_MS = 40;

export function addFastPointerMove(handler: (event: PointerEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  let lastRaw = Number.NEGATIVE_INFINITY;
  const raw = (event: Event) => {
    lastRaw = event.timeStamp;
    handler(event as PointerEvent);
  };
  const move = (event: PointerEvent) => {
    if (shouldSkipMove(event.timeStamp, lastRaw)) return;
    handler(event);
  };
  window.addEventListener("pointerrawupdate", raw);
  window.addEventListener("pointermove", move);
  return () => {
    window.removeEventListener("pointerrawupdate", raw);
    window.removeEventListener("pointermove", move);
  };
}

export function shouldSkipMove(moveTime: number, lastRawTime: number): boolean {
  return moveTime - lastRawTime >= 0 && moveTime - lastRawTime < RAW_DUPLICATE_WINDOW_MS;
}

/**
 * DualSense-style outer zone: real sticks report full deflection slightly
 * before the physical rim, so the last few percent of travel never feel dead.
 */
export const STICK_OUTER_ZONE = 0.94;

export function stickTravel(x: number, y: number): [number, number] {
  const m = Math.hypot(x, y);
  if (!Number.isFinite(m) || m === 0) return [0, 0];
  const scaled = Math.min(1, m / STICK_OUTER_ZONE);
  return [(x / m) * scaled, (y / m) * scaled];
}
