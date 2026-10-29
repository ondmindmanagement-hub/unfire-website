const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../../audio/index.html'),'utf8');
test('buy only through official App Store product URLs',()=>{
  assert.match(html,/href="https:\/\/apps\.apple\.com\/us\/app\/archer-by-unfire\/id6812968924"[^>]*>Get it for Mac/);
  assert.match(html,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-for-iphone-ipad\/id6822109610"[^>]*>Current iPhone &amp; iPad app/);
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

test('all Unfire Audio public landing pages remain English-first',()=>{
  const pages=['index.html','audio/index.html','audio/tienda/index.html','audio/catalogo/index.html',
    'audio/compatibilidad/index.html','audio/fabrica/index.html','audio/halloween/index.html',
    'audio/hyperwave/index.html','audio/legal/index.html','audio/maletin/index.html',
    'archer/index.html','archer/press/index.html','archer/logic-pro/index.html',
    'audio/beta/index.html','audio/visuales/index.html','audio/press/index.html',
    'audio/art/index.html','audio/partners/index.html','audio/privacy.html',
    'audio/gracias/hyperwave-3f18e906ea04720510d4/index.html',
    'audio/maletin/test.html','audio/series/index.html'];
  for(const file of pages){
    const page=fs.readFileSync(path.join(__dirname,'../../',file),'utf8');
    assert.match(page,/<html\s+lang="en"/i, file+' must identify as English');
  }
  const game=fs.readFileSync(path.join(__dirname,'../../audio/maletin/index.html'),'utf8');
  assert.match(game,/let L = 'en';/,'English must be the initial website language');
  assert.doesNotMatch(game,/localStorage\.getItem\('unfire_lang'\)/,'old saved Spanish preference must not change the English-only website');
  assert.match(html,/>Instruments<\/a>/,'primary nav must be English');
  assert.match(html,/>Effects<\/a>/,'primary nav must be English');
  assert.match(html,/>Pricing<\/a>/,'primary nav must be English');
});

test('public ARCHER artwork uses only the newer user-approved original preview',()=>{
  const preview='archer-nocturne-app-preview-20261028.webp';
  const files=['index.html','archer/index.html','archer/press/index.html',
    'archer/logic-pro/index.html','audio/index.html','audio/tienda/index.html',
    'audio/maletin/game-engine-v50.js'];
  for(const file of files){
    const content=fs.readFileSync(path.join(__dirname,'../../',file),'utf8');
    assert.ok(content.includes(preview),file+' must use the current approved ARCHER image');
    assert.doesNotMatch(content,/archer-mac\.webp|archer-mobile\.webp|archer-screenshot-[12]-1280x800\.png|['"]archer\.webp['"]/i,file+' must not display the retired design');
  }
  for(const image of ['assets/products/archer-nocturne-app-preview-20261028.webp',
    'audio/img/archer-nocturne-app-preview-20261028.webp'])
    assert.ok(fs.statSync(path.join(__dirname,'../../',image)).size>100000,'Missing real approved app screenshot: '+image);
  for(const retired of ['assets/products/archer-mac.webp','assets/products/archer-mobile.webp',
    'audio/img/archer.webp','archer/media/archer-01.png','archer/media/archer-02.png','archer/media/archer-thumbnail.png'])
    assert.equal(fs.existsSync(path.join(__dirname,'../../',retired)),false,'Retired visual must not remain publicly served: '+retired);
});
