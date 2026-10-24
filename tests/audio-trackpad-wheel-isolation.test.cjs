'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'audio/maletin/game-engine-v50.js'), 'utf8');
const markup = fs.readFileSync(path.join(root, 'audio/maletin/index.html'), 'utf8');
const garage = fs.readFileSync(path.join(root, 'audio/maletin/garage-scroll-guard.js'), 'utf8');

function createWheel({ roaming = true, inspecting = false, lidOpen = 0.5, overCase = false } = {}) {
  const startMarker = "  addEventListener('wheel', (e) => { if (CINE.on) CINE.on = false;";
  const endMarker = "  }, { passive: false });";
  const start = engine.indexOf(startMarker);
  assert.ok(start >= 0, 'main wheel handler still present');
  const end = engine.indexOf(endMarker, start);
  assert.ok(end > start, 'main wheel handler still has passive:false');
  assert.equal(engine.indexOf(startMarker, start + 1), -1, 'only one global wheel listener');
  const script = engine.slice(start, end + endMarker.length);
  const state = { moves: 0, open: 0, zooms: 0, posts: [], wheel: null, cancellations: 0 };
  const ctx = {
    CINE: { on: false },
    cv: { id: 'game-canvas' },
    document: { body: { id: 'body' }, documentElement: { id: 'html' } },
    ROAMS: { on: roaming, tgt: { x: 1, z: 2 } },
    CASE_VIEW: { on: inspecting, dist: 8 },
    cursorPoint: () => ({ x: 0, z: 0 }),
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    window: { ATM_OUT: false },
    lidOpen,
    parentPost: (msg) => state.posts.push(msg),
    roamMove: () => { state.moves++; },
    avatarProfile: () => { throw Error('wheel must not query avatar motion profile'); },
    ROOM: { R: { userData: { camTrack: 'keep' } } },
    ndc: { set() {} }, cam: {}, innerWidth: 1280, innerHeight: 800,
    ray: { setFromCamera() {}, intersectObject: () => overCase ? [{}] : [], intersectObjects: () => [] },
    caseG: {}, gates: [], compG: {},
    allOpen: () => false, openAllComp: () => { state.open++; }, openComp: () => { state.open++; },
    zoomed: () => true, zoomBy: () => { state.zooms++; },
    view: { gd: 4, D0: 10, gx: 0, gz: 0, dist: 8 },
    performance: { now: () => 1200 }, wheelHold: 0,
    addEventListener: (type, fn, options) => {
      assert.equal(type, 'wheel'); assert.equal(options.passive, false); state.wheel = fn;
    }
  };
  vm.runInNewContext(script, ctx, { timeout: 1000 });
  assert.equal(typeof state.wheel, 'function');
  return { state, ctx, wheel(deltaY, deltaX = 0, ctrlKey = false, target = ctx.cv) {
    state.wheel({ deltaY, deltaX, deltaMode: 0, clientX: 500, clientY: 350, target,
      ctrlKey, preventDefault() { state.cancellations++; } });
  } };
}

test('story: trackpad scroll neither moves avatar nor cancels click-to-move', () => {
  const t = createWheel();
  t.wheel(90, 40);
  t.wheel(-120, -65);
  assert.equal(t.state.moves, 0);
  assert.deepEqual(t.ctx.ROAMS.tgt, { x: 1, z: 2 });
  assert.equal(t.ctx.ROOM.R.userData.camTrack, 'keep');
  assert.equal(t.state.cancellations, 2);
});

test('online: identical shared engine ignores wheel input while roaming', () => {
  const t = createWheel({ roaming: true });
  t.ctx.ROAMS.online = true;
  t.wheel(100, 30);
  assert.equal(t.state.moves, 0);
  assert.equal(t.state.posts.length, 0);
  assert.deepEqual(t.ctx.ROAMS.tgt, { x: 1, z: 2 });
});

test('any overlay gets native wheel scroll without moving avatar or blocking the list', () => {
  const t = createWheel({ roaming: true });
  t.wheel(130, 0, false, { id: 'menu-scroll-container' });
  assert.equal(t.state.moves, 0);
  assert.equal(t.state.cancellations, 0);
  assert.deepEqual(t.ctx.ROAMS.tgt, { x: 1, z: 2 });
});

test('briefcase inspection during roaming still zooms with two-finger wheel', () => {
  const t = createWheel({ roaming: true, inspecting: true });
  t.wheel(100);
  assert.equal(t.ctx.CASE_VIEW.dist, 9.3);
  assert.equal(t.state.moves, 0);
  t.wheel(-100);
  assert.equal(t.ctx.CASE_VIEW.dist, 8);
});

test('briefcase entry outside roaming preserves scroll-to-host behavior', () => {
  const t = createWheel({ roaming: false, lidOpen: 0.25 });
  t.wheel(80);
  assert.equal(t.state.posts.length, 1);
  assert.equal(t.state.posts[0].scroll, 80);
  assert.equal(t.state.posts[0].pass, 1);
});

test('briefcase component still opens on wheel when aiming at case', () => {
  const t = createWheel({ roaming: false, lidOpen: 1, overCase: true });
  t.wheel(100);
  assert.equal(t.state.open, 1);
});

test('briefcase trackpad pinch still invokes zoom', () => {
  const t = createWheel({ roaming: false, lidOpen: 1, overCase: false });
  t.wheel(-60, 0, true);
  assert.equal(t.state.zooms, 1);
});

test('garage scroll guard is installed once for shared Story and Online UI', () => {
  assert.match(markup, /garage-scroll-guard\.js\?v=/);
  assert.match(garage, /event\.stopPropagation\(\)/);
  assert.match(garage, /overscroll-behavior:contain/);
  assert.match(garage, /list\.scrollTop=before/);
});
