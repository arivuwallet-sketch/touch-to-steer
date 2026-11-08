const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTS } = require('./load-ts.cjs');
const {
  normalizeReturnMs, decayStep, returnTauMs, createReturnRunner,
  DEFAULT_ANALOG_RETURN_MS, RETURN_SNAP, RETURN_STEP_MS, ANALOG_RETURN_PRESETS,
} = loadTS('src/lib/analog-feel.ts');
const { defaultSettings } = loadTS('src/lib/controller-types.ts');

/** Deterministic clock + timer queue so the curve can be inspected sample by sample. */
function harness({ getReturnMs, jitter = () => 0, frozen = false }) {
  let now = 1000;
  const queue = [];
  const samples = [];
  const runner = createReturnRunner({
    emit: (x, y, done) => samples.push({ t: now, x, y, done }),
    getReturnMs,
    clock: () => now,
    schedule: (cb, ms) => { const h = { cb, at: now + ms, cancelled: false }; queue.push(h); return h; },
    unschedule: (h) => { h.cancelled = true; },
  });
  const run = (limit = 10_000) => {
    for (let i = 0; i < limit && queue.length; i++) {
      queue.sort((a, b) => a.at - b.at);
      const next = queue.shift();
      if (next.cancelled) continue;
      if (!frozen) now = next.at + jitter(i);
      next.cb();
    }
  };
  return { runner, samples, run, queue, advance: (ms) => { now += ms; }, clock: () => now };
}

test('Return time is sanitised: bad saved values fall back, range is clamped', () => {
  assert.equal(normalizeReturnMs(undefined), DEFAULT_ANALOG_RETURN_MS);
  assert.equal(normalizeReturnMs('45'), DEFAULT_ANALOG_RETURN_MS);
  assert.equal(normalizeReturnMs(NaN), DEFAULT_ANALOG_RETURN_MS);
  assert.equal(normalizeReturnMs(-30), 0);
  assert.equal(normalizeReturnMs(9999), 200);
  assert.equal(normalizeReturnMs(25.4), 25);
  for (const preset of ANALOG_RETURN_PRESETS) assert.equal(normalizeReturnMs(preset), preset);
});

test('Defaults give the natural return; the instant preset stays available', () => {
  assert.equal(defaultSettings.analogReturnMs, 45);
  assert.ok(ANALOG_RETURN_PRESETS.includes(0));
  assert.ok(ANALOG_RETURN_PRESETS.includes(defaultSettings.analogReturnMs));
});

test('Decay is exact and frame-rate independent: many small steps equal one big step', () => {
  for (const returnMs of [25, 45, 80]) {
    const oneShot = decayStep(1, 40, returnMs);
    let stepped = 1;
    for (let i = 0; i < 10; i++) stepped = decayStep(stepped, 4, returnMs);
    assert.ok(Math.abs(oneShot - stepped) < 1e-12, `${returnMs} ms`);
    let sixty = 1;
    for (let i = 0; i < 4; i++) sixty = decayStep(sixty, 10, returnMs);
    assert.ok(Math.abs(oneShot - sixty) < 1e-12);
  }
  assert.equal(decayStep(0.7, 0, 45), 0.7);
  assert.equal(decayStep(0, 16, 45), 0);
  assert.equal(decayStep(Number.NaN, 16, 45), 0);
});

test('Settle time means what it says: ~2 % of the starting deflection after returnMs', () => {
  for (const returnMs of [25, 45, 80]) {
    const remaining = decayStep(1, returnMs, returnMs);
    assert.ok(Math.abs(remaining - RETURN_SNAP) < 1e-9, `${returnMs} ms -> ${remaining}`);
    assert.ok(returnTauMs(returnMs) < returnMs / 3.9 + 1e-9);
  }
});

test('Instant mode and tiny deflections emit a single final zero with no timer', () => {
  const h = harness({ getReturnMs: () => 0 });
  h.runner.start(1, 0);
  assert.deepEqual(h.samples.map(s => [s.x, s.y, s.done]), [[0, 0, true]]);
  assert.equal(h.runner.active, false);
  assert.equal(h.queue.length, 0);
  const h2 = harness({ getReturnMs: () => 45 });
  h2.runner.start(0.01, -0.01);
  assert.deepEqual(h2.samples.map(s => [s.x, s.y, s.done]), [[0, 0, true]]);
});

test('Release is a fast, monotonic, continuous fall that ends on exact zero once', () => {
  const h = harness({ getReturnMs: () => 45 });
  h.runner.start(1, 0);
  assert.equal(h.runner.active, true);
  assert.equal(h.samples.length, 0, 'nothing is emitted before the first timer tick');
  h.run();
  const live = h.samples.filter(s => !s.done);
  const last = h.samples.at(-1);
  assert.equal(h.samples.filter(s => s.done).length, 1);
  assert.deepEqual([last.x, last.y, last.done], [0, 0, true]);
  assert.ok(live.length >= 6, `expected a continuous curve, got ${live.length} samples`);
  let previous = 1;
  for (const s of live) { assert.ok(s.x < previous && s.x > 0); previous = s.x; }
  assert.ok(live[0].x < 0.75, 'first sample must already be moving (fast start)');
  assert.ok(last.t - 1000 <= 45 + RETURN_STEP_MS, `finished after ${last.t - 1000} ms`);
  assert.ok(last.t - 1000 >= 30, 'not instant');
  assert.equal(h.runner.active, false);
});

test('A trigger crosses typical game thresholds within ~one frame of a physical trigger', () => {
  const h = harness({ getReturnMs: () => 45 });
  h.runner.start(1, 0);
  h.run();
  const below = (v) => h.samples.find(s => s.x <= v).t - 1000;
  assert.ok(below(0.5) <= 12, `50 % after ${below(0.5)} ms`);
  assert.ok(below(0.15) <= 28, `15 % after ${below(0.15)} ms`);
});

test('Stick return keeps its direction and never leaves the unit disc', () => {
  const h = harness({ getReturnMs: () => 80 });
  h.runner.start(0.6, -0.8);
  h.run();
  const live = h.samples.filter(s => !s.done);
  assert.ok(live.length > 8);
  let previous = 1;
  for (const s of live) {
    assert.ok(Math.abs(s.y / s.x + 0.8 / 0.6) < 1e-9, 'direction preserved');
    const magnitude = Math.hypot(s.x, s.y);
    assert.ok(magnitude < previous && magnitude <= 1);
    previous = magnitude;
  }
});

test('A new press cancels the return without emitting a stale zero', () => {
  const h = harness({ getReturnMs: () => 80 });
  h.runner.start(1, 0);
  h.advance(RETURN_STEP_MS); h.queue.sort((a, b) => a.at - b.at); h.queue.shift().cb();
  const before = h.samples.length;
  h.runner.cancel();
  assert.equal(h.runner.active, false);
  h.run();
  assert.equal(h.samples.length, before, 'cancelled runner must stay silent');
  assert.equal(h.samples.some(s => s.done), false);
});

test('Restarting mid-return replaces the old curve instead of running two', () => {
  const h = harness({ getReturnMs: () => 45 });
  h.runner.start(1, 0);
  h.runner.start(0.5, 0);
  h.run();
  assert.equal(h.samples.filter(s => s.done).length, 1);
  assert.ok(h.samples.filter(s => !s.done).every(s => s.x < 0.5));
});

test('Settings changes apply to the next release, not mid-flight', () => {
  let ms = 25;
  const h = harness({ getReturnMs: () => ms });
  h.runner.start(1, 0);
  ms = 200;
  h.run();
  assert.ok(h.samples.at(-1).t - 1000 <= 25 + RETURN_STEP_MS);
});

test('Hitching main thread cannot skip or stall the curve; a frozen clock still terminates', () => {
  const stalled = harness({ getReturnMs: () => 45, jitter: (i) => (i === 2 ? 400 : 0) });
  stalled.runner.start(1, 0);
  stalled.run();
  assert.deepEqual([stalled.samples.at(-1).x, stalled.samples.at(-1).done], [0, true]);
  const frozen = harness({ getReturnMs: () => 45, frozen: true });
  frozen.runner.start(1, 0);
  frozen.run(5000);
  assert.equal(frozen.samples.at(-1).done, true, 'deadline forces exact zero');
  assert.ok(frozen.samples.length < 400);
  assert.equal(frozen.queue.length, 0);
});

test('Real timers: the default runner uses setTimeout resolved at call time (fake timers work)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const seen = [];
  const runner = createReturnRunner({ emit: (x, y, done) => seen.push([x, y, done]), getReturnMs: () => 45 });
  runner.start(1, 0);
  t.mock.timers.tick(RETURN_STEP_MS);
  assert.ok(seen.length >= 1 && seen[0][2] === false);
  runner.cancel();
  t.mock.timers.tick(1000);
  assert.equal(seen.at(-1)[2], false);
});
