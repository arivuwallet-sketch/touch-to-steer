import { useState } from "react";
import type { Settings } from "@/lib/controller-types";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { CircleStop, Link2, X } from "lucide-react";

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  status: "idle" | "connecting" | "connected" | "error";
  latency: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5">
      <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0">{children}</span>
    </label>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  status,
  latency,
  onConnect,
  onDisconnect,
}: Props) {
  const connected = status === "connected";
  const [matcherDpi, setMatcherDpi] = useState(settings.mouseDpi);

  const applyMouseProfile = (profile: string) => {
    const profiles: Record<string, Partial<Settings>> = {
      "viper-v4-pro": {
        mouseProfile: "viper-v4-pro",
        mouseDpi: 1600,
        mousePollingRate: 8000,
        mouseSensitivity: 1,
        mouseGyroSensitivity: 0.65,
        mouseDynamicSensitivity: false,
        mouseDynamicMaxMultiplier: 2.5,
        mouseRotationDeg: 0,
        mouseSmartTracking: true,
      },
      "fps-precision": {
        mouseProfile: "fps-precision",
        mouseDpi: 800,
        mousePollingRate: 8000,
        mouseSensitivity: 1,
        mouseGyroSensitivity: 0.45,
        mouseDynamicSensitivity: false,
        mouseDynamicMaxMultiplier: 2,
        mouseRotationDeg: 0,
        mouseSmartTracking: true,
      },
      "desktop-1to1": {
        mouseProfile: "desktop-1to1",
        mouseDpi: 1200,
        mousePollingRate: 1000,
        mouseSensitivity: 1,
        mouseGyroSensitivity: 0.6,
        mouseDynamicSensitivity: false,
        mouseDynamicMaxMultiplier: 2,
        mouseRotationDeg: 0,
        mouseSmartTracking: true,
      },
    };
    const patch = profiles[profile];
    if (patch) onChange(patch);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
      <div className="panel h-full w-full max-w-sm overflow-y-auto rounded-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <h2 className="min-w-0 truncate text-lg font-bold">Rig setup</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            aria-label="Close settings"
          >
            <X />
          </Button>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-secondary/60 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase">PC connection</p>
              <p className={`text-xs ${connected ? "text-success" : status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {status === "idle" ? "disconnected" : status}{latency !== null ? ` · ${latency} ms` : ""}
              </p>
            </div>
            <Button
              onClick={connected ? onDisconnect : onConnect}
              variant={connected ? "outline" : "default"}
              size="sm"
            >
              {connected ? <CircleStop /> : <Link2 />}
              {connected ? "Disconnect" : status === "connecting" ? "Connecting" : "Connect"}
            </Button>
          </div>
          <input
            aria-label="PC bridge address"
            value={settings.bridgeUrl}
            onChange={(e) => onChange({ bridgeUrl: e.target.value })}
            maxLength={120}
            spellCheck={false}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div className="mt-4 divide-y divide-border">
          <Row label="PC controller output">
            <select
              value={settings.outputMode}
              onChange={(e) => onChange({ outputMode: e.target.value as Settings["outputMode"] })}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="xinput">XInput / Xbox 360</option>
              <option value="ds4">DualShock 4</option>
            </select>
          </Row>
          <Row label="Steering input">
            <select
              value={settings.steerMode}
              onChange={(e) => onChange({ steerMode: e.target.value as Settings["steerMode"] })}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="tilt">Tilt (gyro)</option>
              <option value="touch">Touch wheel</option>
            </select>
          </Row>
          <Row label={`Stick / aim sensitivity ${settings.sensitivity.toFixed(2)}`}>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={settings.sensitivity}
              onChange={(e) => onChange({ sensitivity: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label={`Steering sensitivity ${settings.steerSensitivity.toFixed(2)}`}>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={settings.steerSensitivity}
              onChange={(e) => onChange({ steerSensitivity: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label={`Wheel rotation ${settings.wheelRotationDeg}°`}>
            <input
              type="range"
              min={180}
              max={900}
              step={90}
              value={settings.wheelRotationDeg}
              onChange={(e) => onChange({ wheelRotationDeg: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label={`Stick tension ${(settings.stickTension * 100).toFixed(0)}%`}>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={settings.stickTension}
              onChange={(e) => onChange({ stickTension: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Invert aim Y">
            <input
              type="checkbox"
              checked={settings.invertLookY}
              onChange={(e) => onChange({ invertLookY: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
          <Row label={`Dead zone ${(settings.deadzone * 100).toFixed(0)}%`}>
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.01}
              value={settings.deadzone}
              onChange={(e) => onChange({ deadzone: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label={`Linearity ${settings.linearity.toFixed(1)}`}>
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.1}
              value={settings.linearity}
              onChange={(e) => onChange({ linearity: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label={`Max tilt ${settings.maxTiltDeg}°`}>
            <input
              type="range"
              min={15}
              max={60}
              step={1}
              value={settings.maxTiltDeg}
              onChange={(e) => onChange({ maxTiltDeg: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Controller update">
            <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-2 py-1.5 text-xs font-black text-cyan-200">240 Hz</span>
          </Row>
          <Row label="Invert tilt">
            <input
              type="checkbox"
              checked={settings.invertTilt}
              onChange={(e) => onChange({ invertTilt: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Steering auto-centre">
            <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-2 py-1.5 text-xs font-black text-emerald-200">ALWAYS ON</span>
          </Row>
          <Row label="General phone haptics">
            <input
              type="checkbox"
              checked={settings.vibration}
              onChange={(e) => onChange({ vibration: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
          <Row label="G29 FFB haptic assist">
            <input
              type="checkbox"
              checked={settings.ffbHaptics}
              onChange={(e) => onChange({ ffbHaptics: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-300">Mouse Mode • Viper V4 Pro profile</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Software equivalents for the Viper V4 Pro control model. Phone/browser hardware cannot reproduce the physical mouse sensor, weight, optical switch hardware, or true 8 kHz sensor scan rate; the bridge emits real Windows mouse input.
            </p>
          </div>

          <Row label="On-board profile">
            <select
              value={settings.mouseProfile}
              onChange={(e) => applyMouseProfile(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="viper-v4-pro">Viper V4 Pro</option>
              <option value="fps-precision">FPS Precision</option>
              <option value="desktop-1to1">Desktop 1:1</option>
            </select>
          </Row>

          <Row label={`DPI output ${settings.mouseDpi.toLocaleString()} (1-step)`}>
            <input
              type="range"
              min={100}
              max={50000}
              step={1}
              value={settings.mouseDpi}
              onChange={(e) => onChange({ mouseDpi: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label="Sensitivity matcher">
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                max={50000}
                step={1}
                value={matcherDpi}
                onChange={(e) => setMatcherDpi(Number(e.target.value) || 100)}
                className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => onChange({ mouseDpi: Math.max(100, Math.min(50000, Math.round(matcherDpi))) })}>
                MATCH
              </Button>
            </span>
          </Row>

          <Row label="Polling target">
            <select
              value={settings.mousePollingRate}
              onChange={(e) => onChange({ mousePollingRate: Number(e.target.value) as Settings["mousePollingRate"] })}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value={125}>125 Hz</option>
              <option value={250}>250 Hz</option>
              <option value={500}>500 Hz</option>
              <option value={1000}>1000 Hz</option>
              <option value={2000}>2000 Hz</option>
              <option value={4000}>4000 Hz</option>
              <option value={8000}>8000 Hz</option>
            </select>
          </Row>

          <Row label={`Mouse sensitivity ${settings.mouseSensitivity.toFixed(2)}×`}>
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.01}
              value={settings.mouseSensitivity}
              onChange={(e) => onChange({ mouseSensitivity: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label={`Gyro sensitivity ${settings.mouseGyroSensitivity.toFixed(2)}×`}>
            <input
              type="range"
              min={0.05}
              max={3}
              step={0.01}
              value={settings.mouseGyroSensitivity}
              onChange={(e) => onChange({ mouseGyroSensitivity: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label="Gyro mouse">
            <input
              type="checkbox"
              checked={settings.mouseGyroEnabled}
              onChange={(e) => onChange({ mouseGyroEnabled: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>

          <Row label={`Mouse rotation ${settings.mouseRotationDeg}°`}>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={settings.mouseRotationDeg}
              onChange={(e) => onChange({ mouseRotationDeg: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label="Dynamic sensitivity">
            <input
              type="checkbox"
              checked={settings.mouseDynamicSensitivity}
              onChange={(e) => onChange({ mouseDynamicSensitivity: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>

          <Row label={`Dynamic max ${settings.mouseDynamicMaxMultiplier.toFixed(1)}×`}>
            <input
              type="range"
              min={1}
              max={4}
              step={0.1}
              value={settings.mouseDynamicMaxMultiplier}
              onChange={(e) => onChange({ mouseDynamicMaxMultiplier: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label="Smart tracking / coalesced input">
            <input
              type="checkbox"
              checked={settings.mouseSmartTracking}
              onChange={(e) => onChange({ mouseSmartTracking: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>

          <Row label={`Asymmetric cut-off / lift ${settings.mouseLiftOffLevel}/26`}>
            <input
              type="range"
              min={0}
              max={26}
              step={1}
              value={settings.mouseLiftOffLevel}
              onChange={(e) => onChange({ mouseLiftOffLevel: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label={`Asymmetric landing ${settings.mouseLandingLevel}/26`}>
            <input
              type="range"
              min={0}
              max={26}
              step={1}
              value={settings.mouseLandingLevel}
              onChange={(e) => onChange({ mouseLandingLevel: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>

          <Row label="Invert gyro / mouse Y">
            <input
              type="checkbox"
              checked={settings.mouseInvertY}
              onChange={(e) => onChange({ mouseInvertY: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
        </div>

        <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-slate-200">Ultra-low-latency mode</strong> targets 240 Hz output (about 4.17 ms between packets). Actual end-to-end latency depends on the phone, browser, Wi-Fi/LAN path, PC load, and game input polling.
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Settings are saved on this phone. Need the PC side? Open{" "}
          <Link to="/setup" className="font-semibold text-primary underline">
            the setup guide
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
