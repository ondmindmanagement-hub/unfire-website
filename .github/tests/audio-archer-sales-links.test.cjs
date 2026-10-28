const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../../audio/index.html'),'utf8');
test('buy only through official App Store product URLs',()=>{
  assert.match(html,/href="https:\/\/apps\.apple\.com\/us\/app\/archer-by-unfire\/id6812968924"[^>]*>Get it for Mac/);
  assert.match(html,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-for-iphone-ipad\/id6822109610"[^>]*>iPhone \/ iPad/);
});
test('the web game stays free and unverified web checkout stays off',()=>{
  assert.match(html,/const READY_FOR_SALE=new Set\(\[\]\)/);
  assert.match(html,/const READY_FOR_SALE=new Set\(\[\]\)/);
  assert.match(html,/data-archer>▶ Try on the web/);
});

test('unreleased cart offers only true third-party purchase alternatives',()=>{
  const bag=html.match(/<p id="bagUnreleased"[\s\S]*?<\/p>/)?.[0]||'';
  assert.match(bag,/ARCHER for Mac/);
  assert.match(bag,/ARCHER for iPhone or iPad/);
  assert.match(bag,/An email inquiry does not constitute a purchase/);
});

test('in-game ARCHER points to its own offer, never charges Todo UNFIRE bundle',()=>{
 const engine=fs.readFileSync(path.join(__dirname,'../../audio/maletin/game-engine-v50.js'),'utf8');
 assert.match(engine,/\['ARCHER', '#2bd96b', 'archer'\]/);
 assert.match(engine,/archer: 'archer'/);
 assert.match(engine,/parentPost\(\{ open: 'archer' \}\)/);
 assert.doesNotMatch(engine,/archer: 'todo'/);
 assert.doesNotMatch(engine,/\['ARCHER', '#2bd96b', 'todo'\]/);
 const game=fs.readFileSync(path.join(__dirname,'../../audio/maletin/index.html'),'utf8');
 const gameVersions=[...game.matchAll(/game-engine-v50\.js\?v=([a-zA-Z0-9]+)/g)].map(m=>m[1]);
 const hostVersion=html.match(/maletin\/index\.html\?v=([a-zA-Z0-9]+)/)?.[1];
 assert(gameVersions.length>=2,'preload and script must both carry a version');
 assert(gameVersions.every(v=>v===gameVersions[0]),'preload and script versions must match');
 assert.equal(hostVersion,gameVersions[0],'host frame and 3D engine must use same cache-bust revision');
});

test('demo purchase directs an iPhone/iPad to ARCHER for iOS rather than Mac-only edition',()=>{
  assert.match(html,/const archerStoreUrl=\(\)=>\/iPad\|iPhone\|iPod\//);
  assert.match(html,/window\.open\(archerStoreUrl\(\),'_blank','noopener'\)/);
});
