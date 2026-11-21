"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8765";
const ROUTES=["/portable-synth/studio/","/apps/ai-token-counter/","/apps/archer-web/"];
const screenDir=path.resolve("artifacts/product-microsites");
fs.mkdirSync(screenDir,{recursive:true});
async function run(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const context=await browser.newContext({viewport:{width,height:850},reducedMotion:"reduce"});
   try{
    const page=await context.newPage(),runtime=[];
    page.on("pageerror",e=>runtime.push(e.message));
    const res=await page.goto(BASE+"/apps/",{waitUntil:"networkidle",timeout:18000});
    assert.equal(res.status(),200);
    await page.waitForFunction(()=>document.querySelector("#catalog-count").textContent.startsWith("Showing"),null,{timeout:7000});
    const cards=page.locator(".family .card");
    const total=await cards.count();
    assert.ok(total>=11,"New browser tools must not replace other app cards");
    assert.equal(await cards.filter({visible:true}).count(),total);
    for(const url of ROUTES){
      assert.ok(await page.locator('a[href="'+url+'"]').count()>=1,"Missing link "+url);
      // Fail-closed release gate: never advertise a browser tool that is absent from the web origin.
      const destination=await page.request.get(BASE+url,{timeout:10000});
      assert.equal(destination.status(),200,"Browser product link is broken: "+url);
    }
    await page.locator('button[data-filter-kind="topic"][data-filter-value="audio"]').click();
    assert.ok((await page.locator("#catalog-count").innerText()).includes("Showing"));
    await page.locator('button[data-filter-kind="topic"][data-filter-value="capture"]').click();
    await page.locator('button[data-filter-kind="device"][data-filter-value="mac"]').click();
    assert.ok((await page.locator("#catalog-count").innerText()).includes("No matching apps"));
    await page.locator(".subnav a[href='#audio']").click();
    await page.waitForFunction(()=>document.querySelector("#catalog-count").textContent.includes("Showing"));
    const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
    assert.ok(sizes.scroll<=sizes.view+2,"Catalogue page horizontal overflow "+JSON.stringify(sizes));
    assert.deepEqual(runtime,[],name+" browser errors");
    await page.screenshot({path:path.join(screenDir,name+"-"+width+"-browser-apps-catalog.png"),fullPage:true,animations:"disabled"});
    process.stdout.write("PASS "+name+" "+width+" catalog filters, web links and responsive layout\n");
    await page.close();
   }finally{await context.close();}
  }
 }finally{await browser.close();}
}
(async()=>{for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]])await run(type,name);
 console.log("UNFIRE_WEB_APPS_CATALOG_BROWSER_QA_PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
