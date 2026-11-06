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
