'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../audio/maletin/unfire-performance-guard.js'), 'utf8');
function loadGuard() {
  const window = {};
  const ctx = { window };
  vm.runInNewContext(script, ctx, { filename: 'unfire-performance-guard.js' });
  return window.UnfirePerformanceGuard;
}
function mockRenderer(max) {
  let calls = 0;
  const capabilities = {
    getMaxAnisotropy() { calls += 1; return max; }
  };
  return { capabilities, getCalls() { return calls; } };
}

test('compact profile caps only anisotropy to 2 before texture upload', () => {
  const guard = loadGuard(), renderer = mockRenderer(16);
  const before = renderer.capabilities.getMaxAnisotropy;
  const info = guard.attach(renderer, { tier: 'compact' });
  assert.equal(info.enabled, true);
  assert.equal(info.effectiveMaxAnisotropy, 2);
  assert.equal(info.hardwareMaxAnisotropy, 16);
  assert.equal(renderer.capabilities.getMaxAnisotropy(), 2);
  assert.notEqual(renderer.capabilities.getMaxAnisotropy, before);
  assert.equal(guard.getInfo().reason, 'capped-at-upload');
});

test('balanced caps to 4 without touching viewport, geometry or materials', () => {
  const guard = loadGuard(), renderer = mockRenderer(16);
  const viewport = { pixelRatio: 1.5, shadowEnabled: true };
  renderer.viewport = viewport;
  const info = guard.attach(renderer, { tier: 'balanced' });
  assert.equal(info.effectiveMaxAnisotropy, 4);
  assert.equal(renderer.capabilities.getMaxAnisotropy(), 4);
  assert.strictEqual(renderer.viewport, viewport);
});

test('desktop uses full hardware anisotropy (preserve maximum visual quality)', () => {
  const guard = loadGuard(), renderer = mockRenderer(16);
  const original = renderer.capabilities.getMaxAnisotropy;
  assert.equal(guard.attach(renderer, { tier: 'desktop' }).enabled, false);
  assert.strictEqual(renderer.capabilities.getMaxAnisotropy, original);
  assert.equal(renderer.capabilities.getMaxAnisotropy(), 16);
});

test('unknown tier is safe and preserves native behavior', () => {
  const guard = loadGuard(), renderer = mockRenderer(16);
  assert.equal(guard.attach(renderer, { tier: 'ultra' }).enabled, false);
  assert.equal(renderer.capabilities.getMaxAnisotropy(), 16);
});

test('hardware lower than target is never artificially raised', () => {
  for (const max of [1, 2]) {
    const guard = loadGuard(), renderer = mockRenderer(max);
    const info = guard.attach(renderer, { tier: 'compact' });
    assert.equal(renderer.capabilities.getMaxAnisotropy(), max);
    assert.equal(info.enabled, false);
  }
});

test('attaching twice is idempotent and does not stack wrappers', () => {
  const guard = loadGuard(), renderer = mockRenderer(16);
  const first = guard.attach(renderer, { tier: 'compact' });
  const wrapped = renderer.capabilities.getMaxAnisotropy;
  const again = guard.attach(renderer, { tier: 'balanced' });
  assert.strictEqual(first, again);
  assert.strictEqual(renderer.capabilities.getMaxAnisotropy, wrapped);
});

test('missing or unsupported renderer fails open', () => {
  const guard = loadGuard();
  assert.equal(guard.attach(null, { tier: 'compact' }).enabled, false);
  assert.equal(guard.attach({ capabilities: {} }, { tier: 'compact' }).enabled, false);
  assert.equal(guard.getInfo().reason, 'renderer-not-supported');
});

test('no periodic timers, global quality governor or requestAnimationFrame override', () => {
  const guard = loadGuard(), renderer = mockRenderer(16);
  guard.attach(renderer, { tier: 'compact' });
  assert.equal(typeof guard.attach, 'function');
  assert.doesNotMatch(script, /requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(|setPixelRatio\s*\(/);
  assert.doesNotMatch(script, /\bfetch\s*\(|\bsendBeacon\s*\(/);
});
