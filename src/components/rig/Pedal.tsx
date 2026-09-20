import { useRef, useState } from "react";

type Props = {
  label: string;
  tone?: "go" | "stop" | "neutral";
  analog?: boolean;
  onChange: (v: number) => void;
};

/**
 * Pressure-style pedal. In analog mode the travel depends on how far up the
 * pad the finger sits, so you can feather throttle and brake.
 */
export function Pedal({ label, tone = "neutral", analog = true, onChange }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [v, setV] = useState(0);

  const update = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const val = analog ? Math.max(0, Math.min(1, (r.bottom - clientY) / r.height)) : 1;
    setV(val);
    onChange(val);
  };

  const end = () => {
    setV(0);
    onChange(0);
  };

  const color =
    tone === "go" ? "var(--success)" : tone === "stop" ? "var(--destructive)" : "var(--accent)";

  return (
    <button
      ref={ref}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        update(e.clientY);
      }}
      onPointerMove={(e) => e.buttons > 0 && update(e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      className="relative h-40 w-16 touch-none overflow-hidden rounded-2xl border border-border bg-card/70 sm:h-48 sm:w-20"
    >
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-75"
        style={{ height: `${v * 100}%`, background: color, opacity: 0.85 }}
      />
      <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-foreground mix-blend-difference">
        {label}
      </span>
      <span className="absolute inset-x-0 top-2 text-center text-xs font-bold tabular-nums text-muted-foreground">
        {Math.round(v * 100)}
      </span>
    </button>
  );
}
