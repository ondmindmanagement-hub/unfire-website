'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const e = require('./engine.js');

test('all presets have safe valid sizes and unique ids', () => {
  const ids = new Set();
  for (const p of e.presets) {
    e.validateDimensions(p.width, p.height);
    assert.equal(ids.has(p.id), false);
    ids.add(p.id);
  }
});
test('cover crops to fill output and moves focal point', () => {
  const l = e.computePlacement(1000, 1000, 2000, 1000, 'cover', 0, 50);
  const r = e.computePlacement(1000, 1000, 2000, 1000, 'cover', 100, 50);
  assert.equal(l.width, 2000);
  assert.equal(l.height, 2000);
  assert.equal(l.x, 0);
  assert.equal(l.y, -500);
  assert.equal(r.y, -500);
  const top = e.computePlacement(1000, 1000, 2000, 1000, 'cover', 50, 0);
  assert.equal(top.y, 0);
});
test('contain letterboxes and positions correctly', () => {
  const p = e.computePlacement(1000, 1000, 2000, 1000, 'contain', 50, 50);
  assert.deepEqual(p, { x: 500, y: 0, width: 1000, height: 1000 });
});
test('invalid sizes and fit modes are rejected', () => {
  for (const [w, h] of [[0, 100], [9000, 100], [5000, 5000], [100.3, 100]]) {
    assert.throws(() => e.validateDimensions(w, h));
  }
  assert.throws(() => e.computePlacement(0, 200, 100, 100, 'cover', 50, 50));
  assert.throws(() => e.computePlacement(200, 200, 100, 100, 'stretch', 50, 50));
});
test('clean safe export names without path traversal', () => {
  assert.equal(e.exportName('../../My photo.jpg', 1080, 1080, 'png'), 'My-photo-1080x1080.png');
  assert.equal(e.exportName('', 800, 800, 'jpg'), 'artwork-800x800.jpg');
});
