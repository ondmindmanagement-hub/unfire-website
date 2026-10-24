/* UNFIRE Mutants — garage input isolation, no gameplay/WebGL changes. */
(function(root, make) {
  'use strict';
  const api=make();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(!root || !root.document) return;
  const boot=()=>api.install(root.document);
  if(root.document.readyState==='loading') root.document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})(typeof window!=='undefined'?window:null,function() {
  'use strict';
  const CSS=`
    #onl.on.workshop .b {
      display:flex; flex-direction:column; overflow:hidden;
      background:linear-gradient(163deg,rgba(23,45,76,.97),rgba(7,19,42,.98));
      border-color:rgba(219,241,255,.94);
    }
    #onl.on.workshop #onT {
      flex:1 1 auto; min-height:0; max-height:none!important;
      overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain;
      touch-action:pan-y; -webkit-overflow-scrolling:touch;
      scrollbar-width:thin; scrollbar-color:#7dbfff transparent;
      padding:5px 5px 12px 3px;
    }
    /* The same picker is used before joining/creating an ONLINE room. */
    #onl.on:not(.workshop) .b {
      box-sizing:border-box; max-height:calc(100dvh - 24px);
      overflow-y:auto; overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch; touch-action:pan-y;
    }
    #onl.on:not(.workshop) #onT {
      display:grid; grid-template-columns:repeat(auto-fill,minmax(105px,1fr));
      gap:8px; align-content:start;
      min-height:min(24dvh,150px); max-height:min(39dvh,340px);
      overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain;
      touch-action:pan-y; -webkit-overflow-scrolling:touch;
      scrollbar-width:thin; scrollbar-color:#7dbfff transparent;
      padding:6px 4px 10px;
    }
    #onl.on:not(.workshop) #onT .robotCard {
      min-width:0; white-space:normal; overflow-wrap:anywhere;
      padding:8px 6px; min-height:58px;
    }
    #onl.on:not(.workshop) #onT .robotCard:focus-visible {
      outline:3px solid #82f2ff; outline-offset:1px;
    }
    @media(max-width:650px) {
      #onl.on:not(.workshop) #onT {grid-template-columns:repeat(2,minmax(0,1fr));max-height:35dvh;}
    }
    @media(max-height:450px) and (orientation:landscape) {
      #onl.on:not(.workshop) .b {max-height:calc(100dvh - 12px);}
      #onl.on:not(.workshop) #onT {min-height:62px;max-height:35dvh;}
    }
    #onl.on.workshop #onT::-webkit-scrollbar { width:7px; }
    #onl.on.workshop #onT::-webkit-scrollbar-thumb { background:#669ed0; border-radius:10px; }
    #onl.on.workshop .robotCard { transition:border-color .15s ease, background-color .15s ease; }
    #onl.on.workshop .robotCard:focus-visible { outline:3px solid #82f2ff; outline-offset:1px; }
    #onl.on.workshop .robotCard.on { box-shadow:0 0 0 1px #8bdeff,0 4px 13px #0007; }
    #onl.on.workshop .act,#onl.on.workshop #onMsg { flex:0 0 auto; }
    @media(prefers-reduced-motion:reduce) { #onl.on.workshop .robotCard { transition:none; } }
  `;
  function install(doc) {
    const ui=doc.getElementById('onl'), list=doc.getElementById('onT'), colors=doc.getElementById('onC');
    if(!ui||!list||!colors||ui.dataset.garageScrollGuard==='1') return false;
    ui.dataset.garageScrollGuard='1';
    if(!doc.getElementById('unfireGarageScrollStyle')) {
      const style=doc.createElement('style'); style.id='unfireGarageScrollStyle';
      style.textContent=CSS;doc.head.appendChild(style);
    }
    list.setAttribute('role','region');
    list.setAttribute('tabindex','0');
    list.setAttribute('aria-label','Galería de robots. Desplázate hacia arriba o abajo para verlos todos.');
    // Workshop and room selection share #onl/#onT, but only Workshop adds .workshop.
    const open=()=>ui.classList.contains('on');
    // Native panel scroll must survive; the game's global wheel handler must not receive it.
    ui.addEventListener('wheel',event=>{
      if(ui.classList.contains('on')&&event.target&&ui.contains(event.target)) event.stopPropagation();
    },{passive:true});
    ui.addEventListener('touchmove',event=>{
      if(open()&&event.target&&ui.contains(event.target)) event.stopPropagation();
    },{passive:true});
    // paint() rebuilds the list in both story/workshop and Online; keep scroll and focus.
    const preserve=event=>{
      if(!open()) return;
      const button=event.target&&event.target.closest&&event.target.closest('button[data-t]');
      const selected=button&&button.dataset.t,before=list.scrollTop;
      queueMicrotask(()=>{
        if(!open()) return;
        list.scrollTop=before;
        if(selected!=null) {
          const next=Array.from(list.querySelectorAll('button[data-t]')).find(b=>b.dataset.t===selected);
          if(next&&next.focus) {try{next.focus({preventScroll:true});}catch(_){next.focus();}}
        }
      });
    };
    list.addEventListener('click',preserve,true);
    colors.addEventListener('click',preserve,true);
    return true;
  }
  return {install,CSS};
});
