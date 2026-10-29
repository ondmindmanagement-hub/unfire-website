/* Node-only deterministic QA for pre-recorded character voices. No browser/audio device required. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../audio/maletin');
const script = fs.readFileSync(path.join(root, 'neural-voices.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'vox/manifest.json'), 'utf8'));
const slots = JSON.parse(fs.readFileSync(path.join(root, 'vox/slots.json'), 'utf8'));
const hash = (s) => {
  let h = 7;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};
const src = (url) => url.replace(/\?.*$/, '');
function harness(opts = {}) {
  let tick = 10_000, sequence = 0;
  const calls = [], audios = [], timeouts = new Map(), origCalls = [];
  const ss = {
    cancel() { origCalls.push('cancel'); },
    speak(u) { origCalls.push('speak ' + u.text); }
  };
  const win = {
    speechSynthesis: ss,
    __LANG: opts.language || 'es',
    __voiceFor(who) { return { who }; },
    T: opts.T || ((s) => s)
  };
  class MockAudio {
    constructor(url) { this.src = src(url); this.volume = 1; calls.push(this.src); audios.push(this); }
    play() { this.played = true; return opts.rejectPlay ? Promise.reject(new Error('blocked')) : Promise.resolve(); }
    pause() {}
  }
  const ctx = {
    window: win,
    navigator: { webdriver: false },
    location: { search: '' },
    Date: class FakeDate extends Date { static now() { return tick; } },
    Audio: MockAudio,
    setTimeout(fn) { const id = ++sequence; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    addEventListener() {},
    fetch(url) {
      if (opts.rejectFetch || (opts.rejectSlots && url.includes('slots'))) return Promise.reject(new Error('offline'));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes('slots') ? slots : manifest) });
    }
  };
  vm.runInNewContext(script, ctx, { filename: 'neural-voices.js' });
  return {
    ss, win, calls, audios, origCalls, timeouts,
    step() { const entry = timeouts.entries().next().value; if (entry) { timeouts.delete(entry[0]); entry[1](); } },
    flush() { for (let i = 0; i < 80 && timeouts.size; i++) this.step(); },
    speak(text, who = 'NIMBO') {
      const out = { text, onstart: () => out.started++, onend: () => out.ended++, started: 0, ended: 0 };
      win.__voiceFor(who);
      ss.speak(out);
      return out;
    }
  };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
const GREET = 'Me alegra que te acerques. ¿Quieres escuchar cómo llegué aquí?';
async function main() {
  assert.ok(manifest.en.length >= 765, 'Unexpected EN voice manifest');
  assert.ok(manifest.es.length >= 1000, 'Unexpected ES voice manifest');
  for (const sl of 'abcdefghijk') assert.ok(Array.isArray(slots.es[sl]) && slots.es[sl].length > 200, 'ES slot ' + sl);
  for (const sl of 'abcde') assert.ok(slots.es[sl].length >= 1000, 'ES core slot ' + sl + ' must voice the whole game');
  const all = new Set(manifest.es);
  for (const [sl, keys] of Object.entries(slots.es)) {
    assert.equal(new Set(keys).size, keys.length, 'No duplicate slot keys');
    for (const k of keys) {
      assert.ok(all.has(k), 'slot key must be in manifest: ' + k);
      assert.ok(fs.existsSync(path.join(root, 'vox/es', sl, k + '.mp3')), 'Missing ES asset: ' + sl + '/' + k);
    }
  }

  // Casting: each main robot keeps its own Castilian voice; giants sound like giants.
  const es = harness({ language: 'es' });
  const slotFor = es.win.__NEURAL_VOX.slotFor;
  assert.deepEqual(['ARI', 'LEO', 'GEMI', 'NIMBO', 'UNFIRE'].map(slotFor), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(slotFor('BALUARTE, EL SABIO QUE CAMINA'), 'i');
  for (const name of ['VOLTIO', 'CASETE', 'PIXEL', 'TURBOTOTEM', 'MR. MONITOR']) assert.ok('fghjkc'.includes(slotFor(name)), name);

  const h = harness();
  await settle();
  assert.equal(h.win.__NEURAL_VOX.ready, true);
  const recorded = h.speak('Bueno, otra vez será.', 'NIMBO');
  assert.equal(h.calls[0], 'vox/es/d/' + hash('Bueno, otra vez será.') + '.mp3');
  assert.equal(recorded.started, 1);
  assert.equal(h.origCalls.includes('speak Bueno, otra vez será.'), false);
  h.flush();
  assert.equal(recorded.ended, 1, 'speech callback must always resume story');

  // Lines built at runtime (robot name + reply) play sentence by sentence in the robot's voice.
  const chat = harness();
  await settle();
  const sl = chat.win.__NEURAL_VOX.slotFor('VOLTIO');
  const reply = chat.speak('¡Hola! Soy VOLTIO. ' + GREET, 'VOLTIO');
  assert.deepEqual(chat.calls, ['¡Hola!', 'Soy VOLTIO.', 'Me alegra que te acerques.', '¿Quieres escuchar cómo llegué aquí?'].map((s) => 'vox/es/' + sl + '/' + hash(s) + '.mp3'));
  assert.equal(chat.audios[0].played, true);
  assert.equal(chat.audios[1].played, undefined, 'sentences play one after another');
  chat.audios[0].onended();
  const next = [...chat.timeouts.entries()].pop(); chat.timeouts.delete(next[0]); next[1]();
  assert.equal(chat.audios[1].played, true);
  chat.flush();
  assert.equal(reply.ended, 1);

  const missing = h.speak('Línea nueva sin grabación aprobada.', 'ARI');
  assert.equal(h.calls.length, 1, 'Must not fetch a clip absent from manifest');
  h.flush();
  assert.equal(missing.ended, 1);
  assert.equal(h.origCalls.filter((x) => x.startsWith('speak ')).length, 0, 'Never use system TTS');

  const failed = harness({ rejectPlay: true });
  await settle();
  const interrupted = failed.speak('Bueno, otra vez será.', 'NIMBO');
  await settle();
  assert.equal(interrupted.ended, 1, 'Failed audio must complete without OS voice');
  assert.equal(failed.origCalls.filter((x) => x.startsWith('speak ')).length, 0);

  const noSlotIndex = harness({ rejectSlots: true });
  await settle();
  const stillVoiced = noSlotIndex.speak('Bueno, otra vez será.', 'NIMBO');
  assert.equal(noSlotIndex.calls.length, 1, 'Missing optional slot index must not mute Nimbo');
  noSlotIndex.flush();
  assert.equal(stillVoiced.ended, 1);

  const noNetwork = harness({ rejectFetch: true });
  await settle();
  const offline = noNetwork.speak('Bueno, otra vez será.');
  assert.equal(noNetwork.calls.length, 0);
  noNetwork.flush();
  assert.equal(offline.ended, 1);
  assert.equal(noNetwork.origCalls.filter((x) => x.startsWith('speak ')).length, 0);

  const cancelled = harness();
  await settle();
  const pending = cancelled.speak('Frase nueva sin grabación.');
  cancelled.ss.cancel();
  cancelled.flush();
  assert.equal(pending.ended, 0, 'Cancel must not later fire stale onend callback');
  assert.equal(cancelled.win.__NEURAL_VOX.queued, 0);
  assert.ok(cancelled.origCalls.includes('cancel'));

  const english = harness({ language: 'en' });
  await settle();
  const line = english.speak('Fair enough, maybe next time.', 'LEO');
  assert.equal(english.calls[0], 'vox/en/b/' + hash('Fair enough, maybe next time.') + '.mp3');
  english.flush();
  assert.equal(line.ended, 1);

  console.log('PASS neural voice assets, per-robot casting, sentence playback, no OS fallback, failure, cancel, EN/ES and queue');
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
