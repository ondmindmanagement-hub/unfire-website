'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../audio/maletin/hyperwave-harmony.js');
const engine = fs.readFileSync('audio/maletin/game-engine-v50.js', 'utf8');
const html = fs.readFileSync('audio/maletin/index.html', 'utf8');
const pc = (n) => ((n % 12) + 12) % 12;
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const major = [60, 64, 67, 71];
const minor = [57, 60, 64, 67];
test('module loads before the real audio engine, leaving UI untouched', () => {
  assert.ok(html.indexOf('hyperwave-harmony.js?v=') > 0);
  assert.ok(html.indexOf('hyperwave-harmony.js?v=') < html.lastIndexOf('game-engine-v50.js?v='));
});
test('all key presses stay strictly on the active triad, across registers and all styles', () => {
  for (const chord of [major, minor, [50, 53, 57, 60], [45, 48, 52, 55]])
    for (let midi = 24; midi <= 101; midi++) {
      const res = H.snap(midi, { chord, generatedPlaying: true, mode: 'blues', key: 1 });
      assert.ok(Number.isInteger(res) && res >= 36 && res <= 84);
      assert.ok(H.chordClasses(chord).includes(pc(res)), 'pitch must be a real chord tone');
    }
});
test('manual modes do not override a different actively sounding chord', () => {
  for (const mode of ['auto', ...Object.keys(H.MODES)])
    for (let key = -1; key < 12; key++) {
      const res = H.snap(68, { chord: major, generatedPlaying: true, mode, key });
      assert.ok([0, 4, 7].includes(pc(res)));
    }
});
test('unknown-key recorded music never triggers an arbitrary pitched note', () => {
  for (let m = 20; m < 108; m++)
    assert.equal(H.snap(m, { externalPlaying: true, generatedPlaying: false, key: 0, mode: 'mayor' }), null);
});
test('silence remains a playable diatonic instrument', () => {
  for (let k = 0; k < 12; ++k) for (let m = 21; m < 98; ++m) {
    const n = H.snap(m, { key: k, root: k, mode: 'menor' });
    assert.ok(n >= 36 && n <= 84);
    assert.ok(H.MODES.menor.map(x => pc(x + k)).includes(pc(n)));
  }
});
test('phrase generator never drifts outside triad, and retains rhythmic rests', () => {
  for (let style = 0; style < 15; ++style) for (let bar = 0; bar < 32; ++bar) {
    let sounded = 0; const notes = new Set();
    for (let step = 0; step < 16; ++step) {
      const note = H.phrase(bar, step, major, { generatedPlaying: true, style, section: 'drop' });
      if (note) {
        sounded++; notes.add(pc(note.midi));
        assert.ok([0, 4, 7].includes(pc(note.midi)));
        assert.ok(note.velocity > 0 && note.velocity <= 0.52);
        assert.ok(note.durationSteps >= 1 && note.durationSteps <= 4);
      }
    }
    assert.ok(sounded >= 2 && sounded <= 5, 'pleasant sparse phrasing');
    assert.ok(notes.size >= 2, 'arpeggio must actually explore the active chord');
  }
});
test('automatic phrases stop during external songs, intro/break and while playing manually', () => {
  for (const mod of [
    { externalPlaying: true, generatedPlaying: false },
    { generatedPlaying: true, section: 'intro' },
    { generatedPlaying: true, section: 'break' },
    { generatedPlaying: true, heldKeys: true },
    { generatedPlaying: true, mega: true },
    { generatedPlaying: true, muted: true }
  ]) {
    for (let step = 0; step < 16; step++) assert.equal(H.phrase(0, step, major, mod), null);
  }
});
test('game uses shared audio clock and current chord for manual keys', () => {
  assert.ok(engine.includes('HW_CHORD_CLOCK.push({ t: tt, chord: ch.slice(0, 4) })'));
  assert.ok(engine.includes('if (e.t <= now + 0.016) current = e.chord'));
  assert.ok(engine.includes('window.UNFIRE_HARMONY.phrase(bar, st, ch'));
  assert.ok(engine.includes('window.UNFIRE_HARMONY') || engine.includes('const H = window.UNFIRE_HARMONY'));
});
test('harsh effect roulette removed, FX mix and gain reduced', () => {
  const line = engine.split('\n').find(x => x.includes('const pool = mega ?') && x.includes('phasedub'));
  assert.ok(line && !line.includes("'ring'") && !line.includes("'crush'") && !line.includes("'sweep'") && !line.includes("'stutter'"));
  assert.ok(engine.includes('Math.min(0.90, Math.max(0.48, v * 0.48))'));
  assert.ok(engine.includes('const v = clamp(HWVOL * HWAUTO.k, 0, 0.69)'));
});
test('real recorded music is treated as harmonically unknown, not guessed', () => {
  assert.ok(engine.includes('if (sm === null) { hwNeutralTap(); return; }'));
  assert.ok(engine.includes('const externalPlaying = !!(window.__WRADIO && window.__WRADIO.on) && !generatedPlaying;'));
});
test('all referenced CC0 sample files remain intact on disk', () => {
  const match = html.match(/const SAMPLES = (\{[^\n]*\});/);
  assert.ok(match, 'real sample manifest');
  const defs = JSON.parse(match[1]);
  const files = [];
  for (const def of Object.values(defs)) {
    for (const zone of (def.zones || [{ f: def.f }])) if (zone.f) files.push(zone.f);
  }
  assert.ok(files.length >= 140);
  for (const file of files) assert.ok(fs.statSync(path.join('audio/maletin/samples', file)).size > 512, file);
});
console.log('Hyperwave harmonic QA: ' + checks + ' suites PASS.');
