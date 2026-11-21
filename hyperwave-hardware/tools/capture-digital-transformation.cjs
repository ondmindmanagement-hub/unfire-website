#!/usr/bin/env node
/*
 * Hyperwave 2000 — authentic capture of the REAL digital transformation.
 *
 * Drives the unmodified production page audio/hyperwave/index.html through its own
 * deterministic hook window.__hw.renderAt(T, azimuth, elevation, zoom, targetY) and saves
 * frames of the actual procedural Three.js model. Nothing is generated, painted or composited:
 * every frame is a screenshot of the running digital instrument. Output must always be
 * labelled "Digital concept visualisation" — it is NOT footage of physical hardware.
 *
 * Usage: node capture-digital-transformation.cjs <baseUrl> <outDir> [mode]
 *   mode = "seq" (transformation sequence), "stills" (hero/detail stills) or "all"
 * Requires: puppeteer-core + a local Chrome. PUPPETEER_CORE env may point to the module.
 */
const path = require('path');
const fs = require('fs');
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');

const base = process.argv[2] || 'http://127.0.0.1:8731';
const out = path.resolve(process.argv[3] || './capture-out');
const mode = process.argv[4] || 'all';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const W = +(process.env.CAP_W || 1600), H = +(process.env.CAP_H || 1000), DPR = +(process.env.CAP_DPR || 1.5);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pc.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: DPR },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(base + '/audio/hyperwave/', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => window.__hw && document.body.classList.contains('ready'), { timeout: 90000 });
  // Hide only the 2D text overlays (brand line, hint, keyboard help). The 3D render is untouched.
  await page.addStyleTag({ content: '.brand,#hint,.keys,#load,#restore{display:none!important}' });
  await page.evaluate(() => window.__hw.pause(true));

  const shot = async (name, T, az, el, zoom, ty) => {
    await page.evaluate((a) => window.__hw.renderAt(a.T, a.az, a.el, a.zoom, a.ty), { T, az, el, zoom, ty });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate((a) => window.__hw.renderAt(a.T, a.az, a.el, a.zoom, a.ty), { T, az, el, zoom, ty });
    await page.screenshot({ path: path.join(out, name), type: name.endsWith('.jpg') ? 'jpeg' : 'png', quality: name.endsWith('.jpg') ? 92 : undefined });
  };

  const meta = { source: 'audio/hyperwave/index.html (unmodified)', hook: 'window.__hw.renderAt', viewport: [W, H, DPR], captured: new Date().toISOString(), frames: [] };

  if (mode === 'seq' || mode === 'all') {
    // Cinematic transformation: T 0 -> 4 with a slow, measured orbit (az 0.62 -> 0.18 rad).
    const N = +(process.env.CAP_FRAMES || 120);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const T = 4 * u;
      const ease = u * u * (3 - 2 * u);
      const az = 0.62 - 0.44 * ease, el = 0.36 - 0.06 * ease;
      const name = 'seq-' + String(i).padStart(3, '0') + '.jpg';
      await shot(name, T, az, el, null, null);
      meta.frames.push({ name, T: +T.toFixed(4), az: +az.toFixed(4), el: +el.toFixed(4) });
    }
  }
  if (mode === 'stills' || mode === 'all') {
    const stills = [
      ['still-closed-threequarter.png', 0, 0.55, 0.34],
      ['still-closed-front.png', 0, 0.0, 0.22],
      ['still-lid-rising.png', 1.0, 0.45, 0.33],
      ['still-panel-rising.png', 2.0, 0.4, 0.33],
      ['still-open-threequarter.png', 3, 0.32, 0.42],
      ['still-open-front.png', 3, 0.0, 0.3],
      ['still-hyper-threequarter.png', 4, 0.3, 0.36],
      ['still-hyper-wide-left.png', 4, -0.5, 0.3],
      ['still-detail-controls.png', 3, 0.2, 0.72, 0.5, 0.15],
      ['still-detail-keys.png', 3, 0.05, 0.5, 0.55, -0.25],
      ['still-detail-speaker.png', 4, 0.95, 0.22, 0.55, 0],
    ];
    for (const s of stills) { await shot(s[0], s[1], s[2], s[3], s[4] || null, s[5] == null ? null : s[5]); meta.frames.push({ name: s[0], T: s[1], az: s[2], el: s[3], zoom: s[4] || null }); }
  }
  if (mode === 'film') {
    // Promotional film plan (24 fps). Each segment interpolates T, camera azimuth/elevation and zoom.
    const lerp = (a, b, u) => a + (b - a) * u, sm = (u) => u * u * (3 - 2 * u);
    const SEG = [
      { n: 72, T: [0, 0], az: [0.95, 0.6], el: [0.3, 0.34], z: [0.62, 0.66] },          // closed reveal
      { n: 192, T: [0, 4], az: [0.6, 0.2], el: [0.34, 0.33], z: [0.66, 1.0] },           // full transformation
      { n: 96, T: [4, 4], az: [0.2, -0.35], el: [0.33, 0.3], z: [1.0, 0.95] },           // hyper orbit
      { n: 72, T: [4, 4], az: [0.32, 0.12], el: [0.72, 0.7], z: [0.62, 0.48], ty: 0.15 }, // controls close-up
      { n: 60, T: [4, 4], az: [-0.1, 0.12], el: [0.5, 0.48], z: [0.6, 0.52], ty: -0.25 }, // keys close-up
      { n: 72, T: [4, 4], az: [0.95, 0.75], el: [0.22, 0.25], z: [0.6, 0.55], ty: 0 },   // speaker pod close-up
      { n: 72, T: [4, 4], az: [0.3, 0.3], el: [0.36, 0.36], z: [1.08, 1.08] },           // end hold
    ];
    let f = 0;
    for (const s of SEG) for (let i = 0; i < s.n; i++) {
      const u = sm(s.n === 1 ? 1 : i / (s.n - 1));
      const T = lerp(s.T[0], s.T[1], s.T[0] === s.T[1] ? 0 : (i / (s.n - 1)));
      const name = 'film-' + String(f++).padStart(4, '0') + '.jpg';
      await shot(name, T, lerp(s.az[0], s.az[1], u), lerp(s.el[0], s.el[1], u), lerp(s.z[0], s.z[1], u), s.ty == null ? null : s.ty);
      meta.frames.push({ name, T: +T.toFixed(4) });
    }
  }
  meta.pageErrors = errors;
  fs.writeFileSync(path.join(out, 'capture-manifest.json'), JSON.stringify(meta, null, 2));
  await browser.close();
  console.log('frames', meta.frames.length, 'errors', errors.length, errors.slice(0, 3).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
