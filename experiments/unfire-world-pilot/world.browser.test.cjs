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
      assert.equal(response.status(),200);
      assert.ok(result.width <= result.client + 1, JSON.stringify(result));
      assert.ok(result.draws >= 1, "No real WebGL draw");
      assert.equal(result.error,0);
      await page.$eval("#morph-slider", el => {
        el.value = "80";
        el.dispatchEvent(new Event("input", {bubbles:true}));
      });
      assert.equal(await page.$eval("#morph-output", el => el.textContent), "80 %");
      await page.click("#morph-button");
      await new Promise(resolve => setTimeout(resolve, 900));
      assert.equal(await page.$eval("#morph-output", el => el.textContent), "0 %");
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
    console.log("PASS no WebGL fallback");
    pass++;
    await page.close();
    console.log("TOTAL",pass,"/",6,"PASS");
  } finally { await browser.close(); }
})().catch(error=>{console.error(error.stack||String(error));process.exitCode=1});
