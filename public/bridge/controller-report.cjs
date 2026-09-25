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

  // Steering pedals are delivered through the canonical trigger axes:
  // accelerator -> Right Trigger (RT), brake -> Left Trigger (LT).
  // The same analog values are mirrored to DS4 trigger buttons for legacy
  // HID titles that bind LT/RT as digital controls. The native ViGEm binding
  // exposes both trigger axes on X360 and DS4 targets.
  //
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
  if (buttonMap.__brakeTrigger && Math.max(brake, clutch * 0.6, lt, buttons.l2 ? 1 : 0) > 0.02) mark(buttonMap.__brakeTrigger);
  if (buttonMap.__throttleTrigger && Math.max(throttle, rt, buttons.r2 ? 1 : 0) > 0.02) mark(buttonMap.__throttleTrigger);

  // DS4 already carries the analog triggers and matching trigger buttons.
  // Do not also press face buttons: accelerating must not activate Cross,
  // and braking must not activate Square in menus or modern games.

  if (s.dial === 1) mark(buttonMap.plus);
  if (s.dial === -1) mark(buttonMap.minus);

  if (s.gear === 1) mark(buttonMap.__gearUp);
  if (s.gear === -1) mark(buttonMap.__gearDown);

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
