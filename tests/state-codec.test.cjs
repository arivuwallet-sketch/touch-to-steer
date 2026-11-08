const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTS } = require('./load-ts.cjs');
const { createStateEncoder } = loadTS('src/lib/state-codec.ts');
const { emptyState, defaultWheelBindings } = loadTS('src/lib/controller-types.ts');

// The wire format the bridge already parses: this is exactly what useBridge sent before.
const legacyPacket = (priority, t, seq, state, wheelBindings, padBindings) =>
  JSON.stringify({ type: 'state', ...(priority ? { priority } : {}), t, seq, ...state, wheelBindings, padBindings });

function randomState(rand) {
  const s = emptyState();
  for (const k of ['steer', 'lx', 'ly', 'rx', 'ry']) s[k] = Math.round((rand() * 2 - 1) * 1e6) / 1e6;
  for (const k of ['throttle', 'brake', 'clutch', 'handbrake', 'nitro', 'lt', 'rt']) s[k] = rand() < 0.3 ? 0 : rand();
  s.gear = Math.floor(rand() * 3) - 1;
  s.dial = Math.floor(rand() * 3) - 1;
  s.wheelPlatform = rand() < 0.5 ? 'ps3' : 'ps4';
  for (const id of ['a', 'b', 'x', 'y', 'lb', 'rb', 'dpad_up', 'm1', 'l3']) if (rand() < 0.5) s.buttons[id] = rand() < 0.5;
  return s;
}
const prng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

test('Packets are byte-for-byte identical to the previous JSON.stringify wire format', () => {
  const rand = prng(7);
  const encoder = createStateEncoder();
  const pads = [{}, { rt: 'none' }, { a: 'b', lt: 'rt' }];
  for (let i = 0; i < 400; i++) {
    const state = randomState(rand);
    const pad = pads[i % pads.length];
    const priority = [undefined, 'hot', 'edge'][i % 3];
    const t = 1_700_000_000_000 + i * 7;
    assert.equal(
      encoder.packet(priority, t, i + 1, state, defaultWheelBindings, pad),
      legacyPacket(priority, t, i + 1, state, defaultWheelBindings, pad),
      `packet ${i}`,
    );
  }
});

test('Packets parse to the same message the bridge always received', () => {
  const encoder = createStateEncoder();
  const state = { ...emptyState(), lx: 0.25, ly: -1, buttons: { a: true, lb: false } };
  const parsed = JSON.parse(encoder.packet('edge', 5, 9, state, defaultWheelBindings, { rt: 'none' }));
  assert.deepEqual(parsed, JSON.parse(legacyPacket('edge', 5, 9, state, defaultWheelBindings, { rt: 'none' })));
  assert.equal(parsed.priority, 'edge');
  assert.equal(parsed.buttons.a, true);
});

test('Undefined bindings are omitted exactly like JSON.stringify omits them', () => {
  const encoder = createStateEncoder();
  const state = emptyState();
  assert.equal(encoder.packet('hot', 1, 1, state, undefined, undefined), legacyPacket('hot', 1, 1, state, undefined, undefined));
  assert.equal(encoder.packet('hot', 1, 1, state, defaultWheelBindings, undefined), legacyPacket('hot', 1, 1, state, defaultWheelBindings, undefined));
  assert.equal(encoder.packet(undefined, 1, 1, state, undefined, {}), legacyPacket(undefined, 1, 1, state, undefined, {}));
});

test('A new snapshot is never served from a stale cache', () => {
  const encoder = createStateEncoder();
  const first = emptyState();
  const second = { ...first, rt: 1, buttons: { a: true } };
  const wheel = { ...defaultWheelBindings };
  const a = encoder.packet('hot', 1, 1, first, wheel, {});
  const b = encoder.packet('hot', 2, 2, second, wheel, {});
  const c = encoder.packet('hot', 3, 3, first, wheel, {});
  assert.equal(JSON.parse(a).rt, 0);
  assert.equal(JSON.parse(b).rt, 1);
  assert.equal(JSON.parse(b).buttons.a, true);
  assert.equal(JSON.parse(c).rt, 0);
  assert.equal(JSON.parse(c).buttons.a, undefined);
});

test('Changed bindings are re-encoded; unchanged bindings are reused', () => {
  const encoder = createStateEncoder();
  const state = emptyState();
  const pad1 = { rt: 'none' };
  const pad2 = { rt: 'a' };
  assert.equal(JSON.parse(encoder.packet('hot', 1, 1, state, defaultWheelBindings, pad1)).padBindings.rt, 'none');
  assert.equal(JSON.parse(encoder.packet('hot', 1, 2, state, defaultWheelBindings, pad2)).padBindings.rt, 'a');
  assert.equal(JSON.parse(encoder.packet('hot', 1, 3, state, { ...defaultWheelBindings, horn: 'none' }, pad2)).wheelBindings.horn, 'none');
});

test('Signature changes iff controller state or bindings change (pump change detection)', () => {
  const encoder = createStateEncoder();
  const wheel = { ...defaultWheelBindings };
  const pad = {};
  const base = emptyState();
  const sig = encoder.signature(base, wheel, pad);
  assert.equal(encoder.signature(base, wheel, pad), sig);
  assert.equal(encoder.signature({ ...base }, wheel, pad), sig, 'equal content => equal signature');
  assert.notEqual(encoder.signature({ ...base, rt: 0.01 }, wheel, pad), sig);
  assert.notEqual(encoder.signature({ ...base, buttons: { a: true } }, wheel, pad), sig);
  assert.notEqual(encoder.signature(base, { ...wheel, horn: 'none' }, pad), sig);
  assert.notEqual(encoder.signature(base, wheel, { rt: 'none' }), sig);
  assert.equal(encoder.signature(base, wheel, pad), sig, 'and back again');
});

test('Signature is the same string instance between pump ticks (no per-tick allocation)', () => {
  const encoder = createStateEncoder();
  const state = emptyState();
  const wheel = { ...defaultWheelBindings };
  const first = encoder.signature(state, wheel, {});
  const pad = {};
  encoder.signature(state, wheel, pad);
  const again = encoder.signature(state, wheel, pad);
  assert.strictEqual(again, encoder.signature(state, wheel, pad));
  assert.equal(typeof first, 'string');
});

test('Sending a packet then reading its signature serialises the snapshot only once', () => {
  const encoder = createStateEncoder();
  const state = emptyState();
  const pad = {}; // useBridge reads the same ref object for the packet and the signature
  let calls = 0;
  const original = JSON.stringify;
  JSON.stringify = function (...args) { calls++; return original.apply(this, args); };
  try {
    encoder.packet('hot', 1, 1, state, defaultWheelBindings, pad);
    const afterPacket = calls;
    encoder.signature(state, defaultWheelBindings, pad);
    assert.equal(calls, afterPacket, 'signature must reuse the packet serialisation');
    assert.equal(afterPacket, 3, 'state + wheel + pad, once each');
  } finally {
    JSON.stringify = original;
  }
});
