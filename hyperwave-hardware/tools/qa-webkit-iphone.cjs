#!/usr/bin/env node
/* WebKit (Safari engine) smoke test with iPhone emulation via playwright-core.
 * Not a physical-device test. Usage: PLAYWRIGHT_CORE=<path> node qa-webkit-iphone.cjs <baseUrl> <outDir> */
const fs = require('fs'), path = require('path');
const { webkit, devices } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const base = process.argv[2], out = path.resolve(process.argv[3]);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '/hyperwave-hardware/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(out, 'webkit-iphone-hero.png') });
  const r = { ua: await p.evaluate(() => navigator.userAgent), overflowX: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) };
  const th = await p.evaluate(() => { const t = document.getElementById('transformation'); return [t.offsetTop, t.offsetHeight, innerHeight]; });
  await p.evaluate((a) => scrollTo(0, a[0] + 0.55 * (a[1] - a[2])), th); await p.waitForTimeout(900);
  r.theatre = await p.evaluate(() => [document.getElementById('seq').getAttribute('src'), document.getElementById('tc').textContent]);
  await p.screenshot({ path: path.join(out, 'webkit-iphone-theatre.png') });
  await p.evaluate(() => document.getElementById('atelier').scrollIntoView());
  await p.click('#studio-load');
  await p.waitForFunction(() => document.getElementById('studio').classList.contains('live'), null, { timeout: 60000 }).catch(() => {});
  r.atelierLive = await p.evaluate(() => document.getElementById('studio').classList.contains('live'));
  r.status = await p.evaluate(() => document.getElementById('studio-status').textContent);
  await p.evaluate(() => document.querySelectorAll('.chips[data-group="canopy"] .chip')[2].click());
  await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('studio').scrollIntoView());
  await p.screenshot({ path: path.join(out, 'webkit-iphone-atelier.png') });
  r.dialogSupport = await p.evaluate(() => typeof document.getElementById('film-dialog').showModal === 'function');
  r.errors = errs;
  fs.writeFileSync(path.join(out, 'webkit-report.json'), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
