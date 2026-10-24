'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const mod=require('../audio/maletin/robot-customization.js');
const engine=fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../audio/maletin/index.html'),'utf8');

test('one-robot carousel, forward/back arrows and accessible count replace long list',()=>{
  assert.match(engine,/class="unfireRobotSelector"/);
  assert.match(engine,/data-step="-1"/);
  assert.match(engine,/data-step="1"/);
  assert.match(engine,/\(at\+step\+total\)%total/);
  assert.match(engine,/robotCount/);
  assert.doesNotMatch(engine,/\$o\('onT'\)\.innerHTML=ALLT\.map\(/);
  assert.match(mod.css,/min-height:162px/);
});
test('story and online retain the same workshop and selector entry',()=>{
  assert.match(engine,/open\(taller\)/);
  assert.match(engine,/ui\.classList\.toggle\('workshop',!!taller\)/);
  assert.match(engine,/window\.__applyRobotStyle/);
  assert.match(engine,/ROAMS\.myStyle/);
});
test('customization module loads before the engine in the iframe',()=>{
  const custom=html.indexOf('<script src="robot-customization.js?v=');
  const game=html.indexOf('<script src="game-engine-v50.js?v=');
  assert(custom>0&&game>custom);
  assert.equal(html.split('<script src="robot-customization.js?v=').length-1,1);
});
test('selected appearance is restored and saved in the existing local setting',()=>{
  assert.match(engine,/ROBOT_STYLE\.normalize\(cfg\)/);
  assert.match(engine,/localStorage\.setItem\('unfire_onl', JSON\.stringify\(cfg\)\)/);
  assert.match(engine,/portraitCache\.clear\(\);paint\(\);applyMe\(\);save\(\)/);
});
test('appearance and palette inputs are whitelisted, no scriptable image URI',()=>{
  const result=mod.normalize({col:'javascript:alert(1)',camo:'<svg>',decal:'boo',image:'data:text/html;base64,SGk='});
  assert.deepEqual(result,{col:'#3d8bff',camo:'plain',decal:'none',image:''});
  assert.equal(mod.CAMO.length,7);
  assert.equal(mod.DECALS.length,6);
});
test('online sends only bounded camo/decal identifiers, never local image data',()=>{
  assert.match(engine,/ca:cfg\.camo\|\|'plain'/);
  assert.match(engine,/de:cfg\.image\?'none':\(cfg\.decal\|\|'none'\)/);
  assert.match(engine,/ROBOT_STYLE\.normalize\(\{col:d\.c,camo:d\.ca/);
  assert.doesNotMatch(engine,/c\.send\(\{[^}]*cfg\.image/);
});
test('preset sticker and camo controls have clear selection state',()=>{
  const view=mod.panel({camo:'arctic',decal:'bolt'});
  assert.match(view,/data-camo="arctic" aria-pressed="true"/);
  assert.match(view,/data-decal="bolt" aria-pressed="true"/);
  assert.match(view,/id="onStickerFile"/);
  assert.match(view,/image\/png,image\/jpeg,image\/webp/);
  assert.match(view,/No se envía al modo online/);
});
test('metallic properties are retained or strengthened for PBR materials',()=>{
  const m={color:{lerp(){this.updated=true;}},metalness:.23,roughness:.87,map:null,transparent:false,
    clone(){return {...this,color:{...this.color,lerp:this.color.lerp}}}};
  const o={isMesh:true,material:m};
  const root={traverse(cb){cb(o);}};
  const THREE={Color:class{constructor(v){this.value=v;}}};
  mod.apply(root,{col:'#3d8bff',camo:'plain',decal:'none'},THREE);
  assert.equal(o.material.metalness,.72);
  assert.equal(o.material.roughness,.37);
  assert.equal(m.metalness,.23);
  assert.notEqual(o.material,m);
});
test('custom images have an explicit bounded local format',()=>{
  assert.equal(mod.normalize({image:'https://example.com/script.png'}).image,'');
  assert.equal(mod.normalize({image:'data:image/svg+xml;base64,AAA'}).image,'');
  assert.equal(mod.normalize({image:'data:image/webp;base64,QUJD'}).image,'data:image/webp;base64,QUJD');
});
test('responsive selector has touch-sized arrows, confined viewport, keyboard focus',()=>{
  assert.match(mod.css,/width:min\(442px,calc\(100vw - 20px\)\)/);
  assert.match(mod.css,/max-height:calc\(100dvh - 20px\)/);
  assert.match(mod.css,/touch-action:manipulation/);
  assert.match(mod.css,/:focus-visible/);
  assert.match(mod.css,/max-height:56dvh!important/);
});
