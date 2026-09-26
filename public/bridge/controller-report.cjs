"use strict";

// One atomic ViGEm report per target; pure mapping is tested without a driver.
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
  enter: "CROSS", plus: "OPTIONS", minus: "SHARE",
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

const DEFAULT_WHEEL_BINDINGS = { throttle: "rt", brake: "lt", handbrake: "a", nitro: "lb", clutch: "x", gearUp: "rb", gearDown: "lb", horn: "l3" };
const WHEEL_OUTPUTS = new Set(["rt", "lt", "a", "b", "x", "y", "lb", "rb", "l3", "r3", "none"]);
function wheelBindings(s) {
  return Object.fromEntries(Object.entries(DEFAULT_WHEEL_BINDINGS).map(([action, fallback]) =>
    [action, WHEEL_OUTPUTS.has(s.wheelBindings?.[action]) ? s.wheelBindings[action] : fallback]));
}

const PAD_CONTROLS = ["lt", "rt", "a", "b", "x", "y", "lb", "rb", "l3", "r3"];
function padBindings(s) {
  return Object.fromEntries(PAD_CONTROLS.map(id => [id,
    WHEEL_OUTPUTS.has(s.padBindings?.[id]) ? s.padBindings[id] : id]));
}
function remapPad(s) {
  const bindings = padBindings(s);
  const buttons = { ...s.buttons };
  for (const id of PAD_CONTROLS) delete buttons[id];
  const mapped = { ...s, lt:0, rt:0, buttons };
  // Map from the original snapshot once (no chained swaps, no interference
  // with synthetic wheel actions). Multiple sources OR/max into one output.
  for (const id of PAD_CONTROLS) {
    const value = id === "lt" || id === "rt" ? clamp(s[id], 0, 1) : s.buttons?.[id] ? 1 : 0;
    const output = bindings[id];
    if (output === "lt" || output === "rt") mapped[output] = Math.max(mapped[output], value);
    else if (output !== "none" && value > 0.5) mapped.buttons[output] = true;
  }
  return mapped;
}

function applyToTarget(target, s, buttonMap) {
  s = remapPad(s);
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

  let leftTrigger = Math.max(lt, buttons.l2 ? 1 : 0);
  let rightTrigger = Math.max(rt, buttons.r2 ? 1 : 0);
  const bindings = wheelBindings(s);
  const drive = (action, value) => {
    const output = bindings[action];
    if (output === "lt") leftTrigger = Math.max(leftTrigger, value);
    else if (output === "rt") rightTrigger = Math.max(rightTrigger, value);
    else if (value > 0.5 && output !== "none") mark(buttonMap[output]);
  };
  drive("throttle", throttle);
  drive("brake", brake);
  drive("clutch", clutch);
  drive("handbrake", clamp(s.handbrake, 0, 1));
  drive("nitro", clamp(s.nitro, 0, 1));
  drive("horn", buttons.horn ? 1 : 0);
  drive("gearUp", s.gear === 1 ? 1 : 0);
  drive("gearDown", s.gear === -1 ? 1 : 0);
  target.axis.leftTrigger.setValue(leftTrigger);
  target.axis.rightTrigger.setValue(rightTrigger);
  if (buttonMap.__brakeTrigger && leftTrigger > 0.02) mark(buttonMap.__brakeTrigger);
  if (buttonMap.__throttleTrigger && rightTrigger > 0.02) mark(buttonMap.__throttleTrigger);

  for (const [id, name] of Object.entries(buttonMap)) {
    if (buttons[id]) mark(name);
  }

  setDpad(target, s);

  if (buttons.look) mark(buttonMap.__look);
  if (buttons.reset) mark(buttonMap.__reset);
  if (s.dial === 1) mark(buttonMap.plus);
  if (s.dial === -1) mark(buttonMap.minus);


  for (const name of Object.keys(target.button)) {
    target.button[name].setValue(!!held[name]);
  }

  const error = target.update();
  if (error) throw new Error(`Controller report failed: ${error.message || error}`);
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
    Object.values(wheelBindings(s)).join(","),
    Object.values(padBindings(s)).join(","),
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

module.exports = { XBTN, DSBTN, applyToTarget, applySessionState, stateSignature };
