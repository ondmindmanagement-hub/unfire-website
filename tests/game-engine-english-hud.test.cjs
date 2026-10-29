'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
test('English visible first-run instructions on phone and desktop',()=>{
 for(const phrase of ['HOW TO PLAY','Left joystick: move','Drag the screen: look around','Tap to start','Click to start','Hold SPACE','Use the blue door'])
  assert.ok(src.includes(phrase),phrase);
 for(const phrase of ['Toca para empezar','Haz clic para empezar','Joystick de la izquierda: andar'])
  assert.ok(!src.includes(phrase),phrase);
  assert.doesNotMatch(src, />CÓMO SE JUEGA<\/b>/);
});
test('English UI for game controls, 3D surface and offline portable capsule',()=>{
 for(const phrase of ['OPEN CASE','CAPSULE · MISSION 3','OPEN ALL','RETURN TO ROBOT','RETURN TO CASE',
                    'VIEW: 3RD PERSON','CINEMA MODE','BOARD: OFF','GO OUTSIDE','GO INSIDE',
                    'EXIT TO WEBSITE','YOUR MUSIC','3D SOUND','INVITE','VOICE ON','MY MIC','PLAYERS'])
  assert.ok(src.includes(phrase),phrase);
 for(const phrase of ["'Instrumentos'","'Efectos FX20'","'Cápsulas'","'CÓMO SE JUEGA'","'SALIR A LA WEB'"])
  assert.ok(!src.includes(phrase),phrase);
});
test('source retains unchanged user input, physics keys and save/public networking mechanisms',()=>{
 for(const phrase of ['const NANO_PHYSICS','ROAMS.k','const ONLINE =',
                    'unfire_side','localStorage','NANO_PHYSICS.nextCameraMode',
                    'const COMP =','const PB =','const BTD =','const ROAMS'])
  assert.ok(src.includes(phrase),phrase);
 for(const phrase of ["'3p'","'2p'","'1p'","'next'","'move'","'close'","'back'"])
  assert.ok(src.includes(phrase),phrase);
});
