'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const text=name=>fs.readFileSync(name,'utf8');
const game=text('audio/maletin/index.html');
const lang=text('audio/maletin/language-onboarding.js');
const engine=text('audio/maletin/game-engine-v50.js');
const host=text('audio/index.html');
test('the actual 3D game contains a persistent visible language switch beside the settings gear',()=>{
 assert.match(game,/language-onboarding\.js\?v=20261104visible2/);
 assert.match(lang,/id="ufLangQuickButton"/);
 assert.match(lang,/#ufLangQuick\{position:fixed/);
 assert.match(lang,/data-game-lang="en"/);
 assert.match(lang,/data-game-lang="es"/);
 assert.match(lang,/quickSettings\(\);/);
 assert.match(lang,/aria-expanded/);
 assert.match(lang,/commit\(item\.dataset\.gameLang\)/);
});
test('HYPERWAVE uses opaque high contrast keys, restrained lid, legible display and stable animation',()=>{
 assert.match(game,/const pianoIvory = new THREE\.MeshPhysicalMaterial/);
 assert.match(game,/const pianoEbony = new THREE\.MeshPhysicalMaterial/);
 assert.match(game,/mesh\(wGeo, pianoIvory\)/);
 assert.match(game,/mesh\(bGeo, pianoEbony\)/);
 assert.match(game,/screenGlass\.opacity = 0\.10/);
 assert.match(game,/lidMat = Y2K\.polycarb/);
 assert.match(game,/anim\(kbd/);
 assert.match(game,/reg\(\x27key:/);
});
test('mix HUD uses English labels on English locale without changing music handlers',()=>{
 assert.match(engine,/DRUMS/);
 assert.match(engine,/FOLLOW SONG/);
 assert.match(engine,/KEY.*MODE/);
 assert.match(engine,/Keyboard: A S D F G H J K L/);
 assert.match(engine,/RADIO\.newSong/);
 assert.match(engine,/TON\.mode/);
});
test('browser freshness: host and game both load new asset versions',()=>{
 assert.match(host,/maletin\/index\.html\?v=20261104hyperwave2/);
 assert.match(game,/<script src="game-engine-v50\.js\?v=20261104hyperwave2"><\/script>/);
 assert.match(game,/<link rel="preload" href="game-engine-v50\.js\?v=20261104hyperwave2"/);
});
