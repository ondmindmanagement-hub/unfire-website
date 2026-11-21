/* Portable Synth Sequencer Lab — deterministic, self-contained 16-step musical pattern model.
 * Separate proof-of-concept from the existing /portable-synth/play/ instrument.
 */
(function(root){
  "use strict";
  const STEP_COUNT = 16;
  const TRACKS = Object.freeze([
    Object.freeze({id:"kick",name:"Kick",kind:"drum"}),
    Object.freeze({id:"snare",name:"Snare",kind:"drum"}),
    Object.freeze({id:"hat",name:"Hi-hat",kind:"drum"}),
    Object.freeze({id:"bass",name:"Synth",kind:"melodic"})
  ]);
  const WAVES = Object.freeze(["sine","triangle","sawtooth","square"]);
  const clone = value => JSON.parse(JSON.stringify(value));
  function initialPattern(){
    return {
      version:1,bpm:112,swing:0.12,volume:0.55,wave:"sawtooth",
      tracks:{
        kick:[true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
        snare:[false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
        hat:[true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
        bass:[48,null,null,48,null,null,55,null,48,null,null,50,null,55,null,null]
      }
    };
  }
  function finite(n,low,high,name){
    if(typeof n!=="number" || !Number.isFinite(n) || n<low || n>high) throw new RangeError("Invalid "+name);
    return n;
  }
  function valid(pattern){
    if(!pattern || typeof pattern!=="object" || Array.isArray(pattern) || pattern.version!==1) throw new TypeError("Unsupported pattern version");
    if(!Number.isInteger(pattern.bpm)) throw new RangeError("Tempo must be an integer");
    finite(pattern.bpm,50,200,"tempo");finite(pattern.swing,0,.45,"swing");finite(pattern.volume,0,.85,"volume");
    if(!WAVES.includes(pattern.wave))throw new RangeError("Unsupported oscillator");
    if(!pattern.tracks || typeof pattern.tracks!=="object" || Array.isArray(pattern.tracks))throw new TypeError("Missing tracks");
    for(const track of TRACKS){
      const steps=pattern.tracks[track.id];
      if(!Array.isArray(steps) || steps.length!==STEP_COUNT)throw new RangeError("Track "+track.id+" must have 16 steps");
      for(const value of steps){
        if(track.kind==="melodic"){
          if(value!==null && (!Number.isInteger(value)||value<36||value>84))throw new RangeError("Synth notes must be MIDI 36–84 or empty");
        }else if(typeof value!=="boolean")throw new TypeError("Drum steps must be boolean");
      }
    }
    return clone({
      version:1,bpm:pattern.bpm,swing:pattern.swing,volume:pattern.volume,wave:pattern.wave,
      tracks:Object.fromEntries(TRACKS.map(t=>[t.id,pattern.tracks[t.id]]))
    });
  }
  function changeStep(pattern,id,index,note=48){
    const next=valid(pattern);
    const track=TRACKS.find(t=>t.id===id);
    if(!track)throw new RangeError("Unknown track");
    if(!Number.isInteger(index)||index<0||index>=STEP_COUNT)throw new RangeError("Invalid step");
    if(track.kind==="melodic"){
      if(!Number.isInteger(note)||note<36||note>84)throw new RangeError("Invalid synth note");
      next.tracks[id][index]=next.tracks[id][index]===note?null:note;
    } else next.tracks[id][index]=!next.tracks[id][index];
    return next;
  }
  function stepDuration(bpm){return 60/finite(bpm,50,200,"tempo")/4;}
  function stepTime(index,bpm,swing){
    if(!Number.isInteger(index)||index<0)throw new RangeError("Invalid step");
    finite(swing,0,.45,"swing");
    const duration=stepDuration(bpm);
    return index*duration+(index%2?swing*duration:0);
  }
  function barDuration(bpm){return stepDuration(bpm)*STEP_COUNT;}
  function frequency(midi){
    finite(midi,0,127,"MIDI note");return 440*Math.pow(2,(midi-69)/12);
  }
  function events(pattern,bars=1){
    const p=valid(pattern);
    if(!Number.isInteger(bars)||bars<1||bars>4)throw new RangeError("Bars must be 1–4");
    const arr=[];
    for(let bar=0;bar<bars;bar++){
      for(let i=0;i<STEP_COUNT;i++){
        const time=bar*barDuration(p.bpm)+stepTime(i,p.bpm,p.swing);
        for(const tr of TRACKS){
          const value=p.tracks[tr.id][i];
          if(value===null||value===false)continue;
          arr.push({bar,index:i,time,track:tr.id,note:tr.kind==="melodic"?value:null});
        }
      }
    }
    return arr;
  }
  function serialize(pattern){return JSON.stringify(valid(pattern),null,2)+"\n";}
  function parse(text){
    if(typeof text!=="string"||text.length>16384)throw new RangeError("Pattern JSON exceeds 16 KiB");
    let parsed;try{parsed=JSON.parse(text);}catch(_){throw new SyntaxError("Invalid pattern JSON");}
    return valid(parsed);
  }
  function wav(buffer){
    if(!buffer || !Number.isInteger(buffer.numberOfChannels) || ![1,2].includes(buffer.numberOfChannels)
      || !Number.isSafeInteger(buffer.length)||buffer.length<1 || buffer.length>2000000
      || !Number.isInteger(buffer.sampleRate)||buffer.sampleRate<8000||buffer.sampleRate>96000)
      throw new RangeError("Unsupported audio buffer");
    const channels=buffer.numberOfChannels,frames=buffer.length,rate=buffer.sampleRate;
    const bytes=frames*channels*2;
    const dest=new ArrayBuffer(44+bytes),view=new DataView(dest);
    const word=(at,value)=>{for(let j=0;j<4;j++)view.setUint8(at+j,value.charCodeAt(j));};
    word(0,"RIFF");view.setUint32(4,36+bytes,true);word(8,"WAVE");
    word(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);
    view.setUint16(22,channels,true);view.setUint32(24,rate,true);
    view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);
    view.setUint16(34,16,true);word(36,"data");view.setUint32(40,bytes,true);
    const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
    if(data.some(a=>a.length!==frames))throw new RangeError("Invalid audio channels");
    let offset=44;
    for(let i=0;i<frames;i++){
      for(let j=0;j<channels;j++){
        const s=Number.isFinite(data[j][i])?Math.max(-1,Math.min(1,data[j][i])):0;
        view.setInt16(offset,s<0?Math.round(s*32768):Math.round(s*32767),true);
        offset+=2;
      }
    }
    return dest;
  }
  const api=Object.freeze({STEP_COUNT,TRACKS,WAVES,initialPattern,valid,changeStep,stepDuration,stepTime,barDuration,frequency,events,serialize,parse,wav});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.UnfireSequencerEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this);
