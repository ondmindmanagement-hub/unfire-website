'use strict';
// UI-only remote Chromium QA. No game engine or WebGL is started.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const css=fs.readFileSync('audio/maletin/expanded-map.css','utf8');
const js=fs.readFileSync('audio/maletin/expanded-map.js','utf8');
const cases=[
 ['iphone-se-portrait',320,568,true],
 ['iphone-portrait',390,844,true],
 ['iphone-landscape',844,390,true],
 ['short-landscape',568,320,true],
 ['ipad-portrait',820,1180,true],
 ['ipad-landscape',1180,820,true],
 ['desktop',1280,800,false],
];
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for(const [name,width,height,mobile] of cases){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});
      try{
        const page=await context.newPage();
        await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><button id="under">UNDER GAME</button></body></html>');
        await page.addStyleTag({content:css});
        await page.addScriptTag({content:js});
        await page.evaluate(()=>{
          window.testClicks=0;document.getElementById('under').onclick=()=>{window.testClicks++;};
          window.mapAPI=window.UnfireExpandedMap.create(()=>({zone:'island',x:25,z:50,yaw:.5,objective:{x:600,z:0}}),()=>{});
          window.mapAPI.show();
        });
        const s=await page.evaluate(()=>{
          const r=(q)=>{const a=document.querySelector(q).getBoundingClientRect();return {x:a.left,y:a.top,w:a.width,h:a.height,right:a.right,bottom:a.bottom};};
          const c=document.querySelector('#ufMapCanvas');
          return {panel:r('#ufMapPanel'),canvas:r('#ufMapCanvas'),header:r('#ufMapHeader'),
            footer:r('#ufMapFooter'),close:r('#ufMapClose'),plus:r('#ufMapPlus'),
            minus:r('#ufMapMinus'),center:r('#ufMapCenter'),
            bitmap:c.width*c.height,open:window.mapAPI.isOpen,
            overflowX:document.documentElement.scrollWidth>innerWidth+1,
            overflowY:document.documentElement.scrollHeight>innerHeight+1};
        });
        assert(s.open,name+': dialog must open');
        assert(s.panel.x>=0&&s.panel.right<=width+1&&s.panel.y>=0&&s.panel.bottom<=height+1,name+': panel outside viewport '+JSON.stringify(s));
        assert(s.canvas.w>200&&s.canvas.h>=105,name+': map drawing area too small '+JSON.stringify(s));
        assert(s.canvas.bottom<=s.footer.y+1,name+': canvas overlaps footer');
        for(const key of ['close','plus','minus','center']){
          assert(s[key].w>=36&&s[key].h>=35,name+': inaccessible control '+key);
          assert(s[key].x>=0&&s[key].right<=width+1,name+': control beyond safe area '+key);
        }
        assert(s.bitmap<=1505000,name+': oversized canvas bitmap');
        assert(!s.overflowX&&!s.overflowY,name+': page scroll behind map');
        await page.locator('#ufMapPlus').click();
        await page.locator('#ufMapCenter').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(()=>window.mapAPI.isOpen),false,name+': Escape did not close');
        assert.equal(await page.evaluate(()=>window.testClicks),0,name+': unexpected background click');
        await page.evaluate(()=>window.mapAPI.show());
        await page.locator('#ufMapClose').click();
        assert.equal(await page.evaluate(()=>window.mapAPI.isOpen),false,name+': close button did not close');
        console.log('EXPANDED_MAP_UI_PASS',name,JSON.stringify({canvas:s.canvas,bitmap:s.bitmap}));
      }finally{await context.close();}
    }
  }finally{await browser.close();}
})().catch(err=>{console.error('EXPANDED_MAP_UI_FAIL',err.stack||err);process.exitCode=1;});
