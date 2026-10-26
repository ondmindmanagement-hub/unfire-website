const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'audio', 'maletin');
const mod = fs.readFileSync(path.join(dir, 'idle-dance.js'), 'utf8');
const page = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const eng = fs.readFileSync(path.join(dir, 'game-engine-v50.js'), 'utf8');

test('idle dance module loads after the engine and conversations', () => {
  const e = page.indexOf('game-engine-v50.js'), c = page.indexOf('unfire-conversations.js'), d = page.indexOf('idle-dance.js');
  assert.ok(e > 0 && c > e && d > c, 'idle-dance.js must load last');
});
test('robot starts dancing after 19 idle seconds and stops on movement, flight, water or cinema', () => {
  assert.match(mod, /const IDLE_SECONDS = 19;/);
  assert.match(mod, /r\.moving \|\| r\.fly \|\| r\.wet \|\| r\.air \|\| \(REC\(\) && REC\(\)\.on\)/);
});
test('J opens the dance picker with seven styles, never while HYPERWAVE owns the keyboard', () => {
  assert.match(mod, /k === 'j' && !e\.repeat && r && r\.on && !\(window\.__hwOpen && window\.__hwOpen\(\)\)/);
  assert.strictEqual((mod.match(/\{ id: '[a-z]+', name:/g) || []).length, 7);
  assert.match(eng, /window\.__hwOpen = \(\) => !!\(HW && \(HW\.T \|\| 0\) >= 2\.5\);/);
});
test('friends join in front of the player (opposite the camera) and are released back to their AI', () => {
  assert.match(mod, /const yaw = r\.yaw \|\| 0, fwd = Math\.atan2\(-Math\.cos\(yaw\), Math\.sin\(yaw\)\)/);
  assert.match(mod, /f\.st = 'idle'; f\.t = 1 \+ Math\.random\(\) \* 2;/);
});
test('nano camera stays close while flying and nano surf tricks are proportional', () => {
  assert.match(eng, /if \(ROAMS\.mini\) \{ const ap = V\(ROAMS\.p\.x, -8\.9 \+ \(ROAMS\.h \|\| 0\) \+ 0\.14, ROAMS\.p\.z\);/);
  assert.match(eng, /ROAMS\.vy = ROAMS\.mini \? jv \/ 30 \* avatarProfile\(\)\.gravity \* 0\.575 : jv;/);
  assert.match(eng, /if \(k === ' ' && !e\.repeat && window\.ATM_OUT && ROAMS\.wet && !ROAMS\.fly && ROAMS\.board\)/);
  assert.match(eng, /ROAMS\.air = ROAMS\.h > fl \+ \(ROAMS\.mini \? 0\.05 : 0\.9\);/);
});
