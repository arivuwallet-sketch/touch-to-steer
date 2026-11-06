const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTS } = require('./load-ts.cjs');
const { bridgeOutputFor, padLabelsFor, isPlayStationOutput } = loadTS('src/lib/playstation.ts');

test('PS5 / PS5 Pro output creates a DualShock 4 target on the PC bridge', () => {
  assert.equal(bridgeOutputFor('ps5'), 'ds4');
  assert.equal(bridgeOutputFor('xinput'), 'xinput');
  assert.equal(bridgeOutputFor('universal'), 'universal');
});

test('PlayStation outputs show PlayStation button glyphs', () => {
  assert.equal(isPlayStationOutput('ps5'), true);
  assert.equal(padLabelsFor('ps5').a, '✕');
  assert.equal(padLabelsFor('ps5').lt, 'L2');
  assert.equal(padLabelsFor('xinput').a, 'A');
});

const { stickTravel, shouldSkipMove } = loadTS('src/lib/fast-pointer.ts');

test('sticks reach full deflection at 94% of physical travel', () => {
  assert.deepEqual(stickTravel(0.94, 0), [1, 0]);
  assert.ok(Math.abs(stickTravel(0.47, 0)[0] - 0.5) < 1e-9);
  assert.deepEqual(stickTravel(0, 0), [0, 0]);
});

test('a pointermove right after a raw update is skipped as a duplicate', () => {
  assert.equal(shouldSkipMove(110, 100), true);
  assert.equal(shouldSkipMove(150, 100), false);
});
