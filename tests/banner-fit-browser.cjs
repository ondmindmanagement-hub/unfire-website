"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8768";

async function testBrowser(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [320,390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:840},acceptDownloads:true,reducedMotion:"reduce"});
   try{
    const page=await ctx.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",route=>route.request().url().startsWith(BASE+"/")?route.continue():route.abort());
    const response=await page.goto(BASE+"/apps/banner-fit/",{waitUntil:"load",timeout:20000});
    assert.equal(response.status(),200);
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"),/noindex/);
    assert.equal(await page.locator("#download").isDisabled(),true);
    const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(overflow.document<=overflow.width+2,name+" "+width+" overflow "+JSON.stringify(overflow));
    const data=await page.evaluate(()=>{
      const c=document.createElement("canvas");c.width=120;c.height=80;
      const g=c.getContext("2d");g.fillStyle="#185dcc";g.fillRect(0,0,120,80);
      g.fillStyle="#d2efff";g.fillRect(20,20,40,40);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.locator("#file").setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:Buffer.from(data,"base64")});
    await page.waitForFunction(()=>document.getElementById("file-meta").textContent.includes("120 × 80"),null,{timeout:8000});
    await page.locator("#preset").selectOption("custom");
    await page.locator("#width").fill("320");
    await page.locator("#height").fill("180");
    await page.locator("#focus-x").evaluate(el=>{el.value="70";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.waitForFunction(()=>document.getElementById("canvas").width===320 && document.getElementById("canvas").height===180);
    assert.equal(await page.locator("#download").isEnabled(),true);
    const pendingPng=page.waitForEvent("download",{timeout:18000});
    await page.locator("#download").click();const png=await pendingPng;
    assert.match(png.suggestedFilename(),/320x180\.png$/);
    const pngBytes=fs.readFileSync(await png.path());
    assert.equal(pngBytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(pngBytes.readUInt32BE(16),320);
    assert.equal(pngBytes.readUInt32BE(20),180);
    await page.locator("#format").selectOption("jpg");
    const pendingJpg=page.waitForEvent("download",{timeout:18000});
    await page.locator("#download").click();const jpg=await pendingJpg;
    assert.match(jpg.suggestedFilename(),/320x180\.jpg$/);
    const jpgBytes=fs.readFileSync(await jpg.path());
    assert.equal(jpgBytes.subarray(0,2).toString("hex"),"ffd8");
    const out=path.resolve("artifacts/banner-fit");fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,name+"-"+width+".png"),fullPage:true,animations:"disabled"});
    assert.deepEqual(errors,[],name+" console errors");
    console.log("PASS "+name+" "+width+" no-overflow + PNG/JPEG exports");
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
(async()=>{await testBrowser(chromium,"chromium");await testBrowser(webkit,"webkit");console.log("BANNER_FIT_BROWSER_QA_PASS");})().catch(e=>{console.error(e);process.exitCode=1;});