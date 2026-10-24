import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const host = fs.readFileSync(new URL('../audio/index.html', import.meta.url),'utf8');
const engine = fs.readFileSync(new URL('../audio/maletin/game-engine-v50.js', import.meta.url),'utf8');
const bridge = fs.readFileSync(new URL('../assets/js/unfire-audio-metrics-bridge.js',import.meta.url),'utf8');

test('bridge host hooks exist in current Audio host', () => {
  for (const marker of ['id="malFrame"', 'id="heroPin"', 'scene-ready', 'immOn']) {
    assert.ok(host.includes(marker), 'Missing actual host contract: ' + marker);
  }
  for (const marker of ["caseState:'open'", "caseState:'closed'"]) {
    assert.ok(engine.includes(marker), 'Missing engine event contract: ' + marker);
  }
});

test('bridge does not monkey-patch 3D engine or track non-consenting users', () => {
  assert.match(bridge, /unfire:consent-updated/);
  assert.match(bridge, /event\.source !== frame\.contentWindow/);
  assert.match(bridge, /event\.origin !== root\.location\.origin/);
  assert.doesNotMatch(bridge, /requestAnimationFrame|setInterval|setTimeout|render\(|prototype\./);
});
