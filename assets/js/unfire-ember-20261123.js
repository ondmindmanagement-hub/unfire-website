/* Unfire · immersive layer: on-view playback, reveal on scroll, hardware explorer · 23 Nov 2026 */
(function(){
  var d=document,reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,IO='IntersectionObserver' in window;

  /* 1 · Reveal on scroll */
  var rv=[].slice.call(d.querySelectorAll('[data-uf-reveal]'));
  if(!reduce&&IO){
    d.documentElement.classList.add('uf-reveal-on');
    var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');ro.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    rv.forEach(function(el,i){el.style.setProperty('--uf-d',(i%3)*90+'ms');ro.observe(el);});
  }

  /* 2 · Play loops only while visible */
  var vids=[].slice.call(d.querySelectorAll('video[data-uf-loop]'));
  function play(v){if(v.getAttribute('preload')==='none')v.setAttribute('preload','auto');var p=v.play();if(p&&p.then)p.then(function(){v.classList.add('on');}).catch(function(){});else v.classList.add('on');}
  if(!reduce&&IO){var vo=new IntersectionObserver(function(es){es.forEach(function(e){if(e.target.dataset.held)return;e.isIntersecting?play(e.target):e.target.pause();});},{threshold:.3});vids.forEach(function(v){vo.observe(v);});}
  else vids.forEach(function(v){v.removeAttribute('autoplay');try{v.pause();}catch(e){}});

  /* 3 · Hardware explorer */
  var dlg=d.getElementById('uf-hw-dialog'),items=[].slice.call(d.querySelectorAll('.uf-hw-item[data-hw]'));
  if(!dlg||!items.length||typeof dlg.showModal!=='function')return;
  var mv=dlg.querySelector('video'),cur=0,lastFocus=null;
  function fill(i){
    cur=(i+items.length)%items.length;var it=items[cur],src=it.querySelector('video source'),img=it.querySelector('img');
    dlg.querySelector('.uf-dlg-num').textContent=String(cur+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
    dlg.querySelector('h2').textContent=it.querySelector('h3').textContent;
    dlg.querySelector('.uf-dlg-desc').textContent=it.querySelector('p').textContent;
    dlg.querySelector('.uf-dlg-spec').innerHTML=it.querySelector('.uf-spec').innerHTML;
    mv.poster=img?img.currentSrc||img.src:'';mv.setAttribute('aria-label',img?img.alt:'');
    if(src){mv.src=src.getAttribute('src');mv.load();if(!reduce){var p=mv.play();if(p&&p.catch)p.catch(function(){});}}
    dlg.classList.remove('swap');void dlg.offsetWidth;dlg.classList.add('swap');
  }
  function open(i){
    lastFocus=d.activeElement;items.forEach(function(it){var v=it.querySelector('video');if(v){v.dataset.held='1';v.pause();}});
    fill(i);d.documentElement.classList.add('uf-dlg-lock');dlg.showModal();dlg.querySelector('.uf-dlg-close').focus();
  }
  function close(){dlg.close();}
  dlg.addEventListener('close',function(){mv.pause();d.documentElement.classList.remove('uf-dlg-lock');
    items.forEach(function(it){var v=it.querySelector('video');if(v){delete v.dataset.held;var r=v.getBoundingClientRect();if(!reduce&&r.bottom>0&&r.top<innerHeight)play(v);}});
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
