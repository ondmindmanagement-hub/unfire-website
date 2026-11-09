'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const text=name=>fs.readFileSync(name,'utf8');
const game=text('audio/maletin/index.html');
const lang=text('audio/maletin/language-onboarding.js');
const engine=text('audio/maletin/game-engine-v50.js');
const host=text('audio/index.html');
test('English and Spanish are selected inside existing Settings without a floating button',()=>{
 assert.match(game,/language-onboarding\.js\?v=20261104settings3/);
 assert.match(lang,/const group=document\.createElement\('div'\);group\.id='ufLangSettings'/);
 assert.match(lang,/sel\.id='ufLangSelect'/);
 assert.match(lang,/sel\.innerHTML='<option value="en">English<\/option><option value="es">Español<\/option>'/);
 assert.doesNotMatch(lang,/quickSettings\(\)/);
 assert.doesNotMatch(lang,/ufLangQuickButton/);
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
 assert.match(host,/maletin\/index\.html\?v=20261109flightpace1/);
 assert.match(game,/<script src="game-engine-v50\.js\?v=20261109flightpace1"><\/script>/);
 assert.match(game,/<link rel="preload" href="game-engine-v50\.js\?v=20261109flightpace1"/);
});

test('Unknown computer app has no spoilers and retains bilingual neutral feedback',()=>{
 assert.match(engine,/const uiText = \(english, spanish\) => window\.__LANG === 'es'/);
 assert.match(engine,/id="pcMysteryApp"/);
 assert.match(engine,/id="pcSecret"/);
 assert.match(engine,/id="pcSecretGo" type="button">OK/);
 assert.match(engine,/msg\.textContent=uiText\('Not recognized\.','No reconocido\.'/);
 assert.match(engine,/set\('#pcSecretBack','← DESKTOP'\)/);
 assert.match(engine,/set\('#pcDesktop small','Choose an application\.'\)/);
 assert.doesNotMatch(engine,/ULTIMATEROBOTS/);
 assert.doesNotMatch(engine,/Enter the code to unlock playable robots/);
 assert.doesNotMatch(engine,/Introduc(e|e el) código para desbloquear los robots/);
});
test('Reference Hyperwave keyboard clears the chassis and all-open ends in the full 3D pose',()=>{
 assert.match(game,/const KY = 0\.56, kw = 0\.205/);
 assert.match(game,/const FEET = 0\.06, HB = 0\.46, CY = FEET \+ HB/);
 assert.match(game,/Y2K\.polycarb\('#145ce6', \{ opacity: 0\.70/);
 assert.match(engine,/if \(HW\) HW\.tg = 3\.6; say\('Todo abierto/);
 assert.doesNotMatch(engine,/if \(HW\) HW\.tg = 1\.2; say\('Todo abierto/);
 assert.match(engine,/dt \* 1\.8/);
});
