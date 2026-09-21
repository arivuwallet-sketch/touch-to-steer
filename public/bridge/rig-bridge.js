/**
 * Mobile Rig -> PC low-latency bridge
 * ----------------------------------
 * Receives the newest phone controller state and feeds a virtual XInput
 * controller by default. Set RIG_OUTPUT=ds4 before starting to expose a
 * DualShock 4-style virtual controller instead.
 *
 *   npm init -y && npm i ws vigemclient
 *   node rig-bridge.js
 *
 * Environment:
 *   RIG_PORT=8787
 *   RIG_OUTPUT=xinput | ds4
 *   RIG_FORZA_PORT=5300   (Forza Data Out UDP)
 *   RIG_F1_PORT=20777     (EA F1 UDP telemetry)
 *
 * The transport is deliberately simple WebSocket for broad browser support.
 * The bridge uses TCP_NODELAY and manual ViGEm updates so each state packet
 * becomes one consolidated driver report rather than several intermediate ones.
 */

const PORT = Number(process.env.RIG_PORT || 8787);
const FORZA_PORT = Number(process.env.RIG_FORZA_PORT || 5300);
const F1_PORT = Number(process.env.RIG_F1_PORT || 20777);
const OUTPUT = String(process.env.RIG_OUTPUT || "xinput").toLowerCase();
const dgram = require("node:dgram");
const { WebSocketServer } = require("ws");

let client = null;
let pad = null;
let padMode = OUTPUT === "ds4" ? "ds4" : "xinput";

function createPad(mode) {
  if (pad) {
    try {
      pad.resetInputs();
      pad.disconnect();
    } catch {
      /* ignore */
    }
    pad = null;
  }

  if (!client) return;

  try {
    pad = mode === "ds4" ? client.createDS4Controller() : client.createX360Controller();
    pad.updateMode = "manual";
    pad.connect();
    console.log(`Virtual ${mode === "ds4" ? "DualShock 4" : "Xbox 360"} controller created (manual updates).`);
  } catch (err) {
    pad = null;
    console.warn(`Unable to create ${mode} virtual controller:`, err.message);
  }
}

try {
  const ViGEmClient = require("vigemclient");
  client = new ViGEmClient();
  client.connect();
  createPad(padMode);
} catch (err) {
  console.warn("ViGEm not available - running in echo-only mode:", err.message);
}

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
};

function setDpad(s) {
  if (!pad) return;
  const buttons = s.buttons || {};
  let h = 0;
  let v = 0;
  if (buttons.dpad_left) h -= 1;
  if (buttons.dpad_right) h += 1;
  if (buttons.dpad_up) v += 1;
  if (buttons.dpad_down) v -= 1;

  pad.axis.dpadHorz.setValue(h);
  pad.axis.dpadVert.setValue(v);
}

function apply(s) {
  if (!pad) return;

  const held = {};
  const mark = (name) => {
    if (pad.button[name]) held[name] = true;
  };

  const steer = clamp(s.steer, -1, 1);
  pad.axis.leftX.setValue(Math.abs(steer) > 0.0005 ? steer : clamp(s.lx, -1, 1));
  pad.axis.leftY.setValue(-clamp(s.ly, -1, 1));
  pad.axis.rightX.setValue(clamp(s.rx, -1, 1));
  pad.axis.rightY.setValue(-clamp(s.ry, -1, 1));

  pad.axis.leftTrigger.setValue(
    Math.max(
      clamp(s.brake, 0, 1),
      clamp(s.clutch, 0, 1) * 0.6,
      clamp(s.lt, 0, 1),
      s.buttons?.l2 ? 1 : 0,
    ),
  );
  pad.axis.rightTrigger.setValue(
    Math.max(
      clamp(s.throttle, 0, 1),
      clamp(s.rt, 0, 1),
      s.buttons?.r2 ? 1 : 0,
    ),
  );

  const buttons = s.buttons || {};
  const map = padMode === "ds4" ? DSBTN : XBTN;
  for (const [id, name] of Object.entries(map)) if (buttons[id]) mark(name);

  setDpad(s);

  // Driving aliases. These retain compatibility with common game bindings.
  if (buttons.horn) mark(padMode === "ds4" ? "THUMB_LEFT" : "LEFT_THUMB");
  if (buttons.look) mark(padMode === "ds4" ? "THUMB_RIGHT" : "RIGHT_THUMB");
  if (buttons.reset) mark(padMode === "ds4" ? "TRIANGLE" : "Y");

  if (clamp(s.handbrake, 0, 1) > 0.5) {
    mark(padMode === "ds4" ? "CROSS" : "A");
  }
  if (clamp(s.nitro, 0, 1) > 0.5) {
    mark(padMode === "ds4" ? "SHOULDER_LEFT" : "LEFT_SHOULDER");
  }
  if (s.gear === 1) {
    mark(padMode === "ds4" ? "SHOULDER_RIGHT" : "RIGHT_SHOULDER");
  }
  if (s.gear === -1) {
    mark(padMode === "ds4" ? "SHOULDER_LEFT" : "LEFT_SHOULDER");
  }

  for (const name of Object.keys(pad.button)) {
    pad.button[name].setValue(!!held[name]);
  }

  // Exactly one driver report per packet.
  pad.update();
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

function parseForza(packet) {
  // Forza Data Out: the stable Sled block exposes max RPM, current RPM
  // and world velocity. Speed is the magnitude of the velocity vector.
  if (packet.length < 44) return null;

  const isRaceOn = packet.readInt32LE(0);
  if (isRaceOn !== 1) return null;

  const rpmMax = packet.readFloatLE(8);
  const rpm = packet.readFloatLE(16);
  const vx = packet.readFloatLE(32);
  const vy = packet.readFloatLE(36);
  const vz = packet.readFloatLE(40);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz) * 3.6;
  const gear = packet.length > 319 ? packet.readUInt8(319) - 1 : undefined;

  if (!Number.isFinite(speed) || !Number.isFinite(rpm) || !Number.isFinite(rpmMax)) return null;

  return {
    source: "Forza",
    speed,
    rpm,
    rpmMax,
    gear,
  };
}

function parseF1(packet) {
  // F1 25 / 2026 Season Pack uses a 29-byte packed little-endian header.
  if (packet.length < 29) return null;

  const packetFormat = packet.readUInt16LE(0);
  const packetId = packet.readUInt8(6);
  const playerIndex = packet.readUInt8(27);

  // CarTelemetry is packet 6. The 2025 layout uses 22 cars x 60 bytes;
  // the 2026 Season Pack uses 24 cars x 59 bytes.
  if (packetId === 6) {
    const carSize = packet.length >= 1448 ? 59 : 60;
    const carOffset = 29 + playerIndex * carSize;
    if (carOffset + 18 > packet.length) return null;

    const speed = packet.readUInt16LE(carOffset);
    const gear = packet.readInt8(carOffset + 15);
    const rpm = packet.readUInt16LE(carOffset + 16);

    if (!Number.isFinite(speed) || !Number.isFinite(rpm)) return null;

    return {
      source: packetFormat >= 2025 ? "F1 25 / 2026" : "F1",
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

const forzaTelemetrySocket = bindTelemetrySocket(FORZA_PORT, "Forza", parseForza);
const f1TelemetrySocket = bindTelemetrySocket(F1_PORT, "F1", parseF1);

console.log(`Rig bridge listening on ws://0.0.0.0:${PORT}`);
console.log(`Output target: ${padMode === "ds4" ? "DualShock 4" : "Xbox 360/XInput"}`);
console.log("Live gauges use game telemetry only; there is no simulated speed/RPM.");

wss.on("connection", (ws) => {
  const socket = ws._socket;
  if (socket?.setNoDelay) socket.setNoDelay(true);
  if (socket?.setKeepAlive) socket.setKeepAlive(true, 1000);

  console.log("Phone connected.");

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "hello") {
      const requested = String(msg.output || msg.controller || padMode).toLowerCase();
      if (requested === "xinput" || requested === "ds4") {
        padMode = requested;
        createPad(padMode);
      }
      ws.send(JSON.stringify({
        type: "ready",
        t: msg.t ?? Date.now(),
        seq: msg.seq ?? 0,
        output: padMode,
        rateHz: Number(msg.rateHz) || 240,
        telemetry: {
          forzaPort: FORZA_PORT,
          f1Port: F1_PORT,
          live: Boolean(latestTelemetry),
        },
      }));
      if (latestTelemetry && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(latestTelemetry));
        } catch {
          /* ignore a racing socket close */
        }
      }
      return;
    }

    if (msg.type === "state") {
      apply(msg);
      ws.send(JSON.stringify({ type: "ack", t: msg.t, seq: msg.seq }));
    }
  });

  ws.on("close", () => {
    if (pad) {
      try {
        pad.resetInputs();
        pad.update();
      } catch {
        /* ignore */
      }
    }
    console.log("Phone disconnected.");
  });
});
