'use strict';
// Per-app sites redesigned 2026-11-22: real captures, store links, legal links, no stale claims.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sites={
  'apps/pocket-capture/index.html':'id6823107299',
  'apps/power/index.html':'id6815880143',
  'archer/index.html':'id6812968924',
  'bolt/index.html':'id6814615903'
};
test('each app site links its real App Store listing and the legal pages',()=>{
  for(const [p,id] of Object.entries(sites)){
    const h=read(p);
    assert.match(h,new RegExp('apps\\.apple\\.com/[^"]*'+id),p);
    for(const l of ['/privacy.html','/terms.html','/software-license.html','/refunds.html'])assert.ok(h.includes(l),p+' '+l);
    assert.match(h,/<link rel="canonical"/,p);
    assert.match(h,/application\/ld\+json/,p);
    assert.equal((h.match(/<h1[\s>]/g)||[]).length,1,p+': one h1');
  }
  assert.match(read('archer/index.html'),/id6822109610/);
});
test('every referenced product image exists and is light',()=>{
  for(const p of Object.keys(sites)){
    for(const m of read(p).matchAll(/\/assets\/products\/apps-2026\/([a-z0-9-]+\.webp)/g)){
      const f=path.join(root,'assets/products/apps-2026',m[1]);
      assert.ok(fs.existsSync(f),m[1]);
      assert.ok(fs.statSync(f).size<200_000,m[1]);
    }
  }
});
test('no unreleased previews or expired offers are advertised',()=>{
  const a=read('archer/index.html');
  assert.doesNotMatch(a,/archer-nocturne-app-preview/);
  assert.doesNotMatch(a,/October 13–26|Limited-time/);
  assert.match(read('bolt/index.html'),/interface is in Spanish/);
});
test('sites keep distinct visual identities',()=>{
  const fonts=Object.keys(sites).map(p=>(read(p).match(/fonts\.googleapis\.com\/css2\?family=([A-Za-z+]+)/)||[])[1]);
  assert.equal(new Set(fonts).size,fonts.length,fonts.join(','));
});
