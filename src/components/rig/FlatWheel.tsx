import { useCallback, useEffect, useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (enabled: boolean, ms = 10) => {
  if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

function Pedal({
  id,
  label,
  settings,
  set,
  accent,
}: {
  id: "clutch" | "brake" | "throttle";
  label: string;
  settings: Settings;
  set: Props["set"];
  accent: string;
}) {
  const [value, setValue] = useState(0);
  const active = useRef<number | null>(null);
  const startY = useRef(0);

  const update = (clientY: number) => {
    const next = Math.max(0, Math.min(1, (startY.current - clientY) / 120));
    setValue(next);
    set({ [id]: next } as Partial<ControllerState>);
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
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        startY.current = e.clientY;
        buzz(settings.vibration, 8);
        update(e.clientY - 120);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="group relative h-[42vh] min-h-44 w-[clamp(4.2rem,7vw,6.2rem)] touch-none select-none overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d12]/95 p-2 shadow-[0_12px_28px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.04)]"
    >
      <span className="absolute inset-2 rounded-[1.05rem] border border-white/5 bg-[linear-gradient(180deg,#151b22,#0a0e13)]" />
      <span
        className="absolute inset-x-4 bottom-10 rounded-xl border border-white/10 bg-gradient-to-b from-[#edf1f4] via-[#b9c0c7] to-[#727a84] shadow-[0_6px_12px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.6)] transition-all"
        style={{ height: `calc(34% + ${value * 54}%)`, boxShadow: `0 0 14px ${accent}33, 0 6px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.6)` }}
      >
        <span className="absolute inset-x-2 top-3 grid gap-2">
          {Array.from({ length: 4 }).map((_, row) => (
            <span key={row} className="grid grid-cols-2 gap-2">
              <i className="size-2 rounded-full bg-[#323842]" />
              <i className="size-2 rounded-full bg-[#323842]" />
            </span>
          ))}
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-2 text-[9px] font-black uppercase tracking-[0.24em] text-slate-300">
        {label}
      </span>
    </button>
  );
}

function Handbrake({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const [value, setValue] = useState(0);
  const active = useRef(false);
  const startY = useRef(0);

  const move = (y: number) => {
    const next = Math.max(0, Math.min(1, (startY.current - y) / 110));
    setValue(next);
    set({ handbrake: next });
  };

  const release = () => {
    active.current = false;
    setValue(0);
    set({ handbrake: 0 });
  };

  return (
    <button
      type="button"
      aria-label="Handbrake"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        startY.current = e.clientY;
        buzz(settings.vibration, 8);
        set({ handbrake: 1 });
        setValue(1);
      }}
      onPointerMove={(e) => active.current && move(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="relative h-40 w-24 touch-none select-none rounded-[1.25rem] border border-white/10 bg-[#0b0f14] shadow-[0_10px_24px_rgba(0,0,0,.5)] active:brightness-125"
    >
      <span className="absolute inset-2 rounded-[1rem] bg-gradient-to-b from-[#171d24] to-[#080b10]" />
      <span
        className="absolute bottom-8 left-1/2 h-[78%] w-4 origin-bottom -translate-x-1/2 rounded-full bg-gradient-to-b from-[#cfd5db] to-[#6e7780] shadow-[0_5px_10px_rgba(0,0,0,.55)] transition-transform"
        style={{ transform: `translateX(-50%) rotate(${-10 - value * 38}deg)` }}
      />
      <span className="absolute bottom-24 left-1/2 size-7 -translate-x-1/2 rounded-full bg-[#171b21] shadow-inner" />
      <span className="absolute inset-x-0 bottom-2 text-[8px] font-black uppercase tracking-[0.18em] text-slate-300">
        HANDBRAKE
      </span>
    </button>
  );
}

function Nitro({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      aria-label="Nitro"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        set({ nitro: 1 });
        buzz(settings.vibration, 10);
      }}
      onPointerUp={() => {
        setDown(false);
        set({ nitro: 0 });
      }}
      onPointerCancel={() => {
        setDown(false);
        set({ nitro: 0 });
      }}
      className={`grid h-14 w-24 touch-none select-none place-items-center rounded-xl border border-cyan-300/25 bg-[linear-gradient(180deg,#27313b,#10151b)] text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200 shadow-[0_7px_16px_rgba(0,0,0,.46),inset_0_1px_0_rgba(255,255,255,.08)] active:translate-y-0.5 ${down ? "brightness-150 ring-2 ring-fuchsia-400/40" : ""}`}
    >
      NITRO
    </button>
  );
}

function Horn({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <button
      type="button"
      aria-label="Horn"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        press("horn", true);
        buzz(settings.vibration, 10);
      }}
      onPointerUp={() => press("horn", false)}
      onPointerCancel={() => press("horn", false)}
      className="absolute left-1/2 top-1/2 z-20 grid size-24 -translate-x-1/2 -translate-y-1/2 touch-none select-none place-items-center rounded-full border-[0.7rem] border-[#171d23] bg-[radial-gradient(circle_at_38%_32%,#3c4651,#12171d_68%)] text-[10px] font-black tracking-[0.18em] text-slate-200 shadow-[inset_0_6px_18px_rgba(0,0,0,.7),0_8px_18px_rgba(0,0,0,.52)] active:brightness-125"
    >
      HORN
    </button>
  );
}

export function FlatWheel({ settings, set, press }: Props) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const steer = useRef(0);
  const pointer = useRef<number | null>(null);
  const lastAngle = useRef(0);
  const accumulated = useRef(0);

  const emit = useCallback((raw: number) => {
    const value = applyCurve(
      Math.max(-1, Math.min(1, raw)),
      settings.deadzone,
      settings.linearity,
      settings.steerSensitivity,
    );
    steer.current = value;
    set({ steer: value });
  }, [set, settings.deadzone, settings.linearity, settings.steerSensitivity]);

  useEffect(() => {
    if (settings.steerMode !== "tilt") return;
    const listener = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      emit((settings.invertTilt ? -gamma : gamma) / settings.maxTiltDeg);
    };
    window.addEventListener("deviceorientation", listener);
    return () => window.removeEventListener("deviceorientation", listener);
  }, [settings.steerMode, settings.invertTilt, settings.maxTiltDeg, emit]);

  const grab = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = wheelRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    lastAngle.current = Math.atan2(e.clientY - cy, e.clientX - cx);
    accumulated.current = steer.current * ((settings.wheelRotationDeg * Math.PI) / 360);
  };

  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const el = wheelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    let delta = angle - lastAngle.current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle.current = angle;
    const max = Math.max(180, settings.wheelRotationDeg) * Math.PI / 360;
    accumulated.current = Math.max(-max, Math.min(max, accumulated.current + delta));
    emit(accumulated.current / max);
  };

  const release = () => {
    pointer.current = null;
    if (settings.autoCentre) emit(0);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#070a0e] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_80%_at_48%_18%,#16202a_0%,#070a0e_67%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-white/20" />
      <div className="pointer-events-none absolute inset-4 rounded-[1.4rem] border border-cyan-400/10" />

      <div className="absolute inset-0 px-6 py-4">
        <div className="relative h-full w-full">
          {/* wheel */} 
          <div className="absolute bottom-[9%] left-[5%]" ref={wheelRef}>
            <div
              className="relative size-[min(58vh,52vw)] min-h-56 min-w-56 touch-none select-none"
              onPointerDown={grab}
              onPointerMove={drag}
              onPointerUp={release}
              onPointerCancel={release}
            >
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,#1d2630_0%,#0d1117_68%)] shadow-[0_22px_40px_rgba(0,0,0,.65),inset_0_0_0_0.55rem_rgba(255,255,255,.02)]" />
              <div className="absolute inset-[5%] rounded-full border-[clamp(.85rem,2vh,1.35rem)] border-[#080b0f]" />
              <div className="absolute inset-[10%] rounded-full border-[clamp(.55rem,1.6vh,1rem)] border-[#2b323b]" />
              <div className="absolute inset-[13%] rounded-full border-[clamp(.45rem,1.2vh,.75rem)] border-[#141a20]" />

              <div className="absolute inset-[18%]">
                <div className="absolute left-1/2 top-1/2 h-[18%] w-[78%] -translate-x-1/2 -translate-y-1/2 rotate-[12deg] rounded-full bg-[#232a32] shadow-[0_8px_14px_rgba(0,0,0,.45)]" />
                <div className="absolute left-1/2 top-1/2 h-[18%] w-[78%] -translate-x-1/2 -translate-y-1/2 -rotate-[12deg] rounded-full bg-[#232a32] shadow-[0_8px_14px_rgba(0,0,0,.45)]" />
                <div className="absolute left-1/2 top-[58%] h-[53%] w-[18%] -translate-x-1/2 rounded-full bg-[#232a32] shadow-[0_8px_14px_rgba(0,0,0,.45)]" />
                <div className="absolute left-1/2 top-[48%] size-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.45rem] border-[#313944] bg-[#12171d] shadow-[inset_0_0_18px_rgba(0,0,0,.7),0_10px_15px_rgba(0,0,0,.45)]" />
                <div className="absolute left-1/2 top-[7%] h-[7%] w-[5%] -translate-x-1/2 rounded-b-lg bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,.75)]" />
                <Horn settings={settings} press={press} />
              </div>
            </div>
          </div>

          {/* pedals */}
          <div className="absolute bottom-[8%] right-[16%] flex items-end gap-[clamp(.7rem,1.5vw,1.25rem)]">
            <Pedal id="clutch" label="CLUTCH" settings={settings} set={set} accent="#60a5fa" />
            <Pedal id="brake" label="BRAKE" settings={settings} set={set} accent="#f59e0b" />
            <Pedal id="throttle" label="GAS" settings={settings} set={set} accent="#22c55e" />
          </div>

          {/* handbrake + nitro */}
          <div className="absolute bottom-[14%] right-[4%] flex flex-col items-center gap-3">
            <Handbrake settings={settings} set={set} />
            <Nitro settings={settings} set={set} />
          </div>
        </div>
      </div>
    </div>
  );
}
