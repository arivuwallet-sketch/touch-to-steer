import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Joystick } from "@/components/rig/Joystick";
import { Pedal } from "@/components/rig/Pedal";
import { SteeringWheel } from "@/components/rig/SteeringWheel";
import { ActionButton } from "@/components/rig/ActionButton";
import { SettingsPanel } from "@/components/rig/SettingsPanel";
import { DPad } from "@/components/rig/DPad";
import { Trigger } from "@/components/rig/Trigger";
import { RotateGate } from "@/components/rig/RotateGate";
import { useBridge } from "@/hooks/useBridge";
import {
  PRESETS,
  defaultSettings,
  emptyState,
  type Settings,
  type ControllerState,
} from "@/lib/controller-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mobile Rig — Virtual Gamepad & Steering Wheel for PC Games" },
      {
        name: "description",
        content:
          "A real console-style gamepad and a full driving rig with clutch, brake, accelerator, handbrake, nitro and horn — streamed from your phone to any PC game.",
      },
      { property: "og:title", content: "Mobile Rig — Gamepad & Wheel for PC" },
      {
        property: "og:description",
        content:
          "Console-grade thumbsticks, D-pad and triggers, plus a full pedal set with clutch, handbrake and nitro. Pro sensitivity presets for GTA V, Forza and shooters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rig,
});

const STORAGE_KEY = "mobile-rig-settings";

function Rig() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<"pad" | "wheel">("pad");
  const [preset, setPreset] = useState<string>("gtav");
  const [hud, setHud] = useState({ a: 0, b: 0, c: 0 });
  const stateRef = useRef<ControllerState>(emptyState());
  const { status, latency, connect, disconnect } = useBridge(stateRef, settings.sendRateHz);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(raw) });
      } catch {
        /* keep defaults */
      }
    }
  }, []);

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS[key];
    if (p) patch(p.patch);
  };

  const set = useCallback((p: Partial<ControllerState>) => {
    stateRef.current = { ...stateRef.current, ...p };
  }, []);

  const press = useCallback((id: string, down: boolean) => {
    stateRef.current = {
      ...stateRef.current,
      buttons: { ...stateRef.current.buttons, [id]: down },
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current;
      setHud(
        mode === "wheel"
          ? { a: s.steer, b: s.throttle, c: s.brake }
          : { a: s.lx, b: s.rx, c: Math.max(s.lt, s.rt) },
      );
    }, 120);
    return () => clearInterval(t);
  }, [mode]);

  const tone =
    status === "connected"
      ? "text-[var(--success)]"
      : status === "error"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <main className="flex h-[100dvh] flex-col gap-1.5 overflow-hidden px-2 py-1.5 sm:px-4">
      <RotateGate />
      {/* ---------- top bar ---------- */}
      <header className="panel grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="grid size-8 shrink-0 place-items-center rounded-lg text-xs font-black text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            MR
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">Mobile Rig</h1>
            <p className={`truncate text-[10px] font-semibold uppercase tracking-widest ${tone}`}>
              {status}
              {latency !== null && ` · ${latency} ms`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => (status === "connected" ? disconnect() : connect(settings.bridgeUrl))}
            className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
            style={
              status === "connected"
                ? { border: "1px solid var(--border)" }
                : { background: "var(--gradient-primary)", color: "var(--primary-foreground)" }
            }
          >
            {status === "connected" ? "Stop" : "Connect"}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
          >
            Tune
          </button>
        </div>
      </header>

      {/* ---------- mode + preset ---------- */}
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <div className="flex shrink-0 rounded-xl border border-border p-0.5">
          {(["pad", "wheel"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "pad" ? "Gamepad" : "Steering rig"}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button
              key={k}
              onClick={() => applyPreset(k)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                preset === k
                  ? "border-accent text-accent"
                  : "border-border text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "pad" ? (
        <GamepadLayout settings={settings} set={set} press={press} hud={hud} />
      ) : (
        <WheelLayout settings={settings} set={set} press={press} hud={hud} />
      )}

      <p className="shrink-0 text-center text-[10px] text-muted-foreground">
        <Link to="/setup" className="font-semibold text-primary underline">
          PC setup guide
        </Link>
      </p>

      {showSettings && (
        <SettingsPanel settings={settings} onChange={patch} onClose={() => setShowSettings(false)} />
      )}
    </main>
  );
}

type LayoutProps = {
  settings: Settings;
  set: (p: Partial<ControllerState>) => void;
  press: (id: string, down: boolean) => void;
  hud: { a: number; b: number; c: number };
};

/* ---------------- Gamepad: console layout, everything on one screen ------- */
function GamepadLayout({ settings, set, press, hud }: LayoutProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col justify-between gap-1.5">
      {/* shoulders */}
      <div className="flex items-start justify-between">
        <div className="flex gap-2">
          <ActionButton label="LB" vibration={settings.vibration} onPress={(d) => press("lb", d)} />
          <Trigger label="LT" onChange={(v) => set({ lt: v })} />
        </div>
        <div className="flex gap-2">
          <Trigger label="RT" onChange={(v) => set({ rt: v })} />
          <ActionButton label="RB" vibration={settings.vibration} onPress={(d) => press("rb", d)} />
        </div>
      </div>

      {/* main deck */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        {/* left cluster */}
        <div className="flex flex-col items-center gap-2">
          <Joystick
            label="Move"
            deadzone={settings.deadzone}
            linearity={settings.linearity}
            sensitivity={settings.sensitivity}
            autoCentre={settings.autoCentre}
            onMove={(x, y) => set({ lx: x, ly: y })}
          />
          <DPad vibration={settings.vibration} onPress={(d, down) => press(`dpad_${d}`, down)} />
        </div>

        {/* centre column */}
        <div className="flex min-w-0 flex-col items-center gap-2">
          <div className="grid w-full grid-cols-3 gap-1.5">
            {[
              { k: "L-X", v: hud.a },
              { k: "R-X", v: hud.b },
              { k: "TRIG", v: hud.c },
            ].map((x) => (
              <div key={x.k} className="panel px-1 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{x.k}</p>
                <p className="text-sm font-bold tabular-nums">{(x.v * 100).toFixed(0)}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <ActionButton
              label="Back"
              vibration={settings.vibration}
              onPress={(d) => press("back", d)}
            />
            <ActionButton
              label="Start"
              vibration={settings.vibration}
              onPress={(d) => press("start", d)}
            />
          </div>
          <div className="flex gap-2">
            <ActionButton label="L3" vibration={settings.vibration} onPress={(d) => press("l3", d)} />
            <ActionButton label="R3" vibration={settings.vibration} onPress={(d) => press("r3", d)} />
          </div>
        </div>

        {/* right cluster */}
        <div className="flex flex-col items-center gap-2">
          <div className="grid size-28 grid-cols-3 grid-rows-3">
            <div className="col-start-2 row-start-1">
              <ActionButton
                label="Y"
                vibration={settings.vibration}
                onPress={(d) => press("y", d)}
                className="size-full rounded-full"
              />
            </div>
            <div className="col-start-1 row-start-2">
              <ActionButton
                label="X"
                vibration={settings.vibration}
                onPress={(d) => press("x", d)}
                className="size-full rounded-full"
              />
            </div>
            <div className="col-start-3 row-start-2">
              <ActionButton
                label="B"
                vibration={settings.vibration}
                onPress={(d) => press("b", d)}
                className="size-full rounded-full"
              />
            </div>
            <div className="col-start-2 row-start-3">
              <ActionButton
                label="A"
                vibration={settings.vibration}
                onPress={(d) => press("a", d)}
                className="size-full rounded-full"
              />
            </div>
          </div>
          <Joystick
            label="Aim"
            deadzone={settings.deadzone}
            linearity={settings.linearity}
            sensitivity={settings.sensitivity}
            autoCentre={settings.autoCentre}
            onMove={(x, y) => set({ rx: x, ry: settings.invertLookY ? -y : y })}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Steering rig: wheel + full pedal set -------------------- */
function WheelLayout({ settings, set, press, hud }: LayoutProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col justify-between gap-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { k: "Steer", v: hud.a },
          { k: "Gas", v: hud.b },
          { k: "Brake", v: hud.c },
        ].map((x) => (
          <div key={x.k} className="panel px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{x.k}</p>
            <p className="text-base font-bold tabular-nums">{(x.v * 100).toFixed(0)}%</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-2">
        {/* wheel + paddles */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full justify-between gap-2">
            <ActionButton
              label="◀ Gear"
              vibration={settings.vibration}
              onPress={(d) => set({ gear: d ? -1 : 0 })}
            />
            <ActionButton
              label="Gear ▶"
              vibration={settings.vibration}
              onPress={(d) => set({ gear: d ? 1 : 0 })}
            />
          </div>
          <SteeringWheel settings={settings} onSteer={(v) => set({ steer: v })} />
        </div>

        {/* pedal box */}
        <div className="flex items-end justify-end gap-1.5">
          <Pedal label="Clutch" tone="neutral" onChange={(v) => set({ clutch: v })} />
          <Pedal label="Brake" tone="stop" onChange={(v) => set({ brake: v })} />
          <Pedal label="Gas" tone="go" onChange={(v) => set({ throttle: v })} />
        </div>
      </div>

      {/* driving extras */}
      <div className="grid grid-cols-4 gap-2">
        <ActionButton
          label="Handbrake"
          vibration={settings.vibration}
          onPress={(d) => set({ handbrake: d ? 1 : 0 })}
        />
        <ActionButton
          label="Nitro"
          vibration={settings.vibration}
          onPress={(d) => set({ nitro: d ? 1 : 0 })}
        />
        <ActionButton label="Horn" vibration={settings.vibration} onPress={(d) => press("horn", d)} />
        <ActionButton
          label="Look"
          vibration={settings.vibration}
          onPress={(d) => press("look", d)}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <ActionButton
          label="Lights"
          vibration={settings.vibration}
          onPress={(d) => press("lights", d)}
        />
        <ActionButton
          label="Reset"
          vibration={settings.vibration}
          onPress={(d) => press("reset", d)}
        />
        <ActionButton label="Back" vibration={settings.vibration} onPress={(d) => press("back", d)} />
        <ActionButton
          label="Start"
          vibration={settings.vibration}
          onPress={(d) => press("start", d)}
        />
      </div>
    </section>
  );
}
