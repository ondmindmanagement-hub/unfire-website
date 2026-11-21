/* Portable Synth Sequencer Lab — procedural Web Audio voices.
 * No samples, external libraries, microphone input, telemetry, or network requests.
 */
(function(root){
  "use strict";
  const model=typeof module!=="undefined"&&module.exports?require("./engine.js"):root.UnfireSequencerEngine;
  const MAX_BARS=4;
  function setup(ctx,pattern){
    const p=model.valid(pattern);
    if(!ctx || typeof ctx.createGain!=="function")throw new TypeError("Web Audio context required");
    const master=ctx.createGain();
    master.gain.value=p.volume*.68;
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-13;limiter.knee.value=7;limiter.ratio.value=12;
    limiter.attack.value=.003;limiter.release.value=.12;
    master.connect(limiter);limiter.connect(ctx.destination);
    const samples=Math.ceil(ctx.sampleRate*.5);
    const noise=ctx.createBuffer(1,samples,ctx.sampleRate);
    const array=noise.getChannelData(0);
    // Reproducible noise texture for offline and online renders.
    let seed=0x13579bdf;
    for(let i=0;i<samples;i++){
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      array[i]=(seed>>>0)/2147483648-1;
    }
    return {ctx,master,limiter,noise,sources:new Set()};
  }
  function envelope(ctx,when,peak,attack,release,tail){
    const gain=ctx.createGain();
    const param=gain.gain;
    param.setValueAtTime(.00001,when);
    param.exponentialRampToValueAtTime(Math.max(.00002,peak),when+attack);
    param.exponentialRampToValueAtTime(.00001,when+attack+release);
    return {gain,end:when+attack+release+(tail||.02)};
  }
  function note(graph,track,when,pitch,pattern){
    const p=model.valid(pattern),ctx=graph.ctx;
    if(!["kick","snare","hat","bass"].includes(track))throw new RangeError("Unknown voice");
    const t=Math.max(0,when);
    let osc=null,source=null,gainNode=null,filter=null,end=0;
    if(track==="kick"){
      const e=envelope(ctx,t,.9,.004,.26,.02);
      osc=ctx.createOscillator();osc.type="sine";
      osc.frequency.setValueAtTime(155,t);
      osc.frequency.exponentialRampToValueAtTime(44,t+.19);
      osc.connect(e.gain);e.gain.connect(graph.master);
      gainNode=e.gain;end=e.end;source=osc;
    }else if(track==="bass"){
      const e=envelope(ctx,t,.24,.009,.34,.02);
      osc=ctx.createOscillator();osc.type=p.wave;
      osc.frequency.setValueAtTime(model.frequency(pitch),t);
      filter=ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.setValueAtTime(880,t);filter.Q.value=.65;
      osc.connect(filter);filter.connect(e.gain);e.gain.connect(graph.master);
      gainNode=e.gain;end=e.end;source=osc;
    }else{
      const snare=track==="snare";
      const e=envelope(ctx,t,snare?.32:.18,.003,snare?.19:.07,.02);
      const noise=ctx.createBufferSource();noise.buffer=graph.noise;
      filter=ctx.createBiquadFilter();
      filter.type="highpass";filter.frequency.setValueAtTime(snare?1100:6200,t);
      noise.connect(filter);filter.connect(e.gain);e.gain.connect(graph.master);
      gainNode=e.gain;end=e.end;source=noise;
    }
    const entry={source,gainNode,filter,at:t,end};
    graph.sources.add(entry);
    source.onended=()=>{
      graph.sources.delete(entry);
      try{source.disconnect();gainNode.disconnect();if(filter)filter.disconnect();}catch(_){}
    };
    source.start(t);source.stop(end);
    return entry;
  }
  function silence(graph){
    if(!graph)return;
    try{graph.master.disconnect();}catch(_){}
    const now=graph.ctx.currentTime;
    for(const entry of graph.sources){
      try{entry.source.stop(now);}catch(_){}
    }
    graph.sources.clear();
  }
  async function render(pattern,bars=2,OfflineCtor){
    const p=model.valid(pattern);
    if(!Number.isInteger(bars)||bars<1||bars>MAX_BARS)throw new RangeError("Render length must be 1–4 bars");
    const Factory=OfflineCtor||(typeof OfflineAudioContext!=="undefined"?OfflineAudioContext:null);
    if(!Factory)throw new Error("Offline audio rendering unavailable");
    const sampleRate=44100;
    const duration=bars*model.barDuration(p.bpm)+.5;
    const frames=Math.ceil(duration*sampleRate);
    if(frames>2000000)throw new RangeError("Output exceeds safe memory bound");
    const ctx=new Factory(2,frames,sampleRate);
    const graph=setup(ctx,p);
    for(const e of model.events(p,bars))note(graph,e.track,e.time,e.note,p);
    const audio=await ctx.startRendering();
    return model.wav(audio);
  }
  const api=Object.freeze({MAX_BARS,setup,note,silence,render});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.UnfireSequencerAudio=api;
})(typeof globalThis!=="undefined"?globalThis:this);
