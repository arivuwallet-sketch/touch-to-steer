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
      className="relative size-[30vh] max-size-40 touch-none rounded-full"
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
  const arm =
    "absolute touch-none bg-[linear-gradient(180deg,oklch(0.82_0.005_260),oklch(0.55_0.005_260))] shadow-[0_3px_6px_oklch(0_0_0/70%)] active:brightness-75";
  const hit = (d: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      buzz(settings.vibration);
      press(`dpad_${d}`, true);
    },
    onPointerUp: () => press(`dpad_${d}`, false),
    onPointerCancel: () => press(`dpad_${d}`, false),
  });

  return (
    <div className="relative size-[26vh] max-w-36">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, oklch(0.18 0.01 260), transparent 72%)" }}
      />
      <button
        {...hit("up")}
        aria-label="up"
        className={`${arm} left-[36%] top-[6%] h-[32%] w-[28%] [clip-path:polygon(50%_0,100%_78%,100%_100%,0_100%,0_78%)]`}
      />
      <button
        {...hit("down")}
        aria-label="down"
        className={`${arm} bottom-[6%] left-[36%] h-[32%] w-[28%] [clip-path:polygon(0_0,100%_0,100%_22%,50%_100%,0_22%)]`}
      />
      <button
        {...hit("left")}
        aria-label="left"
        className={`${arm} left-[6%] top-[36%] h-[28%] w-[32%] [clip-path:polygon(0_50%,78%_0,100%_0,100%_100%,78%_100%)]`}
      />
      <button
        {...hit("right")}
        aria-label="right"
        className={`${arm} right-[6%] top-[36%] h-[28%] w-[32%] [clip-path:polygon(0_0,22%_0,100%_50%,22%_100%,0_100%)]`}
      />
      <div className="pointer-events-none absolute left-[34%] top-[34%] size-[32%] rotate-45 bg-[linear-gradient(180deg,oklch(0.78_0.005_260),oklch(0.5_0.005_260))] shadow-[inset_0_0_6px_oklch(0_0_0/50%)]" />
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
      className={`absolute grid size-[9vh] max-h-14 max-w-14 touch-none place-items-center rounded-full text-xl font-black italic active:scale-95 ${className}`}
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
      <div className="absolute left-4 top-3 flex items-start gap-2">
        <Shoulder label="LB" side="l" settings={settings} press={press} />
        <TriggerFlat label="LT" side="l" settings={settings} onChange={(v) => set({ lt: v })} />
      </div>
      <div className="absolute right-4 top-3 flex items-start gap-2">
        <TriggerFlat label="RT" side="r" settings={settings} onChange={(v) => set({ rt: v })} />
        <Shoulder label="RB" side="r" settings={settings} press={press} />
      </div>

      {/* left stick + LSB */}
      <div className="absolute bottom-[22%] left-[4%] flex flex-col items-center gap-3">
        <Stick
          settings={settings}
          label="move"
          onMove={(x, y) => set({ lx: x, ly: y })}
          onClick3={(d) => press("l3", d)}
        />
        <Pill label="LSB" id="l3" settings={settings} press={press} />
      </div>

      {/* d-pad */}
      <div className="absolute bottom-[12%] left-[26%]">
        <DPadFlat settings={settings} press={press} />
      </div>

      {/* centre buttons */}
      <div className="absolute bottom-[26%] left-1/2 flex -translate-x-1/2 items-center gap-8">
        <Round id="back" settings={settings} press={press}>
          ❐
        </Round>
        <Round id="start" settings={settings} press={press}>
          ☰
        </Round>
      </div>

      {/* right stick + RSB */}
      <div className="absolute bottom-[14%] right-[26%] flex flex-col items-center gap-3">
        <Stick
          settings={settings}
          label="aim"
          onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? -y : y })}
          onClick3={(d) => press("r3", d)}
        />
        <Pill label="RSB" id="r3" settings={settings} press={press} />
      </div>

      {/* ABXY diamond */}
      <div className="absolute right-[6%] top-[34%] size-[22vh] max-h-44 max-w-44">
        <Face id="y" label="Y" color="oklch(0.82 0.18 95)" className="left-1/2 top-0 -translate-x-1/2" settings={settings} press={press} />
        <Face id="x" label="X" color="oklch(0.7 0.19 250)" className="left-0 top-1/2 -translate-y-1/2" settings={settings} press={press} />
        <Face id="b" label="B" color="oklch(0.63 0.24 27)" className="right-0 top-1/2 -translate-y-1/2" settings={settings} press={press} />
        <Face id="a" label="A" color="oklch(0.75 0.21 145)" className="bottom-0 left-1/2 -translate-x-1/2" settings={settings} press={press} />
      </div>

      {/* mode */}
      <div className="absolute bottom-4 right-4">
        <Round id="mode" settings={settings} press={press} size="size-12">
          MODE
        </Round>
      </div>
    </div>
  );
}
