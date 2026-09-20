import { createFileRoute, ClientOnly } from "@tanstack/react-router";
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
      { title: "Mobile Rig — Reference UI Gamepad & Steering Wheel" },
      {
        name: "description",
        content:
          "Fullscreen landscape mobile game controller with reference-matched gamepad and steering-wheel layouts.",
      },
      { property: "og:title", content: "Mobile Rig — Gamepad & Steering Wheel" },
      {
        property: "og:description",
        content:
          "A fullscreen landscape virtual controller with touch, gyro steering, analog inputs and PC bridge connectivity.",
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
  const stateRef = useRef<ControllerState>(emptyState());
  const { status, connect, disconnect } = useBridge(stateRef, settings.sendRateHz);

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

  const patch = useCallback((nextPatch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...nextPatch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const applyPreset = useCallback(
    (key: string) => {
      setPreset(key);
      const selected = PRESETS[key];
      if (selected) patch(selected.patch);
    },
    [patch],
  );

  const setControllerState = useCallback((next: Partial<ControllerState>) => {
    stateRef.current = { ...stateRef.current, ...next };
  }, []);

  const press = useCallback((id: string, down: boolean) => {
    stateRef.current = {
      ...stateRef.current,
      buttons: { ...stateRef.current.buttons, [id]: down },
    };
  }, []);

  const toggleMode = useCallback(() => {
    setMode((current) => (current === "pad" ? "wheel" : "pad"));
    stateRef.current = { ...emptyState() };
  }, []);

  const toggleConnection = useCallback(() => {
    if (status === "connected") disconnect();
    else connect(settings.bridgeUrl);
  }, [connect, disconnect, settings.bridgeUrl, status]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <RotateGate />

      <div className="absolute inset-0">
        <ClientOnly
          fallback={
            <div className="grid h-full place-items-center bg-black text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
              Loading controller…
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="grid h-full place-items-center bg-black text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                Building controller…
              </div>
            }
          >
            <Rig3D
              mode={mode}
              settings={settings}
              set={setControllerState}
              press={press}
              onOpenSettings={() => setShowSettings(true)}
              onModeToggle={toggleMode}
              connectionStatus={status}
              onConnectToggle={toggleConnection}
            />
          </Suspense>
        </ClientOnly>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={patch}
          onClose={() => setShowSettings(false)}
          connectionStatus={status}
          onConnect={toggleConnection}
          onDisconnect={disconnect}
          preset={preset}
          onPreset={applyPreset}
        />
      )}
    </main>
  );
}
