'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const start = source.indexOf('  function roamMove(f, side = 0) {');
const end = source.indexOf("\n  addEventListener('keydown'", start);
assert.ok(start >= 0 && end > start, 'motor real de movimiento encontrado');
const movement = source.slice(start, end);

function runMove({ outside, x = 0, z = 0, yaw = Math.PI / 2, horizontal = 0,
                   side = 0, h = 80, obst = [] }) {
  let areaChanges = 0, queried = 0;
  const ROAMS = { yaw, h, p: { x, z }, mini: false };
  const window = { ATM_OUT: outside, __RB: { x: 77.5, z0: -14, z1: 93.5 },
                   __OBSTO: obst, __OBST: obst };
  const context = { ROAMS, window,
    avatarProfile() { return { radius: 1.5, height: 10 }; },
    COLLISION(boxes) { queried++; return boxes; },
    NANO_PHYSICS: { move2D(p, v, boxes) {
      return boxes.length ? { x: p.x, z: p.z, blocked: true } :
        { x: p.x + v.x, z: p.z + v.z, blocked: false };
    } },
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    ATM: { setOut(next) { areaChanges++; window.ATM_OUT = next; } },
    Math,
  };
  vm.createContext(context);
  vm.runInContext(movement + '\nroamMove(moveForward, moveSide);',
    Object.assign(context, { moveForward: horizontal, moveSide: side }));
  return { x: ROAMS.p.x, z: ROAMS.p.z, outside: window.ATM_OUT, queried, areaChanges,
           blocked: !!ROAMS.stkN };
}
for (const speed of [1, 3, 8]) {
  test('outside x' + speed + ' moves past interior x limit without bounce', () => {
    const speedDistance = 42 * speed;
    const result = runMove({ outside: true, horizontal: speedDistance, yaw: Math.PI / 2 });
    assert.ok(Math.abs(result.x - speedDistance) < 0.01,
      'expected uninterrupted exterior translation, got x=' + result.x);
    assert.ok(result.queried > 0);
    assert.equal(result.blocked, false);
  });
  test('outside x' + speed + ' can explore negative z beyond the house', () => {
    const result = runMove({ outside: true, horizontal: 45 * speed, yaw: 0 });
    assert.ok(result.z < -20, 'must escape house z clamp, got ' + result.z);
  });
}
test('indoor movement still respects house walls', () => {
  const r = runMove({ outside: false, horizontal: 450, yaw: Math.PI / 2 });
  assert.ok(r.x <= 76.1 && r.x >= 75.9, 'indoor safety limit still enforced');
  assert.equal(r.outside, false);
});
test('exterior flying still collides with real intersecting obstacles', () => {
  const obstacle = { x0: 20, x1: 25, z0: -10, z1: 10, y0: 70, y1: 120 };
  const r = runMove({ outside: true, horizontal: 250, obst: [obstacle] });
  assert.equal(r.x, 0);
  assert.equal(r.blocked, true);
});
test('outdoor entry into a closed house at ground level stays blocked', () => {
  const r = runMove({ outside: true, x: 83, z: 30, h: 12, yaw: -Math.PI / 2, horizontal: 30 });
  assert.equal(r.x, 83);
});
test('overflying the house above its roof is permitted', () => {
  const r = runMove({ outside: true, x: 90, z: 30, h: 90, yaw: -Math.PI / 2, horizontal: 50 });
  assert.ok(r.x < 82, 'flight above roof should cross the house footprint');
});
