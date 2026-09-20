import { useCallback, useEffect, useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";
import { Gauge, Map, Settings2, Volume2 } from "lucide-react";

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

function WheelButton({
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
      onPointerUp={(e) => {
        e.stopPropagation();
        press(id, false);
      }}
      onPointerCancel={() => press(id, false)}
      className={`grid touch-none select-none place-items-center rounded-[0.65rem] border border-white/10 bg-gradient-to-b from-[#3a424d] to-[#1a1f27] text-slate-100 shadow-[0_4px_8px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.08)] active:scale-95 active:brightness-125 ${className}`}
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
  const pointer = useRef<number | null>(null);
  const start = useRef(0);

  const update = (y: number) => {
    const v = Math.max(0, Math.min(1, (start.current - y) / 125));
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
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        start.current = e.clientY;
        setValue(1);
        set({ [id]: 1 } as Partial<ControllerState>);
        buzz(settings.vibration, 8);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      aria-label={label}
      className={`relative h-[32vh] min-h-36 ${wide ? "w-[clamp(4.8rem,7.2vw,6.5rem)]" : "w-[clamp(4.25rem,6.6vw,6rem)]"} touch-none overflow-hidden rounded-[1.2rem] border border-black/70 bg-gradient-to-b from-[#191d22] to-[#080a0d] p-2 shadow-[0_10px_22px_rgba(0,0,0,.62),inset_0_1px_0_rgba(255,255,255,.08)] active:brightness-125`}
    >
      <span className="absolute inset-x-2 top-2 bottom-2 rounded-[0.9rem] border border-white/5 bg-[#0c1015]" />
      <span
        className="absolute inset-x-4 bottom-5 rounded-md border border-slate-200/10 bg-gradient-to-b from-[#d7dde4] to-[#7d858f] shadow-[0_3px_7px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.45)]"
        style={{ height: `calc(34% + ${value * 58}%)` }}
      >
        <span className="absolute inset-x-2 top-2 grid gap-1.5">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="grid grid-cols-2 gap-2">
              <i className="size-2 rounded-full bg-[#31373e]/85 shadow-inner" />
              <i className="size-2 rounded-full bg-[#31373e]/85 shadow-inner" />
            </span>
          ))}
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-black tracking-[0.18em] text-slate-400">
        {label}
      </span>
    </button>
  );
}

function DPad({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const hit = (id: string, label: string, className: string) => (
    <WheelButton
      key={id}
      label={label}
      id={"dpad_" + id}
      settings={settings}
      press={press}
      className={"absolute " + className + " size-10 rounded-md bg-[#252b32] text-lg text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_3px_6px_rgba(0,0,0,.4)]"}
    />
  );

  return (
    <div className="relative size-[4.5rem]">
      <div className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#151a1f]" />
      {hit("up", "↑", "left-1/2 top-0 -translate-x-1/2")}
      {hit("left", "←", "left-0 top-1/2 -translate-y-1/2")}
      {hit("right", "→", "right-0 top-1/2 -translate-y-1/2")}
      {hit("down", "↓", "bottom-0 left-1/2 -translate-x-1/2")}
    </div>
  );
}

function FaceButtons({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const items = [
    ["triangle", "△", "text-emerald-300"],
    ["circle", "○", "text-red-400"],
    ["cross", "×", "text-sky-300"],
    ["square", "□", "text-pink-300"],
  ] as const;

  return (
    <div className="relative size-24">
      <WheelButton label={items[0][1]} id="y" settings={settings} press={press} className="absolute left-1/2 top-0 size-10 -translate-x-1/2 text-lg text-emerald-300" />
      <WheelButton label={items[1][1]} id="b" settings={settings} press={press} className="absolute right-0 top-1/2 size-10 -translate-y-1/2 text-lg text-red-400" />
      <WheelButton label={items[2][1]} id="a" settings={settings} press={press} className="absolute bottom-0 left-1/2 size-10 -translate-x-1/2 text-lg text-sky-300" />
      <WheelButton label={items[3][1]} id="x" settings={settings} press={press} className="absolute left-0 top-1/2 size-10 -translate-y-1/2 text-lg text-pink-300" />
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
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      emit((settings.invertTilt ? -gamma : gamma) / (settings.maxTiltDeg || 30));
    };
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
    <div className="absolute inset-0 overflow-hidden bg-[#090b0f] text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_38%_20%,#1c232c_0%,#080a0e_64%)]" />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onModeChange} className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#1a1f26] text-sky-300 shadow-lg" aria-label="Gamepad mode">
            <Gauge size={18} />
          </button>
          <button type="button" onClick={onSettings} className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#1a1f26] text-slate-300 shadow-lg" aria-label="Settings">
            <Settings2 size={18} />
          </button>
        </div>
        <div className="h-1.5 w-20 rounded-full bg-[#242a31] shadow-inner" />
      </header>

      <div className="absolute left-[max(1rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2">
        <div
          className="relative size-[clamp(18rem,54vh,27rem)] touch-none select-none"
          onPointerDown={onWheelDown}
          onPointerMove={onWheelMove}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <div className="absolute inset-0 rounded-full bg-[#171b21] shadow-[0_20px_40px_rgba(0,0,0,.72)]" />
          <div className="absolute inset-[4%] rounded-full border-[clamp(1.1rem,3.1vh,1.7rem)] border-[#06080b] bg-[#05070a] shadow-[inset_0_0_0_2px_rgba(255,255,255,.045),inset_0_0_22px_rgba(0,0,0,.9)]" />
          <div
            className="absolute inset-[8%] rounded-full border-[clamp(.8rem,2.2vh,1.25rem)] border-[#20262d] bg-[#11161d] transition-transform duration-75"
            style={{ transform: `rotate(${visualSteer * 450}deg)` }}
          >
            <div className="absolute left-1/2 top-[-1%] h-[8%] w-[5%] -translate-x-1/2 rounded-b-md bg-[#21b6e9] shadow-[0_0_10px_rgba(33,182,233,.65)]" />

            <div className="absolute left-[4%] top-[44%] h-[27%] w-[23%] -rotate-[10deg] rounded-[0.85rem] bg-[#1b2129] shadow-[inset_0_0_0_2px_rgba(255,255,255,.04)]" />
            <div className="absolute right-[4%] top-[44%] h-[27%] w-[23%] rotate-[10deg] rounded-[0.85rem] bg-[#1b2129] shadow-[inset_0_0_0_2px_rgba(255,255,255,.04)]" />

            <div className="absolute left-1/2 top-1/2 z-10 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#303741] bg-[#171b22] shadow-[0_5px_10px_rgba(0,0,0,.5),inset_0_0_18px_rgba(0,0,0,.65)]">
              <div className="absolute inset-[14%] grid place-items-center rounded-full border border-white/10 bg-[#20262e]">
                <span className="text-[clamp(1rem,2.3vw,1.55rem)] font-black tracking-tight text-slate-100">PS</span>
              </div>
            </div>

            <div className="absolute left-[3%] top-[25%]">
              <WheelButton label="L2" id="lt" settings={settings} press={press} className="h-8 w-10 text-[8px] text-cyan-300" />
            </div>
            <div className="absolute left-[8%] top-[30%]">
              <DPad settings={settings} press={press} />
            </div>
            <div className="absolute right-[3%] top-[25%]">
              <WheelButton label="R2" id="rt" settings={settings} press={press} className="h-8 w-10 text-[8px] text-cyan-300" />
            </div>
            <div className="absolute right-[8%] top-[30%]">
              <FaceButtons settings={settings} press={press} />
            </div>

            <div className="absolute left-[27%] top-[57%] flex flex-col gap-2">
              <WheelButton label="+" id="plus" settings={settings} press={press} className="size-11 text-xl" />
              <WheelButton label="−" id="minus" settings={settings} press={press} className="size-11 text-xl" />
            </div>

            <div className="absolute right-[24%] top-[57%] size-14 rounded-full border-[0.32rem] border-[#171a1f] bg-[#b32825] shadow-[inset_0_0_0_2px_rgba(255,255,255,.13),0_5px_10px_rgba(0,0,0,.45)]">
              <button
                type="button"
                aria-label="Rotary selector"
                onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); buzz(settings.vibration); press("wheel_spinner", true); }}
                onPointerUp={(e) => { e.stopPropagation(); press("wheel_spinner", false); }}
                onPointerCancel={() => press("wheel_spinner", false)}
                className="absolute inset-0 rounded-full"
              />
              <div className="pointer-events-none absolute inset-[20%] rounded-full border border-black/30 bg-[#181b20]" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[56%] w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d84845]" />
            </div>

            <div className="absolute left-[12%] top-[63%]">
              <WheelButton label="L3" id="l3" settings={settings} press={press} className="size-10 text-[9px]" />
            </div>
            <div className="absolute right-[12%] top-[63%]">
              <WheelButton label="R3" id="r3" settings={settings} press={press} className="size-10 text-[9px]" />
            </div>

            <div className="absolute left-1/2 bottom-[4%] flex -translate-x-1/2 flex-col gap-1">
              <WheelButton label="SHARE" id="share" settings={settings} press={press} className="h-6 min-w-14 rounded-md px-2 text-[6px]" />
              <WheelButton label="OPTIONS" id="start" settings={settings} press={press} className="h-6 min-w-14 rounded-md px-2 text-[6px]" />
              <WheelButton label="PS" id="home" settings={settings} press={press} className="h-6 min-w-14 rounded-md px-2 text-[7px]" />
            </div>

            <div className="absolute left-[17%] top-[4%] h-[16%] w-[8%] rounded-[0.7rem] bg-gradient-to-b from-[#cbd0d6] to-[#6d737a] shadow-[0_5px_10px_rgba(0,0,0,.55)]" />
            <div className="absolute right-[17%] top-[4%] h-[16%] w-[8%] rounded-[0.7rem] bg-gradient-to-b from-[#cbd0d6] to-[#6d737a] shadow-[0_5px_10px_rgba(0,0,0,.55)]" />
          </div>
        </div>
      </div>

      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-1/2 -translate-y-1/2">
        <div className="rounded-[1.35rem] border border-black/70 bg-[#11151a] p-3 shadow-[0_15px_30px_rgba(0,0,0,.58)]">
          <div className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.22em] text-slate-500">PEDALS</div>
          <div className="flex items-end gap-[clamp(.65rem,1.4vw,1rem)]">
            <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
            <Pedal label="BRAKE" id="brake" settings={settings} set={set} wide />
            <Pedal label="GAS" id="throttle" settings={settings} set={set} />
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#07090c] shadow-inner" />
        </div>
      </div>

    </div>
  );
}
