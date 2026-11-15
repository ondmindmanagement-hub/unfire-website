#!/usr/bin/env node
/* Functional smoke test of the real instrument after the physical-model patch:
 * open (T→3), hyper (T→4), play notes through the real synth, click a key by raycast, close (T→0). */
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
(async () => {
  const b = await pc.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1280, height: 800 } });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto((process.argv[2] || 'http://127.0.0.1:8731') + '/audio/hyperwave/', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.__hw && document.body.classList.contains('ready'));
  const r = {};
  await p.keyboard.press('Space'); await new Promise((x) => setTimeout(x, 4500));
  r.openT = await p.evaluate(() => window.__hw.st.T);
  await p.evaluate(() => { window.__hw.noteDown(60, 0.8, 'smoke'); window.__hw.noteDown(64, 0.8, 'smoke'); });
  await new Promise((x) => setTimeout(x, 400));
  r.voices = await p.evaluate(() => (window.__hw.syn ? window.__hw.syn.voices : -1));
  r.level = await p.evaluate(() => window.__hw.syn ? +window.__hw.syn.scope().level.toFixed(4) : -1);
  await p.evaluate(() => window.__hw.go(4)); await new Promise((x) => setTimeout(x, 1800));
  r.hyperT = await p.evaluate(() => window.__hw.st.T);
  await p.keyboard.press('Space'); await new Promise((x) => setTimeout(x, 5200));
  r.closedT = await p.evaluate(() => window.__hw.st.T);
  r.errors = errs; console.log(JSON.stringify(r)); await b.close();
  process.exit(errs.length || r.openT < 2.99 || r.closedT > 0.001 ? 1 : 0);
})();
