"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8767";
function toneWav(){
 const rate=44100,frames=44100,bytes=frames*2,out=Buffer.alloc(44+bytes);
 out.write("RIFF",0);out.writeUInt32LE(36+bytes,4);out.write("WAVE",8);
 out.write("fmt ",12);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);
 out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);
 out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
 out.write("data",36);out.writeUInt32LE(bytes,40);
 for(let i=0;i<frames;i++)out.writeInt16LE(Math.round(8500*Math.sin(2*Math.PI*440*i/rate)),44+i*2);
 return out;
}
const fixture=toneWav();
async function exercise(type,name){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:870},acceptDownloads:true,reducedMotion:"reduce"});
   try{
    const page=await ctx.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",route=>route.request().url().startsWith(BASE+"/")?route.continue():route.abort());
    const r=await page.goto(BASE+"/apps/archer-web/",{waitUntil:"networkidle",timeout:20000});
    assert.equal(r.status(),200);
    assert.equal(await page.locator("h1").count(),1);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex,nofollow");
    assert.equal(await page.locator("#play").isDisabled(),true);
    const sizes=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,view:innerWidth}));
    assert.ok(sizes.doc<=sizes.view+2,name+"/"+width+" layout overflow "+JSON.stringify(sizes));
    await page.locator("#audio-file").setInputFiles({name:"test-tone.wav",mimeType:"audio/wav",buffer:fixture});
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("Audio ready"),null,{timeout:8000});
    assert.equal(await page.locator("#play").isEnabled(),true);
    await page.locator("#gain").evaluate(el=>{el.value="6";el.dispatchEvent(new Event("input",{bubbles:true}));});
    assert.equal(await page.locator("#gain-out").innerText(),"+6 dB");
    // The fixture lasts one second: bring the transport into view first so the Stop click needs no scroll while the preview plays.
    await page.locator("#stop").scrollIntoViewIfNeeded();
    await page.locator("#play").click();
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("Preview playing"),null,{timeout:7000});
    await page.locator("#stop").click();
    await page.waitForFunction(()=>document.getElementById("state").textContent.includes("Playback stopped"),null,{timeout:5000});
    const downloadWait=page.waitForEvent("download",{timeout:18000});
    await page.locator("#export").click();
    const download=await downloadWait;
    const bytes=fs.readFileSync(await download.path());
    assert.equal(bytes.toString("ascii",0,4),"RIFF");
    assert.equal(bytes.toString("ascii",8,12),"WAVE");
    assert.equal(bytes.readUInt16LE(22),1);
    assert.equal(bytes.readUInt32LE(24),44100);
    assert.equal(bytes.readUInt16LE(34),16);
    assert.equal(bytes.readUInt32LE(40),88200);
    let peak=0;for(let i=44;i<Math.min(bytes.length,44+44100*2);i+=2)peak=Math.max(peak,Math.abs(bytes.readInt16LE(i)));
    assert.ok(peak>1000,"WAV export must contain sound");
    const captures=path.resolve("artifacts/archer-web");
    fs.mkdirSync(captures,{recursive:true});
    await page.screenshot({path:path.join(captures,name+"-"+width+"-archer-web.png"),fullPage:true,animations:"disabled"});
    assert.deepEqual(errors,[],name+" runtime errors");
    process.stdout.write("PASS "+name+" "+width+" import/preview/stop/processed WAV, peak="+peak+"\n");
    await page.close();
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
(async()=>{for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]])await exercise(type,name);
 console.log("UNFIRE_ARCHER_WEB_BROWSER_QA_PASS");
})().catch(e=>{console.error(e);process.exitCode=1;});
