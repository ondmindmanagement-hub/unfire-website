'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'audio/index.html'), 'utf8');

test('FX20 preview correction stays limited to VISCOSITY and AXIAL', () => {
  assert.match(html, /#fx-viscosity \.shot img\{filter:brightness\(1\.08\) contrast\(1\.04\)\}/);
  assert.match(html, /#fx-axial \.shot img\{transform:scale\(1\.075\)\}/);
  assert.match(html, /const crisp=\['viscosity','axial'\]\.includes\(f\[0\]\)/);
});

test('corrected Ratio and Trim graphics invalidate cache only for changed FX', () => {
  assert.match(html, /const artRev=\['viscosity','bounding'\]\.includes\(f\[0\]\)/);
  assert.match(html, /\?v=20261024-ratio-trim/);
  assert.match(html, /img\/fx-\$\{f\[0\]\}\.webp\$\{\['viscosity','bounding'\]/);
});

test('corrected original assets are valid, reasonably sized WebP files', () => {
  for (const fx of ['viscosity', 'bounding']) {
    for (const size of ['', '-s']) {
      const file = path.join(root, 'audio/img', `fx-${fx}${size}.webp`);
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(bytes.length > 8_000 && bytes.length < 200_000,
        `${path.basename(file)} must retain reasonable download size`);
    }
  }
});
