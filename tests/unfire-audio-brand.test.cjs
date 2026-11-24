'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Audio identity uses existing butterfly in all legacy logo aliases',()=>{
 for(const ext of ['svg','webp'])assert.deepEqual(fs.readFileSync('audio/img/logo-unfire.'+ext),fs.readFileSync('audio/img/emblem-butterfly.'+ext));
 for(const p of ['audio/index.html','audio/catalogo/index.html','audio/fabrica/index.html','audio/halloween/index.html','audio/tienda/index.html','audio/visuales/index.html','unfire-audio/index.html','index.html'])assert.match(read(p),/logo-unfire-256\.webp\?v=20261124butterfly/);
 for(const icon of JSON.parse(read('audio/game.webmanifest')).icons)assert.ok(fs.existsSync('audio/'+icon.src));
});
test('home removes redundant labels and preserves illustration alt text',()=>{
 const home=read('index.html');
 assert.match(home,/<b>Independent technology<\/b> initiative · Spain/);
 assert.doesNotMatch(home,/Architectural model · illustrative|<span class="tag">Render<\/span>/);
 assert.match(home,/alt="Illustrative white architectural model/);
 assert.match(home,/class="uf-ind-image"/);
});
