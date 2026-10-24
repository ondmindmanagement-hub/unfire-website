'use strict';
// Tests the shipped guard in a real Chromium DOM, without WebGL or player runtime.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const guard=path.resolve(__dirname,'../audio/maletin/garage-scroll-guard.js');
const views=[
  {name:'desktop',width:1280,height:800,mobile:false},
  {name:'phone',width:390,height:844,mobile:true},
  {name:'compact',width:320,height:568,mobile:true},
  {name:'landscape',width:844,height:390,mobile:true}
];
function html() {
  const robots=Array.from({length:40},(_,i)=>'<button class="robotCard" data-t="'+i+'">Robot '+i+'</button>').join('');
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>body{margin:0;font:14px system-ui;background:#101726;color:white;overflow:hidden}'+
    '#game{position:fixed;inset:0;background:#10203b}'+
    '#onl{position:fixed;left:8px;top:8px;width:min(385px,calc(100vw - 16px));'+
    'height:min(460px,calc(100dvh - 16px));z-index:3}'+
    '#onl .b{width:100%;height:100%;box-sizing:border-box;padding:8px}'+
    '#onl .act,#onC,#onMsg{padding:7px;background:#1b314b}'+
    '.robotCard{display:block;box-sizing:border-box;width:100%;height:48px;margin:2px 0;'+
    'border:1px solid #abc;background:#123;color:white}</style></head><body>'+
    '<div id="game" tabindex="0">game input surface</div>'+
    '<section id="onl" class="on workshop"><div class="b">'+
    '<div class="act">Choose a robot</div><div id="onT">'+robots+'</div>'+
    '<div id="onC"><button id="colorButton">Color</button></div>'+
    '<div id="onMsg">Scroll to see more robots</div></div></section></body></html>';
}
async function check(browser,v) {
  const context=await browser.newContext({viewport:{width:v.width,height:v.height},
    isMobile:v.mobile,hasTouch:v.mobile,deviceScaleFactor:1});
  const page=await context.newPage(), errors=[];
  try {
    page.on('pageerror',err=>errors.push(err.message));
    await page.setContent(html(),{waitUntil:'domcontentloaded'});
    await page.addScriptTag({path:guard});
    const initial=await page.evaluate(()=>{
      const list=document.querySelector('#onT');
      window.gameWheels=0;window.gameTouches=0;
      window.addEventListener('wheel',()=>{window.gameWheels++});
      window.addEventListener('touchmove',()=>{window.gameTouches++});
      return {height:list.clientHeight,total:list.scrollHeight,
        overflow:getComputedStyle(list).overflowY,
        action:getComputedStyle(list).touchAction,
        guard:document.querySelector('#onl').dataset.garageScrollGuard};
    });
    assert.equal(initial.guard,'1',v.name+': installed');
    assert(initial.total>initial.height+200,v.name+': has overflow');
    assert.equal(initial.overflow,'auto',v.name+': native scroll');
    assert.equal(initial.action,'pan-y',v.name+': touch pan allowed');
    await page.locator('#onT').hover();
    await page.mouse.wheel(0,250);
    await page.waitForFunction(()=>document.querySelector('#onT').scrollTop>20,null,{timeout:5000});
    const snap=await page.evaluate(()=>({scroll:document.querySelector('#onT').scrollTop,wheels:window.gameWheels}));
    assert(snap.scroll>20 && snap.wheels===0,v.name+': wheel must not reach player: '+JSON.stringify(snap));
    await page.evaluate(()=>{const l=document.querySelector('#onT');l.scrollTop=l.scrollHeight;});
    await page.mouse.wheel(0,200);
    await page.waitForTimeout(130);
    assert.equal(await page.evaluate(()=>window.gameWheels),0,v.name+': overscroll must stay in garage');
    await page.mouse.move(v.width-3,v.height-3);
    await page.mouse.wheel(0,150);
    await page.waitForFunction(()=>window.gameWheels>0,null,{timeout:5000});
    const touch=await page.evaluate(()=>{
      document.querySelector('#onT').dispatchEvent(new Event('touchmove',{bubbles:true,cancelable:true}));
      const inside=window.gameTouches;
      document.querySelector('#game').dispatchEvent(new Event('touchmove',{bubbles:true,cancelable:true}));
      return {inside,outside:window.gameTouches};
    });
    assert.equal(touch.inside,0,v.name+': touchmove in garage did not leak');
    assert.equal(touch.outside,1,v.name+': outside touchmove stays active');
    const repaint=await page.evaluate(async()=>{
      const list=document.querySelector('#onT');list.scrollTop=260;const before=list.scrollTop;
      list.addEventListener('click',event=>{
        if(!event.target.closest('button[data-t]'))return;
        list.innerHTML=Array.from({length:40},(_,i)=>'<button class="robotCard" data-t="'+i+'">Robot '+i+'</button>').join('');
        list.scrollTop=0;
      });
      list.querySelector('[data-t="24"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await Promise.resolve();
      return {before,after:list.scrollTop,focused:document.activeElement?.dataset.t};
    });
    assert.equal(repaint.after,repaint.before,v.name+': scroll restored after robot repaint');
    assert.equal(repaint.focused,'24',v.name+': robot focus restored');
    const color=await page.evaluate(async()=>{
      const list=document.querySelector('#onT');list.scrollTop=380;const before=list.scrollTop;
      document.querySelector('#onC').addEventListener('click',()=>{list.scrollTop=0;});
      document.querySelector('#colorButton').click();
      await Promise.resolve();
      return {before,after:list.scrollTop};
    });
    assert.equal(color.after,color.before,v.name+': color selection preserves list position');
    assert.deepEqual(errors,[],v.name+': no page errors');
    console.log('GARAGE_NATIVE_PASS',JSON.stringify({view:v.name,scroll:snap.scroll,repaint,color,touch}));
  } finally {await context.close();}
}
(async()=>{
  let browser;
  try {
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    for(const view of views) await check(browser,view);
  } catch(error) {console.error('GARAGE_NATIVE_FAIL',error.stack||error);process.exitCode=1;}
  finally {if(browser)await browser.close();}
})();
