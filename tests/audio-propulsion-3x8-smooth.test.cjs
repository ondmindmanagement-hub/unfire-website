'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');

function createMotion(height, obstacle, outside = true) {
  const begin = source.indexOf('  function roamMove(f, side = 0) {');
  const end = source.indexOf("  addEventListener('keydown'", begin);
  assert.ok(begin > 0 && end > begin, 'use the real movement function');
  let physicsCalls = 0;
  const ROAMS = { p: { x: 300, z: 300 }, h: height, yaw: Math.PI / 2, stkN: 0, fly: height > 10, mini: false };
  const window = { ATM_OUT: outside, __RB: { x: 12000, z0: -12000, z1: 12000 },
    __OBSTO: [obstacle], __OBST: [obstacle] };
  const profile = { height: 10.5, radius: 1.8 };
  const NANO_PHYSICS = {
    move2D(start, delta, candidates) {
      physicsCalls++;
      assert.equal(candidates.length, 1);
      return { x: start.x, z: start.z, blocked: true };
    }
  };
  const env = {
    ROAMS, window, avatarProfile: () => profile, NANO_PHYSICS,
    COLLISION: () => [obstacle], clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    Math, ATM: { setOut() { throw Error('unexpected house transition'); } }
  };
  vm.runInNewContext(source.slice(begin, end) + '\nthis.roamMove = roamMove;', env, { timeout: 500 });
  return { ROAMS, move: env.roamMove, get physicsCalls() { return physicsCalls; } };
}

test('x1/x3/x8 above buildings maintains uninterrupted travel without unnecessary solver steps', () => {
  const below = { x0: 301, x1: 800, z0: 295, z1: 305, y0: -9, y1: 35 };
  for (const gear of [1, 3, 8]) {
    const r = createMotion(400, below);
    const initial = r.ROAMS.p.x;
    const delta = 4 * gear;
    for (let i = 0; i < 60; i++) r.move(delta, 0);
    assert.ok(Math.abs(r.ROAMS.p.x - initial - delta * 60) < 1e-6, 'x' + gear + ' continuous travel');
    assert.equal(r.physicsCalls, 0, 'x' + gear + ' obstacle below altitude');
  }
});

test('grounded avatar still collides with walls; never bypass ground obstacles', () => {
  const wall = { x0: 304, x1: 330, z0: 290, z1: 310, y0: -9, y1: 30 };
  const r = createMotion(0, wall);
  r.move(10);
  assert.equal(r.physicsCalls, 1);
  assert.equal(r.ROAMS.p.x, 300);
  assert.ok(r.ROAMS.stkN > 0);
});

test('tall structures engage swept collision even in x8 flight', () => {
  const tower = { x0: 304, x1: 330, z0: 290, z1: 310, y0: 0, y1: 600 };
  const r = createMotion(400, tower);
  r.move(55);
  assert.equal(r.physicsCalls, 1);
  assert.equal(r.ROAMS.p.x, 300);
});

test('gear changes never trigger synthesized repetitive high-speed pulses', () => {
  const begin = source.indexOf('  const GS = (() =>');
  const end = source.indexOf('  const SPEEDL = (() =>', begin);
  assert.ok(begin > 0 && end > begin);
  const audio = source.slice(begin, end);
  assert.doesNotMatch(audio, /P\.hyper\(|hyper\(up\)|ok\('hyp'/);
  assert.match(audio, /if \(!ROAMS\.fly && \(ROAMS\.stkN/);
  assert.match(audio, /P\.wings\(\!\!ROAMS\.fly\)/);
  assert.match(audio, /P\.land\(/);
});

test('acceleration and camera smoothing are frame-time based without synthetic altitude bob', () => {
  assert.match(source, /const flightProp = window\.ATM_OUT && ROAMS\.fly && window\.__PROP/);
  assert.equal((source.match(/NANO_CINEMA\.cruise\(vv0, flightProp/g) || []).length, 2);
  assert.equal((source.match(/2\.6 \* flightProp/g) || []).length, 2);
  assert.match(source, /Math\.exp\(-3\.2 \* dt\)/);
  assert.match(source, /ROAMS\.vy = \(ROAMS\.flyH - ROAMS\.h\) \* 6;/);
  assert.doesNotMatch(source, /ROAMS\.flyH \+ Math\.sin\(t \* 2\)/);
  assert.match(source, /ROAMS\.cp\.lerp\(want, 1 - Math\.exp\(-rate \* dt\)\)/);
  for (const gear of [1, 3, 8]) for (const dt of [1 / 60, 1 / 30, 0.05]) {
    const rate = 11 + Math.min(16, 34 * 1.55 * 2.6 * gear / 100);
    const alpha = 1 - Math.exp(-rate * dt);
    assert.ok(alpha > 0 && alpha < 1, 'camera never hard-snaps per frame');
  }
});
