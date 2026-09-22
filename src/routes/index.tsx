import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Gauge,
  Gamepad2,
  Hand,
  Keyboard,
  Mouse,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Waves,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LandingScene } from "@/components/landing/LandingScene";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TouchToSteer — Spectral Virtual Controller" },
      {
        name: "description",
        content:
          "TouchToSteer turns your phone into a virtual gamepad, steering wheel and precision mouse with configurable high-rate input, gyro, haptics and native game telemetry.",
      },
      { property: "og:title", content: "TouchToSteer — Spectral Virtual Controller" },
      {
        property: "og:description",
        content:
          "A cinematic, touch-first virtual controller for PC gaming with gamepad, wheel, mouse and live telemetry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function SpectralPreloader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let value = 0;
    const timer = window.setInterval(() => {
      value += Math.random() * 13 + 7;
      const next = Math.min(100, Math.round(value));
      setProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
        window.setTimeout(onDone, 420);
      }
    }, 115);

    return () => window.clearInterval(timer);
  }, [onDone]);

  return (
    <div className="landing-preloader" role="status" aria-live="polite">
      <div className="landing-preloader-inner">
        <div className="landing-ghost-loader" aria-hidden="true">
          <svg viewBox="0 0 512 512" className="landing-ghost-svg">
            <path
              className="landing-ghost-body"
              d="m508.374 432.802s-46.6-39.038-79.495-275.781c-8.833-87.68-82.856-156.139-172.879-156.139-90.015 0-164.046 68.458-172.879 156.138-32.895 236.743-79.495 275.782-79.495 275.782-15.107 25.181 20.733 28.178 38.699 27.94 35.254-.478 35.254 40.294 70.516 40.294 35.254 0 35.254-35.261 70.508-35.261s37.396 45.343 72.65 45.343 37.389-45.343 72.651-45.343c35.254 0 35.254 35.261 70.508 35.261s35.27-40.772 70.524-40.294c17.959.238 53.798-2.76 38.692-27.94z"
            />
            <circle className="landing-ghost-eye" cx="208" cy="225" r="22" />
            <circle className="landing-ghost-eye" cx="297" cy="225" r="22" />
          </svg>
        </div>
        <div className="landing-preloader-kicker">TOUCHTOSTEER // INITIALIZING</div>
        <div className="landing-preloader-title">Summoning the control layer</div>
        <div className="landing-preloader-progress">
          <span style={{ width: progress + "%" }} />
        </div>
        <div className="landing-preloader-value">{String(progress).padStart(3, "0")}%</div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  code,
  title,
  children,
}: {
  icon: LucideIcon;
  code: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="spectral-feature">
      <div className="spectral-feature-icon"><Icon size={18} /></div>
      <div className="spectral-feature-meta">{code}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

const modes = [
  {
    icon: Gamepad2,
    code: "SYS / 01",
    title: "GAMEPAD",
    copy: "Thumb-first layout with D-pad, ABXY, LB/RB, LT/RT, dual analog sticks and auxiliary controls.",
  },
  {
    icon: Gauge,
    code: "SYS / 02",
    title: "STEERING",
    copy: "Touch wheel, pedals, handbrake, gear input and telemetry dashboard for driving-focused control.",
  },
  {
    icon: Mouse,
    code: "SYS / 03",
    title: "MOUSE",
    copy: "Desktop cursor control with buttons, wheel, side inputs, gyro aim, DPI scaling and dynamic sensitivity.",
  },
];

const featureRows: Array<[LucideIcon, string, string]> = [
  [Hand, "FORCEFLEX", "Software stick-response tension profiles from feather-light to heavy precision."],
  [Zap, "FORCEADAPT", "Trigger curves, walls, vibration patterns and lock-style actuation profiles."],
  [Target, "GYRO AIM", "Device orientation can drive look axes with configurable deadzone, sensitivity and linearity."],
  [Waves, "HAPTICS", "Browser vibration feedback is used for digital edges, trigger zones and steering feedback."],
  [TimerReset, "TURBO", "Momentary controls can repeat rapidly while preserving normal press/release edges."],
  [Keyboard, "PRECISION", "Mouse movement is coalesced when necessary and native Windows injection handles desktop input."],
];

function LandingPage() {
  const [preloaded, setPreloaded] = useState(false);

  useEffect(() => {
    document.body.classList.add("landing-body");
    return () => document.body.classList.remove("landing-body");
  }, []);

  return (
    <main className={"spectral-landing " + (preloaded ? "is-ready" : "")}>
      {!preloaded && <SpectralPreloader onDone={() => setPreloaded(true)} />}

      <div className="spectral-noise" aria-hidden="true" />
      <div className="spectral-vignette" aria-hidden="true" />

      <header className="spectral-nav">
        <a href="#top" className="spectral-brand">
          <span className="spectral-brand-mark">
            <span />
            <span />
            <span />
          </span>
          TOUCHTOSTEER
        </a>

        <nav className="spectral-nav-links" aria-label="Primary">
          <a href="#systems">Systems</a>
          <a href="#features">Features</a>
          <a href="#telemetry">Telemetry</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/setup">Setup</Link>
        </nav>

        <Link to="/controller" className="spectral-nav-launch">
          Open controller <ArrowUpRight size={15} />
        </Link>
      </header>

      <section id="top" className="spectral-hero">
        <div className="spectral-hero-copy">
          <div className="spectral-overline">
            <span className="spectral-pulse" />
            NEXT-GENERATION PHONE → PC INPUT
          </div>

          <h1>
            TOUCH
            <span>THE SIGNAL.</span>
            <em>STEER THE GAME.</em>
          </h1>

          <p>
            TouchToSteer turns the device already in your hand into a configurable
            virtual gamepad, steering wheel and precision mouse. The interface is built
            around immediate input edges, high-rate state transport and touch-first control.
          </p>

          <div className="spectral-hero-actions">
            <Link to="/controller" className="spectral-cta-primary">
              Get started <ArrowRight size={18} />
            </Link>
            <a href="#systems" className="spectral-cta-secondary">
              Explore the signal <ArrowDown size={16} />
            </a>
          </div>

          <div className="spectral-readout">
            <div><span>INPUT</span><strong>240 Hz</strong><small>SELECTABLE</small></div>
            <div><span>MODES</span><strong>03</strong><small>PAD / WHEEL / MOUSE</small></div>
            <div><span>LINK</span><strong>WS</strong><small>LOCAL BRIDGE</small></div>
          </div>
        </div>

        <div className="spectral-hero-stage">
          <div className="spectral-stage-corner spectral-stage-corner-tl">
            <span>TRACKING / ACTIVE</span>
            <strong>POINTER + MOTION + TOUCH</strong>
          </div>
          <div className="spectral-stage-corner spectral-stage-corner-br">
            <span>STATE / CURRENT</span>
            <strong>EDGE → HOT → DRIVER</strong>
          </div>
          <LandingScene />
          <div className="spectral-scroll-cue">
            <span>SCROLL / MOVE</span>
            <div />
          </div>
        </div>
      </section>

      <section id="systems" className="spectral-section spectral-section-dark">
        <div className="spectral-section-title">
          <div>
            <span>SPECTRAL CONTROL SURFACES</span>
            <h2>One bridge. Three realities.</h2>
          </div>
          <p>
            The landing experience now behaves like the controller itself: layered, reactive,
            and organized around the exact interaction surfaces TouchToSteer exposes.
          </p>
        </div>

        <div className="spectral-mode-grid">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link to="/controller" key={mode.code} className="spectral-mode-card">
                <div className="spectral-mode-head">
                  <div className="spectral-mode-icon"><Icon size={24} /></div>
                  <span>{mode.code}</span>
                </div>
                <h3>{mode.title}</h3>
                <p>{mode.copy}</p>
                <div className="spectral-mode-arrow"><ArrowUpRight size={17} /></div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="features" className="spectral-section">
        <div className="spectral-section-title">
          <div>
            <span>CONTROL ENGINE</span>
            <h2>Every layer stays visible.</h2>
          </div>
          <p>
            No mystery UI: the page exposes the controller features that matter when you
            actually play, tune, drive or aim.
          </p>
        </div>

        <div className="spectral-feature-grid">
          {featureRows.map(([Icon, code, copy], index) => (
            <Feature
              key={code}
              icon={Icon}
              code={"0" + (index + 1) + " / " + code}
              title={code}
            >
              {copy}
            </Feature>
          ))}
        </div>
      </section>

      <section id="telemetry" className="spectral-telemetry">
        <div className="spectral-telemetry-orb">
          <div className="spectral-orb-core">
            <span>LIVE</span>
            <strong>DATA</strong>
            <small>GAME → BRIDGE → PHONE</small>
          </div>
          <div className="spectral-orb-ring spectral-orb-ring-a" />
          <div className="spectral-orb-ring spectral-orb-ring-b" />
          <div className="spectral-orb-ring spectral-orb-ring-c" />
          <div className="spectral-orb-particle p1" />
          <div className="spectral-orb-particle p2" />
          <div className="spectral-orb-particle p3" />
        </div>

        <div className="spectral-telemetry-copy">
          <span>NATIVE TELEMETRY</span>
          <h2>Real game data remains real.</h2>
          <p>
            Steering dashboards can surface the newest supported UDP telemetry packet without
            inventing speed or RPM values. The PC bridge decodes supported formats and forwards
            the newest data to the phone.
          </p>

          <div className="spectral-telemetry-grid">
            <div><Activity size={16} /><span>Speed / RPM / Gear</span></div>
            <div><Radio size={16} /><span>UDP telemetry listeners</span></div>
            <div><Wifi size={16} /><span>Same-network bridge</span></div>
            <div><ShieldCheck size={16} /><span>No fake gauge data</span></div>
          </div>

          <Link to="/setup" className="spectral-inline-link">
            View compatibility + setup <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="spectral-section spectral-section-dark">
        <div className="spectral-section-title">
          <div>
            <span>THE CONNECTION</span>
            <h2>From touch surface to Windows input.</h2>
          </div>
          <p>
            The browser is the control surface; the packaged bridge handles native Windows
            controller and mouse output.
          </p>
        </div>

        <div className="spectral-pipeline">
          <article>
            <span>01</span>
            <Settings2 size={20} />
            <h3>RUN THE BRIDGE</h3>
            <p>Launch TouchToSteer-Bridge.exe on the Windows gaming PC.</p>
          </article>
          <article>
            <span>02</span>
            <Wifi size={20} />
            <h3>CONNECT</h3>
            <p>Put the phone and PC on the same Wi-Fi and connect using the bridge address.</p>
          </article>
          <article>
            <span>03</span>
            <Gamepad2 size={20} />
            <h3>PLAY</h3>
            <p>Use gamepad, steering or mouse mode while the bridge sends the current input to Windows.</p>
          </article>
        </div>

        <div className="spectral-platform-row">
          <div><BatteryCharging size={16} /> PHONE-FIRST</div>
          <div><Radio size={16} /> WEBSOCKET</div>
          <div><ShieldCheck size={16} /> XINPUT + DS4</div>
          <div><Target size={16} /> GYRO + TOUCH</div>
        </div>
      </section>

      <section className="spectral-final">
        <div className="spectral-final-ghost" aria-hidden="true" />
        <div className="spectral-final-content">
          <span><Sparkles size={14} /> TOUCHTOSTEER</span>
          <h2>Enter the controller.</h2>
          <p>
            The landing page ends where the product starts: inside the full TouchToSteer
            controller surface with all existing modes and controls intact.
          </p>
          <Link to="/controller" className="spectral-final-cta">
            Get started with TouchToSteer <ArrowUpRight size={19} />
          </Link>
          <Link to="/setup" className="spectral-final-link">
            PC setup and compatibility <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <footer className="spectral-footer">
        <span>TOUCHTOSTEER</span>
        <span>GAMEPAD / STEERING / MOUSE</span>
        <span>PHONE → PC</span>
      </footer>
    </main>
  );
}
