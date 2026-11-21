"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const E=require("../apps/power-web/engine.js");
const BASE="http://127.0.0.1:8768";
const OUT=path.resolve("artifacts/power-web");
fs.mkdirSync(OUT,{recursive:true});
const DATE="2026-11-21";
const prices=Array(24).fill(.20);
prices[2]=prices[3]=.05;prices[5]=prices[6]=.40;
function fixture(date=DATE){
 const slots=E.daySlots(date);
 return {data:{attributes:{"last-update":"2026-11-21T20:20:00+01:00"}},included:[
  {id:"600",attributes:{values:Array(96).fill({value:4,datetime:slots[0].utc})}},
  {id:"1001",attributes:{values:slots.map((s,i)=>({datetime:s.utc,value:100+i}))}}
 ]};
}
async function check(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [320,390,768,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,reducedMotion:"reduce"});
   try{
    const page=await ctx.newPage(),errors=[],requests=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("request",q=>requests.push(q.url()));
    await page.route("**/*",route=>route.request().url().startsWith(BASE+"/")?route.continue():route.abort());
    const response=await page.goto(BASE+"/apps/power-web/",{waitUntil:"networkidle",timeout:20000});
    assert.equal(response.status(),200);
    assert.equal(await page.locator("h1").count(),1);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex,nofollow");
    assert.equal(await page.locator("#export").isDisabled(),true);
    assert.ok((await page.locator("#state").innerText()).includes("No prices loaded"));
    await page.locator("#day").fill(DATE);
    await page.locator("#day").dispatchEvent("change");
    assert.equal(await page.locator("#official-api").getAttribute("href"),E.officialURL(DATE));
    await page.locator("#sample").click();
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("SYNTHETIC EXAMPLE"));
    assert.equal(await page.locator("#hour-list .hour").count(),24);
    assert.match(await page.locator("#source-label").innerText(),/SYNTHETIC DEMO/);
    // Screenshot only the explicitly fictional example, not a fake official dataset.
    const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:window.innerWidth}));
    assert.ok(size.scroll<=size.view+2,"Page overflow "+name+"/"+width+" "+JSON.stringify(size));
    await page.screenshot({path:path.join(OUT,name+"-"+width+"-power-web.png"),fullPage:true,animations:"disabled"});
    await page.locator("#manual").fill(prices.map(x=>x.toFixed(4)).join("\n"));
    await page.locator("#load-manual").click();
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("User-entered hourly prices"));
    await page.locator("#power").fill("2");
    await page.locator("#duration").selectOption("2");
    await page.locator("#fixed").fill("0.18");
    await page.waitForFunction(()=>document.getElementById("best-price").textContent.includes("0.400"));
    assert.match(await page.locator("#worst-price").innerText(),/1\.600/);
    assert.match(await page.locator("#savings-price").innerText(),/1\.400/);
    assert.match(await page.locator("#fixed-cost").innerText(),/0\.720/);
    assert.equal(await page.locator("#hour-list .hour.best").count(),2);
    const downloading=page.waitForEvent("download",{timeout:10000});
    await page.locator("#export").click();
    const f=await downloading;
    const csv=fs.readFileSync(await f.path(),"utf8");
    assert.equal(csv.split("\r\n").filter(Boolean).length,25);
    assert.match(csv,/Manual hourly values/);
    const fImport=fixture();
    await page.locator("#import-json").setInputFiles({name:"prices.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fImport))});
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("PVPC indicator 1001 loaded"));
    assert.match(await page.locator("#source-label").innerText(),/Red Eléctrica/);
    assert.equal(await page.locator("#hour-list .hour").count(),24);
    await page.locator("#import-json").setInputFiles({name:"spot.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({included:[fImport.included[0]]}))});
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("1001 is missing"));
    assert.equal(await page.locator("#export").isDisabled(),true);
    await page.locator("#day").fill("2026-10-25");
    await page.locator("#day").dispatchEvent("change");
    await page.locator("#sample").click();
    assert.equal(await page.locator("#hour-list .hour").count(),25);
    assert.equal(await page.locator("#hour-list .hour-date").filter({hasText:"02:00"}).count(),2);
    await page.locator("#day").fill("2026-03-29");
    await page.locator("#day").dispatchEvent("change");
    await page.locator("#sample").click();
    assert.equal(await page.locator("#hour-list .hour").count(),23);
    assert.deepEqual(errors,[],name+"/"+width+" runtime errors");
    assert.ok(requests.every(u=>u.startsWith(BASE+"/")),"External requests observed: "+requests.filter(u=>!u.startsWith(BASE+"/")).join(","));
    process.stdout.write("PASS "+name+" "+width+" import/manual/DST/CSV/private/layout\n");
    await page.close();
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
(async()=>{
 for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]])await check(type,name);
 console.log("UNFIRE_POWER_WEB_BROWSER_QA_PASS");
})().catch(err=>{console.error(err);process.exitCode=1;});