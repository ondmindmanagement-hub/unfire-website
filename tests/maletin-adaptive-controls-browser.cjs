'use strict';
// Headless real-DOM smoke of the adaptive control layout. No fabricated screenshots.
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.UNFIRE_ADAPTIVE_QA_PORT||8792);
const views=[
  {name:'iphone-portrait',w:390,h:844,expected:'phone'},
  {name:'iphone-landscape',w:844,h:390,expected:'phone'},
  {name:'ipad-portrait',w:768,h:1024,expected:'tablet'}
];
let server,browser;
function collides(a,b,gap=1) {
  return a.left < b.right+gap && a.right > b.left-gap &&
    a.top < b.bottom+gap && a.bottom > b.top-gap;
}
async function probe(page,name) {
  return page.evaluate(()=>{
    const ids=['unfireTouchPad','unfireFly','unfireDown','unfireTalk'];
    const seen=ids.map(id=>{
      const el=document.getElementById(id);
      if(!el)return {id,missing:true};
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {id,hidden:s.display==='none'||s.visibility==='hidden',
        left:r.left,top:r.top,right:r.right,bottom:r.bottom,
        width:r.width,height:r.height};
    });
    const hud=['hud','tb','storyHud','ctlDock','wradio','minimap'];
    const reserved=hud.map(id=>{
      const el=document.getElementById(id);
      if(!el)return null;
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return (s.display==='none'||s.visibility==='hidden'||r.width<1||r.height<1) ?
        null : {id,left:r.left,top:r.top,right:r.right,bottom:r.bottom,
          width:r.width,height:r.height};
    }).filter(Boolean);
    return {profile:window.UnfireAdaptiveControls.profile(innerWidth,innerHeight,true),
      width:innerWidth,height:innerHeight,seen,reserved,
      edit:!!window.__unfireLayoutEditing};
  });
}
function checkLayout(p,tag) {
  const live=p.seen.filter(x=>!x.hidden);
  assert(live.some(x=>x.id==='unfireTouchPad'),tag+' pad hidden');
  assert(live.some(x=>x.id==='unfireFly'),tag+' flight button hidden');
  for(const a of live) {
    assert(a.left>=-1&&a.top>=-1&&a.right<=p.width+1&&a.bottom<=p.height+1,
      tag+' outside viewport '+a.id+' '+JSON.stringify(a));
    for(const b of live)if(a.id<b.id)
      assert(!collides(a,b),tag+' touch overlap '+a.id+' vs '+b.id);
    for(const b of p.reserved)
      if(b.width*b.height<p.width*p.height*.44)
        assert(!collides(a,b),tag+' HUD overlap '+a.id+' vs '+b.id+' '+JSON.stringify({control:a,reserved:b,viewport:[p.width,p.height]}));
  }
}
async function exercise(spec) {
  const context=await browser.newContext({
    viewport:{width:spec.w,height:spec.h},hasTouch:true,isMobile:true,deviceScaleFactor:1
  });
  const errors=[];
  try {
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(String(e.message).slice(0,300)));
    await page.goto('http://127.0.0.1:'+port+'/audio/maletin/index.html?quality=compact',
      {waitUntil:'domcontentloaded',timeout:35000});
    await page.waitForFunction(()=>!!window.__roamAPI&&!!window.UnfireAdaptiveControls &&
      !!document.getElementById('unfireEditTouchLayout'),null,{timeout:90000,polling:250});
    await page.evaluate(()=>{
      window.__roamAPI.enterRoam();
      window.__roamAPI.ROAMS.fly=true;
    });
    await page.waitForFunction(()=>{
      const b=document.getElementById('unfireFly');
      return b&&getComputedStyle(b).display!=='none';
    },null,{timeout:45000,polling:250});
    let p=await probe(page,spec.name);
    assert.equal(p.profile,spec.expected,spec.name+' profile');
    checkLayout(p,spec.name+' default');
    await page.evaluate(()=>document.getElementById('unfireEditTouchLayout').click());
    await page.waitForFunction(()=>!!window.__unfireLayoutEditing);
    p=await probe(page,spec.name+' edit');
    assert(p.edit,spec.name+' editor not open');
    checkLayout(p,spec.name+' editing');
    await page.evaluate(()=>{
      const f=document.getElementById('unfireFly');
      const pad=document.getElementById('unfireTouchPad');
      const a=f.getBoundingClientRect(),b=pad.getBoundingClientRect();
      const evt=(name,x,y)=>f.dispatchEvent(new PointerEvent(name,{
        pointerId:41,pointerType:'touch',bubbles:true,cancelable:true,
        clientX:x,clientY:y,buttons:name==='pointerup'?0:1}));
      evt('pointerdown',a.left+a.width/2,a.top+a.height/2);
      evt('pointermove',b.left+b.width/2,b.top+b.height/2);
      evt('pointerup',b.left+b.width/2,b.top+b.height/2);
    });
    p=await probe(page,spec.name+' moved');
    checkLayout(p,spec.name+' moved');
    await page.evaluate(()=>document.querySelector('#unfireTouchEditorBar button:last-child').click());
    assert.equal(await page.evaluate(()=>!!window.__unfireLayoutEditing),false);
    assert.deepEqual(errors,[],spec.name+' JS exceptions: '+errors.join(', '));
    console.log('ADAPTIVE_BROWSER_PASS',spec.name,JSON.stringify({
      profile:p.profile,controls:p.seen.filter(x=>!x.hidden).map(x=>x.id)}));
  } finally {await context.close();}
}
(async()=>{
  try {
    server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{
      cwd:root,stdio:'ignore'});
    await new Promise(r=>setTimeout(r,450));
    browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,
      args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox',
        '--autoplay-policy=no-user-gesture-required']});
    for(const v of views)await exercise(v);
  }catch(e){console.error('ADAPTIVE_BROWSER_FAIL',e.stack||e);process.exitCode=1;}
  finally{
    try{if(browser)await browser.close();}catch(_){}
    if(server){
      server.kill('SIGTERM');
      await Promise.race([
        new Promise(r=>server.once('exit',r)),
        new Promise(r=>setTimeout(r,500))
      ]);
    }
  }
})();
