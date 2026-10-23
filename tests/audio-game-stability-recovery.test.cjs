'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../audio/game-stability-recovery.js'), 'utf8');

function harness({hidden = false, immersive = true, ready = true, frames = 1} = {}) {
  const handlers = new Map();
  const nodes = [];
  const classes = new Set([...(immersive ? ['imm'] : []), ...(ready ? ['scene-ready'] : [])]);
  const listeners = (name, fn) => {const a = handlers.get(name) || []; a.push(fn); handlers.set(name, a);};
  const elem = tag => ({
    tag, style: {}, children: [], disabled: false, id: '',
    setAttribute() {},
    addEventListener(type, fn) {this['on' + type] = fn;},
    appendChild(child) {this.children.push(child); this.firstChild = this.children[0]; this.lastChild = this.children[this.children.length - 1];},
  });
  const frame = {src: '/audio/maletin/index.html', contentWindow: {__perf: {f: frames}}, addEventListener: listeners};
  const pin = {classList: {contains(x) {return classes.has(x);}}};
  const document = {
    hidden, body: {appendChild(node) {nodes.push(node);}},
    getElementById(id) {return id === 'malFrame' ? frame : id === 'heroPin' ? pin : null;},
    createElement: elem, addEventListener: listeners,
  };
  const started = [];
  const intervals = [];
  let time = 1000;
  vm.runInNewContext(source, {
    document, performance: {now: () => time}, setInterval(fn, ms) {intervals.push({fn, ms});},
    addEventListener: listeners,
    UNFIRE_SCENE: {start(force) {started.push(force);}},
    console,
  });
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].ms, 2500);
  const advance = (ms=2500) => {time += ms; intervals[0].fn();};
  const emit = (event) => {for (const fn of handlers.get(event) || []) fn();};
  return {advance, emit, frame, classes, document, nodes, started};
}
test('does not warn while navigation is non-immersive or scene unready', () => {
  const h = harness({immersive:false});
  for (let i=0; i<30; i++) h.advance();
  assert.equal(h.nodes.length, 0);
  h.classes.add('imm'); h.classes.delete('scene-ready');
  for (let i=0; i<30; i++) h.advance();
  assert.equal(h.nodes.length, 0);
});
test('busy but advancing frames never triggers a stall recovery', () => {
  const h=harness();
  for (let i=0; i<40; i++) {h.frame.contentWindow.__perf.f++; h.advance();}
  assert.equal(h.nodes.length,0);
});
test('genuinely stopped rendering reveals a user-controlled compact recovery', () => {
  const h=harness();
  for (let i=0; i<10; i++) h.advance();
  assert.equal(h.nodes.length,1);
  const panel=h.nodes[0];
  assert.equal(panel.id,'unfireStallRecovery');
  assert.equal(panel.style.display,'block');
  assert.match(panel.firstChild.textContent,/Es posible que se reinicie/);
  assert.equal(h.started.length,0,'Must NOT restart without permission');
  panel.lastChild.onclick();
  assert.deepEqual(h.started,[true]);
  assert.equal(panel.style.display,'none');
});
test('visibility suspension does not become a fake 30s hang', () => {
  const h=harness();
  h.advance();
  h.document.hidden=true; h.emit('visibilitychange');
  for(let i=0;i<20;i++)h.advance();
  assert.equal(h.nodes.length,0);
  h.document.hidden=false;
  h.frame.contentWindow.__perf.f=4;
  h.advance();
  assert.equal(h.nodes.length,0);
});
test('temporarily unobservable renderer becomes recoverable without throwing', () => {
  const h=harness();
  h.frame.contentWindow=null;
  for(let i=0;i<12;i++)h.advance();
  assert.equal(h.nodes.length,1);
});
test('actual frame progress hides a warning again without a reload', () => {
  const h=harness();
  for(let i=0;i<10;i++)h.advance();
  assert.equal(h.nodes[0].style.display,'block');
  h.frame.contentWindow.__perf.f+=3;
  h.advance();
  assert.equal(h.nodes[0].style.display,'none');
  assert.equal(h.started.length,0);
});
test('a load event or page lifecycle resets a pending warning', () => {
  const h=harness();
  for(let i=0;i<10;i++)h.advance();
  h.emit('load');
  assert.equal(h.nodes[0].style.display,'none');
  h.emit('pagehide');
  assert.equal(h.started.length,0);
});
test('caps interactive recovery attempts and never creates automatic reload loops', () => {
  const h=harness();
  for(let i=0;i<10;i++)h.advance();
  const panel=h.nodes[0];
  panel.lastChild.onclick();
  for(let i=0;i<10;i++)h.advance();
  panel.lastChild.onclick();
  for(let i=0;i<10;i++)h.advance();
  assert.deepEqual(h.started,[true,true]);
  assert.equal(panel.lastChild.disabled,true);
  assert.equal(panel.lastChild.style.display,'none');
});
test('host includes the guard after the game loader, with no engine edit',()=>{
  const html=fs.readFileSync(path.join(__dirname, '../audio/index.html'),'utf8');
  assert.match(html,/<script src="game-stability-recovery.js\?v=20261023stallguard1"><\/script>/);
  assert.ok(html.indexOf('const UNFIRE_SCENE=') < html.indexOf('src="game-stability-recovery.js'));
});
