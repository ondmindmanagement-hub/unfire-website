'use strict';
const {test} = require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const audio=read('audio/index.html');
const game=read('audio/maletin/index.html');
const intro=read('audio/maletin/game-intro.js');
const catalog=read('audio/catalogo/index.html');
const shop=read('audio/tienda/index.html');
const forbidden=/\b(?:efectos|instrumentos|ritmos|ahorras|comprarlo|suelto|copia el enlace|enlace copiado|girar la manivela|reiniciar gráficos|el dispositivo ha interrumpido|selecciona idioma|continuar|español|castellano)\b/i;
function visibleText(document){
  return document
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&[a-z]+;/gi,' ')
    .replace(/\s+/g,' ');
}
test('public Unfire Audio static visible HTML uses English',()=>{
  for(const [name,s] of [['audio/index.html',audio],['audio/catalogo/index.html',catalog],['audio/tienda/index.html',shop],['audio/maletin/index.html',game]]){
    assert.doesNotMatch(visibleText(s),forbidden,name);
  }
});
test('capsule filters and cart labels are English; IDs remain stable for deep links',()=>{
 assert.match(audio,/const FAMS=\{fx:\['Effects'/);
 assert.match(audio,/inst:\['Instruments'/);
 assert.match(audio,/drums:\['Rhythms'/);
 assert.match(audio,/>AU and VST3 on Mac</);
 assert.match(audio,/Save <span data-p="saveAll"><\/span> versus buying separately/);
 assert.match(audio,/per month · or <span data-p="clubY"><\/span> per year/);
 assert.match(audio,/'Free starter \(3 FX\)'/);
 assert.match(audio,/'Launch notification'/);
 assert.match(audio,/'✓ Link copied'/);
 assert.match(audio,/'Copy the game link'/);
 assert.match(audio,/aria-label="Spin the handle"/);
 for(const anchor of ['instrumentos','efectos','capsulas']) assert.match(audio,new RegExp('id="'+anchor+'"'));
});
test('public 3D game stays English even when locale storage is unavailable',()=>{
 assert.match(game,/window\.__UNFIRE_PUBLIC_ENGLISH_ONLY=true/);
 assert.match(intro,/window\.__UNFIRE_PUBLIC_ENGLISH_ONLY === true/);
 assert.doesNotMatch(game,/<script[^>]+src="language-onboarding\.js/);
 assert.match(game,/content:"↩ EXIT"/);
 assert.match(game,/RESTART GRAPHICS/);
 assert.match(game,/The device interrupted the 3D graphics/);
 assert.match(game,/game-intro\.js\?v=20261029english1/);
});
