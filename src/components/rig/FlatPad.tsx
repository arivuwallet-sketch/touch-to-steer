import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

type TriggerMode = "regular" | "race" | "sniper" | "recoil" | "lock";

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
  turbo = false,
  onClick,
}: {
  label: ReactNode;
  id: string;
  settings: Settings;
  press: Props["press"];
  className?: string;
  style?: CSSProperties;
  turbo?: boolean;
  onClick?: () => void;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTurbo = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    press(id, false);
  }, [id, press]);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    buzz(settings.vibration, 8);
    press(id, true);

    if (turbo) {
      timer.current = setInterval(() => {
        press(id, false);
        window.setTimeout(() => press(id, true), 18);
      }, 92);
    }
  };

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  return (
    <button
      type="button"
      aria-label={typeof label === "string" ? label : id}
      onPointerDown={down}
      onPointerUp={stopTurbo}
      onPointerCancel={stopTurbo}
      onClick={onClick}
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
    const radius = Math.max(1, Math.min(r.width, r.height) / 2);
    let x = (e.clientX - (r.left + r.width / 2)) / radius;
    let y = (e.clientY - (r.top + r.height / 2)) / radius;
    const m = Math.hypot(x, y);

    if (m > 1) {
      x /= m;
      y /= m;
    }

    const travel = 22 + settings.stickTension * 12;
    setPoint({ x, y });
    onMove(
      applyCurve(x, settings.deadzone, settings.linearity, settings.sensitivity),
      applyCurve(-y, settings.deadzone, settings.linearity, settings.sensitivity),
    );

    const thumb = el.querySelector<HTMLElement>("[data-stick-thumb]");
    if (thumb) thumb.style.transform = `translate(-50%,-50%) translate(${x * travel}px,${y * travel}px)`;
  };

  const release = () => {
    pointer.current = null;
    setPoint({ x: 0, y: 0 });
    const thumb = ref.current?.querySelector<HTMLElement>("[data-stick-thumb]");
    if (thumb) thumb.style.transform = "translate(-50%,-50%) translate(0px,0px)";
    onMove(0, 0);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        role="slider"
        aria-label={side === "left" ? "Left stick" : "Right stick"}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={point.x}
        onPointerDown={(e) => {
          e.preventDefault();
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
          window.setTimeout(() => onClick3(false), 90);
        }}
        className="flat-pad-stick relative size-[clamp(5.25rem,23svh,10.5rem)] touch-none rounded-full border border-white/10 bg-[#0c1117] shadow-[inset_0_0_22px_rgba(0,0,0,.95),0_8px_20px_rgba(0,0,0,.45)]"
      >
        <div className="absolute inset-[8%] rounded-full border border-[#2e3945] bg-[radial-gradient(circle_at_38%_28%,#202a35,#080c11_72%)]" />
        <div
          data-stick-thumb
          className="absolute left-1/2 top-1/2 size-[57%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_25%,#626e7a,#1a222b_70%)] shadow-[0_8px_16px_rgba(0,0,0,.65),inset_0_-7px_10px_rgba(0,0,0,.58)]"
          style={{
            transform: `translate(-50%,-50%) translate(${point.x * 30}px,${point.y * 30}px)`,
            transition: point.x === 0 && point.y === 0 ? "transform 140ms ease-out" : "none",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[11%] h-[8%] w-[28%] -translate-x-1/2 rounded-full bg-[#0a0e13]" />
      </div>
      <span className="text-[8px] font-black tracking-[0.18em] text-slate-500">
        {side === "left" ? "L-STICK" : "R-STICK"}
      </span>
    </div>
  );
}

function ApexDPad({ settings, press, turbo }: { settings: Settings; press: Props["press"]; turbo: boolean }) {
  const cell = (id: string, label: string, position: string) => (
    <SurfaceButton
      key={id}
      label={label}
      id={`dpad_${id}`}
      settings={settings}
      press={press}
      turbo={turbo}
      className={`absolute ${position} size-[clamp(2.75rem,8svh,3rem)] rounded-xl text-[clamp(1.2rem,4svh,1.5rem)]`}
    />
  );

  return (
    <div className="flat-pad-dpad relative size-[clamp(6.75rem,22svh,10rem)]">
      <div className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#11171e] shadow-inner" />
      {cell("up", "↑", "left-1/2 top-0 -translate-x-1/2")}
      {cell("left", "←", "left-0 top-1/2 -translate-y-1/2")}
      {cell("right", "→", "right-0 top-1/2 -translate-y-1/2")}
      {cell("down", "↓", "bottom-0 left-1/2 -translate-x-1/2")}
      {cell("upLeft", "↖", "left-[15%] top-[15%]")}
      {cell("upRight", "↗", "right-[15%] top-[15%]")}
      {cell("downLeft", "↙", "bottom-[15%] left-[15%]")}
      {cell("downRight", "↘", "bottom-[15%] right-[15%]")}
    </div>
  );
}

function ApexFaceButtons({ settings, press, turbo }: { settings: Settings; press: Props["press"]; turbo: boolean }) {
  return (
    <div className="flat-pad-face relative size-[clamp(7.5rem,24svh,11rem)]">
      <SurfaceButton label="Y" id="y" settings={settings} press={press} turbo={turbo} className="absolute left-1/2 top-0 size-[clamp(2.75rem,8svh,3.5rem)] -translate-x-1/2 text-[clamp(1.25rem,4.5svh,1.5rem)] text-[#ffd43b]" />
      <SurfaceButton label="X" id="x" settings={settings} press={press} turbo={turbo} className="absolute left-0 top-1/2 size-[clamp(2.75rem,8svh,3.5rem)] -translate-y-1/2 text-[clamp(1.25rem,4.5svh,1.5rem)] text-[#58b9ff]" />
      <SurfaceButton label="B" id="b" settings={settings} press={press} turbo={turbo} className="absolute right-0 top-1/2 size-[clamp(2.75rem,8svh,3.5rem)] -translate-y-1/2 text-[clamp(1.25rem,4.5svh,1.5rem)] text-[#ff5b57]" />
      <SurfaceButton label="A" id="a" settings={settings} press={press} turbo={turbo} className="absolute bottom-0 left-1/2 size-[clamp(2.75rem,8svh,3.5rem)] -translate-x-1/2 text-[clamp(1.25rem,4.5svh,1.5rem)] text-[#62df87]" />
    </div>
  );
}

function Trigger({
  label,
  id,
  settings,
  set,
  mode,
}: {
  label: string;
  id: "lt" | "rt";
  settings: Settings;
  set: Props["set"];
  mode: TriggerMode;
}) {
  const [value, setValue] = useState(0);
  const pointer = useRef<number | null>(null);

  const mapValue = (v: number) => {
    const p = Math.max(0, Math.min(1, v));
    if (mode === "lock") return p > 0.16 ? 1 : 0;
    if (mode === "sniper") return Math.pow(p, 1.65);
    if (mode === "race") return Math.min(1, p * 1.2);
    if (mode === "recoil") return p < 0.18 ? p * 0.35 : Math.min(1, p * 1.12);
    return p;
  };

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const raw = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const next = mapValue(raw);
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
      aria-label={`${label} trigger — ${mode}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        buzz(settings.vibration, 8);
        move(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
      className="flat-pad-trigger grid h-[clamp(2.75rem,7.8svh,3.5rem)] w-[clamp(4.5rem,8vw,6rem)] touch-none place-items-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,#303b47,#10151b)] text-[10px] font-black tracking-[0.25em] text-cyan-300 shadow-[inset_0_2px_2px_rgba(255,255,255,.08),0_6px_14px_rgba(0,0,0,.5)]"
      style={{ boxShadow: value ? "0 0 20px rgba(34,211,238,.25), inset 0 0 12px rgba(0,0,0,.65)" : undefined }}
    >
      <span>{label}</span>
      <span className="absolute bottom-1 text-[5px] tracking-[0.12em] text-slate-500">{mode}</span>
    </button>
  );
}

function MiniScreen({
  profile,
  triggerMode,
  motion,
  turbo,
}: {
  profile: number;
  triggerMode: TriggerMode;
  motion: boolean;
  turbo: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => (v + 1) % 4), 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flat-pad-screen flex h-14 w-28 flex-col items-center justify-center rounded-lg border border-cyan-300/25 bg-[#071018] shadow-[inset_0_0_14px_rgba(34,211,238,.12),0_0_12px_rgba(34,211,238,.1)]">
      <span className="text-[7px] font-black tracking-[0.25em] text-cyan-400/70">APEX 5</span>
      <span className="mt-1 text-[10px] font-mono font-bold text-cyan-200">
        {tick === 0 ? `P${profile}` : tick === 1 ? triggerMode.toUpperCase() : tick === 2 ? (motion ? "GYRO ON" : "GYRO OFF") : (turbo ? "TURBO ON" : "READY")}
      </span>
    </div>
  );
}

function ExtraButton({
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
    <SurfaceButton
      label={label}
      id={id}
      settings={settings}
      press={press}
      className={`h-[clamp(2.25rem,6.5svh,2.75rem)] min-w-[clamp(4rem,7vw,4.5rem)] rounded-xl px-3 text-[9px] text-slate-300 ${className}`}
    />
  );
}

function GyroControl({
  enabled,
  denied,
  onToggle,
}: {
  enabled: boolean;
  denied: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`grid h-9 min-w-16 place-items-center rounded-lg border text-[7px] font-black uppercase tracking-[0.14em] ${enabled ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-black/20 text-slate-400"}`}
    >
      {denied ? "GYRO DENIED" : enabled ? "GYRO ON" : "GYRO"}
    </button>
  );
}

export function FlatPad({ settings, set, press }: Props) {
  const [turbo, setTurbo] = useState(false);
  const [rgb, setRgb] = useState(true);
  const [profile, setProfile] = useState(1);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>("regular");
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroDenied, setGyroDenied] = useState(false);

  const requestGyro = useCallback(async () => {
    try {
      const Orientation = window.DeviceOrientationEvent as
        | (typeof window.DeviceOrientationEvent & {
            requestPermission?: () => Promise<"granted" | "denied">;
          })
        | undefined;

      if (!Orientation) {
        setGyroDenied(true);
        return;
      }

      if (typeof Orientation.requestPermission === "function") {
        const result = await Orientation.requestPermission();
        if (result !== "granted") {
          setGyroDenied(true);
          setGyroEnabled(false);
          return;
        }
      }

      setGyroDenied(false);
      setGyroEnabled((v) => !v);
    } catch {
      setGyroDenied(true);
      setGyroEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!gyroEnabled) return;

    const handler = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      const angle = window.screen.orientation?.angle ?? 0;
      const xTilt = Math.abs(angle) === 90 ? (angle === 90 ? beta : -beta) : gamma;
      const x = Math.max(-1, Math.min(1, xTilt / 35));
      const y = Math.max(-1, Math.min(1, beta / 45));
      set({
        rx: applyCurve(x, settings.deadzone, settings.linearity, settings.sensitivity),
        ry: applyCurve(-y, settings.deadzone, settings.linearity, settings.sensitivity),
      });
    };

    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [gyroEnabled, settings.deadzone, settings.linearity, settings.sensitivity, set]);

  const nextTriggerMode = () => {
    const modes: TriggerMode[] = ["regular", "race", "sniper", "recoil", "lock"];
    const i = modes.indexOf(triggerMode);
    setTriggerMode(modes[(i + 1) % modes.length]);
  };

  const cycleProfile = (delta: number) => {
    setProfile((p) => ((p - 1 + delta + 4) % 4) + 1);
  };

  return (
    <div
      className="flat-pad-root absolute inset-0 overflow-hidden bg-[#05080d] text-slate-100"
      style={{ filter: rgb ? undefined : "saturate(.65)" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_75%_at_50%_8%,#172333_0%,#04070b_68%)]" />
      <div className={`pointer-events-none absolute inset-2 rounded-[1.8rem] border ${rgb ? "border-cyan-300/20" : "border-white/15"} shadow-[0_0_40px_rgba(34,211,238,.08)]`} />

      <div className="flat-pad-top absolute inset-x-0 top-3 flex items-start justify-between px-[max(1rem,env(safe-area-inset-left))]">
        <div className="flex items-center gap-3">
          <Trigger label="LT" id="lt" settings={settings} set={set} mode={triggerMode} />
          <ExtraButton label="LM" id="lm" settings={settings} press={press} />
        </div>
        <div className="flex items-center gap-3">
          <ExtraButton label="RM" id="rm" settings={settings} press={press} />
          <Trigger label="RT" id="rt" settings={settings} set={set} mode={triggerMode} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-[7%] top-[12%] bottom-[8%] rounded-[34%_34%_42%_42%/18%_18%_44%_44%] border border-white/5 bg-[#0b1118]/70 shadow-[inset_0_0_50px_rgba(0,0,0,.7)]" />

      <div className="flat-pad-left absolute bottom-[17%] left-[7%] flex items-center gap-[clamp(1rem,3vw,2.5rem)]">
        <Stick side="left" settings={settings} onMove={(x, y) => set({ lx: x, ly: y })} onClick3={(d) => press("l3", d)} />
        <ApexDPad settings={settings} press={press} turbo={turbo} />
      </div>

      <div className="flat-pad-center absolute left-1/2 top-[27%] flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="flat-pad-center-box relative w-[clamp(14rem,27vw,20rem)] rounded-[2rem] bg-[linear-gradient(145deg,#39434f,#171d24)] px-5 py-4 shadow-[inset_0_2px_2px_rgba(255,255,255,.09),0_12px_24px_rgba(0,0,0,.48)]">
          <div className="flex items-center justify-center gap-3">
            <SurfaceButton label="VIEW" id="back" settings={settings} press={press} className="h-10 min-w-16 rounded-lg text-[8px] text-slate-300" />
            <MiniScreen profile={profile} triggerMode={triggerMode} motion={gyroEnabled} turbo={turbo} />
            <SurfaceButton label="MENU" id="start" settings={settings} press={press} className="h-10 min-w-16 rounded-lg text-[8px] text-slate-300" />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <SurfaceButton label="PROFILE −" id="minus" settings={settings} press={press} onClick={() => cycleProfile(-1)} className="h-9 min-w-20 rounded-md text-[7px]" />
            <SurfaceButton label="HOME" id="home" settings={settings} press={press} className="h-9 min-w-20 rounded-md text-[7px]" />
            <SurfaceButton label="PROFILE +" id="plus" settings={settings} press={press} onClick={() => cycleProfile(1)} className="h-9 min-w-20 rounded-md text-[7px]" />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <SurfaceButton label="FN" id="fn" settings={settings} press={press} className="h-8 min-w-12 rounded-lg text-[7px] text-slate-300" />
            <SurfaceButton label="LOGO" id="logo" settings={settings} press={press} className="h-8 min-w-14 rounded-lg text-[7px] text-slate-300" />
            <button type="button" onClick={() => setTurbo((v) => !v)} className={`h-8 min-w-16 rounded-lg border px-2 text-[7px] font-black uppercase tracking-[0.14em] ${turbo ? "border-orange-300/50 bg-orange-300/10 text-orange-200" : "border-white/10 bg-black/20 text-slate-400"}`}>TURBO</button>
            <GyroControl enabled={gyroEnabled} denied={gyroDenied} onToggle={requestGyro} />
            <button type="button" onClick={nextTriggerMode} className="h-8 min-w-20 rounded-lg border border-white/10 bg-black/20 px-2 text-[7px] font-black uppercase tracking-[0.14em] text-slate-400">TRIGGER</button>
            <button type="button" onClick={() => setRgb((v) => !v)} className={`h-8 min-w-14 rounded-lg border px-2 text-[7px] font-black uppercase tracking-[0.14em] ${rgb ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-black/20 text-slate-400"}`}>RGB</button>
          </div>
        </div>
      </div>

      <div className="flat-pad-right absolute bottom-[17%] right-[7%] flex items-center gap-[clamp(1rem,3vw,2.5rem)]">
        <ApexFaceButtons settings={settings} press={press} turbo={turbo} />
        <Stick side="right" settings={settings} onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? -y : y })} onClick3={(d) => press("r3", d)} />
      </div>

      <div className="flat-pad-bottom absolute bottom-[4%] left-1/2 flex -translate-x-1/2 gap-2">
        <ExtraButton label="M1" id="m1" settings={settings} press={press} />
        <ExtraButton label="M2" id="m2" settings={settings} press={press} />
        <ExtraButton label="M3" id="m3" settings={settings} press={press} />
        <ExtraButton label="M4" id="m4" settings={settings} press={press} />
      </div>

      <div className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 text-[6px] font-bold uppercase tracking-[0.14em] text-slate-600">
        FORCEFLEX TENSION • FORCEADAPT MODES • 6 EXTRA • GYRO • RGB • TURBO
      </div>
    </div>
  );
}
