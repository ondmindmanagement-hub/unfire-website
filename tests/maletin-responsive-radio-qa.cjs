// Cross-device radio accessibility and adaptive quality smoke test.
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME || undefined,
   args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']});
 try {
  for(const [width,height] of [[390,844],[320,568],[568,320],[844,390]]) {
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   const page=await context.newPage(), errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto((process.env.UNFIRE_RADIO_URL||'http://127.0.0.1:8767/audio/maletin/index.html?quality=compact'),
     {waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__mal && !!window.__WRADIO,null,{timeout:50000});
   await page.evaluate(()=>window.__mal.setP(1));
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('wradio')).display==='flex',
     null,{timeout:18000});
   const compact=await page.evaluate(()=>{
    const ids=['wrOn','wrNx','wrMore'];
    return ids.map(id=>{
      const el=document.getElementById(id),r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return{id,x:r.x,y:r.y,w:r.width,h:r.height,visible:s.display!=='none'&&s.visibility!=='hidden',
        within:r.left>=-2&&r.right<=innerWidth+2&&r.top>=-2&&r.bottom<=innerHeight+2};
    });
   });
   assert(compact.every(c=>c.visible&&c.within&&c.w>=34&&c.h>=34), JSON.stringify({width,height,compact}));
   await page.locator('#wrMore').click({timeout:10000});
   const expanded=await page.evaluate(()=>{
    const ids=['wrUp','wrV','wrT'];
    return ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);
      return{id,visible:s.display!=='none'&&s.visibility!=='hidden',inside:r.left>=-2&&r.right<=innerWidth+2};});
   });
   assert(expanded.every(x=>x.visible&&x.inside),JSON.stringify({width,height,expanded}));
   assert.equal(await page.locator('#wrMore').getAttribute('aria-expanded'),'true');
   await page.locator('#wrMore').click({timeout:10000});
   assert.equal(await page.locator('#wrMore').getAttribute('aria-expanded'),'false');
   assert.deepEqual(errors,[],JSON.stringify({width,height,errors}));
   console.log('PASS radio controls and expansion',width,height);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
