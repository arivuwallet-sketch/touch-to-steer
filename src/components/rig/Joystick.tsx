import { useRef, useState } from "react";
import { applyCurve } from "@/lib/controller-types";

type Props = {
  label: string;
  deadzone: number;
  linearity: number;
  sensitivity: number;
  autoCentre?: boolean;
  onMove: (x: number, y: number) => void;
};

/** Analog thumbstick with radial clamping and a configurable response curve. */
export function Joystick({
  label,
  deadzone,
  linearity,
  sensitivity,
  autoCentre = true,
  onMove,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (clientX - (r.left + radius)) / radius;
    let dy = (clientY - (r.top + radius)) / radius;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    setPos({ x: dx, y: dy });
    onMove(
      applyCurve(dx, deadzone, linearity, sensitivity),
      applyCurve(dy, deadzone, linearity, sensitivity),
    );
  };

  const end = () => {
    active.current = false;
    if (autoCentre) {
      setPos({ x: 0, y: 0 });
      onMove(0, 0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={ref}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          active.current = true;
          update(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => active.current && update(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
        className="relative size-32 touch-none rounded-full border border-border bg-card/70 sm:size-36"
      >
        <div className="absolute inset-3 rounded-full border border-border/60" />
        <div
          className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full glow"
          style={{
            background: "var(--gradient-primary)",
            transform: `translate(calc(-50% + ${pos.x * 42}px), calc(-50% + ${pos.y * 42}px))`,
          }}
        />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
