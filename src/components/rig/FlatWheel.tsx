import { useCallback, useEffect, useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";
import { Gauge, Map, Menu, RotateCcw, Settings2, Volume2 } from "lucide-react";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (on: boolean, ms = 10) => {
  if (on && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

function ControlButton({
  label,
  id,
  settings,
  press,
  className = "",
  active = false,
}: {
  label: React.ReactNode;
  id: string;
  settings: Settings;
  press: Props["press"];
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        press(id, false);
      }}
      onPointerCancel={() => press(id, false)}
      className={`grid min-h-14 min-w-14 touch-none select-none place-items-center rounded-lg border border-white/10 bg-[#252b34] px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-200 shadow-[0_4px_10px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.06)] active:scale-[0.96] ${active ? "ring-1 ring-cyan-400/60" : ""} ${className}`}
    >
      {label}
    </button>
  );
}

function IconButton({
  id,
  label,
  settings,
  press,
  children,
}: {
  id: string;
  label: string;
  settings: Settings;
  press: Props["press"];
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        press(id, false);
      }}
      onPointerCancel={() => press(id, false)}
      className="grid size-11 touch-none place-items-center rounded-full border border-cyan-400/20 bg-[#1a222c] text-cyan-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,.03),0_4px_12px_rgba(0,0,0,.35)] active:scale-95"
    >
      {children}
    </button>
  );
}

function Pedal({
  label,
  id,
  settings,
  set,
}: {
  label: string;
  id: "throttle" | "brake" | "clutch";
  settings: Settings;
  set: Props["set"];
}) {
  const [value, setValue] = useState(0);
  const active = useRef<number | null>(null);
  const start = useRef(0);

  const update = (y: number) => {
    const v = Math.max(0, Math.min(1, (start.current - y) / 130));
    setValue(v);
    set({ [id]: v } as Partial<ControllerState>);
  };

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        start.current = e.clientY;
        setValue(1);
        set({ [id]: 1 } as Partial<ControllerState>);
        buzz(settings.vibration, 8);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e.clientY)}
      onPointerUp={() => {
        active.current = null;
        setValue(0);
        set({ [id]: 0 } as Partial<ControllerState>);
      }}
      onPointerCancel={() => {
        active.current = null;
        setValue(0);
        set({ [id]: 0 } as Partial<ControllerState>);
      }}
      className="relative h-[34vh] min-h-36 w-[clamp(4.5rem,7vw,6.5rem)] touch-none overflow-hidden rounded-lg border border-white/10 bg-[#242a33] shadow-[0_8px_18px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.05)] active:brightness-125"
    >
      <span className="absolute inset-2 rounded-md border border-white/5 bg-gradient-to-b from-[#353d49] to-[#171c24]" />
      <span
        className="absolute inset-x-5 bottom-4 rounded-md bg-cyan-400/20"
        style={{ height: `calc((100% - 2rem) * ${Math.max(0.08, value)})` }}
      />
      <span className="absolute inset-x-0 bottom-4 text-center text-[10px] font-black tracking-[0.18em] text-slate-300">
        {label}
      </span>
    </button>
  );
}

export function FlatWheel({ settings, set, press }: Props) {
  const steer = useRef(0);
  const pointer = useRef<{ id: number; last: number; acc: number } | null>(null);
  const [visualSteer, setVisualSteer] = useState(0);
  const max = Math.max(180, settings.wheelRotationDeg || 900) * Math.PI / 360;

  const emit = useCallback(
    (raw: number) => {
      const v = applyCurve(
        Math.max(-1, Math.min(1, raw)),
        settings.deadzone,
        settings.linearity,
        settings.steerSensitivity,
      );
      steer.current = v;
      setVisualSteer(v);
      set({ steer: v });
    },
    [set, settings.deadzone, settings.linearity, settings.steerSensitivity],
  );

  useEffect(() => {
    if (settings.steerMode !== "tilt") return;
    const onOrient = (e: DeviceOrientationEvent) =>
      emit((settings.invertTilt ? -(e.gamma ?? 0) : (e.gamma ?? 0)) / (settings.maxTiltDeg || 30));
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [settings.steerMode, settings.invertTilt, settings.maxTiltDeg, emit]);

  const onWheelDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    pointer.current = {
      id: e.pointerId,
      last: Math.atan2(e.clientY - cy, e.clientX - cx),
      acc: steer.current * max,
    };
  };

  const onWheelMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    const a = Math.atan2(
      e.clientY - (r.top + r.height / 2),
      e.clientX - (r.left + r.width / 2),
    );
    let d = a - p.last;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.last = a;
    p.acc = Math.max(-max, Math.min(max, p.acc + d));
    emit(p.acc / max);
  };

  const release = () => {
    pointer.current = null;
    if (settings.autoCentre) emit(0);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0%,#151d28_0%,#07090d_68%)] text-slate-200">
      <div className="pointer-events-none absolute inset-2 rounded-[2rem] border border-white/20" />
      <div className="pointer-events-none absolute inset-3 rounded-[1.8rem] border border-cyan-400/15" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="flex items-center gap-2">
          <ControlButton label="MENU" id="menu" settings={settings} press={press} className="min-h-10 min-w-20" />
          <IconButton id="horn" label="Horn" settings={settings} press={press}><Volume2 size={18} /></IconButton>
          <IconButton id="mode" label="Mode" settings={settings} press={press}><Gauge size={18} /></IconButton>
        </div>
        <div className="flex items-center gap-2">
          <IconButton id="map" label="Map" settings={settings} press={press}><Map size={18} /></IconButton>
          <button type="button" onClick={() => press("settings", true)} onPointerUp={() => press("settings", false)} className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#242a33] text-slate-200 shadow-lg">
            <Settings2 size={18} />
          </button>
        </div>
      </div>

      <div className="absolute left-[max(1.25rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2">
        <div
          className="relative size-[clamp(13rem,42vh,24rem)] touch-none"
          onPointerDown={onWheelDown}
          onPointerMove={onWheelMove}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <div className="absolute inset-0 rounded-full border-[clamp(0.75rem,2vh,1.2rem)] border-[#11161e] bg-[#202731] shadow-[0_18px_35px_rgba(0,0,0,.55),inset_0_0_0_2px_rgba(255,255,255,.05)]" />
          <div
            className="absolute inset-[8%] rounded-full border-[clamp(.35rem,1vh,.65rem)] border-[#303946] bg-[#171d26] transition-transform duration-75"
            style={{ transform: `rotate(${visualSteer * 450}deg)` }}
          >
            <div className="absolute left-1/2 top-0 h-[18%] w-[8%] -translate-x-1/2 rounded-b-md bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.7)]" />
            <div className="absolute left-[13%] top-[16%] h-[17%] w-[14%] rounded-[35%] bg-[#252d38] shadow-[inset_0_0_0_2px_rgba(255,255,255,.04)]" />
            <div className="absolute right-[13%] top-[16%] h-[17%] w-[14%] rounded-[35%] bg-[#252d38] shadow-[inset_0_0_0_2px_rgba(255,255,255,.04)]" />
            <div className="absolute bottom-[15%] left-1/2 h-[17%] w-[18%] -translate-x-1/2 rounded-xl bg-[#252d38] shadow-[inset_0_0_0_2px_rgba(255,255,255,.04)]" />
            <div className="absolute left-1/2 top-1/2 h-[27%] w-[27%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/25 bg-[#202733] shadow-[inset_0_0_16px_rgba(0,0,0,.55)]">
              <div className="grid h-full place-items-center text-[clamp(.5rem,1.2vw,.8rem)] font-black tracking-[.22em] text-cyan-300/80">STEER</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
            {["4", "5", "6"].map((id) => (
              <ControlButton key={id} label={id} id={`wheel_${id}`} settings={settings} press={press} className="min-h-12 min-w-16" />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ControlButton label="ENTER" id="start" settings={settings} press={press} className="min-h-14 min-w-28 text-[10px]" />
            <ControlButton label="MODE" id="mode" settings={settings} press={press} className="min-h-12 min-w-16 text-[9px]" />
          </div>
          <div className="flex gap-3">
            {["1", "2", "3"].map((id) => (
              <ControlButton key={id} label={id} id={`wheel_${id}`} settings={settings} press={press} className="min-h-12 min-w-16" />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-[max(1.25rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2">
        <div className="flex items-end gap-3">
          <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
          <Pedal label="BRAKE" id="brake" settings={settings} set={set} />
          <Pedal label="GAS" id="throttle" settings={settings} set={set} />
        </div>
      </div>

      <div className="absolute bottom-[max(.75rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] text-[9px] font-black uppercase tracking-[.2em] text-cyan-300/70">
        TOUCH STEERING
      </div>
    </div>
  );
}
