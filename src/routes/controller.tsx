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
import { playDualRumble } from "@/lib/haptics";
import {
  defaultSettings,
  emptyState,
  type Settings,
  type ControllerState,
} from "@/lib/controller-types";

export const Route = createFileRoute("/controller")({
  head: () => ({
    meta: [
      { title: "TouchToSteer Virtual Controller" },
      {
        name: "description",
        content:
          "TouchToSteer virtual controller: gamepad, steering wheel, mouse, telemetry, haptics and adaptive trigger controls.",
      },
      { property: "og:title", content: "TouchToSteer Virtual Controller" },
      {
        property: "og:description",
        content:
          "Use your phone as a virtual gamepad, steering wheel and mouse for PC gaming.",
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
  const [mobileLayout, setMobileLayout] = useState(false);
  const stateRef = useRef<ControllerState>(emptyState());
  const {
    status,
    latency,
    telemetry,
    telemetryLive,
    activeGame,
    connect,
    disconnect,
    sendMouse,
    sendControllerStateNow,
    sendControllerEdge,
  } = useBridge(stateRef, settings.sendRateHz, settings.outputMode, settings.vibration);

  useEffect(() => {
    const migrationKey = "mobile-rig-universal-migration-v3";
    const migrated = localStorage.getItem(migrationKey) === "1";
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        if (parsed.joystickTensionGf === undefined) {
          const legacy = Number(parsed.stickTension);
          parsed.joystickTensionGf =
            legacy <= 0.42 ? 30 :
            legacy <= 0.62 ? 50 :
            legacy <= 0.82 ? 80 :
            100;
        }
        const saved = { ...defaultSettings, ...parsed } as Settings;

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
  }, [settings.vibration]);

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const updateMobileLayout = () => {
      const touchCapable =
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(hover: none)").matches ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

      const landscape = window.innerWidth >= window.innerHeight;
      const controllerViewport = landscape && window.innerHeight <= 1100;

      setMobileLayout(touchCapable && controllerViewport);
    };

    updateMobileLayout();
    window.addEventListener("resize", updateMobileLayout, { passive: true });
    window.addEventListener("orientationchange", updateMobileLayout, { passive: true });
    window.visualViewport?.addEventListener("resize", updateMobileLayout);

    return () => {
      window.removeEventListener("resize", updateMobileLayout);
      window.removeEventListener("orientationchange", updateMobileLayout);
      window.visualViewport?.removeEventListener("resize", updateMobileLayout);
    };
  }, []);

  const lastAnalogHapticAt = useRef(0);

  const triggerAnalogHaptic = useCallback((changeMagnitude: number) => {
    if (typeof window === "undefined" || !settings.vibration || changeMagnitude < 0.04) return;
    const now = performance.now();
    if (now - lastAnalogHapticAt.current < 42) return;
    lastAnalogHapticAt.current = now;

    const level = Math.max(0.14, Math.min(0.65, 0.14 + changeMagnitude * 0.9));
    playDualRumble("light", {
      strongMagnitude: level * 0.55,
      weakMagnitude: Math.min(0.9, level * 0.95),
      duration: 55,
    });
  }, [settings.vibration]);

  const set = useCallback((p: Partial<ControllerState>) => {
    const previous = stateRef.current;
    const next = { ...previous, ...p };
    stateRef.current = next;

    // Global dual-rumble lane: every meaningful controller state event gets
    // haptic feedback independent of XInput / DS4 / Universal output mode.
    const numericChanges = Object.entries(p)
      .map(([key, value]) => {
        const before = Number((previous as Record<string, unknown>)[key] ?? 0);
        const after = Number(value ?? 0);
        return Number.isFinite(before) && Number.isFinite(after) ? Math.abs(after - before) : 0;
      });
    const changeMagnitude = Math.max(...numericChanges, 0);
    triggerAnalogHaptic(changeMagnitude);

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
  }, [sendControllerEdge, sendControllerStateNow, triggerAnalogHaptic]);

  const press = useCallback((id: string, down: boolean) => {
    if (settings.vibration) {
      playDualRumble("ui", {
        strongMagnitude: 0,
        weakMagnitude: down ? 0.22 : 0.12,
        duration: down ? 45 : 30,
      });
    }
    const previous = Boolean(stateRef.current.buttons?.[id]);
    stateRef.current = {
      ...stateRef.current,
      buttons: { ...stateRef.current.buttons, [id]: down },
    };

    // Send every real digital edge immediately instead of waiting for the
    // 240 Hz transport sampler. This preserves sub-frame taps in joy.cpl.
    if (previous !== down) sendControllerEdge();
  }, [sendControllerEdge, settings.vibration]);

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
    <main className={`rig-shell ${mobileLayout ? "mobile-controller" : ""} mode-${mode} relative h-[100dvh] overflow-hidden bg-background`}>
      <RotateGate mode={mode} />

      {/* ---------- rig fills the screen ---------- */}
      <div className="absolute inset-0">
        {mode === "pad" ? (
          <FlatPad settings={settings} set={set} press={press} onSettingsChange={patch} gameName={activeGame} />
        ) : mode === "wheel" ? (
          <FlatWheel settings={settings} set={set} press={press} telemetry={telemetry} telemetryLive={telemetryLive} onSettingsChange={patch} gameName={activeGame} />
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
