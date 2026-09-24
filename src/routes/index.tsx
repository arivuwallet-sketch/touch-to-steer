import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  BatteryCharging,
  Gauge,
  Gamepad2,
  Hand,
  Keyboard,
  Mouse,
  Download,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  Waves,
  Wifi,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LandingScene } from "@/components/landing/LandingScene";
import { UploadedControllerScene } from "@/components/landing/UploadedControllerScene";
import { StarDust } from "@/components/landing/StarDust";
import { Button } from "@/components/ui/button";
import gamepadModeAsset from "@/assets/gamepad-mode.jpg.asset.json";
import mouseModeAsset from "@/assets/mouse-mode.jpg.asset.json";
import steeringModeAsset from "@/assets/steering-mode.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TouchToSteer — Spectral Control System" },
      {
        name: "description",
        content:
          "TouchToSteer transforms a phone into a virtual gamepad, steering wheel and precision mouse for PC gaming with gyro, haptics, telemetry and rapid input.",
      },
      { property: "og:title", content: "TouchToSteer — Spectral Control System" },
      {
        property: "og:description",
        content:
          "A cinematic TouchToSteer control interface powered by interactive 3D, spectral signal trails and a native Windows bridge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const capabilities = [
  ["GAMEPAD", "Full D-pad, ABXY, LB/RB, analog sticks, LT/RT and extra controls."],
  ["STEERING", "Touch or tilt steering with pedals, gears, handbrake and telemetry."],
  ["MOUSE", "Precision cursor, wheel, side buttons, gyro aim and sensitivity tuning."],
  ["BRIDGE", "Windows virtual-controller and native mouse injection through the packaged bridge."],
];

const modeProofs = [
  {
    id: "gamepad",
    label: "Gamepad",
    eyebrow: "APEX-STYLE CONTROL DECK",
    title: "Every essential control stays under your thumbs.",
    description:
      "Dual analog sticks, separated D-pad and ABXY controls, ForceAdapt triggers, shoulder buttons, turbo, gyro, profiles and four rear mappings share one touch-safe landscape surface.",
    detail: "DUAL STICKS · FORCEADAPT · 240 HZ · GYRO",
    image: gamepadModeAsset.url,
    alt: "TouchToSteer gamepad mode showing dual sticks, D-pad, ABXY buttons, ForceAdapt triggers and profile controls",
  },
  {
    id: "mouse",
    label: "Mouse",
    eyebrow: "VIPER-STYLE PRECISION SURFACE",
    title: "A full phone-sized precision mouse.",
    description:
      "Move, click, scroll and use side buttons from a familiar mouse-shaped surface, with selectable DPI, polling rate, gyro aiming and one-tap center synchronization.",
    detail: "50K DPI · 8K POLLING · GYRO AIM · CENTER SYNC",
    image: mouseModeAsset.url,
    alt: "TouchToSteer mouse mode showing a full-screen precision mouse with DPI, polling, gyro and center sync controls",
  },
  {
    id: "steering",
    label: "Steering",
    eyebrow: "G29-STYLE DRIVING COCKPIT",
    title: "Wheel, pedals and race controls in one cockpit.",
    description:
      "Touch or tilt to steer through selectable lock ranges, then feather brake and throttle, pull the analog handbrake, trigger nitro and read live speed, RPM and gear telemetry.",
    detail: "180°–1080° · TOUCH + GYRO · ANALOG PEDALS · TELEMETRY",
    image: steeringModeAsset.url,
    alt: "TouchToSteer steering mode showing a wheel, telemetry gauges, brake and throttle pedals, handbrake and nitro",
  },
] as const;

const featureCards = [
  {
    icon: Hand,
    code: "01",
    title: "ForceFlex",
    copy: "Software stick-response profiles provide soft, balanced, firm and heavy center feel.",
  },
  {
    icon: Zap,
    code: "02",
    title: "ForceAdapt",
    copy: "Trigger profiles shape travel for regular, race, sniper, recoil, vibration and lock behavior.",
  },
  {
    icon: Target,
    code: "03",
    title: "Gyro Control",
    copy: "Motion-aware aiming maps device orientation into the same controller state pipeline.",
  },
  {
    icon: Waves,
    code: "04",
    title: "Haptics",
    copy: "Touch edges and trigger zones can produce browser vibration feedback.",
  },
  {
    icon: TimerReset,
    code: "05",
    title: "Turbo",
    copy: "Rapid-repeat behavior for supported buttons while preserving edge semantics.",
  },
  {
    icon: Keyboard,
    code: "06",
    title: "Precision Input",
    copy: "Coalesced pointer motion, DPI scaling and mouse controls complete the desktop path.",
  },
];

const telemetry = [
  "Native game telemetry only — no invented speed or RPM.",
  "Forza, EA F1, DiRT, SMS telemetry and OutGauge support are surfaced through the bridge.",
  "The steering dashboard updates from the newest UDP packet available.",
  "Unsupported packet schemas remain NO SIGNAL instead of displaying fabricated values.",
];

const setupSteps = [
  { n: "01", title: "Launch the bridge", copy: "Run the packaged TouchToSteer Windows bridge." },
  { n: "02", title: "Connect the phone", copy: "Use the same Wi-Fi network and enter the bridge WebSocket address." },
  { n: "03", title: "Take control", copy: "Open the controller and choose Gamepad, Steering or Mouse." },
];


const systemMatrix = [
  {
    code: "01 / GAMEPAD",
    title: "APEX-STYLE CONTROL DECK",
    items: [
      "D-pad + ABXY face buttons",
      "L3 / R3 clickable analog sticks",
      "LB / RB shoulder buttons",
      "LT / RT analog ForceAdapt triggers",
      "ForceAdapt profiles: regular / race / sniper / recoil / vibration / lock",
      "VIEW / MENU / HOME extra controls",
      "Turbo rapid-repeat mode",
      "Gyro aim with invert-Y support",
      "FORCEFLEX 30 / 50 / 80 / 100 gf response profiles",
      "Dead zone + linearity + stick sensitivity tuning",
      "60 / 120 / 144 / 180 / 240 Hz controller transport",
      "Phone haptics + visual 3D DualShock-style vibration feedback",
    ],
  },
  {
    code: "02 / STEERING",
    title: "G29-STYLE DRIVING COCKPIT",
    items: [
      "Touch steering wheel with automatic return-to-centre",
      "Tilt steering through device gyroscope",
      "180° / 270° / 360° / 540° / 720° / 900° / 1080° lock range",
      "2-brake / throttle pedal surface",
      "Racing handbrake + analog travel",
      "Nitro control",
      "Shift / gear state + selector dial transport",
      "G29-style telemetry gauges: speed / RPM / gear",
      "PS3 / PS4 wheel-platform state support",
      "Native NO SIGNAL state when telemetry is unavailable",
      "FFB haptic assist around wheel movement / centre / lock edges",
      "Dedicated steering sensitivity + max-tilt + invert-tilt controls",
    ],
  },
  {
    code: "03 / MOUSE",
    title: "VIPER-STYLE PRECISION SURFACE",
    items: [
      "LMB / RMB click zones + middle wheel",
      "Back / Forward side buttons (MB4 / MB5)",
      "Phone vibration + optional short audio click/scroll feedback",
      "DPI output from 400 to 50,000",
      "125 / 250 / 500 / 1000 / 2000 / 4000 / 8000 Hz polling target",
      "Mouse sensitivity scaling + rotation",
      "Magic-Remote-style gyro pointer",
      "Center Sync to re-calibrate the pointer origin",
      "Dynamic sensitivity with configurable maximum multiplier",
      "Smart tracking with coalesced pointer events",
      "Asymmetric lift-off / landing tuning",
      "Independent X / Y inversion",
      "Viper V4 Pro / FPS Precision / Desktop 1:1 software profiles",
    ],
  },
  {
    code: "04 / BRIDGE",
    title: "REAL WINDOWS INPUT PATH",
    items: [
      "WebSocket phone → PC transport",
      "Universal XInput + DirectInput/HID-compatible output",
      "XInput-only and DualShock 4 / HID output modes",
      "Up to 4 simultaneous XInput players",
      "Immediate digital edge packets for fast taps",
      "Immediate analog-state packets + continuous refresh watchdog",
      "Native Windows mouse injection path",
      "Connection status + latency reporting",
      "Saved settings stored locally on the phone",
    ],
  },
  {
    code: "05 / SIGNAL + MOTION",
    title: "SPECTRAL INTERACTION LAYER",
    items: [
      "Landing-page 3D controller viewer using the current controller asset",
      "Pointer-following controller pose + drag / rotate interaction",
      "Live phone gyro driving the landing controller at 1.50× sensitivity",
      "Gyro-driven star-dust particle parallax at the same 1.50× response",
      "Cyan / violet / green spectral glow system",
      "Animated scanlines, orbit rings, noise and vignette layers",
      "Responsive portrait + landscape layouts",
      "Orientation gate with fullscreen + orientation-lock request",
    ],
  },
  {
    code: "06 / FEEL + SAFETY",
    title: "FEEDBACK / CONTROL INTEGRITY",
    items: [
      "Input haptics are rate-limited and sent without blocking controller packets",
      "Trigger pressure-aware response when touch/pen pressure is available",
      "Automatic release on blur / page hide / visibility changes",
      "Mode changes clear the previous controller state",
      "Reduced-motion accessibility handling",
      "Touch-first controls use compositor-friendly transforms",
      "Unsupported telemetry stays clean instead of inventing values",
    ],
  },
];

function GhostMark() {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className="spectral-ghost-mark">
      <path
        d="m508.374 432.802s-46.6-39.038-79.495-275.781c-8.833-87.68-82.856-156.139-172.879-156.139-90.015 0-164.046 68.458-172.879 156.138-32.895 236.743-79.495 275.782-79.495 275.782-15.107 25.181 20.733 28.178 38.699 27.94 35.254-.478 35.254 40.294 70.516 40.294 35.254 0 35.254-35.261 70.508-35.261s37.396 45.343 72.65 45.343 37.389-45.343 72.651-45.343c35.254 0 35.254 35.261 70.508 35.261s35.27-40.772 70.524-40.294c17.959.238 53.798-2.76 38.692-27.94z"
        fill="currentColor"
      />
      <circle cx="208" cy="225" r="22" fill="#05070a" className="spectral-ghost-eye ghost-eye-a" />
      <circle cx="297" cy="225" r="22" fill="#05070a" className="spectral-ghost-eye ghost-eye-b" />
    </svg>
  );
}

function Preloader({ ready }: { ready: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(100, value + (value < 72 ? 7 : 4)));
    }, 55);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ready) setProgress(100);
  }, [ready]);

  const visible = !ready;

  return (
    <div className={`spectral-preloader ${visible ? "" : "spectral-preloader-hide"}`}>
      <div className="spectral-preloader-inner">
        <div className="spectral-ghost-loader">
          <GhostMark />
          <span className="spectral-ghost-aura" />
          <span className="spectral-ghost-aura spectral-ghost-aura-2" />
        </div>
        <span className="spectral-loader-kicker">TOUCHTOSTEER / SIGNAL INIT</span>
        <strong>{progress}%</strong>
        <span className="spectral-loader-text">{ready ? "SIGNAL LOCKED" : "SUMMONING CONTROL SIGNAL"}</span>
        <div className="spectral-loader-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  code,
  title,
  copy,
}: {
  icon: typeof Hand;
  code: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="spectral-feature-card">
      <div className="spectral-feature-top">
        <span>{code}</span>
        <Icon size={17} strokeWidth={1.7} />
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <div className="spectral-feature-scan" />
    </article>
  );
}

function LandingPage() {
  const [ready, setReady] = useState(false);
  const [activeProof, setActiveProof] = useState(0);
  const [gyroSupported, setGyroSupported] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const gyroCleanupRef = useRef<(() => void) | null>(null);
  const gyroBaselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1450);
    return () => window.clearTimeout(timer);
  }, []);

  const startGyro = useCallback(async () => {
    if (typeof window === "undefined") return;

    const DeviceOrientation = window.DeviceOrientationEvent as typeof window.DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (!DeviceOrientation) {
      setGyroSupported(false);
      return;
    }

    if (typeof DeviceOrientation.requestPermission === "function") {
      try {
        const permission = await DeviceOrientation.requestPermission();
        if (permission !== "granted") {
          setGyroEnabled(false);
          return;
        }
      } catch {
        setGyroEnabled(false);
        return;
      }
    }

    gyroCleanupRef.current?.();
    gyroBaselineRef.current = null;

    const onOrientation = (event: DeviceOrientationEvent) => {
      const beta = typeof event.beta === "number" ? event.beta : null;
      const gamma = typeof event.gamma === "number" ? event.gamma : null;
      if (beta === null || gamma === null) return;

      const screenAngle =
        typeof window !== "undefined"
          ? window.screen.orientation?.angle ??
            (window as Window & { orientation?: number }).orientation ??
            0
          : 0;

      let xTilt = gamma;
      let yTilt = beta;

      if (Math.abs(screenAngle) === 90) {
        xTilt = screenAngle === 90 ? beta : -beta;
        yTilt = screenAngle === 90 ? -gamma : gamma;
      }

      const baseline = gyroBaselineRef.current;
      if (!baseline) {
        gyroBaselineRef.current = { beta: xTilt, gamma: yTilt };
        return;
      }

      const sensitivity = 1.5;
      const x = Math.max(-1, Math.min(1, ((xTilt - baseline.beta) / 18) * sensitivity));
      const y = Math.max(-1, Math.min(1, ((yTilt - baseline.gamma) / 18) * sensitivity));

      window.dispatchEvent(
        new CustomEvent("touch-to-steer:landing-gyro", {
          detail: { x, y },
        }),
      );
    };

    const recalibrate = () => {
      gyroBaselineRef.current = null;
    };

    window.addEventListener("deviceorientation", onOrientation, true);
    window.addEventListener("orientationchange", recalibrate, { passive: true });
    gyroCleanupRef.current = () => {
      window.removeEventListener("deviceorientation", onOrientation, true);
      window.removeEventListener("orientationchange", recalibrate);
      gyroBaselineRef.current = null;
      window.dispatchEvent(
        new CustomEvent("touch-to-steer:landing-gyro", {
          detail: { x: 0, y: 0 },
        }),
      );
    };
    setGyroEnabled(true);
  }, []);

  useEffect(() => {
    const touchDevice =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (!touchDevice || typeof window === "undefined") return;

    const DeviceOrientation = window.DeviceOrientationEvent as typeof window.DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (!DeviceOrientation) return;

    setGyroSupported(true);

    if (typeof DeviceOrientation.requestPermission !== "function") {
      void startGyro();
    }

    return () => {
      gyroCleanupRef.current?.();
      gyroCleanupRef.current = null;
    };
  }, [startGyro]);

  const trackPointer = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pageRef.current?.style.setProperty("--pointer-x", x.toFixed(3));
    pageRef.current?.style.setProperty("--pointer-y", y.toFixed(3));
  };

  return (
    <>
      <Preloader ready={ready} />

      <main
        ref={pageRef}
        onPointerMove={trackPointer}
        className={`spectral-page ${ready ? "spectral-ready" : ""}`}
      >
        <StarDust />
        <div className="spectral-noise" aria-hidden="true" />
        <div className="spectral-vignette" aria-hidden="true" />

        <header className="spectral-nav">
          <Link to="/" className="spectral-brand" aria-label="TouchToSteer home">
            <span className="spectral-brand-icon"><GhostMark /></span>
            <span>TOUCHTOSTEER</span>
          </Link>

          <nav className="spectral-nav-links" aria-label="Primary">
            <a href="#system">System</a>
            <a href="#features">Features</a>
            <a href="#telemetry">Telemetry</a>
            <a href="#bridge">Bridge</a>
            <Link to="/setup">Setup</Link>
          </nav>

          <Link to="/controller" className="spectral-nav-cta">
            Launch controller <ArrowUpRight size={14} />
          </Link>
        </header>

        <section className="spectral-hero" id="system">
          <div className="spectral-hero-background" aria-hidden="true">
            <LandingScene />
            <div className="spectral-hero-background-sheen" />
            <div className="spectral-background-hud">
              <span>IMMERSIVE SIGNAL FIELD</span>
              <strong>3D TRACKING / LIVE MOTION</strong>
            </div>
          </div>

          <div className="spectral-hero-copy">
            <div className="spectral-status-line">
              <span className="spectral-status-dot" />
              SPECTRAL CONTROL SYSTEM / ONLINE
            </div>

            <p className="spectral-kicker">FLYDIGI APEX 5 / PHONE → PC</p>
            <h1>
              CONTROL
              <span>HAS A</span>
              <em>NEW GHOST.</em>
            </h1>

            <p className="spectral-hero-description">
              TouchToSteer turns the device already in your hand into a virtual gamepad,
              steering wheel and precision mouse — wrapped in a living 3D signal that
              follows your movement.
            </p>

            <div className="spectral-hero-actions">
              <div className="spectral-primary-stack">
                <Link to="/controller" className="spectral-primary">
                  Get started
                  <ArrowUpRight size={18} />
                </Link>
                <a
                  href="https://github.com/arivuwallet-sketch/touch-to-steer/releases/download/bridge-latest/TouchToSteer.Spectral.Control.System-win32-x64.zip"
                  className="spectral-download"
                  aria-label="Download TouchToSteer for Windows"
                >
                  <Download size={15} />
                  Download for Windows
                </a>
              </div>
              <div className="spectral-explore-stack">
                <a href="#features" className="spectral-secondary">
                  Explore capability <ArrowDown size={16} />
                </a>
                <a
                  href="https://drive.google.com/file/d/1b39QZPejykCCSY8rpcs3cBsu6IqdfjRF/view?usp=sharing"
                  className="spectral-android-download"
                  aria-label="Download TouchToSteer Android APK"
                >
                  <Download size={15} />
                  Download for Android — APK
                </a>
              </div>
              {gyroSupported && (
                <button
                  type="button"
                  className={`spectral-gyro-toggle ${gyroEnabled ? "is-active" : ""}`}
                  onClick={() => void startGyro()}
                  aria-label={gyroEnabled ? "Recalibrate landing gyro" : "Enable landing gyro"}
                >
                  <span className="spectral-gyro-dot" />
                  {gyroEnabled ? "GYRO 1.50× ACTIVE" : "ENABLE GYRO 1.50×"}
                </button>
              )}
            </div>

            <div className="spectral-mode-readout">
              {capabilities.map(([name, desc]) => (
                <div key={name}>
                  <strong>{name}</strong>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="spectral-controller-stage">
            <UploadedControllerScene />
            <div className="spectral-model-glass" />
            <div className="spectral-stage-hud hud-tl">
              <span>CONTROLLER / 3D MODEL</span>
              <strong>LOCAL PBR VIEWER</strong>
            </div>
            <div className="spectral-stage-hud hud-tr">
              <span>CURSOR FLOW</span>
              <strong>FULL PAGE / SMOOTH TRACK</strong>
            </div>
            <div className="spectral-stage-id">MODEL / CONTROLLER</div>
            <div className="spectral-controller-reticle" />
            <div className="spectral-controller-caption">
              <span>REAL 3D CONTROLLER</span>
              <strong>REAL 3D ASSET / POINTER + DRAG</strong>
            </div>
          </div>
        </section>

        <section className="spectral-section spectral-mode-proof" id="modes">
          <div className="spectral-section-head">
            <div>
              <span>02 / REAL CONTROL SURFACES</span>
              <h2>See exactly what you control.</h2>
            </div>
            <p>
              These are real screenshots of the three working controller modes. Select a mode to
              inspect its complete phone interface before you launch it.
            </p>
          </div>

          <div className="spectral-proof-tabs" role="tablist" aria-label="Controller mode screenshots">
            {modeProofs.map((proof, index) => (
              <Button
                key={proof.id}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={activeProof === index}
                aria-controls={`mode-proof-${proof.id}`}
                id={`mode-tab-${proof.id}`}
                className={activeProof === index ? "is-active" : ""}
                onClick={() => setActiveProof(index)}
              >
                <span>0{index + 1}</span>
                {proof.label}
              </Button>
            ))}
          </div>

          {modeProofs.map((proof, index) => (
            <article
              key={proof.id}
              id={`mode-proof-${proof.id}`}
              role="tabpanel"
              aria-labelledby={`mode-tab-${proof.id}`}
              hidden={activeProof !== index}
              className={`spectral-proof-view spectral-proof-view-${proof.id}`}
            >
              <div className="spectral-proof-screen">
                <img src={proof.image} alt={proof.alt} />
                <span className="spectral-proof-live"><i /> REAL INTERFACE</span>
              </div>
              <div className="spectral-proof-copy">
                <span>{proof.eyebrow}</span>
                <h3>{proof.title}</h3>
                <p>{proof.description}</p>
                <strong>{proof.detail}</strong>
                <Link to="/controller" className="spectral-inline-link">
                  Open {proof.label} mode <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="spectral-section spectral-section-dark" id="features">
          <div className="spectral-section-head">
            <div>
              <span>02 / CONTROL LAYERS</span>
              <h2>Every gesture has a route.</h2>
            </div>
            <p>
              One native bridge, three control surfaces and a set of input behaviors designed
              around immediate touch events instead of a decorative mockup.
            </p>
          </div>

          <div className="spectral-feature-grid">
            {featureCards.map((item) => <FeatureCard key={item.code} {...item} />)}
          </div>

          <div className="spectral-system-matrix">
            <div className="spectral-system-matrix-head">
              <div>
                <span>02A / COMPLETE FEATURE MATRIX</span>
                <h3>Nothing hidden behind the controller.</h3>
              </div>
              <p>Every current control surface, tuning option, feedback layer and transport feature is documented here — including the latest 1.50× landing gyro update.</p>
            </div>

            <div className="spectral-system-matrix-grid">
              {systemMatrix.map((group) => (
                <article key={group.code} className="spectral-system-matrix-card">
                  <div className="spectral-system-matrix-code">{group.code}</div>
                  <h4>{group.title}</h4>
                  <div className="spectral-system-matrix-list">
                    {group.items.map((item) => (
                      <div key={item}>
                        <span />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="spectral-product-band">
            <div className="spectral-product-band-mark"><Gamepad2 size={24} /></div>
            <div>
              <span>GAMEPAD MODE</span>
              <strong>Gamepad / LB / RB / LT / RT / Analog / Turbo</strong>
            </div>
            <div>
              <span>STEERING MODE</span>
              <strong>Wheel / Pedals / Gear / Telemetry / Gyro</strong>
            </div>
            <div>
              <span>MOUSE MODE</span>
              <strong>Pointer / Wheel / Side Buttons / Gyro Aim</strong>
            </div>
          </div>
        </section>

        <section className="spectral-signal-section" id="telemetry">
          <div className="spectral-signal-visual">
            <div className="spectral-signal-core">
              <span>UDP</span>
              <strong>LIVE</strong>
              <small>TELEMETRY</small>
            </div>
            <div className="signal-ring signal-ring-a" />
            <div className="signal-ring signal-ring-b" />
            <div className="signal-scan signal-scan-a" />
            <div className="signal-scan signal-scan-b" />
          </div>

          <div className="spectral-signal-copy">
            <span>03 / NATIVE TELEMETRY</span>
            <h2>Real data leaves a cleaner trail.</h2>
            <p>
              TouchToSteer keeps the dashboard tied to supported game packets. When packets are
              absent or unsupported, the interface can remain in a clean NO SIGNAL state.
            </p>
            <div className="spectral-check-list">
              {telemetry.map((item) => (
                <div key={item}><ShieldCheck size={15} /><span>{item}</span></div>
              ))}
            </div>
            <Link to="/setup" className="spectral-inline-link">
              View telemetry and setup <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>

        <section className="spectral-section spectral-section-dark" id="bridge">
          <div className="spectral-section-head">
            <div>
              <span>04 / WINDOWS BRIDGE</span>
              <h2>From spectral UI to a real PC device.</h2>
            </div>
            <p>
              The landing experience is visual; the controller remains functional. The packaged
              Windows bridge handles virtual controller output and native mouse injection.
            </p>
          </div>

          <div className="spectral-steps">
            {setupSteps.map((step) => (
              <article key={step.n} className="spectral-step">
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>

          <div className="spectral-tools-row">
            <div><Wifi size={17} /><span>LOCAL WI-FI</span></div>
            <div><RadioTower size={17} /><span>WEBSOCKET</span></div>
            <div><BatteryCharging size={17} /><span>PHONE-FIRST</span></div>
            <div><Mouse size={17} /><span>REAL MOUSE PATH</span></div>
            <div><Gauge size={17} /><span>STEERING DASH</span></div>
          </div>
        </section>

        <section className="spectral-cta">
          <div className="spectral-cta-ghost" aria-hidden="true"><GhostMark /></div>
          <div className="spectral-cta-content">
            <span><Sparkles size={13} /> 05 / ENTER THE SYSTEM</span>
            <h2>Your phone is already a controller.</h2>
            <p>
              Open TouchToSteer, connect the bridge and turn touch, motion and telemetry into
              one game-ready control surface.
            </p>
            <Link to="/controller" className="spectral-primary spectral-primary-large">
              Get started with TouchToSteer
              <ArrowUpRight size={19} />
            </Link>
            <div className="spectral-cta-links">
              <Link to="/setup">PC setup</Link>
              <a href="#system">Back to system</a>
            </div>
          </div>
        </section>

        <footer className="spectral-footer">
          <span>TOUCHTOSTEER / SPECTRAL CONTROL SYSTEM</span>
          <span>GAMEPAD • STEERING • MOUSE</span>
          <h1>
          <span className="spectral-founder-credit">FOUNDER / SOORAJ</span></h1>
          <span>2026</span>
        </footer>
      </main>
    </>
  );
}
