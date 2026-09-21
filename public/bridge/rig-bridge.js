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
console.log(`Output target: ${padMode === "ds4" ? "DualShock 4" : "Xbox 360/XInput"}`);
console.log(`Native telemetry listeners: Forza [${FORZA_PORTS.join(", ")}], F1/Codemasters [${F1_PORT}], DiRT [${DIRT_PORT}], PCARS/AMS2 [${PCARS_PORT}], OutGauge [${OUTGAUGE_PORTS.join(", ")}]`);
console.log(`EA WRC is not guessed: its native packet structure is configurable. Default documented port is ${WRC_PORT}; use the included WRC structure/config instructions for its exact packet schema.`);
console.log(`Wreckfest 2 native telemetry is supported by the game on UDP ${WRECKFEST2_PORT}, but its Pino packet is not decoded by this bridge yet rather than showing fabricated values.`);
console.log("Live gauges use game telemetry only; no speed/RPM simulation is generated.");

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
