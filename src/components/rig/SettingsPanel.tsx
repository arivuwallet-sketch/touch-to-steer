import { PAD_CONTROLS, type ResolvedGameProfile, type PadControl } from "@/lib/game-profiles";
import { useState } from "react";
import { defaultWheelBindings, type WheelBindings, type WheelOutput, type Settings } from "@/lib/controller-types";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { CircleStop, Link2, X, SlidersHorizontal, RadioTower, ChevronRight } from "lucide-react";

type Props = {
  settings: Settings;
  gameProfile?: ResolvedGameProfile;
  profileMappingsSupported?: boolean;
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
  gameProfile,
  profileMappingsSupported,
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
    <div className="spectral-settings-overlay fixed inset-0 z-50 flex justify-end" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="spectral-settings-panel rig-settings-panel panel h-full w-full max-w-sm overflow-y-auto rounded-none pb-[max(1.25rem,env(safe-area-inset-bottom))]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="spectral-settings-header">
          <div className="spectral-settings-heading">
            <div className="spectral-settings-kicker"><SlidersHorizontal size={13} /> SYSTEM CONFIG / LIVE</div>
            <h2>Rig setup</h2>
            <p>Shape the control surface, bridge output and motion response.</p>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon" className="spectral-settings-close" aria-label="Close settings">
            <X />
          </Button>
        </div>

        <div className="spectral-settings-connection">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="spectral-settings-section-title">
              <span><RadioTower size={13} /> PC CONNECTION</span>
              <p>Local WebSocket receiver</p>
              <p className={"spectral-settings-status " + (connected ? "is-online" : status === "error" ? "is-error" : "")}>
                {status === "idle" ? "disconnected" : status}
                {latency !== null ? ` · ${latency} ms` : ""}
              </p>
            </div>
            <Button
              onClick={connected ? onDisconnect : onConnect}
              variant={connected ? "outline" : "default"}
              size="sm"
              className="spectral-settings-connect"
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
            className="spectral-settings-input h-10 w-full rounded-md px-3 text-sm"
          />
        </div>

        <div className="spectral-settings-body">
          <div className="spectral-settings-block-label"><span>01</span><div><strong>OUTPUT + RESPONSE</strong><small>Virtual device and steering behavior</small></div><ChevronRight size={13} /></div>
          <Row label="PC controller output">
            <select
              value={settings.outputMode}
              onChange={(e) => onChange({ outputMode: e.target.value as Settings["outputMode"] })}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="universal">Universal · XInput + DirectInput</option>
              <option value="xinput">XInput / Xbox 360</option>
              <option value="ds4">DualShock 4 / HID</option>
            </select>
          </Row>
          <div className="mt-3 rounded-lg border border-emerald-300/15 bg-emerald-300/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-emerald-200">Universal compatibility</strong> keeps one
            synchronized Xbox 360/XInput target for modern games and one DualShock/HID target
            for legacy DirectInput-style games. Steering accelerator/brake are sent on RT/LT
            analog axes with matching DS4 trigger bits. Games can bind these controls differently;
            choose one output device if the game responds to both. Windows may therefore show both devices in
            <code className="mx-1 text-slate-300">joy.cpl</code>.
            For local co-op and split-screen, use <strong className="text-slate-200">XInput-only</strong>
            on each phone when the game expects Xbox controllers; the bridge assigns each phone
            its own virtual player, up to 4 simultaneous players.
          </div>
          {connected && !profileMappingsSupported && <p role="alert" className="mt-2 text-xs text-amber-300">Update the Windows bridge to apply automatic profiles in both modes. This bridge does not report profile support.</p>}
          <Row label="Automatic game profiles">
            <input type="checkbox" checked={settings.autoGameProfiles !== false} onChange={(e) => onChange({ autoGameProfiles: e.target.checked })} />
          </Row>
          <p className="mt-2 text-xs text-muted-foreground">{gameProfile?.name ?? "Standard controller"} — {gameProfile?.note}</p>
          {gameProfile?.gameKey === "asphalt-legends" && <Row label="Asphalt acceleration">
            <select aria-label="Asphalt acceleration" value={settings.asphaltAcceleration ?? "auto"}
              onChange={(e) => onChange({ asphaltAcceleration: e.target.value as "auto" | "manual" })}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs">
              <option value="auto">Auto (GAS inactive)</option><option value="manual">Manual (enable in-game)</option>
            </select>
          </Row>}
          {settings.autoGameProfiles && gameProfile?.gameKey && <button type="button" className="mt-2 text-xs underline" onClick={() => {
            const profiles = { ...settings.gameProfiles }; delete profiles[gameProfile.gameKey!];
            onChange({ gameProfiles: profiles });
          }}>Restore detected game's profile</button>}
          <details className="mt-3 rounded-lg border border-input p-3">
            <summary className="cursor-pointer text-xs">Wheel action bindings</summary>
            <p className="my-2 text-xs text-muted-foreground">{settings.autoGameProfiles && gameProfile?.gameKey ? "Changes are saved for this game and restored automatically." : "Changes apply to global manual bindings."}</p>
            <p className="my-2 text-xs text-muted-foreground">Match these outputs to your game's controller settings. Requires the updated PC bridge. Gamepad assignments are configured separately below.</p>
            {(Object.keys(defaultWheelBindings) as (keyof WheelBindings)[]).map((action) => (
              <Row key={action} label={{ throttle: "GAS", brake: "BRAKE / reverse", handbrake: "HANDBRAKE", nitro: "NITRO", clutch: "CLUTCH", gearUp: "GEAR UP", gearDown: "GEAR DOWN", horn: "HORN" }[action]}>
                <select aria-label={`Wheel ${action} output`}
                  value={settings.wheelBindings?.[action] ?? defaultWheelBindings[action]}
                  onChange={(e) => onChange({ wheelBindings: { ...defaultWheelBindings, ...settings.wheelBindings, [action]: e.target.value as WheelOutput } })}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs">
                  {Object.entries({rt:"RT / R2",lt:"LT / L2",a:"A / Cross",b:"B / Circle",x:"X / Square",y:"Y / Triangle",lb:"LB / L1",rb:"RB / R1",l3:"L3",r3:"R3",none:"Disabled"}).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Row>
            ))}
            <button type="button" className="mt-2 text-xs underline" onClick={() => {
              const key = settings.autoGameProfiles ? gameProfile?.gameKey : null;
              if (key) {
                const entry = { ...settings.gameProfiles?.[key] }; delete entry.wheelBindings;
                onChange({ gameProfiles: { ...settings.gameProfiles, [key]: entry } });
              } else onChange({ wheelBindings: { ...defaultWheelBindings } });
            }}>Reset wheel bindings</button>
          </details>
          <details className="mt-3 rounded-lg border border-input p-3">
            <summary className="cursor-pointer text-xs">Gamepad bindings</summary>
            <p className="my-2 text-xs text-muted-foreground">These use the same detected game as the wheel. A/X keep Asphalt's native nitro/drift actions; RT is inactive with auto acceleration.</p>
            {PAD_CONTROLS.map((id: PadControl) => <Row key={id} label={id.toUpperCase()}>
              <select aria-label={`Gamepad ${id} output`} value={settings.padBindings?.[id] ?? id}
                onChange={(e) => onChange({ padBindings: { ...settings.padBindings, [id]: e.target.value as WheelOutput } })}
                className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs">
                {Object.entries({rt:"RT / R2",lt:"LT / L2",a:"A / Cross",b:"B / Circle",x:"X / Square",y:"Y / Triangle",lb:"LB / L1",rb:"RB / R1",l3:"L3",r3:"R3",none:"Disabled"}).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Row>)}
          </details>
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
          <Row label={`Steering sensitivity ${settings.steerSensitivity.toFixed(2)}×`}>
            <input
              type="range"
              min={0.5}
              max={3}
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
          <Row label={`FORCEFLEX joystick tension ${settings.joystickTensionGf}gf`}>
            <select
              value={settings.joystickTensionGf}
              onChange={(e) =>
                onChange({
                  joystickTensionGf: Number(e.target.value) as Settings["joystickTensionGf"],
                })
              }
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value={30}>30 gf · Feather / Open world</option>
              <option value={50}>50 gf · Balanced</option>
              <option value={80}>80 gf · Firm / Precision</option>
              <option value={100}>100 gf · Heavy / FPS</option>
            </select>
          </Row>
          <div className="rounded-lg border border-violet-300/15 bg-violet-300/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-violet-200">FORCEFLEX response</strong> changes the virtual Hall-stick response curve using the selected 30/50/80/100 gf profile.
            The touchscreen cannot physically change spring force, so this is the software equivalent of lighter or heavier stick resistance.
          </div>
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
          <Row label="Controller polling rate">
            <select
              value={settings.sendRateHz}
              onChange={(e) =>
                onChange({
                  sendRateHz: Number(e.target.value) as Settings["sendRateHz"],
                })
              }
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value={60}>60 Hz</option>
              <option value={120}>120 Hz</option>
              <option value={144}>144 Hz</option>
              <option value={180}>180 Hz</option>
              <option value={240}>240 Hz</option>
              <option value={333}>333 Hz · 3 ms target</option>
            </select>
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
            <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-2 py-1.5 text-xs font-black text-emerald-200">
              ALWAYS ON
            </span>
          </Row>
          <Row label="General phone haptics">
            <input
              type="checkbox"
              checked={settings.vibration}
              onChange={(e) => onChange({ vibration: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
          <div className="spectral-settings-block-label"><span>02</span><div><strong>FEEDBACK + HAPTICS</strong><small>Phone vibration and force response</small></div><ChevronRight size={13} /></div>
          <Row label="G29 FFB haptic assist">
            <input
              type="checkbox"
              checked={settings.ffbHaptics}
              onChange={(e) => onChange({ ffbHaptics: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </Row>
        </div>

        <div className="spectral-settings-block-label spectral-settings-block-label-mouse"><span>03</span><div><strong>MOUSE CONTROL SURFACE</strong><small>Viper profile, DPI, gyro and tracking</small></div><ChevronRight size={13} /></div>
        <div className="spectral-settings-mouse-block">
          <div className="mb-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-300">
              Mouse Mode • Viper V4 Pro profile
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Software equivalents for the Viper V4 Pro control model. Phone/browser hardware cannot
              reproduce the physical mouse sensor, weight, optical switch hardware, or true 8 kHz
              sensor scan rate; the bridge emits real Windows mouse input.
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({ mouseDpi: Math.max(100, Math.min(50000, Math.round(matcherDpi))) })
                }
              >
                MATCH
              </Button>
            </span>
          </Row>

          <Row label="Polling target">
            <select
              value={settings.mousePollingRate}
              onChange={(e) =>
                onChange({
                  mousePollingRate: Number(e.target.value) as Settings["mousePollingRate"],
                })
              }
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

          <Row label={`Pointer sensitivity ${settings.mouseGyroSensitivity.toFixed(2)}×`}>
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

          <Row label="Gyro mouse (Magic Remote style)">
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

          <Row label="Invert gyro / mouse X">
            <input
              type="checkbox"
              checked={settings.mouseInvertX}
              onChange={(e) => onChange({ mouseInvertX: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
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

        <div className="spectral-settings-note mt-4 rounded-lg p-3 text-[11px] leading-relaxed">
          <strong className="text-slate-200">Controller polling</strong> is selectable from 60 to 333 Hz.
          333 Hz selects a 3 ms scheduling target; input changes transmit immediately. Browser scheduling can take longer. Actual end-to-end latency depends on the phone, browser,
          Wi-Fi/LAN path, PC load, and game input polling.
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
