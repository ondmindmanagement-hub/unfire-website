"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8766";
async function exercise(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:870},acceptDownloads:true,reducedMotion:"reduce"});
   try{
    const page=await ctx.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",r=>r.request().url().startsWith(BASE+"/")?r.continue():r.abort());
    const response=await page.goto(BASE+"/apps/ai-token-counter/",{waitUntil:"networkidle",timeout:20000});
    assert.equal(response.status(),200);
    assert.equal(await page.locator("h1").count(),1);
    assert.equal(await page.locator("#combined-tokens").innerText(),"0");
    assert.equal(await page.locator("#per-call-cost").innerText(),"Add both rates");
    const shape=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(shape.doc<=shape.viewport+2,name+" overflow "+JSON.stringify(shape));
    const secret="PRIVATE_SOURCE_DO_NOT_EXPORT_2026";
    await page.locator("#input-text").fill(secret);
    await page.locator("#output-text").fill("Hello world!");
    await page.locator("#exact-input").fill("1000");
    await page.locator("#exact-output").fill("500");
    await page.locator("#input-rate").fill("2");
    await page.locator("#output-rate").fill("8");
    await page.locator("#calls").fill("1000");
    await page.waitForFunction(()=>document.getElementById("monthly-cost").textContent==="$6.00",null,{timeout:7000});
    assert.equal(await page.locator("#per-call-cost").innerText(),"$0.006000");
    const downloading=page.waitForEvent("download");
    await page.locator("#download-report").click();
    const file=await downloading;
    const csv=fs.readFileSync(await file.path(),"utf8");
    assert.ok(csv.includes('"Input token count","1000"'));
    assert.ok(csv.includes("Estimated monthly cost"));
    assert.ok(!csv.includes(secret),"Sensitive source text leaked into exported CSV");
    await page.locator("#calls").fill("0");
    await page.waitForFunction(()=>document.getElementById("download-report").disabled,null,{timeout:7000});
    assert.equal(await page.locator("#per-call-cost").innerText(),"Check settings");
    await page.locator("#reset").click();
    assert.equal(await page.locator("#input-text").inputValue(),"");
    assert.equal(await page.locator("#output-text").inputValue(),"");
    assert.equal(await page.locator("#input-rate").inputValue(),"");
    assert.equal(await page.locator("#combined-tokens").innerText(),"0");
    assert.deepEqual(errors,[],name+" runtime exceptions");
    process.stdout.write("PASS "+name+" "+width+" token math, invalid guard, privacy export/reset, layout\n");
    await page.close();
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
(async()=>{
 for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]])await exercise(type,name);
 console.log("UNFIRE_TOKEN_BROWSER_QA_PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
