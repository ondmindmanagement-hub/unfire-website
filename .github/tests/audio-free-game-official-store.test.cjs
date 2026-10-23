const fs=require('fs');
const assert=require('node:assert/strict');
const path=require('path');
const repo=path.resolve(__dirname,'../..');
const page=fs.readFileSync(path.join(repo,'audio/tienda/index.html'),'utf8');
const catalog=fs.readFileSync(path.join(repo,'audio/catalogo/index.html'),'utf8');
const gate=JSON.parse(fs.readFileSync(path.join(repo,'.github/audio-commerce-release.json'),'utf8'));
const guide=fs.readFileSync(path.join(repo,'.github/docs/unfire-audio-free-daw-interoperability.md'),'utf8');
assert.match(page,/<html lang="es">/);
assert.match(page,/<meta name="viewport"/);
assert.match(page,/href="\.\.\/" aria-label="Abrir juego gratuito Unfire Audio"/);
assert.match(page,/No disponible aún/);
assert.match(page,/No existe todavía una descarga AU\/VST3 publicada/);
assert.match(page,/No existe ningún checkout directo/);
assert.match(catalog,/href="\.\.\/tienda\/"/);
for(const id of ['6812968924','6822109610','6814615903','6815880143']){
 assert.equal(page.split('id'+id+'\"').length-1,1,`one official link for ${id}`);
}
assert.equal((page.match(/target="_blank"/g)||[]).length,4);
assert.equal((page.match(/rel="noopener noreferrer"/g)||[]).length,4);
assert(!/<script|onerror=|onclick=/i.test(page),'static storefront, no scripts or inline event handlers');
assert(!/checkout\.stripe\.com|buy\.stripe\.com|payment_intent|SECRET_KEY/i.test(page));
assert.equal(gate.direct_web_checkout_authorized,false);
assert.match(guide,/Juego gratuito/);
assert.match(guide,/AUv3/);
assert.match(guide,/VST3/);
console.log('PASS official store: 4 verified links, free game, no false DAW release, commerce gate off');
