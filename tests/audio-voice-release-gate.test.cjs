'use strict';
// Hard release gate: the UI must never advertise recorded dialogue for absent MP3s.
// Current repo only ships ES/EN; extra locales require separate complete review.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'../audio/maletin');
const voice=path.join(root,'vox');
const manifest=JSON.parse(fs.readFileSync(path.join(voice,'manifest.json'),'utf8'));
const slots=JSON.parse(fs.readFileSync(path.join(voice,'slots.json'),'utf8'));
const allSlots=['a','b','c','d','e'];
const minKeys={es:1000,en:765};
let files=0;
for(const locale of Object.keys(minKeys)){
  const keys=manifest[locale];
  assert.ok(Array.isArray(keys),locale+' voice index missing');
  assert.ok(keys.length>=minKeys[locale],
    locale+' incomplete: '+keys.length+' indexed dialogue keys, needs '+minKeys[locale]+' or more (Claude 751 + seven new ES lines)');
  assert.equal(new Set(keys).size,keys.length,locale+' duplicate voice hashes');
  for(const key of keys){
    assert.match(key,/^[a-z0-9]{1,8}$/,locale+' invalid hash');
    for(const slot of allSlots){
      const filename=path.join(voice,locale,slot,key+'.mp3');
      assert.ok(fs.existsSync(filename),locale+'/'+slot+'/'+key+' MP3 absent');
      assert.ok(fs.statSync(filename).size>600,filename+' MP3 truncated/empty');
      files++;
    }
  }
}
// Keep the special Spanish slot inventory aligned with the actual full cast;
// the earlier 43-key index would silently suppress newly recorded dialogue.
assert.ok(slots.es && Array.isArray(slots.es.e),'Spanish voice E index missing');
const expected=new Set(manifest.es), indexed=new Set(slots.es.e);
for(const key of expected) assert.ok(indexed.has(key),'es/e slot inventory excludes '+key);
for(const key of indexed) assert.ok(fs.existsSync(path.join(voice,'es','e',key+'.mp3')),
  'es/e index points to absent voice '+key);
// Short companion lines (Demasiado ruido, Vale…, ¡Eso!, Perfecto.) must stay voiced.
for(const key of ['13w603n','1kfeff0','4oe2d7','5t4qca','i6td7p','xrlo41'])
  assert.ok(expected.has(key),'new cast dialogue excluded from Spanish manifest: '+key);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/unfire_lang/,'language choice not persisted');
assert.match(html,/__setLang/,'settings language selector missing');
console.log('PASS: '+files+' MP3 referenced by '+manifest.es.length+' ES / '+manifest.en.length+
  ' EN hashes, five cast slots and safe persistent language choice');
