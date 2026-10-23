'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const page = read('enterprise/showrooms/index.html');
const enterprise = read('enterprise/index.html');
const contact = read('contact/index.html');
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS', name); };

check('single semantic h1 and language, title and viewport', () => {
  assert.match(page, /^<!doctype html>/i);
  assert.match(page, /<html lang="en">/);
  assert.equal((page.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(page, /<main id="main">/);
  assert.match(page, /meta name="viewport"/);
  assert.match(page, /<title translate="no">/);
});
check('self-contained dark page and responsive, reduced motion rules', () => {
  assert.match(page, /<style>[\s\S]+<\/style>/);
  assert.match(page, /@media\(max-width:800px\)/);
  assert.match(page, /@media\(max-width:560px\)/);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(page, /<script\b/i);
});
check('every in-page anchor has an id and accessible skip navigation', () => {
  const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const hrefs = [...page.matchAll(/\bhref="#([^"]+)"/g)].map(m => m[1]);
  assert.ok(hrefs.length >= 4);
  for (const anchor of hrefs) assert.ok(ids.has(anchor), 'missing id for #' + anchor);
  assert.match(page, /class="skip" href="#main"/);
  assert.match(page, /aria-label="Business navigation"/);
});
check('no fake marketplace, company, endorsement or device guarantees', () => {
  assert.match(page, /not a ready-made business catalogue/);
  assert.match(page, /not yet a verified operational marketplace/);
  assert.match(page, /independent, founder-led technology initiative/);
  assert.match(page, /cannot promise universal performance/);
  assert.match(page, /Sponsored placements and affiliate links/);
  assert.doesNotMatch(page, /\bVirgin\b/i);
  assert.match(page, /no guaranteed leads/);
  assert.doesNotMatch(page, /we guarantee (revenue|leads|growth)/i);
});
check('the CTAs use email and a working canonical demonstration path', () => {
  assert.match(page, /mailto:hello@unfire\.technology\?subject=/);
  assert.match(page, /href="\/audio\/"/);
  assert.match(page, /href="\/enterprise\/"/);
  assert.match(page, /href="\/\?site=1"/);
});
check('entry points into new service exist in enterprise and contact', () => {
  assert.match(enterprise, /href="\/enterprise\/showrooms\/"/);
  assert.match(contact, /href="\/enterprise\/showrooms\/"/);
  assert.match(contact, /href="\/enterprise\/"/);
});
check('commercial copy has clear boundaries and avoids internal pricing disclosure', () => {
  assert.match(page, /written agreement/);
  assert.match(page, /third-party brand partnerships/);
  assert.match(page, /Sponsored placements and affiliate links/);
  assert.match(page, /not yet a verified operational marketplace/);
  assert.doesNotMatch(page, /€[0-9]/);
  assert.doesNotMatch(page, /\b(price hypotheses|internal strategy)\b/i);
});
console.log('Unfire showroom commercial checks:', checks, 'passed');
