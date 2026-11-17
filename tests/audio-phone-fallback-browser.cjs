'use strict';
// Browser smoke: catch accidental 3D engine downloads on phones, not an FPS benchmark.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css',
  '.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.mp3':'audio/mpeg','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400).end();return;}
  let file=path.resolve(root,'.'+pathname);
  if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403).end();return;}
  try {
    const st=fs.statSync(file);
    if(st.isDirectory())file=path.join(file,'index.html');
    const data=fs.readFileSync(file);
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data);
  }catch(e){res.writeHead(404,{'content-type':'text/plain'}).end('Not found');}
});
const uaPhone='Mozilla/5.0 (Linux; Android 15; moto g06 power) AppleWebKit/537.36 Chrome/127.0.0.0 Mobile Safari/537.36';
const uaTablet='Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36';
const uaDesktop='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36';
let browser;
async function contextFor(ua,isMobile,hasTouch,width,height){
  return browser.newContext({userAgent:ua,isMobile,hasTouch,viewport:{width,height},deviceScaleFactor:1});
}
function gameRequests(list){return list.filter(u=>/\/audio\/maletin\/index\.html|game-engine-v50\.js/.test(u));}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    // 1: Motorola must see a usable site without creating WebGL or fetching the 3D game.
    {
      const ctx=await contextFor(uaPhone,true,true,393,850);
      const page=await ctx.newPage(),requests=[];
      page.on('request',r=>requests.push(r.url()));
      await page.addInitScript(()=>{
        window.__unfireWebGLAttempts=0;
        const orig=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){
          if(kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl')window.__unfireWebGLAttempts++;
          return orig.call(this,kind,...args);
        };
      });
      await page.goto(origin+'/audio/',{waitUntil:'domcontentloaded',timeout:25000});
      await page.locator('#ufPhoneNotice').waitFor({state:'visible',timeout:10000});
      await page.waitForTimeout(1300);
      assert.equal(await page.locator('#malFrame').getAttribute('src'),null,'phone must not attach game iframe src');
      assert.equal(gameRequests(requests).length,0,'phone host must not request the game engine');
      assert.equal(await page.evaluate(()=>window.__unfireWebGLAttempts),0,'phone host must not probe WebGL');
      assert.match(await page.locator('#ufPhoneTitle').innerText(),/bigger screen/i);
      assert.ok(await page.locator('#ufPhoneNotice a.ufPhoneCta').isVisible());
      console.log('PASS browser Motorola landing: static notice, 0 game requests, 0 WebGL contexts');
      await ctx.close();
    }
    // 2: A direct Android link must redirect to the safe host before engine fetch.
    {
      const ctx=await contextFor(uaPhone,true,true,393,850);
      const page=await ctx.newPage(),requests=[];
      page.on('request',r=>requests.push(r.url()));
      await page.goto(origin+'/audio/maletin/index.html?quality=compact',{waitUntil:'domcontentloaded',timeout:25000});
      await page.waitForURL(url=>url.pathname==='/audio/',{timeout:10000});
      await page.locator('#ufPhoneNotice').waitFor({state:'visible',timeout:10000});
      assert.equal(requests.filter(u=>/game-engine-v50\.js/.test(u)).length,0,'direct phone route must not preload engine');
      console.log('PASS direct Android game URL redirected before engine download');
      await ctx.close();
    }
    // 3: Desktop and tablets retain existing game route; route the heavy engine to a stub.
    for(const [label,ua,isMobile,hasTouch,width,height] of [
      ['desktop',uaDesktop,false,false,1440,900],
      ['tablet',uaTablet,false,true,800,1100]
    ]){
      const ctx=await contextFor(ua,isMobile,hasTouch,width,height);
      const page=await ctx.newPage();
      await page.route('**/audio/maletin/index.html*',route=>route.fulfill({
        status:200,contentType:'text/html',body:'<!doctype html><title>Game QA fixture</title><script>window.__mal={S:{}};</script>'
      }));
      await page.goto(origin+'/audio/',{waitUntil:'domcontentloaded',timeout:25000});
      await page.waitForFunction(()=>!!document.getElementById('malFrame')?.getAttribute('src'),{timeout:10000});
      assert.ok(!await page.locator('#ufPhoneNotice').isVisible(),label+' must not show phone-only message');
      assert.match(await page.locator('#malFrame').getAttribute('src'),/maletin\/index\.html/);
      console.log('PASS browser '+label+': original game route preserved (engine stubbed)');
      await ctx.close();
    }
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
