'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const lunar=fs.readFileSync('audio/maletin/lunar-world.js','utf8'),engine=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8'),html=fs.readFileSync('audio/maletin/index.html','utf8'),host=fs.readFileSync('audio/index.html','utf8');
function load(){const ctx={window:{ATM_OUT:false},console};vm.runInNewContext(lunar,ctx);return ctx;}
test('moon terrain deterministic, continuous and finite across the whole map',()=>{
 const h=load().window.UnfireLunarWorld.terrainHeight;
 for(let x=-1000;x<=1000;x+=107)for(let z=-1000;z<=1000;z+=151){
   const a=h(x,z),b=h(x+.1,z+.1);assert(Number.isFinite(a));
   assert(Math.abs(a-b)<1,'seam or discontinuous hill: '+x+','+z);
   assert.equal(a,h(x,z),'terrain must not use random geometry on each tile');
 }
});
test('lunar game does not build any extra geometry on first island render',()=>{
 const ctx=load();
 const ROAMS={on:false,p:{x:0,z:0},k:{}};
 const api=ctx.window.UnfireLunarWorld.create({ROAMS});
 for(let i=0;i<150;i++)api.tick(.033,i*.033);
 assert.equal(api.mode,'island');assert.equal(api.active,false);
 ctx.window.ATM_OUT=true;ROAMS.on=true;
 for(let i=0;i<150;i++)api.tick(.033,i*.033);
 assert.equal(api.active,false,'far-away islands should not wake moon');
});
test('lunar path selects only the second, existing pink and gold exterior titan',()=>{
 assert.match(engine,/lunarShip:i === 1/);
 assert.match(engine,/if \(G2\.lunarShip\) \{ G2\.wd = 0/);
 assert.match(engine,/LUNAR\.preTick\(\)/);
 assert.match(engine,/LUNAR\.tick\(dt,t\)/);
 assert.match(lunar,/gateInfo\(\).*mode\('ship'\)/s);
 assert.match(lunar,/foot|pie derecho|EL PIE DERECHO/);
 assert.match(lunar,/EL PECHO/);
 assert.match(lunar,/store\.mode==='flight'&&store\.time>=28/);
});
test('single shared 3D scene, moon layers and finite geometry budget, free noclip cinema',()=>{
 assert.doesNotMatch(lunar,/new THREE\.WebGLRenderer|new AudioContext|requestAnimationFrame\(/);
 assert.match(lunar,/cam\.layers\.set\(store\.mode==='moon'\?3:2\)/);
 assert.match(lunar,/const tiles=\[\],tileSize=180,div=24/);
 assert.match(lunar,/for\(let i=0;i<9;i\+\+\)/);
 assert.match(lunar,/LOWDEV\?9:18/);
 assert.match(lunar,/document\.body\.classList\.add\('unfire-lunar'\)/);
 assert.match(engine,/Cinematic camera is a spectator, independent of robot and collision physics/);
});
test('host, engine and lunar module are cache coherent without dropping prior modules',()=>{
 assert.match(html,/lunar-world\.js\?v=20261024lunar1/);
 assert.match(html,/game-engine-v50\.js\?v=20261024filmrec1/);
 assert.match(host,/maletin\/index\.html\?v=20261024filmrec1/);
 assert.match(html,/unfire-conversations\.js\?v=20261024organic1/);
 assert.match(html,/companion-natural-flight\.js\?v=20261024organic1/);
});
