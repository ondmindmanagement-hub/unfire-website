/* Lightweight browser layout regression using the real mobile guard and
   representative original game controls. Does not claim full WebGL QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'../audio/maletin');
const guardCss=fs.readFileSync(path.join(root,'mobile-hud-guard.css'),'utf8');
const guardJS=fs.readFileSync(path.join(root,'mobile-hud-guard.js'),'utf8');
const dims=[[280,653],[320,568],[375,667],[390,844],[568,320],[653,280],[844,390],[768,1024]];
const originalStyles=`
html,body{margin:0;height:100%;overflow:hidden;background:#041323;color:#fff;font:14px Arial}
#mix{position:fixed;left:14px;top:10px;transform:scale(.88);transform-origin:top left;z-index:40;display:none;gap:6px;flex-direction:column;padding:10px 12px;border-radius:16px;background:linear-gradient(#eef6ff,#a9cdff);border:2px solid white;font:700 11px Michroma,Arial;color:#0a1a3a}
#mix.on{display:flex}
#mix .row{display:flex;gap:6px;align-items:center}
#mix button{border:0;border-radius:999px;padding:6px 10px;font:800 11px Michroma,Arial;background:linear-gradient(#5fb0ff,#1d4fd8);color:#fff}
#mix b{font:900 12px Orbitron,Arial;min-width:180px;text-align:center}
#wradio{position:fixed;left:50%;transform:translateX(-50%);top:112px;z-index:40;display:flex;gap:4px;background:#090e1b;padding:5px;border-radius:14px}
#wradio button{box-sizing:border-box;min-height:38px;min-width:38px;border-radius:100px;background:#287de2;color:white;border:2px solid white}
#wradio:not(.expanded) #wrUp,#wradio:not(.expanded) #wrV,#wradio:not(.expanded) #wrT{display:none}
#wradio.expanded{max-width:94vw;flex-wrap:wrap}
#ctlDock{position:fixed;right:8px;top:112px;max-width:min(34vw,160px);z-index:40;display:flex;flex-direction:column;gap:4px}
#ctlDock button{min-height:40px;border:2px solid white;border-radius:100px;background:#126de0;color:white}
#unfireExitGame{position:fixed;right:8px;top:6px;max-width:48vw;min-height:40px;border-radius:100px;background:#e72d47;color:white;padding:6px 9px;box-sizing:border-box;border:2px solid white}
#minimap{position:fixed;left:9px;bottom:130px;width:72px;height:72px;background:#19253c;display:none}
#buy{position:fixed;right:8px;bottom:115px}
.hud{position:fixed;left:8px;bottom:8px}
`;
const markup=`
<div id="unfireExitGame">SALIR A LA WEB</div>
<div id="mix" class="on">
<div class="row"><button data-s="-1">◀</button><b>♪ Trance de estadio 2000</b><button data-s="1">▶</button></div>
<div class="row"><button>🥁 BATERÍA</button><button>🎸 BAJO</button><button>🎹 ACORDES</button><button>✨ MELODÍA</button><button>🎹 OTRA MELODÍA</button></div>
<div class="row">TONALIDAD <select><option>AUTO</option></select> MODO <select><option>SIGUE LA CANCIÓN</option></select></div>
<div class="row" style="font-size:9px">Teclado: A S D F G H J K L = blancas · W E T Y U O P = negras · Z/X octava</div>
</div>
<div id="wradio"><button id="wrOn">📻</button><button id="wrNx">⏭</button><button id="wrMore" aria-expanded="false">⚙</button><button id="wrUp">TU MÚSICA</button><input id="wrV" type="range"><span id="wrT">UK Bass Waves</span></div>
<div id="ctlDock"><button id="roamB">🚶 PASEAR</button><button>CAMARA</button><button>ONLINE</button></div>
<div id="cfgB" style="position:fixed;right:9px;top:58px">⚙</div>
<div id="minimap"></div><div id="tip" style="display:none"></div><button id="buy">AÑADIR A LA BOLSA</button><div class="hud">+ &nbsp; − &nbsp; ↺</div>`;
const geo=()=>Array.from(document.querySelectorAll('#mix,#wradio,#ctlDock,#unfireExitGame')).map(e=>{
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);
 return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height,l:r.left,t:r.top,r:r.right,b:r.bottom,
 visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
});
const overlap=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>2 && Math.min(a.b,b.b)-Math.max(a.t,b.t)>2;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
 for(const [width,height] of dims){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage(),errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+originalStyles+'</style>'+markup);
  await page.evaluate(()=>{document.getElementById('wrMore').onclick=e=>{e.stopPropagation();const el=document.getElementById('wradio');const v=el.classList.toggle('expanded');document.getElementById('wrMore').setAttribute('aria-expanded',String(v))}});
  const before=await page.evaluate(geo);
  const old=before.find(x=>x.id==='mix'),exit=before.find(x=>x.id==='unfireExitGame');
  if(width<=390)assert(old.r>width+2||overlap(old,exit)||before.some(x=>x.id!=='mix'&&overlap(old,x)),
    'fixture should reproduce the initial crowded music panel');
  await page.addStyleTag({content:guardCss});
  await page.addScriptTag({content:guardJS});
  await page.waitForSelector('#unfireMixToggle');
  const measured=await page.evaluate(geo),visible=measured.filter(x=>x.visible);
  for(const x of visible) assert(x.l>=-2&&x.r<=width+2&&x.t>=-2&&x.b<=height+2,
    'HUD offscreen '+JSON.stringify({width,height,x}));
  const mix=visible.find(x=>x.id==='mix');
  for(const x of visible.filter(x=>x.id!=='mix'))assert(!overlap(mix,x),
    'HUD overlap '+JSON.stringify({width,height,mix,other:x}));
  await page.locator('#unfireMixToggle').click({timeout:6000});
  assert.equal(await page.locator('#unfireMixToggle').getAttribute('aria-expanded'),'true');
  const open=await page.evaluate(()=>{const e=document.getElementById('mix'),r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,radio:getComputedStyle(document.getElementById('wradio')).visibility,rail:getComputedStyle(document.getElementById('ctlDock')).visibility}});
  assert(open.left>=-2&&open.right<=width+2&&open.top>=-2&&open.bottom<=height+2&&open.scrollWidth<=open.clientWidth+3,
    'music drawer clipped '+JSON.stringify({width,height,open}));
  assert.equal(open.radio,'hidden');assert.equal(open.rail,'hidden');
  await page.locator('#unfireMixToggle').click();
  await page.locator('#wrMore').click();
  const radio=await page.evaluate(()=>{const e=document.getElementById('wradio'),r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,mix:getComputedStyle(document.getElementById('mix')).visibility,rail:getComputedStyle(document.getElementById('ctlDock')).visibility}});
  assert(radio.left>=-2&&radio.right<=width+2&&radio.top>=-2&&radio.bottom<=height+2,
    'radio expanded clipped '+JSON.stringify({width,height,radio}));
  assert.equal(radio.mix,'hidden');assert.equal(radio.rail,'hidden');
  await page.locator('#wrMore').click();
  await page.evaluate(()=>document.body.classList.add('storyOn'));
  assert.equal(await page.locator('#mix').evaluate(e=>getComputedStyle(e).display),'none');
  assert.deepEqual(errs,[]);
  console.log('PASS HUD visual lanes',width,height);
  await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
