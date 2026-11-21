import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createMissionServer } from "./mission-service.mjs";

const require=createRequire(import.meta.url);
if(!process.env.UNFIRE_PUPPETEER_MODULE || !process.env.UNFIRE_CHROME_EXECUTABLE)
  throw new Error("Specify existing Puppeteer module and Chrome executable paths");
const puppeteer=require(process.env.UNFIRE_PUPPETEER_MODULE);
const temp=await mkdtemp(join(tmpdir(),"unfire-console-browser-"));
let service,browser;
try {
  service=await createMissionServer({directory:join(temp,"workspace"),port:0});
  browser=await puppeteer.launch({
    headless:true,executablePath:process.env.UNFIRE_CHROME_EXECUTABLE,
    userDataDir:join(temp,"browser-profile"),args:["--no-first-run","--disable-extensions"],
    timeout:20000
  });
  const records=[];
  for (const [label,width,height] of [["desktop",1440,900],["mobile",390,844],["compact",320,740]]) {
    const page=await browser.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.setViewport({width,height});
    await page.goto(service.url,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>document.getElementById("connection")?.textContent.includes("Connected"),{timeout:10000});
    const before=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      hash:location.hash,stored:sessionStorage.getItem("unfire-os-local-session")?.length??0,
      connected:document.getElementById("connection").textContent,
      count:Number(document.getElementById("event-count").textContent)
    }));
    assert.equal(before.overflow,false);
    assert.equal(before.hash,"");
    assert.equal(before.stored,64);
    if(label==="desktop") {
      for(const [button,count] of [["create",1],["claim",2],["complete",3],["release",4],["stop",5]]) {
        await page.click("#"+button);
        await page.waitForFunction(value=>Number(document.getElementById("event-count").textContent)===value,
          {timeout:10000},count);
      }
      await page.reload({waitUntil:"domcontentloaded"});
      await page.waitForFunction(()=>document.getElementById("connection")?.textContent.includes("Connected"),{timeout:10000}).catch(async e=>{
        console.log("RELOAD_DIAGNOSTICS",JSON.stringify(await page.evaluate(()=>({
          status:document.getElementById("connection")?.textContent,
          feedback:document.getElementById("feedback")?.textContent,
          stored:sessionStorage.getItem("unfire-os-local-session")?.length??0,
          hash:location.hash
        }))));
        throw e;
      });
      assert.equal(await page.$eval("#mission-state",el=>el.textContent),"Stopped");
      assert.equal(await page.$eval("#claim",el=>el.disabled),true);
    } else {
      assert.equal(before.count,5);
      assert.equal(await page.$eval("#mission-state",el=>el.textContent),"Stopped");
    }
    assert.deepEqual(errors,[]);
    records.push({label,width,height,overflow:false,events:5,jsErrors:0});
    await page.close();
  }
  console.log("MISSION_CONSOLE_BROWSER_QA_PASS",JSON.stringify(records));
} finally {
  await browser?.close().catch(()=>{});
  await service?.close().catch(()=>{});
  await rm(temp,{recursive:true,force:true});
}
