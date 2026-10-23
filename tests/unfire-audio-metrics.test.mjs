import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import collector from '../analytics/unfire-audio/worker.mjs';

const SESSION_ID = '0c8a7b17-c826-42f8-8c6e-b3ff897f9b34';
const ENDPOINT = 'https://metrics.example.workers.dev/v1/event';

function page(endpoint = ENDPOINT) {
  let consent = 'rejected';
  const calls = [];
  const window = {
    crypto: { randomUUID: () => SESSION_ID },
    localStorage: { getItem: () => consent },
    fetch: (url, options) => { calls.push({ url, options }); return Promise.resolve({ status: 202 }); }
  };
  const code = fs.readFileSync(new URL('../assets/js/unfire-audio-metrics.js', import.meta.url), 'utf8');
  vm.runInNewContext(code, { window, URL });
  const client = window.UnfireAudioMetrics.create({ endpoint });
  return { calls, client, consent: (value) => { consent = value; } };
}

test('no events before consent; no tracking by default', () => {
  const p = page();
  assert.equal(p.client.track('page_view'), false);
  assert.equal(p.calls.length, 0);
  assert.equal(p.client.isEnabled(), false);
});

test('allowlisted event only after consent, no PII or cookies', () => {
  const p = page();
  p.consent('accepted');
  assert.equal(p.client.track('game_enter', { once: true }), true);
  assert.equal(p.client.track('game_enter', { once: true }), false);
  assert.equal(p.client.track('unrestricted_admin_event'), false);
  assert.equal(p.calls.length, 1);
  assert.deepEqual(JSON.parse(p.calls[0].options.body), { event: 'game_enter', session: SESSION_ID });
  assert.equal(p.calls[0].options.credentials, 'omit');
  assert.equal(p.calls[0].options.keepalive, true);
});

test('missing, insecure or embedded-credentials endpoints never send', () => {
  for (const endpoint of ['', 'http://example.test/event', 'https://someone:password@example.test/event']) {
    const p = page(endpoint);
    p.consent('accepted');
    assert.equal(p.client.track('page_view'), false);
    assert.equal(p.calls.length, 0);
  }
});

test('revoking consent immediately stops event transmission', () => {
  const p = page();
  p.consent('accepted');
  assert.equal(p.client.track('page_view', { once: true }), true);
  p.consent('rejected');
  assert.equal(p.client.track('briefcase_open'), false);
  assert.equal(p.calls.length, 1);
});

function mockDB() {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      const entry = { sql, args: [] };
      statements.push(entry);
      return { bind(...args) { entry.args = args; return this; } };
    },
    async batch(items) {
      return items.map((_, i) => ({
        results: i === 0 ? [{ day: '2026-10-23', event: 'game_enter', total: 1 }] :
          [{ day: '2026-10-23', event: 'game_enter', tabs: 1 }]
      }));
    }
  };
}
function eventReq(origin, body) {
  return new Request('https://collector.example/v1/event', {
    method: 'POST', headers: { 'Origin': origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('denies off-origin requests and prevents exposed counters', async () => {
  const db = mockDB();
  const rejected = await collector.fetch(eventReq('https://evil.example', { event: 'game_enter', session: SESSION_ID }), { DB: db });
  assert.equal(rejected.status, 403);
  const stats = await collector.fetch(new Request('https://collector.example/admin/summary'), { DB: db, ADMIN_TOKEN: 'secret-local-test' });
  assert.equal(stats.status, 401);
  assert.equal(db.statements.length, 0);
});

test('valid events insert daily totals and tab dedupe', async () => {
  const db = mockDB();
  const response = await collector.fetch(eventReq('https://unfire.technology', { event: 'briefcase_open', session: SESSION_ID }), { DB: db });
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://unfire.technology');
  assert.equal(db.statements.length, 2);
  assert.equal(db.statements[0].args[1], 'briefcase_open');
  assert.equal(db.statements[1].args[2], SESSION_ID);
});

test('rejects unknown fields, payment events and invalid sessions', async () => {
  for (const bad of [
    { event: 'purchase_completed', session: SESSION_ID },
    { event: 'game_enter', session: 'john@example.com' },
    { event: 'game_enter', session: SESSION_ID, email: 'john@example.com' }
  ]) {
    const response = await collector.fetch(eventReq('https://unfire.technology', bad), { DB: mockDB() });
    assert.equal(response.status, 400);
  }
});

test('admin report requires a private token, labels tabs precisely', async () => {
  const db = mockDB();
  const response = await collector.fetch(new Request('https://collector.example/admin/summary', {
    headers: { 'Authorization': 'Bearer secret-local-test' }
  }), { DB: db, ADMIN_TOKEN: 'secret-local-test' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.period_days, 30);
  assert.match(body.note, /Not unique humans/);
  assert.equal(db.statements.length, 2);
});

test('scheduled retention removes IDs and aggregates after 35 days', async () => {
  const db = mockDB();
  await collector.scheduled({}, { DB: db });
  assert.equal(db.statements.length, 2);
  assert.match(db.statements[0].sql, /DELETE FROM daily_sessions/);
  assert.match(db.statements[1].sql, /DELETE FROM daily_counts/);
});

function bridgePage() {
  const { root, logs, setConsent, emitMessage, event, setClass } = (() => {
    let consent = 'rejected';
    const logs = [];
    const listeners = new Map();
    const frameWindow = {};
    const classNames = new Set();
    const classes = {
      contains: (name) => classNames.has(name)
    };
    const docListeners = new Map();
    const frame = { contentWindow: frameWindow };
    const pin = { classList: classes };
    const body = { classList: classes };
    const doc = {
      readyState: 'complete',
      body,
      getElementById(id) { return ({ malFrame: frame, heroPin: pin })[id] || null; },
      addEventListener(name, cb) { docListeners.set(name, cb); }
    };
    class FakeObserver {
      constructor(cb) { this.cb = cb; root._mutation = cb; }
      observe() {}
    }
    const root = {
      document: doc,
      crypto: { randomUUID: () => SESSION_ID },
      location: { origin: 'https://unfire.technology' },
      localStorage: { getItem: () => consent },
      fetch: (url, opts) => { logs.push(JSON.parse(opts.body)); return Promise.resolve({ ok: true }); },
      MutationObserver: FakeObserver,
      __UNFIRE_AUDIO_METRICS_ENDPOINT: ENDPOINT,
      addEventListener(name, cb) { listeners.set(name, cb); }
    };
    const run = name => vm.runInNewContext(
      fs.readFileSync(new URL(name, import.meta.url), 'utf8'),
      { window: root, URL }
    );
    run('../assets/js/unfire-audio-metrics.js');
    run('../assets/js/unfire-audio-metrics-bridge.js');
    return {
      root, logs,
      setConsent(v) { consent = v; },
      setClass(name, on) { if (on) classNames.add(name); else classNames.delete(name); root._mutation(); },
      emitMessage(data, overrides = {}) { listeners.get('message')({
        origin: 'https://unfire.technology', source: frameWindow, data, ...overrides
      }); },
      event(name, detail) { listeners.get(name)({ detail }); }
    };
  })();
  return { root, logs, setConsent, emitMessage, event, setClass };
}

test('bridge is inert until visitor consents', () => {
  const p = bridgePage();
  p.setClass('immOn', true);
  p.setClass('scene-ready', true);
  p.emitMessage({ unfire: 1, caseState: 'open' });
  assert.equal(p.logs.length, 0);
  p.setConsent('accepted');
  p.event('unfire:consent-updated');
  assert.deepEqual(p.logs.map(x => x.event), ['page_view', 'game_enter']);
});

test('bridge counts actual case-open signal only once, rejects forged frames', () => {
  const p = bridgePage();
  p.setConsent('accepted');
  p.event('unfire:consent-updated');
  p.emitMessage({ unfire: 1, caseState: 'open' }, { source: {} });
  p.emitMessage({ unfire: 1, caseState: 'open' }, { origin: 'https://malicious.example' });
  p.emitMessage({ unfire: 1, caseState: 'open' });
  p.emitMessage({ unfire: 1, caseState: 'open' });
  p.emitMessage({ unfire: 1, caseState: 'closed' });
  p.emitMessage({ unfire: 1, caseState: 'open' });
  assert.deepEqual(p.logs.map(x => x.event), ['page_view', 'briefcase_open', 'briefcase_open']);
});

test('bridge only accepts explicitly emitted confirmed actions (never payments)', () => {
  const p = bridgePage();
  p.setConsent('accepted');
  p.event('unfire:metrics', { event: 'match_start' });
  p.event('unfire:metrics', { event: 'checkout_click' });
  p.event('unfire:metrics', { event: 'purchase_completed' });
  assert.deepEqual(p.logs.map(x => x.event), ['match_start', 'checkout_click']);
});
