'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');

test('real Nimbo and collectible dialogue is available in English',()=>{
  for(const line of [
    'There is not enough room to return to normal size',
    'Flying over!', 'I am with you!', 'Hold on! I will get you out of there',
    'there is a secret in ', 'your next objective: ',
    'Twenty robots like me live inside the case',
    'I transform in three steps',
    'follow the star on the map'
  ]) assert.ok(src.includes(line),line);
  for(const old of ['En el maletín vivimos','¡voy volando!','Misión de ', 'Misión cumplida:', 'Te ha tocado'])
    assert.doesNotMatch(src,new RegExp(old));
});

test('secondary quests translate descriptions but preserve progress identifiers and coordinates',()=>{
 for(const line of [
 'Fly to the golden tip of the great Atlantis pyramid',
 'Find the desert obelisk','Reach the top of the giant pink tree',
 'Cross the Haiku Island torii gates',
 'Ride a large wave in the open sea','Mission complete:',
 'Mission from '
 ]) assert.ok(src.includes(line),line);
 for(const key of ['unfire_side_active','unfire_side','unfire_unlock'])
  assert.ok(src.includes(key),key);
 assert.ok(src.includes("'ULTIMATEROBOTS'"));
 assert.ok(src.includes("'unfire_secret_robots'"));
});

test('multiplayer, camera permissions and the local secret computer display English',()=>{
 for(const line of [
 'SECRET ACCESS', 'Choose an application.',
 'Code not recognized.', 'All playable robots unlocked',
 'You were invited to room ', 'You left the room',
 'The host closed the room','Come play UNFIRE AUDIO with me',
 'ready · select 📨 INVITE to bring friends', 'Player report',
 'NO ENTRY', 'RECORDING',
 'Microphone on. You can hear nearby players',
 'CAMERA: MOVE YOUR HANDS','Camera permission is unavailable',
 'No other players in the room yet.'
 ]) assert.ok(src.includes(line),line);
 assert.ok(src.includes('const tr2 = (_unusedSpanish, en) => en;'));
 for(const old of ['Selecciona una aplicación.','Código no reconocido.','⏏ SALIR A LA WEB','✋ CÁMARA: MUEVE LAS MANOS'])
  assert.ok(!src.includes(old),old);
});

test('story rewards, studio and video-game hints are visibly English',()=>{
 for(const line of [
 'YOU RECOVERED THE LOST SECOND!', 'DOWNLOAD CERTIFICATE',
 'KEEP PLAYING','Golden skin','All 20 robots',
 'Choose your track: it will play through the house speakers',
 'SYNTHESIZER · SIGNATURE INSTRUMENT','OPEN CASE',
 'Now playing:', 'ADD TO BAG · ',
 'Landed on ', 'Hold on! I will get you out of there.'
 ]) assert.ok(src.includes(line),line);
 for(const old of ['AÑADIR A LA BOLSA','DESCARGAR DIPLOMA','HAS RECUPERADO EL SEGUNDO PERDIDO'])
  assert.ok(!src.includes(old),old);
});

test('touch-first case butterfly prompt is English on iPhone and iPad',()=>{
  assert.ok(src.includes("'TAP THE BUTTERFLY'"),'touch-first instruction must be present');
  assert.ok(!src.includes("'PULSA LA MARIPOSA'"),'Spanish touch-first instruction must not ship');
});

test('visible case tips, chat, radio and transformation labels stay English',()=>{
  const required=[
    'RADIO UNFIRE · standby',
    'Talk to the nearest robot… (Enter)',
    '★ MEGA TRANSFORMATION · all families',
    '★ SUPER TRANSFORMATION',
    'HYPERWAVE on the table · full size',
    'HYPERWAVE returns to the case',
    'Tap the butterfly button · or scroll down a little',
    'Scroll over the case to zoom in',
    'Scroll over a compartment to open it',
    'Tap the butterfly to transform',
    'Click to try it',
    'Drag to rotate · move the cursor to the edge'
  ];
  for(const line of required) assert.ok(src.includes(line),line);
  for(const old of [
    'RADIO UNFIRE · en espera',
    'Habla con el robot que tengas más cerca',
    '★ MEGA TRANSFORMACIÓN',
    '★ SÚPER TRANSFORMACIÓN',
    'HYPERWAVE vuelve al maletín',
    'Pulsa el botón de la mariposa',
    'Rueda sobre el maletín = acercarte',
    'Baja sobre una compuerta para abrirla',
    'Pulsa la mariposa para cambiar de forma',
    'Clic para probarlo',
    'Arrastra para girar · cursor'
  ]) assert.ok(!src.includes(old),old);
});

test('ambient world conversations, missions and robot banter are English',()=>{
  for(const line of [
    'That was MY screw!',
    'Take back what you said about Auto-Tune!',
    'Have you seen Haiku Island?',
    'There are real waves out at sea.',
    'The Atlantis pyramid has been restored',
    'Hey, you! Could you do me a favor?',
    'HYPERWAVE 2000 is a full synthesizer.',
    'The Club is full of surprises, with more to come in future updates!',
    'Everything is made in Cardedeu.',
    "'traveler'"
  ]) assert.ok(src.includes(line),line);
  for(const old of [
    '¡Ese era MI tornillo!',
    '¿Has visto la isla Haiku?',
    '¡Eh, tú! ¿Me haces un favor?',
    'HYPERWAVE 2000 es un sinte entero.',
    '¡Y en el Club cae una cápsula nueva cada mes!'
  ]) assert.ok(!src.includes(old),old);
});
