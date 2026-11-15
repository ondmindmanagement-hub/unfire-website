#!/usr/bin/env node
/* Captures "digital finish studies": the real-time Hyperwave model with atelier material colours
 * applied in-browser (same logic as the atelier on hyperwave-hardware/index.html).
 * Output must be labelled "Digital finish study" — not a physical sample.
 * Usage: node capture-finish-studies.cjs <baseUrl> <outDir> */
const fs = require('fs'), path = require('path');
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const base = process.argv[2] || 'http://127.0.0.1:8731', out = path.resolve(process.argv[3] || './finishes');
const STUDIES = [
  { name: 'finish-original', canopy: null, body: null, metal: null, pods: null },
  { name: 'finish-nocturne', canopy: { c: '#0b0c10', e: '#05060a', o: 0.62 }, body: { c: '#34373c', p: '#4a4d53' }, metal: { c: '#f0c978' }, pods: { c: '#16181c', e: '#050608', o: 0.8 } },
  { name: 'finish-champagne', canopy: { c: '#8f6a33', e: '#5b4019', o: 0.46 }, body: { c: '#eceae6', p: '#f6f5f2' }, metal: { c: '#e9b09b' }, pods: { c: '#a9813f', e: '#5c4115', o: 0.74 } },
  { name: 'finish-emerald', canopy: { c: '#0a4d36', e: '#0b5e42', o: 0.52 }, body: { c: '#666b73', p: '#8f949b' }, metal: { c: null }, pods: { c: '#a9813f', e: '#5c4115', o: 0.74 } },
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await pc.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1.25 } });
  const p = await b.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await p.goto(base + '/audio/hyperwave/', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.__hw && document.body.classList.contains('ready'));
  await p.addStyleTag({ content: '.brand,#hint,.keys,#load,#restore{display:none!important}' });
  await p.evaluate(() => {
    window.__hw.pause(true);
    const out = { canopy: [], pods: [], shell: [], plate: [], metal: [] }, seen = new Set();
    window.__hw.H.root.traverse((o) => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m || !m.color || seen.has(m)) return; seen.add(m); const h = m.color.getHexString(); let k = null;
      if (h === '053a9f' && m.transparent) k = 'canopy'; else if (h === 'd94b00' && m.transparent) k = 'pods'; else if (h === 'b9c4d4') k = 'shell'; else if (h === 'e8ebef') k = 'plate'; else if (['f6f8fb', 'f4f6fa', 'dfe3e8'].includes(h) && m.metalness >= 0.95) k = 'metal';
      if (!k) return; m.userData.__o = { c: m.color.clone(), e: m.emissive ? m.emissive.clone() : null, o: m.opacity }; out[k].push(m); }); });
    window.__mats = out;
    window.__apply = (s) => {
      const set = (m, c, e, o) => { if (c == null) { m.color.copy(m.userData.__o.c); if (m.emissive && m.userData.__o.e) m.emissive.copy(m.userData.__o.e); m.opacity = m.userData.__o.o; } else { m.color.set(c); if (e && m.emissive) m.emissive.set(e); if (o != null) m.opacity = o; } m.needsUpdate = true; };
      const g = (x) => x || { c: null };
      window.__mats.canopy.forEach((m) => set(m, g(s.canopy).c, g(s.canopy).e, g(s.canopy).o));
      window.__mats.pods.forEach((m) => set(m, g(s.pods).c, g(s.pods).e, g(s.pods).o));
      window.__mats.shell.forEach((m) => set(m, g(s.body).c));
      window.__mats.plate.forEach((m) => set(m, s.body ? s.body.p : null));
      window.__mats.metal.forEach((m) => set(m, g(s.metal).c));
    };
  });
  for (const s of STUDIES) {
    await p.evaluate((st) => window.__apply(st), s);
    for (const [suffix, T, az, el] of [['hyper', 4, 0.3, 0.36], ['open', 3, 0.0, 0.3], ['closed', 0, 0.55, 0.34]]) {
      await p.evaluate((a) => window.__hw.renderAt(a.T, a.az, a.el), { T, az, el });
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await p.evaluate((a) => window.__hw.renderAt(a.T, a.az, a.el), { T, az, el });
      await p.screenshot({ path: path.join(out, s.name + '-' + suffix + '.png') });
    }
  }
  await b.close(); console.log('done', STUDIES.length);
})().catch((e) => { console.error(e); process.exit(1); });
