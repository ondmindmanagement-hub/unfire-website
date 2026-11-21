"use strict";
const { test }=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("games/y2k-robots/index.html","utf8");
test("Y2K landing is separate from live web beta and safely non-indexable pending launch",()=>{
 assert.match(html,/<html lang="en">/);
 assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
 assert.match(html,/https:\/\/unfire\.technology\/games\/y2k-robots\//);
 assert.match(html,/not a Steam listing/i);
 assert.match(html,/not actual gameplay footage/i);
 assert.match(html,/planned public identity for Unfire\x27s evolving robot-world project/i);
 assert.match(html,/No verified Steam purchase link/i);
 assert.ok(!/href="https:\/\/store\.steampowered\.com/.test(html));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/<a class="skip" href="#main">Skip to content<\/a>/);
});
test("Y2K landing does not load heavy WebGL, analytics, or external scripts",()=>{
 assert.ok(!/<script\s/i.test(html));
 assert.ok(!/<iframe\b/i.test(html));
 assert.ok(!/\b(canvas|getContext\(|WebGL|autoplay)\b/.test(html));
 assert.ok(!/google-analytics|gtag|facebook\.com\/tr/i.test(html));
});
