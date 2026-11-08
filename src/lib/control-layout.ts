export type ControlBox = { x: number; y: number; w: number; h: number; hidden?: boolean };
export type ControlLayout = Record<string, ControlBox>;
export type ControlLayouts = Partial<Record<"pad" | "wheel", ControlLayout>>;
export type LayoutControl = { id: string; label: string; box: ControlBox };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function normalizeBox(box: ControlBox): ControlBox {
  const w = clamp(Number.isFinite(box.w) ? box.w : 10, 2, 100),
    h = clamp(Number.isFinite(box.h) ? box.h : 10, 2, 100);
  return {
    x: clamp(Number.isFinite(box.x) ? box.x : 0, 0, 100 - w),
    y: clamp(Number.isFinite(box.y) ? box.y : 0, 0, 100 - h),
    w,
    h,
    hidden: box.hidden === true,
  };
}
export function swapControls(layout: ControlLayout, a: string, b: string): ControlLayout {
  if (!layout[a] || !layout[b] || a === b) return layout;
  return {
    ...layout,
    [a]: { ...layout[b], hidden: layout[a].hidden === true },
    [b]: { ...layout[a], hidden: layout[b].hidden === true },
  };
}
export function collectControls(root: HTMLElement) {
  const seen = new Map<string, number>();
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button,[role="slider"],.flat-wheel-hit,.flat-wheel-telemetry,.flat-pad-screen',
    ),
  )
    .filter((el) => !el.parentElement?.closest(".flat-wheel-hit"))
    .map((el) => {
      const label = el.classList.contains("flat-pad-screen")
        ? "Game display"
        : el.classList.contains("flat-wheel-hit")
          ? "Steering wheel"
          : el.classList.contains("flat-wheel-telemetry")
            ? "Telemetry"
            : el.getAttribute("aria-label") || el.textContent?.trim() || "Control";
      const key = label
        .replace(/ForceAdapt trigger — .*/, "trigger")
        .replace(/\d+(?:\.\d+)?\s*(?:Hz|gf|GF).*/i, "preset")
        .replace(/\s+/g, " ")
        .trim();
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      return { el, id: `${key}:${n}`, label };
    });
}

// Uniform scaling preserves the current shape and center, clamping to the canvas.
export function scaleControlBox(box: ControlBox, targetWidth: number): ControlBox {
  const b = normalizeBox(box);
  const factor = clamp(
    Number.isFinite(targetWidth) ? targetWidth / b.w : 1,
    Math.max(2 / b.w, 2 / b.h),
    Math.min(100 / b.w, 100 / b.h),
  );
  const w = b.w * factor,
    h = b.h * factor;
  return normalizeBox({ ...b, w, h, x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2 });
}
