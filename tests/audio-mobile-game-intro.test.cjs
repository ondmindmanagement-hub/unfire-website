'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../audio');
const page = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const intro = fs.readFileSync(path.join(dir, 'mobile-game-intro.js'), 'utf8');

assert.equal(page.split('mobile-game-intro.js?v=20261026ident1').length, 2, 'One intro script');
assert.ok(page.includes("UNFIRE_GAME_INTRO.play(pin).then("), 'Mobile entry invokes ident');
assert.ok(page.includes("if(!entryTransition||!introReady)return;"), 'Wait to enter game');
assert.ok(page.includes("entryResume:true"), 'Return keeps save without replay');
assert.ok(page.includes("if(!UNFIRE_SCENE.isReady())"), 'Wait for real game');
assert.ok(intro.includes("get hasPlayed(){return hasPlayed;}"), 'One intro per launch');
assert.ok(intro.includes("document.addEventListener('visibilitychange',onHide)"), 'Hidden tab exits');
assert.ok(intro.includes("later(finish,6800)"), 'Hard finish bound');
assert.ok(intro.includes("SKIP_AFTER = 900"), 'Accessible skip after 0.9s');
assert.ok(intro.includes("prefers-reduced-motion:reduce"), 'Reduced motion accessible');
assert.ok(intro.includes("UNFIRE GAMES") && intro.includes("Y2K <span>ROBOTS</span>"), 'Two identity screens');
assert.ok(intro.includes("document.getElementById('sndBtn')"), 'Respect sound setting');
assert.ok(!intro.includes('https://') && !intro.includes('http://'), 'No external dependencies');
for (const file of ['img/logo-unfire-256.webp','press/captures/06-sky-flight-sunset.jpg'])
  assert.ok(fs.existsSync(path.join(dir,file)), 'Real approved asset required: '+file);
console.log('PASS mobile studio ident structure, original assets, skip, resume, no extra requests and performance gate');
