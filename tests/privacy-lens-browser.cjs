"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8770";
const fixture="Contact: hello@example.com. Call +34 612 345 678. DNI 12345678Z. IBAN ES9121000418450200051332. IP 192.168.1.5.";
async function run(type,name){
  const browser=await type.launch({headless:true});
  try{
    for(const width of [320,390,1440]){
      const context=await browser.newContext({viewport:{width,height:850},acceptDownloads:true,reducedMotion:"reduce"});
      try{
        const page=await context.newPage(),errors=[],external=[];
        page.on("pageerror",e=>errors.push(e.message));
        page.on("request",req=>{if(!req.url().startsWith(BASE+"/"))external.push(req.url());});
        await page.route("**/*",route=>route.request().url().startsWith(BASE+"/")?route.continue():route.abort());
        const resp=await page.goto(BASE+"/apps/privacy-lens/",{waitUntil:"networkidle",timeout:18000});
        assert.equal(resp.status(),200);
        assert.match(await page.locator('meta[name="robots"]').getAttribute("content"),/noindex/);
        assert.equal(await page.locator("#copy").isDisabled(),true);
        assert.equal(await page.locator("#download").isDisabled(),true);
        assert.equal(await page.locator('input[name="pattern-type"]:checked').count(),6);
        const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
        assert.ok(overflow.scroll<=overflow.view+2,name+"/"+width+" overflow "+JSON.stringify(overflow));
        await page.locator("#input").fill(fixture+" <script>window.HACKED=true</script>");
        await page.locator("#analyze").click();
        assert.equal(await page.locator("#total").innerText(),"5");
        const result=await page.locator("#output").inputValue();
        for(const v of ["hello@example.com","+34 612 345 678","12345678Z","ES9121000418450200051332","192.168.1.5"]) assert.equal(result.includes(v),false);
        assert.match(result,/\[EMAIL REDACTED\]/);
        assert.match(result,/\[IBAN REDACTED\]/);
        assert.match(result,/<script>window.HACKED=true<\/script>/);
        assert.equal(await page.evaluate(()=>window.HACKED===true),false);
        const wait=page.waitForEvent("download",{timeout:15000});
        await page.locator("#download").click();
        const download=await wait;
        assert.match(download.suggestedFilename(),/-redacted\.txt$/);
        const saved=fs.readFileSync(await download.path(),"utf8");
        assert.equal(saved,result);
        await page.locator('input[value="phone"]').uncheck();
        assert.equal(await page.locator("#download").isDisabled(),true);
        await page.locator("#analyze").click();
        assert.match(await page.locator("#output").inputValue(),/\+34 612 345 678/);
        await page.locator("#clear").click();
        assert.equal(await page.locator("#input").inputValue(),"");
        assert.equal(await page.locator("#output").inputValue(),"");
        assert.equal(await page.locator("#copy").isDisabled(),true);
        await page.locator("#file").setInputFiles({name:"example.txt",mimeType:"text/plain",buffer:Buffer.from(fixture,"utf8")});
        await page.waitForFunction(()=>document.getElementById("input").value.includes("hello@example.com"),null,{timeout:7000});
        await page.locator("#analyze").click();
        assert.match(await page.locator("#output").inputValue(),/\[EMAIL REDACTED\]/);
        await page.locator("#input").fill("ordinary memo with no selected patterns");
        await page.locator("#analyze").click();
        assert.equal(await page.locator("#total").innerText(),"0");
        assert.equal(await page.locator("#copy").isDisabled(),true);
        const dir=path.resolve("artifacts/privacy-lens");fs.mkdirSync(dir,{recursive:true});
        await page.screenshot({path:path.join(dir,name+"-"+width+".png"),fullPage:true,animations:"disabled"});
        assert.deepEqual(errors,[],name+" "+width+" page errors");
        assert.deepEqual(external,[],name+" "+width+" external requests");
        console.log("PASS "+name+" "+width+" safe redaction, text import, explicit export, no overflow");
      }finally{await context.close();}
    }
  }finally{await browser.close();}
}
(async()=>{await run(chromium,"chromium");await run(webkit,"webkit");console.log("UNFIRE_PRIVACY_LENS_BROWSER_QA_PASS");})().catch(e=>{console.error(e);process.exitCode=1;});