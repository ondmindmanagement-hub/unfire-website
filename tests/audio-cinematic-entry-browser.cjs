'use strict';
// Lightweight real Chromium host QA. WebGL is intentionally replaced with a
// same-origin fixture: this verifies transitions, NOT actual GPU performance.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fixtures=[
  {label:'phone',width:390,height:844,rotate:[844,390],mobile:true},
  {label:'small-phone',width:320,height:568,rotate:[568,320],mobile:true},
  {label:'tablet',width:834,height:1194,rotate:[1194,834],mobile:true},
  {label:'desktop',width:1280,height:800,rotate:[800,1280],mobile:false}
];
const stubHtml=[
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
  '<body style="margin:0;background:#030f1b">',
  '<button id="qaCase" style="height:100vh;width:100vw;background:#051423;color:white">3D case fixture</button>',
  '<script>',
  'window.__mal={S:{renderer:{}}};',
  'window.__qaMessages=[];window.__qaGameState={mission:42};',
  'addEventListener("message",event=>{window.__qaMessages.push(event.data)});',
  'document.getElementById("qaCase").addEventListener("click",()=>parent.__UNFIRE_ENTER_CASE());',
  '</scr'+'ipt></body></html>'
].join('');
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    for(const size of fixtures){
      const context=await browser.newContext({
        viewport:{width:size.width,height:size.height},deviceScaleFactor:1,
        isMobile:size.mobile,hasTouch:size.mobile,reducedMotion:'no-preference'
      });
      try{
        const page=await context.newPage(),errors=[];
        page.on('pageerror',err=>errors.push(err.message));
        await page.addInitScript(()=>{
          window.__qaAnimations=[];
          const animate=Element.prototype.animate;
          Element.prototype.animate=function(keyframes,opts){
            if(this.id==='heroPin'||this.id==='malFrame'){
              window.__qaAnimations.push({id:this.id,duration:opts?.duration,keyframes});
            }
            return animate.call(this,keyframes,opts);
          };
        });
        await page.route('**/audio/maletin/index.html*', route=>route.fulfill({
          status:200,contentType:'text/html',body:stubHtml
        }));
        await page.goto(process.env.UNFIRE_ENTRY_URL||'http://127.0.0.1:8767/audio/',
          {waitUntil:'domcontentloaded',timeout:30000});
        await page.waitForFunction(()=>document.getElementById('heroPin')?.classList.contains('scene-ready'),
          null,{timeout:15000,polling:100});
        const initialUrl=page.url(),initialCount=context.pages().length;
        const frame=page.frameLocator('#malFrame');
        await frame.locator('#qaCase').click({timeout:10000});
        await page.waitForFunction(()=>document.getElementById('malFrame')?.contentWindow
          ?.__qaMessages.some(x=>x.entryStart),null,{timeout:10000,polling:100});
        const entered=await page.evaluate(()=>{
          const fr=document.getElementById('malFrame');
          const r=fr.getBoundingClientRect(),msgs=fr.contentWindow.__qaMessages;
          return {
            immersive:document.body.classList.contains('immOn'),
            full:Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2,
            entryCount:msgs.filter(m=>m.entryStart).length,
            animation:window.__qaAnimations.find(a=>a.id==='heroPin'),
            mission:fr.contentWindow.__qaGameState.mission,
            iframeSrc:fr.src
          };
        });
        assert.equal(page.url(),initialUrl,size.label+': no navigation');
        assert.equal(context.pages().length,initialCount,size.label+': no tab');
        assert(entered.immersive&&entered.full,size.label+': should fill viewport '+JSON.stringify(entered));
        assert.equal(entered.entryCount,1,size.label+': must open lid once');
        assert(entered.animation&&entered.animation.duration>=900&&entered.animation.duration<=1150,
          size.label+': missing gradual viewport animation '+JSON.stringify(entered.animation));
        await page.setViewportSize({width:size.rotate[0],height:size.rotate[1]});
        await page.waitForFunction(()=>{
          const r=document.getElementById('malFrame').getBoundingClientRect();
          return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2;
        },null,{timeout:10000,polling:100});
        const rotated=await page.evaluate(()=>{
          const fr=document.getElementById('malFrame');
          return {
            immersive:document.body.classList.contains('immOn'),
            rotation:window.__qaAnimations.filter(a=>a.id==='malFrame').map(x=>x.duration),
            entryCount:fr.contentWindow.__qaMessages.filter(m=>m.entryStart).length,
            mission:fr.contentWindow.__qaGameState.mission,
            iframeSrc:fr.src
          };
        });
        assert(rotated.immersive&&rotated.rotation.includes(320),size.label+': no smooth rotation '+JSON.stringify(rotated));
        assert.equal(rotated.entryCount,1,size.label+': rotation reopened case');
        assert.equal(rotated.mission,42,size.label+': rotation reset mission');
        assert.equal(rotated.iframeSrc,entered.iframeSrc,size.label+': rotation reloaded iframe');
        // Rotate back to portrait (or landscape on desktop) without creating
        // a second game instance, a navigation, or a second case-opening event.
        await page.setViewportSize({width:size.width,height:size.height});
        await page.waitForFunction(()=>{
          const r=document.getElementById('malFrame').getBoundingClientRect();
          return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2;
        },null,{timeout:10000,polling:100});
        const returned=await page.evaluate(()=>{
          const fr=document.getElementById('malFrame');
          return {
            rotations:window.__qaAnimations.filter(a=>a.id==='malFrame').map(x=>x.duration),
            mission:fr.contentWindow.__qaGameState.mission,
            entryCount:fr.contentWindow.__qaMessages.filter(m=>m.entryStart).length,
            src:fr.src
          };
        });
        assert.equal(returned.rotations.length,2,size.label+': portrait return was not animated');
        assert(returned.rotations.every(ms=>ms===320),size.label+': inconsistent rotation easing');
        assert.equal(returned.mission,42,size.label+': returning to original rotation lost mission');
        assert.equal(returned.entryCount,1,size.label+': returning to original rotation reopened case');
        assert.equal(returned.src,entered.iframeSrc,size.label+': returning to original rotation reloaded game');

        assert.equal(page.url(),initialUrl,size.label+': rotation navigated');
        assert.equal(context.pages().length,initialCount,size.label+': rotation spawned tab');
        await frame.locator('#qaCase').click();
        assert.equal(await page.evaluate(()=>document.getElementById('malFrame').contentWindow.__qaMessages.filter(m=>m.entryStart).length),
          1,size.label+': duplicate click starts second lid');
        assert.deepEqual(errors,[],size.label+': browser exceptions');
        console.log('CINEMATIC_BROWSER_PASS',JSON.stringify({label:size.label,entered:{duration:entered.animation.duration},
          rotated:{duration:rotated.rotation,mission:rotated.mission},pages:initialCount}));
      }finally{await context.close();}
    }
  }catch(e){
    console.error(e.stack||e);process.exitCode=1;
  }finally{if(browser)await browser.close();}
})();
