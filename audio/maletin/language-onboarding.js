/* First-run language choice, saved locally; use the existing story/settings panel. */
(() => {
 'use strict';
 if(window.__UNFIRE_LANGUAGE_ONBOARDING)return;
 const supported=['es','en'],key='unfire_lang';
 const param=new URLSearchParams(location.search);
 const stored=()=>{try{return localStorage.getItem(key)}catch(_){return null}};
 const save=(l)=>{try{localStorage.setItem(key,l)}catch(_){}};
 const pick=()=>String(navigator.language||'es').toLowerCase().startsWith('es')?'es':'en';
 let promptOpen=false,submitting=false;
 function style(){
  if(document.getElementById('ufLangStyle'))return;
  const el=document.createElement('style');el.id='ufLangStyle';el.textContent="#ufLangFirst{position:fixed;inset:0;z-index:2147000000;display:grid;place-items:center;background:radial-gradient(ellipse at center,#1b3055,#03040a 70%);color:#f5f8ff;font:15px Arial,sans-serif;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));box-sizing:border-box}\n#ufLangFirst *{box-sizing:border-box}\n#ufLangFirst .ufl-card{display:grid;gap:16px;text-align:center;max-height:90dvh;overflow:auto;width:min(390px,100%);padding:18px 8px}\n#ufLangFirst .ufl-logo{font-size:12px;letter-spacing:.3em;color:#b4c7e7;font-weight:800}\n#ufLangFirst h2{font-size:clamp(25px,6vw,38px);margin:4px 0;font-weight:800}\n#ufLangFirst p{margin:0;color:#ccd9ee;font-size:13px;line-height:1.6}\n#ufLangFirst .ufl-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n#ufLangFirst button{touch-action:manipulation;min-height:56px;border:1px solid #abc7f277;background:#112344;color:white;border-radius:11px;font:700 15px Arial,sans-serif;cursor:pointer}\n#ufLangFirst button[aria-pressed=true]{background:#294677;border-color:#e3eeff;box-shadow:inset 0 0 0 2px #8cbbee66}\n#ufLangFirst .ufl-start{background:#dbeaff;color:#10213d}\n#ufLangFirst button:focus-visible{outline:3px solid white;outline-offset:3px}\n#storyHud #ufLangSettings{border-top:1px solid #94beec66;display:flex;flex-direction:column;gap:5px;min-width:0;max-width:100%;padding:8px 3px 0}\n#storyHud #ufLangSettings label{font:700 11px Arial,sans-serif;color:#edf5ff}\n#storyHud #ufLangSettings select{min-width:0;max-width:100%;min-height:38px;padding:7px;border-radius:8px;background:#142a50;color:white;border:1px solid #a5c8ec;font:600 13px Arial,sans-serif}\n@media(prefers-reduced-motion:reduce){#ufLangFirst *,#storyHud #ufLangSettings *{animation:none!important;transition:none!important}}";
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
 function first(){
  if(supported.includes(stored())||supported.includes(param.get('lang')))return;
  if(navigator.webdriver&&param.get('languageQA')!=='1')return;
  style();
  const el=document.createElement('section');
  el.id='ufLangFirst';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.setAttribute('aria-labelledby','uflTitle');
  el.innerHTML=[
   '<div class="ufl-card"><div class="ufl-logo" translate="no">UNFIRE GAMES</div>',
   '<h2 id="uflTitle">Selecciona idioma</h2>',
   '<p>Choose your language · Elige tu idioma</p>',
   '<div class="ufl-pair" role="group" aria-label="Language / Idioma">',
   '<button type="button" data-lang="es">Español</button>',
   '<button type="button" data-lang="en">English</button></div>',
   '<button class="ufl-start" type="button" id="ufLangContinue">CONTINUAR</button>',
   '<p>Podrás cambiarlo en Configuración · Change later in Settings</p></div>'
  ].join('');
  document.body.appendChild(el);promptOpen=true;
  let selected=pick();
  const buttons=[...el.querySelectorAll('[data-lang]')];
  const title=el.querySelector('#uflTitle'),next=el.querySelector('#ufLangContinue');
  const update=()=>{
   buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===selected)));
   title.textContent=selected==='es'?'Selecciona idioma':'Choose language';
   next.textContent=selected==='es'?'CONTINUAR':'CONTINUE';
  };
  buttons.forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.lang;update()}));
  next.addEventListener('click',()=>commit(selected));update();
  try{buttons.find(b=>b.dataset.lang===selected)?.focus({preventScroll:true})}catch(_){}
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
  sel.innerHTML='<option value="es">Español</option><option value="en">English</option>';
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
  first();
  if(!settings()){
   let retries=150;
   const again=()=>{if(settings()||--retries===0)return;setTimeout(again,1200)};
   again();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
 window.__UNFIRE_LANGUAGE_ONBOARDING={supported:supported.slice(),get promptOpen(){return promptOpen},settings};
})();
