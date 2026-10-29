'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const [audio,catalog,store]=['audio/index.html','audio/catalogo/index.html','audio/tienda/index.html'].map(read);
const iphone='archer-mobile-iphone-ui-20261029.webp';
const ipad='archer-mobile-ipad-ui-20261029.webp';
const mac='archer-nocturne-app-preview-20261028.webp';
test('distinct mobile visuals are present on all three Unfire Audio pages',()=>{
  for(const [name,html] of [['main',audio],['catalog',catalog],['store',store]]){
    assert.match(html,new RegExp(iphone),name);
    assert.match(html,new RegExp(ipad),name);
    assert.match(html,new RegExp(mac),name+' must preserve Mac source');
  }
});
test('main audio listing is responsive, honest and directly links authentic mobile interface',()=>{
  assert.match(audio,/id="archer-mobile-preview"/);
  assert.match(audio,/class="am-device am-device--iphone"/);
  assert.match(audio,/class="am-device am-device--ipad"/);
  assert.match(audio,/@media\(max-width:450px\)/);
  assert.match(audio,/object-fit:contain/);
  assert.match(audio,/Not screenshots of the current App Store version/);
  assert.match(audio,/href="\/apps\/archer-mobile\/"/);
  assert.match(audio,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-for-iphone-ipad\/id6822109610"[^>]*>Current iPhone/);
  assert.match(audio,/data-archer>▶ Try on the web/);
});
test('catalog does not crop the mobile UI to landscape',()=>{
  assert.match(catalog,/card--archer-mobile \.im img\{[^}]+object-fit:contain/);
  assert.match(catalog,/'ARCHER for iPhone'|n:'ARCHER for iPhone'/);
  assert.match(catalog,/mobile:true/);
  assert.match(catalog,/unreleased preview/);
});
test('shop preserves official purchase routes and labels 1.0.3 as unreleased',()=>{
  assert.match(store,/class="archer-mobile-presentation"/);
  assert.match(store,/Currently|currently for sale/i);
  assert.match(store,/Unreleased 1\.0\.3 development screenshots/);
  assert.match(store,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-for-iphone-ipad\/id6822109610"/);
  assert.match(store,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-by-unfire\/id6812968924"/);
});
test('the actual visual assets are tiny and decode in WebP format',()=>{
  for(const name of [iphone,ipad]){
    const data=fs.readFileSync(path.join(root,'assets/products',name));
    assert(data.length>25000 && data.length<200000,name);
    assert.equal(data.subarray(0,4).toString(),'RIFF',name);
    assert.equal(data.subarray(8,12).toString(),'WEBP',name);
  }
});
