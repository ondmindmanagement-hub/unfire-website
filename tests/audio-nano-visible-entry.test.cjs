'use strict';
// Exercise the real story-HUD robotMode handler in a small isolated VM.
// This does not replace the real WebGL/phone acceptance test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engine = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../audio/maletin/index.html'), 'utf8');
const start = engine.indexOf('robotMode: () => {');
const end = engine.indexOf(', isNano:', start);
assert(start > 0 && end > start, 'Real NANO story handler must exist on v50');
const actual = engine.slice(start, end + 1);

function scenario(initialMode, recording = false) {
  const calls = { roam: 0, start: 0, stopRecord: 0, view: 0, messages: [] };
  const R = {
    on: false, mini: false, mode: initialMode,
    h: 0, yaw: 0, p: {
      x: 99, y: 99, z: 99,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    }, k: {}
  };
  const recordingState = { on: recording, set(v) { calls.stopRecord++; this.on = v; } };
  const cameraButton = { textContent: 'old camera mode' };
  const cinema = {
    busy: () => false,
    start: () => { calls.start++; return true; }
  };
  const context = {
    ROAMS: R, REC: recordingState, camB: cameraButton, NANO_CINEMA: cinema,
    CASE_VIEW: { on: false }, showRobotView: () => { calls.view++; },
    enterRoam: () => {
      calls.roam++; R.on = true; R.p.set(0, 4.5, 24); R.yaw = 0; R.pitch = -0.05;
    },
    NANO_PHYSICS: {
      profile: mini => ({ height: mini ? 0.24 : 10.5 }),
      safeMorphPosition: pos => ({ safe: true, ...pos })
    },
    window: { ATM_OUT: false, __OBST: [], __buildObst: () => [] },
    say: message => calls.messages.push(message),
  };
  const handler = vm.runInNewContext('({' + actual + '})', context).robotMode;
  return { R, calls, cameraButton, recordingState, handler };
}

test('direct Mode Robot from case enters roaming and begins actual nano transformation (no table teleport)', () => {
  const v = scenario('3p');
  assert.equal(v.handler(), true);
  assert.equal(v.calls.roam, 1);
  assert.equal(v.R.on, true);
  assert.equal(v.calls.start, 1);
  assert.equal(v.R.freeRobotMode, true);
  assert.deepEqual([v.R.p.x, v.R.p.z], [0, 24], 'no legacy 4.5/4.4 tabletop camera position');
  assert.equal(v.R.mini, false, 'NANO is enabled by the real frame-driven chest animation');
  assert.equal(v.R.mode, '3p');
});

test('all existing camera modes visibly return to third-person when the player chooses NANO', () => {
  for (const mode of ['1p', '2p', '3p', '3pl', 'libre']) {
    const v = scenario(mode);
    assert.equal(v.handler(), true, 'NANO should activate from ' + mode);
    assert.equal(v.R.mode, '3p', 'actual avatar must be in-frame, not hidden by ' + mode);
    assert.match(v.cameraButton.textContent, /3ª PERSONA/);
    assert.equal(v.calls.start, 1);
  }
});

test('spectator camera stops before player transformation, without touching normal roam entry', () => {
  const v = scenario('libre', true);
  assert.equal(v.handler(), true);
  assert.equal(v.recordingState.on, false);
  assert.equal(v.calls.stopRecord, 1);
  assert.equal(v.R.mode, '3p');
  const w = scenario('3p', false);
  w.handler();
  assert.equal(w.calls.stopRecord, 0);
});

test('same game avatar and real HUD button drive mini state, not only a camera on a tabletop', () => {
  assert.match(html, /id="stR"[^>]*aria-pressed="false"/);
  assert.match(html, /hud\.querySelector\('#stR'\)\.onclick = \(\) => \{ const on = H\.robotMode\(\)/);
  assert.match(engine, /NANO_CINEMA\.tick\(dt\)/);
  assert.match(engine, /AV\.w\.visible = true/);
  assert.match(engine, /AV\.w\.scale\.setScalar\(AV\.baseScale\*\(ROAMS\.mini\?NANO_SCALE:1\)\*NANO_CINEMA\.avatarFactor\(\)\)/);
  assert.match(engine, /const NANO_SCALE = 0\.24 \/ 10\.5;/);
  assert.match(engine, /capsule\.scale\.setScalar\(launchNano \? NANO_SCALE : 1\)/);
  assert.doesNotMatch(actual, /ROAMS\.p\.set\(4\.5,\s*0\.3,\s*4\.4\)/);
});
