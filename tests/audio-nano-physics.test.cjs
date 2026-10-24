'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const phys = require('../audio/maletin/nano-physics.js');

test('Nano height matches mini robots; camera, radius and speed are proportional but playable', () => {
  const human = phys.profile(false), nano = phys.profile(true);
  assert.equal(nano.height, 0.24);
  assert.equal(human.height, 10.5);
  assert.ok(Math.abs(nano.scale - 0.24 / 10.5) < 1e-10);
  assert.ok(nano.radius < human.radius / 5);
  assert.ok(nano.walkSpeed < human.walkSpeed);
  assert.ok(nano.walkSpeed > 6, 'free exploration must not take minutes to cross a room');
  assert.ok(nano.gravity < human.gravity);
  assert.ok(nano.eyeHeight < human.eyeHeight);
});

test('All 3 camera modes work in normal and nano forms, with invisible avatar in first person', () => {
  for (const nano of [false, true]) {
    const p = phys.profile(nano);
    const s = { x: -30, z: 75, footY: -8.9, yaw: Math.PI / 3, pitch: -0.1, nano };
    const one = phys.cameraPose('1p', s, p);
    const two = phys.cameraPose('2p', s, p);
    const three = phys.cameraPose('3p', s, p);
    assert.equal(one.showAvatar, false);
    assert.equal(two.showAvatar, true);
    assert.equal(three.showAvatar, true);
    assert.equal(one.position.x, s.x);
    assert.equal(one.position.z, s.z);
    assert.ok(one.position.y > s.footY && one.position.y < s.footY + p.height);
    assert.ok(Math.hypot(two.position.x - s.x, two.position.z - s.z) > 0);
    assert.ok(Math.hypot(three.position.x - s.x, three.position.z - s.z) >
      Math.hypot(two.position.x - s.x, two.position.z - s.z));
    assert.ok(three.near <= 0.1 && three.near >= 0.004);
    assert.equal(phys.cameraPose('3pl', s, p).mode, '3p');
  }
  assert.deepEqual(['3p', '2p', '1p', '3p'],
    ['3p', phys.nextCameraMode('3p'), phys.nextCameraMode('2p'), phys.nextCameraMode('1p')]);
  assert.throws(() => phys.cameraPose('infinite', {}, phys.profile(false)), /camera mode/);
});

test('Nano collides with a small solid obstacle instead of phasing through it', () => {
  const p = phys.profile(true), pad = 1.1;
  const wall = { x0: 2 - pad, x1: 2.2 + pad, z0: -1 - pad, z1: 1 + pad, y0: -9, y1: 0 };
  const moved = phys.move2D({ x: 0, z: 0 }, { x: 5, z: 0 }, [wall], p, { footY: -8.9 });
  assert.equal(moved.blocked, true);
  assert.ok(moved.x < 2 - p.radius + 0.001, 'capsule must stop ahead of obstacle');
  assert.ok(moved.x > 0, 'capsule must approach obstacle, not remain frozen');
});

test('Nano can pass through gaps too small for a normal-sized robot', () => {
  const nano = phys.profile(true), normal = phys.profile(false);
  const pad = 1.1;
  const boxes = [
    { x0: 1-pad, x1: 2+pad, z0: -2-pad, z1: -0.14+pad, y1: 10 },
    { x0: 1-pad, x1: 2+pad, z0: 0.14-pad, z1: 2+pad, y1: 10 }
  ];
  const mini = phys.move2D({ x: 0, z: 0 }, { x: 4, z: 0 }, boxes, nano, { footY: 0 });
  const big = phys.move2D({ x: 0, z: 0 }, { x: 4, z: 0 }, boxes, normal, { footY: 0 });
  assert.ok(mini.x > 3.9, '0.28-wide gap should admit 0.12-wide nano capsule');
  assert.ok(big.x < 1, 'normal robot must not fit through miniature passage');
});

test('Collision side-slide works without clipping through a wall at 45 degrees', () => {
  const p = phys.profile(true);
  const wall = { x0: 1 - 1.1, x1: 1.1 + 1.1, z0: -4 - 1.1, z1: 4 + 1.1, y1: 10 };
  const move = phys.move2D({ x: 0, z: 0 }, { x: 2, z: 2 }, [wall], p, { footY: 0 });
  assert.ok(move.blocked);
  assert.ok(move.x < 1 - p.radius + 0.01);
  assert.ok(move.z > 1, 'player must retain lateral movement along the wall');
});

test('Step budget truncates huge delta rather than tunneling through 0.2-unit obstacles', () => {
  const p = phys.profile(true);
  const obs = [{ x0: 2 - 1.1, x1: 2.2 + 1.1, z0: -3 - 1.1, z1: 3 + 1.1, y1: 10 }];
  const move = phys.move2D({ x: 0, z: 0 }, { x: 1000, z: 0 }, obs, p, { footY: 0 });
  assert.equal(move.truncated, true);
  assert.ok(move.x < 2);
});

test('A landed nano can fly, hover when released, descend, and land without sinking', () => {
  const p = phys.profile(true);
  let s = { h: 0, vy: 0 };
  for (let n = 0; n < 90; n++) s = phys.updateVertical(s, { fly: true, up: 1, floor: 0, ceiling: 30 }, p, 1/60);
  const ascended = s.h;
  assert.ok(ascended > 1 && ascended < 30-p.height);
  for (let n = 0; n < 90; n++) s = phys.updateVertical(s, { fly: true, floor: 0, ceiling: 30 }, p, 1/60);
  assert.ok(s.h >= ascended - 0.25 && s.h <= ascended + 1, 'release must hover');
  for (let n = 0; n < 240; n++) s = phys.updateVertical(s, { fly: true, down: 1, floor: 0, ceiling: 30 }, p, 1/60);
  assert.equal(s.h, 0);
  assert.equal(s.vy, 0);
  assert.ok(s.grounded);
});

test('No ceiling penetration or negative floor; height scaled limits still respected', () => {
  for (const nano of [false, true]) {
    const p = phys.profile(nano);
    let s = { h: 1, vy: 9999 };
    s = phys.updateVertical(s, { fly: true, up: 1, floor: 0, ceiling: 12 }, p, 100);
    assert.ok(s.h <= 12-p.height);
    assert.ok(s.h >= 0);
    s = phys.updateVertical({ h: -20, vy: -999 }, { fly: false, floor: 0, ceiling: 20 }, p, 0.016);
    assert.equal(s.h, 0);
    assert.equal(s.vy, 0);
  }
});

test('Morph preserves coordinates in free space and refuses to grow inside walls', () => {
  const big = phys.profile(false), small = phys.profile(true);
  const boxes = [{ x0: -0.5 - 1.1, x1: 0.5 + 1.1, z0: -0.5 - 1.1, z1: 0.5 + 1.1, y1: 40 }];
  const free = phys.safeMorphPosition({ x: 30, z: 30 }, big, boxes);
  assert.deepEqual(free, { x: 30, z: 30, moved: false, safe: true });
  const blocked = phys.safeMorphPosition({ x: 0, z: 0 }, big, boxes);
  assert.ok(blocked.safe && blocked.moved || !blocked.safe,
    'must seek clearance or reject transformation, never overlap a solid object');
  const nanoFree = phys.safeMorphPosition({ x: 1, z: 1 }, small, boxes);
  assert.equal(nanoFree.safe, true);
});

test('Moving diagonally cannot exceed speed cap; acceleration and braking remain stable', () => {
  const p = phys.profile(true);
  const opts = { obstacles: [], footY: 0 };
  let s = { x: 0, z: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 60; i++) {
    const t = phys.updateWalk(s, { x: 1, z: 1, run: true }, p, 1/60, opts);
    s = t;
    assert.ok(Math.hypot(t.vx, t.vz) <= p.runSpeed + 0.00001);
  }
  const fast = Math.hypot(s.vx, s.vz);
  assert.ok(fast > p.walkSpeed);
  for (let i = 0; i < 60; i++) s = phys.updateWalk(s, { x: 0, z: 0 }, p, 1/60, opts);
  assert.ok(Math.hypot(s.vx, s.vz) < fast * 0.02);
});

test('Free-roam robot forms do not advance missions', () => {
  assert.equal(phys.missionsEnabled('robot'), false);
  assert.equal(phys.missionsEnabled('nano'), false);
  assert.equal(phys.missionsEnabled('minirobot'), false);
  assert.equal(phys.missionsEnabled('story'), true);
});
