// Non-WebGL regression checks for the real Unfire Audio room/island doorway.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const enginePath = process.env.UNFIRE_ENGINE_PATH ||
  path.join(__dirname, '..', 'audio', 'maletin', 'game-engine-v50.js');
const source = fs.readFileSync(enginePath, 'utf8');
const start = source.indexOf('function roamMove(f, side = 0)');
const stop = source.indexOf("addEventListener('keydown', (e) => { if (!ROAMS.on", start);
assert.ok(start >= 0 && stop > start, 'Live roamMove function must remain available');
const roamMoveSource = source.slice(start, stop).trim();
assert.ok(roamMoveSource.endsWith('}'), 'Door movement function extraction must be complete');

function scene({ outside = false, x = -30, z = 92, yaw = Math.PI, obstacles = [] } = {}) {
  const exits = [];
  const ROAMS = { p: { x, y: 0, z }, yaw, h: 4, mini: false, stkN: 0 };
  const insideBounds = { x: 81, z0: -17.5, z1: 97.5 };
  const outsideBounds = { x: 12000, z0: -12000, z1: 12000 };
  const window = {
    ATM_OUT: outside, __OBST: obstacles, __OBSTO: [],
    __RB: outside ? outsideBounds : insideBounds
  };
  const ATM = { setOut(value) {
    exits.push(Boolean(value));
    window.ATM_OUT = Boolean(value);
    window.__RB = value ? outsideBounds : insideBounds;
  } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const move = vm.runInNewContext('(' + roamMoveSource + ')',
    { ROAMS, window, ATM, clamp, console });
  return { move, ROAMS, window, exits };
}

test('walking through the actual doorway enters the island once', () => {
  const s = scene();
  s.move(3);
  assert.equal(s.window.ATM_OUT, true);
  assert.deepEqual(s.exits, [true]);
  assert.ok(s.ROAMS.p.z > 93, 'avatar advances across threshold');
  s.move(1);
  assert.deepEqual(s.exits, [true], 'cannot repeatedly trigger exterior mode');
});

test('walking back through the same doorway returns to the house once', () => {
  const s = scene({ outside: true, z: 94, yaw: 0 });
  s.move(3);
  assert.equal(s.window.ATM_OUT, false);
  assert.deepEqual(s.exits, [false]);
  assert.ok(s.ROAMS.p.z < 93);
});

test('crossing the exterior wall away from the door does not teleport', () => {
  const s = scene({ outside: true, x: 0, z: 94, yaw: 0 });
  s.move(3);
  assert.equal(s.window.ATM_OUT, true);
  assert.equal(s.ROAMS.p.z, 94, 'wall prevents penetration');
  assert.deepEqual(s.exits, []);
});

test('interior solid objects block locomotion instead of being penetrated', () => {
  const s = scene({ x: 0, z: 60, obstacles:
    [{ x0: -2, x1: 2, z0: 62, z1: 67, y1: 10 }] });
  s.move(4);
  assert.ok(s.ROAMS.p.z <= 62, 'avatar stays outside collision box');
  assert.deepEqual(s.exits, []);
});

test('outdoor collision warming remains incremental rather than blocking door exit', () => {
  assert.match(source, /window\.__buildObstOut\s*=\s*function/);
  assert.match(source, /window\.__warmOutsideObstacles\s*=\s*function/);
  assert.match(source, /performance\.now\(\)\s*\+\s*3\.5/);
  assert.match(source, /processed\s*<\s*45/);
  assert.match(source, /setTimeout\(batch,\s*24\)/);
  assert.ok(source.includes('if(window.__warmOutsideObstacles)window.__warmOutsideObstacles();'),
    'outdoor mode requests staged collision warmup');
});
