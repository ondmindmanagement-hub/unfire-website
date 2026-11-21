"use strict";
// Product microsites visual / interactive smoke on clean GitHub runner browsers.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium, webkit } = require("playwright");
const BASE = "http://127.0.0.1:8765";
const ROUTES = [
  { path: "/portable-synth/", label: "android-direct" },
  { path: "/portable-synth/play/", label: "synth-browser" }
];
const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
  { label: "small", width: 320, height: 700 }
];
const target = path.resolve("artifacts/product-microsites");
fs.mkdirSync(target, { recursive: true });
async function check(browserType, name) {
  const browser = await browserType.launch({headless:true});
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: {width:viewport.width,height:viewport.height},
        reducedMotion:"reduce", colorScheme:"dark", deviceScaleFactor:1
      });
      try {
        for (const item of ROUTES) {
          const page = await context.newPage();
          const errors = [];
          const failed = [];
          page.on("pageerror", error => errors.push(error.message));
          page.on("requestfailed", request => failed.push(request.url() + ": " + request.failure()));
          // Pages load strictly first-party static resources (no third-party tracking).
          await page.route("**/*", route => route.request().url().startsWith(BASE+"/") ? route.continue() : route.abort());
          const response = await page.goto(BASE + item.path, {waitUntil:"networkidle", timeout:20000});
          assert.equal(response.status(), 200, name+" "+item.path+" HTTP");
          const h1 = page.locator("h1");
          assert.equal(await h1.count(),1,"one H1");
          assert.equal(await h1.isVisible(),true, "visible H1");
          assert.equal(await page.locator('a.skip').count(),1,"keyboard skip link");
          const dimensions = await page.evaluate(() => ({
            docWidth:document.documentElement.scrollWidth,
            viewportWidth:window.innerWidth,
            missingImages:[...document.images].filter(img => !img.complete || img.naturalWidth===0).map(img => img.getAttribute("src"))
          }));
          assert.equal(dimensions.missingImages.length,0,name+"/"+item.path+" images: "+dimensions.missingImages.join(","));
          assert.ok(dimensions.docWidth <= dimensions.viewportWidth+2,
            name+" "+viewport.label+" "+item.path+" horizontal overflow "+JSON.stringify(dimensions));
          assert.deepEqual(errors,[],name+" "+viewport.label+" "+item.path+" runtime errors");
          assert.deepEqual(failed,[],name+" "+viewport.label+" "+item.path+" failed assets");
          const screenshot=path.join(target,name+"-"+viewport.label+"-"+item.label+".png");
          await page.screenshot({path:screenshot,fullPage:true,animations:"disabled"});
          process.stdout.write("PASS "+name+" "+viewport.label+" "+item.path+" captured\n");
          await page.close();
        }
      } finally { await context.close(); }
    }
    // Synthetic audio graph test: proves pointer lifecycle without requiring real speakers.
    const context=await browser.newContext({viewport:{width:1100,height:800}});
    try {
      await context.addInitScript(() => {
        class Param {
          setValueAtTime(){} exponentialRampToValueAtTime(){}
          setTargetAtTime(){} cancelScheduledValues(){}
        }
        class Node {
          constructor(){this.gain=new Param();this.frequency=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();}
          connect(){} disconnect(){} start(){} stop(){}
        }
        class FakeAudioContext {
          constructor(){this.currentTime=0;this.state="running";this.destination=new Node();}
          createGain(){return new Node();}
          createDynamicsCompressor(){return new Node();}
          createOscillator(){return new Node();}
          resume(){return Promise.resolve();}
        }
        window.AudioContext=FakeAudioContext;
        window.webkitAudioContext=undefined;
      });
      const page=await context.newPage();
      await page.goto(BASE+"/portable-synth/play/",{waitUntil:"load"});
      const key=page.locator('.key[data-semitone="0"]');
      await key.dispatchEvent("pointerdown",{pointerId:1,pointerType:"mouse",isPrimary:true});
      await page.waitForFunction(() => document.querySelector('.key[data-semitone="0"]').classList.contains("is-down"));
      await key.dispatchEvent("pointerup",{pointerId:1,pointerType:"mouse",isPrimary:true});
      await page.waitForFunction(() => !document.querySelector('.key[data-semitone="0"]').classList.contains("is-down"));
      assert.ok((await page.locator("#status").innerText()).includes("Audio enabled"));
      await page.close();
    } finally { await context.close(); }
  } finally { await browser.close(); }
}
(async()=>{
  for(const [browser,name] of [[chromium,"chromium"],[webkit,"webkit"]]){
    await check(browser,name);
  }
  console.log("All browser microsite QA completed");
})().catch(err=>{console.error(err);process.exitCode=1;});