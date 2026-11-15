#!/usr/bin/env node
/* Renders transparent 1920x1080 typography overlays for the Hyperwave digital concept film.
 * Usage: node film-overlays.cjs <outDir>. Text only; the imagery underneath is the real digital capture. */
const fs = require('fs'), path = require('path');
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const out = path.resolve(process.argv[2] || './overlays');
const CARDS = {
  title: '<div class="c t"><h1>HYPERWAVE 2000</h1><p>ONE INSTRUMENT. AN EXTRAORDINARY TRANSFORMATION.</p></div>',
  m1: '<div class="cap"><i>I.</i> The awakening</div>',
  m2: '<div class="cap"><i>II.</i> The keys emerge</div>',
  m3: '<div class="cap"><i>III.</i> The command surface</div>',
  m4: '<div class="cap"><i>IV.</i> Full expression</div>',
  s1: '<div class="cap">Engineered to unfold.</div>',
  s2: '<div class="cap">Every control rises into place.</div>',
  s3: '<div class="cap">Twenty-five keys, revealed.</div>',
  s4: '<div class="cap">Speakers that reach outward.</div>',
  end: '<div class="c t"><h1>HYPERWAVE 2000</h1><p>PRIVATE COMMISSIONS &nbsp;·&nbsp; HELLO@UNFIRE.TECHNOLOGY</p></div>',
  label: '<div class="lab">DIGITAL CONCEPT VISUALISATION &nbsp;—&nbsp; captured from the real-time Hyperwave 2000 digital instrument. No physical unit has been built.</div>',
};
const CSS = `html,body{margin:0;width:1920px;height:1080px;background:transparent;overflow:hidden}
.c{position:absolute;left:0;right:0;top:120px;text-align:center;color:#f3e3c3}
h1{font:400 92px/1 Didot,"Bodoni 72",Georgia,serif;letter-spacing:.14em;margin:0;text-shadow:0 2px 30px rgba(0,0,0,.6)}
.c p{font:600 20px/1 "Avenir Next",Avenir,Helvetica,sans-serif;letter-spacing:.42em;color:#e9d2a6;margin-top:30px}
.cap{position:absolute;left:110px;bottom:150px;font:400 50px/1 Didot,"Bodoni 72",Georgia,serif;color:#f3e3c3;text-shadow:0 2px 24px rgba(0,0,0,.7)}
.cap i{font-style:normal;color:#e0bb7d;margin-right:18px}
.cap:before{content:"";display:block;width:56px;height:1px;background:#e0bb7d;margin-bottom:26px}
.lab{position:absolute;left:0;right:0;bottom:0;height:60px;background:rgba(0,0,0,.45);color:#d8d4ca;font:500 18px/60px "Avenir Next",Avenir,Helvetica,sans-serif;letter-spacing:.06em;padding-left:44px}`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pc.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1920, height: 1080 } });
  const p = await b.newPage();
  for (const [k, html] of Object.entries(CARDS)) {
    await p.setContent(`<style>${CSS}</style>${html}`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, k + '.png'), omitBackground: true });
  }
  await b.close();
  console.log('overlays', Object.keys(CARDS).length);
})();
