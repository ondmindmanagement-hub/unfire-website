'use strict';
// Engine and foley must never fall back to artificially synthesized sounds.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'audio/maletin/game-engine-v50.js'), 'utf8');
const credits = fs.readFileSync(path.join(root, 'audio/media-credits.html'), 'utf8');
const audioFolder = path.join(root, 'audio/maletin/media/sfx-real');
const gs = engine.slice(engine.indexOf('  const GS = (() =>'), engine.indexOf('  const SPEEDL = (() =>'));
test('audio engine JS parses and avoids synthesized flight and environmental audio', () => {
  new vm.Script(engine);
  assert(!/createOscillator\s*\(/.test(gs), 'No oscillators in game sound effects');
  assert(!/Math\.random\(\)\s*\*\s*2\s*-\s*1/.test(gs), 'No generated noise used for effects');
  assert.match(gs, /FLIGHT_TURBINE\.tick\(dt, !!ROAMS\.fly, !!ROAMS\.mini/);
  assert.match(gs, /P\.wings\(!!ROAMS\.fly\)/);
  assert.match(gs, /REAL_FOLEY\.play/);
  assert.match(gs, /activeVoices >= 8/);
  assert.match(gs, /A\.duck\s*\?\s*0\.42\s*:\s*0\.70/);
  assert.match(gs, /stereo\.pan|g\.pan\.pan/);
});
test('all 15 audio sources are real local MP3 recordings, none missing', () => {
  const files = [
    'jet-idle-loop','jet-boost-loop','jet-takeoff','jet-landing',
    'step01','step02','step03','step04','step05','step06',
    'splash1','splash2','thud2','clank1','applause'
  ];
  for (const filename of files) {
    const full = path.join(audioFolder, filename + '.mp3');
    assert(fs.statSync(full).size > 850, filename + ' must be an actual recorded file');
    const header = fs.readFileSync(full).subarray(0, 3);
    assert(header.toString() === 'ID3' || header[0] === 255, filename + ' is not MP3');
  }
  assert.equal(fs.readdirSync(audioFolder).filter(n => n.endsWith('.mp3')).length, 15);
});
test('third-party licensing and modification credits accessible via existing website credits', () => {
  assert.match(credits, /WWS_SaabJ35DDrakenstartengineandtaxiing/);
  assert.match(credits, /WWS_SaabJ35DDraken8211passingtwotimes/);
  assert.match(credits, /Work With Sounds/);
  assert.match(credits, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(credits, /opengameart\.org\/content\/footsteps-0/);
  assert.match(credits, /opengameart\.org\/content\/water-splash-and-sand-footsteps/);
  assert.match(credits, /opengameart\.org\/content\/well-done/);
  assert(fs.existsSync(path.join(audioFolder, 'LICENSE-AND-CREDITS.md')));
});
test('normal and nano camera follow timing is dt invariant', () => {
  assert.match(engine, /Math\.exp\(-dt \* \(ROAMS\.mini \? 16 : 9\)/);
  assert.match(engine, /Math\.exp\(-dt \* \(MODE === '1p' \? 35 : 18\)/);
  assert.match(engine, /const follow = 1 - Math\.exp\(-9\.1 \* dt\)/);
});
test('voice recordings and voice routes remain unchanged by effects engine', () => {
  assert(!/fetch\(.*vox\//.test(gs));
  assert(!/getUserMedia/.test(gs));
  assert.match(gs, /REC_GUARD\(\)/);
});
