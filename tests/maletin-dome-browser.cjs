'use strict';
// Bounded real-Chromium smoke test: enter/exit the roof opening, no screenshots.
// Run with playwright installed and Chrome/Chromium available.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.UNFIRE_DOME_QA_PORT || 8786);
const cases = [
  { name: 'desktop', width: 960, height: 640, mobile: false },
  { name: 'mobile-portrait', width: 390, height: 844, mobile: true },
  { name: 'mobile-landscape', width: 844, height: 390, mobile: true }
];
let server, browser;

async function exercise(spec) {
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: 1, hasTouch: spec.mobile, isMobile: spec.mobile
  });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 350)));
    const start = Date.now();
    await page.goto('http://127.0.0.1:' + port + '/audio/maletin/', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForFunction(() => !!(window.__roamAPI && window.__DOME && window.__mal && window.__mal.S),
      null, { timeout: 65000, polling: 300 });
    const beginning = await page.evaluate(() => {
      window.__roamAPI.enterRoam();
      const R = window.__roamAPI.ROAMS;
      R.p.set(0, 4.5, 40);
      R.h = 16; R.flyH = 17; R.fly = true; R.vy = 0; R.k = {};
      window.__DOME.open = 0;
      return { playing: R.on, outside: !!window.ATM_OUT };
    });
    assert(beginning.playing && !beginning.outside, 'Begin inside the house');
    await page.waitForFunction(() => window.__DOME.open > 0.6,
      null, { timeout: 22000, polling: 100 });
    const prewarm = await page.evaluate(() => ({
      open: window.__DOME.open, altitude: window.__roamAPI.ROAMS.h,
      preparing: !!window.__obstWarmPending, prepared: !!window.__obstWarmReady
    }));
    await page.evaluate(() => {
      const R = window.__roamAPI.ROAMS;
      R.p.set(0, 4.5, 40);
      R.h = 43; R.flyH = 43; R.vy = 0; R.fly = true;
      window.__DOME.open = 0.95;
    });
    await page.waitForFunction(() => window.ATM_OUT === true,
      null, { timeout: 22000, polling: 100 });
    const outdoor = await page.evaluate(() => {
      const R = window.__roamAPI.ROAMS;
      return { outside: !!window.ATM_OUT, x: R.p.x, z: R.p.z, h: R.h,
        flying: !!R.fly, dome: window.__DOME.open };
    });
    assert(outdoor.outside && outdoor.flying, 'Exterior transition keeps flight');
    assert(Math.hypot(outdoor.x, outdoor.z - 40) < 34 && Number.isFinite(outdoor.h),
      'Avatar remains at the dome, not teleported elsewhere');

    await page.evaluate(() => {
      const R = window.__roamAPI.ROAMS;
      R.p.set(0, 4.5, 40);
      R.h = 33; R.flyH = 33; R.vy = 0; R.fly = true;
      window.__DOME.open = 0.95;
    });
    await page.waitForFunction(() => window.ATM_OUT === false,
      null, { timeout: 22000, polling: 100 });
    await page.waitForTimeout(500);
    const indoor = await page.evaluate(() => {
      const R = window.__roamAPI.ROAMS;
      return { outside: !!window.ATM_OUT, x: R.p.x, z: R.p.z,
        h: R.h, playing: !!R.on };
    });
    assert(!indoor.outside && indoor.playing && Number.isFinite(indoor.h),
      'Re-entry keeps the session and a valid altitude without mode bounce');
    assert.equal(errors.length, 0, 'No unhandled browser errors: ' + errors.join('; '));
    console.log('DOME_BROWSER_PASS', JSON.stringify({
      viewport: spec.name, elapsedMs: Date.now() - start, prewarm, outdoor, indoor
    }));
  } finally {
    await context.close();
  }
}

(async () => {
  try {
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
      cwd: root, stdio: 'ignore'
    });
    await new Promise(resolve => setTimeout(resolve, 800));
    browser = await chromium.launch({
      headless: true, executablePath: process.env.UNFIRE_CHROME || undefined,
      args: ['--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--no-sandbox',
        '--autoplay-policy=no-user-gesture-required']
    });
    for (const spec of cases) await exercise(spec);
  } catch (error) {
    console.error('DOME_BROWSER_FAIL', error.stack || error);
    process.exitCode = 1;
  } finally {
    try { if (browser) await browser.close(); } catch (_) {}
    if (server) {
      server.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => server.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
    }
  }
})();
