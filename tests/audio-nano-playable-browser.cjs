'use strict';
// Full in-browser game interaction on an isolated Chromium phone viewport.
// Unlike node/DOM mocks, the actual WebGL engine, HUD and player logic run.
// This is simulated touch QA, NOT proof of an iPhone/iPad/Android physical test.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');
const PORT = Number(process.env.UNFIRE_NANO_QA_PORT || 8798);
const HOST = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: path.join(__dirname, '..'), stdio: 'ignore'
  });
  let browser;
  try {
    await sleep(850);
    browser = await chromium.launch({
      headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
      viewport: {width: 390, height: 844}, hasTouch: true,
      isMobile: true, deviceScaleFactor: 1
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(String(err.message).slice(0, 200)));
      await page.goto(HOST + '/audio/maletin/index.html?quality=compact', {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await page.waitForFunction(
        () => !!(window.__mal?.S && window.__roamAPI && window.__UNFIRE_CASE_QA?.originalButterfly),
        null, {timeout: 90000, polling: 250}
      );
      assert.equal(errors.length, 0, 'Engine boot error: ' + errors.join('; '));
      console.log('NANO_REAL_ENGINE_READY');

      // First-opening hit-testing is separately verified by the existing 6-profile CI.
      // Set lid directly here so the test measures *actual* roaming and HUD interaction.
      await page.evaluate(() => window.__mal.setP(1));
      await page.waitForFunction(() => {
        const b = document.getElementById('roamB');
        return !!b && b.style.display === 'block'
          && window.__UNFIRE_CASE_QA.lid >= .998;
      }, null, {timeout: 30000, polling: 150});
      // Record input events only in browser QA to identify a lost first tap.
      await page.evaluate(() => {
        window.__unfireQaTapEvents = [];
        const b = document.getElementById('roamB');
        for (const type of ['pointerdown', 'pointerup', 'click']) {
          b.addEventListener(type, () => window.__unfireQaTapEvents.push(type), {capture: true});
        }
      });
      await page.locator('#roamB').tap({timeout: 25000});
      // The software-GPU runner may starve Playwright's polling even after the tap worked.
      const entered=await page.evaluate(() => !!window.__UNFIRE_CASE_QA.roam);
      try {
        if (!entered) await page.waitForFunction(() => window.__UNFIRE_CASE_QA.roam, null, {
          timeout: 20000, polling: 100
        });
      } catch (error) {
        const diagnostic = await page.evaluate(() => {
          const b = document.getElementById('roamB');
          const r = b.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            events: window.__unfireQaTapEvents, roam: window.__UNFIRE_CASE_QA.roam,
            closed: window.__UNFIRE_CASE_QA.closed, lid: window.__UNFIRE_CASE_QA.lid,
            visible: getComputedStyle(b).display, topId: top?.id, topTag: top?.tagName,
            bodyClass: document.body.className
          };
        });
        console.error('NANO_FIRST_WALK_DIAGNOSTIC', JSON.stringify(diagnostic));
        // Only fail for a real unentered world; a successful state after RAF timeout
        // is still subject to the subsequent movement, mini-scale and UI assertions.
        if (!diagnostic.roam) throw error;
      }
      const before = await page.evaluate(() => ({
        pos: window.__UNFIRE_CASE_QA.playerPos,
        nano: window.__roamAPI.ROAMS.mini
      }));
      assert.equal(!!before.nano, false, 'Player initially starts in normal scale');
      await page.locator('#cfgB').waitFor({state: 'visible', timeout: 30000});
      await page.locator('#cfgB').tap({timeout: 15000});
      await page.locator('#stR').waitFor({state: 'visible', timeout: 10000});
      await page.locator('#stR').tap({timeout: 15000});
      await page.waitForFunction(() => window.__roamAPI.ROAMS.mini, null, {
        timeout: 20000, polling: 150
      });
      await page.waitForFunction(() => {
        const a = window.__roamAPI.ROAMS.av;
        return !!(a?.w && a.baseScale && a.w.scale.x / a.baseScale > 0.02 && a.w.scale.x / a.baseScale < 0.025);
      }, null, {timeout: 20000, polling: 150});
      const mini = await page.evaluate(() => {
        const r = window.__roamAPI.ROAMS;
        const a = r.av;
        return {
          nano: r.mini,
          relativeHeight: a.w.scale.x / a.baseScale,
          pos: window.__UNFIRE_CASE_QA.playerPos,
          pressed: document.getElementById('stR').getAttribute('aria-pressed'),
          label: document.getElementById('stR').textContent
        };
      });
      assert(mini.nano && mini.relativeHeight > .02 && mini.relativeHeight < .025,
        'Actual 3D player must match 0.24 / 10.5 miniature height: ' + JSON.stringify(mini));
      assert.equal(mini.pressed, 'true', 'Nano button must describe active state');
      assert(/TAMAÑO NORMAL|NORMAL SIZE/i.test(mini.label), 'Button must show how to return to normal size (ES/EN): ' + JSON.stringify(mini));
      assert(Math.hypot(mini.pos[0] - before.pos[0], mini.pos[2] - before.pos[2]) < .1,
        'Changing scale must not teleport the player');
      console.log('NANO_TOGGLE_PASS', JSON.stringify(mini));

      // The large map is a real 2D overlay over the *same* paused game, not
      // a second WebGL renderer or a separate app.
      await page.waitForFunction(() => !document.getElementById('storyHud').classList.contains('cfgOn'),
        null, {timeout: 6000});
      await page.locator('#minimap').tap({timeout: 15000});
      await page.locator('#ufMapCanvas').waitFor({state: 'visible', timeout: 15000});
      const map = await page.evaluate(() => ({
        open: !document.getElementById('unfireExpandedMap').hidden,
        zone: document.getElementById('ufMapBadge').textContent,
        canvasWidth: document.getElementById('ufMapCanvas').width,
        count: document.querySelectorAll('#ufMapCanvas').length,
        nano: window.__roamAPI.ROAMS.mini
      }));
      assert(map.open && map.nano && map.count === 1 && map.canvasWidth > 0,
        'Nano world map must remain usable: ' + JSON.stringify(map));
      assert(/CASA|HOUSE/i.test(map.zone), 'Nano player must be mapped to the real house, not the table: ' + JSON.stringify(map));
      await page.locator('#ufMapClose').tap({timeout: 15000});
      assert.equal(await page.evaluate(() => document.getElementById('unfireExpandedMap').hidden), true);
      console.log('NANO_WORLD_MAP_PASS', JSON.stringify(map));

      // Offline currency is optional and must not require real money.
      await page.locator('#unfireCoinHud').waitFor({state: 'visible', timeout: 18000});
      await page.locator('#unfireCoinHud').tap({timeout: 15000});
      await page.locator('#unfireCoinShop.open').waitFor({state: 'visible', timeout: 10000});
      const shopText = await page.locator('#unfireCoinShop').innerText();
      assert(/No cuesta dinero|free|does not cost money/i.test(shopText), 'Currency is free and earned in the game');
      await page.locator('#unfireCoinShop [data-close]').tap({timeout: 10000});
      console.log('NANO_COIN_SHOP_PASS');

      // History is accessible without giving a name or meeting Nimbo first.
      await page.locator('#cfgB').tap({timeout: 15000});
      await page.locator('#stM').tap({timeout: 15000});
      await page.locator('#storyMenu').waitFor({state: 'visible', timeout: 12000});
      assert.equal(await page.locator('#mPlay').count(), 1,
        'Start story is visible before the guide introduction');
      assert.equal(await page.locator('#mMeet').count(), 1,
        'Meeting Nimbo remains optional and can be done later');
      assert.equal(await page.evaluate(() => JSON.parse(
        localStorage.getItem('unfire_save_v1') || '{"name":"","met":false}'
      ).met), false, 'Opening history does not force Nimbo onboarding');
      await page.locator('#mX').tap({timeout: 12000});
      await page.locator('#storyMenu').waitFor({state: 'hidden', timeout: 12000});
      console.log('NANO_OPTIONAL_STORY_PASS');

      // Settings may remain open after the story dialog closes. Do not toggle it
      // closed just before trying the Nano return control on a touch device.
      if (!(await page.locator('#stR').isVisible())) {
        await page.locator('#cfgB').tap({timeout: 12000});
      }
      await page.locator('#stR').tap({timeout: 12000});
      await page.waitForFunction(() => !window.__roamAPI.ROAMS.mini, null,
        {timeout: 15000, polling: 100});
      await page.waitForFunction(() => {
        const a = window.__roamAPI.ROAMS.av;
        return !!(a?.baseScale && Math.abs(a.w.scale.x / a.baseScale - 1) < .001);
      }, null, {timeout: 25000, polling: 150});
      assert.equal(await page.locator('#stR').getAttribute('aria-pressed'), 'false');
      assert.equal(errors.length, 0, 'Uncaught game errors: ' + errors.join('; '));
      console.log('NANO_NORMAL_RETURN_PASS');
      console.log('AUDIO_NANO_REAL_BROWSER_PASS: playable scale, controls, map, offline shop, optional story');
    } finally { await context.close(); }
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
})().catch(err => { console.error('AUDIO_NANO_REAL_BROWSER_FAIL', err.stack || err); process.exitCode = 1; });
