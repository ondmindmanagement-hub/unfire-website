'use strict';
const assert=require('node:assert/strict');
const { chromium }=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'es-ES'});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const origin='http://127.0.0.1:8766/tests/game-language-fixture.html';
  await page.goto(origin+'?languageQA=1');
  await page.locator('#ufLangSettings select').waitFor({timeout:12000});
  assert.equal(await page.locator('#ufLangFirst').count(),0,'No language overlay blocks gameplay');
  assert.equal(await page.locator('#ufLangQuickButton').count(),0,'No floating language button obscures the game');
  assert.equal(await page.locator('#ufLangSettings select').inputValue(),'en','English is the default');
  await page.locator('#ufLangSettings select').selectOption('es');
  await page.waitForURL(/lang=es/);
  await page.waitForFunction(()=>window.__LANG==='es');
  assert.equal(await page.evaluate(()=>localStorage.getItem('unfire_lang')),'es');
  assert.equal(await page.locator('#ufLangSettings select').inputValue(),'es');
  await page.reload();
  assert.equal(await page.locator('#ufLangSettings select').inputValue(),'es','Language persists across reload');
  await page.locator('#ufLangSettings select').selectOption('en');
  await page.waitForURL(/lang=en/);
  assert.equal(await page.locator('#ufLangSettings select').inputValue(),'en');
  await page.setViewportSize({width:320,height:568});
  const dims=await page.evaluate(()=>{const x=document.querySelector('#ufLangSettings select').getBoundingClientRect();return {x:x.x,right:x.right,width:innerWidth};});
  assert(dims.x>=0&&dims.right<=dims.width+1,'Settings selector inside narrow phone');
  assert.deepEqual(errors,[],'No page errors');
  await context.close();
  console.log('PASS language options-only: EN default, ES switching, persistence, no floating overlay, 320px viewport');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
