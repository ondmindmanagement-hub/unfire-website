'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const implementation = src.match(/function nearRoomObject\(player, object, radius\) \{[^\n]*\}/);
assert.ok(implementation, 'The proximity predicate must exist');
const nearRoomObject = vm.runInNewContext('(' + implementation[0] + ')');

test('near the ball machine uses planar player position, not remote camera waypoint', () => {
  const machine = { position: { x: 44, y: -8.9, z: 8 } };
  assert.equal(nearRoomObject({ x: 44, z: 8 }, machine, 20), true);
  assert.equal(nearRoomObject({ x: 63.9, z: 8 }, machine, 20), true);
  assert.equal(nearRoomObject({ x: 64.1, z: 8 }, machine, 20), false);
  assert.equal(nearRoomObject({ x: 44, z: 40 }, machine, 20), false);
  assert.equal(nearRoomObject({ x: 44, y: 200, z: 8 }, machine, 20), true);
});

test('invalid or missing player positions do not bypass approach', () => {
  const machine = { position: { x: 44, z: 8 } };
  for (const player of [null, undefined, { x: NaN, z: 8 }, { x: 1, z: Infinity }]) {
    assert.equal(nearRoomObject(player, machine, 20), false);
  }
});

test('machine click opts out of long walk only inside direct interaction radius', () => {
  assert.match(src, /const GACHA_DIRECT_RANGE = 20; let directGacha = false;/);
  assert.match(src, /picks\.push\(\{ o: gm, f: go, noFocusWithin: GACHA_DIRECT_RANGE \}\)/);
  assert.match(src, /const directInteraction = ROAMS\.on && P\.noFocusWithin && nearRoomObject\(ROAMS\.p, P\.o, P\.noFocusWithin\); P\.f\(\);/);
  assert.match(src, /if \(directInteraction\) ROAMS\.tgt = null; if \(ROAMS\.on && !P\.noFocus && !directInteraction\)/);
});

test('gacha animation cannot put a nearby robot back onto an old auto-route', () => {
  assert.match(src, /directGacha = !!ROAMS\.on && nearRoomObject\(ROAMS\.p, gm, GACHA_DIRECT_RANGE\)/);
  assert.match(src, /if \(directGacha\) \{ R\.userData\.camTrack = null; ROAMS\.tgt = null; \}/);
  assert.match(src, /const track = \(p\) => \{ if \(directGacha\) \{ R\.userData\.camTrack = null; ROAMS\.tgt = null; return; \} gm\.localToWorld/);
  assert.match(src, /else \{ phase = 'spin'; ph = 0; \}/);
});

test('far interactions retain the original focus/approach behavior', () => {
  assert.match(src, /if \(ROAMS\.on && !P\.noFocus && !directInteraction\) \{/);
  assert.match(src, /ROAMS\.tgt = \{ p, yaw: Math\.atan2\(lx, -lz\), pitch:/);
});
