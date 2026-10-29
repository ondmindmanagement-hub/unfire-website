'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ask=read('assets/js/ask-unfire.js');
const load=read('assets/js/unfire-adaptive-loading.js');
const host=read('audio/index.html');
const game=read('audio/maletin/index.html');
const map=read('audio/maletin/expanded-map.js');
const coins=read('audio/maletin/coins-shop.js');
const music=read('audio/maletin/mobile-hud-guard.js');
const cinema=read('audio/maletin/cinema-export.js');
const studio=read('audio/fabrica/index.html');
const homepage=read('index.html');
test('all public loading and assistant labels default to English, even in Spanish browsers',()=>{
 assert.match(load,/function copy\(kind\)\{return kind==='recovery'\?'Restoring smoothness/);
 assert.doesNotMatch(load,/Recuperando fluidez|Preparando el mundo 3D|Preparando la experiencia/);
 assert.match(ask,/var lang = "en";/);
 assert.match(ask,/<button[^>]*id="lang"[^>]*hidden[^>]*style="display:none"/);
 assert.doesNotMatch(ask,/langButton\.addEventListener\("click"/);
 assert.match(host,/PREPARING 3D CASE/);
 assert.match(homepage,/ask-unfire\.js\?v=20261029en2/);
});
test('map and HUD are English, with original render/input contracts kept',()=>{
 for(const text of ['WORLD MAP','THE HOUSE','THE ISLAND','Drag to explore','CLOSE','◆ PLAYER','★ MISSION'])assert.ok(map.includes(text),text);
 for(const old of ['MAPA DEL MUNDO','LA ISLA','Cerrar mapa','MISIÓN','JUGADOR'])assert.ok(!map.includes(old),old);
 assert.match(map,/window\.UnfireExpandedMap/);
 assert.match(map,/canvas\.addEventListener\('pointermove'/);
 assert.match(music,/♫ MUSIC · SETTINGS/);
 assert.match(music,/✕ CLOSE MUSIC/);
 assert.doesNotMatch(music,/MÚSICA|AJUSTES|CERRAR/);
});
test('coins retain local economy and identifiers with English labels only',()=>{
 assert.match(coins,/unfire_offline_coins_v1/);
 assert.match(coins,/unfire_offline_coin_claims_v1/);
 assert.match(coins,/Offline coins/);
 assert.match(coins,/No real-money purchases/);
 assert.match(coins,/Available coins/);
 assert.match(coins,/group:'Effects'/);
 assert.match(coins,/group:'Transformations'/);
 assert.match(coins,/Equipped/);
 assert.doesNotMatch(coins,/Monedas disponibles|Tienda de monedas|Efectos|Personalización|Exploración|Transformaciones/);
 assert.match(coins,/if\(!active\(\) \|\| !shop\.classList\.contains\('open'\)\)return false/);
});
test('cinema and studio recording status is English without changing capture limits',()=>{
 assert.match(cinema,/RECORD VIDEO/);
 assert.match(cinema,/STOP & SAVE/);
 assert.match(cinema,/Video saved/);
 assert.match(cinema,/maxInMemory=210\*1024\*1024/);
 assert.match(cinema,/elapsed>=20\*60/);
 assert.match(studio,/Creating beat/);
 assert.match(studio,/Take saved/);
 assert.match(studio,/Recording 2 s on pad/);
 assert.match(studio,/m==='mayor'\?'major':'minor'/);
 assert.match(studio,/value="\$\{i\}\|\$\{m\}"/);
});
test('new cache versions are enabled for the game and site',()=>{
 for(const src of ['expanded-map','coins-shop','cinema-export','mobile-hud-guard'])
  assert.ok(game.includes(src+'.js?v=20261029en2'),src);
 assert.match(game,/unfire-adaptive-loading\.js\?v=20261029en2/);
 assert.match(host,/unfire-adaptive-loading\.js\?v=20261029en2/);
});
