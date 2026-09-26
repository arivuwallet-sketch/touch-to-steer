import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { applySteeringTension, applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";
import { playDualRumble, type DualRumbleKind } from "@/lib/haptics";
import type { BridgeTelemetry } from "@/hooks/useBridge";

import { useHoldControl } from "@/hooks/useHoldControl";
import { useInputReset } from "@/hooks/useInputReset";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
  telemetry: BridgeTelemetry;
  telemetryLive: boolean;
  onSettingsChange: (p: Partial<Settings>) => void;
  gameName?: string;
};

/** Selectable lock-to-lock steering ranges, matching common wheel firmware options. */
const STEER_DEGREES = [180, 270, 360, 540, 720, 900, 1080] as const;
const STEER_SENS = [0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3] as const;


// Haptics are deferred off the input task so a vibration call can never delay
// the controller packet leaving the phone.
const buzz = (enabled: boolean, ms: number | number[] = 10, kind: DualRumbleKind = "ui") => {
  if (!enabled || typeof window === "undefined") return;

  const values = Array.isArray(ms) ? ms : [ms];
  const strongest = Math.max(...values, 0);
  const intensity = Math.max(0.08, Math.min(1, strongest / 18 + values.length * 0.035));
  const resolvedKind =
    kind !== "ui"
      ? kind
      : strongest >= 15
        ? "heavy"
        : values.length >= 4
          ? "heartbeat"
          : intensity > 0.5
            ? "light"
            : "ui";

  playDualRumble(resolvedKind, {
    strongMagnitude:
      resolvedKind === "heavy"
        ? Math.max(0.72, intensity)
        : resolvedKind === "ui"
          ? 0
          : Math.max(0.08, intensity * 0.55),
    weakMagnitude:
      resolvedKind === "heavy"
        ? Math.max(0.6, intensity * 0.82)
        : resolvedKind === "ui"
          ? Math.max(0.2, intensity)
          : Math.max(0.12, intensity * 0.8),
    duration:
      resolvedKind === "heavy"
        ? Math.min(500, Math.max(300, strongest * 22))
        : resolvedKind === "ui"
          ? Math.min(50, Math.max(30, strongest + 28))
          : Math.min(180, Math.max(45, strongest * 7)),
  });
};



function TelemetryGauge({
  label,
  value,
  max,
  unit,
  live: telemetryAvailable,
  accent,
}: {
  label: string;
  value?: number | undefined;
  max: number;
  unit: string;
  live: boolean;
  accent: "cyan" | "red";
}) {
  const live = telemetryAvailable && typeof value === "number" && Number.isFinite(value);
  const hasValue = live;
  const hasScale = hasValue && max > 0;
  const ratio = hasScale ? Math.max(0, Math.min(1, value / max)) : 0;
  const angle = -135 + ratio * 270;

  return (
    <div className="relative size-[clamp(7rem,13vw,9rem)] shrink-0 select-none">
      <div className="absolute inset-0 rounded-full border border-white/10 bg-[radial-gradient(circle_at_36%_28%,#2b333b_0%,#0d1217_58%,#05070a_100%)] shadow-[inset_0_0_22px_rgba(0,0,0,.9),0_10px_24px_rgba(0,0,0,.55)]" />
      <div
        className={
          "absolute inset-[7%] rounded-full border border-white/5 " +
          (accent === "cyan"
            ? "bg-[conic-gradient(from_225deg,rgba(34,211,238,.65),rgba(34,211,238,.06)_28%,rgba(255,255,255,.04)_75%,rgba(239,68,68,.4))]"
            : "bg-[conic-gradient(from_225deg,rgba(239,68,68,.6),rgba(239,68,68,.08)_26%,rgba(255,255,255,.04)_75%,rgba(239,68,68,.5))]")
        }
      />
      <div className="absolute inset-[13%] rounded-full bg-[#080c10] shadow-[inset_0_0_16px_rgba(0,0,0,.9)]" />

      {Array.from({ length: 19 }).map((_, i) => {
        const tickAngle = -135 + i * 15;
        const major = i % 3 === 0;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 origin-center"
            style={{ transform: `translate(-50%,-50%) rotate(${tickAngle}deg) translateY(-${major ? 4.5 : 4}rem)` }}
          >
            <span
              className={
                "block w-px rounded-full " +
                (major ? "h-3 bg-slate-200/70" : "h-1.5 bg-slate-500/70")
              }
            />
          </span>
        );
      })}

      <div
        className="absolute left-1/2 top-1/2 h-[1px] w-[39%] origin-left rounded-full bg-white/90 shadow-[0_0_7px_rgba(255,255,255,.35)]"
        style={{
          transform: `rotate(${angle}deg)`,
          opacity: hasScale ? 1 : 0,
        }}
      >
        <span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,.8)]" />
      </div>

      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-[#3a424a] shadow-[0_0_7px_rgba(255,255,255,.2)]" />

      <div className="absolute inset-x-0 top-[28%] text-center">
        <div className="text-[7px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</div>
        <div className="mt-0.5 font-mono text-[clamp(1rem,2.2vw,1.5rem)] font-black tracking-tight text-white">
          {hasValue ? Math.round(value).toLocaleString() : "--"}
        </div>
        <div className="text-[6px] font-black uppercase tracking-[0.2em] text-slate-500">{unit}</div>
      </div>

      <div className="absolute inset-x-0 bottom-[12%] text-center text-[5px] font-bold uppercase tracking-[0.16em] text-slate-600">
        {hasScale ? `0 — ${Math.round(max).toLocaleString()}` : hasValue ? "SCALE UNAVAILABLE" : "NO GAME DATA"}
      </div>

      <div
        className={
          "absolute right-[9%] top-[9%] rounded-full border px-1.5 py-0.5 text-[5px] font-black uppercase tracking-[0.12em] " +
          (live
            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
            : "border-white/10 bg-black/35 text-slate-600")
        }
      >
        {live ? "LIVE" : "NO SIGNAL"}
      </div>
    </div>
  );
}

function TelemetryCluster({
  telemetry,
  live,
}: {
  telemetry: BridgeTelemetry;
  live: boolean;
}) {
  const rpmMax = telemetry.rpmMax && telemetry.rpmMax > 0 ? telemetry.rpmMax : 0;

  return (
    <div className="flat-wheel-telemetry pointer-events-none absolute left-1/2 top-[3%] z-20 flex -translate-x-1/2 items-center gap-2 rounded-[1.35rem] border border-white/10 bg-[#070b0f]/80 px-2 py-2 shadow-[0_14px_34px_rgba(0,0,0,.6)] backdrop-blur-md md:gap-3 md:px-3 md:py-3">
      <TelemetryGauge label="SPEED" value={telemetry.speed} max={400} unit="KM/H" live={live} accent="cyan" />
      <div className="grid size-[clamp(3rem,6vw,4.25rem)] place-items-center rounded-full border border-white/10 bg-[#0a0e12] shadow-[inset_0_0_16px_rgba(0,0,0,.9)]">
        <div className="text-[6px] font-black uppercase tracking-[0.2em] text-slate-600">GEAR</div>
        <div className="font-mono text-[clamp(1.1rem,2.5vw,1.8rem)] font-black text-white">
          {!live || typeof telemetry.gear !== "number"
            ? "--"
            : telemetry.gear === 0
              ? "N"
              : telemetry.gear < 0
                ? "R"
                : telemetry.gear}
        </div>
        <div className="text-[5px] font-black uppercase tracking-[0.16em] text-slate-600">
          {telemetry.source ?? "GAME"}
        </div>
      </div>
      <TelemetryGauge label="RPM" value={telemetry.rpm} max={rpmMax} unit="RPM" live={live} accent="red" />
    </div>
  );
}

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
  const active = useRef<number | null>(null);
  const lastBand = useRef(-1);
  const lastHapticAt = useRef(0);
  const startY = useRef(0);
  const pedalRef = useRef<HTMLButtonElement>(null);
  const plateRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const rect = useRef<DOMRect | null>(null);

  // Pedal travel is written to the bridge first and painted straight to the
  // compositor after: no React render sits between finger and game.
  const paint = (v: number) => {
    const plate = plateRef.current;
    if (plate) {
      plate.style.height = "calc(28% + " + v * 58 + "%)";
      plate.style.transform = "translate3d(0," + v * 3 + "px,0) rotateX(" + v * 2 + "deg)";
      plate.style.boxShadow =
        "0 0 " + (8 + v * 12) + "px " + accent +
        "44, 0 10px 16px rgba(0,0,0,.58), inset 0 2px 0 rgba(255,255,255,.55), inset 0 -7px 10px rgba(0,0,0,.42)";
    }
    const bar = barRef.current;
    if (bar) bar.style.width = Math.max(15, v * 80) + "%";
  };

  const update = (clientY: number) => {
    const r = rect.current ?? pedalRef.current?.getBoundingClientRect();
    if (!r) return;

    // A pedal is fully engaged as soon as it is pressed. Dragging down then
    // feathers it back toward zero, which preserves analog control without
    // making a normal tap near the bottom of the pedal report 0% input.
    const next = Math.max(
      0,
      Math.min(1, 1 - (clientY - startY.current) / Math.max(1, r.height * 0.72)),
    );
    set({ [id]: next } as Partial<ControllerState>);
    paint(next);

    const band = Math.min(5, Math.floor(next * 6));
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (settings.vibration && band !== lastBand.current && now - lastHapticAt.current > 60) {
      lastBand.current = band;
      lastHapticAt.current = now;
      buzz(true, Math.min(15, 3 + band * 2));
    }
  };

  const release = (e?: PointerEvent<HTMLElement>) => {
    if (active.current === null || (e && active.current !== e.pointerId)) return;
    active.current = null;
    lastBand.current = -1;
    rect.current = null;
    set({ [id]: 0 } as Partial<ControllerState>);
    paint(0);
    if (settings.vibration) buzz(true, id === "brake" ? [5, 11, 4] : 4);
  };

  useInputReset(() => release());

  return (
    <button
      ref={pedalRef}
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        if (active.current !== null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        rect.current = e.currentTarget.getBoundingClientRect();
        startY.current = e.clientY;
        update(e.clientY);
        buzz(settings.vibration, 7);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      className="group relative h-[62svh] min-h-0 w-[clamp(4.25rem,8.4vw,6rem)] touch-none select-none overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#080b0f]/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_14px_28px_rgba(0,0,0,.6)] active:brightness-110 md:h-[42vh] md:min-h-44 md:w-[clamp(4.6rem,7vw,6.4rem)]"
    >
      <span className="absolute inset-1.5 rounded-[1.15rem] border border-white/5 bg-[linear-gradient(180deg,#1a2027,#090c10)] shadow-[inset_0_0_20px_rgba(0,0,0,.85)]" />
      <span className="absolute left-1/2 top-3 h-2 w-1/2 -translate-x-1/2 rounded-full bg-[#20262c] shadow-[inset_0_1px_1px_rgba(255,255,255,.14)]" />

      <span
        ref={plateRef}
        className="absolute inset-x-[13%] bottom-10 rounded-[1.05rem] border border-white/15 bg-[linear-gradient(155deg,#eef1f3_0%,#aab1b8_24%,#59616a_68%,#2b3239_100%)] shadow-[0_10px_16px_rgba(0,0,0,.58),inset_0_2px_0_rgba(255,255,255,.55),inset_0_-7px_10px_rgba(0,0,0,.42)] will-change-transform"
        style={{
          height: "28%",
          transform: "translate3d(0,0,0)",
          transformOrigin: "bottom center",
        }}
      >
        <span className="absolute inset-x-[12%] top-2 h-[2px] rounded-full bg-white/30" />
        <span className="absolute inset-x-[11%] top-[13%] bottom-[13%] rounded-[0.7rem] border border-black/15 bg-[linear-gradient(90deg,rgba(255,255,255,.14),rgba(0,0,0,.06),rgba(255,255,255,.08))]" />
        <span className="absolute inset-x-[19%] top-[16%] bottom-[16%] grid grid-rows-6 gap-[7%] opacity-80">
          {Array.from({ length: 6 }).map((_, row) => (
            <span key={row} className="grid grid-cols-3 gap-[14%]">
              <i className="rounded-full bg-[#303841] shadow-[inset_0_1px_1px_rgba(255,255,255,.18)]" />
              <i className="rounded-full bg-[#303841] shadow-[inset_0_1px_1px_rgba(255,255,255,.18)]" />
              <i className="rounded-full bg-[#303841] shadow-[inset_0_1px_1px_rgba(255,255,255,.18)]" />
            </span>
          ))}
        </span>
        <span className="absolute bottom-2 left-1/2 h-1.5 w-[50%] -translate-x-1/2 rounded-full bg-black/45" />
        <span
          ref={barRef}
          className="absolute bottom-1.5 left-1/2 h-1 rounded-full -translate-x-1/2"
          style={{ width: "15%", background: accent, boxShadow: "0 0 8px " + accent + "88" }}
        />
      </span>

      <span className="absolute left-1/2 bottom-7 -translate-x-1/2 rounded-md border border-black/20 bg-[#c7ccd1] px-2 py-0.5 text-[6px] font-black uppercase tracking-[0.18em] text-[#22272c] shadow-[0_2px_4px_rgba(0,0,0,.35)]">
        RACING
      </span>
      <span className="absolute inset-x-0 bottom-2 text-[8px] font-black uppercase tracking-[0.24em] text-slate-200">
        {label}
      </span>
    </button>
  );
}
function Handbrake({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const active = useRef<number | null>(null);
  const startY = useRef(0);
  const leverRef = useRef<HTMLSpanElement>(null);

  const paint = (v: number) => {
    const lever = leverRef.current;
    if (lever) lever.style.transform = "translateX(-50%) rotate(" + (-10 - v * 42) + "deg)";
  };

  const move = (y: number) => {
    const next = Math.max(0, Math.min(1, 1 + (startY.current - y) / 125));
    set({ handbrake: next });
    paint(next);
  };

  const release = (e?: PointerEvent<HTMLElement>) => {
    if (active.current === null || (e && active.current !== e.pointerId)) return;
    active.current = null;
    set({ handbrake: 0 });
    paint(0);
    if (settings.vibration) buzz(true, [5, 12, 4]);
  };

  useInputReset(() => release());

  return (
    <button
      type="button"
      aria-label="Handbrake"
      onPointerDown={(e) => {
        if (active.current !== null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        startY.current = e.clientY;
        set({ handbrake: 1 });
        paint(1);
        buzz(settings.vibration, [7, 16, 6]);
      }}
      onPointerMove={(e) => active.current === e.pointerId && move(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      className="relative h-[38svh] w-[clamp(4.25rem,9vw,6rem)] touch-none select-none overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#080b0f] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_12px_24px_rgba(0,0,0,.58)] active:brightness-125 md:h-40 md:w-24"
    >
      <span className="absolute inset-2 rounded-[1.05rem] border border-white/5 bg-[linear-gradient(180deg,#1a2027,#07090d)] shadow-[inset_0_0_18px_rgba(0,0,0,.9)]" />
      <span className="absolute bottom-4 left-1/2 h-4 w-[72%] -translate-x-1/2 rounded-xl border border-white/10 bg-[linear-gradient(180deg,#3c444d,#171c22)] shadow-[inset_0_2px_2px_rgba(255,255,255,.1),0_5px_10px_rgba(0,0,0,.5)]" />
      <span className="absolute bottom-8 left-1/2 h-5 w-8 -translate-x-1/2 rounded-md bg-[#6e7780] shadow-[inset_0_2px_2px_rgba(255,255,255,.3),0_3px_6px_rgba(0,0,0,.45)]" />
      <span
        ref={leverRef}
        className="absolute bottom-7 left-1/2 h-[74%] w-3.5 origin-bottom -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#4a525b,#d7dbe0_46%,#6f7881)] shadow-[0_8px_12px_rgba(0,0,0,.6),inset_0_1px_1px_rgba(255,255,255,.5)] will-change-transform"
        style={{ transform: "translateX(-50%) rotate(-10deg)" }}
      >
        <span className="absolute -bottom-2 left-1/2 size-7 -translate-x-1/2 rounded-full border border-white/10 bg-[radial-gradient(circle_at_35%_28%,#454c54,#171b20)] shadow-[0_5px_8px_rgba(0,0,0,.65)]" />
      </span>
      <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md border border-[#e11d2e]/25 bg-[#12090b] px-2 py-1 text-[5px] font-black uppercase tracking-[0.14em] text-red-200">
        RACE HANDBRAKE
      </span>
      <span className="absolute bottom-1.5 inset-x-0 text-[7px] font-black uppercase tracking-[0.18em] text-slate-300">
        HANDBRAKE
      </span>
    </button>
  );
}
function Nitro({ settings, set }: { settings: Settings; set: Props["set"] }) {
  const [down, setDown] = useState(false);

  const held = useHoldControl((pressed) => {
    set({ nitro: pressed ? 1 : 0 });
    setDown(pressed);
    if (pressed) buzz(settings.vibration, [5, 18, 5, 18, 8]);
  });

  return (
    <button
      type="button"
      aria-label="Nitro"
      {...held}
      className={
        "relative h-[clamp(6.5rem,18svh,8.25rem)] w-[clamp(4.4rem,7.5vw,5.6rem)] touch-none select-none overflow-hidden rounded-[1.15rem] border border-cyan-200/15 bg-[#070a0e] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_12px_26px_rgba(0,0,0,.58)] active:translate-y-0.5 " +
        (down ? "brightness-125 ring-2 ring-cyan-300/30" : "")
      }
    >
      <span className="absolute inset-1.5 rounded-[0.95rem] border border-white/5 bg-[linear-gradient(180deg,#161e26,#080b0f)]" />

      {/* bottle neck + valve */}
      <span className="absolute left-1/2 top-2 h-5 w-7 -translate-x-1/2 rounded-t-md border border-white/10 bg-[linear-gradient(90deg,#4d5963,#dce1e5_48%,#5d6871)] shadow-[0_3px_5px_rgba(0,0,0,.5)]" />
      <span className="absolute left-1/2 top-0 h-3.5 w-6 -translate-x-1/2 rounded-md border border-black/20 bg-[linear-gradient(180deg,#e5e9ec,#69727a)] shadow-[0_3px_5px_rgba(0,0,0,.55)]" />
      <span className="absolute left-1/2 top-1 size-1.5 -translate-x-1/2 rounded-full bg-[#15191d]" />

      {/* cylinder */}
      <span
        className="absolute left-1/2 top-[18%] h-[56%] w-[72%] -translate-x-1/2 rounded-[35%] border border-white/15 bg-[linear-gradient(90deg,#151a20,#dce2e7_12%,#767f87_34%,#dfe4e8_52%,#5f6870_78%,#171c21)] shadow-[inset_0_3px_3px_rgba(255,255,255,.36),inset_0_-8px_10px_rgba(0,0,0,.5),0_8px_14px_rgba(0,0,0,.55)] transition-transform duration-100"
        style={{ transform: "translateX(-50%) translateY(" + (down ? 3 : 0) + "px) rotate(" + (down ? -1.5 : 0) + "deg)" }}
      >
        <span className="absolute inset-y-[8%] left-[11%] w-2 rounded-full bg-white/20" />
        <span className="absolute inset-x-[12%] top-[48%] -translate-y-1/2 rounded-md border border-black/20 bg-[#10151a]/80 px-1 py-1 text-[7px] font-black tracking-[0.12em] text-cyan-200 shadow-[inset_0_2px_4px_rgba(0,0,0,.7)]">
          NITRO
        </span>
        <span className="absolute inset-x-[16%] top-[66%] text-center text-[4px] font-black uppercase tracking-[0.16em] text-slate-500">
          10 lb • HIGH PRESSURE
        </span>
      </span>

      {/* pressure gauge */}
      <span className="absolute right-[7%] top-[31%] grid size-5 place-items-center rounded-full border border-white/20 bg-[#080b0e] shadow-[inset_0_0_5px_rgba(0,0,0,.8),0_2px_4px_rgba(0,0,0,.5)]">
        <span className="absolute left-1/2 top-1/2 h-px w-1.5 origin-left bg-cyan-200" style={{ transform: "rotate(" + (down ? 18 : -22) + "deg)" }} />
        <span className="size-1 rounded-full bg-slate-300" />
      </span>

      {/* hose / outlet */}
      <span className="absolute right-[14%] top-[57%] h-1.5 w-5 rotate-[20deg] rounded-full bg-[#0f151b] shadow-[0_2px_3px_rgba(0,0,0,.55)]" />
      <span className="absolute right-[7%] top-[55%] size-2 rounded-full border border-cyan-300/40 bg-cyan-300/10" />

      <span className="absolute inset-x-0 bottom-1 text-[6px] font-black uppercase tracking-[0.16em] text-cyan-100/75">
        {down ? "NITRO ARMED" : "NITRO"}
      </span>
    </button>
  );
}
function G29Wheel({
  wheelVisualRef,
  settings,
  press,
}: {
  wheelVisualRef: RefObject<HTMLDivElement | null>;
  settings: Settings;
  press: Props["press"];
}) {
  const horn = useHoldControl((down) => {
    press("horn", down);
    if (down) buzz(settings.vibration, 10);
  });
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 rounded-full bg-[#0b0d10] shadow-[0_30px_50px_rgba(0,0,0,.7),inset_0_0_0_1px_rgba(255,255,255,.08)]" />
      <div className="absolute inset-[3.3%] rounded-full border-[clamp(.85rem,1.65vh,1.35rem)] border-[#090b0d] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),inset_0_-8px_16px_rgba(0,0,0,.55)]" />
      <div className="absolute inset-[6.2%] rounded-full border-[clamp(.35rem,.8vh,.7rem)] border-[#25282c]" />
      <div className="absolute inset-[7.1%] rounded-full border border-[#454a50]/70" />
      <div className="absolute inset-[8.5%] rounded-full border-2 border-dashed border-[#6b7076]/25" />

      <div ref={wheelVisualRef} className="absolute inset-0 origin-center">
        <div className="absolute left-1/2 top-[3.4%] h-[7%] w-[4.5%] -translate-x-1/2 rounded-b-md bg-[#e11d2e] shadow-[0_0_18px_rgba(225,29,46,.45)]" />

        <div className="absolute left-1/2 top-1/2 h-[18%] w-[76%] -translate-x-1/2 -translate-y-1/2 rotate-[8deg] rounded-full bg-[linear-gradient(180deg,#9fa5ab,#4e555d)] shadow-[0_10px_15px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.5)]" />
        <div className="absolute left-1/2 top-1/2 h-[18%] w-[76%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] rounded-full bg-[linear-gradient(180deg,#9fa5ab,#4e555d)] shadow-[0_10px_15px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.5)]" />
        <div className="absolute left-1/2 top-[57%] h-[54%] w-[18%] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#5b626b,#a8adb3,#5b626b)] shadow-[0_10px_15px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.5)]" />

        <button
          type="button"
          aria-label="Horn"
          title="Horn"
          {...horn}
          className="pointer-events-auto absolute left-1/2 top-1/2 z-50 grid size-[27%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[clamp(.4rem,1vh,.75rem)] border-[#20252b] bg-[radial-gradient(circle_at_40%_28%,#4a5159,#1b1f24_58%,#0d1014_100%)] text-white shadow-[inset_0_0_20px_rgba(0,0,0,.75),0_12px_18px_rgba(0,0,0,.55)] active:brightness-150"
        >
          <span className="text-[clamp(.75rem,1.5vw,1.35rem)] font-black tracking-tight">G</span>
          <span className="absolute bottom-[28%] text-[clamp(.28rem,.5vw,.46rem)] font-black uppercase tracking-[.22em] text-slate-300">
            G29 • HORN
          </span>
        </button>
      </div>
    </div>
  );
}

export function FlatWheel({ settings, set, press, telemetry, telemetryLive, onSettingsChange, gameName = "Desktop" }: Props) {
  const wheelHitRef = useRef<HTMLDivElement>(null);
  const wheelVisualRef = useRef<HTMLDivElement>(null);
  const touchPointer = useRef<number | null>(null);
  const lastAngle = useRef<number | null>(null);
  const wheelRect = useRef<DOMRect | null>(null);
  const wheelAngleDeg = useRef(0);
  const centreAnimationRef = useRef<number | null>(null);
  const centreDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHapticAt = useRef(0);
  const [gyroReady, setGyroReady] = useState(false);
  const [gyroDenied, setGyroDenied] = useState(false);

  const maxLockDeg = Math.max(90, settings.wheelRotationDeg / 2);
  const prevLockRef = useRef(maxLockDeg);
  const previousMode = useRef(settings.steerMode);


  const paintWheel = useCallback((angleDeg: number) => {
    wheelAngleDeg.current = angleDeg;
    if (wheelVisualRef.current) {
      wheelVisualRef.current.style.transform = "rotate(" + angleDeg + "deg)";
    }
  }, []);

  const emitRaw = useCallback(
    (raw: number) => {
      // Sensitivity is applied at the input stage (drag speed / tilt ratio),
      // so the curve here only shapes deadzone + linearity.
      const value = applyCurve(
        Math.max(-1, Math.min(1, raw)),
        settings.deadzone,
        settings.linearity,
        1,
      );
      set({ steer: applySteeringTension(value, settings.steeringTension) });
    },
    [set, settings.deadzone, settings.linearity, settings.steeringTension],
  );

  const cancelCentre = useCallback(() => {
    if (centreDeadlineRef.current !== null) clearTimeout(centreDeadlineRef.current);
    centreDeadlineRef.current = null;
    if (centreAnimationRef.current !== null) {
      cancelAnimationFrame(centreAnimationRef.current);
      centreAnimationRef.current = null;
    }
  }, []);

  const setWheelRaw = useCallback(
    (raw: number) => {
      const clamped = Math.max(-1, Math.min(1, raw));
      const angleDeg = clamped * maxLockDeg;
      paintWheel(angleDeg);
      emitRaw(clamped);
    },
    [emitRaw, maxLockDeg, paintWheel],
  );

  const centreWheel = useCallback(() => {
    cancelCentre();

    const startAngle = wheelAngleDeg.current;
    if (Math.abs(startAngle) < 0.15) {
      setWheelRaw(0);
      return;
    }

    // Begin returning immediately; the old 520–760ms ease-in felt stuck.
    const duration = 120;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    const frame = (time: number) => {
      const elapsed = time - startedAt;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const angle = startAngle * (1 - eased);

      paintWheel(angle);
      emitRaw(angle / maxLockDeg);

      if (t < 1) {
        centreAnimationRef.current = requestAnimationFrame(frame);
      } else {
        cancelCentre();
        paintWheel(0);
        emitRaw(0);
      }
    };

    // rAF can stall in a busy mobile WebView; never leave the last steering
    // report held just because no animation frame arrived after finger-up.
    centreDeadlineRef.current = setTimeout(() => {
      cancelCentre();
      setWheelRaw(0);
    }, duration);
    centreAnimationRef.current = requestAnimationFrame(frame);
  }, [cancelCentre, emitRaw, maxLockDeg, paintWheel, setWheelRaw]);

  const requestGyro = useCallback(async () => {
    try {
      const DeviceOrientation = window.DeviceOrientationEvent as
        | (typeof window.DeviceOrientationEvent & {
            requestPermission?: () => Promise<"granted" | "denied">;
          })
        | undefined;

      if (!DeviceOrientation) {
        setGyroDenied(true);
        setGyroReady(false);
        return;
      }

      if (typeof DeviceOrientation.requestPermission === "function") {
        const permission = await DeviceOrientation.requestPermission();
        if (permission !== "granted") {
          setGyroDenied(true);
          setGyroReady(false);
          return;
        }
      }

      setGyroDenied(false);
      setGyroReady(true);
    } catch {
      setGyroDenied(true);
      setGyroReady(false);
    }
  }, []);

  useEffect(() => {
    const changed = previousMode.current !== settings.steerMode;
    previousMode.current = settings.steerMode;
    if (changed) {
      touchPointer.current = null;
      wheelRect.current = null;
      lastAngle.current = null;
      cancelCentre();
      setWheelRaw(0);
    }
    if (settings.steerMode !== "tilt") {
      setGyroReady(false);
      setGyroDenied(false);
      return;
    }

    const DeviceOrientation = window.DeviceOrientationEvent as
      | (typeof window.DeviceOrientationEvent & {
          requestPermission?: () => Promise<"granted" | "denied">;
        })
      | undefined;

    if (DeviceOrientation && typeof DeviceOrientation.requestPermission !== "function") {
      setGyroReady(true);
    }
  }, [cancelCentre, settings.steerMode, setWheelRaw]);

  useEffect(() => {
    if (settings.steerMode !== "tilt" || !gyroReady) return;

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;
      const screenAngle =
        typeof window !== "undefined"
          ? window.screen.orientation?.angle ??
            (window as Window & { orientation?: number }).orientation ??
            0
          : 0;

      let tilt = gamma;
      if (Math.abs(screenAngle) === 90) {
        tilt = screenAngle === 90 ? beta : -beta;
      }

      // Gyro: higher sensitivity reaches full lock with less tilt.
      const raw = Math.max(
        -1,
        Math.min(
          1,
          ((settings.invertTilt ? -tilt : tilt) / Math.max(1, settings.maxTiltDeg)) *
            settings.steerSensitivity,
        ),
      );

      setWheelRaw(raw);
    };

    window.addEventListener("deviceorientation", onOrientation, true);
    return () => window.removeEventListener("deviceorientation", onOrientation, true);
  }, [
    gyroReady,
    settings.invertTilt,
    settings.maxTiltDeg,
    settings.steerMode,
    settings.steerSensitivity,
    setWheelRaw,
  ]);

  const grabWheel = (e: PointerEvent<HTMLDivElement>) => {
    if (settings.steerMode !== "touch") return;
    if (touchPointer.current !== null) return;

    const el = wheelHitRef.current;
    if (!el) return;

    cancelCentre();
    e.preventDefault();
    touchPointer.current = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {
      // Global listeners below also cover WebViews without reliable capture.
    }

    const rect = wheelRect.current = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngle.current = Math.hypot(e.clientX - cx, e.clientY - cy) < Math.min(rect.width, rect.height) * 0.12
      ? null : Math.atan2(e.clientY - cy, e.clientX - cx);
    buzz(settings.vibration, 8);
  };

  const dragWheel = (e: PointerEvent<HTMLDivElement> | globalThis.PointerEvent) => {
    if (settings.steerMode !== "touch") return;
    if (touchPointer.current !== e.pointerId) return;

    const el = wheelHitRef.current;
    if (!el) return;

    e.preventDefault();

    const rect = wheelRect.current;
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Rebase after crossing the hub: atan2 is undefined at the centre and
    // otherwise a tiny finger movement can jump half a turn into full lock.
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < Math.min(rect.width, rect.height) * 0.12) {
      lastAngle.current = null;
      return;
    }
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    if (lastAngle.current === null) {
      lastAngle.current = angle;
      return;
    }
    let delta = angle - lastAngle.current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle.current = angle;

    // Touch: higher sensitivity turns the wheel more per finger sweep.
    const next = Math.max(
      -maxLockDeg,
      Math.min(
        maxLockDeg,
        wheelAngleDeg.current + ((delta * 180) / Math.PI) * settings.steerSensitivity,
      ),
    );

    emitRaw(next / maxLockDeg);
    paintWheel(next);

    if (settings.vibration && settings.ffbHaptics && Math.abs(delta) > 0.012) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastHapticAt.current > 75) {
        lastHapticAt.current = now;
        const intensity = Math.min(1, Math.abs(next) / maxLockDeg);
        buzz(true, Math.min(12, 3 + Math.round(intensity * 8)));
      }
    }

    if (settings.vibration && settings.ffbHaptics) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const nearCenter = Math.abs(next) < 2.5;
      const nearLock = maxLockDeg - Math.abs(next) < 3.5;
      if (
        now - lastHapticAt.current > 90 &&
        (nearCenter || nearLock)
      ) {
        lastHapticAt.current = now;
        buzz(true, nearLock ? [4, 12, 4] : 4);
      }
    }
  };

  const releaseWheel = (e?: { pointerId: number }) => {
    if (touchPointer.current === null || (e && touchPointer.current !== e.pointerId)) return;
    touchPointer.current = null;
    wheelRect.current = null;
    lastAngle.current = null;
    if (settings.autoCentre) centreWheel();
  };
  const gestureRef = useRef({ dragWheel, releaseWheel });
  gestureRef.current = { dragWheel, releaseWheel };
  useEffect(() => {
    // Capture phase runs before horn/pedal handlers can stop propagation.
    const up = (e: globalThis.PointerEvent) => gestureRef.current.releaseWheel(e);
    const move = (e: globalThis.PointerEvent) => {
      if (!wheelHitRef.current?.contains(e.target as Node)) gestureRef.current.dragWheel(e);
    };
    const touchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) gestureRef.current.releaseWheel();
    };
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("touchend", touchEnd, true);
    window.addEventListener("touchcancel", touchEnd, true);
    return () => {
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("touchend", touchEnd, true);
      window.removeEventListener("touchcancel", touchEnd, true);
    };
  }, []);
  useInputReset(() => {
    touchPointer.current = null;
    wheelRect.current = null;
    lastAngle.current = null;
    cancelCentre();
    setWheelRaw(0);
  });

  useEffect(() => {
    return () => cancelCentre();
  }, [cancelCentre]);

  // Changing the lock range keeps the current steering output identical:
  // the visual angle is re-scaled into the new range instead of jumping.
  useEffect(() => {
    const previous = prevLockRef.current;
    if (previous === maxLockDeg) return;
    prevLockRef.current = maxLockDeg;
    cancelCentre();
    const ratio = wheelAngleDeg.current / previous;
    setWheelRaw(ratio);
  }, [cancelCentre, maxLockDeg, setWheelRaw]);

  const cycleSendRate = () => {
    const values: Settings["sendRateHz"][] = [60, 120, 144, 180, 240, 333];
    const index = values.indexOf(settings.sendRateHz);
    const next = values[(index >= 0 ? index + 1 : 0) % values.length] ?? 333;
    buzz(settings.vibration, 8);
    onSettingsChange({ sendRateHz: next });
  };

  const selectDegrees = (deg: number) => {
    if (deg === settings.wheelRotationDeg) return;
    buzz(settings.vibration, 8);
    onSettingsChange({ wheelRotationDeg: deg });
  };


  return (
    <div className="flat-wheel-root absolute inset-0 overflow-hidden bg-[#080a0d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_6%,#1a222b_0%,#080a0d_55%,#030405_100%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-white/15" />
      <div className="pointer-events-none absolute inset-4 rounded-[1.4rem] border border-[#e11d2e]/15" />

      <div className="flat-wheel-header-stack">
        {settings.steerMode === "tilt" && !gyroReady && (
          <div className="flat-wheel-gyro relative z-30">
            <button
              type="button"
              onClick={requestGyro}
              className="rounded-xl border border-[#e11d2e]/40 bg-[#11151a]/90 px-3 py-2 text-[7px] font-black uppercase tracking-[0.15em] text-white shadow-[0_8px_20px_rgba(0,0,0,.5)] backdrop-blur-md active:scale-[.98] md:px-5 md:py-2.5 md:text-[9px] md:tracking-[0.2em]"
            >
              {gyroDenied ? "ENABLE GYRO AGAIN" : "ENABLE GYRO"}
            </button>
          </div>
        )}

        <TelemetryCluster telemetry={telemetry} live={telemetryLive} />

        <div className="flat-wheel-degrees flex items-center gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur-md md:gap-1.5 md:p-1.5">
          <span className="px-1 text-[6px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-[8px]">
            LOCK
          </span>
          {STEER_DEGREES.map((deg) => {
            const active = settings.wheelRotationDeg === deg;
            return (
              <button
                key={deg}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  selectDegrees(deg);
                }}
                className={
                  "rounded-lg px-1.5 py-1 text-[7px] font-black tracking-tight transition-colors md:px-2.5 md:py-1.5 md:text-[10px] " +
                  (active
                    ? "bg-[#e11d2e] text-white shadow-[0_0_14px_rgba(225,29,46,.55)]"
                    : "bg-white/5 text-slate-400 active:bg-white/15")
                }
              >
                {deg}°
              </button>
            );
          })}
        </div>

        <div className="flat-wheel-sens flex items-center gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur-md md:gap-1.5 md:p-1.5">
          <span className="px-1 text-[6px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-[8px]">
            SENS
          </span>
          {STEER_SENS.map((s) => {
            const active = Math.abs(settings.steerSensitivity - s) < 0.001;
            return (
              <button
                key={s}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (active) return;
                  buzz(settings.vibration, 8);
                  onSettingsChange({ steerSensitivity: s });
                }}
                className={
                  "rounded-lg px-1.5 py-1 text-[7px] font-black tracking-tight transition-colors md:px-2.5 md:py-1.5 md:text-[10px] " +
                  (active
                    ? "bg-[#e11d2e] text-white shadow-[0_0_14px_rgba(225,29,46,.55)]"
                    : "bg-white/5 text-slate-400 active:bg-white/15")
                }
              >
                {s.toFixed(2)}×
              </button>
            );
          })}
        </div>
      </div>

      <div className="flat-wheel-root-title absolute left-2 top-2 z-20 rounded-xl border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-md md:left-5 md:top-5 md:px-3 md:py-2">
        <div className="text-[6px] font-black uppercase tracking-[0.22em] text-slate-500 md:text-[8px] md:tracking-[0.25em]">
          STEERING MODE
        </div>
        <div className="mt-0.5 text-[11px] font-black tracking-tight text-white md:mt-1 md:text-sm">
          LOGITECH G29 STYLE
        </div>
        <div className="mt-1 max-w-[15rem] truncate text-[6px] font-black uppercase tracking-[0.16em] text-red-200/65 md:text-[8px]">
          GAME • {gameName}
        </div>
        <div className="mt-0.5 text-[6px] font-semibold uppercase tracking-[0.15em] text-slate-500 md:text-[8px] md:tracking-[0.2em]">
          {settings.steerMode === "touch"
            ? `Touch ${settings.wheelRotationDeg}° wheel • ${settings.autoCentre ? "Auto-centre" : "Hold position"}`
            : gyroReady
              ? "Gyro steering"
              : "Gyro permission required"} • {settings.sendRateHz} Hz
        </div>
      </div>

      <div className="flat-wheel-stage absolute inset-0 px-2 pb-2 pt-16 md:px-5 md:pb-5 md:pt-20">
        <div className="relative h-full w-full">
          <div
            ref={wheelHitRef}
            className="flat-wheel-hit absolute bottom-[4%] left-[2%] aspect-square w-[min(72svh,56svw)] touch-none select-none md:bottom-[7%] md:left-[4%] md:w-[min(63vh,53vw)] md:min-h-60 md:min-w-60"
            onPointerDown={grabWheel}
            onPointerMove={dragWheel}
            onPointerUp={releaseWheel}
            onPointerCancel={releaseWheel}
            onLostPointerCapture={releaseWheel}
          >
            <G29Wheel
              wheelVisualRef={wheelVisualRef}
              settings={settings}
              press={press}
            />
          </div>

          <div className="flat-wheel-pedals absolute bottom-[4%] right-[18%] flex items-end gap-[clamp(.45rem,1.2vw,.9rem)] md:bottom-[7%] md:right-[18%] md:gap-[clamp(.75rem,1.5vw,1.3rem)]">
            <Pedal id="brake" label="BRAKE" settings={settings} set={set} accent="#ef4444" />
            <Pedal id="throttle" label="GAS" settings={settings} set={set} accent="#22c55e" />
          </div>

          <div className="flat-wheel-aux absolute bottom-[5%] right-[1.5%] flex flex-col items-center gap-2 md:bottom-[12%] md:right-[4%] md:gap-3">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                cycleSendRate();
              }}
              className="flat-wheel-rate relative z-30 self-center rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[0.16em] text-cyan-200 backdrop-blur-md md:px-3 md:py-2 md:text-[9px]"
              aria-label={`Controller polling rate ${settings.sendRateHz} Hz. Tap to change.`}
              title="Change controller polling rate"
            >
              RATE {settings.sendRateHz} HZ
            </button>
            <Handbrake settings={settings} set={set} />
            <Nitro settings={settings} set={set} />
          </div>

        </div>
      </div>
    </div>
  );
}
