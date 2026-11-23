/* Unfire · on-view playback for brand loops and hardware turntables · 23 Nov 2026 */
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var vids=[].slice.call(document.querySelectorAll('video[data-uf-loop]'));
  if(reduce||!('IntersectionObserver' in window)){vids.forEach(function(v){v.removeAttribute('autoplay');try{v.pause();}catch(e){}});return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;
    if(e.isIntersecting){if(v.getAttribute('preload')==='none')v.setAttribute('preload','auto');
      var p=v.play();if(p&&p.then)p.then(function(){v.classList.add('on');}).catch(function(){});else v.classList.add('on');}
    else{v.pause();}});},{threshold:.3});
  vids.forEach(function(v){io.observe(v);});
})();
