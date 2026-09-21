/**
 * Mobile Rig -> PC low-latency bridge
 * ----------------------------------
 * Receives the newest phone controller state and feeds synchronized virtual
 * controller targets. Universal mode exposes Xbox/XInput plus a HID/DirectInput
 * fallback so modern and legacy PC games can use the interface they support.
 * Set RIG_OUTPUT=xinput or RIG_OUTPUT=ds4 to expose one target only.
 *
 *   npm init -y && npm i ws vigemclient
 *   node rig-bridge.js
 *
 * Environment:
 *   RIG_PORT=8787
 *   RIG_OUTPUT=xinput | ds4 | universal
 *   RIG_FORZA_PORT=5300   (Forza Data Out UDP)
 *   RIG_F1_PORT=20777     (EA F1 UDP telemetry)
 *
 * The transport is deliberately simple WebSocket for broad browser support.
 * The bridge uses TCP_NODELAY and manual ViGEm updates so each state packet
 * becomes one consolidated driver report rather than several intermediate ones.
 */

const PORT = Number(process.env.RIG_PORT || 8787);
const FORZA_PORTS = String(process.env.RIG_FORZA_PORTS || "5300,5301,9876")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v) && v > 0 && v < 65536);
const F1_PORT = Number(process.env.RIG_F1_PORT || 20777);
const DIRT_PORT = Number(process.env.RIG_DIRT_PORT || 20778);
const WRC_PORT = Number(process.env.RIG_WRC_PORT || 20789);
const PCARS_PORT = Number(process.env.RIG_PCARS_PORT || 5606);
const OUTGAUGE_PORTS = String(process.env.RIG_OUTGAUGE_PORTS || "4444,30000,63392")
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v) && v > 0 && v < 65536);
const WRECKFEST2_PORT = Number(process.env.RIG_WRECKFEST2_PORT || 23123);
const OUTPUT = String(process.env.RIG_OUTPUT || "universal").toLowerCase();
const dgram = require("node:dgram");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { WebSocketServer } = require("ws");
const BRIDGE_LOG_DIR = path.join(os.tmpdir(), "TouchToSteer");
const BRIDGE_LOG_FILE = path.join(BRIDGE_LOG_DIR, "bridge.log");

function appendBridgeLog(message) {
  try {
    fs.mkdirSync(BRIDGE_LOG_DIR, { recursive: true });
    fs.appendFileSync(
      BRIDGE_LOG_FILE,
      "[" + new Date().toISOString() + "] " + String(message) + "\n",
    );
  } catch {
    /* logging must never interfere with the bridge */
  }
}

appendBridgeLog(
  "Starting TouchToSteer Bridge; packaged=" +
  (typeof process.pkg !== "undefined") +
  "; node=" + process.version +
  "; platform=" + process.platform +
  "; arch=" + process.arch,
);

process.on("uncaughtException", (error) => {
  appendBridgeLog("UNCAUGHT EXCEPTION: " + (error?.stack || error));
  console.error("TouchToSteer Bridge fatal error:", error?.stack || error);
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason) => {
  appendBridgeLog("UNHANDLED REJECTION: " + (reason?.stack || reason));
  console.error("TouchToSteer Bridge unhandled rejection:", reason?.stack || reason);
});

const DRIVER_FILE = "ViGEmBus_1.22.0_x64_x86_arm64.exe";
const DRIVER_URL =
  "https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe";

const SKIP_DRIVER_INSTALL = /^(1|true|yes)$/i.test(
  String(process.env.TOUCHTOSTEER_SKIP_DRIVER_INSTALL || ""),
);

function loadPackagedNativeViGEmAddon() {
  const Module = require("node:module");
  const nativeSource = path.join(
    __dirname,
    "node_modules",
    "vigemclient",
    "build",
    "Release",
    "vigemclient.node",
  );
  const clientDllSource = path.join(
    __dirname,
    "node_modules",
    "vigemclient",
    "build",
    "Release",
    "ViGEmClient.dll",
  );

  if (!fs.existsSync(nativeSource)) {
    throw new Error("Bundled vigemclient.node was not found inside the packaged bridge.");
  }
  if (!fs.existsSync(clientDllSource)) {
    throw new Error(
      "Bundled ViGEmClient.dll was not found inside the packaged bridge.",
    );
  }

  // Windows resolves a native addon's dependent DLLs from its filesystem
  // location. pkg extracts the .node addon for dlopen(), so place the matching
  // ViGEmClient.dll beside it before loading the addon.
  const outDir = path.join(os.tmpdir(), "TouchToSteer", "vigem");
  const outFile = path.join(outDir, "vigemclient.node");
  const clientDllFile = path.join(outDir, "ViGEmClient.dll");
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outFile, fs.readFileSync(nativeSource));
  fs.writeFileSync(clientDllFile, fs.readFileSync(clientDllSource));

  appendBridgeLog(
    "Extracting packaged ViGEm native addon and dependent ViGEmClient.dll to " +
    outDir,
  );

  const parent = module;
  const nativeModule = new Module(outFile, parent);
  process.dlopen(nativeModule, outFile);
  return nativeModule.exports;
}

function loadViGEmClient() {
  if (!isPackagedBridge()) {
    const clientModule = require("vigemclient");
    appendBridgeLog("ViGEm native addon loaded in development mode.");
    return clientModule;
  }

  // node-ViGEmClient's JavaScript wrapper requires its .node addon through a
  // relative path. pkg bundles that addon into its snapshot, but Windows'
  // native loader needs a real filesystem path. Extract it to %TEMP% and
  // intercept only that one relative native-addon request while loading the
  // wrapper. All other require() calls behave normally.
  const Module = require("node:module");
  const originalLoad = Module._load;
  const nativeExports = { value: null };
  const nativeRequest = "/build/Release/vigemclient";

  Module._load = function(request, parent, isMain) {
    if (String(request).replace(/\\/g, "/").endsWith(nativeRequest)) {
      if (!nativeExports.value) nativeExports.value = loadPackagedNativeViGEmAddon();
      return nativeExports.value;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const clientModule = require("vigemclient");
    appendBridgeLog("ViGEm native addon loaded from packaged filesystem extraction.");
    return clientModule;
  } finally {
    Module._load = originalLoad;
  }
}

function isPackagedBridge() {
  return typeof process.pkg !== "undefined";
}

function localIpv4Addresses() {
  const result = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) result.push(entry.address);
    }
  }
  return [...new Set(result)];
}

function bundledDriverPath() {
  const candidate = path.join(__dirname, "drivers", DRIVER_FILE);
  return fs.existsSync(candidate) ? candidate : null;
}

function restartPackagedBridge() {
  try {
    const child = spawn(process.execPath, process.argv.slice(1), {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: process.env,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

let mouseInjector = null;

function findMouseInjector() {
  const packaged = path.join(__dirname, "native", "mouse-injector.exe");
  if (isPackagedBridge()) return packaged;
  const local = path.join(__dirname, "native", "mouse-injector.exe");
  return fs.existsSync(local) ? local : null;
}

function preparePackagedMouseInjector() {
  const source = findMouseInjector();
  if (!source) return null;
  if (!isPackagedBridge()) return source;

  const outDir = path.join(os.tmpdir(), "TouchToSteer");
  const outFile = path.join(outDir, "mouse-injector.exe");
  try {
    fs.mkdirSync(outDir, { recursive: true });
    if (!fs.existsSync(outFile)) {
      fs.writeFileSync(outFile, fs.readFileSync(source));
    }
    return outFile;
  } catch (err) {
    console.warn("Could not unpack mouse injector:", err.message);
    return null;
  }
}

function startMouseInjector() {
  if (mouseInjector && !mouseInjector.killed) return mouseInjector;
  if (process.platform !== "win32") return null;

  const executable = preparePackagedMouseInjector();
  if (!executable) return null;

  try {
    mouseInjector = spawn(executable, [], {
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: false,
    });
    mouseInjector.on("error", (err) => {
      console.warn("Mouse injector error:", err.message);
      mouseInjector = null;
    });
    mouseInjector.stderr?.on("data", (chunk) => {
      const text = String(chunk).trim();
      if (text) console.warn("Mouse injector:", text);
    });
    mouseInjector.on("close", () => {
      mouseInjector = null;
    });
    return mouseInjector;
  } catch {
    mouseInjector = null;
    return null;
  }
}

function sendMouseNative(message) {
  const proc = startMouseInjector();
  if (!proc?.stdin || proc.stdin.destroyed) return false;

  try {
    switch (message.action) {
      case "move": {
        const dx = Math.trunc(clamp(message.dx, -32767, 32767));
        const dy = Math.trunc(clamp(message.dy, -32767, 32767));
        if (dx || dy) proc.stdin.write(`MOVE ${dx} ${dy}\n`);
        break;
      }
      case "button": {
        const allowed = new Set(["left", "right", "middle", "back", "forward"]);
        if (!allowed.has(message.button)) return false;
        proc.stdin.write(`BUTTON ${message.button} ${message.down ? "DOWN" : "UP"}\n`);
        break;
      }
      case "wheel": {
        const delta = Math.trunc(clamp(message.delta, -32768, 32768));
        if (delta) proc.stdin.write(`WHEEL ${delta}\n`);
        break;
      }
      case "reset":
        proc.stdin.write("RESET\n");
        break;
      case "center":
        proc.stdin.write("CENTER\n");
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

function installBundledDriverAndRestart() {
  const source = bundledDriverPath();
  if (!source) return false;

  const installDir = path.join(os.tmpdir(), "TouchToSteer");
  const installer = path.join(installDir, DRIVER_FILE);

  try {
    fs.mkdirSync(installDir, { recursive: true });
    // pkg keeps bundled assets in its virtual filesystem, so read/write the
    // installer instead of asking the OS to copy directly from the snapshot.
    fs.writeFileSync(installer, fs.readFileSync(source));
  } catch (err) {
    console.error("Could not unpack the bundled ViGEmBus installer:", err.message);
    return false;
  }

  console.log("");
  console.log("ViGEmBus is not installed or is unavailable.");
  console.log("Launching the bundled official ViGEmBus installer.");
  console.log("Approve the Windows administrator prompt. The bridge will restart after setup.");
  console.log("");

  const result = spawnSync(installer, [], {
    stdio: "inherit",
    windowsHide: false,
  });

  if (result.error) {
    console.error("Could not launch ViGEmBus setup:", result.error.message);
    return false;
  }

  const successCodes = new Set([0, 1641, 3010]);
  if (!successCodes.has(result.status)) {
    console.error(
      `ViGEmBus setup exited with code ${String(result.status)}. Start TouchToSteer again after completing the driver installation.`,
    );
    return false;
  }

  console.log("ViGEmBus setup completed. Restarting TouchToSteer Bridge...");
  if (!restartPackagedBridge()) {
    console.log("Please start TouchToSteer-Bridge.exe again.");
  }
  return true;
}

let client = null;
const DEFAULT_OUTPUT = OUTPUT === "ds4" ? "ds4" : "universal";
const MAX_CONTROLLER_SESSIONS = 4;
const ackState = new WeakMap();
const socketState = new WeakMap();
const controllerSessions = new Set();

// Keep one XInput target alive while the bridge is running. This makes the
// virtual Xbox controller visible in joy.cpl immediately instead of waiting
// for a phone packet. The first phone session reuses this target when it asks
// for XInput or Universal mode.
let standbyXInputTarget = null;

function queryViGEmBusService() {
  if (process.platform !== "win32") {
    return { installed: false, running: false, raw: "" };
  }

  try {
    const result = spawnSync("sc.exe", ["query", "ViGEmBus"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
    const installed =
      result.status === 0 || /SERVICE_NAME:\s*ViGEmBus/i.test(raw);
    const running = /STATE\s*:\s*\d+\s+RUNNING/i.test(raw);
    return { installed, running, raw };
  } catch {
    return { installed: false, running: false, raw: "" };
  }
}

function startViGEmBusService() {
  if (process.platform !== "win32") return false;

  try {
    const result = spawnSync("sc.exe", ["start", "ViGEmBus"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return (
      result.status === 0 ||
      /START_PENDING|RUNNING|already been started/i.test(
        `${result.stdout || ""}\n${result.stderr || ""}`,
      )
    );
  } catch {
    return false;
  }
}

function connectViGEmClient() {
  const ViGEmClient = loadViGEmClient();
  const service = queryViGEmBusService();

  if (service.installed && !service.running) {
    console.log("ViGEmBus is installed but not running; attempting to start the service...");
    startViGEmBusService();
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const candidate = new ViGEmClient();
      const error = candidate.connect();
      if (!error) return { client: candidate, error: null };
      lastError = error;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 5) {
      const retryService = queryViGEmBusService();
      if (retryService.installed && !retryService.running) {
        startViGEmBusService();
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }

  return {
    client: null,
    error: lastError,
    service: queryViGEmBusService(),
  };
}

let vigemConnectionError = null;

function ensureViGEmClient() {
  if (client) return true;

  try {
    const connection = connectViGEmClient();
    if (!connection.client) {
      vigemConnectionError =
        connection.error || new Error("ViGEmBus connection failed");
      appendBridgeLog(
        "ViGEm recovery connect failed: " +
        (vigemConnectionError?.message || String(vigemConnectionError)),
      );
      return false;
    }

    client = connection.client;
    vigemConnectionError = null;
    appendBridgeLog("ViGEm client recovered.");
    return true;
  } catch (error) {
    vigemConnectionError = error;
    appendBridgeLog("ViGEm recovery exception: " + (error?.stack || error));
    return false;
  }
}

function disconnectTarget(target) {
  if (!target) return;

  try {
    target.resetInputs();
    target.update();
  } catch {
    /* ignore */
  }

  try {
    target.disconnect();
  } catch {
    /* ignore */
  }
}

function createTarget(type) {
  if (!client) return null;

  try {
    const target =
      type === "ds4"
        ? client.createDS4Controller()
        : client.createX360Controller();

    target.updateMode = "manual";

    const connectError = target.connect();
    if (connectError) {
      throw new Error(
        `ViGEm ${type === "ds4" ? "DualShock 4 / HID" : "Xbox 360 / XInput"} target connect failed: ${connectError?.message || String(connectError)}`,
      );
    }

    let attached = false;
    try {
      attached = Boolean(target.attached);
    } catch {
      attached = true;
    }

    target.resetInputs();
    const updateError = target.update();
    if (updateError) {
      appendBridgeLog(
        `Initial ${type} controller update returned: ${updateError.message || updateError}`,
      );
    }

    let userIndex = "n/a";
    if (type === "xinput") {
      try {
        userIndex = String(target.userIndex);
      } catch {
        userIndex = "pending";
      }
    }

    const name =
      type === "ds4" ? "DualShock 4 / HID" : "Controller (Xbox 360 For Windows)";

    console.log(
      `Virtual ${name} target added (attached=${attached}, userIndex=${userIndex}).`,
    );
    appendBridgeLog(
      `Virtual ${name} target added (attached=${attached}, userIndex=${userIndex}).`,
    );

    return target;
  } catch (err) {
    const message = err?.message || String(err);
    console.warn(
      `Unable to create ${type === "ds4" ? "DualShock 4 / HID" : "Xbox 360 / XInput"} virtual controller:`,
      message,
    );
    appendBridgeLog(
      `Unable to create ${type === "ds4" ? "DualShock 4 / HID" : "Xbox 360 / XInput"} virtual controller: ${message}`,
    );
    return null;
  }
}

try {
  const connection = connectViGEmClient();
  if (!connection.client) {
    throw connection.error || new Error("ViGEmBus connection failed");
  }

  client = connection.client;
  vigemConnectionError = null;

  // Default XInput target stays visible for Windows controller diagnostics.
  // It is handed to the first phone session when XInput/Universal is selected.
  standbyXInputTarget = createTarget("xinput");
  appendBridgeLog(
    `ViGEm client connected; standby XInput target ready=${Boolean(standbyXInputTarget)}.`,
  );
} catch (err) {
  const message = err?.message || String(err);
  const service = queryViGEmBusService();

  vigemConnectionError = err;
  appendBridgeLog(
    "ViGEm startup failure: " +
      message +
      " | serviceInstalled=" +
      service.installed +
      " | serviceRunning=" +
      service.running,
  );
  console.warn("ViGEm unavailable - running in echo-only mode:", message);

  if (service.installed) {
    console.warn(
      `ViGEmBus is installed but the client could not connect (running=${service.running}).`,
    );
    console.warn(
      "Open Windows Device Manager and verify 'Nefarius Virtual Gamepad Emulation Bus'.",
    );
    console.warn(
      "The bridge will not reinstall ViGEmBus because an installation was detected.",
    );
  } else if (
    !SKIP_DRIVER_INSTALL &&
    isPackagedBridge() &&
    installBundledDriverAndRestart()
  ) {
    process.exit(0);
  }
}

console.log("");
console.log("TouchToSteer Bridge ready.");
appendBridgeLog("TouchToSteer Bridge ready.");
const addresses = localIpv4Addresses();
if (addresses.length) {
  console.log("Phone WebSocket address(es):");
  for (const address of addresses) console.log(`  ws://${address}:${PORT}`);
} else {
  console.log(`Phone WebSocket address: ws://<PC-IP>:${PORT}`);
}
console.log(
  `Default virtual controller target: ${DEFAULT_OUTPUT === "universal" ? "Universal (Xbox 360/XInput + DirectInput/HID)" : "DualShock 4/HID"}`,
);
console.log(
  `Virtual controller sessions: up to ${MAX_CONTROLLER_SESSIONS} independent players`,
);
console.log(`Driver package source: ${isPackagedBridge() ? "bundled with this executable" : DRIVER_URL}`);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

const XBTN = {
  a: "A", b: "B", x: "X", y: "Y",
  cross: "A", circle: "B", square: "X", triangle: "Y",
  l1: "LEFT_SHOULDER", r1: "RIGHT_SHOULDER",
  l3: "LEFT_THUMB", r3: "RIGHT_THUMB",
  share: "BACK", options: "START", ps: "GUIDE",
  enter: "A", plus: "START", minus: "BACK", dial_press: "A",
  start: "START", back: "BACK", home: "GUIDE",
  lb: "LEFT_SHOULDER", rb: "RIGHT_SHOULDER",
  select: "BACK", m1: "LEFT_SHOULDER", m2: "RIGHT_SHOULDER",
  m3: "LEFT_THUMB", m4: "RIGHT_THUMB", m5: "BACK", m6: "START",
  __horn: "LEFT_THUMB", __look: "RIGHT_THUMB", __reset: "Y",
  __handbrake: "A", __nitro: "LEFT_SHOULDER",
  __gearUp: "RIGHT_SHOULDER", __gearDown: "LEFT_SHOULDER",
};

const DSBTN = {
  cross: "CROSS", circle: "CIRCLE", square: "SQUARE", triangle: "TRIANGLE",
  l1: "SHOULDER_LEFT", r1: "SHOULDER_RIGHT",
  l3: "THUMB_LEFT", r3: "THUMB_RIGHT",
  share: "SHARE", options: "OPTIONS", ps: "SPECIAL_PS",
  dial_press: "SPECIAL_TOUCHPAD",
  a: "CROSS", b: "CIRCLE", x: "SQUARE", y: "TRIANGLE",
  lb: "SHOULDER_LEFT", rb: "SHOULDER_RIGHT",
  start: "OPTIONS", back: "SHARE", home: "SPECIAL_PS", select: "SHARE",
  m1: "SHOULDER_LEFT", m2: "SHOULDER_RIGHT",
  m3: "THUMB_LEFT", m4: "THUMB_RIGHT", m5: "SHARE", m6: "OPTIONS",
  __horn: "THUMB_LEFT", __look: "THUMB_RIGHT", __reset: "TRIANGLE",
  __handbrake: "CROSS", __nitro: "SHOULDER_LEFT",
  // DS4 exposes trigger buttons in addition to its analog trigger axes.
  // Setting both lets legacy DirectInput games that bind LT/RT as buttons
  // recognize the steering pedals while games that read the analog axis still
  // receive the full pedal position.
  __brakeTrigger: "TRIGGER_LEFT", __throttleTrigger: "TRIGGER_RIGHT",
  __gearUp: "SHOULDER_RIGHT", __gearDown: "SHOULDER_LEFT",
};

function setDpad(target, s) {
  if (!target) return;

  const buttons = s.buttons || {};
  let h = 0;
  let v = 0;
  if (buttons.dpad_left) h -= 1;
  if (buttons.dpad_right) h += 1;
  if (buttons.dpad_up) v += 1;
  if (buttons.dpad_down) v -= 1;

  target.axis.dpadHorz.setValue(h);
  target.axis.dpadVert.setValue(v);
}

function applyToTarget(target, s, buttonMap) {
  if (!target) return;

  const buttons = s.buttons || {};
  const held = {};
  const mark = (name) => {
    if (target.button[name]) held[name] = true;
  };

  const steer = clamp(s.steer, -1, 1);
  target.axis.leftX.setValue(
    Math.abs(steer) > 0.0005 ? steer : clamp(s.lx, -1, 1),
  );
  target.axis.leftY.setValue(-clamp(s.ly, -1, 1));
  target.axis.rightX.setValue(clamp(s.rx, -1, 1));
  target.axis.rightY.setValue(-clamp(s.ry, -1, 1));

  const brake = clamp(s.brake, 0, 1);
  const throttle = clamp(s.throttle, 0, 1);
  const clutch = clamp(s.clutch, 0, 1);
  const lt = clamp(s.lt, 0, 1);
  const rt = clamp(s.rt, 0, 1);

  // Always put steering pedals on the physical-style trigger axes. This is
  // the common representation used by XInput, DS4/HID compatibility layers,
  // and modern gamepad APIs. The aliases also keep LT/RT button bindings alive.
  target.axis.leftTrigger.setValue(
    Math.max(brake, clutch * 0.6, lt, buttons.l2 ? 1 : 0),
  );
  target.axis.rightTrigger.setValue(
    Math.max(throttle, rt, buttons.r2 ? 1 : 0),
  );

  for (const [id, name] of Object.entries(buttonMap)) {
    if (buttons[id]) mark(name);
  }

  setDpad(target, s);

  if (buttons.horn) mark(buttonMap.__horn);
  if (buttons.look) mark(buttonMap.__look);
  if (buttons.reset) mark(buttonMap.__reset);
  if (clamp(s.handbrake, 0, 1) > 0.5) mark(buttonMap.__handbrake);
  if (clamp(s.nitro, 0, 1) > 0.5) mark(buttonMap.__nitro);
  if (buttonMap.__brakeTrigger && brake > 0.02) mark(buttonMap.__brakeTrigger);
  if (buttonMap.__throttleTrigger && throttle > 0.02) mark(buttonMap.__throttleTrigger);
  if (s.gear === 1) mark(buttonMap.__gearUp);
  if (s.gear === -1) mark(buttonMap.__gearDown);

  for (const name of Object.keys(target.button)) {
    target.button[name].setValue(!!held[name]);
  }

  target.update();
}

function stateSignature(s) {
  const buttons = s.buttons || {};
  return [
    clamp(s.steer, -1, 1),
    clamp(s.lx, -1, 1),
    clamp(s.ly, -1, 1),
    clamp(s.rx, -1, 1),
    clamp(s.ry, -1, 1),
    clamp(s.brake, 0, 1),
    clamp(s.clutch, 0, 1),
    clamp(s.lt, 0, 1),
    clamp(s.throttle, 0, 1),
    clamp(s.rt, 0, 1),
    clamp(s.handbrake, 0, 1),
    clamp(s.nitro, 0, 1),
    Number(s.gear) || 0,
    Number(s.dial) || 0,
    Object.keys(buttons).filter((id) => buttons[id]).sort().join(","),
  ].join("|");
}

function applySessionState(session, s) {
  if (!session || !session.targets.length) return;

  const seq = Number(s?.seq);
  if (Number.isFinite(seq) && seq > 0 && seq <= session.lastAppliedSeq) {
    // A continuous state that was already superseded by a newer edge is stale.
    // Drop it rather than letting it resurrect an old button/pedal position.
    return;
  }

  const signature = stateSignature(s);
  if (signature === session.lastAppliedSignature) {
    if (Number.isFinite(seq) && seq > session.lastAppliedSeq) {
      session.lastAppliedSeq = seq;
    }
    return;
  }

  for (const entry of session.targets) {
    applyToTarget(entry.target, s, entry.map);
  }

  session.lastAppliedSignature = signature;
  if (Number.isFinite(seq) && seq > 0) {
    session.lastAppliedSeq = seq;
  }
}
const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: false,
});

let latestTelemetry = null;
let telemetrySeq = 0;
let f1RpmMax = null;

function broadcastTelemetry(data) {
  const telemetry = {
    type: "telemetry",
    seq: ++telemetrySeq,
    source: data.source,
    speed: Number.isFinite(data.speed) ? Math.max(0, data.speed) : undefined,
    rpm: Number.isFinite(data.rpm) ? Math.max(0, data.rpm) : undefined,
    rpmMax: Number.isFinite(data.rpmMax) && data.rpmMax > 0 ? data.rpmMax : undefined,
    gear: Number.isFinite(data.gear) ? Math.trunc(data.gear) : undefined,
    receivedAt: Date.now(),
  };

  latestTelemetry = telemetry;

  const packet = JSON.stringify(telemetry);
  for (const ws of wss.clients) {
    if (ws.readyState === 1 && ws.bufferedAmount < 16_384) {
      try {
        ws.send(packet);
      } catch {
        /* ignore a racing socket close */
      }
    }
  }
}

function validNumber(value, min = -Infinity, max = Infinity) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function parseForza(packet) {
  const sizes = new Set([232, 311, 324, 331]);
  if (!sizes.has(packet.length) || packet.readInt32LE(0) !== 1) return null;

  const rpmMax = packet.readFloatLE(8);
  const rpm = packet.readFloatLE(16);

  if (!validNumber(rpmMax, 500, 30000) || !validNumber(rpm, 0, 30000)) return null;

  const vx = packet.readFloatLE(32);
  const vy = packet.readFloatLE(36);
  const vz = packet.readFloatLE(40);
  let speed = Math.sqrt(vx * vx + vy * vy + vz * vz) * 3.6;

  let gear;
  let source = "Forza Data Out";

  if (packet.length === 311) {
    source = "Forza Motorsport 7 / legacy Dash";
    speed = packet.readFloatLE(244) * 3.6;
    gear = packet.readInt8(307);
  } else if (packet.length === 324) {
    source = "Forza Horizon 4 / 5 / 6";
    speed = packet.readFloatLE(256) * 3.6;
    gear = packet.readInt8(319);
  } else if (packet.length === 331) {
    source = "Forza Motorsport 2023";
    speed = packet.readFloatLE(244) * 3.6;
    gear = packet.readInt8(307);
  } else {
    source = "Forza Sled";
  }

  if (!validNumber(speed, 0, 600)) return null;

  return {
    source,
    speed,
    rpm,
    rpmMax,
    gear: typeof gear === "number" ? Math.max(-1, Math.min(20, gear)) : undefined,
  };
}

function parseProjectCars(packet) {
  if (packet.length < 568 || packet.readUInt8(10) !== 0) return null;

  const speed = packet.readFloatLE(48) * 3.6;
  const rpm = packet.readUInt16LE(52);
  const rpmMax = packet.readUInt16LE(54);
  const packedGear = packet.readUInt8(57);
  const rawGear = packedGear & 0x0f;
  const numGears = (packedGear >> 4) & 0x0f;
  const gear = rawGear === 0 ? -1 : rawGear === 1 ? 0 : rawGear - 1;

  if (
    !validNumber(speed, 0, 600) ||
    !validNumber(rpm, 0, 30000) ||
    !validNumber(rpmMax, 500, 30000)
  ) {
    return null;
  }

  return {
    source: numGears > 0 ? "Project CARS 2 / Automobilista 2 / KartKraft" : "Project CARS 2 compatible UDP",
    speed,
    rpm,
    rpmMax,
    gear,
  };
}

function parseOutGauge(packet) {
  if (packet.length !== 96 && packet.length !== 100) return null;

  const gearRaw = packet.readUInt8(10);
  const speed = packet.readFloatLE(12) * 3.6;
  const rpm = packet.readFloatLE(16);

  if (!validNumber(speed, 0, 600) || !validNumber(rpm, 0, 30000)) return null;

  const gear = gearRaw === 0 ? -1 : gearRaw === 1 ? 0 : gearRaw - 1;
  const car = packet.subarray(4, 8).toString("ascii").replace(/\0/g, "").trim();

  return {
    source: car ? "OutGauge • " + car : "OutGauge",
    speed,
    rpm,
    rpmMax: 10000,
    gear,
  };
}

function parseDirtRally(packet) {
  if (packet.length < 264) return null;

  const speed = packet.readFloatLE(28) * 3.6;
  const gearRaw = Math.round(packet.readFloatLE(132));
  const rpm = packet.readFloatLE(148) * 10;
  const rpmMax = packet.readFloatLE(252) * 10;

  if (
    !validNumber(speed, 0, 600) ||
    !validNumber(rpm, 0, 30000) ||
    !validNumber(rpmMax, 500, 30000) ||
    gearRaw < 0 ||
    gearRaw > 12
  ) {
    return null;
  }

  return {
    source: "DiRT Rally / DiRT Rally 2.0 / DiRT 4",
    speed,
    rpm,
    rpmMax,
    gear: gearRaw === 10 ? -1 : gearRaw,
  };
}


function parseF1(packet) {
  // F1 25 / 2026 Season Pack uses a 29-byte packed little-endian header.
  if (packet.length < 29) return null;

  const packetFormat = packet.readUInt16LE(0);
  const packetId = packet.readUInt8(6);
  const playerIndex = packet.readUInt8(27);

  // EA F1 telemetry packet 6 is CarTelemetry.
  if (packetId === 6) {
    const carSize = packet.length >= 1448 ? 59 : 60;
    const carOffset = 29 + playerIndex * carSize;
    if (carOffset + 18 > packet.length) return null;

    const speed = packet.readUInt16LE(carOffset);
    const gear = packet.readInt8(carOffset + 15);
    const rpm = packet.readUInt16LE(carOffset + 16);

    if (!Number.isFinite(speed) || !Number.isFinite(rpm)) return null;

    return {
      source: packetFormat >= 2025 ? "EA F1 25 / 2026" : `EA F1 ${packetFormat}`,
      speed,
      rpm,
      rpmMax: f1RpmMax,
      gear,
    };
  }

  // CarStatus is packet 7. Max RPM is the 18th byte of each packed
  // CarStatusData record (zero-based offset 17).
  if (packetId === 7) {
    const carCount = packet.length >= 1445 ? 24 : 22;
    const recordSize = packet.length >= 1445 ? 59 : 55;
    const carOffset = 29 + playerIndex * recordSize;
    if (carOffset + 19 > packet.length) return null;

    const rpmMax = packet.readUInt16LE(carOffset + 17);
    if (rpmMax > 0 && rpmMax < 100000) {
      f1RpmMax = rpmMax;
      if (latestTelemetry && latestTelemetry.source.startsWith("F1")) {
        broadcastTelemetry({
          ...latestTelemetry,
          rpmMax,
          source: latestTelemetry.source,
        });
      }
    }
  }

  return null;
}

function bindMany(ports, name, parser) {
  const sockets = [];
  for (const port of [...new Set(ports)]) {
    sockets.push(bindTelemetrySocket(port, name, parser));
  }
  return sockets;
}

function bindTelemetrySocket(port, name, parser) {
  const socket = dgram.createSocket("udp4");

  socket.on("message", (packet) => {
    try {
      const telemetry = parser(packet);
      if (telemetry) broadcastTelemetry(telemetry);
    } catch {
      /* ignore malformed game telemetry packets */
    }
  });

  socket.on("error", (err) => {
    console.warn(`${name} telemetry UDP error on ${port}:`, err.message);
  });

  socket.bind(port, "0.0.0.0", () => {
    console.log(`${name} telemetry listening on udp://0.0.0.0:${port}`);
  });

  return socket;
}

bindMany(FORZA_PORTS, "Forza", parseForza);
bindTelemetrySocket(F1_PORT, "F1 / Codemasters", (packet) => {
  return parseF1(packet) || parseDirtRally(packet);
});
bindTelemetrySocket(DIRT_PORT, "DiRT Rally", parseDirtRally);
bindTelemetrySocket(PCARS_PORT, "Project CARS 2 / AMS2", parseProjectCars);
bindMany(OUTGAUGE_PORTS, "OutGauge", parseOutGauge);

console.log(`Rig bridge listening on ws://0.0.0.0:${PORT}`);
console.log(
  `Default virtual controller target: ${DEFAULT_OUTPUT === "universal" ? "Universal (Xbox 360/XInput + HID/DirectInput)" : DEFAULT_OUTPUT === "ds4" ? "DualShock 4/HID" : "Xbox 360/XInput"}`,
);
console.log(`Native telemetry listeners: Forza [${FORZA_PORTS.join(", ")}], F1/Codemasters [${F1_PORT}], DiRT [${DIRT_PORT}], PCARS/AMS2 [${PCARS_PORT}], OutGauge [${OUTGAUGE_PORTS.join(", ")}]`);
console.log(`EA WRC is not guessed: its native packet structure is configurable. Default documented port is ${WRC_PORT}; use the included WRC structure/config instructions for its exact packet schema.`);
console.log(`Wreckfest 2 native telemetry is supported by the game on UDP ${WRECKFEST2_PORT}, but its Pino packet is not decoded by this bridge yet rather than showing fabricated values.`);
console.log("Live gauges use game telemetry only; no speed/RPM simulation is generated.");

wss.on("connection", (ws) => {
  const socket = ws._socket;
  if (socket?.setNoDelay) socket.setNoDelay(true);
  if (socket?.setKeepAlive) socket.setKeepAlive(true, 1000);

  const session = {
    ws,
    mode: DEFAULT_OUTPUT,
    targets: [],
    latestState: null,
    applyScheduled: false,
    lastAppliedSignature: "",
    lastAppliedSeq: 0,
  };

  socketState.set(ws, session);

  function scheduleApply() {
    if (session.applyScheduled) return;
    session.applyScheduled = true;
    setImmediate(flushApply);
  }

  function flushApply() {
    session.applyScheduled = false;

    const state = session.latestState;
    session.latestState = null;

    if (!state || !session.targets.length) return;

    try {
      applySessionState(session, state);
    } catch (err) {
      console.warn(
        "Failed to apply controller state:",
        err?.message || err,
      );
      appendBridgeLog("APPLY ERROR: " + (err?.stack || err));
    }

    if (session.latestState) scheduleApply();
  }

  function disconnectSessionTargets() {
    for (const entry of session.targets) {
      disconnectTarget(entry.target);
    }
    session.targets = [];
    session.latestState = null;
    session.applyScheduled = false;
    session.lastAppliedSignature = "";
    session.lastAppliedSeq = 0;
    controllerSessions.delete(session);
  }

  function createSessionTargets(requestedMode) {
    if (session.targets.length && session.mode === requestedMode) {
      return true;
    }

    disconnectSessionTargets();

    if (!ensureViGEmClient()) return false;

    if (controllerSessions.size >= MAX_CONTROLLER_SESSIONS) {
      return false;
    }

    const requestedTypes =
      requestedMode === "universal"
        ? ["xinput", "ds4"]
        : [requestedMode];

    // If a legacy-only DS4/HID session is requested, remove the diagnostic
    // XInput standby device so that games do not see an unintended extra pad.
    if (
      requestedMode === "ds4" &&
      standbyXInputTarget &&
      controllerSessions.size === 0
    ) {
      disconnectTarget(standbyXInputTarget);
      standbyXInputTarget = null;
      appendBridgeLog("Removed standby XInput target for DS4-only compatibility session.");
    }

    const created = [];

    // Reuse the always-visible XInput target for player 1. This both fixes
    // joy.cpl visibility and prevents unnecessary controller churn.
    if (
      requestedTypes.includes("xinput") &&
      standbyXInputTarget &&
      controllerSessions.size === 0
    ) {
      created.push({
        target: standbyXInputTarget,
        type: "xinput",
        map: XBTN,
      });
      standbyXInputTarget = null;
    }

    for (const type of requestedTypes) {
      if (created.some((entry) => entry.type === type)) continue;

      const target = createTarget(type);
      if (target) {
        created.push({
          target,
          type,
          map: type === "ds4" ? DSBTN : XBTN,
        });
        continue;
      }

      // Universal mode is deliberately best-effort. XInput is the primary
      // modern/co-op path; a DS4/HID compatibility target may be unavailable
      // on a particular Windows installation. Never tear down a working
      // XInput device just because the optional legacy target failed.
      if (requestedMode !== "universal") {
        for (const entry of created) disconnectTarget(entry.target);
        created.length = 0;
        return false;
      }

      appendBridgeLog(
        `Optional universal target unavailable: ${type}; keeping other targets active.`,
      );
    }

    if (!created.length) return false;

    session.mode = requestedMode;
    session.targets = created;
    session.lastAppliedSignature = "";
    session.lastAppliedSeq = 0;
    controllerSessions.add(session);
    appendBridgeLog(
      `Controller session ready: mode=${requestedMode}, targets=${created.map((entry) => entry.type).join("+")}, players=${controllerSessions.size}`,
    );
    return true;
  }

  function playerIndex() {
    const xinput = session.targets.find((entry) => entry.type === "xinput");
    if (!xinput) return null;

    try {
      const index = Number(xinput.target.userIndex);
      return Number.isInteger(index) &&
        index >= 0 &&
        index < MAX_CONTROLLER_SESSIONS
        ? index + 1
        : null;
    } catch {
      return null;
    }
  }

  console.log("Phone connected.");
  appendBridgeLog(
    `Phone connected; active players=${controllerSessions.size}`,
  );

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "hello") {
      const requestedRaw = String(
        msg.output || msg.controller || session.mode || DEFAULT_OUTPUT,
      ).toLowerCase();

      const requested =
        requestedRaw === "ds4"
          ? "ds4"
          : requestedRaw === "xinput"
            ? "xinput"
            : "universal";

      const connected = createSessionTargets(requested);
      const xinputTarget = session.targets.find(
        (entry) => entry.type === "xinput",
      );
      const ds4Target = session.targets.find(
        (entry) => entry.type === "ds4",
      );

      const names = [];
      if (xinputTarget) {
        names.push("Controller (Xbox 360 For Windows)");
      }
      if (ds4Target) names.push("Wireless Controller");

      try {
        ws.send(JSON.stringify({
          type: "ready",
          t: msg.t ?? Date.now(),
          seq: msg.seq ?? 0,
          output: session.mode,
          rateHz: Number(msg.rateHz) || 240,
          mouse: {
            supported: process.platform === "win32",
            injectorAvailable: Boolean(startMouseInjector()),
          },
          controller: {
            supported: process.platform === "win32",
            connected,
            type: session.mode,
            name: connected ? names.join(" + ") : null,
            xinput: Boolean(xinputTarget),
            directInputFallback: Boolean(ds4Target),
            player: playerIndex(),
            maxPlayers: MAX_CONTROLLER_SESSIONS,
            activePlayers: controllerSessions.size,
            error: connected
              ? null
              : controllerSessions.size >= MAX_CONTROLLER_SESSIONS
                ? `Maximum of ${MAX_CONTROLLER_SESSIONS} simultaneous controller players reached.`
                : "ViGEmBus virtual controller could not be created.",
          },
          telemetry: {
            forzaPorts: FORZA_PORTS,
            f1Port: F1_PORT,
            dirtPort: DIRT_PORT,
            pcarsPort: PCARS_PORT,
            outGaugePorts: OUTGAUGE_PORTS,
            wrcPort: WRC_PORT,
            wreckfest2Port: WRECKFEST2_PORT,
            live: Boolean(latestTelemetry),
          },
        }));
      } catch {
        /* ignore a racing socket close */
      }

      return;
    }

    if (msg.type === "mouse") {
      const ok = sendMouseNative(msg);
      if (msg.action !== "move" && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({
            type: "mouseAck",
            action: msg.action,
            ok,
          }));
        } catch {
          /* ignore a racing socket close */
        }
      }
      return;
    }

    if (msg.type === "state") {
      if (!session.targets.length) return;

      if (msg.priority === "edge") {
        try {
          // Digital edges bypass Claude's mailbox and update every target for
          // this player immediately.
          applySessionState(session, msg);
        } catch (err) {
          console.warn(
            "Failed to apply immediate controller edge:",
            err?.message || err,
          );
          appendBridgeLog("EDGE APPLY ERROR: " + (err?.stack || err));
        }
      } else {
        // Claude's latency fix, now per player: a single latest-value mailbox
        // means stale continuous states can never queue ahead of fresh input.
        session.latestState = msg;
        scheduleApply();
      }

      const now = Date.now();
      const previous = ackState.get(ws) || 0;
      if (now - previous >= 50) {
        ackState.set(ws, now);
        try {
          ws.send(JSON.stringify({
            type: "ack",
            t: msg.t,
            seq: msg.seq,
          }));
        } catch {
          /* ignore */
        }
      }
    }
  });

  ws.on("close", () => {
    ackState.delete(ws);
    session.latestState = null;
    disconnectSessionTargets();
    socketState.delete(ws);

    console.log(
      `Phone disconnected; active players=${controllerSessions.size}`,
    );
    appendBridgeLog(
      `Phone disconnected; active players=${controllerSessions.size}`,
    );
  });
});
