#!/usr/bin/env node
/**
 * Unfire Hyperwave 2000 — authentic high-frame-rate transformation capture.
 * Renders the ACTUAL local WebGL instrument in audio/hyperwave (no interpolation
 * of old stills, no synthetic/AI-generated frames) and encodes an all-intra MP4
 * for low-latency scroll scrubbing in Safari/Chrome.
 *
 * Serve this repository locally; example:
 *   python3 -m http.server 8174
 *   PUPPETEER_CORE=/path/to/node_modules/puppeteer-core \
 *     node hyperwave-hardware/tools/build-theatre-video.cjs http://127.0.0.1:8174
 *
 * Captures are digital concept visualisations, NOT physical hardware footage.
 */
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');
const base=(process.argv[2]||'http://127.0.0.1:8174').replace(/\/$/,'');
const N=Number(process.env.CAP_FRAMES||240),FPS=Number(process.env.CAP_FPS||50);
const width=Number(process.env.CAP_W||1280),height=Number(process.env.CAP_H||720);
const out=path.resolve(__dirname,'../media/hyperwave-2000-transformation-50fps.mp4');
const frames=fs.mkdtempSync(path.join(os.tmpdir(),'unfire-hw-theatre-'));
const chrome=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const smooth=t=>t*t*(3-2*t);
(async()=>{
 if(!(N>=2&&N<=1000&&FPS>=24&&FPS<=120))throw Error('Invalid frames or frame rate');
 const browser=await pc.launch({executablePath:chrome,headless:'new',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required','--no-first-run'],defaultViewport:{width,height,deviceScaleFactor:1}});
 try {
   const page=await browser.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base+'/audio/hyperwave/?atelier=1',{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(()=>window.__hw&&document.body.classList.contains('ready'),{timeout:90000});
   await page.addStyleTag({content:'.brand,#hint,.keys,#load,#restore{display:none!important}'});
   await page.evaluate(()=>window.__hw.pause(true));
   for(let i=0;i<N;i++){
     const u=i/(N-1),T=4*u,az=0.52-0.23*smooth(u),el=0.35+0.04*smooth(u);
     await page.evaluate(({T,az,el})=>window.__hw.renderAt(T,az,el,0.72),{T,az,el});
     await page.screenshot({path:path.join(frames,'frame-'+String(i).padStart(4,'0')+'.jpg'),type:'jpeg',quality:90});
     if(i%30===0||i===N-1)console.log('captured',i+1,'/',N);
   }
   if(errors.length)throw Error('WebGL page errors: '+errors.join('; '));
 }finally{await browser.close();}
 const ff=['-hide_banner','-loglevel','error','-y','-framerate',String(FPS),'-i',path.join(frames,'frame-%04d.jpg'),'-an','-c:v','libx264','-preset','medium','-crf','25','-g','1','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=Hyperwave 2000 - Continuous digital transformation','-metadata','comment=Authentic capture from the real-time digital instrument; not physical hardware',out];
 cp.execFileSync('ffmpeg',ff,{stdio:'inherit'});
 console.log('RESULT',out,'frames',N,'fps',FPS,'bytes',fs.statSync(out).size);
 if(!process.env.KEEP_FRAMES)fs.rmSync(frames,{recursive:true,force:true});
})().catch(e=>{console.error(e);console.error('Capture frames (if any):',frames);process.exit(1)});
