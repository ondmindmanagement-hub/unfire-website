const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Synth I real separate device previews appear in corporate gallery and Audio',()=>{
 const home=read('index.html'),audio=read('audio/index.html'),catalog=read('audio/catalogo/index.html');
 for(const p of ['unfire-synth-iphone.webp','unfire-synth-ipad.webp'])assert.match(home,new RegExp(p.replace('.','\.')));
 for(const p of ['synth-iphone.webp','synth-ipad.webp']){assert.match(audio,new RegExp(p.replace('.','\.')));assert.match(catalog,new RegExp(p.replace('.','\.')));}
 assert.match(home,/uf-gallery-card--synth1/);assert.match(home,/uf-synth-devices/);
 assert.match(audio,/Development preview · not yet released/);assert.match(catalog,/card--synth-mobile/);
 assert.match(home,/not the approved App Store release/);assert.doesNotMatch(audio,/Synthesizer en iPhone|Synthesizer en iPad/);
});
test('WebP outputs are real, distinct and metadata hashes match',()=>{
 const prov=JSON.parse(read('assets/products/source-provenance.json')).images;
 for(const device of ['iphone','ipad']){
  const rootAsset=path.join(root,'assets/products/unfire-synth-'+device+'.webp');
  const audioAsset=path.join(root,'audio/img/synth-'+device+'.webp');
  const a=fs.readFileSync(rootAsset),b=fs.readFileSync(audioAsset);
  assert.ok(a.length>15000);assert.deepEqual(a,b,'same genuine asset on corporate and Audio pages');
  assert.equal(a.toString('ascii',0,4),'RIFF');assert.equal(a.toString('ascii',8,12),'WEBP');
  const p=prov.find(x=>x.app_visual==='unfire-synth-'+device);
  assert.ok(p);assert.equal(p.bytes,a.length);assert.equal(p.sha256,crypto.createHash('sha256').update(a).digest('hex'));
  assert.match(p.release_status,/Development\/QA/);
 }
 assert.notDeepEqual(fs.readFileSync(path.join(root,'audio/img/synth-iphone.webp')),fs.readFileSync(path.join(root,'audio/img/synth-ipad.webp')));
});
test('3D engine references existing synth texture filenames without logic edits',()=>{
 const engine=read('audio/maletin/game-engine-v50.js');
 assert.match(engine,/device\('pad', 'synth-ipad.webp'/);assert.match(engine,/device\('phone', 'synth-iphone.webp'/);
});
