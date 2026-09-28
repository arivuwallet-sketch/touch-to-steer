import { useLayoutEffect, useState, type RefObject } from "react";
import {
  collectControls,
  normalizeBox,
  type ControlLayout,
  type LayoutControl,
} from "@/lib/control-layout";
const properties = [
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "flex-shrink",
  "transform",
  "visibility",
  "transform-origin",
] as const;
export function useControlLayout(
  root: RefObject<HTMLDivElement | null>,
  mode: string,
  layout: ControlLayout | undefined,
) {
  const [controls, setControls] = useState<{ mode: string; items: LayoutControl[] }>({
    mode: "",
    items: [],
  });
  useLayoutEffect(() => {
    const node = root.current;
    if (!node || mode === "mouse") return;
    let restore = () => {};
    const apply = () => {
      restore();
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const elements = collectControls(node);
      const ancestors = new Map<HTMLElement, [string, string]>();
      if (layout && Object.keys(layout).length)
        for (const { el } of elements) {
          let parent = el.parentElement;
          while (parent && parent !== node) {
            if (!ancestors.has(parent))
              ancestors.set(parent, [
                parent.style.getPropertyValue("overflow"),
                parent.style.getPropertyPriority("overflow"),
              ]);
            parent = parent.parentElement;
          }
        }
      const originals = elements.map(({ el }) =>
        properties.map(
          (p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)] as const,
        ),
      );
      restore = () => {
        for (const [el, [value, priority]] of ancestors) {
          if (value) el.style.setProperty("overflow", value, priority);
          else el.style.removeProperty("overflow");
        }
        elements.forEach(({ el }, i) =>
          originals[i]!.forEach(([p, v, priority]) => {
            if (v) el.style.setProperty(p, v, priority);
            else el.style.removeProperty(p);
          }),
        );
      };
      for (const el of ancestors.keys()) el.style.setProperty("overflow", "visible", "important");
      setControls({
        mode,
        items: elements.map(({ el, id, label }) => {
          const r = el.getBoundingClientRect();
          return {
            id,
            label,
            box: normalizeBox({
              x: ((r.left - bounds.left) / bounds.width) * 100,
              y: ((r.top - bounds.top) / bounds.height) * 100,
              w: (r.width / bounds.width) * 100,
              h: (r.height / bounds.height) * 100,
            }),
          };
        }),
      });
      for (const { el, id } of elements) {
        const box = layout?.[id];
        if (!box) continue;
        const b = normalizeBox(box);
        // Scale the entire rendered control (icons, text and wheel internals),
        // matching the editor preview without reflowing neighboring controls.
        const natural = el.getBoundingClientRect();
        const transform = getComputedStyle(el).transform;
        const scaleX = (b.w * bounds.width) / 100 / (natural.width || 1);
        const scaleY = (b.h * bounds.height) / 100 / (natural.height || 1);
        el.style.setProperty("transform-origin", "0 0", "important");
        el.style.setProperty(
          "transform",
          `${transform === "none" ? "" : transform} scale(${scaleX},${scaleY})`,
          "important",
        );
        el.style.visibility = b.hidden ? "hidden" : "visible";
      }
      const moves = elements.map(({ el, id }) => {
        const box = layout?.[id];
        if (!box) return null;
        const b = normalizeBox(box),
          r = el.getBoundingClientRect();
        return {
          el,
          x: bounds.left + (b.x * bounds.width) / 100 - r.left,
          y: bounds.top + (b.y * bounds.height) / 100 - r.top,
          transform: getComputedStyle(el).transform,
        };
      });
      for (const move of moves)
        if (move)
          move.el.style.setProperty(
            "transform",
            `translate(${move.x}px,${move.y}px) ${move.transform === "none" ? "" : move.transform}`,
            "important",
          );
    };
    apply();
    window.addEventListener("resize", apply);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
      restore();
    };
  }, [root, mode, layout]);
  return controls;
}
