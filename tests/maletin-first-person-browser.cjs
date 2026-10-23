'use strict';
// Bounded, single-browser smoke for real Three.js first-person camera and movement.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const port = 8793;
const sizes = [
  { label: 'desktop', width: 960, height: 640, mobile: false },
  { label: 'portrait', width: 390, height: 844, mobile: true }
];
let server, browser;
async function one(view) {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1
  });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message.slice(0, 240)));
    await page.goto('http://127.0.0.1:' + port + '/audio/maletin/index.html?quality=compact',
      { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForFunction(() => !!(window.__roamAPI && window.__dbg && window.__dbg.S),
      null, { timeout: 60000, polling: 300 });
    await page.evaluate(() => {
      const a = window.__roamAPI;
      a.enterRoam();
      a.ROAMS.mode = '1p';
      a.ROAMS.p.set(0, 4.5, 40); // beneath dome for safe flight
      a.ROAMS.h = 11;
      a.ROAMS.flyH = 13;
      a.ROAMS.fly = true;
      a.ROAMS.vy = 0;
      a.ROAMS.k = {};
    });
    await page.waitForFunction(() => {
      const r = window.__roamAPI.ROAMS;
      return !!(r.ep && r.av && r.av.w);
    }, null, { timeout: 40000, polling: 100 });
    const read = () => page.evaluate(() => {
      const r = window.__roamAPI.ROAMS, c = window.__dbg.S.camera;
      const hd = r.av && r.av.r0 && r.av.r0.J && r.av.r0.J.head && r.av.r0.J.head.g;
      return { mode: r.mode, x: r.p.x, z: r.p.z, h: r.h, yaw: r.yaw,
        cx: c.position.x, cy: c.position.y, cz: c.position.z, near: c.near,
        headHidden: hd ? !hd.visible : null,
        valid: [c.position.x, c.position.y, c.position.z, c.near].every(Number.isFinite) };
    });
    const initial = await read();
    assert(initial.valid && initial.mode === '1p', 'Real 1p camera renders finite coordinates');
    assert(initial.headHidden !== false, 'The head cannot occlude the first-person view');
    assert(Math.abs(initial.cy - (-8.9 + initial.h + 9.6)) < 5,
      'Eye follows stable avatar-relative vertical anchor');
    await page.evaluate(() => { window.__roamAPI.ROAMS.k.d = 1; });
    await page.waitForTimeout(450);
    await page.evaluate(() => { window.__roamAPI.ROAMS.k.d = 0; });
    const strafed = await read();
    assert(strafed.x > initial.x + 0.02, 'D strafes right while flying in first person');
    assert(Math.abs(strafed.yaw - initial.yaw) < 0.03, 'Strafing does not swing the camera yaw');
    await page.evaluate(() => {
      const r = window.__roamAPI.ROAMS;
      r.h = 33; r.flyH = 33; r.vy = 0;
    });
    await page.waitForTimeout(160);
    const rising = await read();
    assert(rising.valid && Math.abs(rising.cy - (-8.9 + rising.h + 9.6)) < 8,
      'Flight view stays aligned with avatar altitude, without animated head tilt');
    await page.evaluate(() => { window.__roamAPI.ROAMS.mode = '3p'; });
    await page.waitForFunction(() => {
      const r = window.__roamAPI.ROAMS;
      return !!(r.av && r.av.r0 && r.av.r0.J && r.av.r0.J.head
        && r.av.r0.J.head.g.visible);
    }, null, { timeout: 15000 });
    await page.evaluate(() => { window.__roamAPI.ROAMS.mode = '1p'; });
    await page.waitForFunction(() => {
      const r = window.__roamAPI.ROAMS;
      return !!(r.ep && r.av && r.av.r0 && r.av.r0.J && r.av.r0.J.head
        && !r.av.r0.J.head.g.visible);
    }, null, { timeout: 15000 });
    assert.equal(errors.length, 0, 'No uncaught errors: ' + errors.join('; '));
    console.log('FIRST_PERSON_BROWSER_PASS', JSON.stringify({ viewport: view.label, initial, strafed, rising }));
  } finally { await context.close(); }
}
(async () => {
  try {
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
      { cwd: root, stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 800));
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.UNFIRE_CHROME || undefined,
      args: ['--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--no-sandbox'] });
    for (const size of sizes) await one(size);
  } catch (error) {
    console.error('FIRST_PERSON_BROWSER_FAIL', error.stack || error);
    process.exitCode = 1;
  } finally {
    try { if (browser) await browser.close(); } catch (_) {}
    if (server) { server.kill('SIGTERM'); await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 500))
    ]); }
  }
})();
