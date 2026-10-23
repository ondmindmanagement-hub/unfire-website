'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const s = fs.readFileSync('audio/maletin/game-engine-v50.js', 'utf8');
const a = s.indexOf('const WRADIO = (() =>');
const b = s.indexOf('// ===== NIMBO,', a);
assert(a > 0 && b > a, 'Real 3D world music radio should remain present');
const radio = s.slice(a,b);
function check(label, pass){assert.ok(pass,label);console.log('PASS',label);}
check('Music radio starts at 27%, not previous 80%', /const st = \{ vol: 0\.27,/.test(radio) && !/const st = \{ vol: 0\.8,/.test(radio));
check('Visible radio volume slider is also 27% on first visit', /id="wrV"[^>]+min="0"[^>]+max="1"[^>]+step="0\.01"[^>]+value="0\.27"/.test(radio));
check('Existing radio slider has full 0–100% range and remains editable', radio.includes("bar.querySelector('#wrV').oninput = (e) =>") && radio.includes("st.vol = Math.min(1, Math.max(0, +e.target.value))"));
check('Manual volume choices persist and are restored safely',radio.includes("const radioVolumeKey = 'unfire_radio_volume_v1'") &&
 radio.includes('localStorage.getItem(radioVolumeKey)') && radio.includes('localStorage.setItem(radioVolumeKey, String(st.vol))') &&
 radio.includes('Number.isFinite(+saved)') && radio.includes("bar.querySelector('#wrV').value = String(st.vol)") );
check('27% radio control only affects world-music channel', radio.includes('gIn.gain.setTargetAtTime(quiet ? 0 : st.vol * 1.1') && !radio.includes('UA.bus.master.gain.value = st.vol'));
check('Radio quiets down during dialogs, preserves music context', radio.includes('const quiet = busy || st.idle < 1.5') &&
 radio.includes('gIn.gain.setTargetAtTime(quiet ? 0 : st.vol * 1.1') );
console.log('Radio default and persistence checks passed');
