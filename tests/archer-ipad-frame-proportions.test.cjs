'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const pages=[
  ['Corporate gallery','index.html',/\.uf-archer-device--ipad\{[^}]*aspect-ratio:1280\/894;[^}]*height:auto/],
  ['Unfire Audio','audio/index.html',/\.am-device--ipad\{[^}]*aspect-ratio:1280\/894;[^}]*height:auto/],
  ['Unfire Audio Store','audio/tienda/index.html',/\.am-frame--ipad\{[^}]*aspect-ratio:1280\/894;[^}]*height:auto/],
  ['Unfire Audio Catalog','audio/catalogo/index.html',/\.card--archer-ipad \.im img\{[^}]*aspect-ratio:1280\/894/]
];
test('all ARCHER website iPad previews use true tablet frames',()=>{
  for(const [label,file,css] of pages){
    const html=read(file);
    assert.match(html,css,label);
    assert.match(html,/archer-mobile-ipad-landscape-20261122\.webp/,label);
    assert.match(html,/object-fit:contain/,label);
  }
});
test('iPhone framing remains independently proportioned',()=>{
  for(const file of ['index.html','audio/index.html','audio/tienda/index.html']){
    const html=read(file);
    assert.match(html,/aspect-ratio:640\/1317/,file);
    assert.match(html,/archer-mobile-iphone-ui-20261029\.webp/,file);
  }
});
test('tablet crop is not asserted to be an App Store native screenshot',()=>{
  assert.match(read('audio/tienda/index.html'),/not a final tablet screenshot/i);
  assert.match(read('audio/catalogo/index.html'),/mobile:'ipad'/);
});
