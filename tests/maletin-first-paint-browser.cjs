// Instant-first-paint regression: intentionally prevent the engine from booting.
// The first real-game capture must already be visible and playable as an entry
// surface on every device. The complete 3D transition has its own browser suite.
'use strict';
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,
  args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']});
 try{
  for(const [width,height,label] of [[1280,800,'desktop'],[390,844,'mobile'],[320,568,'small-phone']]){
   const context=await browser.newContext({viewport:{width,height},isMobile:label!=='desktop',hasTouch:label!=='desktop',deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/audio/maletin/index.html*',route=>
    route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><title>intentionally delayed 3D scene</title></html>'}));
   const t0=Date.now();
   await page.goto(process.env.UNFIRE_ENTRY_URL||'http://127.0.0.1:8767/audio/',{waitUntil:'domcontentloaded',timeout:30000});
   const first=await page.evaluate(()=>{const photo=document.getElementById('unfireCaseFirstFrame'),
    img=photo.querySelector('img'),fr=document.getElementById('malFrame'),pin=document.getElementById('heroPin');
    return{exists:!!photo,aboveFrame:photo.compareDocumentPosition(fr)&Node.DOCUMENT_POSITION_FOLLOWING,
      visible:getComputedStyle(photo).visibility==='visible',image:img.currentSrc,
      copyHidden:getComputedStyle(document.getElementById('heroCopy')).visibility==='hidden',
      sceneReady:pin.classList.contains('scene-ready'),tabTitle:document.title}});
   await page.waitForFunction(()=>{const i=document.querySelector('#unfireCaseFirstFrame img');
    return i?.complete&&i?.naturalWidth>0},null,{timeout:12000,polling:50});
   const rendered=await page.evaluate(()=>{const p=document.getElementById('unfireCaseFirstFrame'),i=p.querySelector('img');
    const r=p.getBoundingClientRect();return{width:r.width,height:r.height,bytesImageWidth:i.naturalWidth,bytesImageHeight:i.naturalHeight,
      opacity:getComputedStyle(p).opacity,photoIsClickable:getComputedStyle(p).pointerEvents!=='none'}});
   assert(first.exists&&first.aboveFrame&&first.visible&&first.copyHidden&&!first.sceneReady,
     'First paint must show the real WebGL frame, not a loader or ad '+JSON.stringify({label,first}));
   assert(first.image.includes('maletin-real-first-frame-'+(label==='desktop'?'desktop':'mobile')+'.webp')&&
     rendered.width>=width-2&&rendered.height>=height*.65&&rendered.photoIsClickable,
     'Correct actual image must cover the loading viewport '+JSON.stringify({label,first,rendered}));
   if(label!=='desktop'){
    const hint=await page.evaluate(()=>{const e=document.getElementById('unfireMobileTapHint'),r=e.getBoundingClientRect();return{visible:getComputedStyle(e).display!=='none',top:r.top,bottom:r.bottom,height:innerHeight}});
    assert(hint.visible&&hint.top>=0&&hint.bottom<=hint.height-4,
      'Mobile opening hint must be visible without scrolling '+JSON.stringify({label,hint}));
   }
   const priorPageCount=context.pages().length;
   await page.locator('#unfireCaseFirstFrame').click({timeout:10000});
   await page.waitForFunction(()=>document.body.classList.contains('immOn'),null,{timeout:2000,polling:50});
   assert.equal(context.pages().length,priorPageCount,'First loading tap opened a new tab');
   assert.deepEqual(errors,[],'JS errors while waiting for 3D '+JSON.stringify(errors));
   console.log('PASS real-case instant paint and one-tap on pending WebGL',JSON.stringify({label,domMs:Date.now()-t0,rendered}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
