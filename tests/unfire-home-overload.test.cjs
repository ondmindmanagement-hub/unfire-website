'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const home=fs.readFileSync('index.html','utf8'), css=fs.readFileSync('assets/css/unfire-ember-20261123.css','utf8'), ember=fs.readFileSync('assets/js/unfire-ember-20261123.js','utf8'), hw=fs.readFileSync('assets/js/unfire-hw3d-20261123.js','utf8');
test('hero markers positioned relative to image, not wrapping legend',()=>{
 assert.match(home,/<div class="uf-ind-image">[\s\S]*?class="uf-pin"[\s\S]*?<\/div>\s*<figcaption class="uf-legend/);
 assert.match(css,/\.uf-ind-image\{position:relative/);
 assert.match(css,/\.uf-ind-hero \.uf-legend\{grid-template-columns:1fr/);
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
