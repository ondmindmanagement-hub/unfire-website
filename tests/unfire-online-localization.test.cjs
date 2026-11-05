'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const start=src.indexOf('function join(c0) {'),end=src.indexOf('function leave() {',start);
assert.ok(start>=0&&end>start);
const code=src.slice(start,end);
function simulate(lang,room='ABC'){
 const messages=[], env={joining:null,code:null,peer:null,load:()=>{},save:()=>{},applyMe:()=>{},msg:t=>messages.push(t),uiText:(en,es)=>lang==='es'?es:en,setTimeout:()=>1,clearTimeout:()=>{},VOICE:{bindPeer:()=>{}},Peer:()=>({}),rnd:()=> 'XXXXX',setup:()=>{},started:()=>{}};
 const join=new Function('scope',`with(scope){ ${code};return join; }`)(env);
 join(room);return messages[0];
}
test('invalid room code is English in English mode',()=>assert.equal(simulate('en'),'Room code must have 5 letters or numbers.'));
test('invalid room code stays Spanish for Spanish users',()=>assert.equal(simulate('es'),'El código tiene 5 letras o números.'));
test('online room HUD translated into both languages',()=>{
 for(const t of ['🎤 ENABLE VOICE','📨 INVITE','🔊 PLAYERS','🎙️ VOICE ON · TURN OFF'])assert.ok(src.includes(t),t);
 for(const t of ['🎤 ACTIVAR VOZ','📨 INVITAR','🔊 JUGADORES'])assert.ok(src.includes(t),t);
});
test('invitation, room join and leave show translated messages',()=>{
 for(const t of ['Connected to room ','Joining room ','Room invitation ','You left the room.','Invite link copied:'])assert.ok(src.includes(t),t);
 for(const t of ['Conectado a la sala ','Entrando en la sala ','Invitación a la sala ','Has salido de la sala.'])assert.ok(src.includes(t),t);
});
test('critical room failures show English default',()=>{
 for(const t of ['Room not responding.','Could not connect to the room.','Player connection failed.','Room not found or host disconnected.'])assert.ok(src.includes(t),t);
});
test('no automatic microphone permission during connection',()=>{
 const init=src.indexOf('const started = () =>');
 assert.ok(init>0);assert.doesNotMatch(src.slice(init,init+500),/VOICE\.start\(/);
});
