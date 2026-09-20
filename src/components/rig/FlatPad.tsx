import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (enabled: boolean, ms = 10) => {
  if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

function SurfaceButton({
  label,
  id,
  settings,
  press,
  className = "",
  style,
}: {
  label: ReactNode;
  id: string;
  settings: Settings;
  press: Props["press"];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={typeof label === "string" ? label : id}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.stopPropagation();
        buzz(settings.vibration, 8);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`grid touch-none select-none place-items-center rounded-xl border border-white/10 bg-[linear-gradient(145deg,#3a4551,#151b22)] font-black text-slate-100 shadow-[inset_0_2px_2px_rgba(255,255,255,.1),inset_0_-5px_9px_rgba(0,0,0,.62),0_5px_0_#06090d,0_9px_14px_rgba(0,0,0,.5)] transition-transform active:translate-y-[3px] active:shadow-[inset_0_2px_6px_rgba(0,0,0,.65),0_2px_0_#06090d] ${className}`}
      style={style}
    >
      {label}
    </button>
  );
}

function Stick({
  settings,
  onMove,
  onClick3,
  side,
}: {
  settings: Settings;
  onMove: (x: number, y: number) => void;
  onClick3: (down: boolean) => void;
  side: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [point, setPoint] = useState({ x: 0, y: 0 });

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
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
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        role="slider"
        aria-label={side === "left" ? "Left stick" : "Right stick"}
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
        className="relative size-[clamp(7rem,23vh,10rem)] touch-none rounded-full border border-white/10 bg-[#0c1117] shadow-[inset_0_0_22px_rgba(0,0,0,.95),0_8px_20px_rgba(0,0,0,.45)]"
      >
        <div className="absolute inset-[8%] rounded-full border border-[#2e3945] bg-[radial-gradient(circle_at_38%_28%,#202a35,#080c11_72%)]" />
        <div
          className="absolute left-1/2 top-1/2 size-[57%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_25%,#626e7a,#1a222b_70%)] shadow-[0_8px_16px_rgba(0,0,0,.65),inset_0_-7px_10px_rgba(0,0,0,.58)]"
          style={{
            transform: `translate(-50%,-50%) translate(${point.x * 28}px,${point.y * 28}px)`,
            transition: point.x === 0 && point.y === 0 ? "transform 140ms ease-out" : "none",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[11%] h-[8%] w-[28%] -translate-x-1/2 rounded-full bg-[#0a0e13]" />
      </div>
      <span className="text-[8px] font-black tracking-[0.18em] text-slate-500">{side === "left" ? "L-STICK" : "R-STICK"}</span>
    </div>
  );
}

function ApexDPad({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const cell = (id: string, label: string, position: string) => (
    <SurfaceButton
      key={id}
      label={label}
      id={`dpad_${id}`}
      settings={settings}
      press={press}
      className={`absolute ${position} size-11 rounded-lg text-lg`}
    />
  );

  return (
    <div className="relative size-36">
      <div className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#11171e] shadow-inner" />
      {cell("up", "↑", "left-1/2 top-0 -translate-x-1/2")}
      {cell("left", "←", "left-0 top-1/2 -translate-y-1/2")}
      {cell("right", "→", "right-0 top-1/2 -translate-y-1/2")}
      {cell("down", "↓", "bottom-0 left-1/2 -translate-x-1/2")}
      {cell("upLeft", "↖", "left-[18%] top-[18%]")}
      {cell("upRight", "↗", "right-[18%] top-[18%]")}
      {cell("downLeft", "↙", "bottom-[18%] left-[18%]")}
      {cell("downRight", "↘", "bottom-[18%] right-[18%]")}
    </div>
  );
}

function ApexFaceButtons({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <div className="relative size-40">
      <SurfaceButton label="Y" id="y" settings={settings} press={press} className="absolute left-1/2 top-0 size-12 -translate-x-1/2 text-xl text-[#ffd43b]" />
      <SurfaceButton label="X" id="x" settings={settings} press={press} className="absolute left-0 top-1/2 size-12 -translate-y-1/2 text-xl text-[#58b9ff]" />
      <SurfaceButton label="B" id="b" settings={settings} press={press} className="absolute right-0 top-1/2 size-12 -translate-y-1/2 text-xl text-[#ff5b57]" />
      <SurfaceButton label="A" id="a" settings={settings} press={press} className="absolute bottom-0 left-1/2 size-12 -translate-x-1/2 text-xl text-[#62df87]" />
    </div>
  );
}

function Trigger({
  label,
  id,
  settings,
  set,
}: {
  label: string;
  id: "lt" | "rt";
  settings: Settings;
  set: Props["set"];
}) {
  const [value, setValue] = useState(0);
  const pointer = useRef<number | null>(null);
  const start = useRef(0);

  const move = (y: number) => {
    const next = Math.max(0, Math.min(1, (y - start.current) / 85));
    setValue(next);
    set({ [id]: next } as Partial<ControllerState>);
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
        start.current = e.clientY;
        move(e.clientY + 85);
        buzz(settings.vibration, 8);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && move(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="grid h-14 w-24 touch-none place-items-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,#303b47,#10151b)] text-[10px] font-black tracking-[0.25em] text-cyan-300 shadow-[inset_0_2px_2px_rgba(255,255,255,.08),0_6px_14px_rgba(0,0,0,.5)]"
      style={{ boxShadow: value ? "0 0 20px rgba(34,211,238,.25), inset 0 0 12px rgba(0,0,0,.65)" : undefined }}
    >
      {label}
    </button>
  );
}

function MiniScreen() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => (v + 1) % 4), 1200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex h-14 w-28 flex-col items-center justify-center rounded-lg border border-cyan-300/25 bg-[#071018] shadow-[inset_0_0_14px_rgba(34,211,238,.12),0_0_12px_rgba(34,211,238,.1)]">
      <span className="text-[7px] font-black tracking-[0.25em] text-cyan-400/70">APEX</span>
      <span className="mt-1 text-[11px] font-mono font-bold text-cyan-200">
        {tick === 0 ? "PC · 900°" : tick === 1 ? "60 HZ · OK" : tick === 2 ? "PROFILE 1" : "TOUCH"}
      </span>
    </div>
  );
}

function ExtraButton({ label, id, settings, press }: { label: string; id: string; settings: Settings; press: Props["press"] }) {
  return <SurfaceButton label={label} id={id} settings={settings} press={press} className="h-10 min-w-16 rounded-lg px-3 text-[8px] text-slate-300" />;
}

export function FlatPad({ settings, set, press }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#05080d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_75%_at_50%_8%,#172333_0%,#04070b_68%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.8rem] border border-white/15" />

      {/* Apex 5 style top shoulder controls */}
      <div className="absolute inset-x-0 top-3 flex items-start justify-between px-[max(1rem,env(safe-area-inset-left))]">
        <div className="flex items-center gap-3">
          <Trigger label="LT" id="lt" settings={settings} set={set} />
          <ExtraButton label="LM" id="lm" settings={settings} press={press} />
        </div>
        <div className="flex items-center gap-3">
          <ExtraButton label="RM" id="rm" settings={settings} press={press} />
          <Trigger label="RT" id="rt" settings={settings} set={set} />
        </div>
      </div>

      {/* Controller shell silhouette */}
      <div className="pointer-events-none absolute inset-x-[7%] top-[12%] bottom-[8%] rounded-[34%_34%_42%_42%/18%_18%_44%_44%] border border-white/5 bg-[#0b1118]/70 shadow-[inset_0_0_50px_rgba(0,0,0,.7)]" />

      {/* Left stick + D-pad */}
      <div className="absolute bottom-[17%] left-[7%] flex items-center gap-[clamp(1rem,3vw,2.5rem)]">
        <Stick
          side="left"
          settings={settings}
          onMove={(x, y) => set({ lx: x, ly: y })}
          onClick3={(d) => press("l3", d)}
        />
        <ApexDPad settings={settings} press={press} />
      </div>

      {/* Central display and navigation controls */}
      <div className="absolute left-1/2 top-[29%] flex -translate-x-1/2 flex-col items-center gap-3">
        <div className="relative w-[clamp(13rem,25vw,19rem)] rounded-[2rem] bg-[linear-gradient(145deg,#39434f,#171d24)] px-6 py-5 shadow-[inset_0_2px_2px_rgba(255,255,255,.09),0_12px_24px_rgba(0,0,0,.48)]">
          <div className="flex items-center justify-center gap-3">
            <SurfaceButton label="VIEW" id="back" settings={settings} press={press} className="h-9 min-w-14 rounded-lg text-[7px] text-slate-300" />
            <MiniScreen />
            <SurfaceButton label="MENU" id="start" settings={settings} press={press} className="h-9 min-w-14 rounded-lg text-[7px] text-slate-300" />
          </div>
          <div className="mt-3 flex justify-center gap-3">
            <SurfaceButton label="PROFILE −" id="minus" settings={settings} press={press} className="h-8 min-w-16 rounded-md text-[7px]" />
            <SurfaceButton label="HOME" id="home" settings={settings} press={press} className="h-8 min-w-16 rounded-md text-[7px]" />
            <SurfaceButton label="PROFILE +" id="plus" settings={settings} press={press} className="h-8 min-w-16 rounded-md text-[7px]" />
          </div>
        </div>
      </div>

      {/* Right stick + ABXY */}
      <div className="absolute bottom-[17%] right-[7%] flex items-center gap-[clamp(1rem,3vw,2.5rem)]">
        <ApexFaceButtons settings={settings} press={press} />
        <Stick
          side="right"
          settings={settings}
          onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? -y : y })}
          onClick3={(d) => press("r3", d)}
        />
      </div>

      {/* APEX 5 rear remappable controls surfaced as touch paddles along the lower edge */}
      <div className="absolute bottom-[4%] left-1/2 flex -translate-x-1/2 gap-2">
        <ExtraButton label="M1" id="m1" settings={settings} press={press} />
        <ExtraButton label="M2" id="m2" settings={settings} press={press} />
        <ExtraButton label="M3" id="m3" settings={settings} press={press} />
        <ExtraButton label="M4" id="m4" settings={settings} press={press} />
      </div>
    </div>
  );
}
