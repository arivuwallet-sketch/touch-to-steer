import { createFileRoute, Link } from "@tanstack/react-router";

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
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <Link to="/" className="text-xs font-semibold uppercase tracking-widest text-primary">
        ← Back to controller
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Connect to your PC</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        A web page cannot create a Windows XInput/DS4 device by itself, so TouchToSteer uses a small
        packaged Windows bridge. Download it once and run it on the PC — no developer toolchain is
        required on the gaming computer.
      </p>

      <ol className="mt-6 space-y-3">
        {steps.map((s) => (
          <li key={s.t} className="panel p-4">
            <h2 className="text-base font-bold">{s.t}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="https://github.com/arivuwallet-sketch/touch-to-steer/releases/download/bridge-latest/TouchToSteer-Bridge.exe"
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground glow"
          style={{ background: "var(--gradient-primary)" }}
        >
          Download Windows Bridge (.exe)
        </a>
        <a
          href="https://github.com/nefarius/ViGEmBus/releases/latest"
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white hover:bg-white/10"
        >
          Driver fallback
        </a>
      </div>

      <div className="panel mt-4 p-4">
        <h2 className="text-base font-bold">One-click Windows setup</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The Windows bridge package is built automatically from this project. It contains the bridge
          executable plus the official ViGEmBus installer used on first launch, so the gaming PC does
          not need Node.js or a C++ compiler.
        </p>
      </div>

      <div className="panel mt-6 p-4">
        <h2 className="text-base font-bold">Native telemetry supported</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">Forza:</strong> Horizon 4/5/6 and Motorsport 7/2023 Data Out. The bridge auto-detects the 232, 311, 324 and 331-byte formats and listens on UDP 5300, 5301 and 9876.</p>
          <p><strong className="text-foreground">EA F1:</strong> F1 2018 through F1 25 / 2026 Season Pack telemetry on UDP 20777.</p>
          <p><strong className="text-foreground">DiRT:</strong> DiRT Rally / DiRT Rally 2.0 / DiRT 4 full UDP telemetry on UDP 20778; the same parser is also checked on 20777.</p>
          <p><strong className="text-foreground">Project CARS 2 / Automobilista 2 / KartKraft:</strong> SMS UDP physics telemetry on UDP 5606.</p>
          <p><strong className="text-foreground">BeamNG.drive / Live for Speed:</strong> OutGauge UDP on UDP 4444, 30000 or 63392. Speed, RPM and gear are native; OutGauge does not provide a native redline value.</p>
          <p><strong className="text-foreground">EA SPORTS WRC:</strong> native UDP telemetry is configurable by the game's packet-structure system. The bridge does not guess its schema, so it stays NO SIGNAL until a compatible structure/decoder is configured.</p>
          <p><strong className="text-foreground">Wreckfest 2:</strong> native UDP telemetry is available on port 23123, but its Pino packet is not decoded yet. No fake values are shown.</p>
        </div>
      </div>

      <div className="panel mt-6 p-4">
        <h2 className="text-base font-bold">Live telemetry</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The steering dashboard does not invent speed or RPM. The PC bridge parses the game's
          telemetry packets and immediately forwards the newest values to the phone. Forza Data Out
          and EA F1 UDP telemetry are supported by the bridge; other games need a compatible
          telemetry adapter because every game exposes its data differently.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Do not run another application on the same UDP port. Games that send UDP telemetry can
          usually be forwarded by SimHub to another free port when another telemetry application
          already owns the game's default port.
        </p>
      </div>

      <div className="panel mt-6 p-4">
        <h2 className="text-base font-bold">Compatibility</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          XInput is the default PC output and a DualShock 4 virtual output is available for games that expect PlayStation-style input. Custom keyboard bindings are still controlled by the game or a separate input mapper. No browser controller can guarantee a fixed 3 ms end-to-end latency or support every anti-cheat/protected input path; network, device refresh, browser scheduling, driver, and game polling all affect the final result.
        </p>
      </div>

      <div className="panel mt-6 p-4">
        <h2 className="text-base font-bold">Developer build (optional)</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Developers can still run the raw rig-bridge.js with Node.js and npm, but that path is no
          longer required for normal users. The downloadable Windows EXE is the intended end-user
          setup.
        </p>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Games that only read keyboard input can still work with Steam Input or a separate key-mapping
        tool. The packaged virtual-controller path is Windows-only because XInput/DS4 emulation uses
        the Windows virtual gamepad driver.
      </p>
    </main>
  );
}
