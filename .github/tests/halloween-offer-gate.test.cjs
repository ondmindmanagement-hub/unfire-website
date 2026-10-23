const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');const zlib=require('node:zlib');const crypto=require('node:crypto');
const base=path.resolve(__dirname,'../..');const dir=path.join(base,'audio/halloween');const read=p=>fs.readFileSync(path.join(base,p));
const status=JSON.parse(read('audio/halloween/promo-status.json').toString());
const gate=JSON.parse(read('.github/audio-commerce-release.json').toString());
const manifest=JSON.parse(read('audio/halloween/midi-manifest.json').toString());
const page=read('audio/halloween/index.html').toString();const store=read('audio/tienda/index.html').toString();
assert.equal(status.free_midi_gift.enabled,true);assert.equal(status.free_midi_gift.requires_purchase,false);assert.equal(gate.direct_web_checkout_authorized,false);
assert.equal(status.temporary_discount.enabled,false);assert.equal(status.temporary_discount.app_store_prices_verified,false);
assert.equal(status.archer_unique_buyer_code.enabled,false);assert.equal(status.archer_unique_buyer_code.valid_redeemable_codes_issued,0);
assert.equal(status.halloween_plugin_prize_wheel.enabled,false);assert.equal(status.halloween_plugin_prize_wheel.rules_published,false);
assert.equal(status.halloween_plugin_prize_wheel.approved_prize_skus.length,0);
assert.match(page,/href="unfire-halloween-midi-gratis-2026\.zip" download/);assert.match(store,/href="\.\.\/halloween\/"/);
assert.match(page,/esta página no ofrece actualmente descuentos del 60 %/i);
assert.match(page,/No hay pagos, compras ocultas, sorteos ni suscripciones/i);
assert(!/checkout\.stripe\.com|buy\.stripe\.com|payment_intent|SECRET_KEY/i.test(page));
assert.equal(manifest.total,4);assert.equal(Object.keys(manifest.files).length,4);
const zip=read('audio/halloween/unfire-halloween-midi-gratis-2026.zip');assert(zip.subarray(0,4).equals(Buffer.from([80,75,3,4])));assert(zip.length>600);
for(const [filename,metadata] of Object.entries(manifest.files)){
 const data=fs.readFileSync(path.join(dir,'midi',filename));
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),metadata.sha256);
 assert.equal(data.subarray(0,4).toString(),'MThd');assert.equal(data.readUInt16BE(8),0);assert.equal(data.readUInt16BE(10),1);assert.equal(data.readUInt16BE(12),480);
 assert.equal(metadata.bars,4);
}
assert(!/<script|onclick=|onerror=/i.test(page));
console.log('PASS: 4 free MIDI loops verified, real ZIP, no fake discount/code/wheel, checkout disabled');
