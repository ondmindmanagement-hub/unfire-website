'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mobile = fs.readFileSync(path.join(root, 'apps/archer-mobile/index.html'), 'utf8');
const iphone = 'archer-mobile-iphone-ui-20261029.webp';
const ipad = 'archer-mobile-ipad-ui-20261029.webp';
const mac = 'archer-nocturne-app-preview-20261028.webp';
test('real device-specific mobile renders never reuse the Mac preview', () => {
  const gallery = home.slice(home.indexOf('id="apps-audio"'), home.indexOf('id="apps-capture"') > 0 ? home.indexOf('id="apps-capture"') : home.indexOf('id="apps-audio"') + 7000);
  const from = gallery.indexOf('uf-gallery-card--archer-mobile');
  assert.ok(from > 0);
  const mobileCard = gallery.slice(from, gallery.indexOf('</article>', from));
  assert.match(mobileCard, new RegExp(iphone));
  assert.match(mobileCard, new RegExp(ipad));
  assert.doesNotMatch(mobileCard, new RegExp(mac));
  assert.match(gallery.slice(0, from), new RegExp(mac));
});
test('cards show both interfaces without overflow or deceptive previews', () => {
  assert.match(home, /\.uf-archer-devices\{[^}]+max-width:390px/);
  assert.match(home, /@media\(max-width:620px\)/);
  assert.match(home, /#apps \.uf-archer-device img\{[^}]*object-fit:contain/);
  assert.match(home, /Product preview · upcoming design, not the current App Store version/);
  assert.match(mobile, /Development previews?/i);
  assert.match(mobile, /not screenshots of the currently published App Store version/);
  assert.match(mobile, /mobile-preview-stage/);
  assert.match(mobile, /@media\(max-width:430px\)/);
});
test('device images exist and are small enough for a landing page', () => {
  for (const name of [iphone, ipad]) {
    const p = path.join(root, 'assets/products', name);
    assert.ok(fs.existsSync(p), name);
    assert.ok(fs.statSync(p).size < 180_000, name);
    assert.match(mobile, new RegExp(name));
  }
});
