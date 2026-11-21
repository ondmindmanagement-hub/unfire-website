'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../apps/index.html'), 'utf8');

function simulate() {
  const sections = Array.from(html.matchAll(/<section class="family"[\s\S]*?<\/section>/g), m => m[0]);
  const families = sections.map((section) => {
    const cards = Array.from(section.matchAll(/<article class="card" data-topics="([^"]+)" data-devices="([^"]+)">/g),
      m => ({dataset:{topics:m[1], devices:m[2]}, hidden:false}));
    return { cards, hidden:false, querySelectorAll(){ return cards; } };
  });
  const cards = families.flatMap(f => f.cards);
  const filterBlock = html.match(/<section class="catalog-tools"[\s\S]*?<\/section>/)?.[0] || '';
  const buttons = Array.from(filterBlock.matchAll(/<button\b[^>]*data-filter-kind="([^"]+)"[^>]*data-filter-value="([^"]+)"[^>]*>/g),m=>{
    const handlers = {};
    return {
      dataset:{filterKind:m[1],filterValue:m[2]}, handlers, attributes:{},
      classList:{toggle(name, value){ assert.equal(name,'is-active'); this.active=value; }},
      setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(event, fn){handlers[event]=fn;},
      click(){ handlers.click(); }
    };
  });
  const links = [ {handlers:{},addEventListener(event, fn){this.handlers[event]=fn;},click(){this.handlers.click();}} ];
  const status={textContent:''};
  const doc = {
    querySelector(q){
      if(q==='.catalog-tools')return {querySelectorAll(){return buttons;}};
      throw Error('unexpected selector '+q);
    },
    querySelectorAll(q){
      if(q==='.family .card[data-devices][data-topics]')return cards;
      if(q==='.family')return families;
      if(q===".subnav a[href^='#']")return links;
      throw Error('unexpected selector '+q);
    },
    getElementById(id){assert.equal(id,'catalog-count');return status;}
  };
  const script=html.match(/<script id="unfire-app-catalog-filters">([\s\S]*?)<\/script>/);
  assert.ok(script, 'filter script included');
  vm.runInNewContext(script[1],{document:doc},{timeout:2000});
  return {
    buttons, cards, families, status, links,
    select(kind,value){ const b=buttons.find(x=>x.dataset.filterKind===kind&&x.dataset.filterValue===value);assert.ok(b,kind+' '+value);b.click();return b; }
  };
}


function verifyFilter(s,topic,device){
  const visible=s.cards.filter(x=>!x.hidden);
  const expected=s.cards.filter(x=>(topic==='all'||x.dataset.topics.split(/\s+/).includes(topic))&&(device==='all'||x.dataset.devices.split(/\s+/).includes(device)));
  assert.equal(visible.length,expected.length,'incorrect number of filtered results');
  assert.deepEqual(visible.map(x=>x.dataset),expected.map(x=>x.dataset),'wrong cards visible');
  if(expected.length===0)assert.match(s.status.textContent,/No matching apps/);
  else assert.equal(s.status.textContent,'Showing '+expected.length+' of '+s.cards.length+' products');
}
test('catalogue cards remain categorized with real device labels',()=>{
  const s=simulate();
  assert.ok(s.cards.length>=11,'browser products must not displace existing apps');
  assert.equal(s.families.length,4);
  verifyFilter(s,'all','all');
  assert.ok(s.cards.every(x=>x.dataset.devices&&x.dataset.topics));
  assert.ok(s.cards.every(x=>!x.hidden),'all cards start visible');
});
test('independent topic + device filters with genuine no-results state',()=>{
  const s=simulate();
  s.select('topic','capture');
  verifyFilter(s,'capture','all');
  assert.equal(s.cards.filter(x=>!x.hidden).length,1);
  s.select('device','mac');
  verifyFilter(s,'capture','mac');
  assert.ok(s.families.every(x=>x.hidden));
  s.select('topic','developer');
  verifyFilter(s,'developer','mac');
  s.select('device','iphone');
  verifyFilter(s,'developer','iphone');
  s.select('topic','all');
  verifyFilter(s,'all','iphone');
  assert.equal(s.buttons.filter(x=>x.attributes['aria-pressed']==='true').length,2);
});
test('family anchor clears filters without leaving sections stranded',()=>{
  const s=simulate();
  s.select('topic','capture');
  s.select('device','mac');
  assert.ok(s.families.every(x=>x.hidden));
  s.links[0].click();
  assert.ok(s.families.every(x=>!x.hidden));
  verifyFilter(s,'all','all');
});
test('new web-app cards are honest and link to distinct browser experiments',()=>{
  for(const url of ['/apps/archer-web/','/portable-synth/studio/','/apps/ai-token-counter/'])
    assert.ok(html.includes('href="'+url+'"'),'missing browser utility '+url);
  assert.match(html,/not the full Android DAW/i);
  assert.match(html,/distinct from the native ARCHER plugin/i);
  assert.match(html,/not official model tokenization or live prices/i);
  assert.match(html,/data-topics="developer productivity utility" data-devices="mac iphone ipad web"/);
});
test('no stale review claims; links and accessibility present',()=>{
  assert.doesNotMatch(html,/App Store review in progress|Mac App Store review in progress/i);
  assert.match(html,/Development preview · not available for download/);
  assert.match(html,/role="group" aria-labelledby="device-filter-label"/);
  assert.match(html,/role="status" aria-live="polite"/);
  assert.match(html,/\.card\[hidden\],\.family\[hidden\]\{display:none!important\}/);
  assert.match(html,/https:\/\/apps\.apple\.com\/app\/id6812968924/);
  assert.match(html,/\/apps\/pocket-capture\//);
  assert.match(html,/\/apps\/unfire-control\//);
});

test('Pocket Capture listing verified in both catalogue and product details',()=>{
  const details=fs.readFileSync(path.join(__dirname,'../apps/pocket-capture/index.html'),'utf8');
  assert.match(html,/https:\/\/apps\.apple\.com\/app\/id6823107299/);
  assert.match(details,/https:\/\/apps\.apple\.com\/app\/id6823107299/);
  assert.doesNotMatch(details,/review in progress|still undergoing review/i);
  const guide=fs.readFileSync(path.join(__dirname,'../docs/app-store-categories-20261024.md'),'utf8');
  assert.match(guide,/6823107299/);
  assert.match(guide,/Public App Store verification/);
});


test('Power browser experiment is discoverable but separate from the native iPhone release',()=>{
  const native=fs.readFileSync(path.join(__dirname,'../apps/power/index.html'),'utf8');
  const browser=fs.readFileSync(path.join(__dirname,'../apps/power-web/index.html'),'utf8');
  const links=[...html.matchAll(/href="\/apps\/power-web\/"/g)];
  assert.equal(links.length,1,'one unambiguous catalogue link to Power Web');
  assert.match(html,/Power Web Lab/);
  assert.match(html,/No automatic live prices/i);
  assert.match(native,/apps\.apple\.com\/app\/id6815880143/);
  assert.match(native,/href="\/apps\/power-web\/"/);
  assert.match(native,/separate, experimental browser simulator/i);
  assert.match(browser,/noindex,nofollow/);
  assert.match(browser,/NO LIVE PRICES/);
  assert.match(browser,/connect-src 'none'/);
});

test('browser device filter reveals published browser utilities only',()=>{
  const state=simulate();
  state.select('device','web');
  verifyFilter(state,'all','web');
  assert.ok(state.cards.filter(card=>!card.hidden).length>=5);
  assert.ok(state.cards.filter(card=>!card.hidden).every(card=>card.dataset.devices.split(/\\s+/).includes('web')));
  state.select('topic','audio');
  verifyFilter(state,'audio','web');
  state.select('device','all');
  verifyFilter(state,'audio','all');
});
