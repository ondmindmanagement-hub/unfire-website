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
test('one active video on mobile, pause on hidden and resume only visible',async()=>{
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
test('desktop plays all three visible hardware cards, not unrelated videos',async()=>{
 const events={},observers=[];let wide=true;
 const v=(hw=true)=>({dataset:{},paused:true,closest:()=>hw?{}:null,getAttribute:()=> 'none',setAttribute(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},classList:{add(){}}});
 const videos=[v(),v(),v(),v(false)];
 const doc={hidden:false,querySelectorAll:s=>s.includes('video')?videos:[],getElementById:()=>null,documentElement:{classList:{add(){}}},addEventListener(n,f){events[n]=f}};
 const IO=function(f){this.observe=()=>{};observers.push(f)};
 const media={get matches(){return wide},addEventListener(n,f){events.resize=f}};
 vm.runInNewContext(ember,{document:doc,window:{navigator:{hardwareConcurrency:8},IntersectionObserver:IO,matchMedia:s=>s.includes('min-width')?media:{matches:false},addEventListener(){}},IntersectionObserver:IO});
 const entry=(target,ratio)=>({target,isIntersecting:ratio>0,intersectionRatio:ratio});
 observers[1](videos.map(x=>entry(x,.8)));await Promise.resolve();
 assert.deepEqual(videos.map(x=>x.paused),[false,false,false,true]);
 observers[1]([entry(videos[0],0)]);assert.equal(videos[0].paused,true);
 wide=false;events.resize();assert.equal(videos.filter(x=>!x.paused).length,1);
 doc.hidden=true;events.visibilitychange();assert.equal(videos.filter(x=>!x.paused).length,0);
});
test('hero visual aligns low on desktop, hardware stages contain complete frames',()=>{
 assert.match(css,/\.uf-ind-hero \.uf-ind-grid\{align-items:end/);
 assert.match(css,/object-fit:contain;object-position:50% 50%/);
 assert.match(css,/ufLampArrival/);
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

test('lightweight hero bridge is present and content never waits on scroll reveal',()=>{
 assert.match(home,/class="uf-hero-bridge" href="#hardware"/);
 assert.match(home,/Software\. Systems\. Objects\./);
 assert.match(home,/id="ufHomeInstantPaint"/);
 assert.doesNotMatch(ember,/classList\.add\('uf-reveal-on'\)/);
 assert.match(css,/main \[data-uf-reveal\].*opacity:1;transform:none;transition:none/);
 const below=home.slice(home.indexOf('<section id="reach"'),home.indexOf('</main>'));
 for(const tag of below.match(/<img\b[^>]*>/g)||[]){assert.match(tag,/loading="lazy"/);assert.match(tag,/decoding="async"/);}
});
test('Hyperwave mobile first-entry is bounded and MIDI is opt-in only',()=>{
 const atelier=fs.readFileSync('hyperwave-hardware/index.html','utf8'), h=fs.readFileSync('audio/hyperwave/index.html','utf8');
 assert.match(css,/#uf-atelier-dialog\{box-sizing:border-box;inset:0;width:100%;max-width:100%;height:100dvh/);
 assert.match(atelier,/\.studio-poster\{[^}]*overflow-y:auto/);
 assert.match(atelier,/!matchMedia\('\(any-pointer:coarse\), \(max-width:860px\)'\)\.matches\) setTimeout\(loadStudio, 60\)/);
 assert.match(atelier,/allow="autoplay; midi 'none'"/);
 assert.match(h,/if\(!PLUGIN&&!ATELIER&&navigator\.requestMIDIAccess\)/);
 assert.match(h,/midiButton\.addEventListener\('click',async\(\)=>\{[\s\S]*?await navigator\.requestMIDIAccess\(\{sysex:false\}\)/);
 assert.equal((h.match(/requestMIDIAccess\(/g)||[]).length,1);
 assert.match(h,/maxDpr: MOBILE \? 1\.1 : 1\.75/);
});

test('atelier fits portrait camera by projected bounds, never a fixed distance cap',()=>{
 const a=fs.readFileSync('hyperwave-hardware/index.html','utf8'), h=fs.readFileSync('audio/hyperwave/index.html','utf8');
 assert.match(h,/function atelierFitDistance/);assert.match(h,/projectedX \/ \(halfV \* Math.max\(0.15, cam.aspect\)/);
 assert.match(h,/OC.maxDistance = atelierDistance \* 2.05/);assert.match(h,/distance > off.length\(\) \? distance/);
 assert.doesNotMatch(a,/oc.maxDistance = 32/);assert.match(a,/id="studio-fit"/);assert.match(a,/hw.go\(f\); hw.fitView\(\)/);
});
