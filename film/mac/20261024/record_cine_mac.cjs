'use strict';
/**
 * MAC-ONLY | Real M3 Pro GPU capture of built-in Unfire Cinema mode V.
 * Read-only game copy, independent Chrome window/profile, no publication.
 * No still photos, no mocked engine, no fake/inferred 60 FPS.
 * Invocation:
 *   node record_cine_mac.cjs /path/to/unfire-website /path/to/FilmStudio/Cinema
 * Local dependencies: playwright, Google Chrome, ffmpeg, python3.
 */
const {chromium}=require('playwright');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const GAME=path.resolve(process.argv[2]||'');
const OUT=path.resolve(process.argv[3]||path.join(__dirname,'output'));
const PORT=8897, FPS=30;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
assert(fs.existsSync(path.join(GAME,'audio/maletin/game-engine-v50.js')),'Game copy missing. No changes to the live project are allowed.');
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
assert(fs.existsSync(chrome),'Google Chrome not installed; no fallback to software-rendered Chromium.');
fs.mkdirSync(OUT,{recursive:true});
const run=(bin,args,opts={})=>execFileSync(bin,args,{encoding:'utf8',maxBuffer:8*1024*1024,timeout:120000,...opts});
assert(/ffmpeg version/.test(run('ffmpeg',['-version']).split('\n')[0]),'ffmpeg required to QA recordings.');
const SCENES=[
 {id:'01-ROBOT-HOUSE',pos:[-15,5,45],yaw:0.95,pitch:-0.06,day:0.76,out:false,secs:6,move:'w'},
 {id:'02-NIGHT-ISLANDS-WIDE',pos:[-270,240,440],yaw:0.58,pitch:-0.31,day:0.76,out:true,secs:9,move:'w'},
 {id:'03-NIGHT-COAST',pos:[-110,88,205],yaw:0.45,pitch:-0.13,day:0.76,out:true,secs:8,move:'w'},
 {id:'04-ISLANDS-AND-SPACE',pos:[-270,1150,440],yaw:0.58,pitch:0.19,day:0.76,out:true,secs:7,move:'w'},
 {id:'05-SUNSET-COAST',pos:[-105,92,195],yaw:0.45,pitch:-0.09,day:0.49,out:true,secs:7,move:'w'},
 {id:'06-HOUSE-AND-ROBOTS',pos:[-48,24,175],yaw:2.52,pitch:-0.1,day:0.76,out:true,secs:7,move:'w'}
];
function inspect(file){
 const d=JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-count_frames',
 '-show_entries','stream=width,height,nb_read_frames,avg_frame_rate,duration',
 '-show_entries','format=duration,size','-of','json',file]));
 const v=d.streams?.[0],frames=Number(v.nb_read_frames||0),duration=Number(d.format.duration||0);
 const fps=frames/Math.max(0.01,duration);
 const md5=run('ffmpeg',['-v','error','-i',file,'-vf','fps=1,scale=100:56,format=gray','-f','framemd5','-']);
 const unique=new Set(md5.split('\n').filter(s=>s&&!s.startsWith('#')).map(s=>s.split(',').at(-1).trim())).size;
 return {frames,duration,fps,unique,width:v?.width,height:v?.height,bytes:Number(d.format.size||0),
   pass:frames>=Math.max(45,duration*22)&&fps>=22&&unique>=3&&duration>=4&&Number(d.format.size)>80000};
}
(async()=>{
 const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:GAME,stdio:'ignore'});
 let browser;
 const manifest={device:'authorized Mac',source:GAME,engine:'game-engine-v50.js',
   mode:'native __REC / V',real_gameplay:true,synthetic_frames:false,
   visual_asset_generation:false,published:false,fps_target:FPS,scenes:[],started_at:new Date().toISOString()};
 try{
  await pause(1500);
  browser=await chromium.launch({headless:false,executablePath:chrome,args:[
     '--enable-gpu-rasterization','--enable-zero-copy','--ignore-gpu-blocklist',
     '--autoplay-policy=no-user-gesture-required'
  ]});
  const context=await browser.newContext({viewport:{width:1280,height:720},
     deviceScaleFactor:1,permissions:[]});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message).slice(0,220)));
  const entry=await page.goto('http://127.0.0.1:'+PORT+'/audio/maletin/index.html?quality=compact',
    {waitUntil:'domcontentloaded',timeout:55000});
  assert.equal(entry.status(),200);
  await page.waitForFunction(()=>Boolean(window.__mal?.setP&&window.__roamAPI?.enterRoam&&window.__REC?.set&&window.__ROOM?.R?.userData),null,
    {timeout:150000,polling:250});
  await page.evaluate(()=>{
    window.__mal.setP(1);window.__roamAPI.enterRoam();
    // Real in-engine camera; disable UI overlay only, not any world meshes.
    const style=document.createElement('style');
    style.textContent='#recHud,#howto,#directOpen{visibility:hidden!important}';
    document.head.appendChild(style);
  });
  await page.waitForFunction(()=>window.__roamAPI?.ROAMS?.on,null,{timeout:30000});
  let passCount=0;
  for(const scene of SCENES){
    const starting=await page.evaluate(scene=>{
      const atm=document.getElementById('atmBtn');
      if(!window.__roamAPI.ROAMS.on)window.__roamAPI.enterRoam();
      if(scene.out!==Boolean(window.ATM_OUT)){
        if(atm)atm.click();
      }
      // Use real native outdoor/indoor world and time-of-day cycle.
      window.__ROOM.R.userData.dayT=scene.day;
      if(window.__REC.on)window.__REC.set(false);
      window.__REC.set(true);
      if(!window.__REC.on)throw Error('Native cinema V camera did not activate');
      const c=window.__REC;c.p.set(...scene.pos);
      c.yaw=scene.yaw;c.pitch=scene.pitch;c.cy=c.yaw;c.cpch=c.pitch;c.cq=1;
      c.v.set(0,0,0);c.k={};
      const cv=document.getElementById('cv');
      return {pos:[...scene.pos],inside:!window.ATM_OUT,cine:c.on,
       width:cv.width,height:cv.height}
    },scene);
    if(!starting.cine)throw Error('Cine not running');
    await page.waitForFunction(scene=>scene.out===Boolean(window.ATM_OUT),scene,{timeout:30000});
    if(scene.day>.7){
      await page.waitForFunction(()=>window.__ROOM.R.userData.dl<0.2,null,{timeout:35000});
    }
    await pause(1300);
    await page.evaluate(FPS=>{
       const cv=document.getElementById('cv');
       const candidates=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
       const mime=candidates.find(x=>MediaRecorder.isTypeSupported(x));
       if(!mime)throw Error('No supported native Chrome MediaRecorder video codec');
       const chunks=[];const stream=cv.captureStream(FPS);
       const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
       window.__FILM={chunks,stream,recorder,mime,
          stop:()=>new Promise((resolve,reject)=>{
           recorder.addEventListener('stop',async()=>{
            try{
             const blob=new Blob(chunks,{type:mime});
             const b=new Uint8Array(await blob.arrayBuffer());
             const result=[];
             for(let i=0;i<b.length;i+=12000)
               result.push(String.fromCharCode(...b.subarray(i,i+12000)));
             resolve({b64:btoa(result.join('')),length:b.length,mime});
            }catch(e){reject(String(e))}
           },{once:true});
           recorder.stop();
          })
       };
       recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data)});
       recorder.start(800);
    },FPS);
    await page.evaluate(s=>{window.__REC.k={};window.__REC.k[s.move]=1;},scene);
    await pause(scene.secs*1000);
    const end=await page.evaluate(()=>{
       const r=window.__REC;r.k={};
       return {pos:[r.p.x,r.p.y,r.p.z],cine:r.on,exterior:Boolean(window.ATM_OUT),
          light:window.__ROOM.R.userData.dl,canvasSize:document.getElementById('cv').width}
    });
    const cameraDistance=Math.hypot(...end.pos.map((v,i)=>v-starting.pos[i]));
    const data=await page.evaluate(()=>window.__FILM.stop());
    const webm=path.join(OUT,scene.id+'.webm');
    fs.writeFileSync(webm,Buffer.from(data.b64,'base64'));
    const mp4=path.join(OUT,scene.id+'.mp4');
    run('ffmpeg',['-v','error','-y','-i',webm,'-c:v','libx264','-preset','fast','-crf','19',
      '-pix_fmt','yuv420p','-movflags','+faststart',mp4],{timeout:240000});
    const qa=inspect(mp4);
    const okay=qa.pass&&cameraDistance>2&&end.cine&&end.exterior===scene.out&&
     (scene.day<.7||end.light<.2);
    const result={scene:scene.id,real_moving_camera_units:cameraDistance,qa,okay,
      error_count:errors.length,night_level:end.light};
    manifest.scenes.push(result);if(okay)passCount++;
    console.log('UNFIRE_MAC_NATIVE_CINE',JSON.stringify(result));
  }
  manifest.finished_at=new Date().toISOString();manifest.pass_count=passCount;
  manifest.total_scenes=SCENES.length;
  manifest.release_ready=false;
  manifest.next='Human review then story trailer and separate honest gameplay edit; do not publish.';
  fs.writeFileSync(path.join(OUT,'QA_MANIFEST.json'),JSON.stringify(manifest,null,2));
  console.log('UNFIRE_CINE_CAPTURE_REPORT',JSON.stringify({passCount,total:SCENES.length,output:OUT}));
  if(passCount<SCENES.length)process.exitCode=2; // fail closed, preserve clips for diagnosis
  await context.close();
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
})().catch(e=>{console.error('UNFIRE_MAC_CINE_ERROR',e.stack||e);process.exitCode=1});
