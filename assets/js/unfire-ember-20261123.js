/* Unfire · immersive layer: on-view playback, reveal on scroll, hardware explorer · 23 Nov 2026 */
(function(){
  var d=document,reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,IO='IntersectionObserver' in window;

  /* 1 · Reveal on scroll */
  var rv=[].slice.call(d.querySelectorAll('[data-uf-reveal]'));
  if(!reduce&&IO){
    // Keep all section content visible immediately; the observer is retained for lightweight state only.
    var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');ro.unobserve(e.target);}});},{rootMargin:'0px 0px 240px 0px',threshold:.08});
    rv.forEach(function(el,i){el.style.setProperty('--uf-d',(i%3)*90+'ms');ro.observe(el);});
  }

  /* 2 · Video-only hardware: warm up before entry, pause beyond the approach zone. */
  var vids=[].slice.call(d.querySelectorAll('video[data-uf-loop]'));
  var ratios=new Map(),near=new Map(),active=new Set(),blocked=false,failed=new Set(),pending=new Map();
  var desktopMotion=window.matchMedia('(min-width: 1021px) and (hover: hover) and (pointer: fine)');
  function hardware(v){return !!(v.closest&&v.closest('.uf-hw-item[data-hw]'));}
  function desktopBudget(){var n=window.navigator||{};return desktopMotion.matches&&(!n.deviceMemory||n.deviceMemory>=8)&&(!n.hardwareConcurrency||n.hardwareConcurrency>=6)&&!(n.connection&&n.connection.saveData);}
  function warm(v){if(v.getAttribute('preload')==='none')v.setAttribute('preload','auto');}
  function play(v){
    if(pending.has(v))return;
    warm(v);
    var token={},p;pending.set(v,token);
    function done(){if(pending.get(v)!==token)return;pending.delete(v);if(active.has(v)&&!d.hidden&&!blocked){v.classList.add('on');}else v.pause();}
    function fail(){if(pending.get(v)!==token)return;pending.delete(v);if(active.has(v)){failed.add(v);active.delete(v);if(v.readyState>=2)v.classList.add('uf-frame');sync();}}
    try{p=v.play();if(p&&p.then)p.then(done).catch(fail);else done();}catch(e){fail();}
  }
  function sync(){
    var eligible=[];
    if(!reduce&&!d.hidden&&!blocked)eligible=vids.filter(function(v){return !v.dataset.held&&!failed.has(v)&&((ratios.get(v)||0)>0||(hardware(v)&&near.get(v)));}).sort(function(a,b){return (ratios.get(b)||0)-(ratios.get(a)||0);});
    var cards=eligible.filter(hardware),next=new Set(desktopBudget()&&cards.length?cards.slice(0,3):eligible.slice(0,1));
    var previous=active;active=next;
    vids.forEach(function(v){if(!next.has(v)&&previous.has(v)){pending.delete(v);v.pause();}});
    next.forEach(function(v){if(!previous.has(v)||(v.paused&&(ratios.get(v)||0)>0))play(v);});
  }
  if(desktopMotion.addEventListener)desktopMotion.addEventListener('change',sync);else if(desktopMotion.addListener)desktopMotion.addListener(sync);
  if(IO){
    var vo=new IntersectionObserver(function(es){es.forEach(function(e){var before=ratios.get(e.target)||0,after=e.isIntersecting?e.intersectionRatio:0;ratios.set(e.target,after);if(!before&&after>0)failed.delete(e.target);});sync();},{threshold:[0,.01,.3,.5,.75,1]});vids.forEach(function(v){vo.observe(v);});
    var approach=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;near.set(v,e.isIntersecting);if(e.isIntersecting){failed.delete(v);warm(v);}else if(!(ratios.get(v)>0))failed.delete(v);});sync();},{rootMargin:'700px 0px',threshold:0});
    vids.filter(hardware).forEach(function(v){if(v.addEventListener){v.addEventListener('loadeddata',function(){if(reduce||!active.has(v)||failed.has(v))v.classList.add('uf-frame');});v.addEventListener('playing',function(){if(active.has(v))v.classList.add('on');});}approach.observe(v);});
  }else vids.forEach(function(v){if(!reduce&&!d.hidden&&!blocked&&active.size===0){active.add(v);play(v);}else if(hardware(v)){warm(v);if(v.addEventListener)v.addEventListener('loadeddata',function(){v.classList.add('uf-frame');});}});
  d.addEventListener('visibilitychange',function(){if(!d.hidden)failed.clear();sync();});
  d.addEventListener('uf-atelier-state',function(e){blocked=!!e.detail;sync();});
  window.addEventListener('pagehide',function(){blocked=true;sync();});
  window.addEventListener('pageshow',function(){blocked=false;failed.clear();sync();});

  /* 3 · Hardware explorer */
  var dlg=d.getElementById('uf-hw-dialog'),items=[].slice.call(d.querySelectorAll('.uf-hw-item[data-hw]'));
  if(!dlg||!items.length||typeof dlg.showModal!=='function')return;
  var cur=0,lastFocus=null,expand=dlg.querySelector('.uf-dlg-expand');
  var compact=window.matchMedia('(any-pointer: coarse), (max-width: 860px)');
  function expanded(on){on=!!on&&!compact.matches&&!dlg.classList.contains('uf-low-gpu');dlg.classList.toggle('is-expanded',on);if(expand){expand.setAttribute('aria-pressed',String(on));expand.setAttribute('aria-label',on?'Restore details view':'Expand model view');expand.querySelector('span').textContent=on?'Restore':'Expand';}}
  function updateExpand(){if(compact.matches||dlg.classList.contains('uf-low-gpu'))expanded(false);if(expand)expand.hidden=compact.matches||dlg.classList.contains('uf-low-gpu');}
  if(expand)expand.addEventListener('click',function(){expanded(!dlg.classList.contains('is-expanded'));});
  if(compact.addEventListener)compact.addEventListener('change',updateExpand);else if(compact.addListener)compact.addListener(updateExpand);
  d.addEventListener('uf-hw-low-gpu',updateExpand);updateExpand();
  function fill(i){
    cur=(i+items.length)%items.length;var it=items[cur];
    dlg.querySelector('.uf-dlg-num').textContent=String(cur+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
    dlg.querySelector('h2').textContent=it.querySelector('h3').textContent;
    dlg.querySelector('.uf-dlg-desc').textContent=it.querySelector('p').textContent;
    dlg.querySelector('.uf-dlg-spec').innerHTML=it.querySelector('.uf-spec').innerHTML;
    dlg.querySelector('.uf-dlg-info').scrollTop=0;
    dlg.classList.remove('swap');void dlg.offsetWidth;dlg.classList.add('swap');
    dlg.classList.remove('is3d','error3d');dlg.classList.add('loading3d');
    var status=dlg.querySelector('.uf-3d-status');status.textContent='Preparing 3D model…';status.hidden=false;
    d.dispatchEvent(new CustomEvent('uf-hw-open',{detail:{key:it.dataset.hw}}));
  }
  function open(i){
    lastFocus=d.activeElement;blocked=true;sync();items.forEach(function(it){var v=it.querySelector('video');if(v){v.dataset.held='1';v.pause();}});
    d.documentElement.classList.add('uf-dlg-lock');dlg.showModal();fill(i);dlg.querySelector('.uf-dlg-close').focus({preventScroll:true});dlg.scrollTop=0;
  }
  function close(){dlg.close();}
  dlg.addEventListener('close',function(){expanded(false);d.dispatchEvent(new CustomEvent('uf-hw-close'));d.documentElement.classList.remove('uf-dlg-lock');
    items.forEach(function(it){var v=it.querySelector('video');if(v){delete v.dataset.held;}});
    blocked=false;sync();
    if(lastFocus&&lastFocus.focus)lastFocus.focus();});
  items.forEach(function(it,i){
    it.addEventListener('click',function(){open(i);});
    it.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(i);}});
  });
  dlg.querySelector('.uf-dlg-close').addEventListener('click',close);
  dlg.querySelector('.uf-dlg-prev').addEventListener('click',function(){fill(cur-1);});
  dlg.querySelector('.uf-dlg-next').addEventListener('click',function(){fill(cur+1);});
  dlg.addEventListener('click',function(e){if(e.target===dlg)close();});
  dlg.addEventListener('keydown',function(e){if(e.key==='ArrowRight')fill(cur+1);else if(e.key==='ArrowLeft')fill(cur-1);});
})();
/* Hyperwave atelier dialog */
(function(){var d=document,dlg=d.getElementById('uf-atelier-dialog'),b=d.getElementById('uf-atelier-open');if(!dlg||!b)return;var fr=dlg.querySelector('iframe'),last=null;
function atelierPause(value){
  try{var nested=fr.contentDocument&&fr.contentDocument.getElementById('studio-frame'),hw=nested&&nested.contentWindow.__hw;
    if(hw&&typeof hw.pause==='function'){hw.pause(value);return true;}
  }catch(e){}return false;
}
function pauseClosed(){if(!atelierPause(true))fr.removeAttribute('src');}
d.addEventListener('visibilitychange',function(){if(dlg.open)atelierPause(d.hidden);});
window.addEventListener('pagehide',function(){atelierPause(true);});
window.addEventListener('pageshow',function(){if(dlg.open)atelierPause(d.hidden);});
b.addEventListener('click',function(){if(typeof dlg.showModal!=='function'){location.href='/hyperwave-hardware/#atelier';return;}last=d.activeElement;if(!fr.getAttribute('src'))fr.src='/hyperwave-hardware/?embed=1';d.documentElement.classList.add('uf-dlg-lock');dlg.showModal();d.dispatchEvent(new CustomEvent('uf-atelier-state',{detail:true}));atelierPause(false);d.getElementById('uf-atelier-close').focus({preventScroll:true});});
d.getElementById('uf-atelier-close').addEventListener('click',function(){dlg.close();});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
dlg.addEventListener('close',function(){pauseClosed();d.dispatchEvent(new CustomEvent('uf-atelier-state',{detail:false}));d.documentElement.classList.remove('uf-dlg-lock');if(last&&last.focus)last.focus();});})();
