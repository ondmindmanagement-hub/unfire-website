// Unfire — release regression: never present third-party demos as company media.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const home = read('index.html');
const standards = read('research/benchmarks/index.html');
const research = read('research/index.html');
const disallowed = ['hIwSHZT-eoQ', 'EbNaVOHnnvo', 'gM_wsjJBctM'];

test('third-party award videos, previews and embed hooks are absent from public pages', () => {
  for (const page of [home, standards, research]) {
    for (const id of disallowed) assert.ok(!page.includes(id), 'External video ID: ' + id);
    for (const token of ['ControlAnything', 'Synthexis', 'Gatekeeper', 'data-ufbm-video', 'i.ytimg.com/vi/', 'youtube-nocookie.com']) {
      assert.ok(!page.includes(token), 'External video/gallery reference: ' + token);
    }
  }
  assert.doesNotMatch(home, /id="uf-benchmark-teaser"/);
  assert.doesNotMatch(home, /unfire-benchmark-(?:teaser|embed)-20261123/);
  assert.doesNotMatch(standards, /unfire-benchmark-embed-20261123/);
});

test('presentation standards stay accessible without implying external awards are Unfire achievements', () => {
  assert.ok(research.includes('href="/research/benchmarks/"'));
  assert.match(research, /Presentation standards · Authentic Unfire demonstrations/);
  assert.match(standards, /<html lang="en">/);
  assert.ok(standards.includes('<link rel="canonical" href="https://unfire.technology/research/benchmarks/"'));
  assert.match(standards, /id="what-we-apply"/);
  assert.match(standards, /Demonstrate the real build/);
  assert.match(standards, /Original, rights-cleared media only/);
  assert.doesNotMatch(standards, /id="reference-projects"/);
});

test('homepage keeps the actual Unfire products and adjacent sections', () => {
  assert.match(home, /id="scale"/);
  assert.ok(home.includes('<h3 class="notranslate" translate="no">Bolt</h3>'));
  assert.match(home, /id="work"/);
});
