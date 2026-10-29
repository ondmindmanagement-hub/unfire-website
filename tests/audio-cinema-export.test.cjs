'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('audio/maletin/cinema-export.js','utf8');
function stub(){
 const downloads=[];
 class Element {
  constructor(tag){this.tag=tag;this.style={cssText:''};this.attrs={};this.children=[];this.disabled=false;this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  appendChild(n){this.children.push(n);return n;}
  remove(){}
  setAttribute(k,v){this.attrs[k]=v;}
  click(){if(this.tag==='a')downloads.push({href:this.href,name:this.download});else if(this.onclick)this.onclick();}
 }
 const doc={body:new Element('body'),createElement(tag){return new Element(tag)}};
 class Recorder{
  static isTypeSupported(m){return m.startsWith('video/webm')}
  constructor(stream,opts){this.stream=stream;this.opts=opts;this.state='inactive'}
  start(){this.state='recording'}
  stop(){this.state='inactive';if(this.ondataavailable)this.ondataavailable({data:new Blob(['unfire'],{type:'video/webm'})});if(this.onstop)this.onstop()}
 }
 const ctx={
   window:{},document:doc,MediaRecorder:Recorder,Blob,
   URL:{createObjectURL:()=> 'blob:valid',revokeObjectURL:()=>{}},
   performance:{now:()=>10000},setInterval:()=>1,clearInterval(){},setTimeout(){},addEventListener(){},
   console
 };
 vm.runInNewContext(src,ctx);return {ctx,downloads,doc};
}
test('REC starts only in cinematic mode and downloads a real blob on stop',async()=>{
 const {ctx,downloads}=stub();const hud=ctx.document.createElement('div');
 const REC={on:false},msgs=[];
 const canvas={captureStream:(fps)=>({fps,getTracks:()=>[{stop(){}}],addTrack(){}})};
 const tool=ctx.window.UnfireCinemaExport.create({canvas,hud,REC,lowPower:true,say:x=>msgs.push(x)});
 assert(tool.supported);assert.equal(hud.children.length,2);
 assert.equal(await tool.start(),false,'cannot record outside cine');
 REC.on=true;assert.equal(await tool.start(),true);
 assert(tool.recording);
 assert.equal(tool.stop(),true);
 await new Promise(r=>setTimeout(r,0));
 assert.equal(downloads.length,1);
 assert.match(downloads[0].name,/Unfire-Cinema-.*\.webm$/);
 assert.equal(tool.recording,false);
 assert.equal(hud.children[0].disabled,false,'re-enable after successful save');
});
test('missing native capture disables button rather than pretending REC files exist',()=>{
 const {ctx}=stub();const hud=ctx.document.createElement('div');
 const api=ctx.window.UnfireCinemaExport.create({canvas:{},hud,REC:{on:true},say:()=>{}});
 assert.equal(api.supported,false);assert.equal(hud.children[0].disabled,true);
});
test('capture pipeline has memory cap and no extra render loop/network calls',()=>{
 assert.match(src,/maxInMemory=210\*1024\*1024/);
 assert.match(src,/canvas\.captureStream\(lowPower\?20:24\)/);
 assert.match(src,/showSaveFilePicker/);
 assert.match(src,/createMediaStreamDestination/);
 assert.doesNotMatch(src,/fetch\(|requestAnimationFrame\(|new AudioContext\(/);
});
