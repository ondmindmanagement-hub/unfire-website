'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'audio/maletin/unfire-conversations.js'),'utf8');
const engine=fs.readFileSync(path.join(root,'audio/maletin/game-engine-v50.js'),'utf8');
const html=fs.readFileSync(path.join(root,'audio/maletin/index.html'),'utf8');

function load(){
  const nodes=new Map(),intervals=[];
  class Node{
    constructor(){
      this.children=[];this.style={};this.dataset={};this.value='';this.textContent='';this.hidden=false;
      this.classList={add(){},remove(){},toggle(){},contains(){return false;}};
    }
    append(...n){this.children.push(...n);}
    appendChild(n){this.children.push(n);}
    replaceChildren(){this.children=[];}
    addEventListener(){}
    setAttribute(){}
    remove(){}
    get firstElementChild(){return this.children[0];}
  }
  for(const id of ['ufMic','ufLog','ufText','ufHint','ufDlgTitle','ufSpeak','ufClose','ufForm','ufSend'])
    nodes.set(id,new Node());
  const document={head:new Node(),body:new Node(),createElement:()=>new Node(),
    getElementById:id=>nodes.get(id)||null,addEventListener(){}};
  const window={__LANG:'es',addEventListener(){},matchMedia:()=>({matches:true})};
  vm.runInNewContext(script,{document,window,Date,Map,Set,Math,Object,
    setInterval:fn=>intervals.push(fn)},{filename:'unfire-conversations.js'});
  return {api:window.UnfireConversations,nodes,window,intervals};
}
test('loaded after engine, retaining existing cinematic NPC UI',()=>{
  assert.match(html,/game-engine-v50\.js\?v=20261024combinedqa1"><\/script>\s*<script src="unfire-conversations\.js\?v=20261024storychat1"/);
  assert.match(engine,/const OUTTALK\s*=/);
  assert.match(engine,/window\.__UNFIRE_DIALOGUE_WORLD\s*=/);
});
test('every existing exterior robot family is listed, giant identities distinct',()=>{
  for(const name of ['SKYBOTS','SURFBOTS','TITANS','OUTTALK','FR','GROW'])
    assert.ok(engine.includes(name),name);
  for(const name of ['UMBRAL','ASTRALIA','CRONOS'])
    assert.ok(engine.includes(name),name);
  assert.match(script,/setInterval\(poll, 360\)/);
});
test('giant histories are different, multi-turn and topic-specific',()=>{
  const {api}=load();const first=[];
  for(let i=0;i<3;i++){
    const n={id:'titan-'+i,name:'TITAN'};
    const a=api.answer(n,'Cuéntame tu historia');
    const b=api.answer(n,'Continúa tu historia');
    assert.notEqual(a,b);
    first.push(a);
    assert.notEqual(api.answer(n,'¿Cuál es tu secreto?'),a);
  }
  assert.equal(new Set(first).size,3);
});
test('all other NPC identifiers can converse with follow-up memory',()=>{
  const {api}=load();
  for(const id of ['friend-ARI','grow-xyz','sky-1','surf-1','out-2-0','nimbo']){
    const n={id,name:id};
    assert.match(api.answer(n,'hola'),/Hola/);
    assert.match(api.answer(n,'¿Quién eres?'),/Soy/);
    assert.ok(api.answer(n,'¿Tienes secretos?').length>20);
    assert.ok(api.answer(n,'¿y después?').length>20);
  }
});
test('proximity distinguishes ordinary bots and giant robots',()=>{
  const {api}=load(),p={x:0,y:800,z:0};
  assert.ok(api.distance({x:10,y:0,z:0,radius:15},p)>1);
  assert.ok(api.distance({x:20,y:0,z:0,radius:475,giant:true},p)<1);
});
test('messages bounded, sanitized as plain text and room transport checked',()=>{
  assert.match(engine,/raw\.kind==='chat'/);
  assert.match(engine,/raw\.text\.length>180/);
  assert.match(engine,/isHost&&id!==c\.peer/);
  assert.match(engine,/lastChatAt&&now-lastChatAt<650/);
  assert.match(engine,/receivePeer\(d\)/);
  assert.match(engine,/sendChat\(text\)/);
  assert.match(script,/content\.textContent = message/);
  assert.doesNotMatch(script,/content\.innerHTML\s*=/);
  assert.match(script,/lastSend < 800/);
  assert.doesNotMatch(script,/\bfetch\(/);
  assert.doesNotMatch(script,/localStorage|sessionStorage/);
});
test('microphone opt-in, disabled gracefully if unsupported',()=>{
  assert.match(script,/webkitSpeechRecognition/);
  assert.match(script,/rec\.start\(\)/);
  const {api,nodes}=load();
  assert.ok(api);
  assert.equal(nodes.get('ufMic').hidden,true);
});
