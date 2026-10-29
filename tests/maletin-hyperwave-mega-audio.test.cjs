'use strict';
// Safety contract for curated Hyperwave and MEGA audio. Original CC0 samples,
// game engine and UI remain unchanged except for targeted gain/timbre logic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const game = fs.readFileSync('audio/maletin/index.html','utf8');
const standalone = fs.readFileSync('audio/hyperwave/index.html','utf8');
const synth = fs.readFileSync('audio/js/synthvoice.js','utf8');
const plugins = fs.readFileSync('audio/js/engines.js','utf8');
function check(name,condition){assert.ok(condition,name);console.log('PASS',name);}
new vm.Script(engine,{filename:'game-engine-v50.js'});
new vm.Script(synth,{filename:'synthvoice.js'});
new vm.Script(plugins,{filename:'engines.js'});
check('FX chain only offers musical, non-destructive random modes',
  engine.includes("mega ? ['clean', 'phase', 'dub', 'phasedub']") &&
  !engine.includes("mega ? ['ring', 'phase', 'crush'"));
check('MEGA FX gain and echo feedback are bounded',
  engine.includes("Math.min(0.90, Math.max(0.48, v * 0.48))") &&
  engine.includes("mega ? 0.18 : 0.13") &&
  engine.includes("dens > 0.6 ? 0.22 : 0.30"));
check('MEGA auto-melody chooses current RADIO scale rather than minor',
  engine.includes("const sc = (RADIO.scale && RADIO.scale()) ||"));
check('MEGA lead leaves musical headroom',
  engine.includes("v.noteOn(m, 0.42, t0, 'm')") &&
  engine.includes("0.032, t0 + 0.02"));
check('Preset FM ratios tuned to harmonics in every sound source',
  [game,standalone,synth].every(s => s.includes("m.frequency.value = f * 2;") &&
    s.includes("mg.gain.setValueAtTime(f * 2.0, t)")) &&
  [game,standalone,plugins].every(s => s.includes("mo.frequency.value = f * 2;") &&
    s.includes("mg.gain.setValueAtTime(f * 2.2, t)")));
check('No wet FX feedback runaway',
  [game,standalone,synth].every(s => s.includes('Math.min(0.43, 0.16 + P.delay * 0.23') &&
    s.includes('P.reverb * 0.48')));
check('Radio harsh bell leads replaced with existing samples',
  game.includes("lead: { kind: 'smp', ins: 'vibes', rh: 'trap' }") &&
  game.includes("lead: { kind: 'smp', ins: 'piano', rh: 'trap' }") &&
  !game.includes("lead: { kind: 'smp', ins: 'bells', rh: 'trap' }"));
check('Case opening chime is lower and limited to chord notes',
  game.includes("smp('vibes', m + 12") && !game.includes("smp('bells', m + 24"));
check('True-peak trims applied to previously flagged drum samples',
  game.includes("key === 'st_kick' ? 0.79") && game.includes("key === 'st_snare' ? 0.85"));
check('MEGA sample level control is non-destructive, no new sample assets',
  game.includes("0.42 : 1);") && game.includes('const metalTrim = window.__mega'));
check('Preserve story, 3D engine, original samples and multiplayer',
  engine.length>500000 && game.includes('const RADIO = (() =>') &&
  engine.includes('const ONLINE =') && engine.includes('const CAPS=(()=>'));

const begin = engine.indexOf('function SNAP(m) {');
const end = engine.indexOf('  const bots =',begin);
assert(begin > 0 && end > begin, 'Real tuning routine must remain in engine');
const source = engine.slice(begin,end);
function quantize({scale,root,chord,mode='auto',key=-1},note){
  const context = {
    RADIO: { st:{style:0,root,on:true}, scale:()=>scale, chordAt:()=>chord },
    TON:{mode,key},MODES:{
      mayor:[0,2,4,5,7,9,11],menor:[0,2,3,5,7,8,10],
      dorico:[0,2,3,5,7,9,10],penta:[0,3,5,7,10],blues:[0,3,5,6,7,10]
    },LASTCH:chord
  };
  const fn=vm.runInNewContext('(function(){'+source+';return SNAP;})()',context);
  return fn(note);
}
const major=[0,2,4,5,7,9,11],dorian=[0,2,3,5,7,9,10];
check('Manual C major quantizes C# to chord-tone C',
  quantize({scale:major,root:48,chord:[60,64,67]},61)===60);
check('Radio F# major prevents out-of-key C natural',
  quantize({scale:major,root:42,chord:[66,70,73]},60)===61);
check('Dorian radio selects its F# rather than F natural',
  quantize({scale:dorian,root:45,chord:[57,61,66]},65)===66);
check('Explicit transposer key/mode overrides RADIO scale',
  quantize({scale:dorian,root:45,chord:[57,61,66],mode:'penta',key:0},61)===60);
check('Quantizer stays inside playable register for outlier input',
  [12,24,72,96,120].every(m=>{const n=quantize({scale:major,root:48,chord:[60,64,67]},m);return n>=33&&n<=81;}));
console.log('All curated Hyperwave/MEGA sound and transposer contracts passed');
