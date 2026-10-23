'use strict';
// Same-runner diagnostic comparison only. Software WebGL is NOT physical iPhone FPS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const baseline = process.env.UNFIRE_BENCH_BASELINE;
const candidate = process.env.UNFIRE_BENCH_CANDIDATE || path.resolve(__dirname, '..');
const outFile = process.env.UNFIRE_BENCH_OUT || path.resolve('exterior-benchmark.json');
assert(baseline && fs.existsSync(baseline), 'UNFIRE_BENCH_BASELINE must point to an extracted reference checkout');
const cases = [
  { name: 'baseline-1', root: baseline, port: 8765 },
  { name: 'candidate', root: candidate, port: 8766 },
  { name: 'baseline-2', root: baseline, port: 8765 }
];
const servers = [];
let browser = null;
const samples = [];

const percentile = (values, portion) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return Math.round(ordered[Math.min(ordered.length - 1, Math.ceil(portion * ordered.length) - 1)] * 10) / 10;
};

async function compare(spec) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true
  });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 250)));
    const since = Date.now();
    await page.goto('http://127.0.0.1:' + spec.port + '/audio/maletin/?quality=compact', {
      waitUntil: 'domcontentloaded', timeout: 35000
    });
    await page.waitForFunction(() => Boolean(
      window.__mal && window.__mal.S && window.__mal.S.renderer &&
      window.__roamAPI && window.__DOME
    ), null, { timeout: 75000, polling: 400 });
    await page.evaluate(() => {
      window.__roamAPI.enterRoam();
      const r = window.__roamAPI.ROAMS;
      r.p.set(0, 4.5, 40); r.h = 43; r.flyH = 43; r.vy = 0; r.fly = true;
      window.__DOME.open = 1;
    });
    await page.waitForFunction(() => window.ATM_OUT === true, null, { timeout: 45000, polling: 100 });
    await page.evaluate(() => {
      const r = window.__roamAPI.ROAMS;
      r.p.set(-35, 4.5, 130); r.h = 25; r.flyH = 25; r.vy = 0; r.fly = true; r.k = {};
      const renderer = window.__mal.S.renderer;
      const original = renderer.render;
      let recording = false, before = 0, started = 0, startingEngineFrames = 0;
      let gaps = [], renderCpu = [];
      renderer.render = function(...args) {
        const enter = performance.now();
        try { return original.apply(this, args); }
        finally {
          const end = performance.now();
          if (recording) {
            if (before) gaps.push(end - before);
            before = end;
            renderCpu.push(end - enter);
          }
        }
      };
      window.__UNFIRE_AB_BENCH = {
        start() { recording = true; started = performance.now(); startingEngineFrames = window.__perf?.f || 0; before = 0; gaps = []; renderCpu = []; },
        stop() {
          recording = false;
          const elapsed = performance.now() - started;
          const snapshot = {
            outdoors: Boolean(window.ATM_OUT),
            compact: window.__UNFIRE_AUTOCALIB?.tier,
            measuredMs: Math.round(elapsed),
            primaryRenderCalls: renderCpu.length,
            engineFrames: Math.max(0, (window.__perf?.f || 0) - startingEngineFrames),
            renderCallsPerSecond: +(renderCpu.length * 1000 / elapsed).toFixed(2),
            engineFps: +((Math.max(0, (window.__perf?.f || 0) - startingEngineFrames) * 1000) / elapsed).toFixed(2),
            renderGapP50Ms: null, renderGapP95Ms: null, renderGapP99Ms: null,
            renderCpuP95Ms: null, longGapsOver100Ms: gaps.filter(n => n > 100).length,
            engineBudget: Object.assign({}, window.__perf || {}),
            callsPerFrame: renderer.info?.render?.calls ?? null,
            trianglesLastFrame: renderer.info?.render?.triangles ?? null,
            gaps, renderCpu
          };
          return snapshot;
        }
      };
    });
    // Avoid counting shader compilation and the first exterior collision batches.
    await page.waitForTimeout(2300);
    await page.evaluate(() => window.__UNFIRE_AB_BENCH.start());
    await page.waitForTimeout(7300);
    const raw = await page.evaluate(() => window.__UNFIRE_AB_BENCH.stop());
    assert.equal(raw.outdoors, true, 'World must remain outdoors for the entire sample');
    const item = {
      case: spec.name, viewport: '390x844 (touch emulation, quality=compact)',
      loadAndPrepareMs: Date.now() - since - raw.measuredMs,
      sampleMs: raw.measuredMs,
      frames: raw.primaryRenderCalls,
      engineFrames: raw.engineFrames,
      engineFps: raw.engineFps,
      renderCallsPerSecond: raw.renderCallsPerSecond,
      gapP50Ms: percentile(raw.gaps, .50),
      gapP95Ms: percentile(raw.gaps, .95),
      gapP99Ms: percentile(raw.gaps, .99),
      cpuRenderP95Ms: percentile(raw.renderCpu, .95),
      stallsOver100Ms: raw.longGapsOver100Ms,
      triangleCountLastFrame: raw.trianglesLastFrame,
      drawCallsLastFrame: raw.callsPerFrame,
      activeQuality: raw.compact,
      adaptive: raw.engineBudget,
      errors
    };
    samples.push(item);
    console.log('EXTERIOR_AB_SAMPLE ' + JSON.stringify(item));
  } finally {
    await context.close();
  }
}

(async () => {
  try {
    for (const [root, port] of [[baseline, 8765], [candidate, 8766]]) {
      const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
        cwd: root, stdio: 'ignore'
      });
      servers.push(p);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    browser = await chromium.launch({
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
        '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
    });
    for (const item of cases) await compare(item);
    const baselineFps = (samples[0].engineFps + samples[2].engineFps) / 2;
    const candidateFps = samples[1].engineFps;
    const drift = Math.abs(samples[0].engineFps - samples[2].engineFps) / Math.max(baselineFps, 0.001);
    const result = {
      interpretation: 'Comparison is DESCRIPTIVE in Linux CI software WebGL; not physical iPhone FPS or a release gate.',
      baselineCommit: 'b122143a3d3533c7e6f68579c5361681d9fe3ccd',
      candidateCommit: process.env.GITHUB_SHA || 'local',
      baselineAverageRenderFps: +baselineFps.toFixed(2),
      candidateRenderFps: candidateFps,
      estimatedRelativeChangePercent: +((candidateFps / baselineFps - 1) * 100).toFixed(1),
      baselineDriftPercent: +(drift * 100).toFixed(1),
      comparisonStable: drift <= .25 && samples.every(s => s.engineFrames >= 20),
      results: samples
    };
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
    console.log('EXTERIOR_AB_RESULT ' + JSON.stringify({
      baselineFps: result.baselineAverageRenderFps, candidateFps,
      relativePercent: result.estimatedRelativeChangePercent,
      baselineDriftPercent: result.baselineDriftPercent,
      stable: result.comparisonStable
    }));
    if (!result.comparisonStable) console.log('EXTERIOR_AB_CAUTION: high drift or insufficient frames; do not infer performance improvements.');
  } catch (error) {
    console.error('EXTERIOR_AB_ERROR', error.stack || error);
    fs.writeFileSync(outFile, JSON.stringify({ error: String(error), results: samples }, null, 2) + '\n');
    process.exitCode = 1;
  } finally {
    try { if (browser) await browser.close(); } catch (_) {}
    for (const p of servers) { try { p.kill('SIGTERM'); } catch (_) {} }
    await Promise.all(servers.map(p => Promise.race([
      new Promise(resolve => p.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 400))
    ])));
  }
})();
