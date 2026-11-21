"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"games/y2k-robots/index.html"),"utf8");
test("game site is honest and not indexable before game owner approves",()=>{
  assert.match(html,/<html lang="en">/);
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(html,/https:\/\/unfire\.technology\/games\/y2k-robots\//);
  assert.match(html,/planned public identity/i);
  assert.match(html,/UNFIRE Mutants branding/);
  assert.match(html,/No verified Steam purchase link/);
  assert.match(html,/Android-phone startup issue/);
  assert.ok(!/href="https:\/\/store\.steampowered\.com/.test(html));
  assert.ok(!/href="https:\/\/apps\.apple\.com/.test(html));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.match(html,/<a class="skip" href="#main">Skip to content<\/a>/);
});
test("authentic beta captures, no generated artwork or wrong-platform claims",()=>{
  const pics=[...html.matchAll(/<img\s+[^>]*src="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(pics.filter(x=>x.includes("/audio/press/captures/")).length,3);
  for(const img of pics){
    const f=path.resolve(root,"."+img);
    assert.ok(f===root||f.startsWith(root+path.sep),"unsafe image path");
    assert.ok(fs.existsSync(f),"missing beta asset "+img);
  }
  assert.match(html,/AUTHENTIC BROWSER BETA CAPTURE/);
  assert.match(html,/not screenshots of a released Steam build/);
  assert.match(html,/<meta property="og:image" content="https:\/\/unfire\.technology\/audio\/press\/captures\/09-night-flight-panorama\.jpg">/);
});
test("landing remains lightweight, accessible, separate from heavy WebGL",()=>{
  assert.ok(!/<script\s/i.test(html));
  assert.ok(!/<iframe\b/i.test(html));
  assert.ok(!/\b(canvas|getContext\(|WebGLRenderingContext|autoplay)\b/.test(html));
  assert.match(html,/<main id="main">/);
  assert.match(html,/<nav aria-label="Primary navigation">/);
  assert.match(html,/prefers-reduced-motion/);
  assert.match(html,/href="\/audio\/"/);
  assert.ok(!/google-analytics|gtag|facebook\.com\/tr/i.test(html));
});
