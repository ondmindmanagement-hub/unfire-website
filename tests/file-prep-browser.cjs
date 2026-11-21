"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8772";
async function testType(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:"reduce",acceptDownloads:true});
   try{
    const page=await ctx.newPage(),errors=[],external=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("request",r=>{if(!r.url().startsWith(BASE+"/"))external.push(r.url());});
    await page.route("**/*",route=>route.request().url().startsWith(BASE+"/")?route.continue():route.abort());
    const res=await page.goto(BASE+"/apps/file-prep/",{waitUntil:"networkidle",timeout:20000});
    assert.equal(res.status(),200);
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"),/noindex/);
    assert.equal(await page.locator("#copy").isDisabled(),true);
    const widthInfo=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,view:innerWidth}));
    assert.ok(widthInfo.doc<=widthInfo.view+2,name+" "+width+" overflow "+JSON.stringify(widthInfo));
    await page.locator("#source").fill("\uFEFFA\r\nB\rC  ");
    await page.locator("#run").click();
    assert.equal(await page.locator("#output").inputValue(),"A\nB\nC  ");
    await page.locator("#trailing").check();
    assert.equal(await page.locator("#download").isDisabled(),true);
    await page.locator("#run").click();
    assert.equal(await page.locator("#output").inputValue(),"A\nB\nC");
    await page.locator("#mode").selectOption("json");
    await page.locator("#source").fill("{this is invalid");
    await page.locator("#run").click();
    assert.equal(await page.locator("#copy").isDisabled(),true);
    assert.match(await page.locator("#status").innerText(),/Invalid JSON/i);
    await page.locator("#source").fill('{"one":[2,3]}');
    await page.locator("#run").click();
    assert.equal(JSON.parse(await page.locator("#output").inputValue()).one[0],2);
    await page.locator("#mode").selectOption("chunk");
    await page.locator("#chunk-size").fill("300");
    await page.locator("#overlap").fill("40");
    await page.locator("#source").fill("A large text sequence. ".repeat(42));
    await page.locator("#run").click();
    const output=await page.locator("#output").inputValue();
    assert.match(output,/CHUNK 1/);
    assert.match(output,/CHUNK 2/);
    const pending=page.waitForEvent("download",{timeout:16000});
    await page.locator("#download").click();
    const file=await pending;
    assert.match(file.suggestedFilename(),/-prepared\.txt$/);
    assert.equal(fs.readFileSync(await file.path(),"utf8"),output);
    await page.locator("#clear").click();
    assert.equal(await page.locator("#source").inputValue(),"");
    assert.equal(await page.locator("#copy").isDisabled(),true);
    await page.locator("#mode").selectOption("clean");
    await page.locator("#file").setInputFiles({name:"notes.md",mimeType:"text/markdown",buffer:Buffer.from("Hello\r\nworld","utf8")});
    await page.waitForFunction(()=>document.getElementById("source").value.includes("Hello"),null,{timeout:7000});
    await page.locator("#run").click();
    assert.equal(await page.locator("#output").inputValue(),"Hello\nworld");
    const dir=path.resolve("artifacts/file-prep");fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,name+"-"+width+".png"),fullPage:true,animations:"disabled"});
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
    console.log("PASS "+name+" "+width+" clean/JSON/chunks/import/export/no-network");
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
(async()=>{await testType(chromium,"chromium");await testType(webkit,"webkit");console.log("UNFIRE_FILE_PREP_WEB_QA_PASS");})().catch(e=>{console.error(e);process.exitCode=1;});