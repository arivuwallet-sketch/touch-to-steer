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

function Button({
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
      aria-label={typeof label === "string" ? label : id}
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
      className={`grid touch-none select-none place-items-center rounded-lg border border-black/50 bg-gradient-to-b from-[#39414b] to-[#1c2128] text-slate-100 shadow-[0_4px_8px_rgba(0,0,0,.48),inset_0_1px_0_rgba(255,255,255,.08)] active:scale-95 active:brightness-125 ${className}`}
    >
      {label}
    </button>
  );
}

function Paddle({
  side,
  settings,
  set,
}: {
  side: "left" | "right";
  settings: Settings;
  set: Props["set"];
}) {
  const down = side === "left";
  return (
    <button
      type="button"
      aria-label={down ? "Shift down" : "Shift up"}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        buzz(settings.vibration, 8);
        set({ gear: down ? -1 : 1 });
      }}
      onPointerUp={() => set({ gear: 0 })}
      onPointerCancel={() => set({ gear: 0 })}
      className={`absolute top-[8%] z-30 h-[17%] w-[7%] rounded-[0.65rem] border border-slate-300/20 bg-gradient-to-b from-[#d9dde1] to-[#777e86] shadow-[0_5px_10px_rgba(0,0,0,.55)] active:brightness-125 ${side === "left" ? "left-[16%]" : "right-[16%]"}`}
    />
  );
}

function DPad({ settings, press }: { settings: Settings; press: Props["press"] }) {
  const item = (id: string, label: string, position: string) => (
    <Button
      key={id}
      label={label}
      id={`dpad_${id}`}
      settings={settings}
      press={press}
      className={`absolute ${position} size-10 rounded-md text-lg`}
    />
  );

  return (
    <div className="relative size-24">
      <div className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded bg-[#161b21]" />
      {item("up", "↑", "left-1/2 top-0 -translate-x-1/2")}
      {item("left", "←", "left-0 top-1/2 -translate-y-1/2")}
      {item("right", "→", "right-0 top-1/2 -translate-y-1/2")}
      {item("down", "↓", "bottom-0 left-1/2 -translate-x-1/2")}
    </div>
  );
}

function FaceButtons({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <div className="relative size-24">
      <Button label="△" id="y" settings={settings} press={press} className="absolute left-1/2 top-0 size-10 -translate-x-1/2 text-lg text-emerald-300" />
      <Button label="□" id="x" settings={settings} press={press} className="absolute left-0 top-1/2 size-10 -translate-y-1/2 text-lg text-pink-300" />
      <Button label="○" id="b" settings={settings} press={press} className="absolute right-0 top-1/2 size-10 -translate-y-1/2 text-lg text-red-400" />
      <Button label="×" id="a" settings={settings} press={press} className="absolute bottom-0 left-1/2 size-10 -translate-x-1/2 text-lg text-sky-300" />
    </div>
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
      className={`relative h-[34vh] min-h-36 ${brake ? "w-[clamp(5rem,6vw,6.8rem)]" : "w-[clamp(4.6rem,5.5vw,6.2rem)]"} touch-none overflow-hidden rounded-[1rem] border border-black/70 bg-[#080b0f] p-2 shadow-[0_10px_24px_rgba(0,0,0,.62)] active:brightness-125`}
    >
      <span className="absolute inset-2 rounded-[0.8rem] border border-white/5 bg-[#11161c]" />
      <span
        className="absolute inset-x-4 bottom-5 rounded-[0.65rem] border border-black/20 bg-gradient-to-b from-[#e0e4e8] to-[#747b84] shadow-[0_4px_8px_rgba(0,0,0,.48),inset_0_1px_0_rgba(255,255,255,.5)]"
        style={{ height: `calc(34% + ${value * 58}%)` }}
      >
        <span className="absolute inset-x-2 top-2 grid gap-2">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="grid grid-cols-2 gap-2">
              <i className="size-2 rounded-full bg-[#31373e]" />
              <i className="size-2 rounded-full bg-[#31373e]" />
            </span>
          ))}
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-black tracking-[0.18em] text-slate-300">{label}</span>
    </button>
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
    pointer.current = {
      id: e.pointerId,
      last: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)),
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_90%_at_42%_10%,#1d252f_0%,#06080b_67%)]" />

      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-[max(1rem,env(safe-area-inset-left))] py-3">
        <div className="flex gap-2">
          <button type="button" onClick={onModeChange} aria-label="Gamepad mode" className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#171d24] text-sky-300 shadow-lg"><Gauge size={18} /></button>
          <button type="button" onClick={onSettings} aria-label="Settings" className="grid size-11 place-items-center rounded-full border border-white/10 bg-[#171d24] text-slate-300 shadow-lg"><Settings2 size={18} /></button>
        </div>
      </header>

      <div className="absolute inset-0 flex items-center justify-center px-6 pt-5">
        <div className="flex w-full max-w-[1200px] items-center justify-center gap-[clamp(1.5rem,4vw,4rem)]">
          <div className="relative shrink-0">
            <div
              className="relative size-[clamp(19rem,58vh,31rem)] touch-none select-none"
              onPointerDown={onWheelDown}
              onPointerMove={onWheelMove}
              onPointerUp={release}
              onPointerCancel={release}
            >
              {/* G29 outer housing and leather rim */}
              <div className="absolute inset-0 rounded-full bg-[#161a1f] shadow-[0_24px_42px_rgba(0,0,0,.78)]" />
              <div className="absolute inset-[3%] rounded-full border-[clamp(1rem,2.8vh,1.7rem)] border-[#050608] bg-[#0a0c0f]" />
              <div className="absolute inset-[8%] rounded-full border-[clamp(.9rem,2.4vh,1.35rem)] border-[#242a31] bg-[#11161c]">
                <div className="absolute left-1/2 top-[-3%] h-[9%] w-[5.5%] -translate-x-1/2 rounded-b-lg bg-[#16b7ea] shadow-[0_0_14px_rgba(22,183,234,.65)]" />
                <Paddle side="left" settings={settings} set={set} />
                <Paddle side="right" settings={settings} set={set} />

                {/* G29 controls are integrated into the wheel spoke area. */}
                <div className="absolute left-[8%] top-[29%]">
                  <DPad settings={settings} press={press} />
                </div>
                <div className="absolute right-[8%] top-[29%]">
                  <FaceButtons settings={settings} press={press} />
                </div>

                <div className="absolute left-[17%] top-[55%]">
                  <Button label="L2" id="lt" settings={settings} press={press} className="h-9 w-12 text-[8px] text-cyan-300" />
                </div>
                <div className="absolute right-[17%] top-[55%]">
                  <Button label="R2" id="rt" settings={settings} press={press} className="h-9 w-12 text-[8px] text-cyan-300" />
                </div>

                <div className="absolute left-[12%] top-[66%] flex flex-col gap-2">
                  <Button label="+" id="plus" settings={settings} press={press} className="size-10 text-xl" />
                  <Button label="−" id="minus" settings={settings} press={press} className="size-10 text-xl" />
                </div>
                <div className="absolute right-[12%] top-[65%] size-14 rounded-full border-[0.45rem] border-[#171a1f] bg-[#a82d2a] shadow-[inset_0_0_0_2px_rgba(255,255,255,.14),0_6px_10px_rgba(0,0,0,.5)]">
                  <button
                    type="button"
                    aria-label="24 point selector"
                    onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); buzz(settings.vibration); press("wheel_spinner", true); }}
                    onPointerUp={() => press("wheel_spinner", false)}
                    onPointerCancel={() => press("wheel_spinner", false)}
                    className="absolute inset-0 rounded-full"
                  />
                  <div className="pointer-events-none absolute inset-[18%] rounded-full bg-[#11151a] shadow-inner" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-[55%] w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d33b36]" />
                </div>

                <div className="absolute left-[20%] top-[69%]">
                  <Button label="L3" id="l3" settings={settings} press={press} className="size-9 text-[8px]" />
                </div>
                <div className="absolute right-[20%] top-[69%]">
                  <Button label="R3" id="r3" settings={settings} press={press} className="size-9 text-[8px]" />
                </div>

                {/* G29-style center buttons */}
                <div className="absolute left-1/2 bottom-[9%] flex -translate-x-1/2 items-center gap-1.5">
                  <Button label="☰" id="share" settings={settings} press={press} className="h-7 w-11 rounded-md text-[8px]" />
                  <Button label="☷" id="start" settings={settings} press={press} className="h-7 w-11 rounded-md text-[8px]" />
                  <Button label="PS" id="home" settings={settings} press={press} className="h-7 w-11 rounded-md text-[8px]" />
                </div>
              </div>

              {/* center horn/logo hub */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-[29%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.25rem] border-[#2f353d] bg-[#171b21] shadow-[0_8px_15px_rgba(0,0,0,.6),inset_0_0_16px_rgba(0,0,0,.65)]">
                <div className="absolute inset-[15%] grid place-items-center rounded-full border border-white/10 bg-[#222832]">
                  <span className="text-xl font-black text-slate-100">G</span>
                </div>
              </div>

              <div className="pointer-events-none absolute left-1/2 top-[7%] -translate-x-1/2">
                <div className="flex gap-1 rounded-full bg-[#11151a] px-2 py-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i} className={`size-1.5 rounded-full ${i < 4 ? "bg-[#22c55e]" : i < 6 ? "bg-[#facc15]" : "bg-[#ef4444]"} shadow-[0_0_7px_currentColor]`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-[1.35rem] border border-black/70 bg-[#10151a] p-3 shadow-[0_18px_30px_rgba(0,0,0,.6)]">
            <div className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.22em] text-slate-500">PEDALS</div>
            <div className="flex items-end gap-[clamp(.55rem,1.1vw,.95rem)]">
              <Pedal label="CLUTCH" id="clutch" settings={settings} set={set} />
              <Pedal label="BRAKE" id="brake" settings={settings} set={set} brake />
              <Pedal label="GAS" id="throttle" settings={settings} set={set} />
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#050709] shadow-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}
