"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const URL="http://127.0.0.1:8784/apps/app-ready/";
const AXE=require.resolve("axe-core/axe.min.js");
async function scenario(engine,name,width){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,reducedMotion:"reduce",locale:"en-US"});
 await context.addInitScript({path:AXE});
 const page=await context.newPage();
 const external=[],errors=[];
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:8784/"))external.push(r.url());});
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",r=>r.request().url().startsWith("http://127.0.0.1:8784/")?r.continue():r.abort());
 try{
  const response=await page.goto(URL,{waitUntil:"networkidle",timeout:24000});
  assert.equal(response.status(),200,name+" "+width+" failed route");
  assert.match(await page.title(),/App Ready Web Lab/);
  assert.match(await page.locator('meta[name="robots"]').getAttribute("content"),/noindex/);
  assert.match(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content"),/connect-src 'none'/);
  assert.equal(await page.locator("#done").innerText(),"0");
  assert.ok(Number(await page.locator("#pending").innerText())>=18);
  assert.equal(await page.locator("#answer-screens-macos").count(),1);
  const viewport=await page.evaluate(()=>({outer:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(viewport.doc<=viewport.outer+2,JSON.stringify(viewport));
  assert.ok(viewport.body<=viewport.outer+2,JSON.stringify(viewport));
  assert.equal(await page.locator("h1").count(),1);
  await page.locator("#app-name").fill("Demo Release");
  await page.locator("#answer-release-build").selectOption("checked");
  await page.locator("#answer-review-access").selectOption("na");
  assert.equal(await page.locator("#done").innerText(),"1");
  assert.equal(await page.locator("#na").innerText(),"1");
  await page.locator("#filter").selectOption("checked");
  assert.equal(await page.locator('.item:not([hidden])').count(),1);
  await page.locator("#filter").selectOption("all");
  const downloadPromise=page.waitForEvent("download",{timeout:12000});
  await page.locator("#export").click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),"unfire-app-ready-Demo-Release.json");
  const saved=fs.readFileSync(await download.path(),"utf8");
  const report=JSON.parse(saved);
  assert.equal(report.app_name,"Demo Release");
  assert.equal(report.platform,"macos");
  assert.equal(report.checks["release-build"],"checked");
  assert.equal(report.checks["review-access"],"na");
  assert.match(report.warning,/no automated Apple validation/);
  await page.locator("#platform").selectOption("ios");
  assert.equal(await page.locator("#answer-screens-ios").count(),1);
  assert.equal(await page.locator("#answer-screens-macos").count(),0);
  assert.equal(await page.locator("#done").innerText(),"0");
  await page.locator("#import").setInputFiles({name:"review.json",mimeType:"application/json",buffer:Buffer.from(saved)});
  await page.waitForFunction(()=>document.getElementById("done").textContent==="1",{timeout:7000});
  assert.equal(await page.locator("#platform").inputValue(),"macos");
  assert.equal(await page.locator("#app-name").inputValue(),"Demo Release");
  assert.equal(await page.locator("#answer-review-access").inputValue(),"na");
  await page.locator("#filter").selectOption("pending");
  assert.ok((await page.locator(".item:not([hidden])").count())>=14);
  await page.locator("#filter").selectOption("all");
  page.once("dialog",d=>d.accept());
  await page.locator("#reset").click();
  assert.equal(await page.locator("#done").innerText(),"0");
  assert.equal(await page.locator("#app-name").inputValue(),"");
  const audit=await page.evaluate(async()=>{
   const result=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}});
   return {serious:result.violations.filter(x=>["serious","critical"].includes(x.impact)).map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passed:result.passes.length,incomplete:result.incomplete.length};
  });
  assert.deepEqual(audit.serious,[],name+" "+width+" axe violations "+JSON.stringify(audit.serious));
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  const dir=path.resolve("artifacts/app-ready");fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,name+"-"+width+".png"),fullPage:true,animations:"disabled"});
  console.log("PASS",name,width,"axe",audit.passed,"incomplete",audit.incomplete,"local-import-export-no-network");
 }finally{await context.close();await browser.close();}
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
  for(const width of [390,768,1440])await scenario(engine,name,width);
 console.log("APP_READY_WEB_LAB_BROWSER_QA_PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
