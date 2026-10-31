import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = readFileSync(path.join(root, 'audio/y2k-service-worker.js'),'utf8');
const helper = readFileSync(path.join(root, 'audio/js/y2k-pwa-register.js'),'utf8');

function simulateWorker(request) {
  const handlers = {};
  const context = {
    self: { location: { origin: 'https://unfire.technology' }, addEventListener(name, handler) { handlers[name] = handler; } },
    URL,
    fetch(value) { return Promise.resolve({ ok: true, request: value }); }
  };
  vm.runInNewContext(worker, context, { timeout: 1000 });
  let response = null;
  handlers.fetch({ request, respondWith(value) { response = value; } });
  return response;
}

test('network-only worker intercepts only same-origin /audio/ document navigations', async () => {
  const yes = { method:'GET', mode:'navigate', url:'https://unfire.technology/audio/maletin/' };
  assert.equal((await simulateWorker(yes)).request, yes);
  const rejects = [
    { ...yes, mode:'cors' },
    { ...yes, method:'POST' },
    { ...yes, url:'https://unfire.technology/apps/' },
    { ...yes, url:'https://example.com/audio/' }
  ];
  for (const request of rejects) assert.equal(simulateWorker(request), null);
});

test('no caching, forced worker takeover or background tasks', () => {
  assert.doesNotMatch(worker, /\bcaches\s*\.|\bskipWaiting\s*\(|\bclients\.claim\s*\(|\bSyncManager\b/);
  assert.doesNotMatch(worker, /addEventListener\(\s*['"]push['"]/);
  assert.doesNotMatch(helper, /\bwindow\.location\s*=|\bwindow\.open\s*\(/);
  assert.match(helper, /window\.addEventListener\('load'/);
  assert.match(helper, /location\.hostname === 'unfire\.technology'/);
});

test('opt-in game registration registers only one scoped worker after load', async () => {
  const handlers = {};
  const regs = [];
  const context = {
    document: { readyState:'loading' },
    location: { protocol:'https:', hostname:'unfire.technology', pathname:'/audio/' },
    navigator: { serviceWorker: { register(url, options) { regs.push([url, options.scope]); return Promise.resolve(); } } },
    window: { addEventListener(name,fn) { handlers[name]=fn; } }
  };
  vm.runInNewContext(helper, context,{timeout:1000});
  assert.equal(regs.length,0);
  handlers.load();
  assert.deepEqual(regs,[['/audio/y2k-service-worker.js','/audio/']]);
});

test('registration is disabled on external origins and unrelated pages', () => {
  for (const location of [
    { protocol:'https:', hostname:'random.example', pathname:'/audio/' },
    { protocol:'https:', hostname:'unfire.technology', pathname:'/apps/' },
    { protocol:'http:', hostname:'unfire.technology', pathname:'/audio/' }
  ]) {
    let called = false;
    vm.runInNewContext(helper, {
      document:{ readyState:'complete' }, location,
      navigator:{serviceWorker:{register(){called=true;return Promise.resolve();}}},
      window:{addEventListener(){}}
    },{timeout:1000});
    assert.equal(called,false);
  }
});
