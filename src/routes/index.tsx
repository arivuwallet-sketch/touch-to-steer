import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Joystick } from "@/components/rig/Joystick";
import { Pedal } from "@/components/rig/Pedal";
import { SteeringWheel } from "@/components/rig/SteeringWheel";
import { ActionButton } from "@/components/rig/ActionButton";
import { SettingsPanel } from "@/components/rig/SettingsPanel";
import { useBridge } from "@/hooks/useBridge";
import {
  BUTTONS,
  defaultSettings,
  emptyState,
  type Settings,
  type ControllerState,
} from "@/lib/controller-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mobile Rig — Virtual Joystick & Steering Wheel for PC Games" },
      {
        name: "description",
        content:
          "Turn your phone into a real gamepad: tilt steering wheel, analog pedals, dual thumbsticks and a full button deck streamed to your PC.",
      },
      { property: "og:title", content: "Mobile Rig — Virtual Wheel & Joystick" },
      {
        property: "og:description",
        content:
          "Tilt steering, analog pedals and dual sticks from your phone, mapped to a real virtual gamepad on your PC.",
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
  const [mode, setMode] = useState<"wheel" | "stick">("wheel");
  const [hud, setHud] = useState({ steer: 0, throttle: 0, brake: 0 });
  const stateRef = useRef<ControllerState>(emptyState());
  const { status, latency, packets, connect, disconnect } = useBridge(stateRef, settings.sendRateHz);

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

  const set = useCallback((p: Partial<ControllerState>) => {
    stateRef.current = { ...stateRef.current, ...p };
  }, []);

  const press = useCallback((id: string, down: boolean) => {
    stateRef.current = {
      ...stateRef.current,
      buttons: { ...stateRef.current.buttons, [id]: down },
    };
  }, []);

  // Lightweight HUD refresh (10Hz) so the 60Hz input path stays render-free.
  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current;
      setHud({ steer: s.steer, throttle: s.throttle, brake: s.brake });
    }, 100);
    return () => clearInterval(t);
  }, []);

  const statusTone =
    status === "connected"
      ? "text-[var(--success)]"
      : status === "error"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <main className="min-h-screen px-3 pb-6 pt-3 sm:px-5">
      {/* top bar */}
      <header className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            MR
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold sm:text-base">Mobile Rig</h1>
            <p className={`truncate text-[11px] font-semibold uppercase tracking-widest ${statusTone}`}>
              {status}
              {latency !== null && ` · ${latency} ms`}
              {status === "connected" && ` · ${packets} pkt`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => (status === "connected" ? disconnect() : connect(settings.bridgeUrl))}
            className="rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest"
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
            className="rounded-xl border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest"
          >
            Setup
          </button>
        </div>
      </header>

      {/* mode switch */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["wheel", "stick"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-widest ${
              mode === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/60 text-muted-foreground"
            }`}
          >
            {m === "wheel" ? "Wheel + pedals" : "Dual sticks"}
          </button>
        ))}
      </div>

      {/* telemetry */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { k: "Steer", v: `${(hud.steer * 100).toFixed(0)}%` },
          { k: "Throttle", v: `${(hud.throttle * 100).toFixed(0)}%` },
          { k: "Brake", v: `${(hud.brake * 100).toFixed(0)}%` },
        ].map((x) => (
          <div key={x.k} className="panel px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{x.k}</p>
            <p className="text-lg font-bold tabular-nums">{x.v}</p>
          </div>
        ))}
      </div>

      {/* main controls */}
      <section className="mt-3 flex items-end justify-between gap-2">
        {mode === "wheel" ? (
          <>
            <Pedal label="Brake" tone="stop" onChange={(v) => set({ brake: v })} />
            <SteeringWheel settings={settings} onSteer={(v) => set({ steer: v })} />
            <Pedal label="Gas" tone="go" onChange={(v) => set({ throttle: v })} />
          </>
        ) : (
          <>
            <Joystick
              label="Left stick"
              deadzone={settings.deadzone}
              linearity={settings.linearity}
              sensitivity={settings.sensitivity}
              autoCentre={settings.autoCentre}
              onMove={(x, y) => set({ lx: x, ly: y })}
            />
            <Joystick
              label="Right stick"
              deadzone={settings.deadzone}
              linearity={settings.linearity}
              sensitivity={settings.sensitivity}
              autoCentre={settings.autoCentre}
              onMove={(x, y) => set({ rx: x, ry: y })}
            />
          </>
        )}
      </section>

      {/* gears + handbrake */}
      <section className="mt-3 grid grid-cols-4 gap-2">
        <ActionButton
          label="Shift ↓"
          vibration={settings.vibration}
          onPress={(d) => set({ gear: d ? -1 : 0 })}
        />
        <ActionButton
          label="Shift ↑"
          vibration={settings.vibration}
          onPress={(d) => set({ gear: d ? 1 : 0 })}
        />
        <ActionButton
          label="Hand"
          vibration={settings.vibration}
          onPress={(d) => set({ handbrake: d ? 1 : 0 })}
        />
        <ActionButton
          label="Clutch"
          vibration={settings.vibration}
          onPress={(d) => set({ clutch: d ? 1 : 0 })}
        />
      </section>

      {/* button deck */}
      <section className="mt-2 grid grid-cols-4 gap-2">
        {BUTTONS.map((b) => (
          <ActionButton
            key={b.id}
            label={b.label}
            vibration={settings.vibration}
            onPress={(d) => press(b.id, d)}
          />
        ))}
      </section>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Not connected yet?{" "}
        <Link to="/setup" className="font-semibold text-primary underline">
          Set up the PC side
        </Link>
      </p>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={patch}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}
