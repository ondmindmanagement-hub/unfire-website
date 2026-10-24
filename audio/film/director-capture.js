/* Unfire Film · non-public production helper. Deliberately NOT loaded by the public game.
 * A local authorized browser can inject it for real in-engine camera takes.
 * No credentials, sockets, telemetry, hidden controls or privileged game mutations. */
(function () {
  'use strict';
  if (window.UnfireFilmDirector) return;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const vec=(v)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  const state={recording:null,shot:null,raf:0};
  const camera=()=>window.__dbg&&window.__dbg.S&&window.__dbg.S.camera;
  const canvas=()=>window.__dbg&&window.__dbg.S&&window.__dbg.S.renderer&&window.__dbg.S.renderer.domElement;
  const free=()=>window.__REC;
  const supported=()=>!!(camera()&&canvas()&&free()&&window.MediaRecorder&&canvas().captureStream);
  function goto(position,target){
    if(!vec(position)||!vec(target))throw Error('Camera and focus must be 3 finite numbers.');
    const rec=free();if(!rec)throw Error('Free Cinema camera not initialized in this game.');
    if(!rec.on){if(typeof rec.set!=='function')throw Error('Cine camera cannot enter free mode.');rec.set(true);}
    if(!rec.on)throw Error('Enter a playable robot scene before starting film camera.');
    const dx=target[0]-position[0],dy=target[1]-position[1],dz=target[2]-position[2];
    const horizontal=Math.max(.0001,Math.hypot(dx,dz));
    rec.p.set(...position);rec.yaw=Math.atan2(dx,-dz);rec.pitch=Math.atan2(dy,horizontal);
    rec.cy=rec.yaw;rec.cpch=rec.pitch;rec.cq=1;
    if(rec.v)rec.v.set(0,0,0);
    return true;
  }
  function interpolate(a,b,t){
    if(!vec(a)||!vec(b))throw Error('Camera position not valid');
    const f=t*t*(3-2*t);
    return a.map((x,i)=>x+(b[i]-x)*f);
  }
  function mime(){
    if(!window.MediaRecorder||!MediaRecorder.isTypeSupported)return '';
    for(const m of ['video/mp4;codecs=avc1.42E01E','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'])
      if(MediaRecorder.isTypeSupported(m))return m;
    return '';
  }
  function safeName(s){return String(s||'take').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,55)||'take';}
  function download(blob,name){
    if(!URL||!URL.createObjectURL)throw Error('Blob download is unavailable.');
    const u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download=name;document.body.appendChild(a);
    a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
  }
  function startTake(name,opts={}){
    if(!supported())throw Error('Real game canvas / MediaRecorder unavailable. Use a supported local browser.');
    if(state.recording)throw Error('Stop the current recording first.');
    const fps=clamp(Number(opts.fps)||24,12,30),seconds=clamp(Number(opts.maxSeconds)||70,5,120);
    const source=canvas().captureStream(fps);
    let tracks=source.getVideoTracks();
    if(opts.audioStream&&typeof opts.audioStream.getAudioTracks==='function'){
      tracks=tracks.concat(opts.audioStream.getAudioTracks());
    }
    const stream=new MediaStream(tracks);
    const type=mime(),mr=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:opts.lowPower?1700000:3500000}:{videoBitsPerSecond:2500000});
    const parts=[];let bytes=0;let doneResolve,doneReject;
    const done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});
    let timeout=null;
    const out={name:safeName(name),start:Date.now(),mediaRecorder:mr,done,seconds,stop:()=>stopTake()};
    mr.ondataavailable=e=>{if(e.data&&e.data.size){parts.push(e.data);bytes+=e.data.size;if(bytes>100000000&&mr.state==='recording')mr.stop();}};
    mr.onerror=e=>doneReject(e.error||Error('Recording failed'));
    mr.onstop=()=>{
      if(timeout)clearTimeout(timeout);
      stream.getTracks().forEach(t=>{try{if(t.kind==='video')t.stop();}catch(_){}});
      const output=new Blob(parts,{type:type||'video/webm'});
      const ext=type.startsWith('video/mp4')?'mp4':'webm';
      if(output.size>0){try{download(output,'Unfire-'+out.name+'-'+Date.now()+'.'+ext);}catch(e){doneReject(e);return;}}
      else{doneReject(Error('No video frames captured.'));return;}
      if(state.recording===out)state.recording=null;
      doneResolve({bytes:output.size,mime:output.type,durationMs:Date.now()-out.start,audioTracks:stream.getAudioTracks().length});
    };
    state.recording=out;
    mr.start(1000);
    timeout=setTimeout(()=>{if(mr.state==='recording')mr.stop();},seconds*1000);
    return out;
  }
  function stopTake(){
    const current=state.recording;
    if(!current)return Promise.resolve(null);
    if(current.mediaRecorder.state==='recording')current.mediaRecorder.stop();
    return current.done;
  }
  function stopShot(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.shot=null;}
  function shot(spec){
    if(!spec||!vec(spec.from)||!vec(spec.to)||!vec(spec.lookAt))throw Error('Shot requires from, to and lookAt world coordinates.');
    stopShot();
    const duration=clamp(Number(spec.seconds)||7,1,90),started=performance.now();
    const update=(now)=>{
      const progress=clamp((now-started)/(duration*1000),0,1);
      goto(interpolate(spec.from,spec.to,progress),spec.lookAt);
      if(progress<1)state.raf=requestAnimationFrame(update);else stopShot();
    };
    update(started);
    state.shot=spec;
    return {cancel:stopShot,duration};
  }
  function actors(){
    const out=[];
    const f=window.__FRIENDS||[];f.forEach((v,i)=>out.push({name:String(v.name||'FRIEND-'+i),kind:'companion',position:v.w&&v.w.position? v.w.position.toArray():null}));
    const t=window.__OUTGIANTS||[];t.forEach((v,i)=>out.push({name:i===1?'UMBRAL':'GIGANTE-'+i,kind:'titan',position:v.w&&v.w.position?v.w.position.toArray():null}));
    return out;
  }
  function unload(){stopShot();void stopTake();delete window.UnfireFilmDirector;}
  window.addEventListener('pagehide',unload,{once:true});
  window.UnfireFilmDirector=Object.freeze({supported,goto,interpolate,shot,stopShot,startTake,stopTake,actors,get recording(){return !!state.recording;}});
})();
