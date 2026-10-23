'use strict';
/* Read-only audio-bank integrity contract. No synthesis or image assets. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync('audio/maletin/index.html', 'utf8');
const match = html.match(/const SAMPLES = (\{[^\n]*\});/);
assert.ok(match, 'Real game sample manifest must remain present');
const samples = JSON.parse(match[1]);
assert.ok(Object.keys(samples).length >= 80, 'Production sample palette unexpectedly shrank');
const referenced = new Set();
for (const [instrument, def] of Object.entries(samples)) {
  assert.ok(def && (def.f || Array.isArray(def.zones)), instrument + ': missing sample');
  const zones = def.zones || [def];
  assert.ok(zones.length > 0 && zones.length < 64, instrument + ': unexpected sample zones');
  for (const z of zones) {
    assert.match(z.f, /^[\w-]+\.mp3$/i, instrument + ': unsafe or missing path');
    const filename = path.join('audio', 'maletin', 'samples', z.f);
    assert.ok(fs.statSync(filename).size >= 512, instrument + ': missing or tiny audio asset');
    if (def.zones) {
      assert.ok(Number.isFinite(z.root) && z.root >= 0 && z.root <= 127, instrument + ': invalid zone MIDI root');
    }
    referenced.add(z.f);
  }
}
const disk = fs.readdirSync('audio/maletin/samples').filter(f => f.endsWith('.mp3'));
for (const name of disk) assert.ok(referenced.has(name), 'Unreferenced audio asset (review before shipping): ' + name);
assert.equal(referenced.size, disk.length, 'Referenced count should equal published sample count');
assert.ok(html.includes('bus.limiter = ctx.createDynamicsCompressor()'), 'Web Audio master peak control missing');
assert.ok(html.includes('bus.hp = ctx.createBiquadFilter()'), 'Master low-frequency protection missing');
console.log('PASS maletin audio manifest: ' + Object.keys(samples).length + ' instruments, ' + disk.length + ' real MP3 samples, no missing/unused files, master output protection present');
