/* Language preference only inside existing story/settings panel. English default, Spanish optional. */
(() => {
 'use strict';
 if(window.__UNFIRE_LANGUAGE_ONBOARDING)return;
 const supported=['es','en'],key='unfire_lang';
 const stored=()=>{try{return localStorage.getItem(key)}catch(_){return null}};
 const save=(l)=>{try{localStorage.setItem(key,l)}catch(_){}};
 const pick=()=> 'en'; // Brand default; Spanish remains an explicit choice.
 let submitting=false;
 function style(){
  if(document.getElementById('ufLangStyle'))return;
  const el=document.createElement('style');el.id='ufLangStyle';
  el.textContent=`
    #storyHud #ufLangSettings{border-top:1px solid #94beec66;display:flex;flex-direction:column;gap:5px;min-width:0;max-width:100%;padding:8px 3px 0}
    #storyHud #ufLangSettings label{font:700 11px Arial,sans-serif;color:#edf5ff}
    #storyHud #ufLangSettings select{min-width:0;max-width:100%;min-height:38px;padding:7px;border-radius:8px;background:#142a50;color:#fff;border:1px solid #a5c8ec;font:600 13px Arial,sans-serif}
    #storyHud #ufLangSettings select:focus-visible{outline:3px solid #fff;outline-offset:2px}
    @media(prefers-reduced-motion:reduce){#storyHud #ufLangSettings *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(el);
 }
 function commit(l){
  if(submitting||!supported.includes(l))return;
  submitting=true;save(l);
  // The game translations and neural voices initialize on document load.
  // Preserve the chosen language even when localStorage is unavailable.
  const url=new URL(location.href);
  url.searchParams.set('lang',l);url.searchParams.set('langChosen','1');
  location.replace(url.href);
 }
 function settings(){
  const hud=document.getElementById('storyHud');
  if(!hud)return false;
  if(document.getElementById('ufLangSettings'))return true;
  style();
  const group=document.createElement('div');group.id='ufLangSettings';
  const label=document.createElement('label');label.htmlFor='ufLangSelect';
  label.textContent=window.__LANG==='en'?'🌐 Language':'🌐 Idioma';
  const sel=document.createElement('select');sel.id='ufLangSelect';
  sel.setAttribute('aria-label','Language / Idioma');
  sel.innerHTML='<option value="en">English</option><option value="es">Español</option>';
  sel.value=supported.includes(window.__LANG)?window.__LANG:(stored()||pick());
  sel.addEventListener('pointerdown',e=>e.stopPropagation());
  sel.addEventListener('click',e=>e.stopPropagation());
  sel.addEventListener('change',()=>{
   if(!supported.includes(sel.value)||sel.value===window.__LANG)return;
   save(sel.value);
   commit(sel.value);
  });
  group.append(label,sel);hud.appendChild(group);
  return true;
 }
 function init(){
  // Correct the original wall-toggle too: an old ?lang=es query must not
  // override a newly chosen value saved by that existing game control.
  window.__setLang=(lang)=>commit(lang);
  if(!settings()){
   let retries=150;
   const again=()=>{if(settings()||--retries===0)return;setTimeout(again,1200)};
   again();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
 window.__UNFIRE_LANGUAGE_ONBOARDING={supported:supported.slice(),get promptOpen(){return false},settings};
})();
