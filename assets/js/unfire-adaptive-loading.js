/* Perceived loading only. Never modifies scene, physics, audio, rendering or input. */
(function(){
'use strict';
var doc=document,root=doc.documentElement,panel=doc.getElementById('ufAdaptiveLoader');
if(!panel||panel.dataset.initialized)return;
panel.dataset.initialized='1';
var text=doc.getElementById('ufAdaptiveLabel');
var path=location.pathname.replace(/\/+$/,'').replace(/\/index\.html$/,'')||'/';
var mode=path.endsWith('/audio/maletin')?'engine':path.endsWith('/audio')?'audio':'site';
// Network hints are optional (Safari may not expose them). Never guess a
// connection speed or delay gameplay on unknown networks.
var connection=typeof navigator==='object'&&navigator?(navigator.connection||navigator.mozConnection||navigator.webkitConnection):null;
var slowNetwork=!!(connection&&(connection.saveData||/^(slow-2g|2g)$/.test(String(connection.effectiveType||''))));
var low=root.classList.contains('uf-load-pending')||(mode!=='site'&&slowNetwork);
var en=mode==='site'&&root.lang.toLowerCase().startsWith('en');
var phase='',lastDisplay=0,lastRecovery=-15000,watchStart=0,suspect=0;
var isHidden=doc.hidden,beatAt=performance.now(),ended=false,gameStarted=false;
var hideTimer=0,gameTimer=0,showDelay=0,probeTimer=0,beatTimer=0;
function clear(id){if(id)clearTimeout(id);}
function copy(kind){return en?
(kind==='recovery'?'Restoring smoothness…':kind==='game'?'Preparing the 3D world…':'Preparing the experience…'):
(kind==='recovery'?'Recuperando fluidez…':kind==='game'?'Preparando el mundo 3D…':'Preparando la experiencia…');}
function show(kind){if(doc.hidden)return;clear(hideTimer);hideTimer=0;phase=kind;lastDisplay=performance.now();
if(text)text.textContent=copy(kind);
panel.dataset.phase=kind;panel.dataset.active='true';panel.setAttribute('aria-hidden','false');}
function hide(){phase='';panel.dataset.active='false';panel.setAttribute('aria-hidden','true');}
function afterPaint(fn){requestAnimationFrame(function(){requestAnimationFrame(fn);});}
function initialDone(){if(ended)return;ended=true;root.classList.remove('uf-load-pending');if(phase==='initial')hide();}
if(low)show('initial');
window.addEventListener('load',function(){afterPaint(initialDone);},{once:true});
setTimeout(initialDone,3600);
if(doc.readyState==='complete')afterPaint(initialDone);
function ready(){
if(mode==='audio')return !!doc.getElementById('heroPin')?.classList.contains('scene-ready');
if(mode==='engine')return !!(window.__mal&&window.__mal.S);
return true;}
function pending(){
if(mode==='audio'){var f=doc.getElementById('malFrame');return !!(f&&f.getAttribute('src')&&!ready());}
return mode==='engine'&&!ready();}
function gameLoading(){
if(mode==='site'||ready()||gameStarted)return;gameStarted=true;
if(low)show('game');else showDelay=setTimeout(function(){if(pending()&&!doc.hidden)show('game');},1800);
gameTimer=setTimeout(function(){if(phase==='game')hide();},13000);}
function gameReady(){
if(!gameStarted)return;gameStarted=false;clear(showDelay);showDelay=0;clear(gameTimer);gameTimer=0;
if(phase==='game')afterPaint(function(){if(phase==='game')hide();});}
if(mode==='audio'){
var f=doc.getElementById('malFrame'),hero=doc.getElementById('heroPin');
if(f&&hero&&window.MutationObserver){
var observer=new MutationObserver(function(){if(ready())gameReady();else if(pending())gameLoading();});
observer.observe(f,{attributes:true,attributeFilter:['src']});
observer.observe(hero,{attributes:true,attributeFilter:['class']});
if(pending())gameLoading();}
window.addEventListener('unfire:scene-error',function(){gameReady();hide();});
}else if(mode==='engine'){
if(!ready())gameLoading();
var attempts=0;
probeTimer=setInterval(function(){
if(ready()||++attempts>=95){gameReady();clearInterval(probeTimer);}
},160);}
function queueBeat(){if(!doc.hidden&&!beatTimer)beatTimer=setTimeout(beat,320);}
function beat(){
beatTimer=0;
var now=performance.now(),gap=now-beatAt;beatAt=now;
if(!isHidden&&doc.visibilityState==='visible'&&!pending()&&now>2200&&phase!=='game'){
if(gap>1000&&gap<120000){
if(!watchStart||now-watchStart>6500){watchStart=now;suspect=0;}
suspect+=(gap>2100?2:1);
}else if(gap<550&&suspect)suspect=Math.max(0,suspect-0.15);
if(suspect>=2&&now-lastRecovery>14000){
lastRecovery=now;suspect=0;show('recovery');
hideTimer=setTimeout(function(){if(phase==='recovery')hide();},1900);
}}
queueBeat();}
doc.addEventListener('visibilitychange',function(){
isHidden=doc.hidden;beatAt=performance.now();suspect=0;
if(isHidden){clear(beatTimer);beatTimer=0;if(phase==='recovery')hide();}
else queueBeat();
});
window.addEventListener('pageshow',function(){beatAt=performance.now();suspect=0;});
queueBeat();
window.__UNFIRE_ADAPTIVE_LOADING={get mode(){return mode;},get lowPower(){return low;},get state(){return phase||'ready';}};
})();
