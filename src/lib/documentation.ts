export const REPOSITORY = "https://github.com/arivuwallet-sketch/touch-to-steer";
export const SUPPORT_URL = `${REPOSITORY}/issues`;
export const RELEASES_URL = `${REPOSITORY}/releases/tag/bridge-latest`;
export const ANDROID_URL =
  "https://drive.google.com/file/d/1b39QZPejykCCSY8rpcs3cBsu6IqdfjRF/view?usp=sharing";
import { type DocId } from "./documentation-navigation";
export { docNavigation, type DocId } from "./documentation-navigation";
export type DocSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: string[];
  items?: string[];
  links?: { label: string; href: string }[];
  table?: { headers: string[]; rows: string[][] };
};
export type DocPage = { title: string; description: string; intro: string; sections: DocSection[] };
const link = (label: string, href: string) => ({ label, href });
export const documentation: Record<DocId, DocPage> = {
  privacy: {
    title: "Privacy policy",
    description:
      "How TouchToSteer handles controller input, local settings, game detection, diagnostics and remote connections.",
    intro:
      "Understand what stays on your device, what reaches your PC, and what third-party services may receive. Updated 27 September 2026.",
    sections: [
      {
        id: "scope",
        title: "Who this policy covers",
        paragraphs: [
          "This policy describes the TouchToSteer website and the Windows bridge maintained through the arivuwallet-sketch GitHub project. The project support channel is linked below. A separately distributed app wrapper, download provider or hosting service may also have its own privacy terms.",
          "The controller workflow does not require a TouchToSteer account. This policy describes the implemented product; it does not claim that hosting providers collect no technical logs.",
        ],
        links: [link("Contact the project maintainers", SUPPORT_URL)],
      },
      {
        id: "data",
        title: "Information used by the controller",
        table: {
          headers: ["Information", "Purpose and destination"],
          rows: [
            [
              "Buttons, sticks, pedals, steering and mouse commands",
              "Sent to the PC bridge you choose so it can operate virtual controllers or the PC mouse.",
            ],
            [
              "Phone orientation",
              "Used when motion/gyro control is enabled. The app converts readings to control values; browser permission may be required.",
            ],
            [
              "Foreground window title and process name",
              "Read by the Windows bridge and sent to connected clients to display the active game and choose mappings. A foreground title can also identify a non-game window.",
            ],
            [
              "Game telemetry and rumble",
              "Supported games provide values such as RPM, speed, gear and motor intensity. The bridge sends these to connected clients for display and feedback.",
            ],
            [
              "Connection metadata",
              "Your host, website provider and optional tunnel service can receive network metadata, including IP addresses and connection times.",
            ],
          ],
        },
      },
      {
        id: "storage",
        title: "Settings, pairing keys and local storage",
        paragraphs: [
          "Controller preferences, mappings, selected bridge address, custom layouts and migration flags are stored in browser localStorage on your device. They persist until you change them or clear this site’s data. They are not a cross-device account backup.",
          "The remote pairing key is held in memory during entry and connection; the app does not deliberately save it in localStorage or put it in the URL. It is sent in the WebSocket handshake. The host and any proxy that terminates TLS can process that handshake. Share it only with invited players.",
          "The controller settings use local storage rather than requiring a login cookie. Hosting platforms and linked services may have separate cookie or logging behavior.",
        ],
      },
      {
        id: "audio",
        title: "Audio-based haptics",
        paragraphs: [
          "On Windows, the optional adaptive-haptics helper analyzes the system playback mix locally to estimate vibration events when native game rumble is unavailable. Other playing audio can affect its output. The helper is not a phone microphone feature.",
          "The shipped helper processes audio samples for haptic classification; it does not implement uploading or saving raw audio recordings. To disable this fallback, set TTS_ADAPTIVE_HAPTICS=0 before starting the bridge. Turning vibration off in the app stops its haptic output; stop or configure the PC bridge to stop the analyzer itself.",
        ],
      },
      {
        id: "diagnostics",
        title: "Diagnostics and third parties",
        paragraphs: [
          "The Windows bridge writes a local diagnostic log under the operating system’s temporary TouchToSteer folder. It can include startup information, controller sessions and errors. Logs are not automatically attached to support requests.",
          "The website includes optional Lovable reporting hooks. When the host supplies those hooks, error details, stacks and the current route can be forwarded to Lovable. Preview and production hosting configurations can differ.",
          "Fonts are requested from Google Fonts. GitHub hosts releases and public support issues; the Android download link points to Google Drive. If you use internet play, your chosen tunnel provider processes that connection. These services have their own privacy policies.",
        ],
        links: [
          link(
            "Google Fonts privacy information",
            "https://developers.google.com/fonts/faq/privacy",
          ),
          link("Google privacy policy", "https://policies.google.com/privacy"),
          link(
            "GitHub privacy statement",
            "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
          ),
          link("Lovable privacy policy", "https://lovable.dev/privacy"),
          link("Cloudflare privacy policy", "https://www.cloudflare.com/privacypolicy/"),
        ],
      },
      {
        id: "choices",
        title: "Your controls and retention",
        items: [
          "Disconnect the phone and stop the bridge to end controller and foreground-window communication. Revoke motion permissions in your browser/device settings if desired.",
          "Clear this website’s stored data to remove local preferences and saved layouts. This also resets custom mappings and connection preferences.",
          "After stopping the bridge, you can delete its local temporary log. The app does not specify an automatic log-retention schedule; operating-system cleanup may remove temporary files.",
          "Restart the global launcher to rotate its temporary pairing key. Do not expose a LAN bridge without authentication.",
          "Information you post to GitHub Issues is public and follows GitHub’s retention and removal processes. Provider logs follow each provider’s own policies.",
        ],
        paragraphs: [
          "For questions about access, correction or deletion of information you supplied to the project, contact the maintainers through the support channel. Describe the request without posting private data; ask how to continue privately before sharing identifying documents or secrets. No private support mailbox is currently published here.",
        ],
      },
      {
        id: "updates",
        title: "Changes to this policy",
        paragraphs: [
          "When product data handling changes, this page should be updated with a new revision date. Revisit it after major app or bridge updates. For current provider-specific processing and any privacy rights available in your location, consult the linked provider policies and contact the project through Support.",
        ],
        links: [link("Support and privacy questions", "/support")],
      },
    ],
  },
  legal: {
    title: "Legal & licensing information",
    description:
      "TouchToSteer source licensing status, third-party software, trademarks and compatibility limitations.",
    intro:
      "Clear attribution and practical boundaries for using, modifying and distributing TouchToSteer. Reviewed 27 September 2026.",
    sections: [
      {
        id: "project",
        title: "Project and source-code licence",
        paragraphs: [
          "TouchToSteer is maintained through the arivuwallet-sketch/touch-to-steer repository. The website identifies its founder as Sooraj. No registered company identity, postal address or project-wide source licence is specified in this repository.",
          "At this revision, the repository does not contain a project-wide LICENSE file. Public availability is not a blanket permission to redistribute, relicense or use the project commercially. Ask the maintainers for permission or a published licence before relying on those rights. This information page does not assign a new licence to the project or its contributors’ work.",
        ],
        links: [
          link("Project repository", REPOSITORY),
          link("Licensing enquiries", `${SUPPORT_URL}/new?title=Licensing%20enquiry`),
          link(
            "GitHub: licensing a repository",
            "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository",
          ),
        ],
      },
      {
        id: "third-party",
        title: "Third-party software and notices",
        paragraphs: [
          "Third-party components keep their own licences. Their terms are separate from the licence status of TouchToSteer itself. Preserve the applicable notices and check the exact versions included in any source or binary you redistribute. The following is an overview, not a complete transitive-dependency or binary-distribution audit.",
        ],
        table: {
          headers: ["Component family", "Licence / reference"],
          rows: [
            [
              "React, React DOM, TanStack, Radix UI, Three.js, React Three Fiber/Drei, Tailwind CSS, Zod and many other web dependencies",
              "MIT, according to their package metadata; consult each package’s included licence.",
            ],
            ["class-variance-authority", "Apache-2.0, according to package metadata."],
            ["lucide-react", "ISC, according to package metadata."],
            [
              "Windows bridge: ws, vigemclient and ViGEm client/driver components",
              "Consult each package and the matching upstream release notices. The ViGEmBus repository publishes BSD-3-Clause terms; historical releases can differ.",
            ],
            [
              "Desktop wrapper, Android wrapper and bundled runtime components",
              "Their frameworks, runtime binaries and generated packages have additional notices. Refer to the specific distributed archive.",
            ],
            [
              "Chakra Petch and Rajdhani fonts",
              "Distributed through Google Fonts; consult the font-family licence included by its publisher.",
            ],
          ],
        },
        links: [
          link("Web dependency manifest", `${REPOSITORY}/blob/main/package.json`),
          link("Bridge dependency manifest", `${REPOSITORY}/blob/main/public/bridge/package.json`),
          link("ViGEmBus licence", "https://github.com/nefarius/ViGEmBus/blob/master/LICENSE"),
          link(
            "ViGEmClient licence",
            "https://github.com/nefarius/ViGEmClient/blob/master/LICENSE",
          ),
          link("Google Fonts licensing FAQ", "https://developers.google.com/fonts/faq"),
        ],
      },
      {
        id: "trademarks",
        title: "Names, compatibility and affiliation",
        paragraphs: [
          "Xbox, PlayStation, DualShock, Logitech, Flydigi, Windows, Android, Apple and game titles belong to their respective owners. References describe input compatibility or design inspiration; they do not indicate sponsorship, certification or endorsement.",
          "Touchscreen ForceFlex and ForceAdapt are software response and feedback features. They do not turn a phone into a physical force-feedback wheel, Hall-effect sensor or motorized adaptive trigger.",
        ],
      },
      {
        id: "use",
        title: "Responsible use and limitations",
        items: [
          "Use the bridge only on PCs you own or are authorized to control. Remote pairing grants real input control to the host.",
          "Follow game rules, anti-cheat policies and platform terms. Compatibility does not imply approval for competitive play or automation.",
          "1000 Hz is a software scheduling target, not a guaranteed 1 ms network or end-to-end gaming latency.",
          "XInput permits up to four controllers. Additional HID sessions depend on the driver and game; a 16-session bridge setting is not a promise of 16-player support in every title.",
          "Downloads, drivers and hardware behavior vary by version. Review the release notes and test controls before playing.",
        ],
        paragraphs: [
          "This page provides project information, not a negotiated licence agreement, legal advice or a waiver of any mandatory rights. Contact the maintainers for permission requests, attribution corrections or reports involving project content.",
        ],
        links: [link("Contact support", "/support"), link("Privacy policy", "/privacy")],
      },
    ],
  },
  downloads: {
    title: "Downloads",
    description:
      "Windows bridge, Windows desktop wrapper, Android APK and browser access for TouchToSteer.",
    intro:
      "Choose the package for your device. The Windows bridge is what creates the virtual controller on your PC.",
    sections: [
      {
        id: "windows",
        title: "Windows PC — bridge required",
        paragraphs: [
          "Use Windows 10/11 on a supported x64 PC. The portable bridge can install the bundled ViGEmBus driver when needed; Windows may request administrator approval for that installation. The packaged bridge does not require Node.js or developer build tools.",
          "Recommended: download the ZIP, extract it, and keep its setup guides and helper scripts together. Close an older bridge before starting the updated executable. These links point to the project’s verified bridge-latest release assets; read that release’s notes for its actual build version.",
        ],
        links: [
          link(
            "Download Windows bridge ZIP",
            `${REPOSITORY}/releases/download/bridge-latest/TouchToSteer-Bridge-Windows.zip`,
          ),
          link(
            "Download standalone bridge EXE",
            `${REPOSITORY}/releases/download/bridge-latest/TouchToSteer-Bridge.exe`,
          ),
          link("View release notes and assets", RELEASES_URL),
        ],
      },
      {
        id: "desktop",
        title: "Optional Windows desktop interface",
        paragraphs: [
          "The desktop archive wraps the TouchToSteer website in a desktop window. It is separate from the bridge and does not replace the virtual-controller driver. If you already use the phone browser interface, this wrapper is optional.",
        ],
        links: [
          link(
            "Download Windows desktop ZIP",
            `${REPOSITORY}/releases/download/bridge-latest/TouchToSteer.Spectral.Control.System-win32-x64.zip`,
          ),
        ],
      },
      {
        id: "phone",
        title: "Phone browser and Android APK",
        paragraphs: [
          "The browser controller is the quickest way to use the current website. Open it on your phone, switch to landscape when prompted, and connect to the PC bridge. Gyro and vibration availability vary by browser and device.",
          "The existing Android APK link is hosted on Google Drive rather than in the verified GitHub release assets above. Check its displayed version and source before installing; the current release inventory does not provide a verified APK signature or checksum here. No App Store or Play Store listing is claimed on this page.",
        ],
        links: [
          link("Open browser controller", "/controller"),
          link("Open Android APK download on Google Drive", ANDROID_URL),
        ],
      },
      {
        id: "install",
        title: "After downloading",
        steps: [
          "Extract the bridge ZIP and run TouchToSteer-Bridge.exe. Complete any required driver installation, then restart the bridge if prompted.",
          "Follow the local-network tutorial or the authenticated internet-play tutorial. Do not publish an unauthenticated LAN endpoint.",
          "Update the website/app and bridge together when adding transport, mapping or pairing features. A source commit may be newer than the latest packaged release.",
          "Check controller inputs in Windows with joy.cpl before adjusting a game’s bindings.",
        ],
        links: [
          link("Step-by-step tutorials", "/tutorials"),
          link("Connection troubleshooting", "/troubleshooting"),
          link("Source repository", REPOSITORY),
        ],
      },
    ],
  },
  troubleshooting: {
    title: "Troubleshooting",
    description:
      "Fix connection, controller detection, wrong mappings, steering, telemetry and vibration problems.",
    intro:
      "Start with the failing layer: phone connection, Windows controller, then the game. Change one setting at a time.",
    sections: [
      {
        id: "connect",
        title: "The phone cannot connect",
        steps: [
          "Confirm the bridge is running and read the address it prints. Do not enter 127.0.0.1 on the phone to reach a different PC.",
          "For LAN play, put both devices on the same trusted network. Guest Wi-Fi/client isolation, a VPN or a PC address change can prevent access. Allow the bridge through Windows Firewall on the appropriate private network; do not turn off the entire firewall.",
          "A secure HTTPS page may be prevented from opening an insecure ws:// connection. If your browser blocks it, use the authenticated wss:// tunnel workflow rather than disabling browser protection.",
          "For internet play, check the full wss:// hostname and pairing key. Restarting Start-Global.ps1 changes the temporary address/key. Confirm cloudflared and the bridge are both running.",
          "If the host reports capacity reached, disconnect unused phones or select DS4/HID for extra sessions only when the game supports it.",
        ],
        links: [
          link("Internet pairing tutorial", "/tutorials#internet"),
          link("Download the updated bridge", "/downloads"),
        ],
      },
      {
        id: "device",
        title: "Connected, but the game receives no input",
        steps: [
          "Press Win+R on the PC, run joy.cpl, and inspect the virtual controller’s properties. If inputs move here, the phone-to-driver path is working.",
          "If no device appears, finish the driver installation, close duplicate bridges and restart. Reboot if the driver installer requests it.",
          "Select XInput for games expecting Xbox input. Use DS4/HID for a compatible HID game. Universal creates both types and can cause duplicate input in games that listen to both.",
          "Connect before launching the game. Check its controller option, active player slot and any Steam Input/remapping layer. Keyboard-only games may need their own mapper.",
        ],
      },
      {
        id: "mapping",
        title: "GAS triggers nitro or buttons perform the wrong action",
        paragraphs: [
          "First check the detected game and active profile in Settings. Asphalt’s automatic-acceleration profile deliberately disables GAS/RT, maps wheel NITRO to A/Cross, and handbrake to X/Square. Select manual acceleration in TouchToSteer only if that mode is enabled inside the game.",
          "Reset that game’s saved override if an earlier custom mapping is still active. Match in-game bindings and Steam Input to the intended outputs. Unknown games use standard or saved bindings; process detection cannot read arbitrary in-game remaps.",
        ],
        links: [link("Asphalt and other game setup", "/game-setup")],
      },
      {
        id: "steering",
        title: "Steering feels stuck, slow or does not centre",
        items: [
          "Check Auto-centre, steering mode, sensitivity, rotation range and deadzone. Touch mode returns after release when Auto-centre is enabled; tilt mode follows device orientation.",
          "In Asphalt, disable TouchDrive for direct steering. Automatic acceleration and TouchDrive are separate game settings.",
          "Try Restore original layout if a custom control overlaps another or is hard to reach. The wheel and its internal controls move as one unit.",
          "Test one phone at a time and keep the browser in the foreground. Changing modes or hiding the page releases held inputs.",
          "ForceFlex presets differ during partial stick travel. Every preset still reaches the same full output at the edge; the gf labels are software presets, not physical spring force.",
        ],
      },
      {
        id: "telemetry",
        title: "Speed/RPM says NO SIGNAL or SCALE UNAVAILABLE",
        paragraphs: [
          "Controller input and telemetry are separate paths. A working controller does not prove that the game is sending telemetry. Enable the game’s supported UDP/Data Out format and point it at the PC running the bridge, not the phone. Match the receiver port.",
          "The bridge does not invent RPM or speed. No packet, an unsupported format, or expired telemetry leaves the gauge unavailable. OutGauge supplies RPM without a redline, so its numeric reading can work while its dial scale is unavailable. Asphalt currently has no telemetry decoder in this bridge.",
        ],
        links: [link("Telemetry ports and format caveats", "/game-setup#telemetry")],
      },
      {
        id: "haptics",
        title: "Vibration is missing or feels different",
        items: [
          "Enable vibration in Settings and ensure the game has controller rumble enabled. Browser/device support can limit or block vibration.",
          "Independent strong/weak motor control requires compatible hardware. The phone fallback uses pulse patterns; it cannot independently drive two motors or create physical trigger resistance.",
          "The 3D trigger animation respects reduced-motion preferences. Turning vibration off stops queued effects.",
          "If unrelated PC audio causes feedback, disable the audio fallback with TTS_ADAPTIVE_HAPTICS=0 and restart the bridge.",
        ],
      },
      {
        id: "latency",
        title: "Latency is higher than the selected rate",
        paragraphs: [
          "1000 Hz requests a 1 ms scheduler interval. It is not a measurement of the whole input path. Browser throttling, Wi-Fi congestion, internet routing, frame time and driver processing still affect response. The latency display is based on bridge acknowledgements, not camera-measured button-to-screen delay.",
          "Try a lower polling setting if your phone struggles at 1000 Hz, keep the app visible, avoid power-saving modes during the test, and compare a local connection with internet play. The app suppresses unchanged snapshots, so an idle controller will not send 1000 packets per second.",
        ],
      },
      {
        id: "report",
        title: "Still stuck? Send a reproducible report",
        paragraphs: [
          "Include the phone/browser, Windows version, game and launcher, bridge release, output mode, exact symptom and steps to reproduce. The local bridge log is in the temporary TouchToSteer folder. Remove personal window titles, addresses and secrets before sharing any log or screenshot.",
        ],
        links: [link("Open support instructions", "/support")],
      },
    ],
  },
  tutorials: {
    title: "Tutorials",
    description:
      "Learn local pairing, internet play, steering, mappings, custom layouts and telemetry.",
    intro:
      "Guided workflows from your first connection to a personalized controller. Start with local pairing before testing remote play.",
    sections: [
      {
        id: "first-connection",
        title: "1. Connect your phone to a Windows PC",
        steps: [
          "Download and extract the Windows bridge. Run the executable and complete the virtual-controller driver setup.",
          "Open TouchToSteer on the phone and enter the controller. Use landscape orientation when prompted.",
          "On a trusted local network, enter the PC address shown by the bridge in Settings and press Connect. If the browser blocks ws:// from HTTPS, use the secure tunnel steps below.",
          "Choose XInput or DS4/HID to match the game. Open joy.cpl on Windows and verify button/stick movement before launching the game.",
        ],
        links: [link("Get the bridge", "/downloads"), link("Existing PC setup guide", "/setup")],
      },
      {
        id: "internet",
        title: "2. Pair over the internet",
        steps: [
          "Extract the current bridge ZIP with Start-Global.ps1 beside the executable. Install Cloudflare’s cloudflared from its official distribution if it is not installed.",
          "Run Start-Global.ps1 in PowerShell. It generates a random pairing key, starts the local bridge in authenticated mode and starts a temporary outbound tunnel.",
          "Share the displayed key privately with invited players. On each phone, replace https:// in the tunnel hostname with wss://, enter it in Settings, enter the pairing key and connect.",
          "Stop the launcher to end access. Restart to rotate its temporary key and hostname. For a persistent hostname, follow the named-tunnel instructions in the host guide.",
        ],
        paragraphs: [
          "This sends controller input; it does not stream the game screen or add online multiplayer to a game. XInput remains limited to four controllers per PC. Additional DS4/HID sessions need driver and game support. Remote mouse injection is disabled by the global launcher. Quick Tunnels are a testing convenience, not a production uptime guarantee.",
        ],
        links: [
          link("Detailed global-host guide", "/bridge/windows/GLOBAL-PLAY.md"),
          link("Cloudflare Tunnel setup", "https://developers.cloudflare.com/tunnel/get-started/"),
        ],
      },
      {
        id: "steer",
        title: "3. Set up steering and pedals",
        steps: [
          "Switch to steering mode. In Settings choose touch or tilt; grant motion access if the browser asks.",
          "Start with a modest rotation range and sensitivity. Verify left/right direction and full lock in the game’s controller settings.",
          "Enable Auto-centre for release-to-centre in touch mode. Steering tension shapes the software response near centre; it does not add motorized resistance.",
          "Match GAS, brake, nitro and handbrake outputs to the game profile. In Asphalt, disable TouchDrive for direct steering and choose the correct acceleration preset.",
        ],
      },
      {
        id: "profiles",
        title: "4. Save bindings for a game",
        steps: [
          "Bring the game to the foreground and check its name and profile in TouchToSteer Settings.",
          "Keep Automatic game profiles enabled to use the included Asphalt or NFS Heat preset. Other titles start from standard bindings.",
          "Change Wheel action bindings or Gamepad bindings while the game is detected. Overrides are saved for that game on this device and restored when it returns.",
          "Use Restore detected game’s profile to remove its overrides. Disable automatic profiles when you want global manual bindings instead.",
        ],
        links: [link("Game-specific setup", "/game-setup")],
      },
      {
        id: "layouts",
        title: "5. Build your own control layout",
        steps: [
          "Open Settings → Custom layout editor and choose gamepad or steering. Input is released and gameplay writes are blocked while editing.",
          "Drag a labeled control box, use its lower-right resize handle, or type exact percentage values. Use Snap to grid for alignment.",
          "Use the control list to select hidden items, toggle visibility, or swap position/size with another control. Undo reverses recent edits.",
          "Save to apply the layout on this device. Cancel discards the draft. Restore original layout removes that mode’s custom overrides.",
        ],
        paragraphs: [
          "The steering wheel and its built-in buttons form one unit. External pedals, nitro, handbrake and telemetry can be arranged separately. Layouts do not change the control actions or polling setting.",
        ],
        links: [link("Layout reference", "/bridge/windows/CUSTOM-LAYOUTS.md")],
      },
      {
        id: "feedback",
        title: "6. Tune sticks, triggers and feedback",
        paragraphs: [
          "Use the ForceFlex button to cycle 30/50/80/100 gf response presets. Test at half travel to feel the difference; all presets reach full output at the edge. These are software response weights.",
          "ForceAdapt cycles regular, race, sniper, recoil, vibration and lock profiles on LT/RT. Touch position controls travel: top is full, bottom is zero. Vibration and 3D cues depend on Settings and device support.",
          "1000 Hz is the default send-scheduling target for both controller modes. Lower rates remain available. Do not confuse this target with measured network latency.",
        ],
        links: [
          link("Response and telemetry reference", "/bridge/windows/RESPONSE-AND-TELEMETRY.md"),
        ],
      },
    ],
  },
  "game-setup": {
    title: "Game-specific setup",
    description:
      "Asphalt Legends, NFS Heat and supported telemetry-family configuration for TouchToSteer.",
    intro:
      "Automatic mappings and live telemetry are separate features. A recognized game does not guarantee that its telemetry format is supported.",
    sections: [
      {
        id: "asphalt",
        title: "Asphalt Legends / Legends Unite",
        steps: [
          "Launch the game and bring its window to the foreground. Confirm the Asphalt profile appears in Settings.",
          "For direct wheel steering, disable TouchDrive inside the game.",
          "With automatic acceleration, keep the default Asphalt acceleration preset: GAS/RT is inactive because the game accelerates for you. Nitro uses A/Cross; wheel handbrake uses X/Square and brake/drift uses LT/L2.",
          "Only select Manual acceleration in the app if you have also enabled the corresponding game setting. That preset sends GAS on RT/R2. The app cannot read or change the game’s internal acceleration setting.",
          "If your version or platform uses different bindings, save a per-game override and check Steam Input. Test nitro and drift separately before racing.",
        ],
        paragraphs: [
          "Both gamepad and steering use the detected profile. Clutch, gear-shift and horn wheel actions are disabled in the built-in Asphalt preset. No Asphalt RPM/speed decoder is currently implemented, so unavailable telemetry is expected.",
        ],
      },
      {
        id: "heat",
        title: "Need for Speed Heat",
        paragraphs: [
          "The included preset targets default PC/Xbox-style controls: RT/R2 accelerates, LT/L2 brakes, A/Cross activates nitrous and X/Square is handbrake. Manual gear shifts use RB/R1 and LB/L1; enable manual transmission in the game.",
          "Select one controller output to avoid duplicate devices. If you changed the game’s controls, save matching overrides. The NFS Heat mapping preset does not include a native Heat telemetry decoder.",
        ],
        links: [
          link(
            "EA’s PC control manual",
            "https://www.ea.com/able/resources/need-for-speed/need-for-speed-heat/pc/text-manual",
          ),
        ],
      },
      {
        id: "telemetry",
        title: "Telemetry-family setup",
        paragraphs: [
          "Point the game’s UDP destination at the PC running the bridge. Use a matching port and format, enable output, and allow the relevant UDP traffic on the trusted network. These are the receiver defaults in this bridge; game menus and packet formats vary by release. A supported family name is not certification of every game version.",
        ],
        table: {
          headers: ["Game / protocol family", "Receiver defaults", "Setup and limits"],
          rows: [
            [
              "Forza Data Out",
              "UDP 5300, 5301 or 9876",
              "Enable Data Out and select a supported packet format. The parser recognizes specific packet sizes; unsupported variants will not show genuine telemetry.",
            ],
            [
              "EA F1 / Codemasters",
              "UDP 20777",
              "Enable UDP output and match the installed bridge’s packet format. Parser versions differ; changing the port alone cannot make an unsupported schema compatible.",
            ],
            [
              "DiRT Rally compatible UDP",
              "UDP 20778",
              "Enable compatible UDP output in the game/configuration. Check packet format as well as the destination port.",
            ],
            [
              "Project CARS 2 / Automobilista 2 compatible UDP",
              "UDP 5606",
              "Enable a compatible Project CARS-style UDP format. Other versions/formats may need a decoder update.",
            ],
            [
              "OutGauge, including compatible LFS/BeamNG integrations",
              "UDP 4444, 30000 or 63392",
              "Enable OutGauge and select one receiver port. RPM can be live without a redline; the dial then reports SCALE UNAVAILABLE.",
            ],
            [
              "WRC / Wreckfest 2 and other schemas",
              "Version-dependent",
              "Do not assume support from a configured port. The current bridge explicitly leaves unsupported schemas without fabricated values.",
            ],
          ],
        },
        links: [
          link(
            "Current bridge parser source",
            `${REPOSITORY}/blob/main/public/bridge/rig-bridge.js`,
          ),
          link("Telemetry troubleshooting", "/troubleshooting#telemetry"),
        ],
      },
      {
        id: "other-games",
        title: "Every other game: standard or saved controls",
        steps: [
          "Choose the output type your game accepts. XInput is common for Xbox-style input; DS4/HID requires compatible game support.",
          "Check the Windows virtual controller first, then bind controls in the game. Avoid running multiple remapping layers without testing them.",
          "With automatic profiles enabled, customize the detected game’s wheel and gamepad outputs in Settings. Those overrides are restored on this device when the game is detected again.",
          "If the game only accepts keyboard/mouse input, controller detection alone will not add gamepad support. Use the game’s own supported input options or a separately configured mapper.",
        ],
        paragraphs: [
          "Titles, executable names, mods, cloud-streaming clients and launchers can affect foreground detection. Unknown games are not assigned an Asphalt preset or labeled verified. Report the executable name and launcher if detection is incorrect.",
        ],
        links: [
          link("Report a mapping or detection issue", "/support"),
          link("Profile reference", "/bridge/windows/GAME-PROFILES.md"),
        ],
      },
    ],
  },
  support: {
    title: "Contact support",
    description:
      "Reach TouchToSteer maintainers, report bugs and ask setup, privacy or licensing questions.",
    intro:
      "The published support channel is the project’s GitHub Issues page, maintained through the arivuwallet-sketch account.",
    sections: [
      {
        id: "contact",
        title: "Visible support contact",
        paragraphs: [
          "Support address: github.com/arivuwallet-sketch/touch-to-steer/issues",
          "Use this channel for setup questions, reproducible bugs, compatibility requests, privacy enquiries and licensing questions. A GitHub account is required to post. No support email address, telephone number, private mailbox or response-time guarantee is currently published by the project.",
        ],
        links: [
          link(
            "Open a support request",
            `${SUPPORT_URL}/new?title=TouchToSteer%20support%20request`,
          ),
          link("Search existing issues", SUPPORT_URL),
          link("Maintainer GitHub profile", "https://github.com/arivuwallet-sketch"),
        ],
      },
      {
        id: "include",
        title: "What to include",
        items: [
          "Phone model, operating system and browser/app version.",
          "Windows version, bridge release/build and local or internet connection.",
          "Game name, version, launcher and selected XInput/DS4/Universal mode.",
          "Steps to reproduce, expected behavior and what actually happened.",
          "Whether the problem also occurs in Windows joy.cpl.",
          "A short redacted screenshot or log excerpt, if useful. Mention recent mapping/layout changes.",
        ],
        links: [
          link("Troubleshoot before reporting", "/troubleshooting"),
          link("Get the current release", "/downloads"),
        ],
      },
      {
        id: "private",
        title: "Keep private information out of public issues",
        paragraphs: [
          "GitHub Issues are public. Never post a pairing key, credentials, personal documents, unredacted foreground-window titles or a full diagnostic log containing private details. For a privacy or security concern, post only a minimal request asking the maintainer how to continue privately. Do not include exploit details or secrets in that initial request.",
          "If you have exposed a pairing key, stop the global launcher and restart it to rotate the key before continuing. For personal data already posted on GitHub, use GitHub’s available editing/removal and support processes.",
        ],
        links: [
          link("Privacy policy", "/privacy"),
          link("GitHub support", "https://support.github.com/"),
        ],
      },
    ],
  },
};
