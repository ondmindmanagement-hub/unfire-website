import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function makeDOM() {
  let consent = null;
  const sent = [];
  function makeElement(tag) {
    const el = {
      tagName:tag.toUpperCase(), style:{cssText:''}, hidden:false,
      children:[], textContent:'', id:null,
      attrs:{}, handlers:{},
      appendChild(child) { this.children.push(child); return child; },
      setAttribute(n,v) { this.attrs[n] = v; },
      addEventListener(n,fn) { this.handlers[n] = fn; }
    };
    return el;
  }
  const body = makeElement('body');
  const doc = {
    readyState:'complete',documentElement:{lang:'es'},
    body,createElement:makeElement,
    getElementById(id) { const walk = x => x.id === id ? x : x.children.map(walk).find(Boolean); return walk(body); }
  };
  const window = {
    document: doc,
    localStorage: {
      getItem: () => consent,
      setItem: (_key,v) => { consent = v; }
    },
    dispatchEvent: event => sent.push(event.type),
    Event: class { constructor(type) { this.type = type; } }
  };
  vm.runInNewContext(
    fs.readFileSync(new URL('../assets/js/unfire-audio-metrics-consent.js',import.meta.url),'utf8'),
    {window}
  );
  const box = body.children[0], panel = box.children[0], manage = box.children[1];
  const actions = panel.children[3];
  const reject = actions.children[0], accept = actions.children[1];
  return {window,box,panel,manage,accept,reject,sent,getConsent:()=>consent};
}

test('first-visit consent is visible but sends nothing without an explicit choice', () => {
  const p=makeDOM();
  assert.equal(p.box.id,'unfire-audio-privacy');
  assert.equal(p.panel.hidden,false);
  assert.equal(p.manage.hidden,true);
  assert.equal(p.getConsent(),null);
  assert.deepEqual(p.sent,[]);
  assert.equal(p.panel.children[2].href,'/cookies.html');
});

test('explicit accept enables analytics and hides banner, while settings stay reachable', () => {
  const p=makeDOM();
  p.accept.handlers.click();
  assert.equal(p.getConsent(),'accepted');
  assert.equal(p.panel.hidden,true);
  assert.equal(p.manage.hidden,false);
  assert.deepEqual(p.sent,['unfire:consent-updated']);
  p.manage.handlers.click();
  assert.equal(p.panel.hidden,false);
});

test('reject and later revoke take effect immediately', () => {
  const p=makeDOM();
  p.reject.handlers.click();
  assert.equal(p.getConsent(),'rejected');
  p.manage.handlers.click();
  p.accept.handlers.click();
  assert.equal(p.getConsent(),'accepted');
  p.window.UnfireAudioConsent.revoke();
  assert.equal(p.getConsent(),'rejected');
  assert.equal(p.sent.length,3);
});
