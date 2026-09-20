import { useRef, useState } from "react";

type Props = {
  label: string;
  analog?: boolean;
  onChange: (v: number) => void;
};

/** Shoulder trigger — analog travel based on how deep the finger presses in. */
export function Trigger({ label, analog = true, onChange }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [v, setV] = useState(0);

  const update = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const val = analog ? Math.max(0, Math.min(1, (clientY - r.top) / r.height)) : 1;
    setV(val);
    onChange(val);
  };

  const end = () => {
    setV(0);
    onChange(0);
  };

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
      className="relative h-16 w-20 touch-none overflow-hidden rounded-xl border border-border bg-card/70"
    >
      <div
        className="absolute inset-x-0 top-0 transition-[height] duration-75"
        style={{ height: `${v * 100}%`, background: "var(--gradient-primary)", opacity: 0.8 }}
      />
      <span className="relative text-xs font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
