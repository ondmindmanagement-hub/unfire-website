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

  /* 2 · Play loops only while visible */
  var vids=[].slice.call(d.querySelectorAll('video[data-uf-loop]'));
  var ratios=new Map(),active=new Set(),blocked=false,failed=new Set();
  var desktopMotion=window.matchMedia('(min-width: 1021px) and (hover: hover) and (pointer: fine)');
  function hardware(v){return !!(v.closest&&v.closest('.uf-hw-item[data-hw]'));}
  function desktopBudget(){var n=window.navigator||{};return desktopMotion.matches&&(!n.deviceMemory||n.deviceMemory>=8)&&(!n.hardwareConcurrency||n.hardwareConcurrency>=6)&&!(n.connection&&n.connection.saveData);}
  function play(v){
    if(v.getAttribute('preload')==='none')v.setAttribute('preload','auto');
    var p=v.play();if(p&&p.then)p.then(function(){if(active.has(v)&&!d.hidden&&!blocked)v.classList.add('on');else v.pause();}).catch(function(){if(active.has(v)){failed.add(v);active.delete(v);sync();}});else v.classList.add('on');
  }
  function sync(){
    var eligible=[];
    if(!reduce&&!d.hidden&&!blocked)eligible=vids.filter(function(v){return !v.dataset.held&&!failed.has(v)&&(ratios.get(v)||0)>=.3;}).sort(function(a,b){return ratios.get(b)-ratios.get(a);});
    var cards=eligible.filter(hardware),next=new Set(desktopBudget()&&cards.length?cards.slice(0,3):eligible.slice(0,1));
    var previous=active;active=next;
    vids.forEach(function(v){if(!next.has(v)&&previous.has(v))v.pause();});
    next.forEach(function(v){if(!previous.has(v))play(v);});
  }
  if(desktopMotion.addEventListener)desktopMotion.addEventListener('change',sync);else if(desktopMotion.addListener)desktopMotion.addListener(sync);
  if(!reduce&&IO){var vo=new IntersectionObserver(function(es){es.forEach(function(e){ratios.set(e.target,e.isIntersecting?e.intersectionRatio:0);});sync();},{threshold:[0,.3,.5,.75,1]});vids.forEach(function(v){vo.observe(v);});}
  else vids.forEach(function(v){v.removeAttribute('autoplay');try{v.pause();}catch(e){}});
  d.addEventListener('visibilitychange',sync);
  d.addEventListener('uf-atelier-state',function(e){blocked=!!e.detail;sync();});
  window.addEventListener('pagehide',function(){blocked=true;sync();});
  window.addEventListener('pageshow',function(){blocked=false;sync();});

  /* 3 · Hardware explorer */
  var dlg=d.getElementById('uf-hw-dialog'),items=[].slice.call(d.querySelectorAll('.uf-hw-item[data-hw]'));
  if(!dlg||!items.length||typeof dlg.showModal!=='function')return;
  var mv=dlg.querySelector('video'),cur=0,lastFocus=null,expand=dlg.querySelector('.uf-dlg-expand');
  var compact=window.matchMedia('(any-pointer: coarse), (max-width: 860px)');
  function expanded(on){on=!!on&&!compact.matches&&!dlg.classList.contains('uf-low-gpu');dlg.classList.toggle('is-expanded',on);if(expand){expand.setAttribute('aria-pressed',String(on));expand.setAttribute('aria-label',on?'Restore details view':'Expand model view');expand.querySelector('span').textContent=on?'Restore':'Expand';}}
  function updateExpand(){if(compact.matches||dlg.classList.contains('uf-low-gpu'))expanded(false);if(expand)expand.hidden=compact.matches||dlg.classList.contains('uf-low-gpu');}
  if(expand)expand.addEventListener('click',function(){expanded(!dlg.classList.contains('is-expanded'));});
  if(compact.addEventListener)compact.addEventListener('change',updateExpand);else if(compact.addListener)compact.addListener(updateExpand);
  d.addEventListener('uf-hw-low-gpu',updateExpand);updateExpand();
  function fill(i){
    cur=(i+items.length)%items.length;var it=items[cur],src=it.querySelector('video source'),img=it.querySelector('img');
    dlg.querySelector('.uf-dlg-num').textContent=String(cur+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
    dlg.querySelector('h2').textContent=it.querySelector('h3').textContent;
    dlg.querySelector('.uf-dlg-desc').textContent=it.querySelector('p').textContent;
    dlg.querySelector('.uf-dlg-spec').innerHTML=it.querySelector('.uf-spec').innerHTML;
    dlg.querySelector('.uf-dlg-info').scrollTop=0;
    mv.poster=img?img.currentSrc||img.src:'';mv.setAttribute('aria-label',img?img.alt:'');
    mv.dataset.src=src?src.getAttribute('src'):'';
    if(dlg.classList.contains('has3d')){mv.pause();mv.removeAttribute('src');}
    else if(src&&!dlg.classList.contains('uf-low-gpu')&&!compact.matches){mv.src=mv.dataset.src;mv.load();if(!reduce){var p=mv.play();if(p&&p.catch)p.catch(function(){});}}
    dlg.classList.remove('swap');void dlg.offsetWidth;dlg.classList.add('swap');
    d.dispatchEvent(new CustomEvent('uf-hw-open',{detail:{key:it.dataset.hw}}));
  }
  function open(i){
    lastFocus=d.activeElement;blocked=true;sync();items.forEach(function(it){var v=it.querySelector('video');if(v){v.dataset.held='1';v.pause();}});
    fill(i);d.documentElement.classList.add('uf-dlg-lock');dlg.showModal();dlg.querySelector('.uf-dlg-close').focus({preventScroll:true});dlg.scrollTop=0;
  }
  function close(){dlg.close();}
  dlg.addEventListener('close',function(){expanded(false);mv.pause();d.dispatchEvent(new CustomEvent('uf-hw-close'));d.documentElement.classList.remove('uf-dlg-lock');
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
(function(){var d=document,dlg=d.getElementById('uf-atelier-dialog'),b=d.getElementById('uf-atelier-open');if(!dlg||!b)return;var fr=dlg.querySelector('iframe'),last=null,wait=d.getElementById('uf-atelier-wait'),waitTimer=0;
function endWait(){clearTimeout(waitTimer);if(wait)wait.hidden=true;}
fr.addEventListener('load',function(){try{if(fr.contentDocument.getElementById('studio-load'))endWait();}catch(e){}});
function startWait(){if(!wait)return;clearTimeout(waitTimer);wait.hidden=false;wait.textContent='Opening Hyperwave 2000…';waitTimer=setTimeout(function(){wait.textContent='Still connecting. Close and reopen if needed.';},15000);}
function atelierPause(value){
  try{var nested=fr.contentDocument&&fr.contentDocument.getElementById('studio-frame'),hw=nested&&nested.contentWindow.__hw;
    if(hw&&typeof hw.pause==='function'){hw.pause(value);return true;}
  }catch(e){}return false;
}
function pauseClosed(){if(!atelierPause(true))fr.removeAttribute('src');}
d.addEventListener('visibilitychange',function(){if(dlg.open)atelierPause(d.hidden);});
window.addEventListener('pagehide',function(){atelierPause(true);});
window.addEventListener('pageshow',function(){if(dlg.open)atelierPause(d.hidden);});
b.addEventListener('click',function(){if(typeof dlg.showModal!=='function'){location.href='/hyperwave-hardware/#atelier';return;}last=d.activeElement;if(!fr.getAttribute('src')){startWait();fr.src='/hyperwave-hardware/?embed=1&v=20261124audiofit2';}else endWait();d.documentElement.classList.add('uf-dlg-lock');dlg.showModal();d.dispatchEvent(new CustomEvent('uf-atelier-state',{detail:true}));atelierPause(false);d.getElementById('uf-atelier-close').focus({preventScroll:true});});
d.getElementById('uf-atelier-close').addEventListener('click',function(){dlg.close();});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
dlg.addEventListener('close',function(){endWait();pauseClosed();d.dispatchEvent(new CustomEvent('uf-atelier-state',{detail:false}));d.documentElement.classList.remove('uf-dlg-lock');if(last&&last.focus)last.focus();});})();
