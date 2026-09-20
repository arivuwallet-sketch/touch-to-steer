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

function Paddle({
  side,
  settings,
  set,
}: {
  side: "left" | "right";
  settings: Settings;
  set: Props["set"];
}) {
  const gear = side === "left" ? -1 : 1;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Shift down" : "Shift up"}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration, 8);
        set({ gear });
      }}
      onPointerUp={() => set({ gear: 0 })}
      onPointerCancel={() => set({ gear: 0 })}
      className={`absolute top-[5%] z-20 h-[19%] w-[7%] rounded-[0.9rem] border border-white/20 bg-gradient-to-b from-[#d8dce0] to-[#777e86] shadow-[0_6px_12px_rgba(0,0,0,.52),inset_0_1px_0_rgba(255,255,255,.55)] active:brightness-125 ${side === "left" ? "left-[17%]" : "right-[17%]"}`}
    />
  );
}

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
      className={`relative h-[46vh] min-h-48 ${brake ? "w-[clamp(5.5rem,6.3vw,7.4rem)]" : "w-[clamp(5rem,5.7vw,6.8rem)]"} touch-none select-none overflow-hidden rounded-[1.25rem] border border-black/80 bg-[#090d12] p-2 shadow-[0_12px_24px_rgba(0,0,0,.65)] active:brightness-125`}
    >
      <span className="absolute inset-2 rounded-[1rem] border border-white/5 bg-[#12171d]" />
      <span
        className="absolute inset-x-5 bottom-7 rounded-[0.8rem] border border-black/20 bg-gradient-to-b from-[#e0e4e8] to-[#7a828b] shadow-[0_4px_9px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.55)]"
        style={{ height: `calc(45% + ${value * 44}%)` }}
      >
        <span className="absolute inset-x-3 top-3 grid gap-2.5">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="grid grid-cols-2 gap-3">
              <i className="size-2.5 rounded-full bg-[#31373e] shadow-inner" />
              <i className="size-2.5 rounded-full bg-[#31373e] shadow-inner" />
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

export function FlatWheel({ settings, set, press: _press, onModeChange, onSettings }: Props) {
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
    <div className="absolute inset-0 overflow-hidden bg-[#07090d] text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_85%_at_42%_18%,#1c242e_0%,#05070a_66%)]" />

      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onModeChange}
            aria-label="Gamepad mode"
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#171d24] text-sky-300 shadow-lg"
          >
            <Gauge size={18} />
          </button>
          <button
            type="button"
            onClick={onSettings}
            aria-label="Settings"
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#171d24] text-slate-300 shadow-lg"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <div className="absolute inset-0 flex items-center justify-center px-[max(1rem,env(safe-area-inset-left))] pt-2">
        <div className="flex w-full max-w-[1180px] items-center justify-center gap-[clamp(3rem,7vw,7rem)]">
          {/* Clean G29-style wheel: no gamepad controls on or inside the rim. */}
          <div className="flex shrink-0 items-center justify-center">
            <div
              className="relative size-[clamp(21rem,67vh,34rem)] touch-none select-none"
              onPointerDown={onWheelDown}
              onPointerMove={onWheelMove}
              onPointerUp={release}
              onPointerCancel={release}
            >
              <div className="absolute inset-0 rounded-full bg-[#171b20] shadow-[0_28px_48px_rgba(0,0,0,.78)]" />
              <div className="absolute inset-[3%] rounded-full border-[clamp(1.2rem,3.4vh,2rem)] border-[#050608] bg-[#07090c]" />
              <div
                className="absolute inset-[8%] rounded-full border-[clamp(1rem,2.8vh,1.55rem)] border-[#272e36] bg-[#11161c] transition-transform duration-75"
                style={{ transform: `rotate(${visualSteer * 450}deg)` }}
              >
                <div className="absolute left-1/2 top-[-2%] h-[10%] w-[6%] -translate-x-1/2 rounded-b-[0.7rem] bg-[#16b9ed] shadow-[0_0_16px_rgba(22,185,237,.7)]" />
              </div>

              <Paddle side="left" settings={settings} set={set} />
              <Paddle side="right" settings={settings} set={set} />

              <div className="pointer-events-none absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.28rem] border-[#303740] bg-[#151a21] shadow-[0_8px_16px_rgba(0,0,0,.65),inset_0_0_18px_rgba(0,0,0,.65)]">
                <div className="absolute inset-[16%] grid place-items-center rounded-full border border-white/10 bg-[#222832]">
                  <span className="text-[clamp(1.2rem,2.5vw,1.8rem)] font-black text-slate-100">G</span>
                </div>
              </div>

              {/* G29-style spoke shapes, but deliberately no buttons. */}
              <div className="pointer-events-none absolute left-[18%] top-[42%] h-[28%] w-[25%] -rotate-[11deg] rounded-[1.2rem] bg-[#1a2028] shadow-[inset_0_0_0_2px_rgba(255,255,255,.035)]" />
              <div className="pointer-events-none absolute right-[18%] top-[42%] h-[28%] w-[25%] rotate-[11deg] rounded-[1.2rem] bg-[#1a2028] shadow-[inset_0_0_0_2px_rgba(255,255,255,.035)]" />
              <div className="pointer-events-none absolute left-1/2 bottom-[18%] h-[25%] w-[17%] -translate-x-1/2 rounded-[1.2rem] bg-[#1a2028] shadow-[inset_0_0_0_2px_rgba(255,255,255,.035)]" />

              {/* G29-like top status LEDs: visual only, not controller buttons. */}
              <div className="pointer-events-none absolute left-1/2 top-[3%] flex -translate-x-1/2 gap-1.5 rounded-full bg-[#11151a] px-3 py-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className={`size-2 rounded-full ${i < 4 ? "bg-[#22c55e]" : i < 6 ? "bg-[#facc15]" : "bg-[#ef4444]"} shadow-[0_0_7px_currentColor]`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Standalone G29-style three-pedal unit. */}
          <div className="shrink-0 rounded-[1.5rem] border border-black/80 bg-[#0c1015] p-4 shadow-[0_18px_34px_rgba(0,0,0,.7)]">
            <div className="mb-3 text-center text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">
              PEDALS
            </div>
            <div className="flex items-end gap-[clamp(.7rem,1.4vw,1.1rem)]">
              <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
              <Pedal label="BRAKE" id="brake" settings={settings} set={set} brake />
              <Pedal label="GAS" id="throttle" settings={settings} set={set} />
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-[#05070a] shadow-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}
