'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const lang=fs.readFileSync('audio/maletin/language-onboarding.js','utf8');
const game=fs.readFileSync('audio/maletin/index.html','utf8');
const host=fs.readFileSync('audio/index.html','utf8');
test('computer close button remains above the desktop and Escape closes without exit from game',()=>{
 assert.match(src,/id=tubeX aria-label="Close computer"/);
 assert.match(src,/#tube \.bar\{position:relative;isolation:isolate;z-index:25/);
 assert.match(src,/#tube #tubeX\{display:inline-flex!important/);
 assert.match(src,/#tube #pcDesktop,#tube #pcSecret\{position:absolute;inset:44px 0 0/);
 assert.match(src,/const closeComputer=\(\)=>\{d\.classList\.remove\('on'\)/);
 assert.match(src,/if\(e\.key==='Escape'&&d\.classList\.contains\('on'\)\)/);
});
test('language selector only lives in gear settings, not floating in the game',()=>{
 assert.match(lang,/group\.id='ufLangSettings'/);
 assert.match(lang,/sel\.id='ufLangSelect'/);
 assert.match(lang,/hud\.appendChild\(group\)/);
 assert.doesNotMatch(lang,/ufLangQuick|quickSettings\(\)/);
 assert.match(game,/language-onboarding\.js\?v=20261104settings3/);
});
test('right-hand action buttons are grouped behind one compact accessible toggle',()=>{
 assert.ok(src.includes('[roamB,camB,recB,surfB,onlB,nimB].forEach'),'all six existing actions retained');
 assert.ok(src.includes('actionItems.appendChild(b)'),'actions moved inside the folded container');
 assert.match(src,/actionItems\.id='ufActionItems'/);
 assert.match(src,/actionItems\.hidden=true/);
 assert.match(src,/actionToggle\.id='ufActionsToggle'/);
 assert.match(src,/actionToggle\.setAttribute\('aria-controls','ufActionItems'\)/);
 assert.match(src,/actionItems\.hidden=!v/);
 assert.match(src,/const target=dock\.querySelector\('#ufActionItems'\)\|\|dock/);
 assert.match(src,/#ufActionItems\[hidden\]\{display:none!important\}/);
});
test('online puts joining real existing rooms first; no made-up room list or solo quick-match fallback',()=>{
 assert.match(src,/rowCreate\.before\(rowJoin\)/);
 assert.match(src,/id="onFind"/);
 assert.match(src,/id='onHostPublic'/);
 assert.match(src,/const PUBLIC_CODES=Array\.from\(\{length:8\}/);
 assert.match(src,/c=p\.connect\('unfire-sala-'\+cc,\{reliable:false\}\)/);
 assert.match(src,/c\.on\('open',\(\)=>\{/);
 assert.match(src,/if\(hostWaiting\)\{hostWaiting=false;started\(\);\}/);
 assert.match(src,/No active public room found/);
 assert.match(src,/g\('onFind'\)\.onclick=\(\)=>ONLINE\.joinPublic\(\)/);
 assert.doesNotMatch(src,/onFind[^\n]*\.create\(/);
});
test('host and iframe assets have matching freshness versions',()=>{
 assert.match(host,/maletin\/index\.html\?v=20261109steadyfly1/);
 assert.match(game,/game-engine-v50\.js\?v=20261109steadyfly1/);
});
