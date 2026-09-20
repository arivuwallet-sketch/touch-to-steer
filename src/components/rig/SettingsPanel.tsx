import type { Settings } from "@/lib/controller-types";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { CircleStop, Link2, X } from "lucide-react";

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  status: "disconnected" | "connecting" | "connected" | "error";
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
                {status}{latency !== null ? ` · ${latency} ms` : ""}
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
          <Row label={`Update rate ${settings.sendRateHz} Hz`}>
            <input
              type="range"
              min={30}
              max={120}
              step={10}
              value={settings.sendRateHz}
              onChange={(e) => onChange({ sendRateHz: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Invert tilt">
            <input
              type="checkbox"
              checked={settings.invertTilt}
              onChange={(e) => onChange({ invertTilt: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Auto-centre on release">
            <input
              type="checkbox"
              checked={settings.autoCentre}
              onChange={(e) => onChange({ autoCentre: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
          <Row label="Haptics">
            <input
              type="checkbox"
              checked={settings.vibration}
              onChange={(e) => onChange({ vibration: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
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
