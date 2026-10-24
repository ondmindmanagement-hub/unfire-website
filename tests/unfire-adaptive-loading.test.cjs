'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const paths=[
  'index.html','audio/index.html','audio/maletin/index.html',
  'about/index.html','apps/index.html','archer/index.html','bolt/index.html',
  'contact/index.html','education/index.html','enterprise/index.html',
  'pilot/index.html','early-access/index.html','support/index.html',
  'unfire-audio/index.html','ai4climate-power/index.html'
];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('assets/css/unfire-adaptive-loading.css');
const script=read('assets/js/unfire-adaptive-loading.js');
for(const p of paths){
  const html=read(p);
  assert.equal((html.match(/id="ufAdaptiveBoot"/g)||[]).length,1,p+': boot singleton');
  assert.equal((html.match(/id="ufAdaptiveLoader"/g)||[]).length,1,p+': overlay singleton');
  assert.equal((html.match(/unfire-adaptive-loading\.css\?v=/g)||[]).length,1,p+': stylesheet');
  assert.equal((html.match(/unfire-adaptive-loading\.js\?v=/g)||[]).length,1,p+': controller');
  assert(html.indexOf('id="ufAdaptiveLoader"')>html.toLowerCase().indexOf('<body'),p+': body overlay');
  assert(html.indexOf('id="ufAdaptiveBoot"')<html.toLowerCase().indexOf('</head>'),p+': early boot');
  assert(html.includes("classList.remove('uf-load-pending')"),p+': boot fallback');
}
assert(css.includes('pointer-events:none'),'Loading never captures taps');
assert(css.includes('prefers-reduced-motion:reduce'),'Reduced motion supported');
assert(!/\b(?:\d{1,3}%|progress\.value)\b/.test(script),'No fabricated progress');

function testBoot(coarse,memory,cores){
  const classes=new Set(), timers=[];
  const html=read('index.html');
  const boot=html.match(/<script id="ufAdaptiveBoot">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(boot,{
    matchMedia:()=>({matches:coarse}),navigator:{maxTouchPoints:coarse?5:0,deviceMemory:memory,hardwareConcurrency:cores},
    innerWidth:390,innerHeight:844,
    document:{documentElement:{classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}}},
    setTimeout:(fn,ms)=>timers.push({fn,ms})
  });
  assert(timers.some(t=>t.ms===9000),'Fallback exists');
  return {classes,timers};
}
assert(testBoot(true,2,4).classes.has('uf-load-pending'),'Low power phone');
assert(!testBoot(true,8,8).classes.has('uf-load-pending'),'Powerful tablet not gated');
assert(!testBoot(false,2,2).classes.has('uf-load-pending'),'Desktop never gated initially');

function simulate(pathname,low){
  let now=0,seq=0;
  const pending=new Map(),classes=new Set(low?['uf-load-pending']:[]);
  const docListeners={};
  const panel={dataset:{active:'false'},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
  const label={textContent:''};
  const root={lang:pathname==='/'?'en':'es',classList:{
    contains:k=>classes.has(k),remove:k=>classes.delete(k),add:k=>classes.add(k)}};
  const doc={documentElement:root,hidden:false,visibilityState:'visible',readyState:'loading',
    getElementById:id=>id==='ufAdaptiveLoader'?panel:id==='ufAdaptiveLabel'?label:null,
    addEventListener:(name,fn)=>{docListeners[name]=fn}};
  const win={addEventListener:()=>{},};
  const schedule=(fn,ms)=>{const id=++seq;pending.set(id,{fn,due:now+ms});return id};
  const cancel=id=>pending.delete(id);
  vm.runInNewContext(script,{window:win,document:doc,location:{pathname},performance:{now:()=>now},
    setTimeout:schedule,clearTimeout:cancel,setInterval:schedule,clearInterval:cancel,
    requestAnimationFrame:fn=>schedule(fn,16)});
  function nextBefore(limit){
    let best;
    for(const [id,t] of pending) if(t.due<=limit&&(!best||t.due<best.t.due))best={id,t};
    return best;
  }
  function progress(ms){const finish=now+ms;for(let n=0;n<200;n++){
    const next=nextBefore(finish);if(!next)break;now=next.t.due;pending.delete(next.id);next.t.fn();
  }now=finish;}
  function freeze(ms){now+=ms;const next=nextBefore(now);
    if(next){pending.delete(next.id);next.t.fn();}}
  return {win,panel,label,root,progress,freeze};
}
const embedded=simulate('/audio/maletin/index.html',false);
assert.equal(embedded.win.__UNFIRE_ADAPTIVE_LOADING.mode,'engine','Embedded iframe uses game mode');
const directAudio=simulate('/audio/index.html',false);
assert.equal(directAudio.win.__UNFIRE_ADAPTIVE_LOADING.mode,'audio','Explicit host index uses audio mode');
const pc=simulate('/',false);
assert.equal(pc.panel.dataset.active,'false','Desktop no initial load overlay');
pc.progress(4100);
pc.freeze(2500);
assert.equal(pc.panel.dataset.active,'true','Desktop prolonged jank shows recovery');
assert.equal(pc.panel.dataset.phase,'recovery');
pc.progress(2200);
assert.equal(pc.panel.dataset.active,'false','Recovery hides itself');
const phone=simulate('/',true);
assert.equal(phone.panel.dataset.active,'true','Low-power phone starts with load overlay');
phone.progress(4200);
assert.equal(phone.panel.dataset.active,'false','Initial overlay cannot remain indefinitely');
console.log('ADAPTIVE_LOADER_TESTS_PASS: markup 15 pages, classifier, fallback, desktop jank recovery, automatic dismiss');
