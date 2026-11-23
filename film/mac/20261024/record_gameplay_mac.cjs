'use strict';
/**
 * Continuous real player gameplay recording on Mac's actual hardware GPU.
 * Independent Chrome profile and read-only game clone. No cinematic flycam,
 * pictures, mock frames, fake 60fps or cuts in this master clip.
 */
const {chromium}=require('playwright');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const GAME=path.resolve(process.argv[2]||'');
const OUT=path.resolve(process.argv[3]||path.join(__dirname,'output'));
const PORT=8898,SECS=30,FPS=30;
assert(fs.existsSync(path.join(GAME,'audio/maletin/game-engine-v50.js')),'Readonly game checkout required');
assert(fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
 'Real Chrome + native GPU required');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const run=(bin,args,opts={})=>execFileSync(bin,args,{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,...opts});
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:GAME,stdio:'ignore'});
 let browser;
 try{
  await pause(1400);
  browser=await chromium.launch({headless:false,
   executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
   args:['--enable-gpu-rasterization','--enable-zero-copy','--ignore-gpu-blocklist']});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+PORT+'/audio/maletin/index.html?quality=compact',
   {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.__mal?.setP&&window.__roamAPI?.enterRoam&&window.__REC?.set),null,{timeout:130000});
  await page.evaluate(()=>{
    window.__mal.setP(1);
    window.__roamAPI.enterRoam();
    document.getElementById('atmBtn')?.click();
    const r=window.__roamAPI.ROAMS;
    r.p.set(-120,4.5,215);r.h=95;r.flyH=95;r.fly=true;r.flyT=2;
    r.climbV=0;r.vy=0;r.wk=1;r.mini=false;r.yaw=.5;r.cy=.5;
    r.pitch=.11;r.cp=null;r.mode='3p';r.k={};
    window.__ROOM.R.userData.dayT=.76;
    if(window.__REC.on)window.__REC.set(false);
  });
  await page.waitForFunction(()=>window.__roamAPI.ROAMS.on&&window.ATM_OUT&&!window.__REC.on,
    null,{timeout:30000});
  const starting=await page.evaluate(()=>{
   const r=window.__roamAPI.ROAMS;
   return {pos:[r.p.x,r.p.z],height:r.h,player_mode:!window.__REC.on,
    canvas:[document.getElementById('cv').width,document.getElementById('cv').height]};
  });
  await page.evaluate(FPS=>{
   const stream=document.getElementById('cv').captureStream(FPS),chunks=[];
   const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']
     .find(x=>MediaRecorder.isTypeSupported(x));
   if(!mime)throw Error('Chrome cannot capture real WebGL canvas');
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:7500000});
   window.__PLAYCAP={chunks,recorder,
    stop:()=>new Promise((resolve,reject)=>{
     recorder.addEventListener('stop',async()=>{
      try{const b=new Uint8Array(await new Blob(chunks,{type:mime}).arrayBuffer());
       const a=[];for(let i=0;i<b.length;i+=12000)a.push(String.fromCharCode(...b.subarray(i,i+12000)));
       resolve(btoa(a.join('')));}catch(e){reject(String(e))}
     },{once:true});recorder.stop();
    })};
   recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data)});
   recorder.start(850);
   window.__roamAPI.ROAMS.k.w=1;
  },FPS);
  for(let i=0;i<SECS;i+=2){
    await pause(2000);
    await page.evaluate(i=>{
      // Actual input applied to the existing player physics, not a camera teleport.
      const r=window.__roamAPI.ROAMS;
      if(i>=12&&i<16)r.k.d=1;
      else r.k.d=0;
      r.k.w=1;
    },i);
  }
  const finish=await page.evaluate(()=>{
    const r=window.__roamAPI.ROAMS;r.k.w=0;r.k.d=0;
    return {pos:[r.p.x,r.p.z],height:r.h,player_mode:!window.__REC.on,exterior:window.ATM_OUT};
  });
  assert(finish.player_mode&&finish.exterior,'Continuous capture left genuine gameplay mode');
  const distance=Math.hypot(finish.pos[0]-starting.pos[0],finish.pos[1]-starting.pos[1]);
  assert(distance>4,'Real avatar did not travel, refusing to present frozen gameplay: '+distance);
  const b64=await page.evaluate(()=>window.__PLAYCAP.stop());
  const raw=path.join(OUT,'UNFIRE_GAMEPLAY_REAL_CONTINUO.webm');
  fs.writeFileSync(raw,Buffer.from(b64,'base64'));
  const mp4=path.join(OUT,'UNFIRE_GAMEPLAY_REAL_CONTINUO.mp4');
  run('ffmpeg',['-v','error','-y','-i',raw,'-c:v','libx264','-preset','fast','-crf','19',
    '-pix_fmt','yuv420p','-movflags','+faststart',mp4],{timeout:300000});
  const probe=JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-count_frames',
    '-show_entries','stream=nb_read_frames,width,height','-show_entries','format=duration,size',
    '-of','json',mp4]));
  const count=+(probe.streams?.[0]?.nb_read_frames||0);
  const duration=+probe.format.duration;
  const fps=count/Math.max(.001,duration);
  const report={file:mp4,actual_game:true,continuous:true,scene:'in-engine robot player flight',
    camera_mode:'3p',engine: 'game-engine-v50.js', no_artificial_frames:true,
    elapsed_seconds:duration,frames:count,actual_fps:fps,travel_units:distance,
    source_game:GAME,pass:fps>=22&&duration>=20&&distance>4,
    release_ready:false};
  fs.writeFileSync(path.join(OUT,'GAMEPLAY_QA.json'),JSON.stringify(report,null,2));
  console.log('UNFIRE_REAL_CONTINUOUS_GAMEPLAY',JSON.stringify(report));
  if(!report.pass)process.exitCode=2;
  await context.close();
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error('UNFIRE_GAMEPLAY_CAPTURE_FAILED',e.stack||e);process.exitCode=1});
