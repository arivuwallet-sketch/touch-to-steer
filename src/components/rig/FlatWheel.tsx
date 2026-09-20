import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject, type ReactNode } from "react";
import type { BridgeTelemetry } from "@/hooks/useBridge";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
  telemetry?: BridgeTelemetry;
};

const buzz = (enabled: boolean, ms = 10) => {
  if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};


function stopWheelGesture(e: PointerEvent<HTMLElement>) {
  e.stopPropagation();
}

function MomentaryButton({
  id,
  label,
  press,
  settings,
  className = "",
  title,
}: {
  id: string;
  label: ReactNode;
  press: Props["press"];
  settings: Settings;
  className?: string;
  title?: string;
}) {
  const down = useRef(false);

  const release = () => {
    if (!down.current) return;
    down.current = false;
    press(id, false);
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={typeof label === "string" ? label : id}
      onPointerDown={(e) => {
        stopWheelGesture(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        down.current = true;
        press(id, true);
        buzz(settings.vibration, 7);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        release();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        release();
      }}
      className={`pointer-events-auto absolute touch-none select-none border border-white/10 bg-[linear-gradient(180deg,#303840,#10151b)] font-black text-white shadow-[0_4px_10px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.12)] transition active:translate-y-px active:brightness-150 ${className}`}
    >
      {label}
    </button>
  );
}

function Paddle({
  id,
  gear,
  side,
  settings,
  set,
  press,
}: {
  id: "l1" | "r1";
  gear: -1 | 1;
  side: "left" | "right";
  settings: Settings;
  set: Props["set"];
  press: Props["press"];
}) {
  const active = useRef(false);

  const release = () => {
    if (!active.current) return;
    active.current = false;
    press(id, false);
    set({ gear: 0 });
  };

  return (
    <button
      type="button"
      aria-label={side === "left" ? "G29 left paddle, gear down" : "G29 right paddle, gear up"}
      onPointerDown={(e) => {
        stopWheelGesture(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        press(id, true);
        set({ gear });
        buzz(settings.vibration, 8);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        release();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        release();
      }}
      className={`pointer-events-auto absolute z-50 h-[18%] w-[9%] touch-none select-none rounded-lg border border-[#d8dde2]/30 bg-[linear-gradient(180deg,#dce1e6,#727b85)] text-[7px] font-black text-slate-900 shadow-[0_7px_12px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.75)] active:brightness-125 ${side === "left" ? "left-[14%] top-[26%] -rotate-[10deg]" : "right-[14%] top-[26%] rotate-[10deg]"}`}
    >
      {side === "left" ? "L1" : "R1"}
      <span className="absolute inset-x-0 bottom-1 text-[5px] tracking-wider">{gear === -1 ? "DOWN" : "UP"}</span>
    </button>
  );
}

function DPad({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <div className="pointer-events-none absolute left-[13%] top-[37%] z-40 size-[23%]">
      <MomentaryButton id="dpad_up" label="▲" press={press} settings={settings} className="left-[33%] top-0 h-[34%] w-[34%] rounded-[.45rem] text-[clamp(.55rem,1.1vw,1rem)]" title="D-pad up" />
      <MomentaryButton id="dpad_left" label="◀" press={press} settings={settings} className="left-0 top-[33%] h-[34%] w-[34%] rounded-[.45rem] text-[clamp(.55rem,1.1vw,1rem)]" title="D-pad left" />
      <MomentaryButton id="dpad_right" label="▶" press={press} settings={settings} className="right-0 top-[33%] h-[34%] w-[34%] rounded-[.45rem] text-[clamp(.55rem,1.1vw,1rem)]" title="D-pad right" />
      <MomentaryButton id="dpad_down" label="▼" press={press} settings={settings} className="bottom-0 left-[33%] h-[34%] w-[34%] rounded-[.45rem] text-[clamp(.55rem,1.1vw,1rem)]" title="D-pad down" />
      <div className="absolute left-[34%] top-[34%] size-[32%] rounded-full bg-[#0b0f13] shadow-inner" />
    </div>
  );
}

function FaceButtons({ settings, press }: { settings: Settings; press: Props["press"] }) {
  return (
    <div className="pointer-events-none absolute right-[11%] top-[35%] z-40 size-[25%]">
      <MomentaryButton id="triangle" label="△" press={press} settings={settings} className="left-[34%] top-0 h-[31%] w-[31%] rounded-full text-[clamp(.6rem,1.1vw,1rem)]" title="Triangle" />
      <MomentaryButton id="square" label="□" press={press} settings={settings} className="left-0 top-[34%] h-[31%] w-[31%] rounded-full text-[clamp(.6rem,1.1vw,1rem)]" title="Square" />
      <MomentaryButton id="circle" label="○" press={press} settings={settings} className="right-0 top-[34%] h-[31%] w-[31%] rounded-full text-[clamp(.6rem,1.1vw,1rem)]" title="Circle" />
      <MomentaryButton id="cross" label="×" press={press} settings={settings} className="bottom-0 left-[34%] h-[31%] w-[31%] rounded-full text-[clamp(.6rem,1.1vw,1rem)]" title="Cross" />
    </div>
  );
}

function Dial({
  settings,
  press,
  position,
  onStep,
}: {
  settings: Settings;
  press: Props["press"];
  position: number;
  onStep: (direction: -1 | 1) => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-[12%] right-[13%] z-50 flex size-[16%] items-center justify-center rounded-full border-[clamp(3px,.45vw,8px)] border-[#6c1018] bg-[#1c2227] shadow-[0_8px_18px_rgba(0,0,0,.6)]" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="24-point selector dial left"
        title="Selector dial left"
        onPointerDown={(e) => { e.stopPropagation(); onStep(-1); }}
        className="absolute left-0 top-1/2 z-10 grid h-1/2 w-1/3 -translate-y-1/2 place-items-center rounded-l-full bg-[#282f35] text-[clamp(.45rem,.85vw,.8rem)] text-slate-300"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="24-point selector dial press"
        title="24-point selector press"
        onPointerDown={(e) => {
          e.stopPropagation();
          press("dial_press", true);
          buzz(settings.vibration, 7);
        }}
        onPointerUp={(e) => { e.stopPropagation(); press("dial_press", false); }}
        onPointerCancel={(e) => { e.stopPropagation(); press("dial_press", false); }}
        className="grid size-[56%] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_25%,#f02b3c,#8e0f1d_55%,#39070d_100%)] text-[clamp(.45rem,.75vw,.7rem)] font-black text-white shadow-[inset_0_2px_3px_rgba(255,255,255,.25),0_0_12px_rgba(225,29,46,.25)]"
      >
        <span>{position.toString().padStart(2, "0")}</span>
      </button>
      <button
        type="button"
        aria-label="24-point selector dial right"
        title="Selector dial right"
        onPointerDown={(e) => { e.stopPropagation(); onStep(1); }}
        className="absolute right-0 top-1/2 z-10 grid h-1/2 w-1/3 -translate-y-1/2 place-items-center rounded-r-full bg-[#282f35] text-[clamp(.45rem,.85vw,.8rem)] text-slate-300"
      >
        ›
      </button>
      <span className="pointer-events-none absolute -bottom-[15%] text-[clamp(.3rem,.55vw,.5rem)] font-black uppercase tracking-[.12em] text-red-300">24-POS</span>
    </div>
  );
}

function RpmLeds({ ratio, live }: { ratio: number; live: boolean }) {
  const level = Math.max(0, Math.min(1, ratio));
  return (
    <div className="pointer-events-none absolute left-1/2 top-[10%] z-30 flex w-[34%] -translate-x-1/2 flex-col items-center gap-[3px]">
      <div className="flex w-full justify-center gap-[3px]">
        {Array.from({ length: 10 }).map((_, index) => {
          const lit = level > index / 10;
          const hot = index >= 8;
          const warm = index >= 6;
          const cls = lit
            ? hot
              ? "bg-red-500 shadow-[0_0_7px_rgba(239,68,68,.95)]"
              : warm
                ? "bg-amber-300 shadow-[0_0_7px_rgba(252,211,77,.85)]"
                : "bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.8)]"
            : "bg-[#232930]";
          return <span key={index} className={`h-1.5 flex-1 rounded-full ${cls}`} />;
        })}
      </div>
      <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[clamp(.28rem,.55vw,.48rem)] font-black uppercase tracking-[.16em] text-slate-400">
        {live ? "RPM LIVE" : "RPM PREVIEW"}
      </span>
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
  onLevel?: (value: number) => void;
}) {
  const [value, setValue] = useState(0);
  const active = useRef<number | null>(null);
  const pedalRef = useRef<HTMLButtonElement>(null);

  const update = (clientY: number) => {
    const el = pedalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    setValue(next);
    set({ [id]: next } as Partial<ControllerState>);
    if (id === "throttle") onLevel?.(next);
  };

  const release = () => {
    active.current = null;
    setValue(0);
    set({ [id]: 0 } as Partial<ControllerState>);
    if (id === "throttle") onLevel?.(0);
  };

  return (
    <button
      ref={pedalRef}
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        buzz(settings.vibration, 8);
        update(e.clientY);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="group relative h-[62svh] min-h-0 w-[clamp(3.8rem,8vw,5.4rem)] md:h-[42vh] md:min-h-44 md:w-[clamp(4.2rem,7vw,6.2rem)] touch-none select-none overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d12]/95 p-2 shadow-[0_12px_28px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.04)]"
    >
      <span className="absolute inset-2 rounded-[1.05rem] border border-white/5 bg-[linear-gradient(180deg,#151b22,#0a0e13)]" />
      <span
        className="absolute inset-x-4 bottom-10 rounded-xl border border-white/10 bg-gradient-to-b from-[#edf1f4] via-[#b9c0c7] to-[#727a84] shadow-[0_6px_12px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.6)] transition-all"
        style={{
          height: `calc(30% + ${value * 58}%)`,
          boxShadow: `0 0 14px ${accent}33, 0 6px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.6)`,
        }}
      >
        <span className="absolute inset-x-2 top-3 grid gap-2">
          {Array.from({ length: 5 }).map((_, row) => (
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
      className="relative h-[38svh] w-[clamp(4rem,9vw,5.5rem)] md:h-40 md:w-24 touch-none select-none rounded-[1.25rem] border border-white/10 bg-[#0b0f14] shadow-[0_10px_24px_rgba(0,0,0,.5)] active:brightness-125"
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
      className={`grid h-12 w-[clamp(4rem,9vw,5.5rem)] md:h-14 md:w-24 touch-none select-none place-items-center rounded-xl border border-cyan-300/25 bg-[linear-gradient(180deg,#27313b,#10151b)] text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200 shadow-[0_7px_16px_rgba(0,0,0,.46),inset_0_1px_0_rgba(255,255,255,.08)] active:translate-y-0.5 ${down ? "brightness-150 ring-2 ring-fuchsia-400/40" : ""}`}
    >
      NITRO
    </button>
  );
}

function G29Wheel({
  wheelVisualRef,
  settings,
  set,
  press,
  dialPosition,
  onDialStep,
  rpmRatio,
  rpmLive,
  wheelPlatform,
  onPlatformChange,
}: {
  wheelVisualRef: RefObject<HTMLDivElement | null>;
  settings: Settings;
  set: Props["set"];
  press: Props["press"];
  dialPosition: number;
  onDialStep: (direction: -1 | 1) => void;
  rpmRatio: number;
  rpmLive: boolean;
  wheelPlatform: "ps3" | "ps4";
  onPlatformChange: (platform: "ps3" | "ps4") => void;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
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

        <div className="absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[clamp(.4rem,1vh,.75rem)] border-[#20252b] bg-[radial-gradient(circle_at_38%_30%,#424850_0%,#1b1f24_58%,#0d1014_100%)] shadow-[inset_0_0_20px_rgba(0,0,0,.75),0_12px_18px_rgba(0,0,0,.45)]" />
        <RpmLeds ratio={rpmRatio} live={rpmLive} />

        <Paddle id="l1" gear={-1} side="left" settings={settings} set={set} press={press} />
        <Paddle id="r1" gear={1} side="right" settings={settings} set={set} press={press} />

        <DPad settings={settings} press={press} />
        <FaceButtons settings={settings} press={press} />

        <MomentaryButton id="l2" label="L2" press={press} settings={settings} className="left-[22%] top-[60%] h-[7%] w-[10%] rounded-md text-[clamp(.38rem,.65vw,.58rem)]" />
        <MomentaryButton id="r2" label="R2" press={press} settings={settings} className="right-[22%] top-[60%] h-[7%] w-[10%] rounded-md text-[clamp(.38rem,.65vw,.58rem)]" />
        <MomentaryButton id="l3" label="L3" press={press} settings={settings} className="left-[22%] top-[69%] h-[7%] w-[10%] rounded-md text-[clamp(.38rem,.65vw,.58rem)]" />
        <MomentaryButton id="r3" label="R3" press={press} settings={settings} className="right-[22%] top-[69%] h-[7%] w-[10%] rounded-md text-[clamp(.38rem,.65vw,.58rem)]" />

        <MomentaryButton id="minus" label="−" press={press} settings={settings} className="left-[27%] top-[64%] h-[8%] w-[10%] rounded-lg text-[clamp(.65rem,1.1vw,1rem)]" title="Minus" />
        <MomentaryButton id="plus" label="+" press={press} settings={settings} className="left-[27%] top-[74%] h-[8%] w-[10%] rounded-lg text-[clamp(.65rem,1.1vw,1rem)]" title="Plus" />

        <MomentaryButton id="share" label="SHARE" press={press} settings={settings} className="left-[39%] top-[79%] h-[6%] w-[9%] rounded-md text-[clamp(.3rem,.5vw,.45rem)]" title="Share" />
        <MomentaryButton id="options" label="OPTIONS" press={press} settings={settings} className="left-1/2 top-[79%] h-[6%] w-[12%] -translate-x-1/2 rounded-md text-[clamp(.3rem,.48vw,.45rem)]" title="Options" />
        <MomentaryButton id="ps" label="PS" press={press} settings={settings} className="right-[39%] top-[79%] h-[6%] w-[9%] rounded-md text-[clamp(.34rem,.55vw,.5rem)]" title="PlayStation" />
        <MomentaryButton id="enter" label="ENTER" press={press} settings={settings} className="left-1/2 top-[87%] h-[5%] w-[12%] -translate-x-1/2 rounded-md text-[clamp(.3rem,.48vw,.45rem)]" title="Enter" />

        <button
          type="button"
          aria-label="Horn"
          title="Horn"
          onPointerDown={(e) => {
            stopWheelGesture(e);
            e.currentTarget.setPointerCapture(e.pointerId);
            press("horn", true);
            buzz(settings.vibration, 10);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            press("horn", false);
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            press("horn", false);
          }}
          className="pointer-events-auto absolute left-1/2 top-1/2 z-50 grid size-[27%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[clamp(.4rem,1vh,.75rem)] border-[#20252b] bg-[radial-gradient(circle_at_40%_28%,#4a5159,#1b1f24_58%,#0d1014_100%)] text-white shadow-[inset_0_0_20px_rgba(0,0,0,.75),0_12px_18px_rgba(0,0,0,.55)] active:brightness-150"
        >
          <span className="text-[clamp(.75rem,1.5vw,1.35rem)] font-black tracking-tight">G</span>
          <span className="absolute bottom-[28%] text-[clamp(.28rem,.5vw,.46rem)] font-black uppercase tracking-[.22em] text-slate-300">G29 • HORN</span>
        </button>

        <Dial settings={settings} press={press} position={dialPosition} onStep={onDialStep} />

        {[0, 1, 2, 3].map((i) => {
          const angle = i * 90;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-[14%] size-[2.1%] -translate-x-1/2 rounded-full border border-[#9da3aa]/50 bg-[#161a1f] shadow-inner"
              style={{ transform: `translateX(-50%) rotate(${angle}deg) translateY(520%)` }}
            />
          );
        })}
      </div>

      <div className="absolute left-1/2 top-[15%] -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[7px] font-black uppercase tracking-[0.25em] text-slate-400 backdrop-blur-sm">
        {settings.wheelRotationDeg}° LOCK
      </div>
      <div className="pointer-events-auto absolute left-1/2 top-[5.5%] z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-[#11161b]/95 p-1 shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <span className="px-1 text-[clamp(.28rem,.55vw,.48rem)] font-black uppercase tracking-[.13em] text-slate-500">MODE</span>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPlatformChange("ps3");
            }}
            className={`rounded px-2 py-1 text-[clamp(.3rem,.6vw,.5rem)] font-black ${wheelPlatform === "ps3" ? "bg-[#e11d2e] text-white" : "bg-[#303840] text-slate-200"}`}
          >
            PS3
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPlatformChange("ps4");
            }}
            className={`rounded px-2 py-1 text-[clamp(.3rem,.6vw,.5rem)] font-black ${wheelPlatform === "ps4" ? "bg-[#e11d2e] text-white" : "bg-[#303840] text-slate-200"}`}
          >
            PS4 / PC
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[3.5%] left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[clamp(.28rem,.52vw,.46rem)] font-black uppercase tracking-[.15em] text-slate-500">
        {settings.wheelRotationDeg}° LOCK • HALL SENSOR STYLE • HELICAL FFB
      </div>
    </div>
  );
}

export function FlatWheel({ settings, set, press, telemetry = {} }: Props) {
  const wheelHitRef = useRef<HTMLDivElement>(null);
  const wheelVisualRef = useRef<HTMLDivElement>(null);
  const touchPointer = useRef<number | null>(null);
  const lastAngle = useRef(0);
  const wheelAngleDeg = useRef(0);
  const [gyroReady, setGyroReady] = useState(false);
  const [gyroDenied, setGyroDenied] = useState(false);
  const [dialPosition, setDialPosition] = useState(0);
  const [localRev, setLocalRev] = useState(0);
  const [wheelPlatform, setWheelPlatform] = useState<"ps3" | "ps4">("ps4");
  const lastFfbBuzzAt = useRef(0);

  const maxLockDeg = Math.max(90, settings.wheelRotationDeg / 2);
  const rpmLive = typeof telemetry?.rpm === "number" && typeof telemetry?.rpmMax === "number" && telemetry.rpmMax > 0;
  const rpmRatio = rpmLive ? Math.max(0, Math.min(1, telemetry!.rpm! / telemetry!.rpmMax!)) : localRev;

  const paintWheel = useCallback((angleDeg: number) => {
    wheelAngleDeg.current = angleDeg;
    if (wheelVisualRef.current) {
      wheelVisualRef.current.style.transform = `rotate(${angleDeg}deg)`;
    }
  }, []);

  const emitRaw = useCallback(
    (raw: number) => {
      const value = applyCurve(
        Math.max(-1, Math.min(1, raw)),
        settings.deadzone,
        settings.linearity,
        settings.steerSensitivity,
      );
      set({ steer: value });
    },
    [set, settings.deadzone, settings.linearity, settings.steerSensitivity],
  );

  const setWheelRaw = useCallback(
    (raw: number) => {
      const clamped = Math.max(-1, Math.min(1, raw));
      paintWheel(clamped * maxLockDeg);
      emitRaw(clamped);
    },
    [emitRaw, maxLockDeg, paintWheel],
  );

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
    if (settings.steerMode !== "tilt") {
      setGyroReady(false);
      setGyroDenied(false);
      setWheelRaw(0);
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
  }, [settings.steerMode, setWheelRaw]);

  useEffect(() => {
    if (settings.steerMode !== "tilt" || !gyroReady) return;

    const onOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;
      const screenAngle =
        typeof window !== "undefined"
          ? window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0
          : 0;

      let tilt = gamma;
      if (Math.abs(screenAngle) === 90) {
        tilt = screenAngle === 90 ? beta : -beta;
      }

      const raw = Math.max(-1, Math.min(1, (settings.invertTilt ? -tilt : tilt) / Math.max(1, settings.maxTiltDeg)));
      setWheelRaw(raw);
    };

    window.addEventListener("deviceorientation", onOrientation, true);
    return () => window.removeEventListener("deviceorientation", onOrientation, true);
  }, [gyroReady, settings.invertTilt, settings.maxTiltDeg, settings.steerMode, setWheelRaw]);


  const stepDial = useCallback(
    (direction: -1 | 1) => {
      setDialPosition((current) => (current + direction + 24) % 24);
        set({ dial: direction });
      window.setTimeout(() => set({ dial: 0 }), 70);
      buzz(settings.vibration, 6);
    },
    [set, settings.vibration],
  );

  const grabWheel = (e: PointerEvent<HTMLDivElement>) => {
    if (settings.steerMode !== "touch") return;
    if (touchPointer.current !== null) return;

    const el = wheelHitRef.current;
    if (!el) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchPointer.current = e.pointerId;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngle.current = Math.atan2(e.clientY - cy, e.clientX - cx);
    buzz(settings.vibration, 8);
  };

  const dragWheel = (e: PointerEvent<HTMLDivElement>) => {
    if (settings.steerMode !== "touch") return;
    if (touchPointer.current !== e.pointerId) return;

    const el = wheelHitRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);

    let delta = angle - lastAngle.current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle.current = angle;

    const next = Math.max(
      -maxLockDeg,
      Math.min(maxLockDeg, wheelAngleDeg.current + (delta * 180) / Math.PI),
    );

    paintWheel(next);
    emitRaw(next / maxLockDeg);

    if (settings.ffbHaptics && Math.abs(delta) > 0.018) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastFfbBuzzAt.value > 85) {
        lastFfbBuzzAt.value = now;
        buzz(true, Math.min(10, 3 + Math.round(Math.abs(delta) * 22)));
      }
    }
  };

  useEffect(() => {
    const ffb = telemetry?.ffb;
    if (!settings.ffbHaptics || typeof ffb !== "number" || Math.abs(ffb) < 0.08) return;
    buzz(true, Math.max(4, Math.round(4 + Math.abs(ffb) * 18)));
  }, [settings.ffbHaptics, telemetry?.ffb]);

  const releaseWheel = () => {
    touchPointer.current = null;
    if (settings.autoCentre && settings.steerMode === "touch") {
      setWheelRaw(0);
    }
  };

  return (
    <div className="flat-wheel-root absolute inset-0 overflow-hidden bg-[#080a0d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_6%,#1a222b_0%,#080a0d_55%,#030405_100%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-white/15" />
      <div className="pointer-events-none absolute inset-4 rounded-[1.4rem] border border-[#e11d2e]/15" />

      <div className="flat-wheel-root-title absolute left-2 top-2 z-20 rounded-xl border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-md md:left-5 md:top-5 md:px-3 md:py-2">
        <div className="text-[6px] font-black uppercase tracking-[0.22em] text-slate-500 md:text-[8px] md:tracking-[0.25em]">STEERING MODE</div>
        <div className="mt-0.5 text-[11px] font-black tracking-tight text-white md:mt-1 md:text-sm">LOGITECH G29 STYLE</div>
        <div className="mt-0.5 text-[6px] font-semibold uppercase tracking-[0.15em] text-slate-500 md:text-[8px] md:tracking-[0.2em]">
          {settings.steerMode === "touch" ? "Touch rotation" : gyroReady ? "Gyro active" : "Gyro permission required"}
        </div>
      </div>

      {settings.steerMode === "tilt" && !gyroReady && (
        <div className="flat-wheel-gyro absolute left-1/2 top-[3.5rem] z-30 -translate-x-1/2 md:top-5">
          <button
            type="button"
            onClick={requestGyro}
            className="rounded-xl border border-[#e11d2e]/40 bg-[#11151a]/90 px-3 py-2.5 text-[8px] font-black uppercase tracking-[0.15em] text-white shadow-[0_10px_24px_rgba(0,0,0,.5)] backdrop-blur-md active:scale-[.98] md:px-5 md:py-3 md:text-[9px] md:tracking-[0.2em]"
          >
            {gyroDenied ? "ENABLE GYRO AGAIN" : "ENABLE GYRO"}
          </button>
        </div>
      )}

      <div className="flat-wheel-stage absolute inset-0 px-2 pb-2 pt-16 md:px-5 md:pb-5 md:pt-20">
        <div className="relative h-full w-full">
          <div
            ref={wheelHitRef}
            className="flat-wheel-hit absolute bottom-[4%] left-[2%] aspect-square w-[min(72svh,56svw)] touch-none select-none md:bottom-[7%] md:left-[4%] md:w-[min(63vh,53vw)] md:min-h-60 md:min-w-60"
            onPointerDown={grabWheel}
            onPointerMove={dragWheel}
            onPointerUp={releaseWheel}
            onPointerCancel={releaseWheel}
          >
            <G29Wheel
              wheelVisualRef={wheelVisualRef}
              settings={settings}
              set={set}
              press={press}
              dialPosition={dialPosition}
              onDialStep={stepDial}
              rpmRatio={rpmRatio}
              rpmLive={rpmLive}
              wheelPlatform={wheelPlatform}
              onPlatformChange={(platform) => {
                setWheelPlatform(platform);
                set({ wheelPlatform: platform });
              }}
            />
          </div>

          <div className="flat-wheel-pedals absolute bottom-[4%] right-[18%] flex items-end gap-[clamp(.45rem,1.2vw,.9rem)] md:bottom-[7%] md:right-[18%] md:gap-[clamp(.75rem,1.5vw,1.3rem)]">
            <Pedal id="clutch" label="CLUTCH" settings={settings} set={set} accent="#9ca3af" />
            <Pedal id="brake" label="BRAKE" settings={settings} set={set} accent="#ef4444" />
            <Pedal id="throttle" label="GAS" settings={settings} set={set} accent="#22c55e" onLevel={setLocalRev} />
          </div>

          <div className="flat-wheel-aux absolute bottom-[5%] right-[1.5%] flex flex-col items-center gap-2 md:bottom-[12%] md:right-[4%] md:gap-3">
            <Handbrake settings={settings} set={set} />
            <Nitro settings={settings} set={set} />
          </div>

          <div className="flat-wheel-instructions pointer-events-none absolute bottom-1 left-[2%] hidden text-[7px] font-bold uppercase tracking-[0.16em] text-slate-500 md:bottom-3 md:left-[5%] md:block md:text-[8px] md:tracking-[0.2em]">
            Touch the rim and rotate • {settings.wheelRotationDeg}° lock-to-lock
          </div>
        </div>
      </div>
    </div>
  );
}
