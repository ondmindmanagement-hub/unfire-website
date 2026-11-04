'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const page = fs.readFileSync('audio/maletin/index.html', 'utf8');
const intro = fs.readFileSync('audio/maletin/game-intro.js', 'utf8');
const lang = fs.readFileSync('audio/maletin/language-onboarding.js', 'utf8');
test('Y2K Robots opening stays cinematic with a selectable English or Spanish language', () => {
  assert.ok(page.indexOf('game-intro.js') > 0, 'cinematic opening stays available');
  assert.match(page, /<script[^>]+src=["']language-onboarding\.js/, 'language selector available in game settings');
  assert.doesNotMatch(page, /window\.__UNFIRE_PUBLIC_ENGLISH_ONLY=true/, 'game no longer forces English');
  assert.match(page, /window\.__LANG = L/, 'selected language controls game translations');
  for (const s of ['unfire-dragon-transparent.png', 'logo-unfire-256.webp', 'emblem-butterfly.webp', 'Y2K<br>ROBOTS']) assert.ok(intro.includes(s), s);
  assert.ok(intro.indexOf('data-lang="en"') < intro.indexOf('data-lang="es"'), 'English listed first');
  assert.match(intro, /navigator\.webdriver/, 'automated QA browsers skip the opening');
  assert.match(lang, /group\.id='ufLangSettings'/, 'language lives in the settings panel');
  assert.match(lang, /sel\.id='ufLangSelect'/);
  assert.doesNotMatch(lang, /ufLangFirst|ufLangQuick/, 'no redundant language overlay or floating control');
});
