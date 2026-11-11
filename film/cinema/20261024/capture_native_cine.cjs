'use strict';
/* FilmStudio isolated REAL-CINE capture: actual running Three.js game via
   the built-in V/__REC spectator camera and actual day-night world.
   No stills, image generation, frame interpolation or engine edits.
   This produces a review-only artifact, never writes to the public website. */
const {chromium}=require('playwright');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..');
const OUT=path.join(__dirname,'output');
const PORT=8874;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const timeout=+(process.env.UNFIRE_CINE_SECONDS||0);
const secs=timeout?Math.max(4,Math.min(timeout,12)):7;
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:ROOT,stdio:'ignore'});
  let browser;
  try{
    await sleep(1200);
    browser=await chromium.launch({headless:true,args:[
      '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader',
      '--enable-webgl','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'
    ]});
    const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1});
    const page=await context.newPage();
    page.setDefaultTimeout(30000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,230)));
    const res=await page.goto('http://127.0.0.1:'+PORT+'/audio/maletin/index.html?quality=compact',{
      waitUntil:'domcontentloaded',timeout:45000
    });
    assert.equal(res.status(),200);
    await page.waitForFunction(()=>!!(window.__mal?.setP&&window.__roamAPI?.enterRoam&&window.__REC?.set&&window.__ROOM?.R?.userData),null,{timeout:150000,polling:500});
    await page.evaluate(()=>{
      window.__mal.setP(1);
      window.__roamAPI.enterRoam();
      const btn=document.getElementById('atmBtn');
      if(!btn)throw Error('Real outdoor button missing');
      btn.click();
    });
    await page.waitForFunction(()=>window.ATM_OUT===true&&window.__roamAPI.ROAMS.on,null,{timeout:35000,polling:250});
    await page.evaluate(()=>{
      const r=window.__roamAPI.ROAMS;
      r.k={};r.on=true;r.mini=false;r.mode='3pl';r.fly=true;
      r.p.set(-270,4.5,440);r.h=240;r.flyH=240;r.yaw=0.58;r.pitch=0.20;r.cp=null;
      window.__ROOM.R.userData.dayT=0.76;
      window.__REC.set(true);
      if(!window.__REC.on)throw Error('Built-in cinema mode did not activate');
      const c=window.__REC;
      c.p.set(-270,180,440);c.yaw=0.58;c.pitch=-0.26;
      c.cy=c.yaw;c.cpch=c.pitch;c.k={};
    });
    await page.waitForFunction(()=>window.__ROOM.R.userData.dl<0.18,null,{timeout:50000,polling:350});
    await sleep(2500);
    const before=await page.evaluate(()=>{
      const c=window.__REC,cv=document.getElementById('cv');
      return {cine:c.on,out:window.ATM_OUT,night:window.__ROOM.R.userData.dl<0.18,
        w:cv.width,h:cv.height,position:[c.p.x,c.p.y,c.p.z],
        mediaRecorder:typeof MediaRecorder,canvasCapture:typeof cv.captureStream};
    });
    console.log('NATIVE_CINE_START',JSON.stringify(before));
    assert(before.cine&&before.out&&before.night&&before.w>100&&before.h>100);
    assert(before.mediaRecorder==='function'&&before.canvasCapture==='function',
      'Actual canvas streaming unsupported by browser');
    await page.evaluate(()=>{
      const cv=document.getElementById('cv');
      const stream=cv.captureStream(24);const chunks=[];
      const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
         ? 'video/webm;codecs=vp8':'video/webm';
      const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000});
      window.__CINE_CAPTURE={
        chunks,rec,stream,mime,
        stop:()=>new Promise((resolve,reject)=>{
          rec.addEventListener('stop',async()=>{
            try{
              const blob=new Blob(chunks,{type:mime});
              const buf=new Uint8Array(await blob.arrayBuffer());
              const payload=[];
              for(let i=0;i<buf.length;i+=16384)
                payload.push(String.fromCharCode(...buf.subarray(i,i+16384)));
              resolve({b64:btoa(payload.join('')),bytes:buf.length});
            }catch(e){reject(String(e));}
          },{once:true});rec.stop();
        })
      };
      rec.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data)});
      rec.start(1000);
      window.__REC.k.w=1;window.__REC.k.d=0;
    });
    await sleep(secs*1000);
    const moved=await page.evaluate(()=>{
      const c=window.__REC;
      c.k.w=0;
      return {cinema:c.on,point:[c.p.x,c.p.y,c.p.z], night:window.__ROOM.R.userData.dl<.18,
        exterior:window.ATM_OUT,canvasVisible:document.getElementById('cv')?.width>10}
    });
    console.log('NATIVE_CINE_END',JSON.stringify(moved));
    assert(moved.cinema&&moved.exterior&&moved.night&&moved.canvasVisible);
    const displacement=Math.hypot(...moved.point.map((v,i)=>v-before.position[i]));
    assert(displacement>1.5,'Built-in cinema camera did not travel: '+displacement);
    const result=await page.evaluate(()=>window.__CINE_CAPTURE.stop());
    const src=path.join(OUT,'UNFIRE_CINE_REAL_NIGHT_RAW.webm');
    fs.writeFileSync(src,Buffer.from(result.b64,'base64'));
    assert(fs.statSync(src).size>60000,'Real-time WebGL canvas recording is unexpectedly tiny');
    const mp4=path.join(OUT,'UNFIRE_CINE_REAL_NIGHT_TEST.mp4');
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',src,
      '-c:v','libx264','-crf','23','-preset','veryfast','-pix_fmt','yuv420p',
      '-movflags','+faststart',mp4],{timeout:200000});
    const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0',
      '-show_entries','stream=width,height,avg_frame_rate,nb_frames,duration',
      '-show_entries','format=duration,size','-of','json',mp4],{encoding:'utf8'}));
    // Distinct encoded frames are necessary but not sufficient for fluid capture.
    const fmt=metadata.streams?.[0];assert(fmt?.width>600&&fmt?.height>300);
    assert(+metadata.format.duration>3,'Actual video shorter than 3s');
    // Detect exact-frame repetition at 1fps; a photo pan also passes this test,
    // but no photo/image is used anywhere in this capture.
    const framehash=execFileSync('ffmpeg',['-v','error','-i',mp4,'-vf','fps=1,scale=80:45,format=gray',
      '-f','framemd5','-'],{encoding:'utf8'});
    const unique=new Set(framehash.split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split(',').at(-1).trim())).size;
    assert(unique>=3,'Real engine recording appears frozen: '+unique);
    const report={actual_running_game:true,real_cine_mode_v:before.cine,
      built_in_cine_mode:before.cine,night_world:before.night,no_still_frames_used:true,
      no_engine_changes:true,displacement_world_units:displacement,
      result:mp4.split('/').at(-1),seconds:+metadata.format.duration,
      stream:fmt,unique_one_second_frames:unique,bytes:fs.statSync(mp4).size,
      visual_hardware_QA_completed:false,
      caveat:'Headless software GPU. No claim of full-map visibility, true 60 fps, final cinema quality or publish readiness.',
      console_errors:errors};
    fs.writeFileSync(path.join(OUT,'CAPTURE_DIAGNOSTICS.json'),JSON.stringify(report,null,2));
    console.log('AUTHENTIC_CINE_GAMEPLAY_RECORDING',JSON.stringify(report));
    await context.close();
  }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error('CINE_REAL_CAPTURE_FAILED',e.stack||e);process.exitCode=1});
