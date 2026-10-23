'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const controlsPath = path.join(__dirname,'..','audio','maletin','adaptive-controls.js');
const source = fs.readFileSync(controlsPath,'utf8');
const api = require(controlsPath);

test('mobile and tablet are classified by space rather than user-agent string',()=>{
  assert.equal(api.profile(390,844,true),'phone');
  assert.equal(api.profile(844,390,true),'phone');
  assert.equal(api.profile(1024,768,true),'tablet');
  assert.equal(api.profile(1024,768,false),'desktop');
});
test('analog sticks have a symmetric deadzone and finite bounds',()=>{
  assert.equal(api.deadzone(0.13),0);
  assert.equal(api.deadzone(-0.13),0);
  assert.ok(api.deadzone(.8)>.7);
  assert.ok(api.deadzone(-.8)<-.7);
  assert.equal(api.deadzone(Number.NaN),0);
  assert.equal(api.deadzone(50),1);
});
test('control placement avoids HUD/text and existing buttons or yields no placement',()=>{
  const screen={left:8,top:8,right:390,bottom:844};
  const hud={left:195,top:740,right:325,bottom:834};
  const first=api.safePlacement({x:260,y:790},{width:64,height:64},screen,[hud],18);
  assert.ok(first, 'free space exists');
  assert.equal(api.intersects(first,hud),false);
  const second=api.safePlacement({x:first.left+20,y:first.top+20},
    {width:64,height:64},screen,[hud,first],18);
  assert.ok(second);
  assert.equal(api.intersects(second,first),false);
  assert.equal(api.intersects(second,hud),false);
  assert.equal(api.safePlacement({x:10,y:10},{width:400,height:500},screen,[]),null);
  assert.equal(api.safePlacement({x:50,y:50},{width:64,height:64},
    {left:0,top:0,right:64,bottom:64},[{left:0,top:0,right:64,bottom:64}]),null);
});
function testPad() {
  let buttons=Array.from({length:16},()=>({pressed:false}));
  let physical={connected:true,mapping:'standard',axes:[0,-.6,.5,-.4],buttons};
  const docs=new Map();
  let toggles=0, taps=[];
  const ROAMS={on:true,mini:false,fly:false,yaw:0,pitch:0,k:{}};
  const window={
    addEventListener() {},
    document: null
  };
  const document={
    hidden:false,
    getElementById(id) {
      if(id==='unfireControlGuide') return {classList:{contains(){return false;}}};
      if(id==='camButton')return {click(){toggles++;}};
      return docs.get(id) || null;
    },
    addEventListener(){}
  };
  const ctx = {window, document,
    navigator:{getGamepads(){return [physical];}},
    module:{exports:{}},console,setTimeout,clearTimeout};
  vm.runInNewContext(source,ctx,{timeout:1500});
  const module=ctx.module.exports;
  const input=module.init({ROAMS,flightTap(x){taps.push(x);},
    cameraButton:document.getElementById('camButton')});
  return {input,ROAMS,buttons,document,setPad(v){physical=v;},taps,gets:()=>({toggles})};
}
test('PlayStation standard mapping supports simultaneous movement, camera and descent',()=>{
  const f=testPad();
  f.buttons[1].pressed=true; // Circle: descent while still moving forward
  f.input.tick(1/30);
  assert.equal(f.ROAMS.padState.active,true);
  assert.ok(f.ROAMS.padState.ly>.5);
  assert.ok(f.ROAMS.padState.rx>.3);
  assert.ok(f.ROAMS.yaw>0);
  assert.ok(f.ROAMS.pitch>0);
  assert.equal(f.ROAMS.padState.down,true);
  assert.deepEqual(f.taps,['down']);
  f.input.tick(1/30);
  assert.deepEqual(f.taps,['down'],'holding Circle must not trigger double-tap repeatedly');
  f.buttons[1].pressed=false;
  f.buttons[0].pressed=true;
  f.buttons[3].pressed=true;
  f.buttons[5].pressed=true;
  f.input.tick(1/30);
  assert.equal(f.ROAMS.padState.up,true);
  assert.equal(f.ROAMS.padState.sprint,true);
  assert.equal(f.ROAMS.fly,true);
  assert.equal(f.gets().toggles,1);
  f.setPad(null);
  f.input.tick(1/30);
  assert.equal(f.ROAMS.padState.active,false);
  assert.equal(f.ROAMS.padState.up,false);
  assert.equal(f.ROAMS.padState.down,false);
  assert.equal(f.ROAMS.padState.lx,0);
});
test('production engine integrates gamepad tick only in main frame and touch analog',()=>{
  const engine=fs.readFileSync(process.env.UNFIRE_ENGINE_PATH ||
    path.join(__dirname,'..','audio','maletin','game-engine-v50.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','audio','maletin','index.html'),'utf8');
  assert.ok(html.includes('adaptive-controls.js?v=20261023controls1'));
  assert.ok(html.indexOf('adaptive-controls.js')<html.lastIndexOf('game-engine-v50.js?v='));
  assert.match(engine,/adaptiveController\.tick\(dt\)/);
  assert.match(engine,/ROAMS\.touchStick=pid!==null/);
  assert.match(engine,/PADSTATE\.down/);
  assert.match(engine,/PADSTATE\.dive/);
  assert.match(engine,/PADSTATE\.up/);
  assert.match(engine,/PADSTATE\.lx/);
  assert.match(engine,/PADSTATE\.ly/);
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(/);
});
