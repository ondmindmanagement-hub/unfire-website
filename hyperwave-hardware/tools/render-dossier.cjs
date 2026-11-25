#!/usr/bin/env node
/* Renders hyperwave-hardware/dossier/dossier.html to PDF (A4 landscape) and per-page PNG previews.
 * Usage: node render-dossier.cjs <baseUrl> <pdfOut> <previewDir> */
const fs = require('fs'), path = require('path');
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const base = process.argv[2], pdf = path.resolve(process.argv[3]), prev = path.resolve(process.argv[4]);
(async () => {
  fs.mkdirSync(prev, { recursive: true });
  const b = await pc.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1123, height: 794, deviceScaleFactor: 1 });
  await p.goto(base + '/hyperwave-hardware/dossier/dossier.html', { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  const n = await p.$$eval('section.pg', (s) => s.length);
  const els = await p.$$('section.pg');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(prev, 'page-' + String(i + 1).padStart(2, '0') + '.png') });
  const overflow = await p.$$eval('section.pg', (s) => s.map((e, i) => { const r = e.getBoundingClientRect(); let worst = 0; e.querySelectorAll('*').forEach((c) => { const q = c.getBoundingClientRect(); if (q.height && q.bottom - r.bottom > worst) worst = q.bottom - r.bottom; }); return [i + 1, Math.round(worst)]; }).filter((x) => x[1] > 1));
  await p.pdf({ path: pdf, width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log('pages', n, 'overflowing', JSON.stringify(overflow));
})().catch((e) => { console.error(e); process.exit(1); });
