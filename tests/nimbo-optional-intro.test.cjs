'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'audio', 'maletin', 'index.html'), 'utf8');
const start = html.indexOf('window.STORY_INIT = function (H) {');
assert.ok(start > 0, 'STORY_INIT must exist');
const end = html.indexOf('</script>', start);
assert.ok(end > start, 'STORY_INIT script must close');
const story = html.slice(start, end);
new vm.Script(story, { filename: 'STORY_INIT' });
assert.match(story, /if \(!hostShown && st\.open && st\.far\) \{ hostShown = true; H\.showHost\(true\); \}/,
  'opening the case must only reveal the host, not launch a modal');
assert.doesNotMatch(story, /if \(!hostShown && st\.open && st\.far\) intro\(\)/,
  'automatic onboarding is forbidden');
assert.match(story, /id="mMeet"/, 'on-demand meeting must be available in History');
assert.match(story, /if \(!SAVE\.met\) \{ intro\(\); return; \}/,
  'opening a mission without meeting the guide first must offer the introduction');
assert.match(story, /const KEY = 'unfire_save_v1'/, 'save key must remain backward compatible');

class MockElement {
  constructor(id) {
    this.id = id || '';
    this.innerHTML = '';
    this.style = {};
    this.textContent = '';
    this.classList = { toggle() {}, add() {}, remove() {} };
    this.childrenBySelector = {};
  }
  querySelector(selector) {
    if (selector === '#mMeet' && this.id === 'storyMenu' && !this.innerHTML.includes('id="mMeet"')) return null;
    if (!this.childrenBySelector[selector]) this.childrenBySelector[selector] = new MockElement(selector);
    return this.childrenBySelector[selector];
  }
  querySelectorAll() { return []; }
  addEventListener() {}
  appendChild() {}
}
function simulate(saved) {
  const data = new Map();
  if (saved) data.set('unfire_save_v1', JSON.stringify(saved));
  const body = new MockElement('body'), head = new MockElement('head'), dom = new Map();
  const document = {
    body, head,
    createElement() { return new MockElement(); },
    getElementById(id) { return dom.get(id) || null; },
  };
  body.appendChild = (el) => { if (el.id) dom.set(el.id, el); };
  const window = {};
  const speechSynthesis = { getVoices() { return []; }, addEventListener() {}, cancel() {} };
  const ctx = {
    window, document, speechSynthesis, Date, Math, Set, JSON,
    localStorage: {
      getItem(k) { return data.has(k) ? data.get(k) : null; },
      setItem(k, v) { data.set(k, String(v)); },
    },
    setTimeout() { return 1; }, clearTimeout() {},
    setInterval() { return 1; }, clearInterval() {},
  };
  vm.runInNewContext(story, ctx);
  const calls = [];
  const guide = window.STORY_INIT({
    showHost(v) { calls.push(['host', v]); },
    say(msg) { calls.push(['say', msg]); },
    duck() {}, cinema() {}, focusHost() {},
    robotMode() { return false; }, toggleMap() {},
  });
  const hud = dom.get('storyHud'), menu = dom.get('storyMenu');
  assert.ok(hud && menu);
  guide.tick({ open: true, far: true });
  assert.equal(guide.active, false, 'entry never opens dialogue');
  assert.equal(hud.style.display, 'flex', 'History controls remain available');
  assert.deepEqual(calls, [['host', true]], 'no unsolicited speech or mission start');
  hud.querySelector('#stM').onclick();
  return { guide, hud, menu, calls, data, window };
}
const fresh = simulate();
assert.match(fresh.menu.innerHTML, /CONOCER A NIMBO/, 'new players can choose introduction later');
assert.equal(fresh.data.has('unfire_save_v1'), false, 'entry must not write a save');
fresh.menu.querySelector('#mMeet').onclick();
assert.equal(fresh.guide.active, true, 'manual action launches introduction');
assert.equal(fresh.menu.style.display, 'none', 'History menu closes for the dialogue');
assert.ok(fresh.calls.every(([type]) => type === 'host'), 'no unsolicited status messages');
const returning = simulate({ name: 'Player', level: 1, ch: 3, step: 1, done: [0, 1], met: true, ts: 11 });
assert.doesNotMatch(returning.menu.innerHTML, /id="mMeet"/, 'completed onboarding is not repeated');
assert.equal(returning.guide.save.ch, 3, 'chapter is preserved');
assert.equal(returning.guide.save.step, 1, 'step is preserved');
assert.equal(returning.guide.active, false, 'returning players enter without a modal');
console.log('NIMBO_OPTIONAL_INTRO_PASS: clean entry, optional guide, save compatibility');
