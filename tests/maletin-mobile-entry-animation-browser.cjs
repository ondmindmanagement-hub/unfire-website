'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const scenarios=[
   {w:390,h:844,reduced:'no-preference',animate:true},
   {w:320,h:568,reduced:'no-preference',animate:true},
   {w:568,h:320,reduced:'no-preference',animate:false},
   {w:390,h:844,reduced:'reduce',animate:false},
  ];
  for(const s of scenarios){
   const context=await browser.newContext({viewport:{width:s.w,height:s.h},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:s.reduced});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/audio/maletin/index.html*',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Booting 3D engine</title>'}));
   const t=Date.now();
   await page.goto(process.env.UNFIRE_ENTRY_URL||'http://127.0.0.1:8791/audio/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>{const e=document.querySelector('#unfireCaseFirstFrame img');return e?.complete&&e.naturalWidth>0},null,{timeout:10000});
   const before=await page.evaluate(()=>{
    const frame=document.querySelector('#unfireCaseFirstFrame'),img=frame.querySelector('img'),hint=document.querySelector('#unfireMobileTapHint'),r=frame.getBoundingClientRect(),hr=hint.getBoundingClientRect();
    return {visible:getComputedStyle(frame).visibility==='visible',opacity:getComputedStyle(frame).opacity,animation:getComputedStyle(img).animationName,source:img.currentSrc,bodyOverflow:document.documentElement.scrollWidth-innerWidth,rect:{top:r.top,width:r.width,height:r.height},hintVisible:getComputedStyle(hint).display!=='none',hintTop:hr.top,hintBottom:hr.bottom,interactive:getComputedStyle(frame).pointerEvents!=='none'};
   });
   assert(before.visible&&before.opacity==='1'&&before.interactive&&before.source.includes('maletin-real-first-frame-mobile.webp'),`Real case first, without blank loader: ${JSON.stringify({s,before})}`);
   assert.equal(before.animation,s.animate?'unfireCaseArrival':'none',`Unexpected animation ${JSON.stringify({s,before})}`);
   assert(before.bodyOverflow<=1&&before.rect.width>=s.w-1&&before.rect.height>=s.h*.65,'Case overflows or fails first viewport '+JSON.stringify({s,before}));
   if(s.w<s.h)assert(before.hintVisible&&before.hintBottom<=s.h&&before.hintTop>=0,'Hint offscreen '+JSON.stringify({s,before}));
   await page.waitForTimeout(900);
   const completed=await page.evaluate(()=>({photoVisible:getComputedStyle(document.querySelector('#unfireCaseFirstFrame')).visibility==='visible',canvasAnimated:getComputedStyle(document.querySelector('#malFrame')).animationName,transform:getComputedStyle(document.querySelector('#unfireCaseFirstFrame img')).transform}));
   // The newest real-world mobile WebP has no geometric crop. Arrival must
   // settle to the native untransformed scene, not the older shifted framing.
   const natural=completed.transform==='none'||completed.transform==='matrix(1, 0, 0, 1, 0, 0)';
   assert(completed.photoVisible&&completed.canvasAnimated==='none'&&natural,'Real preview must settle without distortion '+JSON.stringify({s,completed}));
   const count=context.pages().length;
   await page.locator('#unfireCaseFirstFrame').click();
   await page.waitForFunction(()=>document.body.classList.contains('immOn'),null,{timeout:2000});
   assert.equal(context.pages().length,count,'Opening created an unexpected tab');
   assert.deepEqual(errors,[],'JavaScript errors: '+JSON.stringify(errors));
   console.log('PASS mobile case welcome',JSON.stringify({s,testMs:Date.now()-t,animation:before.animation}));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
