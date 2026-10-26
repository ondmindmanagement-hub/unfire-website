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
  await page.locator('#ufLangFirst').waitFor({timeout:12000});
  assert.equal(await page.locator('#ufLangFirst button[data-lang]').count(),2,'Only supported languages can be chosen');
  assert.equal(await page.locator('#ufLangFirst button[data-lang="es"]').getAttribute('aria-pressed'),'true');
  await page.locator('#ufLangFirst button[data-lang="en"]').click();
  assert.equal(await page.locator('#ufLangContinue').textContent(),'CONTINUE');
  await page.locator('#ufLangContinue').click();
  await page.waitForURL(/lang=en/);
  await page.waitForFunction(()=>window.__LANG==='en');
  assert.equal(await page.evaluate(()=>localStorage.getItem('unfire_lang')),'en');
  assert.equal(await page.locator('#ufLangFirst').count(),0,'First-run prompt must not repeat');
  assert.equal(await page.locator('#ufLangSettings select').count(),1,'Language belongs to existing gear panel');
  await page.locator('#ufLangSettings select').selectOption('es');
  await page.waitForURL(/lang=es/);
  await page.waitForFunction(()=>window.__LANG==='es');
  assert.equal(await page.locator('#ufLangSettings select').inputValue(),'es');
  await page.reload();
  assert.equal(await page.locator('#ufLangFirst').count(),0,'Language persists across reloads');
  await page.setViewportSize({width:320,height:568});
  const dims=await page.evaluate(()=>{const x=document.querySelector('#ufLangSettings select').getBoundingClientRect();return {x:x.x,right:x.right,width:innerWidth};});
  assert(dims.x>=0&&dims.right<=dims.width+1,'Settings selector inside narrow phone');
  assert.deepEqual(errors,[],'No page errors');
  await context.close();
  console.log('PASS language onboarding: first ES/EN, persistence, EN→ES, stale query, settings, 320px viewport');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
