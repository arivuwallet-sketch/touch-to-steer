import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Gauge, Settings as SettingsIcon } from "lucide-react";
import { SettingsPanel } from "@/components/rig/SettingsPanel";
import { FlatPad } from "@/components/rig/FlatPad";
import { FlatWheel } from "@/components/rig/FlatWheel";
import { RotateGate } from "@/components/rig/RotateGate";
import { Button } from "@/components/ui/button";
import { useBridge } from "@/hooks/useBridge";
import {
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
          "A full-screen mobile gamepad and flat steering-wheel controller with touch pedals and configurable PC controls.",
      },
      { property: "og:title", content: "Mobile Rig — Gamepad & Wheel for PC" },
      {
        property: "og:description",
        content:
          "Full-screen touch controls for gamepad and steering-wheel modes, designed for landscape phones.",
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
  const stateRef = useRef<ControllerState>(emptyState());
  const { status, latency, telemetry, connect, disconnect } = useBridge(stateRef, settings.sendRateHz);

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

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-background">
      <RotateGate />

      {/* ---------- rig fills the screen ---------- */}
      <div className="absolute inset-0">
        {mode === "pad" ? (
          <FlatPad settings={settings} set={set} press={press} />
        ) : (
          <FlatWheel settings={settings} set={set} press={press} telemetry={telemetry} />
        )}
      </div>

      <div className="mode-toolbar absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex items-center gap-2">
        <div className="flex rounded-xl border border-white/10 bg-black/45 p-1 shadow-xl backdrop-blur-md">
          <Button
            onClick={() => setMode("pad")}
            variant={mode === "pad" ? "default" : "ghost"}
            size="icon"
            aria-label="Joystick controller"
            title="Joystick controller"
          >
            <Gamepad2 />
          </Button>
          <Button
            onClick={() => setMode("wheel")}
            variant={mode === "wheel" ? "default" : "ghost"}
            size="icon"
            aria-label="Steering wheel controller"
            title="Steering wheel controller"
          >
            <Gauge />
          </Button>
        </div>
        <Button
          onClick={() => setShowSettings(true)}
          variant="secondary"
          size="icon"
          className="relative shadow-xl"
          aria-label="Settings and steering sensitivity"
          title="Settings and steering tuning"
        >
          <SettingsIcon />
          <span className={`absolute right-0.5 top-0.5 size-2 rounded-full ${status === "connected" ? "bg-success" : status === "error" ? "bg-destructive" : "bg-muted-foreground"}`} />
        </Button>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={patch}
          onClose={() => setShowSettings(false)}
          status={status}
          latency={latency}
          onConnect={() => connect(settings.bridgeUrl)}
          onDisconnect={disconnect}
        />
      )}
    </main>
  );
}
