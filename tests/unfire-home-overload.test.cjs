'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const home=fs.readFileSync('index.html','utf8'), css=fs.readFileSync('assets/css/unfire-ember-20261123.css','utf8'), ember=fs.readFileSync('assets/js/unfire-ember-20261123.js','utf8'), hw=fs.readFileSync('assets/js/unfire-hw3d-20261123.js','utf8');
test('institutional hero has a clean image and no numbered markers',()=>{
 const hero=home.slice(home.indexOf('class="hero unfire-real-hero'),home.indexOf('<section id="reach"'));
 assert.match(hero,/<div class="uf-ind-image">[\s\S]*?<img[\s\S]*?<\/div>\s*<figcaption class="uf-hero-caption">/);
 assert.doesNotMatch(hero,/class="uf-pin"|class="uf-legend|class="n uf-mono"/);
 assert.match(hero,/href="\/enterprise\/"/);
 assert.match(hero,/href="\/public-record\/"/);
 assert.match(hero,/<b>Independent technology<\/b>/);
 assert.match(css,/\.uf-ind-hero \.uf-ind-grid\{grid-template-columns:1fr/);
});
test('one active hardware video, pause on hidden and resume only visible',async()=>{
 const events={}, observers=[];
 const makeVideo=()=>({dataset:{},paused:true,getAttribute:()=> 'none',setAttribute(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},classList:{add(){}}});
 const videos=[makeVideo(),makeVideo(),makeVideo()];
 const doc={hidden:false,querySelectorAll(s){return s.includes('video')?videos:[]},getElementById(){return null},documentElement:{classList:{add(){}}},addEventListener(n,f){events[n]=f}};
 const IO=function(f){this.observe=()=>{};observers.push(f)};
 vm.runInNewContext(ember,{document:doc,window:{IntersectionObserver:IO,matchMedia:()=>({matches:false}),addEventListener(){}},IntersectionObserver:IO});
 observers[1](videos.map((target,i)=>({target,isIntersecting:true,intersectionRatio:.4+i*.2})));
 await Promise.resolve();
 assert.equal(videos.filter(v=>!v.paused).length,1);
 assert.equal(videos[2].paused,false);
 doc.hidden=true;events.visibilitychange();assert.equal(videos.filter(v=>!v.paused).length,0);
 doc.hidden=false;events.visibilitychange();assert.equal(videos.filter(v=>!v.paused).length,1);
 events['uf-atelier-state']({detail:true});assert.equal(videos.filter(v=>!v.paused).length,0);
 events['uf-atelier-state']({detail:false});assert.equal(videos.filter(v=>!v.paused).length,1);
});
test('graphics idle and async close guards',()=>{
 assert.match(hw,/if\(quiet>=3\)\{stop\(\);return;\}/);
 assert.match(hw,/generation!==token/);
 assert.match(ember,/pauseClosed\(\)/);
 assert.match(home,/for\(const record of records\)/);
});
test('hardware modal separates persistent controls from scrollable detail region',()=>{
 const dialog=home.slice(home.indexOf('<dialog id="uf-hw-dialog"'),home.indexOf('<dialog id="uf-atelier-dialog"'));
 assert.match(dialog,/<div class="uf-dlg-top[\s\S]*?<div class="uf-dlg-media[\s\S]*?<div class="uf-dlg-info[\s\S]*?<\/div>\s*<div class="uf-dlg-nav">/);
 assert.match(css,/grid-template-areas:"top" "media" "info" "nav"/);
 assert.match(css,/grid-template-areas:"top top" "media info" "nav nav"/);
});
test('model can expand and restore without losing navigation',()=>{
 assert.match(home,/class="uf-dlg-expand" aria-pressed="false"/);
 assert.match(css,/\.is-expanded \.uf-dlg-inner\{[^}]*grid-template-areas:"top" "media" "nav"/);
 assert.match(css,/\.uf-ind-hero \.uf-ind-bar b\{color:var\(--uf-ink\)/);
});
test('Hyperwave MIDI is opt-in and atelier has no MIDI access',()=>{
 const wave=fs.readFileSync('audio/hyperwave/index.html','utf8');
 const atelier=fs.readFileSync('hyperwave-hardware/index.html','utf8');
 const init=wave.slice(wave.indexOf('function ensureSyn()'),wave.indexOf('const midiButton='));
 assert.doesNotMatch(init,/requestMIDIAccess/);
 assert.match(wave,/midiButton\.addEventListener\('click',async/);
 assert.match(wave,/requestMIDIAccess\(\{sysex:false\}\)/);
 assert.match(home,/midi 'none'/);
 assert.match(atelier,/midi 'none'/);
 assert.match(wave,/MOBILE \? 1\.1 : 1\.75/);
 assert.match(wave,/function pauseFrame\(v\).*cancelAnimationFrame/);
 assert.match(atelier,/!reduce && !doc\.classList\.contains\('embed'\)/);
});
test('hardware performance budget and mobile expansion guard',()=>{
 assert.match(ember,/any-pointer: coarse/);
 assert.match(ember,/on=!!on&&!compact.matches&&!dlg.classList.contains\('uf-low-gpu'\)/);
 assert.match(css,/\.uf-dlg-expand\[hidden\]/);
 assert.match(hw,/maxPixels=low\?280000:1400000/);
 assert.match(hw,/Math.sqrt\(maxPixels\/\(w\*h\)\)/);
 assert.match(hw,/if\(!low&&window.__ufHwMat\)/);
 assert.match(hw,/webglcontextlost/);
 assert.match(hw,/fallback\(true\)/);
});
