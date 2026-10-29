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
  if(device==='ipad') { assert.deepEqual(p.web_size,[920,1270]); assert.match(p.crop,/residual Spanish iPadOS status strip/); }
 }
 assert.notDeepEqual(fs.readFileSync(path.join(root,'audio/img/synth-iphone.webp')),fs.readFileSync(path.join(root,'audio/img/synth-ipad.webp')));
});
test('3D engine references existing synth texture filenames without logic edits',()=>{
 const engine=read('audio/maletin/game-engine-v50.js');
 assert.match(engine,/device\('pad', 'synth-ipad.webp'/);assert.match(engine,/device\('phone', 'synth-iphone.webp'/);
});

test('Synth I public media credits are accessible from both product previews',()=>{
 const home=read('index.html'),audio=read('audio/index.html'),media=read('audio/media-credits.html');
 assert.match(home,/href="\/audio\/media-credits\.html#synth-i-footage"/);
 assert.match(audio,/href="media-credits\.html#synth-i-footage"/);
 assert.match(media,/id="synth-i-footage"/);
 assert.equal((media.match(/class="synth-footage-source"/g)||[]).length,16);
 for(const author of ['François Nguyen','Julian Boed'])assert.ok(media.includes(author));
 for(const original of ['Glowing_neon_and_argon_in_a_microwave_oven.webm','Night_view_of_Chicago.webm'])
  assert.ok(media.includes(original));
 assert.match(media,/creativecommons\.org\/licenses\/by\/2\.0/);
});

test('Public Audio footer keeps English-only company label',()=>{
 const audio=read('audio/index.html');
 assert.match(audio,/UNFIRE AUDIO is part of/);
 assert.doesNotMatch(audio,/UNFIRE AUDIO es parte de/);
});
