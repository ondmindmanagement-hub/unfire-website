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
 assert.match(html,/does not establish review approval, release, availability or feature parity/);
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

test("owner-supplied original screenshots are real immutable source crops, not product release renders",()=>{
 const crypto=require("node:crypto");
 const media=[
  {name:"original-song-reference.png",digest:"bd308c54e76d475c54081d7222c54dffa472c021b3c6064ab22ab10bdfd99e6f"},
  {name:"original-step-reference.png",digest:"0e2d4f0f8f5ddf62fe117fea5823e0a4a0961a6e26d00d8f6c07fbd93499c5b7"}
 ];
 for(const img of media){
  const p="/apps/gods-lamp/media/"+img.name;
  assert.ok(html.includes('src="'+p+'"'),p+" gallery");
  const bytes=fs.readFileSync(path.join(root,p));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),img.digest,img.name+" provenance");
  assert.ok(bytes.length>100000&&bytes.length<600000);
 }
 assert.match(html,/Only the phone status bar was removed/);
 assert.match(html,/not.*verified screenshots of the shipping iOS/i);
 assert.match(html,/Not an App Store screenshot/);
 assert.match(html,/RC73 source-port effort/);
 assert.match(html,/noindex,nofollow/);
});

test("neither test-track status nor uploaded IPA is described as a public release",()=>{
 assert.match(html,/active Google Play closed-testing track/);
 assert.match(html,/Production access and public availability are not confirmed/);
 assert.match(html,/successfully uploaded to Apple's processing service/);
 assert.match(html,/An uploaded IPA does not mean approval/);
 assert.match(html,/21 November 2026/);
});
