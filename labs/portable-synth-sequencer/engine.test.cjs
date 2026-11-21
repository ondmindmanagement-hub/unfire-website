"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const E=require("./engine.js"),A=require("./audio.js");
test("fresh demo is 4 tracks by 16 steps with safe defaults",()=>{
  const p=E.initialPattern();
  assert.equal(p.version,1);assert.equal(p.bpm,112);assert.equal(E.TRACKS.length,4);
  for(const t of E.TRACKS)assert.equal(p.tracks[t.id].length,16);
  assert.deepEqual(E.valid(p),p);
});
test("events are deterministic and chronological over multiple bars",()=>{
  const p=E.initialPattern();
  const once=E.events(p,1),twice=E.events(p,2);
  assert.equal(once.length,20);assert.equal(twice.length,40);
  assert.ok(once.every((v,i)=>i===0||v.time>=once[i-1].time));
  for(let i=0;i<once.length;i++){
    assert.equal(twice[i].track,once[i].track);
    assert.equal(twice[i].index,once[i].index);
  }
  assert.ok(twice.every((v,i)=>i===0||v.time>=twice[i-1].time));
});
test("swing delays offbeats but preserves bar length and ordering",()=>{
  const p=E.initialPattern(),dur=E.stepDuration(p.bpm);
  assert.ok(Math.abs(E.stepTime(1,p.bpm,p.swing)-(1+p.swing)*dur)<1e-10);
  assert.ok(Math.abs(E.stepTime(2,p.bpm,p.swing)-2*dur)<1e-10);
  assert.ok(Math.abs(E.barDuration(p.bpm)-dur*16)<1e-10);
  for(let i=1;i<16;i++)assert.ok(E.stepTime(i,p.bpm,p.swing)>E.stepTime(i-1,p.bpm,p.swing));
});
test("drum and melodic steps toggle independently without mutation",()=>{
  const p=E.initialPattern();
  const p1=E.changeStep(p,"kick",0);
  assert.equal(p1.tracks.kick[0],false);assert.equal(p.tracks.kick[0],true);
  const p2=E.changeStep(p,"bass",1,60);
  assert.equal(p2.tracks.bass[1],60);assert.equal(p.tracks.bass[1],null);
  const p3=E.changeStep(p2,"bass",1,60);
  assert.equal(p3.tracks.bass[1],null);
  const p4=E.changeStep(p2,"bass",1,61);
  assert.equal(p4.tracks.bass[1],61);
});
test("JSON roundtrip is editable but sanitized to expected schema",()=>{
  const original=E.initialPattern();
  const revived=E.parse(E.serialize(original));
  assert.deepEqual(revived,original);
  const unwanted={...original,token:"DONT_KEEP_ME",tracks:{...original.tracks,secret:"NO"}};
  const clean=E.parse(JSON.stringify(unwanted));
  assert.ok(!("token" in clean));assert.ok(!("secret" in clean.tracks));
});
test("invalid patterns are explicitly rejected",()=>{
  const p=E.initialPattern(),clone=()=>E.initialPattern();
  for(const malformed of [null,[],{}, {...p,version:2},{...p,bpm:0},{...p,bpm:201},{...p,bpm:112.3},{...p,swing:.8},{...p,volume:1},{...p,wave:"html"}])
    assert.throws(()=>E.valid(malformed));
  const wrong=clone();wrong.tracks.bass[2]=200;assert.throws(()=>E.valid(wrong));
  const wrong2=clone();wrong2.tracks.kick[0]="yes";assert.throws(()=>E.valid(wrong2));
  const wrong3=clone();wrong3.tracks.hat=[];assert.throws(()=>E.valid(wrong3));
});
test("malformed imports and unsafe step positions never mutate state",()=>{
  assert.throws(()=>E.parse("not JSON"));
  assert.throws(()=>E.parse("x".repeat(17000)));
  assert.throws(()=>E.changeStep(E.initialPattern(),"invalid",0));
  assert.throws(()=>E.changeStep(E.initialPattern(),"kick",16));
  assert.throws(()=>E.changeStep(E.initialPattern(),"bass",5,90));
  assert.throws(()=>E.events(E.initialPattern(),0));
  assert.throws(()=>E.events(E.initialPattern(),5));
});
test("frequency converts MIDI notes correctly",()=>{
  assert.ok(Math.abs(E.frequency(69)-440)<1e-12);
  assert.ok(Math.abs(E.frequency(60)-261.625565)<.00001);
  assert.throws(()=>E.frequency(-1));
});
test("PCM WAV encoding preserves mono header and exact frames",()=>{
  const data=Float32Array.from([-1,0,.5,1]);
  const buffer={numberOfChannels:1,length:data.length,sampleRate:44100,getChannelData:i=>data};
  const wav=E.wav(buffer),view=new DataView(wav);
  assert.equal(wav.byteLength,52);
  const tag=(index)=>String.fromCharCode(...new Uint8Array(wav,index,4));
  assert.equal(tag(0),"RIFF");assert.equal(tag(8),"WAVE");
  assert.equal(tag(12),"fmt ");assert.equal(tag(36),"data");
  assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint32(24,true),44100);
  assert.equal(view.getUint16(34,true),16);assert.equal(view.getUint32(40,true),8);
  assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(46,true),0);
  assert.equal(view.getInt16(48,true),16384);assert.equal(view.getInt16(50,true),32767);
});
test("stereo encoding interleaves and sanitizes nonfinite samples",()=>{
  const left=Float32Array.from([1,Number.NaN]);
  const right=Float32Array.from([-1,0]);
  const wav=E.wav({numberOfChannels:2,length:2,sampleRate:48000,getChannelData:i=>i?right:left});
  const v=new DataView(wav);
  assert.equal(v.getUint16(22,true),2);
  assert.equal(v.getInt16(44,true),32767);assert.equal(v.getInt16(46,true),-32768);
  assert.equal(v.getInt16(48,true),0);assert.equal(v.getInt16(50,true),0);
});
test("audio output rejects unbounded buffers",()=>{
  assert.throws(()=>E.wav({numberOfChannels:3,length:20,sampleRate:44100}));
  assert.throws(()=>E.wav({numberOfChannels:1,length:2000001,sampleRate:44100}));
  assert.throws(()=>A.render(E.initialPattern(),5),RangeError);
});
test("live audio setup must receive a Web Audio context",()=>{
  assert.throws(()=>A.setup(null,E.initialPattern()),TypeError);
});
