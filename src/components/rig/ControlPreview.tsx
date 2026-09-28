import { useLayoutEffect, useRef } from "react";

// Copy only the rendered appearance. React handlers and controller hooks never
// run in the editor preview; the source controller remains the input owner.
export function cloneControlAppearance(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const hidden = getComputedStyle(source).visibility === "hidden";
  const originals = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  originals.forEach((original, index) => {
    const copy = copies[index]!;
    const style = getComputedStyle(original);
    for (let i = 0; i < style.length; i++) {
      const property = style.item(i);
      copy.style.setProperty(property, style.getPropertyValue(property));
    }
    if (hidden) copy.style.setProperty("visibility", "visible", "important");
    copy.removeAttribute("id");
    copy.removeAttribute("autofocus");
    for (const attribute of Array.from(copy.attributes)) {
      if (attribute.name.startsWith("on")) copy.removeAttribute(attribute.name);
    }
    copy.style.setProperty("animation", "none", "important");
    copy.style.setProperty("transition", "none", "important");
    copy.style.setProperty("pointer-events", "none", "important");
    copy.setAttribute("tabindex", "-1");
  });
  clone.inert = true;
  clone.setAttribute("aria-hidden", "true");
  for (const [key, value] of Object.entries({
    position: "absolute",
    left: "0",
    top: "0",
    right: "auto",
    bottom: "auto",
    margin: "0",
    visibility: "visible",
    transform: "none",
    translate: "none",
    rotate: "none",
    scale: "none",
    "transform-origin": "0 0",
  })) {
    clone.style.setProperty(key, value, "important");
  }
  return clone;
}

export function ControlPreview({ source }: { source: HTMLElement }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const clone = cloneControlAppearance(source);
    const width = source.offsetWidth || source.getBoundingClientRect().width || 1;
    const height = source.offsetHeight || source.getBoundingClientRect().height || 1;
    clone.style.setProperty("width", `${width}px`, "important");
    clone.style.setProperty("height", `${height}px`, "important");
    node.replaceChildren(clone);
    const resize = () =>
      clone.style.setProperty(
        "transform",
        `scale(${node.clientWidth / width},${node.clientHeight / height})`,
        "important",
      );
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => {
      observer.disconnect();
      node.replaceChildren();
    };
  }, [source]);
  return <div ref={host} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
