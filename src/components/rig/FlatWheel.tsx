import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { applyCurve, type ControllerState, type Settings } from "@/lib/controller-types";

type Props = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
};

const buzz = (enabled: boolean, ms: number | number[] = 10) => {
  if (enabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
};

function stopWheelGesture(e: PointerEvent<HTMLElement>) {
  e.stopPropagation();
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
  const [value, setValue] = useState(0);
  const active = useRef<number | null>(null);
  const lastBand = useRef(-1);
  const lastHapticAt = useRef(0);
  const pedalRef = useRef<HTMLButtonElement>(null);

  const update = (clientY: number) => {
    const el = pedalRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const next = Math.max(0, Math.min(1, (rect.bottom - clientY) / Math.max(1, rect.height)));
    const band = Math.min(5, Math.floor(next * 6));
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (settings.vibration && band !== lastBand.current && now - lastHapticAt.current > 50) {
      lastBand.current = band;
      lastHapticAt.current = now;
      buzz(true, Math.min(14, 3 + band * 2));
    }

    setValue(next);
    set({ [id]: next } as Partial<ControllerState>);
  };

  const release = () => {
    active.current = null;
    lastBand.current = -1;
    setValue(0);
    set({ [id]: 0 } as Partial<ControllerState>);
    if (settings.vibration) {
      buzz(true, id === "brake" ? [5, 12, 4] : 5);
    }
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
      className="group relative h-[62svh] min-h-0 w-[clamp(3.8rem,8vw,5.4rem)] touch-none select-none overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d12]/95 p-2 shadow-[0_12px_28px_rgba(0,0,0,.55)] md:h-[42vh] md:min-h-44 md:w-[clamp(4.2rem,7vw,6.2rem)]"
    >
      <span className="absolute inset-2 rounded-[1.05rem] border border-white/5 bg-[linear-gradient(180deg,#151b22,#0a0e13)]" />
      <span
        className="absolute inset-x-4 bottom-10 rounded-xl border border-white/10 bg-[linear-gradient(180deg,#edf1f4,#727a84)] shadow-[0_6px_12px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.6)] transition-all"
        style={{
          height: "calc(30% + " + value * 58 + "%)",
          boxShadow: "0 0 " + (8 + value * 12) + "px " + accent + "33, 0 6px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.6)",
          transform: "scaleY(" + (1 + value * 0.035) + ")",
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
    if (settings.vibration) buzz(true, 6);
  };

  return (
    <button
      type="button"
      aria-label="Handbrake"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        startY.current = e.clientY;
        setValue(1);
        set({ handbrake: 1 });
        buzz(settings.vibration, [7, 16, 6]);
      }}
      onPointerMove={(e) => active.current && move(e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      className="relative h-[38svh] w-[clamp(4rem,9vw,5.5rem)] touch-none select-none rounded-[1.25rem] border border-white/10 bg-[#0b0f14] shadow-[0_10px_24px_rgba(0,0,0,.5)] active:brightness-125 md:h-40 md:w-24"
    >
      <span className="absolute inset-2 rounded-[1rem] bg-gradient-to-b from-[#171d24] to-[#080b10]" />
      <span
        className="absolute bottom-8 left-1/2 h-[78%] w-4 origin-bottom -translate-x-1/2 rounded-full bg-gradient-to-b from-[#cfd5db] to-[#6e7780] shadow-[0_5px_10px_rgba(0,0,0,.55)]"
        style={{ transform: "translateX(-50%) rotate(" + (-10 - value * 38) + "deg)" }}
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

  const release = () => {
    setDown(false);
    set({ nitro: 0 });
  };

  return (
    <button
      type="button"
      aria-label="Nitro"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        set({ nitro: 1 });
        buzz(settings.vibration, [5, 18, 5, 18, 8]);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      className={"grid h-12 w-[clamp(4rem,9vw,5.5rem)] touch-none select-none place-items-center rounded-xl border border-cyan-300/25 bg-[linear-gradient(180deg,#27313b,#10151b)] text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200 shadow-[0_7px_16px_rgba(0,0,0,.46),inset_0_1px_0_rgba(255,255,255,.08)] active:translate-y-0.5 md:h-14 md:w-24 " + (down ? "brightness-150 ring-2 ring-fuchsia-400/40" : "")}
    >
      NITRO
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
          <span className="absolute bottom-[28%] text-[clamp(.28rem,.5vw,.46rem)] font-black uppercase tracking-[.22em] text-slate-300">
            G29 • HORN
          </span>
        </button>
      </div>
    </div>
  );
}

export function FlatWheel({ settings, set, press }: Props) {
  const wheelHitRef = useRef<HTMLDivElement>(null);
  const wheelVisualRef = useRef<HTMLDivElement>(null);
  const touchPointer = useRef<number | null>(null);
  const lastAngle = useRef(0);
  const wheelAngleDeg = useRef(0);
  const centreAnimationRef = useRef<number | null>(null);
  const lastHapticAt = useRef(0);
  const [gyroReady, setGyroReady] = useState(false);
  const [gyroDenied, setGyroDenied] = useState(false);

  const maxLockDeg = Math.max(90, settings.wheelRotationDeg / 2);

  const paintWheel = useCallback((angleDeg: number) => {
    wheelAngleDeg.current = angleDeg;
    if (wheelVisualRef.current) {
      wheelVisualRef.current.style.transform = "rotate(" + angleDeg + "deg)";
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

  const cancelCentre = useCallback(() => {
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

    // Medium-smooth return: deliberate enough to feel like a real wheel
    // settling back to center, without taking so long that it feels sluggish.
    const duration = Math.min(760, 520 + Math.round(Math.abs(startAngle) * 0.32));
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    const frame = (time: number) => {
      const elapsed = time - startedAt;
      const t = Math.min(1, elapsed / duration);
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const angle = startAngle * (1 - eased);

      paintWheel(angle);
      emitRaw(angle / maxLockDeg);

      if (t < 1) {
        centreAnimationRef.current = requestAnimationFrame(frame);
      } else {
        centreAnimationRef.current = null;
        paintWheel(0);
        emitRaw(0);
      }
    };

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
    if (settings.steerMode !== "tilt") {
      setGyroReady(false);
      setGyroDenied(false);
      cancelCentre();
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
  }, [cancelCentre, settings.steerMode, setWheelRaw]);

  useEffect(() => {
    if (settings.steerMode !== "tilt" || !gyroReady) return;

    const onOrientation = (event: DeviceOrientationEvent) => {
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

      const raw = Math.max(
        -1,
        Math.min(
          1,
          (settings.invertTilt ? -tilt : tilt) / Math.max(1, settings.maxTiltDeg),
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
    setWheelRaw,
  ]);

  const grabWheel = (e: PointerEvent<HTMLDivElement>) => {
    if (settings.steerMode !== "touch") return;
    if (touchPointer.current !== null) return;

    const el = wheelHitRef.current;
    if (!el) return;

    cancelCentre();
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

    e.preventDefault();

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

    if (settings.ffbHaptics && Math.abs(delta) > 0.012) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastHapticAt.current > 75) {
        lastHapticAt.current = now;
        const intensity = Math.min(1, Math.abs(next) / maxLockDeg);
        buzz(true, Math.min(12, 3 + Math.round(intensity * 8)));
      }
    }

    if (settings.ffbHaptics) {
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

  const releaseWheel = () => {
    touchPointer.current = null;
    centreWheel();
  };

  useEffect(() => {
    return () => cancelCentre();
  }, [cancelCentre]);

  return (
    <div className="flat-wheel-root absolute inset-0 overflow-hidden bg-[#080a0d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_6%,#1a222b_0%,#080a0d_55%,#030405_100%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.7rem] border border-white/15" />
      <div className="pointer-events-none absolute inset-4 rounded-[1.4rem] border border-[#e11d2e]/15" />

      <div className="flat-wheel-root-title absolute left-2 top-2 z-20 rounded-xl border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-md md:left-5 md:top-5 md:px-3 md:py-2">
        <div className="text-[6px] font-black uppercase tracking-[0.22em] text-slate-500 md:text-[8px] md:tracking-[0.25em]">
          STEERING MODE
        </div>
        <div className="mt-0.5 text-[11px] font-black tracking-tight text-white md:mt-1 md:text-sm">
          LOGITECH G29 STYLE
        </div>
        <div className="mt-0.5 text-[6px] font-semibold uppercase tracking-[0.15em] text-slate-500 md:text-[8px] md:tracking-[0.2em]">
          {settings.steerMode === "touch"
            ? "Touch 900° wheel • Auto-centre"
            : gyroReady
              ? "Gyro steering"
              : "Gyro permission required"}
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
              press={press}
            />
          </div>

          <div className="flat-wheel-pedals absolute bottom-[4%] right-[18%] flex items-end gap-[clamp(.45rem,1.2vw,.9rem)] md:bottom-[7%] md:right-[18%] md:gap-[clamp(.75rem,1.5vw,1.3rem)]">
            <Pedal id="brake" label="BRAKE" settings={settings} set={set} accent="#ef4444" />
            <Pedal id="throttle" label="GAS" settings={settings} set={set} accent="#22c55e" />
          </div>

          <div className="flat-wheel-aux absolute bottom-[5%] right-[1.5%] flex flex-col items-center gap-2 md:bottom-[12%] md:right-[4%] md:gap-3">
            <Handbrake settings={settings} set={set} />
            <Nitro settings={settings} set={set} />
          </div>

          <div className="flat-wheel-instructions pointer-events-none absolute bottom-1 left-[2%] hidden text-[7px] font-bold uppercase tracking-[0.16em] text-slate-500 md:bottom-3 md:left-[5%] md:block md:text-[8px] md:tracking-[0.2em]">
            Touch the rim and release to auto-centre • 900° lock-to-lock • wheel + horn + brake + gas + handbrake + nitro
          </div>
        </div>
      </div>
    </div>
  );
}
