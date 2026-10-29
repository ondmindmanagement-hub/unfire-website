'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/index.html'),'utf8');

test('3D in-world radio and exhibition labels are English',()=>{
 for(const phrase of [
   'NOW PLAYING','RADIO PAUSED','3D SOUND','STORM','THUNDER',
   'UNFIRE · HOUSE RADIO','from the UNFIRE collection',
   'Wait for the plugin to return to its position',
   'UNFIRE lava lamp · giant edition'
 ]) assert.ok(html.includes(phrase),phrase);
 for(const phrase of ['MÁQUINA','CERRADO','RADIO EN PAUSA','SONIDO 3D','Lámpara de lava UNFIRE'])
   assert.ok(!html.includes(phrase),phrase);
});

test('story onboarding, menus and save HUD display in English',()=>{
 for(const phrase of [
   '📖 STORY', '🗺️ MAP','💾 SAVE','NIMBO · YOUR GUIDE',
   'Hey! Down here, next to the case','How much do you know about music',
   'I’M NEW TO THIS','START STORY','THE LOST SECOND',
   'Meeting Nimbo is optional','MEET NIMBO','DELETE SAVE','Game saved · chapter'
 ]) assert.ok(html.includes(phrase),phrase);
 for(const old of ['id="stM">📖 HISTORIA','id="stS">💾 GUARDAR',
                    'id="stSkip">SIGUIENTE ▸','id="mPlay">▶ EMPEZAR LA HISTORIA',
                    'id="mRs" class="alt">BORRAR PARTIDA'])
   assert.ok(!html.includes(old),old);
});

test('public world selector cannot switch the presentation to Spanish',()=>{
 assert.match(html,/q\.fillText\('🌐 ENGLISH', 128, 41\)/);
 assert.match(html,/English is the display language/);
 assert.doesNotMatch(html,/window\.__setLang\(window\.__LANG === 'en' \? 'es' : 'en'\)/);
 assert.match(html,/window\.__UNFIRE_PUBLIC_ENGLISH_ONLY=true/);
});

test('game identity and story/save mechanics remain in place',()=>{
 for(const phrase of [
   "hud.id = 'storyHud'", 'id="stM"','id="stP"','id="stS"',
   'unfire_lang','window.__LANG','SAVE.step','SAVE.ch',
   'H.navigateTo','H.robotMode','store(SAVE)',
   'id="mRs"', 'id="mPlay"'
 ]) assert.ok(html.includes(phrase),phrase);
});
