'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const root='http://127.0.0.1:8793/audio/';
  const viewports=[
    {name:'desktop',width:1440,height:900,touch:false},
    {name:'laptop',width:1024,height:768,touch:false},
    {name:'tablet',width:768,height:1024,touch:true},
    {name:'phone',width:390,height:844,touch:true},
    {name:'small-phone',width:320,height:568,touch:true}
  ];
  try{
    for(const section of ['press','art']){
      for(const v of viewports){
        const ctx=await browser.newContext({viewport:{width:v.width,height:v.height},hasTouch:v.touch,isMobile:v.touch,deviceScaleFactor:1,locale:'en-US'});
        const page=await ctx.newPage();
        const errors=[],failed=[];
        page.on('pageerror',e=>errors.push(String(e)));
        page.on('response',r=>{if(r.url().startsWith(root)&&r.status()>=400)failed.push(r.url()+' '+r.status());});
        const r=await page.goto(root+section+'/',{waitUntil:'load',timeout:25000});
        assert.equal(r.status(),200,section+': '+v.name+' page returns 200');
        const h=await page.locator('h1').innerText();
        assert.match(h,/Unfire Audio/);
        const metrics=await page.evaluate(()=>({
          scroll:document.documentElement.scrollWidth,
          width:document.documentElement.clientWidth,
          imageCount:document.images.length,
          broken:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src),
          linkCount:document.querySelectorAll('a').length
        }));
        assert(metrics.scroll<=metrics.width+1,section+': '+v.name+' horizontal overflow '+JSON.stringify(metrics));
        assert(metrics.imageCount>=1,section+': '+v.name+' imagery');
        assert.deepEqual(metrics.broken,[],section+': '+v.name+' real image loading');
        assert(metrics.linkCount>=4,section+': '+v.name+' navigable');
        assert(await page.locator('a[href="../"]').count()>=1,section+': '+v.name+' free game link');
        assert(await page.locator('a[href^="mailto:hello@unfire.technology"]').count()>=1,section+': '+v.name+' press contact');
        assert.deepEqual(errors,[],section+': '+v.name+' javascript errors');
        assert.deepEqual(failed,[],section+': '+v.name+' failed image or page assets');
        console.log('PASS '+section+' '+v.name+' '+JSON.stringify(metrics));
        await ctx.close();
      }
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
