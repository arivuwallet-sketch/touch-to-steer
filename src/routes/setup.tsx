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
    t: "1. Install the driver",
    d: "On the PC, install the ViGEmBus virtual gamepad driver. The original project is retired, but its final Windows 10/11 installer is still available from the official Nefarius GitHub releases page.",
  },
  {
    t: "2. Install Node.js",
    d: "Grab Node.js 18 or newer from nodejs.org and finish the installer with the default options.",
  },
  {
    t: "3. Get the bridge",
    d: "Download rig-bridge.js below into an empty folder, open that folder in a terminal, and run: npm init -y && npm i ws vigemclient",
  },
  {
    t: "4. Start it",
    d: "Run: node rig-bridge.js — it prints the address it is listening on. Allow it through the Windows firewall on private networks.",
  },
  {
    t: "5. Pair the phone",
    d: "Phone and PC must be on the same Wi-Fi. On the phone, open Setup and enter ws://<PC-IP>:8787, then tap Connect.",
  },
  {
    t: "6. Play",
    d: "Your phone now shows up as an Xbox controller. Any game with controller support picks it up automatically — steering on the left stick, gas and brake on the triggers.",
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
        A web page can't reach a game on its own, so a tiny helper runs on the PC and turns what your
        phone sends into a genuine virtual gamepad. Set it up once; after that it's just tap and play.
      </p>

      <ol className="mt-6 space-y-3">
        {steps.map((s) => (
          <li key={s.t} className="panel p-4">
            <h2 className="text-base font-bold">{s.t}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>

      <a
        href="https://github.com/nefarius/ViGEmBus/releases/latest"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white hover:bg-white/10"
      >
        Install ViGEmBus
      </a>

      <button
        type="button"
        onClick={async () => {
          try {
            const response = await fetch("/bridge/rig-bridge.js", { cache: "no-store" });
            if (!response.ok) throw new Error("Bridge file unavailable");
            const source = await response.text();
            if (!source.includes("Mobile Rig -> PC low-latency bridge")) {
              throw new Error("Bridge file content was not returned");
            }

            const blob = new Blob([source], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "rig-bridge.js";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch {
            window.open("/bridge/rig-bridge.js", "_blank", "noopener,noreferrer");
          }
        }}
        className="mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground glow"
        style={{ background: "var(--gradient-primary)" }}
      >
        Download rig-bridge.js
      </button>

      <div className="panel mt-6 p-4">
        <h2 className="text-base font-bold">Compatibility</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          XInput is the default PC output and a DualShock 4 virtual output is available for games that expect PlayStation-style input. Custom keyboard bindings are still controlled by the game or a separate input mapper. No browser controller can guarantee a fixed 3 ms end-to-end latency or support every anti-cheat/protected input path; network, device refresh, browser scheduling, driver, and game polling all affect the final result.
        </p>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Games that only read keyboard input can still work: pair the virtual pad with a key-mapping
        tool such as Steam Input or reWASD. On macOS and Linux the bridge runs in echo mode only,
        since the virtual-pad driver is Windows-only.
      </p>
    </main>
  );
}
