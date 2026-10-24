'use strict';
// Diagnostic-only: one desktop Chromium context, no production code changes.
// Distinguishes click dispatch latency, event-loop stalls and polling timeout.
// A late-opened case is evidence, NOT a PASS; leave release CI gates intact.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = Number(process.env.UNFIRE_DESKTOP_TIMING_PORT || 8891);
const origin = 'http://127.0.0.1:' + port;
const now = () => new Date().toISOString();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const safeClose = (fn, ms = 5000) =>
  Promise.race([Promise.resolve().then(fn).then(() => true, () => false),
    pause(ms).then(() => false)]);

let server, browser, context, page, cdp, profileRunning = false;
const errors = [];
const milestone = (label, details = {}) => console.log('TRANSITION_TIMING',
  JSON.stringify({label, at:now(), ...details}));
(async () => {
  try {
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
      {cwd:path.resolve(__dirname, '..'), stdio:'ignore'});
    await pause(900);
    browser = await chromium.launch({headless:true,
      args:['--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--no-sandbox']});
    context = await browser.newContext({viewport:{width:1280,height:800},
      isMobile:false,hasTouch:false,deviceScaleFactor:1});
    page = await context.newPage();
    page.on('pageerror', err => errors.push(String(err.message).slice(0, 250)));
    // Capture Chrome long tasks from the first moment of top document AND iframe load.
    // Separate arrays are created in each same-origin frame by Playwright addInitScript.
    await page.addInitScript(() => {
      window.__unfireLongTasks = [];
      if (typeof PerformanceObserver === 'undefined') return;
      try {
        const po = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const arr = window.__unfireLongTasks;
            if (arr.length >= 160) arr.shift();
            arr.push({start:Math.round(entry.startTime), duration:Math.round(entry.duration)});
          }
        });
        po.observe({entryTypes:['longtask']});
      } catch (_) {}
    });
    // Diagnostic-only A/B: compact rendering uses the game's *existing* query
    // option. No product file or default quality setting is modified.
    if (process.env.UNFIRE_FORCE_COMPACT === '1') {
      await page.route('**/audio/maletin/index.html*', route => {
        const u = new URL(route.request().url());
        u.searchParams.set('quality','compact');
        return route.continue({url:u.toString()});
      });
      milestone('quality-override',{requested:'compact'});
    }
    milestone('goto:start');
    await page.goto(origin + '/audio/', {waitUntil:'domcontentloaded',timeout:30000});
    milestone('goto:done');
    await page.waitForFunction(() => {
      const f = document.getElementById('malFrame'), w = f?.contentWindow;
      return document.getElementById('heroPin')?.classList.contains('scene-ready') &&
        !!w?.__UNFIRE_CASE_QA && !!w?.__ringB && !!w?.__dbg?.S?.camera;
    }, null, {timeout:85000,polling:200});
    milestone('scene:ready');

    // Instrument host + same-origin game iframe. This lives only in the test process.
    const before = await page.evaluate(() => {
      const f = document.getElementById('malFrame'), w = f.contentWindow;
      const camera = w.__dbg.S.camera, ring = w.__ringB;
      ring.updateWorldMatrix(true,false);
      camera.updateMatrixWorld(true);
      const p = ring.getWorldPosition(ring.position.clone().set(0,0,0)).project(camera);
      const rect = f.getBoundingClientRect();
      const x = rect.x + (p.x + 1) * rect.width / 2;
      const y = rect.y + (1 - p.y) * rect.height / 2;
      const trace = {epoch:Date.now(), events:[], changes:[], heartbeats:0,
        rafCount:0, rafMaxGap:0, rafLast:0, stopped:false, timer:null};
      const get = () => {
        const q = w.__UNFIRE_CASE_QA;
        return {t:Math.round(performance.now()), immersive:document.body.classList.contains('immOn'),
          closed:q?.closed, caseVisible:q?.caseVisible, frameVisible:f.offsetWidth>0,
          frameTarget:document.elementFromPoint(x,y)?.id || null};
      };
      let key = null;
      function sample() {
        const s = get();
        const k = JSON.stringify([s.immersive,s.closed,s.caseVisible,s.frameTarget]);
        if (key!==k) { key=k; trace.changes.push(s); }
        trace.heartbeats++;
      }
      function raf(t) {
        if (trace.stopped) return;
        if (trace.rafLast) trace.rafMaxGap=Math.max(trace.rafMaxGap, t-trace.rafLast);
        trace.rafLast=t;trace.rafCount++;
        requestAnimationFrame(raf);
      }
      for(const type of ['pointerdown','pointerup','mousedown','mouseup','click']) {
        for (const [doc,source] of [[document,'host'],[w.document,'iframe']]) {
          doc.addEventListener(type, e => trace.events.push({
            source,type,t:Math.round(performance.now()),target:e.target?.id || e.target?.tagName,
            x:Math.round(e.clientX),y:Math.round(e.clientY)
          }),true);
        }
      }
      sample();
      trace.timer = setInterval(sample, 400);
      requestAnimationFrame(raf);
      window.__unfireDesktopTrace = trace;
      window.__unfireDesktopSnapshot = get;
      return {x,y,box:[rect.x,rect.y,rect.width,rect.height],
        actualTier:w.__UNFIRE_AUTOCALIB?.tier || 'unknown',
        closed:w.__UNFIRE_CASE_QA.closed,
        hostTarget:document.elementFromPoint(x,y)?.id,
        frameTarget:w.document.elementFromPoint(x-rect.left,y-rect.top)?.id};
    });
    milestone('before',before);
    assert.equal(before.actualTier,process.env.UNFIRE_FORCE_COMPACT === '1' ? 'compact':'desktop',
      'A/B experiment must use the requested actual engine quality tier');
    assert(before.closed === true,'Lid must begin closed');
    assert(before.x > 2 && before.x < 1278 && before.y > 2 && before.y < 798,
      '3D butterfly coordinates must be visible on desktop');
    assert.equal(before.hostTarget,'malFrame','Real click must hit game iframe');
    assert.equal(before.frameTarget,'cv','Real click must reach canvas');

    // Sample desktop main-thread JavaScript while clicking. This is diagnostic
    // only: sampling errors must not alter pass/fail of the original 25s contract.
    if (process.env.UNFIRE_ENABLE_CPU_PROFILE === '1') try {
      cdp = await context.newCDPSession(page);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval',{interval:2000});
      await cdp.send('Profiler.start');
      profileRunning = true;
    } catch (e) {
      milestone('profiler:unavailable',{reason:String(e.message).slice(0,150)});
    }
    const t0=Date.now();
    milestone('mouse-click:start',{cpuProfiler:profileRunning});
    await page.mouse.click(before.x,before.y);
    milestone('mouse-click:done',{clickAwaitMs:Date.now()-t0});

    let waitError = null;
    milestone('wait:start');
    try {
      await page.waitForFunction(() => {
        const f=document.getElementById('malFrame'),q=f?.contentWindow?.__UNFIRE_CASE_QA;
        return document.body.classList.contains('immOn') && !!q && !q.closed;
      },null,{timeout:25000,polling:100});
    } catch(e) {waitError=String(e.message);}
    milestone('wait:done',{waitError,elapsedMs:Date.now()-t0});
    const outcome = await page.evaluate(() => {
      const t=window.__unfireDesktopTrace, s=window.__unfireDesktopSnapshot();
      t.stopped=true; clearInterval(t.timer);
      return {state:s,events:t.events.slice(-20),changes:t.changes.slice(-30),
        heartbeatCount:t.heartbeats,rafCount:t.rafCount,
        rafMaxGapMs:Math.round(t.rafMaxGap), wallMs:Date.now()-t.epoch,
        // Separate browser performance observers; long tasks over 50ms each.
        longTasksHost:(window.__unfireLongTasks||[]).slice(-40),
        longTasksFrame:(document.getElementById('malFrame')?.contentWindow?.__unfireLongTasks||[]).slice(-40)};
    });
    if (profileRunning && cdp) {
      try {
        const {profile}=await cdp.send('Profiler.stop');
        profileRunning=false;
        const byId=new Map((profile.nodes||[]).map(node=>[node.id,node]));
        const weighted=new Map();
        let coveredMs=0;
        for (let i=0;i<(profile.samples||[]).length;i++) {
          const node=byId.get(profile.samples[i]);
          if(!node)continue;
          const dt=(profile.timeDeltas?.[i]||2000)/1000;
          coveredMs+=dt;
          const frame=node.callFrame||{};
          const key=(frame.functionName||'(anonymous)')+' @ '+(frame.url||'internal').split('/').slice(-2).join('/')+':'+(frame.lineNumber||0);
          weighted.set(key,(weighted.get(key)||0)+dt);
        }
        milestone('cpu-profile',{
          samples:profile.samples?.length||0,
          sampledMs:Math.round(coveredMs),
          topSelfMs:[...weighted.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15)
            .map(([functionName,ms])=>({functionName,ms:Math.round(ms)}))
        });
      } catch(e) {milestone('cpu-profile:error',{reason:String(e.message).slice(0,200)});}
    }
    const summarize = arr => ({count:arr.length, totalMs:arr.reduce((sum,x)=>sum+x.duration,0),
      longest:arr.slice().sort((a,b)=>b.duration-a.duration).slice(0,12)});
    milestone('longtasks',{host:summarize(outcome.longTasksHost),iframe:summarize(outcome.longTasksFrame)});
    delete outcome.longTasksHost;
    delete outcome.longTasksFrame;
    milestone('diagnostic', {outcome, errors});
    assert.equal(waitError,null,'Original 25s opening contract timed out: '+waitError);
    assert.equal(outcome.state.immersive,true,'Game must enter immersive state');
    assert.equal(outcome.state.closed,false,'Original lid must open');
    assert.equal(outcome.state.caseVisible,true,'Original case must remain visible');
    assert.equal(errors.length,0,'Browser JS errors: '+errors.join('; '));
    milestone('pass');
  } catch(e) {
    console.error('TRANSITION_TIMING_FAIL',e.stack||e);
    process.exitCode=1;
  } finally {
    if(profileRunning && cdp) try {await cdp.send('Profiler.stop');}catch(_){}
    if(context) await safeClose(() => context.close(),4000);
    if(browser) {
      const child=typeof browser.process==='function'?browser.process():null;
      const closed=await safeClose(() => browser.close(),4000);
      if(!closed && child && !child.killed) try {child.kill('SIGTERM')}catch(_){}
    }
    if(server && server.exitCode===null) server.kill('SIGTERM');
  }
})();
