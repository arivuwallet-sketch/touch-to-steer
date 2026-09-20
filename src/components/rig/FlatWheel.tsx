import { useCallback, useEffect, useRef, useState } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (on: boolean, ms = 10) => {
  if (on && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

function Pedal({
  label,
  id,
  settings,
  set,
  brake = false,
}: {
  label: string;
  id: "clutch" | "brake" | "throttle";
  settings: Settings;
  set: Props["set"];
  brake?: boolean;
}) {
  const [value, setValue] = useState(0);
  const pointer = useRef<number | null>(null);
  const startY = useRef(0);

  const update = (y: number) => {
    const v = Math.max(0, Math.min(1, (startY.current - y) / 125));
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
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        startY.current = e.clientY;
        setValue(1);
        set({ [id]: 1 } as Partial<ControllerState>);
        buzz(settings.vibration, 8);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className={`relative h-[48vh] min-h-48 ${brake ? "w-[clamp(5rem,5.8vw,6.8rem)]" : "w-[clamp(4.6rem,5.2vw,6.2rem)]"} touch-none select-none overflow-hidden rounded-[1.3rem] border border-black/80 bg-[#080b0f] p-2 shadow-[0_12px_24px_rgba(0,0,0,.68)] active:brightness-125`}
    >
      <span className="absolute inset-2 rounded-[1rem] border border-white/5 bg-[#11161c]" />
      <span
        className="absolute inset-x-5 bottom-8 rounded-[0.85rem] border border-black/20 bg-gradient-to-b from-[#e2e6ea] to-[#767e87] shadow-[0_4px_9px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.55)]"
        style={{ height: `calc(44% + ${value * 45}%)` }}
      >
        <span className="absolute inset-x-3 top-3 grid gap-2.5">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="grid grid-cols-2 gap-3">
              <i className="size-2.5 rounded-full bg-[#30363d]" />
              <i className="size-2.5 rounded-full bg-[#30363d]" />
            </span>
          ))}
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-black tracking-[0.2em] text-slate-300">
        {label}
      </span>
    </button>
  );
}

function Handbrake({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const [value, setValue] = useState(0);
  const active = useRef(false);
  const startY = useRef(0);

  const update = (y: number) => {
    const v = Math.max(0, Math.min(1, (startY.current - y) / 120));
    setValue(v);
    set({ handbrake: v });
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
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        startY.current = e.clientY;
        setValue(1);
        set({ handbrake: 1 });
        buzz(settings.vibration, 8);
      }}
      onPointerMove={(e) => active.current && update(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="relative h-[30vh] min-h-36 w-[clamp(4.8rem,5.8vw,6.8rem)] touch-none select-none overflow-hidden rounded-[1.25rem] border border-black/80 bg-[#090d12] shadow-[0_12px_24px_rgba(0,0,0,.68)] active:brightness-125"
    >
      <span className="absolute inset-2 rounded-[1rem] border border-white/5 bg-[#11161c]" />
      <span
        className="absolute bottom-[11%] left-1/2 h-[64%] w-[22%] -translate-x-1/2 origin-bottom rounded-full bg-gradient-to-b from-[#cfd5da] via-[#777f88] to-[#252a30] shadow-[0_5px_10px_rgba(0,0,0,.52),inset_0_1px_0_rgba(255,255,255,.35)]"
        style={{ transform: `translateX(-50%) rotate(${-18 - value * 32}deg)` }}
      />
      <span className="absolute bottom-[69%] left-1/2 size-[31%] -translate-x-1/2 rounded-full bg-[#15191e] shadow-[inset_0_0_0_2px_rgba(255,255,255,.06)]" />
      <span className="absolute inset-x-0 bottom-2 text-center text-[9px] font-black tracking-[0.2em] text-slate-300">
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
        e.stopPropagation();
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
      className={`relative grid h-20 w-28 touch-none select-none place-items-center overflow-hidden rounded-2xl border border-purple-300/20 bg-gradient-to-b from-[#4d2570] to-[#1a1027] text-xs font-black tracking-[0.2em] text-purple-100 shadow-[0_8px_18px_rgba(0,0,0,.55),0_0_18px_rgba(168,85,247,.22)] active:scale-95 ${down ? "brightness-125" : ""}`}
    >
      <span className="absolute inset-2 rounded-xl border border-purple-200/10" />
      <span className="relative">NITRO</span>
    </button>
  );
}

function Horn({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <button
      type="button"
      aria-label="Horn"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        press("horn", true);
        buzz(settings.vibration, 10);
      }}
      onPointerUp={() => press("horn", false)}
      onPointerCancel={() => press("horn", false)}
      className="pointer-events-auto absolute left-1/2 top-1/2 grid size-[15%] min-h-16 min-w-16 -translate-x-1/2 -translate-y-1/2 touch-none select-none place-items-center rounded-full border-[0.28rem] border-[#303740] bg-[#1a2028] text-[10px] font-black tracking-[0.18em] text-slate-200 shadow-[0_8px_16px_rgba(0,0,0,.65),inset_0_0_18px_rgba(0,0,0,.7)] active:brightness-125"
    >
      HORN
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
    const listener = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      emit((settings.invertTilt ? -gamma : gamma) / (settings.maxTiltDeg || 30));
    };
    window.addEventListener("deviceorientation", listener);
    return () => window.removeEventListener("deviceorientation", listener);
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
    <div className="absolute inset-0 overflow-hidden bg-[#07090d] text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_85%_at_40%_18%,#1b232d_0%,#05070a_66%)]" />

      <div className="absolute inset-0 flex items-center justify-center px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex w-full max-w-[1180px] items-center justify-center gap-[clamp(1.5rem,3.5vw,4rem)]">
          <div className="relative shrink-0">
            <div
              className="relative size-[clamp(20rem,64vh,33rem)] touch-none select-none"
              onPointerDown={onWheelDown}
              onPointerMove={onWheelMove}
              onPointerUp={release}
              onPointerCancel={release}
            >
              <div className="absolute inset-0 rounded-full bg-[#171b20] shadow-[0_26px_45px_rgba(0,0,0,.78)]" />
              <div className="absolute inset-[3%] rounded-full border-[clamp(1.2rem,3.4vh,2rem)] border-[#050608] bg-[#07090c]" />
              <div
                className="absolute inset-[8%] rounded-full border-[clamp(1rem,2.8vh,1.6rem)] border-[#282f37] bg-[#10151b] transition-transform duration-75"
                style={{ transform: `rotate(${visualSteer * 450}deg)` }}
              >
                <div className="absolute left-1/2 top-[-2%] h-[11%] w-[6%] -translate-x-1/2 rounded-b-[0.8rem] bg-[#16b9ed] shadow-[0_0_16px_rgba(22,185,237,.7)]" />
              </div>

              {/* G29-inspired three-spoke structure; no gamepad buttons. */}
              <div className="pointer-events-none absolute left-[16%] top-[40%] h-[30%] w-[27%] -rotate-[12deg] rounded-[1.3rem] bg-[#1a2028]" />
              <div className="pointer-events-none absolute right-[16%] top-[40%] h-[30%] w-[27%] rotate-[12deg] rounded-[1.3rem] bg-[#1a2028]" />
              <div className="pointer-events-none absolute left-1/2 bottom-[14%] h-[26%] w-[18%] -translate-x-1/2 rounded-[1.3rem] bg-[#1a2028]" />

              <div className="pointer-events-none absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.28rem] border-[#303740] bg-[#151a21] shadow-[0_8px_16px_rgba(0,0,0,.65),inset_0_0_18px_rgba(0,0,0,.65)]">
                <div className="absolute inset-[15%] grid place-items-center rounded-full border border-white/10 bg-[#232a33]">
                  <span className="text-[clamp(1.2rem,2.4vw,1.7rem)] font-black text-slate-100">G</span>
                </div>
              </div>
              <Horn settings={settings} press={press} />

              <div className="pointer-events-none absolute left-1/2 top-[3%] flex -translate-x-1/2 gap-1.5 rounded-full bg-[#11151a] px-3 py-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className={`size-2 rounded-full ${i < 4 ? "bg-[#22c55e]" : i < 6 ? "bg-[#facc15]" : "bg-[#ef4444]"} shadow-[0_0_7px_currentColor]`} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="flex items-end gap-[clamp(.65rem,1.2vw,1rem)] rounded-[1.4rem] border border-black/80 bg-[#0c1015] p-4 shadow-[0_18px_34px_rgba(0,0,0,.7)]">
              <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
              <Pedal label="BRAKE" id="brake" settings={settings} set={set} brake />
              <Pedal label="GAS" id="throttle" settings={settings} set={set} />
            </div>

            <div className="flex items-end gap-4">
              <Handbrake settings={settings} set={set} />
              <Nitro settings={settings} set={set} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
