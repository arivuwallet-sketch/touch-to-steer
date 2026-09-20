import { useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (enabled: boolean, ms = 10) => {
  if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

function Stick({
  settings,
  onMove,
  onClick3,
}: {
  settings: Settings;
  onMove: (x: number, y: number) => void;
  onClick3: (down: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    const x = len > 1 ? dx / len : dx;
    const y = len > 1 ? dy / len : dy;
    setPoint({ x, y });
    onMove(
      applyCurve(x, settings.deadzone, settings.linearity, settings.sensitivity),
      applyCurve(-y, settings.deadzone, settings.linearity, settings.sensitivity),
    );
  };

  const release = () => {
    pointer.current = null;
    setPoint({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        buzz(settings.vibration, 8);
        update(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onDoubleClick={() => {
        onClick3(true);
        setTimeout(() => onClick3(false), 90);
      }}
      className="relative size-[clamp(8.5rem,28vh,12rem)] touch-none rounded-full border border-cyan-400/20 bg-[radial-gradient(circle_at_42%_34%,#252e39,#0b1016_72%)] shadow-[inset_0_0_22px_rgba(0,0,0,.88),0_10px_24px_rgba(0,0,0,.38)]"
    >
      <div className="absolute inset-[9%] rounded-full border border-white/5 bg-[#080c11]" />
      <div
        className="absolute left-1/2 top-1/2 size-[54%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_38%_28%,#4b5663,#161d25_72%)] shadow-[0_8px_15px_rgba(0,0,0,.6),inset_0_-6px_10px_rgba(0,0,0,.55)]"
        style={{
          transform: `translate(-50%,-50%) translate(${point.x * 34}px,${point.y * 34}px)`,
          transition: point.x === 0 && point.y === 0 ? "transform 140ms ease-out" : "none",
        }}
      />
    </div>
  );
}

function Face({
  id,
  label,
  color,
  settings,
  press,
  position,
}: {
  id: string;
  label: string;
  color: string;
  settings: Settings;
  press: Props["press"];
  position: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`absolute ${position} grid size-[clamp(3rem,8vh,4rem)] touch-none place-items-center rounded-full border border-white/15 font-black text-lg shadow-[inset_0_2px_2px_rgba(255,255,255,.12),inset_0_-5px_9px_rgba(0,0,0,.65),0_5px_0_#05080b,0_10px_16px_rgba(0,0,0,.5)] transition-transform active:translate-y-[3px]`}
      style={{ color, textShadow: `0 0 10px ${color}`, background: `radial-gradient(circle_at_35%_28%,${color}2a,#151a21_70%)` }}
    >
      {label}
    </button>
  );
}

function DPad({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const button = (id: string, label: string, pos: string) => (
    <button
      type="button"
      key={id}
      aria-label={id}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(`dpad_${id}`, true);
      }}
      onPointerUp={() => press(`dpad_${id}`, false)}
      onPointerCancel={() => press(`dpad_${id}`, false)}
      className={`absolute ${pos} grid size-11 touch-none place-items-center rounded-lg border border-white/10 bg-[linear-gradient(145deg,#3d4651,#151a20)] text-xl font-black text-slate-200 shadow-[inset_0_2px_1px_rgba(255,255,255,.15),inset_0_-4px_7px_rgba(0,0,0,.6),0_4px_0_#05080b,0_8px_12px_rgba(0,0,0,.48)] active:translate-y-[2px]`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative size-[clamp(8rem,25vh,10rem)]">
      {button("up", "↑", "left-1/2 top-0 -translate-x-1/2")}
      {button("left", "←", "left-0 top-1/2 -translate-y-1/2")}
      {button("right", "→", "right-0 top-1/2 -translate-y-1/2")}
      {button("down", "↓", "bottom-0 left-1/2 -translate-x-1/2")}
    </div>
  );
}

function Shoulder({
  id,
  label,
  settings,
  press,
  side,
}: {
  id: string;
  label: string;
  settings: Settings;
  press: Props["press"];
  side: "left" | "right";
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`h-12 w-28 touch-none rounded-xl border border-white/10 bg-[linear-gradient(180deg,#27313b,#0d1218)] text-[10px] font-black tracking-[0.25em] text-cyan-300 shadow-[inset_0_2px_2px_rgba(255,255,255,.08),0_6px_12px_rgba(0,0,0,.45)] active:translate-y-[2px] ${side === "left" ? "rounded-bl-[1.8rem]" : "rounded-br-[1.8rem]"}`}
    >
      {label}
    </button>
  );
}

function Trigger({
  id,
  label,
  settings,
  set,
}: {
  id: "lt" | "rt";
  label: string;
  settings: Settings;
  set: Props["set"];
}) {
  const [value, setValue] = useState(0);
  const pointer = useRef<number | null>(null);
  const startY = useRef(0);

  const move = (y: number) => {
    const v = Math.max(0, Math.min(1, (y - startY.current) / 80));
    setValue(v);
    set({ [id]: v } as Partial<ControllerState>);
  };

  const release = () => {
    pointer.current = null;
    setValue(0);
    set({ [id]: 0 } as Partial<ControllerState>);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        startY.current = e.clientY;
        setValue(1);
        set({ [id]: 1 } as Partial<ControllerState>);
        buzz(settings.vibration, 8);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && move(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="grid h-16 w-20 touch-none place-items-center rounded-xl border border-cyan-500/15 bg-[linear-gradient(180deg,#2b3541,#0c1117)] text-[10px] font-black tracking-[0.2em] text-cyan-300 shadow-[inset_0_2px_2px_rgba(255,255,255,.1),0_7px_15px_rgba(0,0,0,.48)]"
    >
      {label}
    </button>
  );
}

export function FlatPad({ settings, set, press }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#05080c] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_85%_at_50%_8%,#121d2a_0%,#04070b_68%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-white/20" />
      <div className="pointer-events-none absolute inset-4 rounded-[1.45rem] border border-cyan-400/10" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-6 py-4">
        <div className="flex gap-3">
          <Shoulder id="lb" label="LB" settings={settings} press={press} side="left" />
          <Trigger id="lt" label="LT" settings={settings} set={set} />
        </div>
        <div className="flex gap-3">
          <Trigger id="rt" label="RT" settings={settings} set={set} />
          <Shoulder id="rb" label="RB" settings={settings} press={press} side="right" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[10%] flex items-end justify-between px-[5%]">
        <div className="flex items-end gap-[clamp(1rem,3vw,2.5rem)]">
          <div className="flex flex-col items-center gap-3">
            <Stick
              settings={settings}
              onMove={(x, y) => set({ lx: x, ly: y })}
              onClick3={(d) => press("l3", d)}
            />
            <button type="button" onClick={() => press("l3", true)} onPointerUp={() => press("l3", false)} className="rounded-full border border-white/10 bg-[#11171e] px-4 py-1 text-[8px] font-black tracking-[0.2em] text-slate-400">LSB</button>
          </div>
          <DPad settings={settings} press={press} />
        </div>

        <div className="absolute left-1/2 bottom-[1%] flex -translate-x-1/2 items-center gap-7">
          <button type="button" onPointerDown={() => press("back", true)} onPointerUp={() => press("back", false)} className="grid size-12 place-items-center rounded-full border border-white/10 bg-[#10161d] text-slate-400 shadow-[inset_0_0_8px_rgba(0,0,0,.8),0_6px_12px_rgba(0,0,0,.45)]">▣</button>
          <button type="button" onPointerDown={() => press("start", true)} onPointerUp={() => press("start", false)} className="grid size-12 place-items-center rounded-full border border-white/10 bg-[#10161d] text-slate-400 shadow-[inset_0_0_8px_rgba(0,0,0,.8),0_6px_12px_rgba(0,0,0,.45)]">☰</button>
        </div>

        <div className="flex items-end gap-[clamp(1rem,3vw,2.5rem)]">
          <DPad settings={settings} press={press} />
          <div className="flex flex-col items-center gap-3">
            <div className="relative size-[clamp(8.5rem,28vh,12rem)]">
              <div className="absolute inset-0 rounded-full border border-cyan-400/20 bg-[radial-gradient(circle_at_42%_34%,#252f3a,#0b1016_72%)] shadow-[inset_0_0_22px_rgba(0,0,0,.88),0_10px_24px_rgba(0,0,0,.38)]" />
              <Face id="y" label="Y" color="#facc15" position="left-1/2 top-0 -translate-x-1/2" settings={settings} press={press} />
              <Face id="x" label="X" color="#38bdf8" position="left-0 top-1/2 -translate-y-1/2" settings={settings} press={press} />
              <Face id="b" label="B" color="#ef4444" position="right-0 top-1/2 -translate-y-1/2" settings={settings} press={press} />
              <Face id="a" label="A" color="#4ade80" position="bottom-0 left-1/2 -translate-x-1/2" settings={settings} press={press} />
            </div>
            <button type="button" onPointerDown={() => press("r3", true)} onPointerUp={() => press("r3", false)} className="rounded-full border border-white/10 bg-[#11171e] px-4 py-1 text-[8px] font-black tracking-[0.2em] text-slate-400">RSB</button>
          </div>
        </div>
      </div>
    </div>
  );
}
