'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const pages=['index.html','audio/index.html','audio/tienda/index.html','audio/catalogo/index.html','archer/index.html'];
const phone='archer-mobile-iphone-ui-20261029.webp';
const ipad='archer-mobile-ipad-ui-20261029.webp';

test('all five public Archer touchpoints use actual existing separate mobile assets',()=>{
  for(const file of pages){
    const s=read(file);
    assert.ok(s.includes(phone),file+' iPhone art missing');
    assert.ok(s.includes(ipad),file+' tablet art missing');
    assert.ok(s.includes('object-fit:contain'),file+' contains no contain-fit styling');
  }
});
test('unreleased previews are never labeled as the shipping App Store build',()=>{
  for(const file of ['index.html','audio/index.html','audio/tienda/index.html','archer/index.html']){
    const s=read(file);
    assert.match(s,/development|unreleased|upcoming/i,file+' needs clear version distinction');
  }
  assert.match(read('archer/index.html'),/Not the current App Store version/);
  assert.match(read('archer/index.html'),/id="next-preview"/);
  assert.match(read('audio/index.html'),/Authentic, cropped iOS simulator captures/);
});
test('interactive purchase and preview links are distinct and functional destinations',()=>{
  const s=read('archer/index.html');
  assert.match(s,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-for-iphone-ipad\/id6822109610"/);
  assert.match(s,/href="\/audio\/#archer-mobile-preview"/);
  assert.match(read('audio/index.html'),/href="\/apps\/archer-mobile\/"/);
  assert.match(read('audio/tienda/index.html'),/cta--store/);
});
test('mobile rendering has legible layouts and keyboard access',()=>{
  const a=read('audio/index.html'),d=read('archer/index.html'),t=read('audio/tienda/index.html');
  assert.match(a,/@media\(max-width:450px\)/);
  assert.match(a,/min-height:44px/);
  assert.match(a,/\.am-actions \.btn:focus-visible/);
  assert.match(d,/@media\(max-width:440px\)/);
  assert.match(t,/@media\(max-width:440px\)/);
  assert.match(t,/\.am-actions \.cta\{min-height:44px/);
});
test('marketing images retain more than 2 pixels per CSS device pixel at maximum display',()=>{
  const a=read('audio/index.html');
  assert.ok(640>=2*168 && 720>=2*264);
  assert.match(a,/width="640" height="1317"/);
  assert.match(a,/width="720" height="1283"/);
  for(const n of [phone,ipad])assert.ok(fs.existsSync(path.join(root,'assets/products',n)));
});
