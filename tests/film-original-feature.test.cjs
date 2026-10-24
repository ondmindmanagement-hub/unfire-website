'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sequences=JSON.parse(read('audio/film/el-gran-silencio-scenes.json'));
test('full-length original science-fiction fantasy comedy has a three-act playable-world shooting script',()=>{
 assert.equal(sequences.scenes.length,24);
 assert.deepEqual([...new Set(sequences.scenes.map(s=>s.act))],[1,2,3]);
 assert(sequences.scenes.reduce((sum,s)=>sum+s.seconds,0)>=4500);
 assert(sequences.scenes.every(s=>s.title&&s.action&&s.shot&&s.place&&s.lines.length>=5));
 assert(sequences.scenes.reduce((sum,s)=>sum+s.lines.length,0)>170);
 assert.equal(sequences.scenes[5].title,'Umbral no se mueve');
 assert(/Luna|lunar/i.test(sequences.scenes.map(s=>s.place).join(' ')));
 const screenplay=read('audio/film/UNFIRE_EL_GRAN_SILENCIO_GUION.md');
 assert(screenplay.includes('ACTO III'));
 assert(screenplay.includes('LA GRAVEDAD TIENE UN ABOGADO'));
 assert(!/Omar Baró|Omar Bar[oó] Tudela|creador del juego|fundador Unfire/i.test(screenplay));
});
test('film helper cannot secretly control the public game',()=>{
 const entry=read('audio/maletin/index.html'),helper=read('audio/film/director-capture.js');
 assert(!entry.includes('director-capture.js'));
 assert(!entry.includes('UnfireFilmDirector'));
 assert(!/fetch\(|WebSocket|BroadcastChannel|localStorage|sessionStorage/.test(helper));
 assert(helper.includes('captureStream')&&helper.includes('MediaRecorder'));
 assert(helper.includes('getAudioTracks')&&helper.includes('opts.audioStream'));
});
test('camera director computes deterministic movements and controls collision-free REC camera',()=>{
 const source=read('audio/film/director-capture.js'),calls=[];
 const rec={on:false,p:{set(...args){calls.push(args)}},v:{set(){}},set(value){this.on=value;}};
 const ctx={window:{__dbg:{S:{camera:{},renderer:{domElement:{captureStream(){return {getVideoTracks(){return []}};}}}}},__REC:rec,addEventListener(){}},
   document:{createElement(){return {remove(){},click(){}}},body:{appendChild(){}}},MediaRecorder:function(){},MediaStream:function(){},
   setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},performance:{now(){return 3;}},Date,URL,Blob,
 };
 ctx.MediaRecorder.isTypeSupported=()=>true;
 vm.runInNewContext(source,ctx,{timeout:300});
 const director=ctx.window.UnfireFilmDirector;
 assert.equal(typeof director.goto,'function');
 director.goto([0,10,20],[0,10,0]);
 assert.equal(rec.on,true);
 assert.deepEqual(calls.at(-1),[0,10,20]);
 assert.deepEqual([...director.interpolate([0,0,0],[10,20,30],.5)],[5,10,15]);
 assert.throws(()=>director.goto([NaN,0,0],[0,0,0]),/finite/);
 assert.equal(director.recording,false);
 assert.deepEqual([...director.actors()],[]);
});
test('shotlist covers all scenes and never assumes already captured footage',()=>{
 const rows=read('audio/film/SHOTLIST_PRODUCCION.csv').trim().split('\n');
 assert.equal(rows.length,24*4+1);
 assert(rows.slice(1).every(row=>row.includes('NO GRABADA')));
 assert(!read('audio/film/README.md').includes('película publicada'));
});
