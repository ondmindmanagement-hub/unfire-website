"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"apps/gods-lamp/index.html"),"utf8");
test("God's Lamp is an audio application, not a released game",()=>{
 assert.match(html,/<title>God's Lamp/);
 assert.match(html,/Music creation/);
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/Release information pending/);
 assert.match(html,/not a product screenshot/);
 assert.ok(!/store\.steampowered|store\.google\.com|apps\.apple\.com/.test(html));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
});
test("platform disclosures linked and remain clearly separate",()=>{
 for(const p of ["/privacy/gods-lamp/","/privacy/gods-lamp-ios/"]){
  assert.match(html,new RegExp('href="'+p.replace(/\//g,"\\/")+'"'));
  assert.ok(fs.existsSync(path.join(root,p,"index.html")),p);
 }
 assert.match(html,/does not claim approval, availability or feature parity/);
 assert.match(html,/Android privacy notice/);
 assert.match(html,/iOS notice/);
});
test("zero-cost lightweight, structurally balanced and accessible",()=>{
 const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];assert.ok(css);
 let balance=0;for(const c of css){if(c==="{")balance++;if(c==="}")balance--;assert.ok(balance>=0)}assert.equal(balance,0);
 assert.match(html,/<a class="skip" href="#main">Skip to content<\/a>/);
 assert.match(html,/prefers-reduced-motion/);
 assert.ok(!/<script\b|<iframe\b|<canvas\b/.test(html));
 assert.ok(!/google-analytics|tracker|gtag\(/i.test(html));
});
