const { test } = require('node:test');
const assert = require('node:assert/strict');
const { XBTN, DSBTN, applyToTarget, applySessionState } = require('../public/bridge/controller-report.cjs');

function targetFor(map) {
  const values = { buttons: {}, axes: {} };
  const target = {
    axis: Object.fromEntries(['leftX', 'leftY', 'rightX', 'rightY', 'leftTrigger', 'rightTrigger', 'dpadHorz', 'dpadVert']
      .map(key => [key, { setValue: value => { values.axes[key] = value; } }])),
    button: Object.fromEntries([...new Set(Object.values(map))]
      .map(key => [key, { setValue: value => { values.buttons[key] = value; } }])),
    reports: [],
    update() { this.reports.push(structuredClone(values)); return this.error; },
  };
  return target;
}
module.exports = { targetFor };

for (const [kind, map] of [['XInput', XBTN], ['DS4', DSBTN]]) {
  for (const id of ['a','b','x','y','cross','circle','square','triangle','l1','r1','lb','rb','l3','r3','share','options','ps','enter','plus','minus','dial_press','start','back','home','select','m1','m2','m3','m4','m5','m6']) {
    test(`${kind}: ${id} presses and releases in one complete report`, () => {
      assert.ok(map[id], `missing mapping for ${id}`);
      const target = targetFor(map);
      applyToTarget(target, { buttons: { [id]: true } }, map);
      assert.equal(target.reports.length, 1);
      assert.equal(target.reports[0].buttons[map[id]], true);
      applyToTarget(target, { buttons: {} }, map);
      assert.equal(target.reports.length, 2);
      assert.ok(Object.values(target.reports[1].buttons).every(value => !value));
    });
  }
  test(`${kind}: all four D-pad directions, diagonals and opposite cancellation`, () => {
    const target = targetFor(map);
    for (const [buttons, expected] of [
      [{dpad_left:true},[-1,0]], [{dpad_right:true},[1,0]],
      [{dpad_up:true},[0,1]], [{dpad_down:true},[0,-1]],
      [{dpad_left:true,dpad_up:true},[-1,1]],
      [{dpad_right:true,dpad_down:true},[1,-1]],
      [{dpad_left:true,dpad_right:true,dpad_up:true,dpad_down:true},[0,0]],
    ]) {
      applyToTarget(target, {buttons}, map);
      const axes = target.reports.at(-1).axes;
      assert.deepEqual([axes.dpadHorz,axes.dpadVert],expected);
    }
  });
  test(`${kind}: steering, both sticks, pedals and partial analog triggers`, () => {
    const target = targetFor(map);
    applyToTarget(target, {steer:-0.75,lx:0.2,ly:-0.4,rx:0.6,ry:0.8,lt:0.25,rt:0.65}, map);
    const { axes, buttons } = target.reports.at(-1);
    assert.deepEqual([axes.leftX, axes.leftY, axes.rightX, axes.rightY],[-0.75,0.4,0.6,-0.8]);
    assert.equal(axes.leftTrigger,0.25);
    assert.equal(axes.rightTrigger,0.65);
    if (kind === 'DS4') {
      assert.equal(buttons.TRIGGER_LEFT,true);
      assert.equal(buttons.TRIGGER_RIGHT,true);
    }
    applyToTarget(target,{brake:0.7,throttle:0.9,clutch:1},map);
    assert.equal(target.reports.at(-1).axes.leftTrigger,0.7);
    assert.equal(target.reports.at(-1).axes.rightTrigger,0.9);
    applyToTarget(target,{},map);
    assert.ok(Object.values(target.reports.at(-1).axes).every(value => value === 0));
    assert.ok(Object.values(target.reports.at(-1).buttons).every(value => !value));
  });
  test(`${kind}: driving and dial controls`, () => {
    const target = targetFor(map);
    for (const [state, button] of [
      [{buttons:{horn:true}},map.__horn], [{buttons:{look:true}},map.__look],
      [{buttons:{reset:true}},map.__reset], [{handbrake:1},map.__handbrake],
      [{nitro:1},map.__nitro], [{gear:1},map.__gearUp], [{gear:-1},map.__gearDown],
      [{dial:1},map.plus], [{dial:-1},map.minus],
    ]) {
      applyToTarget(target,state,map);
      assert.equal(target.reports.at(-1).buttons[button],true);
      applyToTarget(target,{},map);
      assert.ok(Object.values(target.reports.at(-1).buttons).every(value=>!value));
    }
  });
}

test('Universal mode mirrors simultaneous controls; stale packets cannot undo a release', () => {
  const a=targetFor(XBTN), b=targetFor(DSBTN);
  const session={targets:[{target:a,map:XBTN},{target:b,map:DSBTN}],lastAppliedSeq:0,lastAppliedSignature:''};
  applySessionState(session,{seq:1,rt:0.35,buttons:{a:true,lb:true,dpad_left:true}});
  applySessionState(session,{seq:3,rt:0.35,buttons:{lb:true}});
  applySessionState(session,{seq:2,buttons:{a:true}});
  assert.equal(a.reports.length,2); assert.equal(b.reports.length,2);
  assert.equal(a.reports.at(-1).buttons.A,false);
  assert.equal(a.reports.at(-1).buttons.LEFT_SHOULDER,true);
  assert.equal(a.reports.at(-1).axes.rightTrigger,0.35);
  assert.equal(b.reports.at(-1).buttons.CROSS,false);
  applySessionState(session,{seq:4,rt:0.35,buttons:{lb:true}});
  assert.equal(a.reports.length,2); // heartbeat does not flicker held buttons
  applySessionState(session,{}); // watchdog neutral, preserves sequence ordering
  assert.equal(session.lastAppliedSeq,4);
  assert.ok(Object.values(a.reports.at(-1).buttons).every(value=>!value));
});

test('Failed native update is not cached as applied; the next heartbeat retries it', () => {
  const target=targetFor(XBTN);
  const session={targets:[{target,map:XBTN}],lastAppliedSeq:0,lastAppliedSignature:''};
  target.error=new Error('device disconnected');
  assert.throws(()=>applySessionState(session,{seq:1,buttons:{a:true}}),/device disconnected/);
  assert.equal(session.lastAppliedSeq,0);
  target.error=null;
  applySessionState(session,{seq:2,buttons:{a:true}});
  assert.equal(target.reports.length,2);
  assert.equal(session.lastAppliedSeq,2);
});
