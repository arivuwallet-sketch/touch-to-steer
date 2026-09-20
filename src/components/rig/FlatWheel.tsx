import { useCallback, useEffect, useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";
import { Gauge, Settings2 } from "lucide-react";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
  onModeChange?: () => void;
  onSettings?: () => void;
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
  onClick,
}: {
  label: React.ReactNode;
  id: string;
  settings: Settings;
  press: Props["press"];
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration);
        press(id, true);
      }}
      onPointerUp={() => press(id, false)}
      onPointerCancel={() => press(id, false)}
      className={`grid touch-none select-none place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-[#343c47] to-[#171c23] text-slate-100 shadow-[0_5px_11px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.06)] active:scale-95 active:brightness-125 ${className}`}
    >
      {label}
    </button>
  );
}

function Pedal({
  label,
  id,
  settings,
  set,
  wide = false,
}: {
  label: string;
  id: "throttle" | "brake" | "clutch";
  settings: Settings;
  set: Props["set"];
  wide?: boolean;
}) {
  const [value, setValue] = useState(0);
  const active = useRef<number | null>(null);
  const start = useRef(0);

  const update = (y: number) => {
    const v = Math.max(0, Math.min(1, (start.current - y) / 125));
    setValue(v);
    set({ [id]: v } as Partial<ControllerState>);
  };

  const release = () => {
    active.current = null;
    setValue(0);
    set({ [id]: 0 } as Partial<ControllerState>);
  };

  return (
    <button
      type="button"
      aria-label={label}
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
      onPointerUp={release}
      onPointerCancel={release}
      className={`relative h-[34vh] min-h-36 ${wide ? "w-[clamp(4.8rem,6vw,6.8rem)]" : "w-[clamp(4.4rem,5.5vw,6.2rem)]"} touch-none overflow-hidden rounded-[1rem] border border-black/70 bg-[#090c10] p-2 shadow-[0_10px_22px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.06)] active:brightness-125`}
    >
      <span className="absolute inset-2 rounded-[0.8rem] border border-white/5 bg-[#11161c]" />
      <span
        className="absolute inset-x-4 bottom-5 rounded-[0.7rem] border border-white/10 bg-gradient-to-b from-[#e1e5e9] to-[#777f88] shadow-[0_3px_7px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.5)]"
        style={{ height: `calc(36% + ${value * 54}%)` }}
      >
        <span className="absolute inset-x-2 top-2 grid gap-1.5">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="grid grid-cols-2 gap-2">
              <i className="size-2 rounded-full bg-[#30363e]" />
              <i className="size-2 rounded-full bg-[#30363e]" />
            </span>
          ))}
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-black tracking-[0.18em] text-slate-400">
        {label}
      </span>
    </button>
  );
}

function DPad({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const key = (id: string, symbol: string, pos: string) => (
    <ControlButton
      key={id}
      label={symbol}
      id={`dpad_${id}`}
      settings={settings}
      press={press}
      className={`absolute ${pos} size-10 rounded-lg text-lg text-slate-300`}
    />
  );

  return (
    <div className="relative size-[7.5rem]">
      <div className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[#10151b] shadow-inner" />
      {key("up", "↑", "left-1/2 top-0 -translate-x-1/2")}
      {key("left", "←", "left-0 top-1/2 -translate-y-1/2")}
      {key("right", "→", "right-0 top-1/2 -translate-y-1/2")}
      {key("down", "↓", "bottom-0 left-1/2 -translate-x-1/2")}
    </div>
  );
}

function FaceButtons({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <div className="relative size-[7.5rem]">
      <ControlButton label="△" id="y" settings={settings} press={press} className="absolute left-1/2 top-0 size-11 -translate-x-1/2 text-xl text-emerald-300" />
      <ControlButton label="○" id="b" settings={settings} press={press} className="absolute right-0 top-1/2 size-11 -translate-y-1/2 text-xl text-red-400" />
      <ControlButton label="×" id="a" settings={settings} press={press} className="absolute bottom-0 left-1/2 size-11 -translate-x-1/2 text-xl text-sky-300" />
      <ControlButton label="□" id="x" settings={settings} press={press} className="absolute left-0 top-1/2 size-11 -translate-y-1/2 text-xl text-pink-300" />
    </div>
  );
}

export function FlatWheel({ settings, set, press, onModeChange, onSettings }: Props) {
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
    const onOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      emit((settings.invertTilt ? -gamma : gamma) / (settings.maxTiltDeg || 30));
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
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
    <div className="absolute inset-0 overflow-hidden bg-[#090c10] text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_35%_10%,#1b232d_0%,#07090c_68%)]" />
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onModeChange} aria-label="Gamepad mode" className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#181e25] text-sky-300 shadow-lg">
            <Gauge size={18} />
          </button>
          <button type="button" onClick={onSettings} aria-label="Settings" className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#181e25] text-slate-300 shadow-lg">
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-[max(1rem,env(safe-area-inset-left))]">
        <div className="grid grid-cols-[minmax(18rem,25vw)_minmax(17rem,22vw)_minmax(18rem,25vw)] items-center justify-center gap-[clamp(1rem,2.5vw,2.2rem)]">
          {/* Clean wheel: no controller buttons inside the rim. */}
          <div className="flex justify-center">
            <div
              className="relative size-[clamp(18rem,48vh,25rem)] touch-none select-none"
              onPointerDown={onWheelDown}
              onPointerMove={onWheelMove}
              onPointerUp={release}
              onPointerCancel={release}
            >
              <div className="absolute inset-0 rounded-full bg-[#191d23] shadow-[0_20px_42px_rgba(0,0,0,.72)]" />
              <div className="absolute inset-[3%] rounded-full border-[clamp(1.2rem,3.2vh,1.8rem)] border-[#06080b] bg-[#05070a]" />
              <div
                className="absolute inset-[7%] rounded-full border-[clamp(.9rem,2.3vh,1.35rem)] border-[#272d34] bg-[#11161c] transition-transform duration-75"
                style={{ transform: `rotate(${visualSteer * 450}deg)` }}
              >
                <div className="absolute left-1/2 top-[-1%] h-[9%] w-[5%] -translate-x-1/2 rounded-b-md bg-[#1fb5e8] shadow-[0_0_12px_rgba(31,181,232,.65)]" />
                <div className="absolute left-[18%] top-[4%] h-[8%] w-[7%] rounded-full bg-[#d7dbe0] shadow-[0_4px_8px_rgba(0,0,0,.5)]" />
                <div className="absolute right-[18%] top-[4%] h-[8%] w-[7%] rounded-full bg-[#d7dbe0] shadow-[0_4px_8px_rgba(0,0,0,.5)]" />
              </div>
              <div className="absolute left-1/2 top-1/2 size-[27%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#333a43] bg-[#171c23] shadow-[inset_0_0_18px_rgba(0,0,0,.7),0_5px_10px_rgba(0,0,0,.45)]">
                <div className="absolute inset-[16%] grid place-items-center rounded-full border border-white/10 bg-[#222933]">
                  <span className="text-sm font-black text-slate-200">G</span>
                </div>
              </div>
            </div>
          </div>

          {/* Separate button console. Nothing here overlaps the wheel. */}
          <div className="flex h-[min(62vh,30rem)] flex-col items-center justify-center rounded-[1.4rem] border border-white/10 bg-[#11161d]/90 p-4 shadow-[0_18px_32px_rgba(0,0,0,.55)] backdrop-blur-sm">
            <div className="mb-3 text-[8px] font-black uppercase tracking-[0.24em] text-slate-500">CONTROLS</div>
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-3">
                <div className="text-[8px] font-black tracking-[0.16em] text-slate-500">DIRECTION</div>
                <DPad settings={settings} press={press} />
                <div className="flex gap-2">
                  <ControlButton label="L2" id="lt" settings={settings} press={press} className="h-10 w-14 text-[9px]" />
                  <ControlButton label="L3" id="l3" settings={settings} press={press} className="h-10 w-14 text-[9px]" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="text-[8px] font-black tracking-[0.16em] text-slate-500">ACTION</div>
                <FaceButtons settings={settings} press={press} />
                <div className="flex gap-2">
                  <ControlButton label="R2" id="rt" settings={settings} press={press} className="h-10 w-14 text-[9px]" />
                  <ControlButton label="R3" id="r3" settings={settings} press={press} className="h-10 w-14 text-[9px]" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <ControlButton label="−" id="minus" settings={settings} press={press} className="size-11 text-xl" />
              <ControlButton label="+" id="plus" settings={settings} press={press} className="size-11 text-xl" />
              <ControlButton label="PS" id="home" settings={settings} press={press} className="size-11 text-[9px]" />
            </div>
            <div className="mt-2 flex gap-2">
              <ControlButton label="SHARE" id="share" settings={settings} press={press} className="h-9 min-w-20 text-[8px]" />
              <ControlButton label="OPTIONS" id="start" settings={settings} press={press} className="h-9 min-w-20 text-[8px]" />
            </div>
          </div>

          {/* Separate pedal assembly. */}
          <div className="rounded-[1.4rem] border border-black/70 bg-[#11151a] p-3 shadow-[0_16px_30px_rgba(0,0,0,.58)]">
            <div className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.22em] text-slate-500">PEDALS</div>
            <div className="flex items-end justify-center gap-[clamp(.55rem,1vw,.9rem)]">
              <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
              <Pedal label="BRAKE" id="brake" settings={settings} set={set} wide />
              <Pedal label="GAS" id="throttle" settings={settings} set={set} />
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#07090c] shadow-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}
