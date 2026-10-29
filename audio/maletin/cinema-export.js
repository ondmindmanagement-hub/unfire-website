/* Unfire Cinema — zero-cost native browser video recording.
 * Captures the existing WebGL canvas. Keeps the director camera noclip.
 * Writes chunks to a user-selected file where supported to avoid 17-minute RAM growth.
 * Never silently records; start is always a direct user action.
 */
(() => {
  'use strict';
  if(window.UnfireCinemaExport)return;
  function create({canvas,hud,REC,getAudio,lowPower,say}) {
    const btn=document.createElement('button');
    btn.type='button';btn.id='ufMovieCapture';btn.textContent='⏺ GRABAR VÍDEO';
    btn.style.cssText='border:1px solid #ff9aac;background:#931e38;color:#fff;border-radius:10px;padding:7px 11px;cursor:pointer;font:700 11px system-ui';
    btn.setAttribute('aria-label','Empezar grabación de modo cine');
    const time=document.createElement('span');time.id='ufMovieClock';time.textContent='NO GRABANDO';
    time.style.cssText='color:#fff;font:700 10px system-ui';
    hud.append(btn,time);
    const state={rec:null,writer:null,dest:null,src:null,stream:null,chunks:[],bytes:0,started:0,last:0,mime:'',stopping:false};
    const maxInMemory=210*1024*1024;
    const supported=typeof MediaRecorder!=='undefined'&&canvas&&typeof canvas.captureStream==='function';
    if(!supported){btn.disabled=true;btn.textContent='GRABACIÓN NO COMPATIBLE';}
    function format(t){const n=Math.max(0,Math.floor(t));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
    function reset(){
      if(state.src&&state.dest)try{state.src.disconnect(state.dest)}catch(_){}
      if(state.stream)for(const t of state.stream.getTracks())try{t.stop()}catch(_){}
      state.rec=null;state.writer=null;state.dest=null;state.src=null;state.stream=null;state.chunks=[];state.bytes=0;state.started=0;state.stopping=false;
      btn.textContent='⏺ GRABAR VÍDEO';btn.disabled=false;btn.setAttribute('aria-label','Empezar grabación de modo cine');
      time.textContent='NO GRABANDO';
    }
    async function start(){
      if(!supported||state.rec)return false;
      if(!REC.on){say('🎬 Activa primero el modo cine');return false;}
      const options=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
      const mime=options.find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(_){return false}})||'';
      if(!mime){say('⚠️ Grabación no disponible en este navegador');return false;}
      const ext=mime.includes('mp4')?'mp4':'webm',stamp=new Date().toISOString().replaceAll(':','-').replace(/\..*/,'');
      const filename='Unfire-Cinema-'+stamp+'.'+ext;
      // Choose a writable destination BEFORE capture, while inside a user click.
      // Safari fallback: offer a regular Download when Stop is pressed.
      let writer=null;
      if(typeof showSaveFilePicker==='function'){
        try {
          const handle=await showSaveFilePicker({suggestedName:filename,types:[{description:ext.toUpperCase()+' vídeo',accept:{[ext==='mp4'?'video/mp4':'video/webm']:['.'+ext]}}]});
          writer=await handle.createWritable();
        }catch(e){if(e&&e.name==='AbortError')return false;}
      }
      let stream;
      try{stream=canvas.captureStream(lowPower?20:24);}catch(e){if(writer)try{await writer.abort()}catch(_){}say('No se puede capturar el canvas');return false;}
      let dest=null,src=null;
      try{
        const data=typeof getAudio==='function'?getAudio():null;
        if(data&&data.ctx&&data.bus&&data.bus.master&&data.ctx.createMediaStreamDestination){
          dest=data.ctx.createMediaStreamDestination();src=data.bus.master;src.connect(dest);
          for(const t of dest.stream.getAudioTracks())stream.addTrack(t);
        }
      }catch(_){if(src&&dest)try{src.disconnect(dest)}catch(e){}dest=null;src=null;}
      let rec;
      try{rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:lowPower?1600000:3500000,audioBitsPerSecond:128000});}
      catch(e){if(writer)try{await writer.abort()}catch(_){}for(const t of stream.getTracks())t.stop();say('Grabación no compatible con los ajustes');return false;}
      Object.assign(state,{rec,writer,src,dest,stream,mime,chunks:[],bytes:0,started:performance.now(),filename,stopping:false});
      let writeChain=Promise.resolve();
      rec.ondataavailable=e=>{
        const blob=e.data;if(!blob||!blob.size)return;
        state.bytes+=blob.size;
        if(state.writer){writeChain=writeChain.then(()=>state.writer.write(blob));}
        else{state.chunks.push(blob);if(state.bytes>=maxInMemory){say('Grabación detenida por el límite de memoria seguro');stop();}}
      };
      rec.onerror=()=>{say('⚠️ Fallo de captura de vídeo');stop();};
      rec.onstop=async()=>{
        try{
          await writeChain;
          if(state.writer)await state.writer.close();
          else if(state.chunks.length){
            const blob=new Blob(state.chunks,{type:mime});
            const url=URL.createObjectURL(blob),a=document.createElement('a');
            a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URL.revokeObjectURL(url),60000);
          }
          say('🎞️ Vídeo guardado: '+filename);
        }catch(e){say('⚠️ No se pudo guardar el vídeo: comprueba el espacio');}
        reset();
      };
      rec.start(1000);
      btn.textContent='⏹ TERMINAR Y GUARDAR';btn.setAttribute('aria-label','Detener grabación y guardar el vídeo');
      time.textContent='● REC 00:00';
      return true;
    }
    function stop(){
      if(!state.rec||state.stopping)return false;
      state.stopping=true;
      try{state.rec.stop()}catch(_){reset();return false;}
      btn.disabled=true;
      btn.textContent='GUARDANDO…';
      return true;
    }
    btn.onclick=()=>{if(state.rec)stop();else start()};
    const refresh=()=>{
      if(!state.rec)return;
      const elapsed=(performance.now()-state.started)/1000;
      if(elapsed>=20*60){say('Grabación terminada a los 20 minutos por seguridad');stop();return;}
      time.textContent='● REC '+format(elapsed);
    };
    const clock=setInterval(refresh,500);
    addEventListener('pagehide',()=>{if(state.rec)stop();clearInterval(clock)},{once:true});
    return Object.freeze({get recording(){return !!state.rec},get supported(){return !!supported},stop,start});
  }
  window.UnfireCinemaExport=Object.freeze({create});
})();
