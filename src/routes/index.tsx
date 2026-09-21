import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Gauge, Mouse, Settings as SettingsIcon } from "lucide-react";
import { SettingsPanel } from "@/components/rig/SettingsPanel";
import { FlatPad } from "@/components/rig/FlatPad";
import { FlatWheel } from "@/components/rig/FlatWheel";
import { FlatMouse } from "@/components/rig/FlatMouse";
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
      { property: "og:title", content: "Mobile Rig — Gamepad, Wheel & Mouse for PC" },
      {
        property: "og:description",
        content:
          "Full-screen touch controls for gamepad, steering-wheel and low-latency mouse modes, designed for landscape phones.",
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
  const [mode, setMode] = useState<"pad" | "wheel" | "mouse">("pad");
  const stateRef = useRef<ControllerState>(emptyState());
  const {
    status,
    latency,
    telemetry,
    telemetryLive,
    connect,
    disconnect,
    sendMouse,
    sendControllerStateNow,
    sendControllerEdge,
  } = useBridge(stateRef, 240, settings.outputMode);

  useEffect(() => {
    const migrationKey = "mobile-rig-universal-migration-v3";
    const migrated = localStorage.getItem(migrationKey) === "1";
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      try {
        const saved = { ...defaultSettings, ...JSON.parse(raw) } as Settings;

        // Use the broad compatibility target for existing installs unless the
        // user explicitly chose it as DS4-only. Universal keeps one mirrored
        // XInput target for current games and one DS4/HID target for legacy
        // DirectInput-style games. XInput-only remains selectable when a game
        // behaves badly with multiple enumerated controllers.
        if (!migrated && saved.outputMode === "xinput") {
          saved.outputMode = "universal";
          localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        }

        localStorage.setItem(migrationKey, "1");
        setSettings(saved);
      } catch {
        /* keep defaults */
      }
    } else {
      localStorage.setItem(migrationKey, "1");
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
    const previous = stateRef.current;
    const next = { ...previous, ...p };
    stateRef.current = next;

    // Send analog changes immediately from the input event instead of waiting
    // for the 240 Hz watchdog. The watchdog remains as a safety/refresh lane.
    const analogChanged = [
      "steer",
      "throttle",
      "brake",
      "clutch",
      "lx",
      "ly",
      "rx",
      "ry",
      "lt",
      "rt",
      "handbrake",
      "nitro",
      "dial",
    ].some((key) => key in p);

    if (analogChanged) {
      sendControllerStateNow();
    }

    // Momentary/digital steering controls get an edge-priority report as well.
    // This guarantees a lightning-fast press/release cannot be overwritten by
    // an older continuous state still waiting in the bridge mailbox.
    const digitalEdge = ["handbrake", "nitro", "gear"].some((key) => {
      if (!(key in p)) return false;
      if (key === "gear") {
        return Number(previous.gear) !== Number(next.gear);
      }
      const previousActive =
        (Number(previous[key as "handbrake" | "nitro"]) || 0) > 0.02;
      const nextActive =
        (Number(next[key as "handbrake" | "nitro"]) || 0) > 0.02;
      return previousActive !== nextActive;
    });

    if (digitalEdge) sendControllerEdge();
  }, [sendControllerEdge, sendControllerStateNow]);

  const press = useCallback((id: string, down: boolean) => {
    const previous = Boolean(stateRef.current.buttons?.[id]);
    stateRef.current = {
      ...stateRef.current,
      buttons: { ...stateRef.current.buttons, [id]: down },
    };

    // Send every real digital edge immediately instead of waiting for the
    // 240 Hz transport sampler. This preserves sub-frame taps in joy.cpl.
    if (previous !== down) sendControllerEdge();
  }, [sendControllerEdge]);

  const releaseAll = useCallback(() => {
    stateRef.current = emptyState();
    sendControllerEdge();
  }, [sendControllerEdge]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") releaseAll();
    };
    const handleBlur = () => releaseAll();

    document.addEventListener("visibilitychange", handleVisibility, { passive: true });
    window.addEventListener("blur", handleBlur, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [releaseAll]);

  useEffect(() => {
    // Never carry a pressed/analog state from one controller mode into the other.
    releaseAll();
  }, [mode, releaseAll]);

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-background">
      <RotateGate mode={mode} />

      {/* ---------- rig fills the screen ---------- */}
      <div className="absolute inset-0">
        {mode === "pad" ? (
          <FlatPad settings={settings} set={set} press={press} />
        ) : mode === "wheel" ? (
          <FlatWheel settings={settings} set={set} press={press} telemetry={telemetry} telemetryLive={telemetryLive} />
        ) : (
          <FlatMouse settings={settings} onSettingsChange={patch} sendMouse={sendMouse} />
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
          <Button
            onClick={() => setMode("mouse")}
            variant={mode === "mouse" ? "default" : "ghost"}
            size="icon"
            aria-label="Mouse controller"
            title="Mouse controller"
          >
            <Mouse />
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
