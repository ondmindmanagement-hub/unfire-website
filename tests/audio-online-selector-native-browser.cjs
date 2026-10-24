'use strict';
// Real Chromium DOM regression: online entry scroll is native and never drives the 3D engine.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const guard=path.resolve(__dirname,'../audio/maletin/garage-scroll-guard.js');
const views=[
  {name:'desktop',width:1440,height:900,mobile:false},
  {name:'phone',width:390,height:844,mobile:true},
  {name:'compact',width:320,height:568,mobile:true},
  {name:'landscape',width:844,height:390,mobile:true}
];
function markup(){
  const cards=Array.from({length:20},(_,i)=>
    '<button type="button" class="robotCard" data-t="'+i+'">'+
    '<span class="robotPortrait"><span class="robotUnknown">◌</span></span>'+
    '<span class="robotName">Robot '+i+'</span><small class="robotPerk">Elegir robot</small></button>').join('');
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>html,body{height:100%;margin:0;overflow:hidden;font:600 13px Arial}'+
    '#game{position:fixed;inset:0;background:#21344c}'+
    '#onl{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(0,10,30,.55)}'+
    '#onl .b{background:linear-gradient(180deg,#eef6ff,#bcd9ff);border:3px solid #fff;border-radius:22px;padding:18px;'+
    'width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 20px 50px #000a}'+
    '#onl h3{margin:0 0 10px}#onl input{display:block;box-sizing:border-box;width:100%;padding:9px;margin:4px 0 10px}'+
    '#onl .sw{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}'+
    '#onl .sw button{width:34px;height:34px;border-radius:50%}'+
    '#onl .ty button{width:auto;height:auto;padding:7px 10px;background:#fff;color:#0a1a3a}'+
    '#onl #onT{max-height:min(47vh,460px);overflow:auto;padding:4px}'+
    '#onl .act{display:flex;gap:8px;margin-top:6px}#onl .act button{flex:1;padding:9px}'+
    '</style></head><body><div id="game">Game</div>'+
    '<section id="onl" class="on"><div class="b"><h3>Modo Online</h3>'+
    'Tu nombre<input value="Jugador">Tu número<input value="27">'+
    '<div>Color de tu robot</div><div class="sw" id="onC"><button id="color">Color</button></div>'+
    '<div>Tipo de robot transformable</div><div class="sw ty" id="onT">'+cards+'</div>'+
    '<div class="act"><button id="new">Crear sala</button></div>'+
    '<div class="act"><button id="join">Unirme</button></div>'+
    '<div class="act"><button id="close">Cerrar</button></div></div></section></body></html>';
}
async function check(browser,v){
  const context=await browser.newContext({viewport:{width:v.width,height:v.height},
    deviceScaleFactor:1,isMobile:v.mobile,hasTouch:v.mobile});
  const page=await context.newPage(),errors=[];
  try{
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent(markup(),{waitUntil:'domcontentloaded'});
    await page.addScriptTag({path:guard});
    const initial=await page.evaluate(()=>{
      const list=document.getElementById('onT'),panel=document.querySelector('#onl .b');
      const style=getComputedStyle(list),box=panel.getBoundingClientRect();
      window.gameWheels=0;window.gameTouches=0;
      window.addEventListener('wheel',()=>window.gameWheels++);
      window.addEventListener('touchmove',()=>window.gameTouches++);
      return {guard:document.getElementById('onl').dataset.garageScrollGuard,
        cols:style.gridTemplateColumns.trim().split(' ').filter(Boolean).length,
        overflow:style.overflowY,touchAction:style.touchAction,
        client:list.clientHeight,total:list.scrollHeight,
        box:{x:box.x,y:box.y,right:box.right,bottom:box.bottom}};
    });
    assert.equal(initial.guard,'1',v.name+': guard installed');
    assert.equal(initial.cols,2,v.name+': two columns');
    assert.equal(initial.overflow,'auto',v.name+': native scroll');
    assert.equal(initial.touchAction,'pan-y',v.name+': touch scroll permitted');
    assert(initial.total>initial.client+100,v.name+': card list scrolls');
    assert(initial.box.x>=-1 && initial.box.right<=v.width+1,v.name+': dialog fits width');
    assert(initial.box.y>=-1 && initial.box.bottom<=v.height+1,v.name+': dialog fits height');
    await page.locator('#onT').hover();
    await page.mouse.wheel(0,230);
    await page.waitForFunction(()=>document.getElementById('onT').scrollTop>20,null,{timeout:5000});
    const afterWheel=await page.evaluate(()=>({
      top:document.getElementById('onT').scrollTop,gameWheels:window.gameWheels}));
    assert(afterWheel.top>20 && afterWheel.gameWheels===0,v.name+': wheel isolated '+JSON.stringify(afterWheel));
    const touch=await page.evaluate(()=>{
      const list=document.getElementById('onT');
      const evt=new Event('touchmove',{bubbles:true,cancelable:true});
      list.dispatchEvent(evt);
      return {gameTouches:window.gameTouches,defaultPrevented:evt.defaultPrevented};
    });
    assert.equal(touch.gameTouches,0,v.name+': touch does not reach game');
    assert.equal(touch.defaultPrevented,false,v.name+': native touch not cancelled');
    const selection=await page.evaluate(async()=>{
      const list=document.getElementById('onT');
      list.scrollTop=225; const before=list.scrollTop;
      list.addEventListener('click',e=>{
        if(!e.target.closest('button[data-t]'))return;
        list.innerHTML=Array.from({length:20},(_,i)=>
          '<button class="robotCard" data-t="'+i+'">Robot '+i+'</button>').join('');
        list.scrollTop=0;
      });
      list.querySelector('[data-t="12"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await Promise.resolve();
      return {before,after:list.scrollTop,focused:document.activeElement?.dataset.t};
    });
    assert.equal(selection.after,selection.before,v.name+': selection preserved offset');
    assert.equal(selection.focused,'12',v.name+': selection restored focus');
    const color=await page.evaluate(async()=>{
      const list=document.getElementById('onT');
      list.scrollTop=145;const before=list.scrollTop;
      document.getElementById('onC').addEventListener('click',()=>{list.scrollTop=0;});
      document.getElementById('color').click();
      await Promise.resolve();
      return {before,after:list.scrollTop};
    });
    assert.equal(color.after,color.before,v.name+': color repaint preserves offset');
    const actions=await page.evaluate(()=>{
      const panel=document.querySelector('#onl .b');
      panel.scrollTop=panel.scrollHeight;
      const b=document.getElementById('close').getBoundingClientRect();
      const p=panel.getBoundingClientRect();
      return {visible:b.top>=p.top-1 && b.bottom<=p.bottom+1};
    });
    assert(actions.visible,v.name+': end-of-dialog action accessible');
    assert.deepEqual(errors,[],v.name+': no JS errors');
    console.log('ONLINE_SELECTOR_BROWSER_PASS',JSON.stringify({view:v.name,afterWheel,selection,color}));
  }finally{await context.close();}
}
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    for(const v of views)await check(browser,v);
  }catch(error){console.error('ONLINE_SELECTOR_BROWSER_FAIL',error.stack||error);process.exitCode=1;}
  finally{if(browser)await browser.close();}
})();
