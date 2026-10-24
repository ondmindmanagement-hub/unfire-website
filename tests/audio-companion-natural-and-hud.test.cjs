'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..','audio','maletin');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const context={window:{}};
vm.runInNewContext(read('companion-natural-flight.js'),context);
const step=context.window.UNFIRE_COMPANION_FLIGHT.step;
function play(s,index,frames,opts={}){let out;for(let k=0;k<frames;k++)out=step(s,{dt:1/20,index,flying:true,height:42,maxLift:9,...opts});return out;}
test('companions do not take off simultaneously with player or each other',()=>{
 const a={},b={},c={};
 play(a,0,20);play(b,1,20);play(c,2,20);
 assert(a.lift>0.01,'first companion starts after a delay');
 assert.equal(b.lift,0,'second companion waits longer');
 assert.equal(c.lift,0,'third companion waits longer still');
 play(b,1,28);play(c,2,28);
 assert(b.lift>0.2);assert(c.lift>0.1);
});
test('no vertical teleport, same-time climb or sudden snap at landing',()=>{
 const s={},other={};let last=0;
 for(let i=0;i<200;i++){
  const next=step(s,{dt:1/60,index:1,flying:true,height:i<70?10:700,maxLift:12});
  const second=step(other,{dt:1/60,index:3,flying:true,height:i<70?10:700,maxLift:12});
  assert(Math.abs(next.height-last)<0.15,'smooth bounded vertical frame');
  assert(next.height<14,'lift capped independently of player altitude');
  if(i===100)assert.notEqual(next.height,second.height,'robots differ visibly');
  last=next.height;
 }
 let prev=s.lift;
 for(let i=0;i<450;i++){step(s,{dt:1/60,index:1,flying:false,height:0,maxLift:12});assert(s.lift>=0);assert(prev-s.lift<0.15);prev=s.lift;}
 assert(s.lift<0.12,'robot lands gently after delayed reaction');
});
test('Nano changes companion decisions without scaling all friends into Nano or copying altitude',()=>{
 const full={},nano={};
 play(full,2,120,{nano:false});
 play(nano,2,120,{nano:true});
 assert(full.lift>nano.lift*1.8,'Nano companion stays much lower');
 assert(nano.lift>0,'Nano can still be accompanied');
});
test('HTML loads natural-flight before friends and engine; ambient robots cannot mirror altitude',()=>{
 const html=read('index.html'),engine=read('game-engine-v50.js');
 assert(html.indexOf('companion-natural-flight.js')<html.indexOf('const FR ='));
 assert(html.indexOf('companion-natural-flight.js')<html.indexOf('<script src="game-engine-v50.js'));
 assert.match(html,/UNFIRE_COMPANION_FLIGHT\.step\(f\.flight/);
 assert.match(engine,/UNFIRE_COMPANION_FLIGHT\.step\(w\.userData\.flight/);
 assert.doesNotMatch(engine,/ROAMS\.fly \? \(ROAMS\.h \|\| 0\) \* 0\.6/);
 assert.doesNotMatch(engine,/g\.w\.position\.y \+= \(\(ROAMS\.h \|\| 0\)/);
});
test('coin HUD above minimap, duplicate mobile NPC talk hidden, focus modal hides controls',()=>{
 const coins=read('coins-shop.js'),talk=read('unfire-conversations.js');
 assert(coins.includes('@media(pointer:coarse){#unfireCoinHud{top:calc(env(safe-area-inset-top) + 65px);left:calc(env(safe-area-inset-left) + 96px)'), 'coin dock to the right of map');
 assert.doesNotMatch(coins,/#unfireCoinHud\{[^\n]*left:50%/);
 assert(coins.includes('@media(max-width:420px){#unfireCoinHud{left:calc(env(safe-area-inset-left) + 84px)'), 'compact coin on phones');
 assert.match(talk,/@media\(pointer:coarse\)\{#ufNear\{display:none!important/);
 assert.match(talk,/talk\.textContent !== label/);
 assert.match(talk,/body:has\(#ufDialogs\.on\) #unfireFly/);
 assert.match(talk,/body:has\(#ufDialogs\.on\) #unfireTouchPad/);
 assert.match(talk,/#ufDialogs\.on\{display:flex\}/);
});
