'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engine = fs.readFileSync(path.resolve(__dirname, '..', 'audio/maletin/game-engine-v50.js'), 'utf8');
const frameStart = engine.indexOf('function frame(');
const start = engine.indexOf('    if (window.__DOME) {', frameStart);
const end = engine.indexOf('    // sonido de mar', start);
assert.ok(frameStart >= 0 && start > frameStart && end > start, 'production dome frame code remains locatable');
const logic = engine.slice(start, end);

function makeState({ outside = false, x = 0, z = 40, h = 39, fly = true, open = 0.82, mini = false, on = true, vy = -4 } = {}) {
  const changes = [];
  const said = [];
  const dome = { c: { x: 0, y: 26.4, z: 40 }, open, PET: Array.from({ length: 12 }, () => ({ rotation: { z: 0 } })) };
  const window = { ATM_OUT: outside, __DOME: dome };
  const ROAMS = { on, mini, p: { x, z }, h, fly, flyH: h, vy };
  const ATM = { setOut(v) {
    changes.push(v);
    window.ATM_OUT = v;
  } };
  const tick = (dt = 1 / 30) => vm.runInNewContext(logic, { window, ROAMS, ATM, say: (m) => said.push(m), dt, Math }, { timeout: 300 });
  return { window, ROAMS, dome, changes, said, tick };
}

test('inside flight through open roof exits outdoors without teleporting', () => {
  const s = makeState({ h: 39, fly: true });
  const before = { ...s.ROAMS.p, h: s.ROAMS.h };
  s.tick();
  assert.deepEqual(s.changes, [true]);
  assert.equal(s.window.ATM_OUT, true);
  assert.equal(s.ROAMS.h, before.h);
  assert.deepEqual(s.ROAMS.p, { x: before.x, z: before.z });
  assert.equal(s.ROAMS.fly, true);
  assert.ok(s.ROAMS.flyH >= before.h);
  assert.ok(s.ROAMS.vy >= 0);
  s.tick();
  assert.deepEqual(s.changes, [true], 'no immediate in/out oscillation');
});

test('dome starts opening while player ascends from inside', () => {
  const s = makeState({ h: 16, open: 0 });
  for (let i = 0; i < 25; i++) s.tick(1 / 30);
  assert.ok(s.dome.open > 0.6);
  assert.equal(s.window.ATM_OUT, false, 'door opens before player reaches the roof');
  assert.ok(s.dome.PET.every(p => Number.isFinite(p.rotation.z)));
});

test('outside descent through opened dome enters room smoothly', () => {
  const s = makeState({ outside: true, h: 33, open: 0.9 });
  const originalHeight = s.ROAMS.h;
  s.tick();
  assert.deepEqual(s.changes, [false]);
  assert.equal(s.ROAMS.h, originalHeight, 'no sudden altitude drop at roof crossing');
  assert.equal(s.ROAMS.flyH, 12, 'inside flight target gradually descends');
  s.tick();
  assert.deepEqual(s.changes, [false]);
});

test('inside never teleports outdoors from the roof when not flying', () => {
  const s = makeState({ h: 42, fly: false, open: 0.9 });
  s.tick();
  assert.deepEqual(s.changes, []);
});

test('outside transition requires a centered opening and adequate height', () => {
  const edge = makeState({ h: 40, x: 36, open: 0.9 });
  edge.tick();
  assert.deepEqual(edge.changes, []);
  const low = makeState({ h: 30, open: 0.9 });
  low.tick();
  assert.deepEqual(low.changes, []);
});

test('non-playing and miniature modes cannot cross the dome', () => {
  for (const options of [{ on: false }, { mini: true }]) {
    const s = makeState({ ...options, open: 0.9, h: 41 });
    s.tick();
    assert.deepEqual(s.changes, []);
  }
});

test('outside flight does not re-enter at or above the roof threshold', () => {
  const s = makeState({ outside: true, h: 41, open: 0.9 });
  s.tick();
  assert.deepEqual(s.changes, []);
  assert.equal(s.window.ATM_OUT, true);
});

test('dome petals close progressively when the player leaves the area', () => {
  const s = makeState({ outside: true, x: 300, z: 40, open: 0.9 });
  s.tick();
  assert.ok(s.dome.open > 0 && s.dome.open < 0.9);
  assert.ok(s.dome.PET.every(p => Number.isFinite(p.rotation.z)));
});

test('outdoor collisions prewarm once in background before dome exit', () => {
  const s = makeState({ h: 18, open: 0 });
  let warmCalls = 0;
  s.window.__warmOutsideObstacles = () => {
    warmCalls++;
    s.window.__obstWarmPending = true;
  };
  for (let i = 0; i < 40; i++) s.tick();
  assert.equal(warmCalls, 1, 'repeated frames must not start multiple warmups');
  assert.equal(s.window.ATM_OUT, false, 'preparation precedes crossing');
  s.window.__obstWarmPending = false;
  s.window.__obstWarmReady = true;
  s.tick();
  assert.equal(warmCalls, 1, 'do not recreate prepared collision data');
});

test('door locomotion and collision entry points stay in the active motor', () => {
  assert.match(engine, /function roamMove\(f, side = 0\)/);
  assert.match(engine, /ATM\.setOut\(true\)/);
  assert.match(engine, /window\.__warmOutsideObstacles/);
  assert.match(engine, /__UNFIRE_AUTOCALIB/, 'device-based rendering budget remains available');
});

test('only dome-controlled transition can switch indoor/outdoor at the roof', () => {
  assert.doesNotMatch(engine, /if \(inDomeT &&[^\n]+ATM\.setOut\(true\)/);
  assert.match(logic, /dome\.open > 0\.6 && radius < 34/);
});
