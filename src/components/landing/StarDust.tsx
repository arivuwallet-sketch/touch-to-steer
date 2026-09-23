import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  hue: number;
};

/**
 * Full-page scattered star dust field. Fixed behind all content, parallax-linked
 * to the cursor, drawn on a single 2D canvas for near-zero cost.
 */
export function StarDust({ density = 0.00016 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let stars: Star[] = [];
    let frame = 0;
    const pointer = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(420, Math.max(120, width * height * density)));
      stars = Array.from({ length: count }, () => {
        const z = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          r: 0.35 + z * 1.25,
          tw: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.22 ? 192 : Math.random() < 0.5 ? 218 : 205,
        };
      });
    };

    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const render = () => {
      frame = window.requestAnimationFrame(render);
      smooth.x += (pointer.x - smooth.x) * 0.045;
      smooth.y += (pointer.y - smooth.y) * 0.045;

      ctx.clearRect(0, 0, width, height);
      const t = performance.now() * 0.001;

      for (const s of stars) {
        s.y -= 0.045 + s.z * 0.13;
        if (s.y < -4) {
          s.y = height + 4;
          s.x = Math.random() * width;
        }

        const px = s.x - smooth.x * (8 + s.z * 26);
        const py = s.y - smooth.y * (6 + s.z * 20);
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + s.z) + s.tw));
        const alpha = (0.18 + s.z * 0.55) * twinkle;

        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 92%, ${72 + s.z * 16}%, ${alpha.toFixed(3)})`;
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.z > 0.82) {
          ctx.beginPath();
          ctx.fillStyle = `hsla(${s.hue}, 96%, 78%, ${(alpha * 0.16).toFixed(3)})`;
          ctx.arc(px, py, s.r * 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    build();
    render();
    window.addEventListener("resize", build);
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", build);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.9,
      }}
    />
  );
}
