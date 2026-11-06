'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('home stays English-first and protects brand words during opt-in browser translation', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<span class="notranslate" translate="no">Bolt&nbsp;<\/span>explores/);
  assert.match(html, /<span class="notranslate" translate="no">Power&nbsp;<\/span>turns/);
  assert.match(html, /<span class="notranslate" translate="no">Unfire&nbsp;<\/span>develops/);
  assert.doesNotMatch(html, /<html lang="es"|data-set-lang="es"|id="lang-es"/);
});

test('protected inline brands never rely on a trimmable HTML space before the next word', () => {
  const fragile = /<span\b(?=[^>]*\bnotranslate\b)(?=[^>]*\btranslate="no")[^>]*>[^<>]*<\/span>(?: +|&nbsp;)(?=[A-Za-z])/g;
  const matches = [...html.matchAll(fragile)];
  assert.deepEqual(matches.map(m => m[0]), []);
});

test('App Store product names and independently translatable disclaimer remain correct', () => {
  const group = html.match(/<div class="unfire-store-status">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(group, 'Store status must be isolated for sentence-level machine translation');
  assert.match(group, /<p>Selected releases on the App Store:<\/p>/);
  assert.match(group, /translate="no"[^>]*>Archer by Unfire Audio<\/a>/);
  assert.match(group, /translate="no"[^>]*>Power Energy Prices<\/a>/);
  assert.match(group, /<p>This independent initiative is not affiliated with or endorsed by Apple\.<\/p>/);
  assert.match(html, /#work \.unfire-store-status p\{margin:0\}/);
});

test('Bolt links use their visible, machine-translatable labels as accessible names', () => {
  assert.match(html, /<a class="button primary" href="https:\/\/apps\.apple\.com\/us\/app\/bolt-trusted-ai-bridge\/id6814615903"[^>]*>Get Bolt on the Mac App Store<\/a>/);
  assert.match(html, /<a class="button" href="\/bolt\/">How Bolt works →<\/a>/);
  assert.doesNotMatch(html, /aria-label="Learn about BOLT in English"/);
});
