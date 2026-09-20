import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { SettingsPanel } from "@/components/rig/SettingsPanel";
import { RotateGate } from "@/components/rig/RotateGate";
import { useBridge } from "@/hooks/useBridge";
import {
  PRESETS,
  defaultSettings,
  emptyState,
  type Settings,
  type ControllerState,
} from "@/lib/controller-types";

const Rig3D = lazy(() => import("@/components/rig3d/Rig3D"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mobile Rig — 3D Virtual Gamepad & Steering Wheel for PC Games" },
      {
        name: "description",
        content:
          "A 3D console-style gamepad and a real driving rig with clutch, brake, accelerator, handbrake, horn and nitro — streamed from your phone to any PC game.",
      },
      { property: "og:title", content: "Mobile Rig — 3D Gamepad & Wheel for PC" },
      {
        property: "og:description",
        content:
          "Fully modelled thumbsticks, triggers, paddle shifters and a three-pedal box you can feather. Pro presets for GTA V, Forza and shooters.",
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

  const readouts =
    mode === "wheel"
      ? [
          { k: "Steer", v: hud.a },
          { k: "Gas", v: hud.b },
          { k: "Brake", v: hud.c },
        ]
      : [
          { k: "L-X", v: hud.a },
          { k: "R-X", v: hud.b },
          { k: "Trig", v: hud.c },
        ];

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-background">
      <RotateGate />

      {/* ---------- 3D rig fills the screen ---------- */}
      <div className="absolute inset-0">
        <ClientOnly fallback={<div className="grid h-full place-items-center text-xs uppercase tracking-widest text-muted-foreground">Loading rig…</div>}>
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs uppercase tracking-widest text-muted-foreground">
                Building 3D rig…
              </div>
            }
          >
            <Rig3D key={mode} mode={mode} settings={settings} set={set} press={press} />
          </Suspense>
        </ClientOnly>
      </div>

      {/* ---------- floating HUD ---------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
        <div className="panel pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 backdrop-blur">
          <div
            className="grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-black text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            MR
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xs font-bold leading-tight">Mobile Rig</h1>
            <p className={`truncate text-[9px] font-semibold uppercase tracking-widest ${tone}`}>
              {status}
              {latency !== null && ` · ${latency} ms`}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="panel hidden gap-2 px-2 py-1 backdrop-blur sm:flex">
            {readouts.map((x) => (
              <div key={x.k} className="min-w-11 text-center">
                <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground">{x.k}</p>
                <p className="text-xs font-bold tabular-nums">{(x.v * 100).toFixed(0)}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => (status === "connected" ? disconnect() : connect(settings.bridgeUrl))}
            className="rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
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
            className="rounded-lg border border-border bg-card/70 px-3 py-2 text-[10px] font-bold uppercase tracking-widest backdrop-blur"
          >
            Tune
          </button>
        </div>
      </header>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
        <div className="pointer-events-auto flex rounded-xl border border-border bg-card/70 p-0.5 backdrop-blur">
          {(["pad", "wheel"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "pad" ? "Gamepad" : "Steering rig"}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button
              key={k}
              onClick={() => applyPreset(k)}
              className={`rounded-lg border bg-card/70 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest backdrop-blur ${
                preset === k ? "border-accent text-accent" : "border-border text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
          <Link
            to="/setup"
            className="rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-primary backdrop-blur"
          >
            PC setup
          </Link>
        </div>
      </footer>

      {showSettings && (
        <SettingsPanel settings={settings} onChange={patch} onClose={() => setShowSettings(false)} />
      )}
    </main>
  );
}
