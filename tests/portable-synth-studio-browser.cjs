"use strict";
// Chrome and WebKit end-to-end release smoke for the existing keyboard + new studio.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const BASE="http://127.0.0.1:8765";
const dest=path.resolve("artifacts/product-microsites");
fs.mkdirSync(dest,{recursive:true});
const VIEWPORTS=[
  {name:"desktop",width:1440,height:900},
  {name:"mobile",width:390,height:844},
  {name:"small",width:320,height:700}
];
async function visualSmoke(browser,name){
  for(const view of VIEWPORTS){
    const context=await browser.newContext({
      viewport:{width:view.width,height:view.height},
      reducedMotion:"reduce",colorScheme:"dark",deviceScaleFactor:1
    });
    try{
      for(const route of ["play","studio"]){
        const page=await context.newPage();
        const runtime=[],failed=[];
        page.on("pageerror",err=>runtime.push(err.message));
        page.on("requestfailed",req=>failed.push(req.url()+" "+req.failure()));
        await page.route("**/*",r=>r.request().url().startsWith(BASE+"/")?r.continue():r.abort());
        const response=await page.goto(BASE+"/portable-synth/"+route+"/",{waitUntil:"networkidle",timeout:20000});
        assert.equal(response.status(),200,name+" "+route+" HTTP");
        assert.equal(await page.locator("h1").count(),1,name+" "+route+" H1");
        const layout=await page.evaluate(()=>({
          scroll:document.documentElement.scrollWidth,
          viewport:window.innerWidth,
          keyboard:document.querySelector(".keyboard")?.scrollWidth||null,
          keyboardFrame:document.querySelector(".keyboard")?.clientWidth||null,
          sequencer:document.querySelector(".grid-wrap")?.scrollWidth||null,
          sequencerFrame:document.querySelector(".grid-wrap")?.clientWidth||null
        }));
        assert.ok(layout.scroll<=layout.viewport+2,
          name+" "+view.name+" "+route+" horizontal overflow "+JSON.stringify(layout));
        if(route==="studio"){
          assert.equal(await page.locator("#step-grid .step").count(),64);
          if(view.width===320)assert.ok(layout.sequencer>layout.sequencerFrame,"Studio grid must scroll independently");
          assert.ok(await page.locator('a[href="/portable-synth/play/"]').count()>=1);
          assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"),"noindex,nofollow");
        }else{
          assert.equal(await page.locator(".key[data-semitone]").count(),12);
          assert.ok(await page.locator('a[href="/portable-synth/studio/"]').count()>=1);
        }
        assert.deepEqual(runtime,[],name+"/"+route+" script exceptions");
        assert.deepEqual(failed,[],name+"/"+route+" resource failures");
        await page.screenshot({
          path:path.join(dest,name+"-"+view.name+"-portable-synth-"+route+".png"),
          fullPage:true,animations:"disabled"
        });
        process.stdout.write("PASS "+name+" "+view.name+" "+route+" layout + screenshot\n");
        await page.close();
      }
    }finally{await context.close();}
  }
}
async function interactiveSmoke(browser,name){
  const context=await browser.newContext({viewport:{width:1160,height:900},acceptDownloads:true});
  try{
    const page=await context.newPage();
    const runtime=[];
    page.on("pageerror",err=>runtime.push(err.message));
    await page.goto(BASE+"/portable-synth/studio/",{waitUntil:"networkidle"});
    const kick=page.locator('.step[data-track="kick"][data-step="0"]');
    assert.equal(await kick.getAttribute("aria-pressed"),"true");
    await kick.click();
    assert.equal(await kick.getAttribute("aria-pressed"),"false");
    await page.locator("#bass-note").selectOption("55");
    const bass=page.locator('.step[data-track="bass"][data-step="1"]');
    await bass.click();
    assert.equal(await bass.getAttribute("aria-pressed"),"true");
    await page.locator("#tempo").fill("124");
    await page.locator("#tempo").dispatchEvent("change");
    assert.ok((await page.locator("#transport-label").innerText()).includes("124 BPM"));
    process.stdout.write("PASS "+name+" studio button/timing edits\n");
    await page.locator("#play").click();
    await page.waitForFunction(()=>document.getElementById("transport-label").textContent.includes("PLAYING"),null,{timeout:7000});
    await page.locator("#stop").click();
    await page.waitForFunction(()=>!document.getElementById("play").disabled,null,{timeout:5000});
    process.stdout.write("PASS "+name+" live Web Audio transport\n");
    const jsonEvent=page.waitForEvent("download");
    await page.locator("#save").click();
    const jsonDownload=await jsonEvent;
    const saved=JSON.parse(fs.readFileSync(await jsonDownload.path(),"utf8"));
    assert.equal(saved.bpm,124);
    assert.equal(saved.tracks.kick[0],false);
    assert.equal(saved.tracks.bass[1],55);
    await page.locator("#clear").click();
    assert.equal(await page.locator('.step[aria-pressed="true"]').count(),0);
    await page.locator("#import").setInputFiles({
      name:"pattern.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(saved))
    });
    await page.waitForFunction(()=>document.getElementById("status").textContent.includes("Pattern loaded"));
    assert.ok(await page.locator('.step[aria-pressed="true"]').count()>10);
    process.stdout.write("PASS "+name+" real JSON download + import\n");
    const waveEvent=page.waitForEvent("download",{timeout:20000});
    await page.locator("#wav").click();
    const wavDownload=await waveEvent;
    const wav=fs.readFileSync(await wavDownload.path());
    assert.equal(wav.toString("ascii",0,4),"RIFF");
    assert.equal(wav.toString("ascii",8,12),"WAVE");
    assert.equal(wav.readUInt16LE(22),2);
    assert.equal(wav.readUInt32LE(24),44100);
    assert.equal(wav.readUInt16LE(34),16);
    assert.ok(wav.byteLength>100000);
    let peak=0;for(let i=44;i<Math.min(wav.length,44+44100*4);i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));
    assert.ok(peak>300,"Exported WAV must contain audible signal");
    process.stdout.write("PASS "+name+" non-silent stereo WAV (peak="+peak+")\n");
    assert.deepEqual(runtime,[],name+" studio runtime exceptions");
  }finally{await context.close();}
}
(async()=>{
  for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]]){
    const browser=await type.launch({headless:true});
    try{await visualSmoke(browser,name);await interactiveSmoke(browser,name);}
    finally{await browser.close();}
  }
  console.log("PORTABLE_SYNTH_STUDIO_BROWSER_QA_PASS");
})().catch(err=>{console.error(err);process.exitCode=1;});
