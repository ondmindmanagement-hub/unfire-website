'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(ROOT, 'audio/maletin/unfire-local-sw.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(ROOT, 'audio/maletin/unfire-local-bootstrap.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'audio/maletin/index.html'), 'utf8');
test('non-blocking registration is scoped to the game and ships in the game HTML', () => {
  assert.match(bootstrap, /requestIdleCallback/);
  assert.match(bootstrap, /serviceWorker\.register\('\.\/unfire-local-sw\.js'/);
  assert.match(html, /unfire-local-bootstrap\.js\?v=20261024v1/);
  assert.doesNotMatch(bootstrap, /getUserMedia|exec\(|child_process|location\.reload/);
});
test('worker never caches other origins, game online/P2P, requests with range or credentials', () => {
  assert.match(worker, /request\.method !== 'GET'/);
  assert.match(worker, /request\.headers\.has\('Range'\)/);
  assert.match(worker, /request\.headers\.has\('Authorization'\)/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /MAX_ASSETS = 48/);
  assert.match(worker, /MAX_BYTES_PER_ASSET = 1024 \* 1024/);
  assert.doesNotMatch(worker, /\.mp3\||\.wav\||\.ogg\||\.mp4\|/);
});
test('SW fetch events keep dynamic or cross-origin requests on normal network path', () => {
  const handlers = {};
  const fakeSelf = {
    registration: {scope: 'https://unfire.technology/audio/maletin/'},
    location: {origin: 'https://unfire.technology'},
    addEventListener(name, cb) { handlers[name] = cb; }
  };
  vm.runInNewContext(worker, {
    self: fakeSelf, URL, Set, Response, caches: {open() {throw Error('not used');}},
    fetch() {throw Error('not used');}
  }, {filename: 'unfire-local-sw.js'});
  function intercepted(url, mode='cors', method='GET', headers={}) {
    let handled = false;
    handlers.fetch({
      request: {url, mode, method, headers: {has(key) {return Boolean(headers[key]);}}},
      respondWith() {handled = true;}
    });
    return handled;
  }
  assert.equal(intercepted('https://peerjs.com/peer'), false);
  assert.equal(intercepted('https://unfire.technology/audio/maletin/multiplayer.json'), false);
  assert.equal(intercepted('https://unfire.technology/audio/maletin/record.mp3'), false);
  assert.equal(intercepted('https://unfire.technology/audio/maletin/game-engine-v50.js?session=abc'), false);
  assert.equal(intercepted('https://unfire.technology/audio/maletin/game-engine-v50.js','cors','GET',{Range:true}), false);
  assert.equal(intercepted('https://unfire.technology/audio/maletin/game-engine-v50.js?v=1'), true);
  assert.equal(intercepted('https://unfire.technology/audio/maletin/index.html','navigate'), true);
  assert.equal(intercepted('https://unfire.technology/audio/legal/','navigate'), false);
});
