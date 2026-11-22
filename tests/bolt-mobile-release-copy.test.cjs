"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),test=require("node:test");
const html=fs.readFileSync(path.resolve(__dirname,"../apps/bolt-mobile/index.html"),"utf8");
test("BOLT Mobile public landing doesn't claim review when ASC status is pending publication",()=>{
 assert.match(html,/iOS version awaiting publication/i);
 assert.match(html,/actual download availability/i);
 assert.doesNotMatch(html,/under App Store review|review in progress/i);
 assert.match(html,/<main\b/);
 assert.match(html,/<h1>BOLT Mobile<\/h1>/);
});
