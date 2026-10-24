'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.UNFIRE_MOBILE_HEADER_URL || 'http://127.0.0.1:8769/';
const viewports = [
  [280,653],[320,568],[375,812],[390,844],[430,932],
  [568,320],[768,1024],[844,390],[920,650],[1024,768]
];
function separated(a,b,slack=1) {
  return a.right <= b.left + slack || b.right <= a.left + slack ||
         a.bottom <= b.top + slack || b.bottom <= a.top + slack;
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const [width,height] of viewports){
      const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:width<=920,hasTouch:width<=920});
      try{
        await page.goto(base,{waitUntil:'domcontentloaded',timeout:25000});
        await page.waitForFunction(()=>document.documentElement.classList.contains('unfire-nav-ready'),null,{timeout:10000});
        await page.waitForSelector('#ask-unfire-host',{timeout:12000});
        const closed=await page.evaluate(()=>{
          const header=document.getElementById('unfire-clean-header-v2');
          const brand=header.querySelector('.unfire-clean-brand');
          const button=header.querySelector('#unfire-mobile-menu-toggle');
          const assistant=header.querySelector('#ask-unfire-host');
          const nav=header.querySelector('#unfire-mobile-site-nav');
          const rect=e=>{let r=e.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
          return {header:rect(header),brand:rect(brand),button:rect(button),assistant:rect(assistant),
            nav:rect(nav),navDisplay:getComputedStyle(nav).display,buttonDisplay:getComputedStyle(button).display,
            documentWidth:document.documentElement.scrollWidth,viewportWidth:document.documentElement.clientWidth};
        });
        assert.ok(closed.documentWidth <= closed.viewportWidth+2, `${width} horizontal overflow: ${JSON.stringify(closed)}`);
        if(width<=920){
          assert.ok(closed.header.height>=55 && closed.header.height<=59,`${width} mobile header must be 56px: ${closed.header.height}`);
          assert.equal(closed.navDisplay,'none',`${width} nav must be collapsed`);
          assert.notEqual(closed.buttonDisplay,'none');
          assert.ok(separated(closed.brand,closed.button),`${width} brand/menu overlap`);
          assert.ok(separated(closed.button,closed.assistant),`${width} menu/assistant overlap`);
          assert.ok(separated(closed.brand,closed.assistant),`${width} brand/assistant overlap`);
          await page.locator('#unfire-mobile-menu-toggle').click();
          assert.equal(await page.locator('#unfire-mobile-menu-toggle').getAttribute('aria-expanded'),'true');
          const open=await page.evaluate(()=>{
            const header=document.getElementById('unfire-clean-header-v2');
            const nav=header.querySelector('.unfire-clean-nav');
            const links=Array.from(nav.querySelectorAll('a')).map(a=>{
              const r=a.getBoundingClientRect();
              return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,text:a.textContent};
            });
            const r=header.getBoundingClientRect();
            return {headerHeight:r.height,navTop:nav.getBoundingClientRect().top,links,headerBottom:r.bottom,
              overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
          });
          assert.ok(open.headerHeight>=240 && open.headerHeight<=400,`${width} expanded menu not in flow: ${open.headerHeight}`);
          assert.equal(open.links.length,9);
          assert.ok(open.overflow<=2,`${width} expanded horizontal overflow ${open.overflow}`);
          for(let j=0;j<open.links.length;j++){
            assert.ok(open.links[j].right<=width+1 && open.links[j].left>=-1,`${width} link ${j} offscreen`);
            assert.ok(open.links[j].bottom<=open.headerBottom+1,`${width} link ${j} outside header`);
            for(let k=j+1;k<open.links.length;k++)assert.ok(separated(open.links[j],open.links[k]),`${width} links ${j} ${k} overlap`);
          }
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#unfire-mobile-menu-toggle').getAttribute('aria-expanded'),'false');
          await page.locator('#unfire-mobile-menu-toggle').click();
          await page.locator('#unfire-mobile-site-nav a[href="#company"]').click();
          assert.equal(await page.locator('#unfire-mobile-menu-toggle').getAttribute('aria-expanded'),'false');
          if(width===320 || width===390){
            await page.locator('#unfire-mobile-menu-toggle').click();
            await page.locator('#unfire-mobile-site-nav').evaluate((nav)=>{
              const labels=['Compañía','Trabajar','Aplicaciones','Juegos','Audio','Sistema','Escala','Fondos','Contacto'];
              Array.from(nav.querySelectorAll('a')).forEach((a,i)=>{a.textContent=labels[i]});
            });
            const spans=await page.locator('#unfire-mobile-site-nav a').evaluateAll(nodes=>nodes.map(a=>{
              const r=a.getBoundingClientRect();return {left:r.left,right:r.right,scroll:a.scrollWidth,client:a.clientWidth};
            }));
            spans.forEach((x,i)=>{assert.ok(x.right<=width+1 && x.scroll<=x.client+1,`${width} translated link ${i} clipped`);});
          }
        } else {
          assert.equal(closed.buttonDisplay,'none',`${width} desktop should not have mobile button`);
          assert.notEqual(closed.navDisplay,'none',`${width} desktop nav should remain visible`);
        }
        process.stdout.write(`PASS ${width}x${height} header/menu/overlap\n`);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
