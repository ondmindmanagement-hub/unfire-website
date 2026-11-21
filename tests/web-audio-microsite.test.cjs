"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root,file),"utf8");
const urls = [
 ["portable-synth/index.html","https://unfire.technology/portable-synth/"],
 ["portable-synth/play/index.html","https://unfire.technology/portable-synth/play/"]
];
test("preserve verified Android Direct download, distinct from browser prototype",()=>{
 const direct=read("portable-synth/index.html");
 const play=read("portable-synth/play/index.html");
 assert.match(direct,/Portable-Synth-Daw-Direct-v1\.0\.5\.apk/);
 assert.match(direct,/SHA-256 of the exact APK/);
 assert.match(direct,/technology\.unfire\.synth\.direct/);
 assert.match(direct,/href="\/portable-synth\/play\/"/);
 assert.match(play,/<strong>not<\/strong> the full Portable Synth Daw Android application/);
 assert.match(play,/full Portable Synth Daw Android Direct edition/i);
 assert.match(play,/Google Play access is a separate closed-testing channel/);
 assert.ok(!/https:\/\/store\.steampowered\.com/.test(play));
});
test("no duplicate canonical and all new local static assets are present",()=>{
 const seen=new Set();
 for(const [p,u] of urls){
  const s=read(p);
  assert.match(s,/<html lang="en">/);
  assert.equal((s.match(/<h1\b/g)||[]).length,1);
  assert.match(s,/<meta name="description"/);
  assert.ok(s.includes('href="'+u+'"'));
  assert.ok(!seen.has(u));seen.add(u);
  for(const match of s.matchAll(/(?:href|src)="([^"]+)"/g)){
   const link=match[1];
   if(!link.startsWith("/")||link.startsWith("//"))continue;
   const base=path.resolve(root,"."+link.split(/[?#]/)[0]);
   assert.ok(base===root||base.startsWith(root+path.sep),"no traversal: "+link);
   assert.ok(fs.existsSync(base)&&fs.statSync(base).isFile()||fs.existsSync(path.join(base,"index.html")),p+" references missing asset "+link);
  }
 }
});
test("browser sound graph stays fully client-side",()=>{
 const js=read("portable-synth/play/synth.js"),html=read("portable-synth/play/index.html");
 assert.match(js,/createOscillator\(\)/);
 assert.match(js,/pending\.delete\(source\)/);
 assert.match(js,/pointercancel/);
 assert.equal((html.match(/data-semitone="\d+"/g)||[]).length,12);
 assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|localStorage)\b/.test(js));
});
test("catalogue and search discovery link to verified product routes",()=>{
 const apps=read("apps/index.html");
 const sitemap=read("sitemap.xml");
 const listed=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.equal(listed.length,new Set(listed).size);
 for(const [,url] of urls)assert.ok(listed.includes(url),url+" sitemap");
 assert.ok(listed.includes("https://unfire.technology/portable-synth/beta/"));
 assert.ok(listed.includes("https://unfire.technology/audio/tienda/"));
 for(const url of ["/portable-synth/","/portable-synth/play/","/portable-synth/beta/"])assert.ok(apps.includes('href="'+url+'"'),url+" apps link");
});
