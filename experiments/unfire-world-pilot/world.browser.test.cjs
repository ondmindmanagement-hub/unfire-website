"use strict";
const assert = require("node:assert/strict");
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");
const baseUrl = (process.env.UNFIRE_WORLD_TEST_URL || "http://127.0.0.1:48763").replace(/\/$/, "");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || undefined,
    headless: true,
    args: ["--no-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--disable-gpu-sandbox"]
  });
  try {
    let pass = 0;
    for(const [width,height] of [[1280,800],[844,390],[390,844],[320,568],[280,653]]) {
      const page = await browser.newPage();
      await page.setViewport({width,height,deviceScaleFactor:width < 500 ? 2 : 1});
      const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.evaluateOnNewDocument(() => {
        window.__worldDrawCalls = 0;
        const draw = WebGLRenderingContext.prototype.drawElements;
        WebGLRenderingContext.prototype.drawElements = function(...args) {
          window.__worldDrawCalls++;
          return draw.apply(this,args);
        };
      });
      const response = await page.goto(baseUrl + "/experiments/unfire-world-pilot/", {waitUntil:"networkidle0",timeout:20000});
      await page.waitForFunction(() => document.querySelector("#scene-mode").textContent==="WEBGL ACTIVO", {timeout:10000});
      const result = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        draws: window.__worldDrawCalls,
        error: document.querySelector("canvas").getContext("webgl").getError()
      }));
      // Chrome may validate a cached localhost document with HTTP 304.\n      assert.ok([200,304].includes(response.status()), "Unexpected HTML response: "+response.status());
      assert.ok(result.width <= result.client + 1, JSON.stringify(result));
      assert.ok(result.draws >= 1, "No real WebGL draw");
      assert.equal(result.error,0);
      await page.$eval("#morph-slider", el => {
        el.value = "80";
        el.dispatchEvent(new Event("input", {bubbles:true}));
      });
      assert.equal(await page.$eval("#morph-output", el => el.textContent), "80 %");
      await page.click("#morph-button");
      // WebGL software rendering may throttle RAF; assert eventual correctness,
      // not an exact animation duration on an emulated GPU.
      await page.waitForFunction(() => document.querySelector("#morph-output").textContent === "0 %", {timeout:5000});
      // Inspect the image as rendered by the browser: cached image requests may
      // receive HTTP 304 rather than a second HTTP 200.
      const preview = await page.evaluate(async () => {
        const img = document.querySelector(".store-image-link img");
        img.loading = "eager";
        try { await img.decode(); } catch (_) {}
        return {width:img.naturalWidth, height:img.naturalHeight, src:img.getAttribute("src")};
      });
      assert.equal(preview.src,"/audio/img/maletin-real-first-frame-desktop.webp");
      assert.equal(preview.width,1100);
      assert.equal(preview.height,635);
      assert.equal(await page.$eval(".store-visit", el => el.getAttribute("href")), "/audio/");
      const marks = await page.evaluate(() => performance.getEntriesByType("mark").map(mark => mark.name));
      assert.ok(marks.includes("unfire-world:webgl-ready"));
      assert.ok(marks.includes("unfire-world:first-draw"));
      assert.deepEqual(errors,[]);
      console.log("PASS viewport",width+"x"+height);
      pass++;
      await page.close();
    }
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type,...args) {
        return type.includes("webgl") ? null : original.call(this,type,...args);
      };
    });
    await page.goto(baseUrl + "/experiments/unfire-world-pilot/", {waitUntil:"networkidle0"});
    const fallback = await page.evaluate(() => ({
      mode:document.querySelector("#scene-mode").textContent,
      visible:!document.querySelector("#fallback-visual").hidden,
      hidden:document.querySelector("canvas").hidden
    }));
    assert.deepEqual(fallback,{mode:"MODO 2D",visible:true,hidden:true});
    await page.$eval("#morph-slider", el => {el.value="100";el.dispatchEvent(new Event("input",{bubbles:true}));});
    assert.equal(await page.$eval("#morph-output", el=>el.textContent),"100 %");
    assert.equal(await page.$eval("#fallback-label", el=>el.textContent),"Previsualización 2D · 100 %");
    assert.equal(await page.$eval("#fallback-shape", el=>el.style.borderRadius),"50%");
    console.log("PASS no WebGL fallback");
    pass++;
    await page.close();
    // The sample should obey reduced-motion and update without an animated tween.
    const reduced = await browser.newPage();
    await reduced.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
    await reduced.goto(baseUrl + "/experiments/unfire-world-pilot/",{waitUntil:"networkidle0"});
    await reduced.waitForFunction(() => document.querySelector("#scene-mode").textContent === "WEBGL ACTIVO",{timeout:10000});
    await reduced.click("#morph-button");
    assert.equal(await reduced.$eval("#morph-output", el=>el.textContent),"100 %");
    await reduced.close();
    console.log("PASS reduced-motion immediate change");
    pass++;

    // Context-loss recovery is optional in WebGL implementations but must
    // restore a working stage when the extension exists.
    const contextPage = await browser.newPage();
    await contextPage.goto(baseUrl + "/experiments/unfire-world-pilot/",{waitUntil:"networkidle0"});
    await contextPage.waitForFunction(() => document.querySelector("#scene-mode").textContent === "WEBGL ACTIVO",{timeout:10000});
    const extension = await contextPage.evaluate(() => {
      const context = document.querySelector("canvas").getContext("webgl");
      const extension = context.getExtension("WEBGL_lose_context");
      if(!extension) return false;
      extension.loseContext();
      return true;
    });
    if (extension) {
      await contextPage.waitForFunction(() => document.querySelector("#scene-mode").textContent === "MODO 2D",{timeout:10000});
      await contextPage.evaluate(() => {
        document.querySelector("canvas").getContext("webgl").getExtension("WEBGL_lose_context").restoreContext();
      });
      await contextPage.waitForFunction(() => document.querySelector("#scene-mode").textContent === "WEBGL ACTIVO",{timeout:15000});
      assert.equal(await contextPage.$eval("canvas",el=>el.hidden),false);
      console.log("PASS WebGL context loss and restore");
      pass++;
    } else {
      console.log("SKIP WebGL context loss extension unsupported");
    }
    await contextPage.close();
    console.log("TOTAL",pass,"/",extension ? 8 : 7,"PASS");
  } finally { await browser.close(); }
})().catch(error=>{console.error(error.stack||String(error));process.exitCode=1});
