#!/usr/bin/env node
/* Browser QA for hyperwave-hardware/index.html (Chrome via puppeteer-core).
 * Usage: node qa-presentation.cjs <baseUrl> <outDir>
 * Checks per viewport: JS errors, horizontal overflow, image loading, theatre scrubbing,
 * film dialog playback, live atelier recolouring, brief/mailto generation. Saves screenshots. */
const fs = require('fs'), path = require('path');
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const base = process.argv[2] || 'http://127.0.0.1:8731', out = path.resolve(process.argv[3] || './qa');
const VIEWS = [
  { name: 'desktop-1440', w: 1440, h: 900, dpr: 1, mobile: false },
  { name: 'iphone-390', w: 390, h: 844, dpr: 3, mobile: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  { name: 'ipad-820', w: 820, h: 1180, dpr: 2, mobile: true },
  { name: 'wide-1920', w: 1920, h: 1080, dpr: 1, mobile: false },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pc.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = [];
  for (const v of VIEWS) {
    const p = await b.newPage(); const errs = [], failed = [];
    p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('requestfailed', (r) => failed.push(r.url())); p.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    if (v.ua) await p.setUserAgent(v.ua);
    await p.setViewport({ width: v.w, height: v.h, deviceScaleFactor: v.dpr, isMobile: v.mobile, hasTouch: v.mobile });
    const t0 = Date.now();
    await p.goto(base + '/hyperwave-hardware/', { waitUntil: 'networkidle0', timeout: 60000 });
    const loadMs = Date.now() - t0;
    await sleep(1800);
    await p.screenshot({ path: path.join(out, v.name + '-01-hero.png') });
    const r = { view: v.name, loadMs };
    r.overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // theatre scrub
    const th = await p.evaluate(() => { const t = document.getElementById('transformation'); return { top: t.offsetTop, h: t.offsetHeight }; });
    r.theatre = [];
    for (const f of [0, 0.3, 0.62, 1]) {
      await p.evaluate((y) => window.scrollTo(0, y), th.top + f * (th.h - v.h));
      await sleep(700);
      const s = await p.evaluate(() => ({ src: document.getElementById('seq').getAttribute('src'), tc: document.getElementById('tc').textContent, ch: [...document.querySelectorAll('#chapters .chapter')].findIndex((c) => c.classList.contains('on')) }));
      r.theatre.push(s);
      await p.screenshot({ path: path.join(out, v.name + '-02-theatre-' + Math.round(f * 100) + '.png') });
    }
    // all sections screenshot
    for (const id of ['film', 'atelier', 'engineering', 'commission', 'enquiry']) {
      await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await sleep(900);
      await p.screenshot({ path: path.join(out, v.name + '-03-' + id + '.png') });
    }
    // images
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
    await sleep(800);
    r.images = await p.evaluate(() => { const im = [...document.images]; return { total: im.length, broken: im.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')) }; });
    // film
    await p.evaluate(() => document.querySelector('.film-frame').click()); await sleep(2500);
    r.film = await p.evaluate(() => { const v = document.getElementById('film-video'); return { open: document.getElementById('film-dialog').open, time: +v.currentTime.toFixed(2), w: v.videoWidth, dur: v.duration }; });
    await p.screenshot({ path: path.join(out, v.name + '-04-film.png') });
    await p.evaluate(() => document.getElementById('film-close').click());
    // atelier live
    await p.evaluate(() => document.getElementById('atelier').scrollIntoView());
    await p.evaluate(() => 0); await p.click('#studio-load');
    await p.waitForFunction(() => document.getElementById('studio').classList.contains('live'), { timeout: 60000 }).catch(() => {});
    await sleep(1500);
    r.atelierLive = await p.evaluate(() => document.getElementById('studio').classList.contains('live'));
    await p.evaluate(() => document.querySelector('[data-form="4"]').click()); await sleep(5200);
    await p.evaluate(() => { const c = (g, i) => document.querySelectorAll('.chips[data-group="' + g + '"] .chip')[i].click(); c('canopy', 1); c('body', 2); c('metal', 1); c('pods', 1); });
    const eng = await p.$('#engrave'); await eng.type('For R. — Monaco 2027');
    await p.evaluate(() => document.querySelectorAll('.checks input')[0].click());
    await sleep(1200);
    r.atelierStatus = await p.evaluate(() => document.getElementById('studio-status').textContent);
    r.recolour = await p.evaluate(() => { try { const w = document.getElementById('studio-frame').contentWindow; let n = 0; w.__hw.H.root.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.__o) n++; }); return n; } catch (e) { return 'err ' + e; } });
    r.brief = await p.evaluate(() => document.getElementById('brief').textContent.split('\n').slice(2, 9));
    r.mailtoLen = await p.evaluate(() => document.getElementById('brief-send').href.length);
    await p.evaluate(() => document.getElementById('studio').scrollIntoView({ block: 'start' })); await sleep(600);
    await p.screenshot({ path: path.join(out, v.name + '-05-atelier-live.png') });
    r.errors = errs; r.failedRequests = failed.filter((u) => !u.includes('favicon'));
    report.push(r); await p.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
