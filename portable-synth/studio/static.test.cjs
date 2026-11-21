"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=__dirname;
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html"),js=read("app.js"),css=read("style.css");
test("all required labels and controls are present without duplicate IDs",()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const name of ["tempo","swing","wave","volume","bass-note","bars","import"]){
    assert.ok(ids.includes(name),"Missing "+name);
    assert.ok(html.includes('for="'+name+'"'),"Missing label "+name);
  }
  for(const name of ["play","stop","demo","random","clear","save","wav","status","step-grid","transport-label"]){
    assert.ok(ids.includes(name),"Missing UI control "+name);
  }
  for(const n of [...js.matchAll(/\$\("([^"]+)"\)/g)].map(x=>x[1])){
    assert.ok(ids.includes(n),"Unknown UI ID "+n);
  }
});
test("CSP blocks app network calls and scripts are first-party",()=>{
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes("form-action 'none'"));
  assert.ok(html.includes('name="robots" content="noindex,nofollow"'));
  for(const file of ["./engine.js","./audio.js","./app.js"])assert.ok(html.includes('src="'+file+'"'));
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|getUserMedia)\s*\(/.test(js));
  assert.ok(!/\blocalStorage\b/.test(js));
  assert.ok(!/@import|fonts\.googleapis|https:\/\/.*\.js/.test(css));
});
test("step editor is labelled and keyboard reachable",()=>{
  assert.ok(html.includes('role="region"'));
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(js.includes('button.type="button"'));
  assert.ok(js.includes('button.setAttribute("aria-pressed"'));
  assert.ok(js.includes('button.setAttribute("aria-label"'));
});
test("all static interactive buttons explicitly have type button",()=>{
  const buttons=[...html.matchAll(/<button\b[^>]*>/gi)].map(x=>x[0]);
  assert.ok(buttons.length>=7);
  for(const button of buttons)assert.ok(/type="button"/.test(button),button);
});
