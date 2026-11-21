"use strict";
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const assert=require("node:assert/strict");
const base="http://127.0.0.1:8891",route="/apps/gods-lamp/";
const sizes=[{name:"desktop",width:1440,height:900},{name:"iphone",width:390,height:844},{name:"small-phone",width:320,height:700}];
const out=path.resolve("artifacts/gods-lamp");fs.mkdirSync(out,{recursive:true});
async function verify(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const size of sizes){
   const ctx=await browser.newContext({viewport:{width:size.width,height:size.height},colorScheme:"dark",reducedMotion:"reduce",deviceScaleFactor:1});
   const page=await ctx.newPage(),failed=[],errors=[];
   page.on("requestfailed",r=>failed.push(r.url()));
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/*",r=>r.request().url().startsWith(base+"/")?r.continue():r.abort());
   const resp=await page.goto(base+route,{waitUntil:"networkidle",timeout:16000});
   assert.equal(resp.status(),200);
   assert.equal(await page.locator("h1").count(),1);
   assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1);
   assert.equal(await page.locator(".reference-card img").count(),2,"two actual owner-supplied screenshots");
   await page.evaluate(()=>document.querySelectorAll("img[loading='lazy']").forEach(img=>{img.loading="eager";}));
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0),null,{timeout:12000});
   const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,inner:innerWidth,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
   assert.ok(dims.w<=dims.inner+2, name+"/"+size.name+" overflow "+JSON.stringify(dims));
   assert.deepEqual(dims.images,[]);
   assert.deepEqual(errors,[]);
   assert.deepEqual(failed,[]);
   await page.locator("#original-interface").scrollIntoViewIfNeeded();
   await page.waitForTimeout(150);
   await page.screenshot({path:path.join(out,name+"-"+size.name+"-originals.png"),animations:"disabled"});
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.waitForTimeout(150);
   await page.screenshot({path:path.join(out,name+"-"+size.name+".png"),fullPage:true,animations:"disabled"});
   console.log("PASS "+name+" "+size.name);
   await ctx.close();
  }
 } finally{await browser.close()}
}
(async()=>{await verify(chromium,"chromium");await verify(webkit,"webkit")})().catch(e=>{console.error(e);process.exitCode=1});
