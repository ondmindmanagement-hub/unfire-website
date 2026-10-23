// Regression: outdoor ambient sample generation must not block door/dome frames.
'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engine = fs.readFileSync(process.env.UNFIRE_ENGINE_PATH ||
  path.join(__dirname, '..', 'audio/maletin/game-engine-v50.js'), 'utf8');
const start = engine.indexOf('  let seaBuild = null, seaBuildFailed = false;');
const end = engine.indexOf('  function frame(now) {', start);
assert.ok(start >= 0 && end > start, 'incremental helper exists outside frame()');
const snippet = engine.slice(start, end);

function fixture({ hidden = false, outside = true, nearDoor = false, nearDome = false } = {}) {
  const jobs = [];
  const listeners = new Map();
  let buffers = 0, sources = 0, starts = 0;
  let now = 0;
  const node = () => ({
    gain: {value: 0}, frequency: {value: 0}, Q: {value: 0},
    playbackRate: {value: 1.0},
    connect() { return this; },
    start() { starts++; }
  });
  const audio = {
    state: 'running', sampleRate: 8000,
    createBuffer(ch, frames) {
      assert.equal(ch, 2);
      buffers++;
      const data = Array.from({length: ch}, () => new Float32Array(frames));
      return {getChannelData(i) { return data[i]; }, data};
    },
    createBufferSource() { sources++; return node(); },
    createBiquadFilter: node, createGain: node,
  };
  const document = {
    hidden,
    addEventListener(name, cb) { listeners.set(name, cb); }
  };
  const ROAMS = {on: true, p: {x: -30, z: nearDoor ? 80 : 30},
    h: nearDome ? 14 : 0, fly: nearDome};
  const window = {ATM_OUT: outside};
  const sandbox = {
    document, ROAMS, window,
    UA: {ctx: audio, bus: {master: node()}},
    audioOk: () => true,
    performance: {now: () => (now += 0.05)},
    setTimeout: fn => { jobs.push(fn); return jobs.length; },
    console,
  };
  const api = vm.runInNewContext(
    '(function(){' + snippet + 'return {ensureSeaAmbience};})()', sandbox);
  return {
    api, document, window, jobs, listeners,
    counters: () => ({buffers, sources, starts}),
    flush(max = 300) {
      let n = 0;
      while (jobs.length && n < max) { jobs.shift()(); n++; }
      return n;
    }
  };
}

test('audio sample synthesis is not synchronous in a doorway frame', () => {
  const f = fixture();
  f.api.ensureSeaAmbience(); f.api.ensureSeaAmbience();
  assert.deepEqual(f.counters(), {buffers: 0, sources: 0, starts: 0});
  assert.equal(f.jobs.length, 1, 'a single deferred job, not one per render frame');
  f.flush(1);
  assert.equal(f.counters().sources, 0, 'first small chunk cannot start audio');
  assert.equal(f.jobs.length, 1, 'bounded slices remain');
  const total = f.flush(300);
  assert.ok(total > 4 && total < 300, 'eventually completes without a tight loop');
  assert.deepEqual(f.counters(), {buffers: 1, sources: 2, starts: 2});
  assert.ok(f.window.__SEA && f.window.__SEA.g, 'preserves ambient graph contract');
  f.window.ATM_OUT = false;
  f.api.ensureSeaAmbience();
  f.window.ATM_OUT = true;
  f.api.ensureSeaAmbience();
  assert.equal(f.counters().buffers, 1, 'multiple crossings reuse the same buffer');
});

test('approaching the physical door or dome prewarms audio once', () => {
  for (const opts of [{nearDoor:true}, {nearDome:true}]) {
    const f = fixture({outside:false, ...opts});
    f.api.ensureSeaAmbience();
    assert.equal(f.jobs.length, 1);
    f.flush();
    assert.equal(f.counters().starts, 2);
  }
  const far = fixture({outside:false});
  far.api.ensureSeaAmbience();
  assert.equal(far.jobs.length, 0, 'do not process outdoor audio far inside');
});

test('hidden tabs defer remaining chunks and resume on visibility', () => {
  const f = fixture({hidden:true});
  f.api.ensureSeaAmbience();
  f.flush(1);
  assert.equal(f.jobs.length, 0, 'no timer polling when hidden');
  assert.equal(f.counters().buffers, 0);
  assert.ok(f.listeners.has('visibilitychange'));
  f.document.hidden = false;
  f.listeners.get('visibilitychange')();
  assert.equal(f.jobs.length, 1, 'resume once');
  f.flush(300);
  assert.equal(f.counters().starts, 2);
});
