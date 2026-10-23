'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync('audio/index.html','utf8');
function check(name,pass){assert.ok(pass,name);console.log('PASS',name);}
check('Actual real WebGL first-frame on initial DOM',html.includes('<picture id="unfireCaseFirstFrame"') &&
 html.includes('<iframe id="malFrame"') && html.indexOf('id="unfireCaseFirstFrame"')<html.indexOf('id="malFrame"'));
const mobilePreload=html.match(/as="image" href="(img[^"]*maletin-real-first-frame-mobile[.]webp(?:[?]v=[^"]+)?)"/);
const mobileSource=html.match(/<source media="[(]max-width:600px[)]" srcset="([^"]+)"/);
check('Real game capture is immediately prioritized for both layouts',html.includes('as="image" href="img/maletin-real-first-frame-desktop.webp"') &&
 Boolean(mobilePreload&&mobileSource&&mobilePreload[1]===mobileSource[1]) &&
 html.includes('loading="eager" decoding="sync"'));
check('Loading cover hides while SAME WebGL scene becomes ready',html.includes('.hero-pin.scene-ready #unfireCaseFirstFrame')&&
 html.includes('pointer-events:none')&&html.includes('.hero-pin:not(.scene-ready) .hero-copy{opacity:0!important;visibility:hidden!important}'));
check('A first-tap during slow WebGL load uses the existing immersive entry',html.includes("firstFrame.addEventListener('click'")&&
 html.includes('open(1050)')&&html.includes("const firstFrame=document.getElementById('unfireCaseFirstFrame')"));
check('Decorative background GPU painting sleeps during actual game loading',html.includes("if(visible&&scrollY>innerHeight*0.9&&!document.body.classList.contains('immOn'))draw()"));
check('Without WebGL, photo cannot launch an unsupported game',html.includes('.no-webgl #unfireCaseFirstFrame{pointer-events:none;cursor:default}'));
check('Neither additional 2D ABRIR nor fake-blue illustration reinstated',!html.includes('id="openBtn"')&&
 !html.includes('id="directOpen"')&&!html.includes('unfire-case-preview.svg'));
for(const kind of ['desktop','mobile']){
 const file=path.join('audio/img','maletin-real-first-frame-'+kind+'.webp'), data=fs.readFileSync(file);
 check(kind+' gameplay capture is real WebP under 55KB',data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP'&&data.length<55000);
}
console.log('Instant first-paint structural checks passed');
