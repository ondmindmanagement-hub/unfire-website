'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const html=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/index.html'),'utf8');
const engine=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
test('Snow particles use an alpha-faded shared sprite rather than opaque squares',()=>{
 assert.match(html,/snowGradient\.addColorStop\(1, 'rgba\(240,248,255,0\)'\)/);
 assert.match(html,/window\.__UNFIRE_SNOW_TEXTURE = new THREE\.CanvasTexture/);
 assert.match(html,/map: window\.__UNFIRE_SNOW_TEXTURE/);
 assert.match(engine,/map: window\.__UNFIRE_SNOW_TEXTURE \|\| null/);
});
test('Wednesday snow is de-duplicated when manual weather is selected',()=>{
 assert.match(html,/SNOW\.p\.visible = out && !window\.__WMAN/);
 assert.match(engine,/window\.__UNFIRE_WEATHER_MODE = k/);
 assert.match(engine,/const hasGlobalSnow =/);
 assert.match(engine,/flakes\.visible = !hasGlobalSnow/);
});
test('Snow reduces particles for lower-power devices while preserving weather settings',()=>{
 assert.match(html,/N = window\.__LOWDEV \? 480 : 1100/);
 assert.match(engine,/N = window\.__LOWDEV \? 450 : 850/);
 assert.match(engine,/NF = window\.__LOWDEV \? 160 : 280/);
 assert.match(html,/W0\.snow/);
 assert.match(engine,/WEATHER\.set\(k\)/);
});
test('Game play, renderer and existing music references remain intact',()=>{
 assert.match(engine,/window\.__NIMBO = API/);
 assert.match(engine,/NANO_PHYSICS\.move2D/);
 assert.match(html,/game-engine-v50\.js/);
 assert.match(engine,/const WRADIO =/);
});