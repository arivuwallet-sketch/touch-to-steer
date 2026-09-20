import { useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (on: boolean, ms = 10) => {
  if (on && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

/* ---------------- analog thumbstick ---------------- */
function Stick({
  settings,
  onMove,
  onClick3,
  label,
}: {
  settings: Settings;
  onMove: (x: number, y: number) => void;
  onClick3: (down: boolean) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [p, setP] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);

  const move = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = (e.clientX - cx) / max;
    let dy = (e.clientY - cy) / max;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    setP({ x: dx, y: dy });
    onMove(
      applyCurve(dx, settings.deadzone, settings.linearity, settings.sensitivity),
      applyCurve(-dy, settings.deadzone, settings.linearity, settings.sensitivity),
    );
  };

  const release = () => {
    id.current = null;
    setP({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const travel = 20 + settings.stickTension * 8;

  return (
    <div
      ref={box}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        id.current = e.pointerId;
        buzz(settings.vibration, 8);
        move(e);
      }}
      onPointerMove={(e) => id.current === e.pointerId && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onDoubleClick={() => {
        onClick3(true);
        setTimeout(() => onClick3(false), 90);
      }}
      aria-label={label}
      className="relative size-[30vh] max-h-40 max-w-40 touch-none rounded-full"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, oklch(0.3 0.02 260), oklch(0.12 0.01 260) 70%)",
        boxShadow:
          "inset 0 0 26px oklch(0 0 0 / 80%), 0 0 0 2px oklch(0.25 0.02 260), 0 0 34px oklch(0.55 0.18 250 / 25%)",
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 size-[62%] rounded-full"
        style={{
          transform: `translate(-50%,-50%) translate(${p.x * travel}px, ${p.y * travel}px)`,
          background:
            "radial-gradient(circle at 42% 30%, oklch(0.42 0.02 260), oklch(0.13 0.01 260) 75%)",
          boxShadow: "0 6px 14px oklch(0 0 0 / 70%), inset 0 -4px 10px oklch(0 0 0 / 60%)",
          transition: p.x === 0 && p.y === 0 ? "transform 120ms ease-out" : "none",
        }}
      />
    </div>
  );
}

/* ---------------- d-pad ---------------- */
function DPadFlat({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const hit = (d: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      buzz(settings.vibration);
      press(`dpad_${d}`, true);
    },
    onPointerUp: () => press(`dpad_${d}`, false),
    onPointerCancel: () => press(`dpad_${d}`, false),
  });

  const keys = [
    ["up", "↑", "col-start-2 row-start-1"],
    ["left", "←", "col-start-1 row-start-2"],
    ["right", "→", "col-start-3 row-start-2"],
    ["down", "↓", "col-start-2 row-start-3"],
  ] as const;

  return (
    <div className="grid size-[30vh] max-h-44 max-w-44 grid-cols-3 grid-rows-3 gap-[clamp(.5rem,1.3vw,.9rem)] rounded-3xl border border-white/5 bg-[#0b1017]/55 p-[clamp(.35rem,.8vw,.6rem)] shadow-[inset_0_0_20px_rgba(0,0,0,.55)]">
      {keys.map(([id, icon, pos]) => (
        <button
          key={id}
          {...hit(id)}
          type="button"
          aria-label={id}
          className={`grid ${pos} touch-none place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-[#303946] to-[#151a22] text-[clamp(1.4rem,3.2vw,2rem)] font-black text-slate-200 shadow-[0_5px_12px_rgba(0,0,0,.4),inset_0_1px_0_rgba(255,255,255,.07)] active:scale-95 active:brightness-125`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
/* ---------------- face buttons ---------------- */
function Face({
  label,
  color,
  className,
  settings,
  press,
  id,
}: {
  label: string;
  color: string;
  className: string;
  settings: Settings;
  press: Props["press"];
  id: string;
}) {
  return (
    <button
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`absolute grid size-[8.5vh] max-h-16 max-w-16 touch-none place-items-center rounded-full border border-white/10 text-xl font-black italic shadow-[0_6px_14px_rgba(0,0,0,.42)] active:scale-95 ${className}`}
      style={{
        color,
        background: "radial-gradient(circle at 40% 30%, oklch(0.22 0.01 260), oklch(0.07 0 0) 75%)",
        boxShadow: `0 0 16px ${color}, inset 0 0 10px oklch(0 0 0 / 80%), 0 0 0 1px oklch(0.3 0.01 260)`,
        textShadow: `0 0 10px ${color}`,
      }}
    >
      {label}
    </button>
  );
}

/* ---------------- shoulders / triggers ---------------- */
function Shoulder({
  label,
  side,
  settings,
  press,
}: {
  label: string;
  side: "l" | "r";
  settings: Settings;
  press: Props["press"];
}) {
  const id = side === "l" ? "lb" : "rb";
  return (
    <button
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`h-10 w-24 touch-none text-sm font-black tracking-wider text-[oklch(0.72_0.16_250)] active:brightness-150 ${
        side === "l"
          ? "[clip-path:polygon(10%_0,100%_0,100%_100%,0_100%)]"
          : "[clip-path:polygon(0_0,90%_0,100%_100%,0_100%)]"
      }`}
      style={{
        background: "linear-gradient(180deg, oklch(0.2 0.03 255), oklch(0.09 0.01 260))",
        boxShadow: "0 0 18px oklch(0.55 0.18 250 / 35%)",
      }}
    >
      {label}
    </button>
  );
}

function TriggerFlat({
  label,
  side,
  settings,
  onChange,
}: {
  label: string;
  side: "l" | "r";
  settings: Settings;
  onChange: (v: number) => void;
}) {
  const [v, setV] = useState(0);
  const start = useRef(0);
  const active = useRef<number | null>(null);

  const upd = (y: number) => {
    const val = Math.max(0, Math.min(1, (y - start.current) / 70));
    setV(val);
    onChange(val);
  };

  return (
    <button
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        start.current = e.clientY;
        buzz(settings.vibration, 8);
        setV(1);
        onChange(1);
      }}
      onPointerMove={(e) => active.current === e.pointerId && upd(e.clientY)}
      onPointerUp={() => {
        active.current = null;
        setV(0);
        onChange(0);
      }}
      onPointerCancel={() => {
        active.current = null;
        setV(0);
        onChange(0);
      }}
      className={`h-16 w-16 touch-none text-sm font-black tracking-wider text-[oklch(0.72_0.16_250)] ${
        side === "l"
          ? "[clip-path:polygon(28%_0,100%_0,100%_100%,0_100%)]"
          : "[clip-path:polygon(0_0,72%_0,100%_100%,0_100%)]"
      }`}
      style={{
        background: `linear-gradient(180deg, oklch(${0.2 + v * 0.35} ${0.04 + v * 0.1} 250), oklch(0.09 0.01 260))`,
        boxShadow: `0 0 ${14 + v * 26}px oklch(0.6 0.18 250 / ${0.3 + v * 0.5})`,
      }}
    >
      {label}
    </button>
  );
}

function Pill({
  label,
  id,
  settings,
  press,
  className = "",
}: {
  label: string;
  id: string;
  settings: Settings;
  press: Props["press"];
  className?: string;
}) {
  return (
    <button
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`touch-none rounded-md px-3 py-1 text-xs font-black tracking-wider text-[oklch(0.72_0.16_250)] active:brightness-150 ${className}`}
      style={{
        background: "linear-gradient(180deg, oklch(0.2 0.03 255), oklch(0.09 0.01 260))",
        boxShadow: "0 0 14px oklch(0.55 0.18 250 / 30%)",
      }}
    >
      {label}
    </button>
  );
}

function Round({
  children,
  id,
  settings,
  press,
  size = "size-11",
}: {
  children: React.ReactNode;
  id: string;
  settings: Settings;
  press: Props["press"];
  size?: string;
}) {
  return (
    <button
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`grid ${size} touch-none place-items-center rounded-full text-[10px] font-black text-[oklch(0.7_0.14_250)] active:brightness-150`}
      style={{
        background: "radial-gradient(circle at 40% 30%, oklch(0.24 0.02 255), oklch(0.08 0 0) 75%)",
        boxShadow: "0 0 14px oklch(0.5 0.18 250 / 35%), inset 0 0 8px oklch(0 0 0 / 80%)",
      }}
    >
      {children}
    </button>
  );
}

/* ---------------- layout ---------------- */
export function FlatPad({ settings, set, press }: Props) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, oklch(0.16 0.04 258) 0%, oklch(0.05 0.01 260) 62%)",
      }}
    >
      {/* side glow strips */}
      <div className="pointer-events-none absolute left-3 top-1/2 h-28 w-1 -translate-y-1/2 rounded-full bg-[oklch(0.55_0.2_255)] blur-[3px] opacity-70" />
      <div className="pointer-events-none absolute right-3 top-1/2 h-28 w-1 -translate-y-1/2 rounded-full bg-[oklch(0.55_0.2_255)] blur-[3px] opacity-70" />
      <div className="pointer-events-none absolute inset-x-[18%] top-0 h-16 rounded-b-3xl border-x border-b border-[oklch(0.4_0.16_255/45%)]" />

      {/* shoulders + triggers */}
      <div className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[12%] flex items-start gap-[clamp(0.75rem,2vw,1.5rem)]">
        <Shoulder label="LB" side="l" settings={settings} press={press} />
        <TriggerFlat label="LT" side="l" settings={settings} onChange={(v) => set({ lt: v })} />
      </div>
      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[12%] flex items-start gap-[clamp(0.75rem,2vw,1.5rem)]">
        <TriggerFlat label="RT" side="r" settings={settings} onChange={(v) => set({ rt: v })} />
        <Shoulder label="RB" side="r" settings={settings} press={press} />
      </div>

      {/* left stick + LSB */}
      <div className="absolute bottom-[14%] left-[4%] flex flex-col items-center gap-3">
        <Stick
          settings={settings}
          label="move"
          onMove={(x, y) => set({ lx: x, ly: y })}
          onClick3={(d) => press("l3", d)}
        />
        <Pill label="LSB" id="l3" settings={settings} press={press} />
      </div>

      {/* d-pad */}
      <div className="absolute bottom-[10%] left-[27%]">
        <DPadFlat settings={settings} press={press} />
      </div>

      {/* centre buttons */}
      <div className="absolute bottom-[27%] left-1/2 flex -translate-x-1/2 items-center gap-[clamp(2rem,5vw,4rem)]">
        <Round id="back" settings={settings} press={press}>
          ❐
        </Round>
        <Round id="start" settings={settings} press={press}>
          ☰
        </Round>
      </div>

      {/* right stick + RSB */}
      <div className="absolute bottom-[14%] right-[27%] flex flex-col items-center gap-3">
        <Stick
          settings={settings}
          label="aim"
          onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? -y : y })}
          onClick3={(d) => press("r3", d)}
        />
        <Pill label="RSB" id="r3" settings={settings} press={press} />
      </div>

      {/* ABXY diamond */}
      <div className="absolute right-[6%] top-[32%] size-[32vh] max-h-52 max-w-52">
        <Face id="y" label="Y" color="oklch(0.82 0.18 95)" className="left-1/2 top-[1%] -translate-x-1/2" settings={settings} press={press} />
        <Face id="x" label="X" color="oklch(0.7 0.19 250)" className="left-[1%] top-1/2 -translate-y-1/2" settings={settings} press={press} />
        <Face id="b" label="B" color="oklch(0.63 0.24 27)" className="right-[1%] top-1/2 -translate-y-1/2" settings={settings} press={press} />
        <Face id="a" label="A" color="oklch(0.75 0.21 145)" className="bottom-[1%] left-1/2 -translate-x-1/2" settings={settings} press={press} />
      </div>

      {/* mode */}
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]">
        <Round id="mode" settings={settings} press={press} size="size-12">
          MODE
        </Round>
      </div>
    </div>
  );
}
