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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LandingScene } from "@/components/landing/LandingScene";

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
    let frame = 0;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = value + (value < 72 ? 7 : value < 92 ? 3 : 1);
        if (next >= 100) {
          window.clearInterval(timer);
          return 100;
        }
        return next;
      });
      frame += 1;
      if (frame > 55) window.clearInterval(timer);
    }, 55);

    return () => window.clearInterval(timer);
  }, []);

  const visible = !ready || progress < 100;

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
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1450);
    return () => window.clearTimeout(timer);
  }, []);

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
          <div className="spectral-hero-copy">
            <div className="spectral-status-line">
              <span className="spectral-status-dot" />
              SPECTRAL CONTROL SYSTEM / ONLINE
            </div>

            <p className="spectral-kicker">PHONE → PC / LOW-LATENCY INPUT</p>
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
              <Link to="/controller" className="spectral-primary">
                Get started
                <ArrowUpRight size={18} />
              </Link>
              <a href="#features" className="spectral-secondary">
                Explore capability <ArrowDown size={16} />
              </a>
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

          <div className="spectral-hero-stage">
            <div className="spectral-stage-hud hud-tl">
              <span>TRACK / 3D SIGNAL</span>
              <strong>TOUCH + GYRO + POINTER</strong>
            </div>
            <div className="spectral-stage-hud hud-tr">
              <span>RESPONSE</span>
              <strong>EDGE → STATE → PC</strong>
            </div>
            <div className="spectral-stage-id">TTS / 001</div>
            <LandingScene />
          </div>
        </section>

        <section className="spectral-scroll-banner">
          <span>01 / SYSTEM</span>
          <strong>THE CONTROL SURFACE IS ALIVE.</strong>
          <span>SCROLL TO DECODE</span>
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
          <span>2026</span>
        </footer>
      </main>
    </>
  );
}
