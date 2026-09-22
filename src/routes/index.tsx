import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BatteryCharging,
  Bluetooth,
  Gauge,
  Gamepad2,
  Globe2,
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
  type LucideIcon,
} from "lucide-react";
import { LandingScene } from "@/components/landing/LandingScene";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TouchToSteer — Your Phone. Your Controller." },
      {
        name: "description",
        content:
          "An immersive touch-first control system for PC gaming: virtual gamepad, steering wheel, precision mouse, gyro aiming, haptics and live telemetry.",
      },
      { property: "og:title", content: "TouchToSteer — Your Phone. Your Controller." },
      {
        property: "og:description",
        content:
          "Turn a phone into a virtual gamepad, steering wheel and precision mouse for PC gaming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function FeatureCard({
  index,
  icon: Icon,
  title,
  eyebrow,
  children,
}: {
  index: string;
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <article className="landing-card landing-reveal">
      <div className="landing-card-top">
        <span className="landing-index">{index}</span>
        <span className="landing-icon"><Icon size={18} strokeWidth={1.8} /></span>
      </div>
      <span className="landing-eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

const modeCards = [
  {
    icon: Gamepad2,
    tag: "01 / GAMEPAD",
    title: "Console-style touch layout",
    body: "Full-screen D-pad, ABXY, sticks, triggers, extra buttons and vibration feedback are arranged for fast landscape play.",
  },
  {
    icon: Gauge,
    tag: "02 / STEERING",
    title: "A real driving dashboard",
    body: "Steering wheel control, touch pedals, handbrake, gear input and live telemetry turn the phone into a compact sim-racing interface.",
  },
  {
    icon: Mouse,
    tag: "03 / MOUSE",
    title: "Precision desktop control",
    body: "Move a normal Windows cursor from the phone with pointer coalescing, DPI scaling, wheel input, extra mouse buttons and gyro aiming.",
  },
];

const telemetryItems = [
  "Speed, RPM and gear values stay native to the game's telemetry stream.",
  "Supported UDP formats are decoded by the Windows bridge and forwarded to the phone.",
  "No simulated speed or RPM numbers are shown when telemetry is missing.",
  "Supported setups include Forza, EA F1, DiRT, SMS titles, BeamNG and Live for Speed.",
];

const bridgeSteps = [
  {
    n: "01",
    title: "Run the bridge",
    body: "Launch the packaged TouchToSteer Windows bridge. It exposes the local controller endpoint for your phone.",
  },
  {
    n: "02",
    title: "Connect on Wi-Fi",
    body: "Put the phone and gaming PC on the same network, then paste the bridge WebSocket address into Settings.",
  },
  {
    n: "03",
    title: "Play",
    body: "Choose gamepad, wheel or mouse mode and send controller input straight to the Windows virtual device.",
  },
];

function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-noise" aria-hidden="true" />
      <div className="landing-grid" aria-hidden="true" />

      <header className="landing-nav">
        <a href="#top" className="landing-brand">
          <span className="landing-brand-dot" />
          TOUCHTOSTEER
        </a>
        <nav className="landing-nav-links" aria-label="Primary">
          <a href="#experience">Experience</a>
          <a href="#controls">Controls</a>
          <a href="#telemetry">Telemetry</a>
          <a href="/setup">Setup</a>
        </nav>
        <Link to="/controller" className="landing-nav-cta">
          Launch controller <ArrowUpRight size={15} />
        </Link>
      </header>

      <section id="top" className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker">
            <span className="landing-live-dot" />
            REAL-TIME PHONE → PC CONTROL
          </div>
          <h1>
            YOUR PHONE.
            <span>YOUR CONTROLLER.</span>
          </h1>
          <p className="landing-hero-text">
            TouchToSteer turns a modern phone into a responsive virtual gamepad,
            steering wheel and precision mouse — with immersive 3D controls, gyro
            aiming, haptics, adaptive input tuning and live racing telemetry.
          </p>

          <div className="landing-actions">
            <Link to="/controller" className="landing-primary-cta">
              Get started
              <ArrowUpRight size={20} />
            </Link>
            <a href="#experience" className="landing-secondary-cta">
              Explore the system
            </a>
          </div>

          <div className="landing-spec-strip">
            <div><strong>240</strong><span>HZ SELECTABLE INPUT</span></div>
            <div><strong>03</strong><span>CONTROL MODES</span></div>
            <div><strong>01</strong><span>PHONE-TO-PC BRIDGE</span></div>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-visual-label landing-visual-label-left">
            <span>TRACKING CORE</span>
            <strong>POINTER • GYRO • TOUCH</strong>
          </div>
          <div className="landing-visual-label landing-visual-label-right">
            <span>INPUT PIPELINE</span>
            <strong>EDGE → STATE → PC</strong>
          </div>
          <LandingScene />
        </div>
      </section>

      <section id="experience" className="landing-section landing-section-dark">
        <div className="landing-section-head landing-reveal">
          <div>
            <span className="landing-eyebrow">ONE APP / THREE INTERFACES</span>
            <h2>Built for the way you actually play.</h2>
          </div>
          <p>
            Switch between control surfaces without changing the PC bridge. Each
            mode is a purpose-built touch interface, not a generic button grid.
          </p>
        </div>

        <div className="landing-card-grid landing-reveal">
          {modeCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.tag} className="landing-mode-card">
                <div className="landing-mode-icon"><Icon size={28} /></div>
                <span>{card.tag}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="landing-mode-line" />
              </article>
            );
          })}
        </div>
      </section>

      <section id="controls" className="landing-section">
        <div className="landing-section-head landing-reveal">
          <div>
            <span className="landing-eyebrow">CONTROL ENGINE</span>
            <h2>Every input layer has a job.</h2>
          </div>
          <p>
            Tunable touch geometry, immediate digital edges, analog state updates
            and browser haptics are designed to keep the interface feeling direct.
          </p>
        </div>

        <div className="landing-feature-grid">
          <FeatureCard index="01" icon={Hand} eyebrow="FORCEFLEX" title="Tension-aware sticks">
            Cycle joystick tension profiles for a more deliberate center feel while keeping
            the input path continuous and configurable.
          </FeatureCard>
          <FeatureCard index="02" icon={Zap} eyebrow="FORCEADAPT" title="Adaptive trigger profiles">
            Regular, race, sniper, recoil, vibration and lock profiles shape trigger travel
            and add tactile feedback patterns.
          </FeatureCard>
          <FeatureCard index="03" icon={Target} eyebrow="GYRO AIM" title="Motion-aware aiming">
            Use device orientation for look control with deadzone, linearity and sensitivity
            tuning carried through the same controller state pipeline.
          </FeatureCard>
          <FeatureCard index="04" icon={Waves} eyebrow="HAPTICS" title="Touch feedback">
            Input edges and trigger zones can pulse the phone's vibration motor without
            blocking the high-frequency controller update path.
          </FeatureCard>
          <FeatureCard index="05" icon={TimerReset} eyebrow="TURBO" title="Rapid repeat input">
            Enable repeat-fire behavior for supported buttons without losing normal press
            and release semantics.
          </FeatureCard>
          <FeatureCard index="06" icon={Keyboard} eyebrow="PRECISION" title="Mouse + desktop input">
            Pointer movement, click buttons, wheel, extra side controls, gyro aim and DPI
            scaling share one touch-first surface.
          </FeatureCard>
        </div>
      </section>

      <section id="telemetry" className="landing-telemetry">
        <div className="landing-telemetry-orbit landing-reveal">
          <div className="landing-orbit-ring orbit-one" />
          <div className="landing-orbit-ring orbit-two" />
          <div className="landing-telemetry-core">
            <span>LIVE</span>
            <strong>DATA</strong>
            <small>UDP → PHONE</small>
          </div>
        </div>

        <div className="landing-telemetry-copy landing-reveal">
          <span className="landing-eyebrow">NATIVE TELEMETRY</span>
          <h2>Drive with real data, not invented numbers.</h2>
          <p>
            In steering mode, the dashboard can surface supported game telemetry while the
            bridge keeps the newest values moving between PC and phone.
          </p>
          <div className="landing-checks">
            {telemetryItems.map((item) => (
              <div key={item}><ShieldCheck size={16} /><span>{item}</span></div>
            ))}
          </div>
          <a href="/setup" className="landing-inline-link">
            View setup + telemetry support <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      <section id="bridge" className="landing-section landing-section-dark">
        <div className="landing-section-head landing-reveal">
          <div>
            <span className="landing-eyebrow">THE BRIDGE</span>
            <h2>Phone in your hand. Virtual device in Windows.</h2>
          </div>
          <p>
            The browser provides the touch surface; the packaged Windows bridge provides
            the native virtual-controller and mouse path that games can consume.
          </p>
        </div>

        <div className="landing-steps">
          {bridgeSteps.map((step) => (
            <article key={step.n} className="landing-step landing-reveal">
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <div className="landing-step-connector" />
            </article>
          ))}
        </div>

        <div className="landing-trust-row landing-reveal">
          <div><Wifi size={18} /><span>LOCAL WI-FI LINK</span></div>
          <div><RadioTower size={18} /><span>WEBSOCKET INPUT</span></div>
          <div><Bluetooth size={18} /><span>DEVICE-FRIENDLY UI</span></div>
          <div><BatteryCharging size={18} /><span>PHONE-FIRST POWER USE</span></div>
          <div><Globe2 size={18} /><span>WEB-BASED CLIENT</span></div>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-glow" aria-hidden="true" />
        <div className="landing-final-content landing-reveal">
          <span className="landing-eyebrow"><Sparkles size={14} /> TOUCHTOSTEER</span>
          <h2>Stop reaching for the keyboard.</h2>
          <p>
            Open the virtual controller, connect the bridge and put a complete control surface
            in the device already in your hand.
          </p>
          <Link to="/controller" className="landing-primary-cta landing-primary-cta-large">
            Get started with TouchToSteer
            <ArrowUpRight size={21} />
          </Link>
          <Link to="/setup" className="landing-text-link">
            Need the PC setup guide? <Trophy size={14} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span>TOUCHTOSTEER</span>
        <span>VIRTUAL CONTROLLER / 2026</span>
        <span>GAMEPAD • WHEEL • MOUSE</span>
      </footer>
    </main>
  );
}
