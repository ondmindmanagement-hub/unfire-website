'use strict';
// Light-weight CSS geometry QA: no Three.js, WebGL, game download or CPU stress.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {chromium} = require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const index = readFileSync('audio/maletin/index.html','utf8').split('<canvas id="cv"')[0];
const css = [...index.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n') + '\n' +
 readFileSync('audio/maletin/mobile-hud-guard.css','utf8') + '\n' +
 readFileSync('audio/maletin/thumb-reach.css','utf8');
const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>
<body class="unfire-roaming"><div id="ctlDock" style="position:fixed;right:14px;top:110px;display:flex;flex-direction:column;gap:6px;z-index:40">
<button>ONLINE</button><button>MODO CINE</button><button>VISTA</button><button>VOLVER</button></div>
<div id="unfireTouchPad" style="position:fixed;left:18px;bottom:18px;width:130px;height:130px;display:block;z-index:70">
<div id="unfireTouchKnob" style="width:48px;height:48px"></div></div>
<button id="unfireFly" style="position:fixed;right:18px;bottom:24px;display:block;z-index:70">VOLAR</button>
<button id="unfireTalk" style="position:fixed;right:18px;bottom:90px;display:block;z-index:70">HABLAR</button>
<button id="unfireDown" style="position:fixed;right:150px;bottom:24px;display:block;z-index:70">BAJAR</button></body></html>`;
const specs=[
 {name:'small-phone-portrait',width:320,height:568},
 {name:'phone-portrait',width:390,height:844},
 {name:'phone-landscape',width:844,height:390},
 {name:'short-landscape',width:568,height:320},
 {name:'ipad-portrait',width:820,height:1180},
 {name:'ipad-landscape',width:1466,height:1024},
];
const intersects=(a,b)=> a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  for(const spec of specs){
   const context=await browser.newContext({isMobile:true,hasTouch:true,deviceScaleFactor:1,viewport:{width:spec.width,height:spec.height}});
   try{
    const page=await context.newPage();
    await page.setContent(fixture);
    await page.addStyleTag({content:css});
    const g=await page.evaluate(()=>{
      const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {coarse:matchMedia('(pointer:coarse)').matches,pad:rect('unfireTouchPad'),fly:rect('unfireFly'),talk:rect('unfireTalk'),down:rect('unfireDown'),dock:rect('ctlDock')};
    });
    assert(g.coarse,spec.name+': emulated touch pointer expected');
    assert(g.pad.width>=75&&g.pad.width<=150,spec.name+': joystick reachable '+JSON.stringify(g));
    assert(g.pad.left>=4&&g.pad.right<spec.width*.35,spec.name+': joystick must remain left');
    assert(g.fly.left>spec.width*.64&&g.fly.right<spec.width-3,spec.name+': flight reachable right');
    assert(g.talk.left>spec.width*.64&&g.talk.top>=4,spec.name+': talk reachable');
    assert(g.fly.height>=43&&g.talk.height>=43,spec.name+': action hit targets');
    for(const id of ['pad','fly','talk','down'])assert(g[id].bottom<=spec.height-5,spec.name+': within viewport '+id);
    for(const a of ['pad','fly','talk'])for(const b of ['fly','talk','down'])if(a!==b)assert(!intersects(g[a],g[b]),spec.name+': overlap '+a+'/'+b);
    assert(!intersects(g.dock,g.fly)&&!intersects(g.dock,g.talk),spec.name+': secondary rail covers action');
    if(spec.width>spec.height)assert(Math.abs(g.down.bottom-g.fly.bottom)<3,spec.name+': BAJAR near VOLAR in landscape');
    else assert(g.down.bottom<=g.talk.top+3,spec.name+': portrait action column');
    console.log('THUMB_LAYOUT_PASS',spec.name,JSON.stringify({pad:g.pad,fly:g.fly,talk:g.talk}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error('THUMB_LAYOUT_FAIL',e.stack||e);process.exitCode=1});
