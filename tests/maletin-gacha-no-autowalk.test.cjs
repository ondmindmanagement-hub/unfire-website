'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = fs.readFileSync(process.env.GAME_ENGINE_PATH || path.resolve(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const dispatch = engine.match(/pick\(ray, maxD = Infinity\) \{(.*?)\}, toggleDark \};/s);
assert.ok(dispatch, 'The real ROOM.pick handler must be present');
const pick = new Function('ray', 'maxD', 'picks', 'ROAMS', 'THREE', 'cam', 'V', 'clamp', dispatch[1]);
const V = (x, y, z) => ({ x, y, z, normalize() { const d = Math.hypot(x, y, z) || 1; this.x /= d; this.y /= d; this.z /= d; return this; } });
const THREE = { Box3: class { setFromObject() { return this; } getCenter() { return V(0, 2, 0); } getSize() { return { length: () => 3 }; } } };
const cam = { position: { x: 0, y: 5, z: 12 } };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rayFor = (object) => ({ intersectObjects: () => [{ object, distance: 2 }] });
const call = (entry, roams) => pick(rayFor(entry.o), Infinity, [entry], roams, THREE, cam, V, clamp);

test('gacha machine and prize pedestal opt out of player auto-route', () => {
  assert.match(engine, /picks\.push\(\{ o: gm, f: go, noFocus: true \}\)/);
  assert.match(engine, /picks\.push\(\{ o: ped, noFocus: true, f:/);
  assert.match(engine, /const go = \(\) => \{ if \(phase !== 'idle' && phase !== 'show'\) \{ queued = true; return; \} ROAMS\.tgt = null;/);
  assert.match(engine, /o: ped, noFocus: true, f: \(\) => \{ ROAMS\.tgt = null;/);
  for (const kind of ['machine', 'pedestal']) {
    const ROAMS = { on: true, tgt: { p: V(30, 0, 10) } };
    let spins = 0;
    const entry = { o: { name: kind }, noFocus: true, f: () => { ROAMS.tgt = null; spins++; } };
    assert.equal(call(entry, ROAMS), true);
    assert.equal(spins, 1);
    assert.equal(ROAMS.tgt, null, `${kind} must not create or retain a route`);
  }
});

test('non-gacha room interactions retain their normal focus behavior', () => {
  const ROAMS = { on: true, tgt: null };
  let clicks = 0;
  const entry = { o: { name: 'other object' }, f: () => { clicks++; } };
  assert.equal(call(entry, ROAMS), true);
  assert.equal(clicks, 1);
  assert.ok(ROAMS.tgt && ROAMS.tgt.p, 'Other room props should still focus normally');
});
