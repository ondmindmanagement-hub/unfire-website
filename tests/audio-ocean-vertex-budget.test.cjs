'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = fs.readFileSync('audio/maletin/game-engine-v50.js', 'utf8');
const match = engine.match(/const seaSegments = ([^;]+);\s*const seaG = new THREE\.PlaneGeometry\(3200, 3200, seaSegments, seaSegments\)/);
assert.ok(match, 'ocean must use the shared, tier-based segment count');
const segments = (tier, low, software) => vm.runInNewContext(match[1], {
  DEVICE: { tier }, LOWDEV: low, SOFTWARE_WEBGL: software
});
const vertices = (n) => (n + 1) ** 2;

test('GPU tiers reduce ocean vertices without increasing them', () => {
  const cases = [
    ['desktop', false, false, 272, 320],
    ['balanced', true, false, 112, 120],
    ['compact', true, false, 96, 120],
    ['desktop', true, true, 64, 120]
  ];
  for (const [tier, low, software, wanted, prior] of cases) {
    const n = segments(tier, low, software);
    assert.equal(n, wanted);
    assert.ok(Number.isInteger(n) && n > 0);
    assert.ok(vertices(n) < vertices(prior));
  }
  assert.ok(vertices(segments('desktop', false, false)) / vertices(320) < 0.75);
  assert.ok(vertices(segments('compact', true, false)) / vertices(120) < 0.66);
});

test('ocean physics, shader, scene ownership, and world size are untouched', () => {
  assert.match(engine, /const seaG = new THREE\.PlaneGeometry\(3200, 3200, seaSegments, seaSegments\)/);
  assert.match(engine, /sea\.userData\.noCollide = true; sea\.frustumCulled = false; OUT\.add\(sea\)/);
  assert.match(engine, /seaU\.t\.value = t/);
  assert.match(engine, /vertexShader: 'uniform float t; varying vec3 vW; varying float vH; varying vec3 vN; float H/);
  assert.match(engine, /const SOFTWARE_WEBGL = softwareWebGL\(S\.renderer\)/);
});
