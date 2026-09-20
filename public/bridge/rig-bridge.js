/**
 * Mobile Rig -> PC bridge
 * -----------------------
 * Receives controller packets from the phone over WebSocket and feeds them
 * into a virtual Xbox 360 gamepad, so every PC game sees a normal controller.
 *
 * Requirements (Windows):
 *   1. Install ViGEmBus driver:  https://github.com/nefarius/ViGEmBus/releases
 *   2. Install Node.js 18+
 *   3. In a folder, run:  npm init -y && npm i ws vigemclient
 *   4. Put this file there and run:  node rig-bridge.js
 *   5. Enter ws://<this-pc-lan-ip>:8787 on the phone.
 *
 * Packet shape (JSON):
 *   {
 *     type:"state",
 *     steer:-1..1, throttle/brake/clutch/handbrake/nitro:0..1,
 *     lx,ly,rx,ry:-1..1, lt/rt:0..1, gear:-1|0|1,
 *     dial:-1|0|1, wheelPlatform:"ps3"|"ps4",
 *     buttons:{...}
 *   }
 *
 * The mobile wheel exposes the complete G29-style control surface. This bridge
 * maps those controls into the closest standard Xbox 360 virtual-pad inputs
 * so existing PC games can use them without custom drivers.
 */

const PORT = 8787;
const { WebSocketServer } = require("ws");

let pad = null;
try {
  const ViGEmClient = require("vigemclient");
  const client = new ViGEmClient();
  client.connect();
  pad = client.createX360Controller();
  pad.connect();
  console.log("Virtual Xbox 360 controller created.");
} catch (err) {
  console.warn("ViGEm not available - running in echo-only mode:", err.message);
}

const BTN = {
  // G29 face buttons -> Xbox face buttons
  cross: "A",
  circle: "B",
  square: "X",
  triangle: "Y",

  // Wheel paddles / upper shoulder controls
  l1: "LEFT_SHOULDER",
  r1: "RIGHT_SHOULDER",

  // Sticks/thumb-clicks
  l3: "LEFT_THUMB",
  r3: "RIGHT_THUMB",

  // D-pad
  dpad_up: "DPAD_UP",
  dpad_down: "DPAD_DOWN",
  dpad_left: "DPAD_LEFT",
  dpad_right: "DPAD_RIGHT",

  // Navigation / console controls
  share: "BACK",
  options: "START",
  ps: "GUIDE",
  enter: "A",

  // G29 + / - buttons
  plus: "START",
  minus: "BACK",

  // 24-point selector press
  dial_press: "A",

  // Existing gamepad aliases kept for compatibility
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  lb: "LEFT_SHOULDER",
  rb: "RIGHT_SHOULDER",
  start: "START",
  back: "BACK",
  home: "GUIDE",
  select: "BACK",
  m1: "LEFT_SHOULDER",
  m2: "RIGHT_SHOULDER",
  m3: "LEFT_THUMB",
  m4: "RIGHT_THUMB",
  m5: "BACK",
  m6: "START",
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

function apply(s) {
  if (!pad) return;
  const held = {};
  const mark = (name) => {
    held[name] = true;
  };

  const steer = clamp(s.steer, -1, 1);
  pad.axis.leftX.setValue(steer !== 0 ? steer : clamp(s.lx, -1, 1));
  pad.axis.leftY.setValue(-clamp(s.ly, -1, 1));
  pad.axis.rightX.setValue(clamp(s.rx, -1, 1));
  pad.axis.rightY.setValue(-clamp(s.ry, -1, 1));

  // Preserve analog pedal behavior. G29 L2/R2 are also exposed as digital
  // wheel controls, so a pressed button forces the corresponding trigger to 1.
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
  for (const [id, name] of Object.entries(BTN)) if (buttons[id]) mark(name);

  // G29 24-point dial: rotate one detent at a time. The virtual Xbox mapping
  // uses the D-pad as the nearest universal menu/setting control.
  if (s.dial === 1) mark("DPAD_RIGHT");
  if (s.dial === -1) mark("DPAD_LEFT");

  // Driving extras -> the bindings these games expect on a pad.
  if (buttons.horn) mark("LEFT_THUMB");
  if (buttons.lights) mark("DPAD_LEFT");
  if (buttons.look) mark("RIGHT_THUMB");
  if (buttons.reset) mark("Y");
  if (clamp(s.handbrake, 0, 1) > 0.5) mark("A");
  if (clamp(s.nitro, 0, 1) > 0.5) mark("LEFT_SHOULDER");
  if (s.gear === 1) mark("RIGHT_SHOULDER");
  if (s.gear === -1) mark("LEFT_SHOULDER");

  for (const name of Object.keys(pad.button)) {
    pad.button[name].setValue(!!held[name]);
  }
  pad.update();
}

const wss = new WebSocketServer({ port: PORT });
console.log(`Rig bridge listening on ws://0.0.0.0:${PORT}`);

wss.on("connection", (ws) => {
  console.log("Phone connected.");
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "state") {
      apply(msg);
      ws.send(JSON.stringify({ type: "ack", t: msg.t }));
    }
  });
  ws.on("close", () => console.log("Phone disconnected."));
});
