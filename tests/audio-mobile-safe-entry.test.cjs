'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const html=readFileSync('audio/index.html','utf8');
const open=html.slice(html.indexOf('const open=(D=1100)=>{'),html.indexOf('const resumeGame=()=>{'));
assert(open.length>400&&open.length<5000,'found exact host opening function');
assert(open.includes("const touchGPU=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;"),'touch devices skip WebGL host transform');
assert(open.includes("if(!touchGPU&&pin.animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches)"),'desktop animation and reduced-motion preserved');
assert(open.includes('fullscreenFromGesture();'),'native immersive flow retained');
assert(open.includes('const begin=()=>{'),'delayed scene readiness flow retained');
assert(open.includes('UNFIRE_SCENE.onReady('),'initial scene readiness retained');
assert(open.includes('enterGame();'),'actual 3D lid still opens');
assert(open.includes("{transform:'translate(0px,0px) scale(1)'"),'desktop animation remains');
// Don't accidentally change the loading/error fallback or WebGL canvas touch handlers.
assert(html.includes("if($('#heroPin').classList.contains('scene-error'))"));
assert(html.includes('firstFrame.addEventListener(\'click\''));
console.log('PASS audio-mobile-safe-entry: no WAAPI fullscreen WebGL transform on touch, desktop lid flow unchanged');
