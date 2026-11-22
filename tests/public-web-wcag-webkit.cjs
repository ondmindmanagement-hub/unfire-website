"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {webkit}=require("playwright");
const BASE="http://127.0.0.1:8765";
const axePath=require.resolve("axe-core/axe.min.js");
const paths=[
"/apps/","/apps/archer-web/","/apps/ai-token-counter/","/portable-synth/studio/",
"/games/y2k-robots/","/autonomy/demo/","/apps/power-web/","/apps/banner-fit/",
"/apps/privacy-lens/","/apps/file-prep/","/mutants/","/archer/",
"/apps/pocket-capture/","/apps/power/","/bolt/","/apps/bolt-mobile/","/apps/unfire-control/"
];
const widths=[390,1440];
const tags=["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"];
(async()=>{
 const b=await webkit.launch({headless:true});
 const problems=[];
 const dir=path.resolve("artifacts/public-wcag");
 fs.mkdirSync(dir,{recursive:true});
 try{
  for(const width of widths){
   for(const route of paths){
    const ctx=await b.newContext({viewport:{width,height:900},reducedMotion:"reduce",locale:"en-US"});
    try{
     await ctx.addInitScript({path:axePath});
     const page=await ctx.newPage();
     const res=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:25000});
     assert.equal(res.status(),200,route+" page missing");
     await page.waitForFunction(()=>Boolean(window.axe),null,{timeout:10000});
     await page.evaluate(async()=>{if(document.fonts)await document.fonts.ready;});
     const data=await page.evaluate(async(tags)=>{
       const r=await window.axe.run(document,{runOnly:{type:"tag",values:tags}});
       return {violation:r.violations.map(v=>({id:v.id,impact:v.impact,
         nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html.slice(0,240)}))})),
         incomplete:r.incomplete.length,passed:r.passes.length};
     },tags);
     const severe=data.violation.filter(v=>v.impact==="critical"||v.impact==="serious");
     console.log("AXE",route,width,"severe",severe.length,"passes",data.passed,"incomplete",data.incomplete);
     if(severe.length)problems.push({route,width,severe});
     if(severe.length){
      await page.screenshot({path:path.join(dir,route.replace(/\W+/g,"_")+"_"+width+".png"),fullPage:true,animations:"disabled"});
     }
     if(width===390){
      const scroll=await page.evaluate(()=>{
       window.scrollTo(5000,0);
       const shifted=Math.abs(window.scrollX);
       window.scrollTo(0,0);
       return shifted;
      });
      if(scroll>2&&route!=="/archer/")problems.push({route,width,horizontalScroll:scroll});
     }
    }finally{await ctx.close();}
   }
  }
 }finally{await b.close();}
 fs.writeFileSync(path.join(dir,"audit.json"),JSON.stringify({cases:paths.length*widths.length,problems},null,2));
 if(problems.length) {
  console.error("WEBKIT_WCAG_GATES_FAILED",JSON.stringify(problems).slice(0,14000));
  process.exitCode=1;
 }else console.log("WEBKIT_WCAG_GATES_PASS",paths.length*widths.length);
})().catch(e=>{console.error(e);process.exitCode=1;});