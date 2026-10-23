const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../../audio/index.html'),'utf8');
test('buy only through official App Store product URLs',()=>{
  assert.match(html,/href="https:\/\/apps\.apple\.com\/us\/app\/archer-by-unfire\/id6812968924"[^>]*>Comprar para Mac/);
  assert.match(html,/href="https:\/\/apps\.apple\.com\/es\/app\/archer-for-iphone-ipad\/id6822109610"[^>]*>iPhone \/ iPad/);
});
test('the web game stays free and unverified web checkout stays off',()=>{
  assert.match(html,/const READY_FOR_SALE=new Set\(\[\]\)/);
  assert.match(html,/const PAY=\{fx20:'',hyper:'',synth:'',todo:'',clubM:'',clubY:''\}/);
  assert.match(html,/data-archer>▶ Probar en la web/);
});

test('unreleased cart offers only true third-party purchase alternatives',()=>{
  const bag=html.match(/<p id="bagUnreleased"[\s\S]*?<\/p>/)?.[0]||'';
  assert.match(bag,/ARCHER para Mac/);
  assert.match(bag,/ARCHER para iPhone o iPad/);
  assert.match(bag,/consulta por correo no supone compra/);
});
