'use strict';
// Real Chromium WebGL tap smoke. Emulates touch devices but does NOT certify physical iOS/Android.
const { chromium } = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const port = Number(process.env.UNFIRE_TOUCH_QA_PORT || 8796);
const host = 'http://127.0.0.1:' + port;
const specs = [
  { label: 'small-phone-portrait', width: 320, height: 568, mobile: true },
  { label: 'phone-portrait', width: 390, height: 844, mobile: true },
  { label: 'phone-landscape', width: 844, height: 390, mobile: true },
  { label: 'tablet-portrait', width: 820, height: 1180, mobile: true },
  { label: 'tablet-landscape', width: 1024, height: 768, mobile: true },
  { label: 'desktop', width: 1280, height: 800, mobile: false }
];
let server, browser;
// Bound only our test's Chromium contexts; no app or browser session of another agent is touched.
const bounded = (action, ms=3500) => Promise.race([
  Promise.resolve().then(action).then(() => true, () => false),
  new Promise(resolve => setTimeout(() => resolve(false), ms))
]);
async function exercise(spec) {
  const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height },
    isMobile: spec.mobile, hasTouch: spec.mobile, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 250)));
    const started = Date.now();
    await page.goto(host + '/audio/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      const fr = document.getElementById('malFrame');
      return document.getElementById('heroPin')?.classList.contains('scene-ready')
        && !!fr?.contentWindow?.__UNFIRE_CASE_QA && !!fr?.contentWindow?.__ringB;
    }, null, { timeout: 85000, polling: 200 });
    const pos = await page.evaluate(() => {
      const f = document.getElementById('malFrame'), w = f.contentWindow;
      const c = w.__dbg.S.camera, ring = w.__ringB;
      ring.updateWorldMatrix(true, false);
      c.updateMatrixWorld(true);
      const p = ring.getWorldPosition(ring.position.clone().set(0, 0, 0)).project(c);
      const r = f.getBoundingClientRect();
      const x = r.left + (p.x + 1) * r.width * .5;
      const y = r.top + (1 - p.y) * r.height * .5;
      return { x, y, ringVisible: ring.visible, box: [r.left,r.top,r.width,r.height],
        closed: w.__UNFIRE_CASE_QA.closed,
        canvasTouchAction: getComputedStyle(w.document.getElementById('cv')).touchAction,
        over: document.elementFromPoint(x, y)?.id };
    });
    assert(pos.closed && pos.canvasTouchAction === 'none', 'Initial lid must be closed and touch must not be canceled: ' + JSON.stringify(pos));
    assert(pos.x > 2 && pos.x < spec.width - 2 && pos.y > 2 && pos.y < spec.height - 2,
      'Physical butterfly projects into the viewport ' + JSON.stringify(pos));
    if(spec.mobile) await page.touchscreen.tap(pos.x, pos.y);
    else await page.mouse.click(pos.x, pos.y);
    await page.waitForFunction(() => {
      const f = document.getElementById('malFrame'), qa = f?.contentWindow?.__UNFIRE_CASE_QA;
      return document.body.classList.contains('immOn') && qa && !qa.closed;
    }, null, { timeout: 25000, polling: 100 });
    const state = await page.evaluate(() => ({
      immersive: document.body.classList.contains('immOn'),
      lidTargetOpen: !document.getElementById('malFrame').contentWindow.__UNFIRE_CASE_QA.closed,
      caseVisible: document.getElementById('malFrame').contentWindow.__UNFIRE_CASE_QA.caseVisible
    }));
    assert(state.immersive && state.lidTargetOpen && state.caseVisible, 'One press really opens case');
    if(spec.label === 'phone-portrait' || spec.label === 'tablet-portrait') {
      // Rotate with the same running 3D scene: do not lose the already accepted tap.
      await page.setViewportSize({width:spec.height,height:spec.width});
      await page.evaluate(() => dispatchEvent(new Event('orientationchange')));
      await page.waitForFunction(() => {
        const f=document.getElementById('malFrame'), w=f?.contentWindow;
        const rect=f.getBoundingClientRect();
        return !!(w?.__UNFIRE_CASE_QA && !w.__UNFIRE_CASE_QA.closed
          && w.__UNFIRE_CASE_QA.caseVisible && document.body.classList.contains('immOn')
          && Math.abs(rect.width-innerWidth)<3 && Math.abs(rect.height-innerHeight)<3);
      },null,{timeout:12000,polling:200});
      console.log('CASE_ROTATION_PASS', spec.label);
    }
    assert.equal(errors.length, 0, 'No uncaught errors: ' + errors.join('; '));
    console.log('CASE_TAP_PASS', JSON.stringify({label: spec.label, ms: Date.now() - started, pos, state}));
  } finally { await bounded(() => context.close()); }
}
async function earlyLoadingTap(spec) {
  const context = await browser.newContext({ viewport: {width: spec.width, height: spec.height},
    isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 250)));
    // Hold the WebGL engine briefly so a real finger taps the authentic capture, not a simulated opener.
    await page.route('**/audio/maletin/game-engine-v50.js*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto(host + '/audio/', {waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(() => {
      const f = document.getElementById('unfireCaseFirstFrame'), i = f?.querySelector('img');
      return !!(i?.complete && i.naturalWidth && getComputedStyle(f).visibility !== 'hidden');
    }, null, {timeout:10000, polling:50});
    const rect = await page.locator('#unfireCaseFirstFrame').boundingBox();
    assert(rect?.width > 200, 'Authentic first frame exists and receives first tap');
    await page.touchscreen.tap(rect.x + rect.width * 0.5, rect.y + rect.height * 0.53);
    await page.waitForFunction(() => document.body.classList.contains('immOn'),
      null, { timeout: 3000 });
    await page.waitForFunction(() => {
      const qa = document.getElementById('malFrame')?.contentWindow?.__UNFIRE_CASE_QA;
      return qa && !qa.closed && qa.caseVisible;
    }, null, { timeout: 85000, polling: 150 });
    assert.equal(errors.length, 0, 'Early touch produced no JS exception: ' + errors.join('; '));
    console.log('CASE_LOADING_TAP_PASS', spec.label);
  } finally { await bounded(() => context.close()); }
}
// Independent Chromium per viewport/scenario: software WebGL resources are fully released
// before the next case. Preserve every touch, orientation and lid assertion.
async function withIsolatedBrowser(label, action) {
  const isolated = await chromium.launch({headless: true,
    executablePath: process.env.UNFIRE_CHROME || undefined,
    args: ['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']});
  browser = isolated;
  try {
    await action();
  } finally {
    const child = typeof isolated.process === 'function' ? isolated.process() : null;
    const closed = await bounded(() => isolated.close(), 4000);
    if(!closed && child && !child.killed) try { child.kill('SIGTERM'); } catch (_) {}
    if(browser === isolated) browser = null;
    console.log('CASE_BROWSER_ISOLATED', label);
  }
}
async function standaloneTouch() {
  const context = await browser.newContext({viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,deviceScaleFactor:1});
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0,250)));
    await page.goto(host + '/audio/maletin/index.html?quality=compact',
      {waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(() => !!(window.__mal?.S && window.__ringB && window.__UNFIRE_CASE_QA),
      null, {timeout:70000, polling:200});
    const p = await page.evaluate(() => {
      const c=window.__dbg.S.camera, o=window.__ringB;
      c.updateMatrixWorld(true); o.updateWorldMatrix(true,false);
      const v=o.getWorldPosition(o.position.clone().set(0,0,0)).project(c);
      return {x:(v.x+1)*innerWidth/2, y:(1-v.y)*innerHeight/2};
    });
    assert(p.x>0 && p.y>0 && p.x<390 && p.y<844, 'Butterfly is tappable standalone');
    await page.touchscreen.tap(p.x,p.y);
    await page.waitForFunction(() => !window.__UNFIRE_CASE_QA.closed,
      null,{timeout:15000,polling:100});
    assert.equal(errors.length,0,'Standalone direct game has no errors: '+errors.join('; '));
    console.log('CASE_STANDALONE_TOUCH_PASS',p);
  } finally { await bounded(() => context.close()); }
}
(async () => {
  try {
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
      {cwd: path.resolve(__dirname, '..'), stdio: 'ignore'});
    await new Promise(r => setTimeout(r, 900));
    for(const spec of specs)
      await withIsolatedBrowser(spec.label, () => exercise(spec));
    await withIsolatedBrowser('phone-loading',
      () => earlyLoadingTap({label:'phone-loading',width:390,height:844}));
    await withIsolatedBrowser('ipad-loading',
      () => earlyLoadingTap({label:'ipad-loading',width:820,height:1180}));
    await withIsolatedBrowser('standalone', () => standaloneTouch());
  } catch(e) {console.error('CASE_TAP_FAIL', e.stack || e);process.exitCode=1;}
  finally {
    if(browser) {
      const child = typeof browser.process === 'function' ? browser.process() : null;
      const closed = await bounded(() => browser.close(), 4000);
      if(!closed && child && !child.killed) try { child.kill('SIGTERM'); } catch (_) {}
    }
    if(server) {
      if(server.exitCode === null) server.kill('SIGTERM');
      await Promise.race([
        new Promise(r => server.once('exit', r)),
        new Promise(r => setTimeout(r, 750))
      ]);
    }
  }
})();
