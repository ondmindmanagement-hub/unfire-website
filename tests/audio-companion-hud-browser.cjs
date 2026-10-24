'use strict';
// Lightweight browser layout QA: no WebGL, heavy assets, audio or accounts.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const base='audio/maletin/';
const html=fs.readFileSync(base+'index.html','utf8');
const markup=html.split('<script src="../vendor/three/three.min.js">')[0];
const normal=[...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]).join('\n');
const coins=fs.readFileSync(base+'coins-shop.js','utf8'),conversation=fs.readFileSync(base+'unfire-conversations.js','utf8');
function generated(source,pattern,desc){const m=source.match(pattern);assert(m,desc);return vm.runInNewContext(m[1],{},{timeout:500});}
const coinMarkup=generated(coins,/root\.innerHTML\s*=\s*([\s\S]*?);\s*document\.body\.appendChild\(root\)/,'coin styles');
const coinCss=coinMarkup.match(/<style>([\s\S]*?)<\/style>/)[1];
const conversationCss=generated(conversation,/css\.textContent\s*=\s*([\s\S]*?);\s*document\.head\.appendChild\(css\)/,'chat styles');
const extra=['mobile-hud-guard.css','thumb-reach.css'].map(x=>fs.readFileSync(base+x,'utf8')).join('\n');
const css=normal+'\n'+extra+'\n'+coinCss+'\n'+conversationCss+
'\n#minimap{position:fixed;left:7px;top:60px;width:110px;height:110px}' +
'\n#stO{position:fixed;top:9px;left:50%;transform:translateX(-50%);width:55vw;max-width:55vw;padding:6px;box-sizing:border-box}' +
'\n#unfireCoinHud{display:flex}';
const fixture='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+css+'</style></head><body class="unfire-roaming">'+
'<div id="minimap"></div><div id="stO">Objetivo de misión</div><div id="ctlDock"></div><div id="wradio" style="position:fixed;left:14px;bottom:14px;top:auto;display:flex;z-index:74"><button id="wrOn">📻 RADIO</button><button>⏭</button></div>'+
'<div id="unfireTouchPad" style="position:fixed;left:18px;bottom:18px;width:130px;height:130px;display:block"><span id="unfireTouchKnob"></span></div>'+
'<button id="unfireFly" style="display:block">VOLAR</button><button id="unfireTalk" style="display:block">HABLAR</button><button id="unfireDown" style="display:block">BAJAR</button>'+
'<button id="ufNear" class="on">💬 BOMBO</button>'+
'<button id="unfireCoinHud" style="display:flex"><span>🟡</span><span>0</span><span>＋</span></button>'+
'<div id="ufDialogs"><section class="ufCard"><header>🤖 BOMBO <button id="ufClose">✕</button></header><div class="ufLog">Hola, soy Bombo.</div><form><input placeholder="Pregunta" /><button>➤</button></form></section></div>'+
'</body></html>';
const devices=[
 ['phone-320',320,568,true],['phone-390',390,844,true],
 ['short-landscape',568,320,true],['iphone-landscape',844,390,true],
 ['tablet-portrait',820,1180,true],['tablet-landscape',1180,820,true],
 ['desktop',1366,768,false]
];
const overlaps=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [name,width,height,mobile] of devices){
   const ctx=await browser.newContext({isMobile:mobile,hasTouch:mobile,viewport:{width,height},deviceScaleFactor:1});
   try{
    const page=await ctx.newPage();await page.setContent(fixture);
    const r=await page.evaluate(()=>{
     const out={};
     for(const id of ['minimap','stO','wradio','unfireCoinHud','ufNear','unfireFly','unfireTalk','unfireDown','unfireTouchPad']){
      const el=document.getElementById(id),q=el.getBoundingClientRect(),s=getComputedStyle(el);
      out[id]={left:q.left,right:q.right,top:q.top,bottom:q.bottom,display:s.display,visibility:s.visibility};
     }
     return out;
    });
    assert(r.unfireCoinHud.right<=width-6,name+': coin outside viewport');
    assert(!overlaps(r.unfireCoinHud,r.minimap),name+': coin overlaps minimap');
    assert(!overlaps(r.unfireCoinHud,r.wradio),name+': coin overlaps radio');
    assert(!overlaps(r.unfireCoinHud,r.stO),name+': coin overlaps objective');
    assert(r.unfireCoinHud.left<width*.34,name+': coin obstructs center');
    if(mobile){
      assert.equal(r.ufNear.display,'none',name+': duplicate robot conversation button');
      assert(!overlaps(r.unfireCoinHud,r.unfireTalk),name+': coin overlaps talk');
      assert(!overlaps(r.unfireCoinHud,r.unfireFly),name+': coin overlaps fly');
      assert(!overlaps(r.unfireTalk,r.unfireFly),name+': talk overlaps fly');
      assert(!overlaps(r.unfireTalk,r.unfireDown),name+': talk overlaps DOWN');
    }
    await page.evaluate(()=>document.getElementById('ufDialogs').classList.add('on'));
    const dialog=await page.evaluate(()=>{
      const el=document.querySelector('#ufDialogs .ufCard'),q=el.getBoundingClientRect();
      return {left:q.left,right:q.right,top:q.top,bottom:q.bottom,fly:getComputedStyle(document.getElementById('unfireFly')).visibility};
    });
    assert.equal(dialog.fly,'hidden',name+': movement actions remain over conversation');
    assert(dialog.left>=0&&dialog.right<=width+1&&dialog.top>=0&&dialog.bottom<=height+1,name+': dialog outside viewport');
    console.log('ORGANIC_HUD_PASS',name);
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
})().catch(err=>{console.error('ORGANIC_HUD_FAIL',err);process.exitCode=1;});