'use strict';
// Shared Unfire global bar: present once, in flow, never covered, 7 items, keyboard reachable.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..');
const BASE=process.env.UNFIRE_GLOBAL_BAR_URL||'http://127.0.0.1:8772';
const routes=JSON.parse(execFileSync('python3',['-c',
 "import importlib.util,json,sys;s=importlib.util.spec_from_file_location('a','scripts/apply-global-bar.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps([m.route(r) for r in m.targets()]))"],{cwd:ROOT}).toString());
const LABELS=['Products','AI & Systems','Audio','Games','For Business','Company','Contact'];
const PADDED=new Set(['/audio-shield-privacy.html']);   // body is a padded column; bar sits inside it
const CLIPPED=new Set(['/archer/']);                      // decorative wordmark is clipped by design
(async()=>{
  assert.ok(routes.length>=60,'expected the public page set');
  const b=await chromium.launch();
  const fails=[];
  try{
    for(const width of [390,1440]){
      const ctx=await b.newContext({viewport:{width,height:900}});
      for(const r of routes){
        const page=await ctx.newPage();
        const res=await page.goto(BASE+r,{waitUntil:'load',timeout:25000});
        if(res.status()!==200){fails.push(`${width} ${r} HTTP ${res.status()}`);await page.close();continue;}
        const m=await page.evaluate(()=>{
          const bars=document.querySelectorAll('#unfire-global-bar');const bar=bars[0];if(!bar)return {count:0};
          const bb=bar.getBoundingClientRect();
          const hit=document.elementFromPoint(bb.left+24,bb.top+bb.height/2);
          const covering=[];
          for(const el of document.body.querySelectorAll('*')){
            if(bar.contains(el)||el.closest('[aria-hidden="true"]'))continue;
            const cs=getComputedStyle(el);if(!['absolute','fixed','sticky'].includes(cs.position))continue;
            const r=el.getBoundingClientRect();if(r.width<20||r.height<10||cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)continue;
            if(r.top<bb.bottom-1&&r.bottom>bb.top+1)covering.push(el.tagName+'.'+String(el.className).split(' ')[0]);
          }
          const links=[...bar.querySelectorAll('.ugb-links a')].map(a=>a.textContent.trim());
          return {count:bars.length,top:Math.round(bb.top),h:Math.round(bb.height),ownHit:!!(hit&&bar.contains(hit)),covering,links,
            current:bar.querySelectorAll('.ugb-links a[aria-current]').length,
            styled:getComputedStyle(bar).backgroundColor==='rgb(29, 29, 31)',
            overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
        });
        const t=`${width} ${r}`;
        if(m.count!==1){fails.push(`${t}: ${m.count} bars`);await page.close();continue;}
        if(!m.styled)fails.push(`${t}: bar stylesheet blocked or missing`);
        if(!PADDED.has(r)&&m.top!==0)fails.push(`${t}: bar not at top (${m.top})`);
        if(m.h!==55)fails.push(`${t}: bar height ${m.h}`);
        if(!m.ownHit)fails.push(`${t}: bar covered`);
        if(m.covering.length)fails.push(`${t}: positioned element over bar ${m.covering.join(',')}`);
        assert.deepEqual(m.links,LABELS,`${t}: items`);
        if(m.current!==1)fails.push(`${t}: ${m.current} current items`);
        if(!CLIPPED.has(r)&&m.overflow>2)fails.push(`${t}: horizontal overflow ${m.overflow}`);
        if(width===390){
          await page.click('#unfire-global-bar summary');
          const open=await page.locator('#unfire-global-bar .ugb-menu a').evaluateAll(a=>a.filter(x=>x.getBoundingClientRect().height>=44).length);
          if(open!==7)fails.push(`${t}: compact menu shows ${open}/7 targets >=44px`);
        }
        await page.close();
      }
      await ctx.close();
    }
  }finally{await b.close();}
  if(fails.length){console.error('GLOBAL_BAR_FAILED\n'+fails.join('\n'));process.exitCode=1;}
  else console.log(`GLOBAL_BAR_PASS ${routes.length} pages x 2 widths`);
})().catch(e=>{console.error(e);process.exitCode=1;});
