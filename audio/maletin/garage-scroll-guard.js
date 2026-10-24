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
    const open=()=>ui.classList.contains('on')&&ui.classList.contains('workshop');
    // Native panel scroll must survive; the game's global wheel handler must not receive it.
    ui.addEventListener('wheel',event=>{
      if(ui.classList.contains('on')&&event.target&&ui.contains(event.target)) event.stopPropagation();
    },{passive:true});
    ui.addEventListener('touchmove',event=>{
      if(open()&&event.target&&ui.contains(event.target)) event.stopPropagation();
    },{passive:true});
    // paint() rebuilds the robot list; preserve scroll and keyboard focus after selection.
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
