'use strict';const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'audio/visuales');
const j=JSON.parse(fs.readFileSync(path.join(dir,'assets-manifest.json'),'utf8'));
const page=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const catalog=fs.readFileSync(path.join(root,'audio/catalogo/index.html'),'utf8');
assert.equal(j.schema,1);assert.equal(j.products.length,20);assert.equal(j.customer_testimonials,false);assert.equal(j.license_ready_for_commercial_release,false);
assert.match(j.photo_usage,/No human photographs/);
assert.match(page,/<html lang="en">/);assert.match(page,/<meta name="viewport"/);assert.match(page,/DEVELOPMENT · NOT FOR SALE/);
assert.match(page,/personal photographs are excluded/);assert.match(catalog,/href="\.\.\/visuales\/"/);
const files=new Set(),names=new Set();let total=0;
for(const [i,p] of j.products.entries()){
 assert.equal(p.index,i+1);assert(!p.available_for_purchase);assert.match(p.release_status,/no aprobada/);
 assert(!names.has(p.name));names.add(p.name);
 for(const key of ['icon','ui']){
  const a=p.assets[key];assert(a.path.startsWith('real-ui/'));assert(!files.has(a.path));files.add(a.path);
  assert(!/\.\.|[\\]/.test(a.path));const bytes=fs.readFileSync(path.join(dir,a.path));
  assert(bytes.length>2000 && bytes.length<300000,'optimized bounded asset');total+=bytes.length;
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);
  assert(/^[0-9a-f]{64}$/.test(a.origin_sha256));assert(a.source.startsWith('UnfireTwenty/UnfireSingles/Marketing/'));
  assert(!/Cover-|Commons-|Face-|Portrait-|Creator-Workflow/i.test(a.source));
  assert.equal(a.capture_type,key==='ui'?'native-NSHostingView-development-capture':'brand-symbol-no-text');
 }
}
assert.equal(files.size,40);assert(total<3_000_000);
console.log('PASS genuine Unfire Twenty Y2K gallery: 20 protos, 40 hashed assets, no photos/fake customers, no checkout');
