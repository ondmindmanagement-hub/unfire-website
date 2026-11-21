"use strict";
const fs=require("node:fs"), path=require("node:path");
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const base="http://127.0.0.1:8870", pageRoute="/games/y2k-robots/";
const sizes=[
 {name:"desktop",width:1440,height:900},
 {name:"iphone",width:390,height:844},
 {name:"small-phone",width:320,height:700},
 {name:"tablet",width:820,height:1180}
];
const dest=path.resolve("artifacts/y2k-landing");fs.mkdirSync(dest,{recursive:true});
async function run(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const size of sizes){
   const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,reducedMotion:"reduce",colorScheme:"dark"});
   const page=await context.newPage();const errors=[],failed=[],requests=[];
   page.on("pageerror",x=>errors.push(x.message));
   page.on("requestfailed",x=>failed.push(x.url()));
   page.on("request",x=>requests.push(x.url()));
   await page.route("**/*",route=>route.request().url().startsWith(base+"/")?route.continue():route.abort());
   const response=await page.goto(base+pageRoute,{waitUntil:"networkidle",timeout:20000});
   assert.equal(response.status(),200,"html response");
   assert.equal(await page.locator("h1").count(),1);
   assert.equal(await page.locator("h1").isVisible(),true);
   assert.equal(await page.locator("main").count(),1);
   assert.equal(await page.locator('a[href="/audio/"]').count(),1);
   assert.equal(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count(),1);
   // Load intentionally lazy images before asserting decode success; WebKit does not request them until they enter view.
   await page.evaluate(()=>{document.querySelectorAll('img[loading="lazy"]').forEach(img=>{img.loading="eager"});});
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete && img.naturalWidth>0),null,{timeout:12000});
   const dims=await page.evaluate(()=>({
     doc:document.documentElement.scrollWidth,
     view:window.innerWidth,
     broken:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)
   }));
   assert.ok(dims.doc <= dims.view+2, name+" "+size.name+" overflow "+JSON.stringify(dims));
   assert.deepEqual(dims.broken,[],name+" "+size.name+" missing picture");
   assert.deepEqual(errors,[],name+" "+size.name+" runtime");
   assert.deepEqual(failed,[],name+" "+size.name+" asset loading");
   assert.ok(!requests.some(x=>/\/(?:maletin|game-engine|peerjs|tracker|analytics)\//i.test(x)), "Unexpected game engine or tracker load");
   await page.screenshot({path:path.join(dest,name+"-"+size.name+".png"),fullPage:true,animations:"disabled"});
   console.log("PASS "+name+" "+size.name+" screenshots and no WebGL auto-load");
   await context.close();
  }
 } finally{await browser.close()}
}
(async()=>{await run(chromium,"chromium");await run(webkit,"webkit")})().catch(e=>{console.error(e);process.exitCode=1});
