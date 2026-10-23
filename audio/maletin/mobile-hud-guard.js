/* UNFIRE HUD guard: attach to existing #mix, preserve native audio logic.
   MutationObservers wait for lazy-created music controls, then disconnect.
   No render loop or WebGL operation is introduced. */
(()=>{'use strict';
  const id='unfireMixToggle';
  let mix;
  const close=()=>{
    if(!mix)return;
    mix.classList.remove('unfire-expanded');
    document.body.classList.remove('unfire-mix-open');
    const b=document.getElementById(id);
    if(b){b.setAttribute('aria-expanded','false');b.textContent='♫ MÚSICA · AJUSTES';}
  };
  const sync=()=>{
    if(!mix)return;
    const body=document.body;
    if(!mix.classList.contains('on') ||
       body.classList.contains('storyOn') ||
       body.classList.contains('unfire-roaming') ||
       document.getElementById('wradio')?.classList.contains('expanded'))close();
  };
  const attach=()=>{
    const d=document.getElementById('mix');
    if(!d||document.getElementById(id))return false;
    mix=d;
    const b=document.createElement('button');
    b.id=id;b.type='button';b.textContent='♫ MÚSICA · AJUSTES';
    b.setAttribute('aria-label','Abrir o cerrar ajustes de música');
    b.setAttribute('aria-expanded','false');
    d.insertBefore(b,d.querySelector('.row'));
    b.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      if(!d.classList.contains('on'))return;
      const expanded=d.classList.toggle('unfire-expanded');
      document.body.classList.toggle('unfire-mix-open',expanded);
      b.setAttribute('aria-expanded',String(expanded));
      b.textContent=expanded?'✕ CERRAR MÚSICA':'♫ MÚSICA · AJUSTES';
    });
    const mo=new MutationObserver(sync);
    mo.observe(d,{attributes:true,attributeFilter:['class']});
    mo.observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('pointerdown',e=>{
      if(mix?.classList.contains('unfire-expanded')&&!mix.contains(e.target))close();
    },{capture:true,passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    window.addEventListener('orientationchange',close,{passive:true});
    window.addEventListener('resize',close,{passive:true});
    sync();
    return true;
  };
  if(!attach()){
    const wait=new MutationObserver(()=>{if(attach())wait.disconnect();});
    wait.observe(document.body,{childList:true});
    window.addEventListener('pagehide',()=>wait.disconnect(),{once:true});
  }
})();
