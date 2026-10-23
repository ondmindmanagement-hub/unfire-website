'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const audio=fs.readFileSync(path.join(root,'audio','index.html'),'utf8');
const match=home.match(/<script id="unfire-home-game-router">([\s\S]*?)<\/script>/);
assert.ok(match,'the homepage has an early game router');
assert.ok(home.indexOf(match[0])<home.indexOf('<meta charset='),'redirect happens before the heavy homepage loads');

function visit(pathAndQuery) {
  const url=new URL(pathAndQuery,'https://unfire.technology');
  const visits=[];
  const location={
    pathname:url.pathname,search:url.search,hash:url.hash,origin:url.origin,
    replace(destination){visits.push(destination);}
  };
  vm.runInNewContext(match[1],{location,URL,URLSearchParams},{timeout:150});
  return visits;
}

test('entry point opens the game once, without an extra history item',()=>{
  assert.deepEqual(visit('/'),['/audio/']);
  assert.deepEqual(visit('/#play'),['/audio/']);
  assert.deepEqual(visit('/#jugar'),['/audio/']);
});

test('intentional corporate links and sections stay on the website',()=>{
  for(const url of ['/?site=1','/?site=1#apps','/#apps','/#work','/index.html','/contact/']){
    assert.deepEqual(visit(url),[],url);
  }
});

test('redirect forwards only ordinary campaign parameters',()=>{
  assert.deepEqual(visit('/?utm_source=reel&utm_campaign=launch'),['/audio/?utm_source=reel&utm_campaign=launch']);
  assert.deepEqual(visit('/?site=0&secret=not-forwarded'),['/audio/']);
});

test('products, corporate escape route and replay remain accessible',()=>{
  assert.match(home,/<a class="unfire-audio-entry" href="\/audio\/" aria-label="Volver a jugar a Unfire Audio">/);
  assert.match(audio,/class="byu" href="\/\?site=1#apps"/);
  assert.match(audio,/<a href="\/\?site=1#apps">Unfire<\/a>/);
  assert.match(audio,/id="unfireReturnPlay"/);
  assert.match(audio,/getElementById\('unfireReturnPlay'\)\.addEventListener\('click',resumeGame\)/);
  assert.match(audio,/getElementById\('instrumentos'\)/);
  assert.match(audio,/scrollIntoView\(/);
});
