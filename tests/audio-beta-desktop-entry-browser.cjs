'use strict';
// Tests ONLY the lightweight PC beta campaign gateway.
// Explicitly intercepts /audio/ rather than loading WebGL; game QA lives in #13.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const url=process.env.UNFIRE_BETA_URL||'http://127.0.0.1:8792/audio/beta/';
  const layouts=[
    {name:'desktop-1440',width:1440,height:900,isMobile:false,hasTouch:false},
    {name:'laptop-1024',width:1024,height:768,isMobile:false,hasTouch:false},
    {name:'tablet-768',width:768,height:1024,isMobile:true,hasTouch:true},
    {name:'phone-390',width:390,height:844,isMobile:true,hasTouch:true},
    {name:'phone-320',width:320,height:568,isMobile:true,hasTouch:true}
  ];
  try{
    for(const l of layouts){
      const context=await browser.newContext({viewport:{width:l.width,height:l.height},isMobile:l.isMobile,hasTouch:l.hasTouch,deviceScaleFactor:1,locale:'es-ES'});
      const page=await context.newPage(),errors=[],badResponses=[];
      page.on('pageerror',e=>errors.push(String(e)));
      page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:8792')&&r.status()>=400)badResponses.push([r.url(),r.status()]);});
      // A dummy target proves click routing without spinning up a second 3D engine.
      await page.route('**/audio/?*',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Game target route verified</title>'}));
      const response=await page.goto(url,{waitUntil:'load',timeout:25000});
      assert.equal(response.status(),200,l.name+' beta accessible');
      const hero=page.locator('.art img');
      await hero.evaluate(img=>img.decode());
      assert(await hero.evaluate(img=>img.naturalWidth>100),l.name+' authentic image decoded');
      assert.equal(await page.title(),'UNFIRE Mutants — free PC beta');
      assert.equal(await page.locator('html').getAttribute('lang'),'en');
      assert.equal(await page.locator('[data-t="headline1"]').innerText(),'Your world.');
      const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth,playWidth:document.querySelector('#play').getBoundingClientRect().width}));
      assert(sizes.scroll<=sizes.view+1,l.name+' no horizontal overflow '+JSON.stringify(sizes));
      assert(sizes.playWidth>=190,l.name+' CTA touch target '+JSON.stringify(sizes));
      assert.equal(await page.locator('[data-language]').count(),0,'no legacy language toggles');
      assert.match(await page.locator('[data-t="disclaimer"]').innerText(),/beta is still in development/i);
      // Exercise organic referral sharing without opening an external UI or touching OS clipboard.
      await page.evaluate(()=>{
        Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
        Object.defineProperty(navigator,'clipboard',{value:{writeText:async link=>{window.__copiedLink=link;}},configurable:true});
      });
      await page.locator('#share').click();
      await page.waitForFunction(()=>window.__copiedLink==='https://unfire.technology/audio/beta/',null,{timeout:3000});
      assert.equal(await page.locator('#shareStatus').innerText(),'Link copied');
      const play=page.locator('#play');
      await play.scrollIntoViewIfNeeded();
      if(l.hasTouch)await play.tap();else await play.click();
      await page.waitForURL(/\/audio\/\?utm_source=unfire_beta/,{timeout:3000});
      assert.equal(await page.title(),'Game target route verified');
      assert.deepEqual(errors,[],l.name+' JS errors');
      assert.deepEqual(badResponses,[],l.name+' bad static responses');
      console.log('PASS beta gateway '+l.name+' (no WebGL) '+JSON.stringify(sizes));
      await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
