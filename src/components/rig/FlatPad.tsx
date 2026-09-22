import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { applyCurve, applyForceFlex, FORCEFLEX_DESCRIPTIONS, type ControllerState, type JoystickTensionGf, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
};

type TriggerMode = "regular" | "race" | "sniper" | "recoil" | "vibration" | "lock";

// Haptics are deferred off the input task so a vibration call can never delay
// the controller packet leaving the phone.
const buzz = (enabled: boolean, pattern: number | number[] = 10) => {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  setTimeout(() => {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }, 0);
};

const feelBuzz = (enabled: boolean, intensity: number) => {
  if (!enabled) return;
  const ms = Math.max(3, Math.min(18, Math.round(3 + intensity * 15)));
  buzz(true, ms);
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
  const lastHapticAt = useRef(0);

  const stopTurbo = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    press(id, false);
  }, [id, press]);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastHapticAt.current > 50) {
      lastHapticAt.current = now;
      feelBuzz(settings.vibration, 0.35);
    }
    press(id, true);

    if (turbo) {
      timer.current = setInterval(() => {
        press(id, false);
        feelBuzz(settings.vibration, 0.6);
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
  const thumbRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const rect = useRef<DOMRect | null>(null);
  const lastHapticMagnitude = useRef(0);
  const pointMagnitude = useRef(0);

  // Zero-lag path: no React state on pointer move. Geometry is measured once
  // per grab (no per-sample layout read) and the thumb is written straight to
  // the compositor, so the value reaches the bridge in the same input task.
  const apply = (clientX: number, clientY: number) => {
    const r = rect.current;
    if (!r) return;

    const radius = Math.max(1, Math.min(r.width, r.height) / 2);
    let x = (clientX - (r.left + r.width / 2)) / radius;
    let y = (clientY - (r.top + r.height / 2)) / radius;
    const m = Math.hypot(x, y);

    if (m > 1) {
      x /= m;
      y /= m;
    }

    const forceFlexX = applyForceFlex(x, settings.joystickTensionGf);
    const forceFlexY = applyForceFlex(-y, settings.joystickTensionGf);

    onMove(
      applyCurve(forceFlexX, settings.deadzone, settings.linearity, settings.sensitivity),
      applyCurve(forceFlexY, settings.deadzone, settings.linearity, settings.sensitivity),
    );

    const travel = 22 + (settings.joystickTensionGf / 100) * 12;
    const thumb = thumbRef.current;
    if (thumb) {
      thumb.style.transform = `translate3d(calc(-50% + ${x * travel}px), calc(-50% + ${y * travel}px), 0)`;
    }

    // Haptics are strictly rate-limited and never block the value write above.
    const magnitude = Math.hypot(x, y);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (settings.vibration && now - lastHapticMagnitude.current > 90) {
      if (magnitude >= 0.92 && pointMagnitude.current < 0.92) {
        lastHapticMagnitude.current = now;
        buzz(true, [5, 14, 4]);
      } else if (magnitude > 0.55 && Math.abs(magnitude - pointMagnitude.current) > 0.18) {
        lastHapticMagnitude.current = now;
        feelBuzz(true, magnitude * 0.5);
      }
    }
    pointMagnitude.current = magnitude;
  };

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const native = e.nativeEvent as globalThis.PointerEvent;
    // Use only the newest sample of a coalesced batch: older samples are stale
    // input and re-sending them would show up as ghosting/rubber-banding.
    const events = native.getCoalescedEvents?.();
    const latest = events && events.length ? events[events.length - 1]! : native;
    apply(latest.clientX, latest.clientY);
  };

  const release = () => {
    pointer.current = null;
    pointMagnitude.current = 0;
    rect.current = null;
    const thumb = thumbRef.current;
    if (thumb) thumb.style.transform = "translate3d(-50%,-50%,0)";
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
        aria-valuenow={0}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer.current = e.pointerId;
          rect.current = e.currentTarget.getBoundingClientRect();
          buzz(settings.vibration, 6);
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onDoubleClick={() => {
          onClick3(true);
          window.setTimeout(() => onClick3(false), 90);
        }}
        className="flat-pad-stick relative size-[clamp(5.25rem,23svh,10.5rem)] touch-none rounded-full border border-white/10 bg-[#0c1117] shadow-[inset_0_0_22px_rgba(0,0,0,.95),0_8px_20px_rgba(0,0,0,.45)]"
      >
        <div className="absolute inset-[8%] rounded-full border border-[#2e3945] bg-[radial-gradient(circle_at_38%_28%,#202a35,#080c11_72%)]" />
        <div
          ref={thumbRef}
          data-stick-thumb
          className="absolute left-1/2 top-1/2 size-[57%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_25%,#626e7a,#1a222b_70%)] shadow-[0_8px_16px_rgba(0,0,0,.65),inset_0_-7px_10px_rgba(0,0,0,.58)] will-change-transform"
          style={{ transform: "translate3d(-50%,-50%,0)" }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[11%] h-[8%] w-[28%] -translate-x-1/2 rounded-full bg-[#0a0e13]" />
      </div>
      <span className="text-[8px] font-black tracking-[0.18em] text-slate-500">
        {side === "left" ? "L-STICK" : "R-STICK"} • {settings.joystickTensionGf}GF
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

// ---- ForceAdapt engine (Flydigi Apex 5 style adaptive triggers) ----
// Each mode defines a real trigger profile: the usable stroke window
// (dead travel at both ends, exactly like the Apex hall-sensor stroke
// switch), the resistance "wall" where the game action fires, and the
// force curve applied between them.
type ForceProfile = {
  stroke: [number, number]; // usable travel window of the physical stroke
  wall: number; // actuation point — haptic wall is rendered here
  curve: (p: number) => number;
  digital: boolean; // hair-trigger / micro-switch behaviour
};

const FORCE_PROFILES: Record<TriggerMode, ForceProfile> = {
  // full 0-100% travel, 1:1 force, no shaping
  regular: { stroke: [0, 1], wall: 0.5, curve: (p) => p, digital: false },
  // racing: short stroke, heavy bottom end so throttle feathers finely
  race: { stroke: [0.04, 0.92], wall: 0.35, curve: (p) => Math.pow(p, 0.78), digital: false },
  // sniper: long soft pull then a hard wall right before the shot breaks
  sniper: { stroke: [0.1, 1], wall: 0.82, curve: (p) => Math.pow(p, 1.7), digital: false },
  // recoil: soft slack, then full pressure past the wall with pulse train
  recoil: { stroke: [0.06, 0.96], wall: 0.42, curve: (p) => (p < 0.3 ? p * 0.45 : Math.min(1, 0.135 + (p - 0.3) * 1.24)), digital: false },
  // vibration: linear force with continuous texture feedback
  vibration: { stroke: [0.02, 0.98], wall: 0.5, curve: (p) => Math.pow(p, 0.92), digital: false },
  // lock: micro-switch mode — near-zero stroke, instant 100%
  lock: { stroke: [0, 0.2], wall: 0.12, curve: (p) => p, digital: true },
};

function Trigger({
  label,
  id,
  settings,
  set,
  press,
  mode,
}: {
  label: string;
  id: "lt" | "rt";
  settings: Settings;
  set: Props["set"];
  press: Props["press"];
  mode: TriggerMode;
}) {
  const valueRef = useRef(0);
  const plateRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [pulse3d, setPulse3d] = useState(false);
  const pointer = useRef<number | null>(null);
  const lastFeel = useRef(0);
  const lastBand = useRef(-1);
  const lastRecoil = useRef(0);
  const pastWall = useRef(false);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimer.current !== null) {
        window.clearTimeout(pulseTimer.current);
      }
    };
  }, []);

  const pulseFeedback = useCallback(
    (pattern: number | number[]) => {
      if (!settings.vibration) return;
      buzz(true, pattern);
      setPulse3d(true);
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => setPulse3d(false), 90);
    },
    [settings.vibration],
  );

  const profile = FORCE_PROFILES[mode];

  // Maps the raw stroke position through the active ForceAdapt profile.
  const mapValue = (v: number) => {
    const raw = Math.max(0, Math.min(1, v));
    const [lo, hi] = profile.stroke;
    const t = Math.max(0, Math.min(1, (raw - lo) / Math.max(0.001, hi - lo)));
    if (profile.digital) return t > 0.5 ? 1 : 0;
    return Math.max(0, Math.min(1, profile.curve(t)));
  };


  const writeTrigger = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(1, next));
      // Value goes to the bridge before any painting happens, so the trigger
      // reaches the PC in the same input task with no render in between.
      valueRef.current = clamped;
      set({ [id]: clamped } as Partial<ControllerState>);
      // Also expose a digital trigger alias so games/bindings that treat LT/RT
      // as buttons still receive a clean press while the analog value is sent.
      press(id === "lt" ? "l2" : "r2", clamped > 0.02);

      const plate = plateRef.current;
      if (plate) {
        plate.style.transform = `translate3d(0, ${clamped * 4}px, 0) rotateX(${clamped * 2.5}deg)`;
      }
      const bar = barRef.current;
      if (bar) bar.style.width = `${Math.max(12, clamped * 86)}%`;
    },
    [id, press, set],
  );

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Physical-style trigger travel: top = fully pulled, bottom = released.
    const travel = Math.max(0, Math.min(1, (r.bottom - e.clientY) / r.height));
    // Real force sensing: touch/stylus digitisers report finger pressure.
    // ForceAdapt blends actual finger force with stroke position, so pressing
    // harder in place pulls the trigger just like the Apex hall triggers.
    const hasForce = (e.pointerType === "touch" || e.pointerType === "pen") && e.pressure > 0 && e.pressure < 1;
    const force = hasForce ? Math.max(0, Math.min(1, e.pressure * 1.35)) : 0;
    const rawStroke = hasForce ? Math.max(travel, travel * 0.45 + force * 0.55) : travel;
    const next = mapValue(rawStroke);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const band = Math.min(5, Math.floor(next * 6));

    // Resistance wall — a distinct hard bump at the actuation point.
    const beyond = next >= profile.wall;
    if (beyond !== pastWall.current) {
      pastWall.current = beyond;
      pulseFeedback(beyond ? [6, 4, 18] : [3, 6, 3]);
      lastFeel.current = now;
    } else if (band !== lastBand.current && now - lastFeel.current > 45) {
      lastBand.current = band;
      lastFeel.current = now;

      if (mode === "race") {
        pulseFeedback([2, 5 + band, 2]);
      } else if (mode === "sniper") {
        pulseFeedback(band >= 3 ? [4, 13] : 5);
      } else if (mode === "recoil") {
        pulseFeedback([3, 8 + band, 3]);
      } else if (mode === "vibration") {
        pulseFeedback([2, 5, 2, 5, 3]);
      } else if (mode === "lock" && band === 0) {
        pulseFeedback([4, 12, 4]);
      } else {
        pulseFeedback(Math.min(16, 4 + band * 2));
      }
    }

    if (mode === "recoil" && next > 0.58) {
      const nowRecoil = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (nowRecoil - lastRecoil.current > 110) {
        lastRecoil.current = nowRecoil;
        pulseFeedback([3, 10, 3]);
      }
    }

    writeTrigger(next);
  };


  const pressToFull = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    lastBand.current = -1;
    pastWall.current = true;
    pulseFeedback([4, 9, 3]);
    writeTrigger(1);
  };

  const release = (e?: PointerEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    pointer.current = null;
    lastBand.current = -1;
    lastRecoil.current = 0;
    pastWall.current = false;
    writeTrigger(0);
  };


  return (
    <button
      type="button"
      aria-label={`${label} ForceAdapt trigger — ${mode}`}
      onPointerDown={pressToFull}
      onPointerMove={(e) => pointer.current === e.pointerId && (e.preventDefault(), move(e))}
      onPointerUp={release}
      onPointerCancel={release}
      className="flat-pad-trigger group relative grid h-[clamp(2.75rem,7.8svh,3.5rem)] w-[clamp(4.5rem,8vw,6rem)] touch-none select-none place-items-center overflow-hidden rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,#394754,#11171e)] text-[10px] font-black tracking-[0.25em] text-cyan-200 shadow-[inset_0_2px_2px_rgba(255,255,255,.1),inset_0_-7px_14px_rgba(0,0,0,.72),0_7px_0_#05080b,0_11px_18px_rgba(0,0,0,.58)]"
      style={{ perspective: "700px" }}
    >
      <span className="pointer-events-none absolute inset-[3px] rounded-[0.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.16))]" />
      <span
        ref={plateRef}
        className={`flat-pad-trigger-plate pointer-events-none absolute inset-[6px] overflow-hidden rounded-[0.72rem] border border-cyan-200/20 bg-[linear-gradient(180deg,#566572,#252f38_48%,#11161c)] shadow-[inset_0_2px_1px_rgba(255,255,255,.22),inset_0_-6px_10px_rgba(0,0,0,.58),0_5px_8px_rgba(0,0,0,.5)] will-change-transform ${pulse3d ? "trigger-3d-rattle" : ""}`}
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <span className="absolute inset-x-2 top-2 h-[3px] rounded-full bg-white/15" />
        <span className="absolute left-2 top-1/2 h-[62%] w-1 -translate-y-1/2 rounded-full bg-cyan-200/40 shadow-[0_0_8px_rgba(103,232,249,.25)]" />
        <span className="absolute right-2 top-1/2 h-[62%] w-1 -translate-y-1/2 rounded-full bg-black/40" />
        <span className="relative z-10 flex flex-col items-center gap-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,.75)]">
          <span className="text-[10px] font-black tracking-[0.24em]">{label}</span>
          <span className="text-[5px] tracking-[0.18em] text-cyan-100/60">FORCEADAPT</span>
        </span>
        <span
          className="pointer-events-none absolute bottom-[1px] h-2 w-[2px] rounded-full bg-amber-300/80 shadow-[0_0_6px_rgba(252,211,77,.7)]"
          style={{ left: `${7 + profile.wall * 86}%` }}
          aria-hidden
        />
        <span
          ref={barRef}
          className="absolute bottom-1 left-1/2 h-1 -translate-x-1/2 rounded-full bg-cyan-300/70 shadow-[0_0_7px_rgba(34,211,238,.65)]"
          style={{ width: "12%" }}
        />

      </span>
      <span className="pointer-events-none absolute bottom-0.5 text-[5px] font-black uppercase tracking-[0.12em] text-slate-500">
        {mode === "vibration" ? "VIBRATE" : mode}
      </span>
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
    <div className="flat-pad-screen flex h-[clamp(2.75rem,7.8svh,3.5rem)] w-[clamp(5rem,7vw,7rem)] flex-col items-center justify-center rounded-lg border border-cyan-300/25 bg-[#071018] shadow-[inset_0_0_14px_rgba(34,211,238,.12),0_0_12px_rgba(34,211,238,.1)]">
      <span className="text-[7px] font-black tracking-[0.25em] text-cyan-400/70">APEX 5 • FORCEADAPT</span>
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

export function FlatPad({ settings, set, press, onSettingsChange }: Props) {
  const [turbo, setTurbo] = useState(false);
  const [rgb, setRgb] = useState(true);
  const [profile, setProfile] = useState(1);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>("regular");
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroDenied, setGyroDenied] = useState(false);

  const cycleJoystickTension = useCallback(() => {
    const values: JoystickTensionGf[] = [30, 50, 80, 100];
    const index = values.indexOf(settings.joystickTensionGf);
    const next = values[(index >= 0 ? index + 1 : 0) % values.length] ?? 50;
    onSettingsChange({ joystickTensionGf: next });
    buzz(settings.vibration, 8);
  }, [onSettingsChange, settings.joystickTensionGf, settings.vibration]);

  const cycleSendRate = useCallback(() => {
    const values: Settings["sendRateHz"][] = [60, 120, 144, 180, 240];
    const index = values.indexOf(settings.sendRateHz);
    const next = values[(index >= 0 ? index + 1 : 0) % values.length] ?? 240;
    onSettingsChange({ sendRateHz: next });
    buzz(settings.vibration, 8);
  }, [onSettingsChange, settings.sendRateHz, settings.vibration]);

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
    const modes: TriggerMode[] = ["regular", "race", "sniper", "recoil", "vibration", "lock"];
    const i = modes.indexOf(triggerMode);
    setTriggerMode(modes[(i + 1) % modes.length] ?? "regular");
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
          <Trigger label="LT" id="lt" settings={settings} set={set} press={press} mode={triggerMode} />
          <ExtraButton label="LM" id="lm" settings={settings} press={press} />
        </div>
        <div className="flex items-center gap-3">
          <ExtraButton label="RM" id="rm" settings={settings} press={press} />
          <Trigger label="RT" id="rt" settings={settings} set={set} press={press} mode={triggerMode} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-[7%] top-[12%] bottom-[8%] rounded-[34%_34%_42%_42%/18%_18%_44%_44%] border border-white/5 bg-[#0b1118]/70 shadow-[inset_0_0_50px_rgba(0,0,0,.7)]" />

      <div className="flat-pad-left absolute bottom-[17%] left-[7%] flex items-center gap-[clamp(1rem,3vw,2.5rem)]">
        <Stick side="left" settings={settings} onMove={(x, y) => set({ lx: x, ly: -y })} onClick3={(d) => press("l3", d)} />
        <ApexDPad settings={settings} press={press} turbo={turbo} />
      </div>

      <div className="flat-pad-center absolute left-1/2 top-[27%] flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="flat-pad-center-box relative w-[clamp(14rem,27vw,20rem)] rounded-[2rem] bg-[linear-gradient(145deg,#39434f,#171d24)] px-5 py-4 shadow-[inset_0_2px_2px_rgba(255,255,255,.09),0_12px_24px_rgba(0,0,0,.48)]">
          <div className="flex items-center justify-center gap-3">
            <SurfaceButton label="VIEW" id="back" settings={settings} press={press} className="h-[clamp(2rem,5.6svh,2.5rem)] min-w-[clamp(3.5rem,5vw,4rem)] rounded-lg text-[8px] text-slate-300" />
            <MiniScreen profile={profile} triggerMode={triggerMode} motion={gyroEnabled} turbo={turbo} />
            <SurfaceButton label="MENU" id="start" settings={settings} press={press} className="h-10 min-w-16 rounded-lg text-[8px] text-slate-300" />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <SurfaceButton label="PROFILE −" id="minus" settings={settings} press={press} onClick={() => cycleProfile(-1)} className="h-[clamp(2rem,5.4svh,2.25rem)] min-w-[clamp(4rem,5vw,5rem)] rounded-md text-[7px]" />
            <SurfaceButton label="HOME" id="home" settings={settings} press={press} className="h-9 min-w-20 rounded-md text-[7px]" />
            <SurfaceButton label="PROFILE +" id="plus" settings={settings} press={press} onClick={() => cycleProfile(1)} className="h-9 min-w-20 rounded-md text-[7px]" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <SurfaceButton label="FN" id="fn" settings={settings} press={press} className="h-[clamp(1.8rem,4.8svh,2rem)] min-w-0 w-full rounded-lg text-[7px] text-slate-300" />
            <SurfaceButton label="LOGO" id="logo" settings={settings} press={press} className="h-8 min-w-0 w-full rounded-lg text-[7px] text-slate-300" />
            <button type="button" onClick={() => setTurbo((v) => !v)} className={`h-[clamp(1.8rem,4.8svh,2rem)] min-w-0 w-full rounded-lg border px-2 text-[7px] font-black uppercase tracking-[0.14em] ${turbo ? "border-orange-300/50 bg-orange-300/10 text-orange-200" : "border-white/10 bg-black/20 text-slate-400"}`}>TURBO</button>
            <GyroControl enabled={gyroEnabled} denied={gyroDenied} onToggle={requestGyro} />
            <button
              type="button"
              onClick={cycleJoystickTension}
              className="h-[clamp(1.8rem,4.8svh,2rem)] min-w-0 w-full rounded-lg border border-violet-300/20 bg-violet-300/5 px-2 text-[7px] font-black uppercase tracking-[0.14em] text-violet-200"
              aria-label={`ForceFlex joystick tension ${settings.joystickTensionGf} gf. Tap to change.`}
              title={FORCEFLEX_DESCRIPTIONS[settings.joystickTensionGf]}
            >
              FORCEFLEX {settings.joystickTensionGf}GF
            </button>
            <button
              type="button"
              onClick={cycleSendRate}
              className="h-[clamp(1.8rem,4.8svh,2rem)] min-w-0 w-full rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-2 text-[7px] font-black uppercase tracking-[0.14em] text-cyan-200"
              aria-label={`Controller polling rate ${settings.sendRateHz} Hz. Tap to change.`}
              title="Change controller polling rate"
            >
              RATE {settings.sendRateHz} HZ
            </button>
            <button type="button" onClick={nextTriggerMode} className="h-[clamp(1.8rem,4.8svh,2rem)] min-w-0 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-[7px] font-black uppercase tracking-[0.14em] text-slate-400">FORCEADAPT</button>
            <button type="button" onClick={() => setRgb((v) => !v)} className={`h-[clamp(1.8rem,4.8svh,2rem)] min-w-0 w-full rounded-lg border px-2 text-[7px] font-black uppercase tracking-[0.14em] ${rgb ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-black/20 text-slate-400"}`}>RGB</button>
          </div>
        </div>
      </div>

      <div className="flat-pad-right absolute bottom-[17%] right-[7%] flex items-center gap-[clamp(1rem,3vw,2.5rem)]">
        <ApexFaceButtons settings={settings} press={press} turbo={turbo} />
        <Stick side="right" settings={settings} onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? y : -y })} onClick3={(d) => press("r3", d)} />
      </div>

      <div className="flat-pad-bottom absolute bottom-[4%] left-1/2 flex -translate-x-1/2 gap-2">
        <ExtraButton label="M1" id="m1" settings={settings} press={press} />
        <ExtraButton label="M2" id="m2" settings={settings} press={press} />
        <ExtraButton label="M3" id="m3" settings={settings} press={press} />
        <ExtraButton label="M4" id="m4" settings={settings} press={press} />
      </div>

      <div className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 text-[6px] font-bold uppercase tracking-[0.14em] text-slate-600">
        FORCEFLEX {settings.joystickTensionGf}GF • FORCEADAPT MODES • 6 EXTRA • GYRO • RGB • TURBO
      </div>
    </div>
  );
}
