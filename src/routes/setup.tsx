import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Check, Download, Gamepad2, Gauge, Mouse, RadioTower, ShieldCheck, Wifi } from "lucide-react";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "PC Setup — Mobile Rig Virtual Controller" },
      {
        name: "description",
        content:
          "Step-by-step guide to pair your phone's virtual wheel and joystick with any PC game using the Mobile Rig bridge.",
      },
      { property: "og:title", content: "PC Setup — Mobile Rig" },
      {
        property: "og:description",
        content: "Install the bridge, start it, and your phone appears as a low-latency virtual game controller in Windows.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Setup,
});

const steps = [
  {
    t: "1. Download the Windows bridge",
    d: "Download the packaged TouchToSteer bridge below. It already contains its own Node.js runtime and native bridge dependencies, so you do not need Node.js, npm, Git, Git Bash, Visual Studio, or C++ build tools on the gaming PC.",
  },
  {
    t: "2. Run TouchToSteer-Bridge.exe",
    d: "Double-click the EXE. The first run checks for ViGEmBus. When it is missing, the bridge launches the bundled official installer and restarts automatically after setup.",
  },
  {
    t: "3. Allow Windows administrator access",
    d: "Windows may show a UAC prompt for the virtual-controller driver. Approve it. This is the only driver installation required for XInput/Xbox 360 or DS4 virtual output.",
  },
  {
    t: "4. Connect the phone",
    d: "Put the phone and PC on the same Wi-Fi. The bridge window prints one or more ws://<PC-IP>:8787 addresses. Enter the matching address in the phone Settings panel and tap Connect.",
  },
  {
    t: "5. Play",
    d: "The phone now appears to Windows as a virtual game controller. Switch between joystick and steering-wheel modes from the phone without changing the PC setup.",
  },
  {
    t: "6. Optional: enable native game telemetry",
    d: "Point the game's built-in telemetry/Data Out feature at the PC IP and its supported UDP port listed below. The phone gauges remain -- / NO SIGNAL until genuine game packets arrive.",
  },
  {
    t: "7. Live driving data",
    d: "Steering mode can display live speed, RPM and gear from supported native telemetry. No speed or RPM simulation is generated.",
  },
];

function Setup() {
  return (
    <main className="spectral-setup-page">
      <div className="spectral-setup-noise" aria-hidden="true" />
      <div className="spectral-setup-vignette" aria-hidden="true" />

      <header className="spectral-setup-nav">
        <Link to="/" className="spectral-setup-brand">
          <span className="spectral-setup-brand-mark"><RadioTower size={15} /></span>
          TOUCHTOSTEER
          <span className="spectral-setup-brand-sep">/</span>
          PC SETUP
        </Link>
        <Link to="/controller" className="spectral-setup-back">
          <ArrowDownLeft size={13} /> BACK TO CONTROLLER
        </Link>
      </header>

      <section className="spectral-setup-hero">
        <div className="spectral-setup-hero-copy">
          <span className="spectral-setup-kicker">04 / WINDOWS BRIDGE INITIALIZATION</span>
          <h1>Connect the<br /><em>signal.</em></h1>
          <p>
            TouchToSteer uses a small packaged Windows receiver to turn phone touch,
            motion and telemetry into real PC controller and mouse input.
          </p>

          <div className="spectral-setup-hero-actions">
            <a
              href="https://github.com/arivuwallet-sketch/touch-to-steer/releases/latest/download/TouchToSteer-Bridge.exe"
              className="spectral-setup-primary"
              target="_blank"
              rel="noreferrer"
            >
              <Download size={15} /> DOWNLOAD WINDOWS BRIDGE
              <ArrowUpRight size={14} />
            </a>
            <a
              href="https://github.com/nefarius/ViGEmBus/releases/latest"
              className="spectral-setup-secondary"
              target="_blank"
              rel="noreferrer"
            >
              DRIVER FALLBACK
            </a>
          </div>
        </div>

        <div className="spectral-setup-signal-card">
          <div className="spectral-setup-signal-grid" />
          <div className="spectral-setup-signal-ring signal-ring-one" />
          <div className="spectral-setup-signal-ring signal-ring-two" />
          <div className="spectral-setup-signal-core">
            <span>RECEIVER</span>
            <strong>READY</strong>
            <small>PHONE → PC</small>
          </div>
          <div className="spectral-setup-signal-readout">
            <span><i /> WEBSOCKET</span>
            <span><i /> LOCAL WI-FI</span>
            <span><i /> XINPUT / DS4 / HID</span>
            <span><i /> MOUSE INJECTION</span>
          </div>
        </div>
      </section>

      <section className="spectral-setup-status-row">
        <div><span>01</span><strong>DOWNLOAD</strong><small>Packaged Windows receiver</small></div>
        <div><span>02</span><strong>INSTALL</strong><small>ViGEmBus on first launch</small></div>
        <div><span>03</span><strong>CONNECT</strong><small>Same Wi-Fi network</small></div>
        <div><span>04</span><strong>PLAY</strong><small>Gamepad / Steering / Mouse</small></div>
      </section>

      <section className="spectral-setup-section">
        <div className="spectral-setup-section-head">
          <div>
            <span>01 / RECEIVER SEQUENCE</span>
            <h2>One clean path to control.</h2>
          </div>
          <p>
            The bridge is the PC-side receiver. Run it once, copy its WebSocket address into
            the phone settings, and the controller surfaces stay connected through the same transport.
          </p>
        </div>

        <div className="spectral-setup-step-grid">
          {steps.map((s, index) => (
            <article key={s.t} className="spectral-setup-step">
              <div className="spectral-setup-step-code">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Check size={12} />
              </div>
              <h3>{s.t.replace(/^\d+\.\s*/, "")}</h3>
              <p>{s.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="spectral-setup-section spectral-setup-dark">
        <div className="spectral-setup-section-head">
          <div>
            <span>02 / CONTROL OUTPUT</span>
            <h2>Three surfaces. One receiver.</h2>
          </div>
          <p>Choose the control surface on the phone. The same bridge receives the resulting state and routes it to Windows.</p>
        </div>

        <div className="spectral-setup-output-grid">
          <article><Gamepad2 size={18} /><span>GAMEPAD</span><strong>XInput / DS4 / HID</strong><p>D-pad, ABXY, sticks, triggers, Turbo, gyro aim and adaptive response.</p></article>
          <article><Gauge size={18} /><span>STEERING</span><strong>WHEEL / TELEMETRY</strong><p>Touch or gyro steering, pedals, handbrake, nitro, gears and native telemetry.</p></article>
          <article><Mouse size={18} /><span>MOUSE</span><strong>NATIVE WINDOWS INPUT</strong><p>Real cursor movement, buttons, wheel, DPI scaling, gyro aim and tracking.</p></article>
        </div>
      </section>

      <section className="spectral-setup-section">
        <div className="spectral-setup-section-head">
          <div>
            <span>03 / NATIVE TELEMETRY</span>
            <h2>Supported signal sources.</h2>
          </div>
          <p>Telemetry remains grounded in actual packets. Unsupported or absent data stays NO SIGNAL instead of being invented.</p>
        </div>

        <div className="spectral-setup-telemetry-grid">
          <article><strong>FORZA</strong><span>UDP 5300 / 5301 / 9876</span><p>Horizon 4/5/6 and Motorsport 7/2023 Data Out. Auto-detects supported packet sizes.</p></article>
          <article><strong>EA F1</strong><span>UDP 20777</span><p>F1 2018 through F1 25 / 2026 Season Pack telemetry.</p></article>
          <article><strong>DiRT</strong><span>UDP 20778 / 20777</span><p>DiRT Rally, DiRT Rally 2.0 and DiRT 4 UDP telemetry.</p></article>
          <article><strong>SMS / AMS2</strong><span>UDP 5606</span><p>Project CARS 2, Automobilista 2 and KartKraft physics telemetry.</p></article>
          <article><strong>OUTGAUGE</strong><span>UDP 4444 / 30000 / 63392</span><p>BeamNG.drive / Live for Speed speed, RPM and gear data.</p></article>
          <article><strong>WRC / WRECKFEST 2</strong><span>PACKET-DEPENDENT</span><p>Unsupported schemas remain NO SIGNAL until a compatible decoder is available.</p></article>
        </div>
      </section>

      <section className="spectral-setup-section spectral-setup-dark">
        <div className="spectral-setup-utility">
          <div className="spectral-setup-utility-icon"><ShieldCheck size={18} /></div>
          <div>
            <span>04 / CONTROL INTEGRITY</span>
            <h2>Designed to fail cleanly.</h2>
            <p>
              Controller state is released on blur, page hide and mode changes. Network, browser,
              driver and game polling determine final end-to-end latency; the site does not claim a fixed latency figure.
            </p>
          </div>
          <div className="spectral-setup-utility-metrics">
            <span><Wifi size={13} /> SAME LAN</span>
            <span><RadioTower size={13} /> WEBSOCKET</span>
            <span>3 MS POLLING TARGET</span>
          </div>
        </div>
      </section>

      <footer className="spectral-setup-footer">
        <span>TOUCHTOSTEER / SPECTRAL CONTROL SYSTEM</span>
        <span>FOUNDER / SOORAJ</span>
        <span>2026</span>
      </footer>
    </main>
  );
}
