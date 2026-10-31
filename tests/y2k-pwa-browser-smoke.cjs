/* Optional isolated, opt-in Chrome test for PWA metadata and scope.
 * No real game/WebGL is loaded. No third-party network calls, no writes.
 * Run: PUPPETEER_MODULE=/absolute/path/to/puppeteer CHROME_PATH=/path/to/chrome node tests/y2k-pwa-browser-smoke.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const puppeteerPackage = process.env.PUPPETEER_MODULE || 'puppeteer';
let puppeteer;
try { puppeteer = require(puppeteerPackage); } catch (error) {
  console.error('Browser smoke skipped: install/use a trusted existing Puppeteer package and supply PUPPETEER_MODULE. No packages auto-installed.');
  process.exit(2);
}
const executablePath = process.env.CHROME_PATH;
if (!executablePath) {
  console.error('Browser smoke requires CHROME_PATH for an existing local Chrome executable.');
  process.exit(2);
}
const harness = '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="manifest" href="/audio/game.webmanifest"></head><body><h1>Y2K ROBOTS isolated installation smoke</h1><script defer src="/audio/js/y2k-pwa-register.js"></script></body></html>';
const mime = (name) => name.endsWith('.js') ? 'text/javascript' : name.endsWith('.webmanifest') ? 'application/manifest+json' : name.endsWith('.png') ? 'image/png' : 'application/octet-stream';

async function run() {
  const server = http.createServer((req, res) => {
    let route;
    try { route = new URL(req.url, 'http://127.0.0.1').pathname; }
    catch { res.writeHead(400).end(); return; }
    if (route === '/audio/' || route === '/audio/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(harness); return;
    }
    if (!route.startsWith('/audio/')) { res.writeHead(404).end(); return; }
    const source = path.resolve(root, '.' + route);
    if (!source.startsWith(path.join(root, 'audio') + path.sep)) { res.writeHead(403).end(); return; }
    let bytes;
    try { bytes = fs.readFileSync(source); }
    catch { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime(source) }).end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'] });
    const page = await browser.newPage();
    const url = 'http://127.0.0.1:' + server.address().port + '/audio/';
    await page.goto(url, { waitUntil: 'load', timeout: 10000 });
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/audio/');
      return reg && reg.active && reg.active.state === 'activated';
    }, { timeout: 8000 });
    await page.reload({ waitUntil: 'load', timeout: 10000 });
    const observed = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/audio/');
      const manifest = await (await fetch('/audio/game.webmanifest')).json();
      const icons = await Promise.all(manifest.icons.map(async x => ({
        size: x.sizes,
        status: (await fetch(new URL(x.src, location.href))).status
      })));
      const nav = await fetch('/audio/index.html');
      return {
        serviceWorkerActive: reg?.active?.state === 'activated',
        controlledAfterReload: !!navigator.serviceWorker.controller,
        registrationScopeMatches: reg?.scope === location.origin + '/audio/',
        name: manifest.name, id: manifest.id,
        icons, pageStatus: nav.status,
        cacheKeys: await caches.keys()
      };
    });
    assert.equal(observed.serviceWorkerActive, true);
    assert.equal(observed.controlledAfterReload, true);
    assert.equal(observed.registrationScopeMatches, true);
    assert.equal(observed.name, 'Y2K ROBOTS');
    assert.equal(observed.id, '/audio/');
    assert.deepEqual(observed.icons.map(x => x.size), ['192x192', '512x512']);
    assert.ok(observed.icons.every(x => x.status === 200));
    assert.equal(observed.pageStatus, 200);
    assert.deepEqual(observed.cacheKeys, []);
    console.log(JSON.stringify({ result: 'PASS', harnessOnly: true, windowsOrAndroidCertified: false, observed }, null, 2));
    await page.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(e => { console.error('Browser smoke FAIL:', e.stack || String(e)); process.exitCode = 1; });
