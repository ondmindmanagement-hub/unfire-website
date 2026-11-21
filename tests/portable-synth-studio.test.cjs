"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const home=read("portable-synth/index.html");
const key=read("portable-synth/play/index.html");
const studio=read("portable-synth/studio/index.html");
const model=read("portable-synth/studio/engine.js");
const audio=read("portable-synth/studio/audio.js");
const app=read("portable-synth/studio/app.js");

test("published Android Direct URL and SHA-256 still appear unchanged",()=>{
  assert.match(home,/releases\/download\/portable-synth-daw-android-direct-v1\.0\.5\/Portable-Synth-Daw-Direct-v1\.0\.5\.apk/);
  assert.ok(home.includes("b09bb213af294ceca6f6f5d18df97b86930a81a02c9f2f4772b7b017a2f555ec"),"Official hash missing");
  assert.ok(home.includes('href="/portable-synth/play/"'),"Existing browser keyboard link disappeared");
  assert.ok(home.includes("Two independent editions."),"Android distribution warning removed");
});
test("both browser routes are linked with clear modes",()=>{
  assert.ok(key.includes('href="/portable-synth/studio/"'),"Keyboard mode cannot reach sequencer");
  assert.ok(studio.includes('href="/portable-synth/play/"'),"Sequencer cannot reach keyboard mode");
  assert.ok(key.includes("Keyboard mode"));
  assert.ok(studio.includes('aria-current="page"'));
  assert.ok(studio.includes('href="https://unfire.technology/portable-synth/studio/"'),"Canonical URL missing");
  assert.ok(studio.includes('name="robots" content="noindex,nofollow"'),"Experimental page must remain noindex");
});
test("studio assets are relative, private and deployed with same origin",()=>{
  for(const asset of ["./engine.js","./audio.js","./app.js","./style.css"])
    assert.ok(studio.includes(asset),"Missing studio asset "+asset);
  for(const src of [model,audio,app]){
    assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\s*\(|\bWebSocket\s*\(|\bnavigator\.sendBeacon\s*\(/.test(src),"Unexpected network code");
    assert.ok(!/\blocalStorage\b|\bsessionStorage\b/.test(src),"Unexpected client persistence");
  }
  assert.ok(studio.includes("connect-src 'none'"));
  assert.ok(!studio.includes("https://fonts.googleapis.com"));
});
test("studio semantic controls remain labelled",()=>{
  const ids=[...studio.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,"Duplicate DOM ids");
  for(const id of ["tempo","wave","swing","volume","bass-note","bars","import"])
    assert.ok(studio.includes('for="'+id+'"'),"Missing field label "+id);
  for(const id of ["play","stop","wav","save","clear","random","demo","step-grid","status"])
    assert.ok(ids.includes(id),"Missing control "+id);
  assert.ok(studio.includes('aria-live="polite"'));
  assert.ok(studio.includes('tabindex="0"'));
});
test("studio and product do not claim a complete native DAW port",()=>{
  assert.ok(/not the full Android DAW/i.test(studio));
  const visibleText=key.replace(/<[^>]*>/g," ").replace(/\\s+/g," ");
  assert.ok(/not the full Portable Synth Daw Android application/i.test(visibleText));
});
