'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const page = fs.readFileSync('audio/maletin/index.html', 'utf8');
const intro = fs.readFileSync('audio/maletin/game-intro.js', 'utf8');
const lang = fs.readFileSync('audio/maletin/language-onboarding.js', 'utf8');
test('Y2K Robots opening stays cinematic, and public pages force English-only without language prompts', () => {
  assert.ok(page.indexOf('game-intro.js') > 0, 'cinematic opening stays available');
  assert.doesNotMatch(page, /<script[^>]+src=["']language-onboarding\.js/, 'no Spanish selector in the public game');
  assert.match(page, /window\.__UNFIRE_PUBLIC_ENGLISH_ONLY=true/, 'public English-only flag set before intro');
  assert.match(intro, /window\.__UNFIRE_PUBLIC_ENGLISH_ONLY === true/, 'first-run language selection skipped even without storage');
  for (const s of ['unfire-dragon-transparent.png', 'logo-unfire-256.webp', 'emblem-butterfly.webp', 'Y2K<br>ROBOTS']) assert.ok(intro.includes(s), s);
  assert.ok(intro.indexOf('data-lang="en"') < intro.indexOf('data-lang="es"'), 'English listed first');
  assert.match(intro, /navigator\.webdriver/, 'automated QA browsers skip the opening');
  assert.match(lang, /UNFIRE_INTRO&&window\.UNFIRE_INTRO\.active/, 'first-run dialog defers to the opening');
  assert.ok(lang.indexOf('data-lang=\\"en\\"') < lang.indexOf('data-lang=\\"es\\"') || lang.indexOf('data-lang="en"') < lang.indexOf('data-lang="es"'));
});
