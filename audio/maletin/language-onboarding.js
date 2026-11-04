/* First-run language choice, saved locally; use the existing story/settings panel. */
(() => {
 'use strict';
 if(window.__UNFIRE_LANGUAGE_ONBOARDING)return;
 const supported=['es','en'],key='unfire_lang';
 const param=new URLSearchParams(location.search);
 const stored=()=>{try{return localStorage.getItem(key)}catch(_){return null}};
 const save=(l)=>{try{localStorage.setItem(key,l)}catch(_){}};
 const pick=()=> 'en'; // Brand default; Spanish remains an explicit choice.
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
  if(window.UNFIRE_INTRO&&window.UNFIRE_INTRO.active)return; // the Y2K Robots opening asks for the language
  style();
  const el=document.createElement('section');
  el.id='ufLangFirst';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.setAttribute('aria-labelledby','uflTitle');
  el.innerHTML=[
   '<div class="ufl-card"><div class="ufl-logo" translate="no">UNFIRE GAMES</div>',
   '<h2 id="uflTitle">Selecciona idioma</h2>',
   '<p>Choose your language · Elige tu idioma</p>',
   '<div class="ufl-pair" role="group" aria-label="Language / Idioma">',
   '<button type="button" data-lang="en">English</button>',
   '<button type="button" data-lang="es">Español</button></div>',
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
 function quickSettings(){
  if(document.getElementById('ufLangQuick'))return;
  style();
  const css=document.createElement('style');css.id='ufLangQuickStyle';
  css.textContent=`
    #ufLangQuick{position:fixed;right:max(68px,calc(env(safe-area-inset-right) + 68px));top:calc(env(safe-area-inset-top) + 62px);z-index:68;font:700 12px Arial,sans-serif;color:#f4f9ff;pointer-events:auto}
    #ufLangQuick *{box-sizing:border-box}
    #ufLangQuickButton{min-height:38px;padding:7px 13px;border-radius:999px;border:1.5px solid #b4ddff;background:linear-gradient(180deg,#235a98,#102749);color:#fff;box-shadow:0 3px 10px #0008;cursor:pointer;font:700 12px Arial,sans-serif;white-space:nowrap}
    #ufLangQuickButton:focus-visible,#ufLangQuickPanel button:focus-visible{outline:3px solid #f8f8ff;outline-offset:3px}
    #ufLangQuickPanel{position:absolute;right:0;top:calc(100% + 8px);width:min(250px,calc(100vw - 24px));padding:14px;background:linear-gradient(165deg,#122c50,#07152f);border:1.5px solid #87bfff;border-radius:14px;box-shadow:0 12px 28px #000a;display:grid;gap:9px}
    #ufLangQuickPanel[hidden]{display:none}
    #ufLangQuickPanel strong{font:800 14px Arial,sans-serif;color:#f1f9ff}
    #ufLangQuickPanel button{min-height:42px;padding:9px;border:1px solid #81afe4;border-radius:9px;background:#15335d;color:#fff;cursor:pointer;text-align:left;font:700 13px Arial,sans-serif}
    #ufLangQuickPanel button[aria-pressed=true]{border-color:#f5faff;background:#265e9d;box-shadow:inset 3px 0 #8bedff}
    #ufLangQuickPanel small{font:500 11px/1.4 Arial,sans-serif;color:#bed2ed}
    @media(max-height:470px){#ufLangQuick{top:calc(env(safe-area-inset-top) + 8px)}}
    @media(max-width:400px){#ufLangQuick{right:max(62px,calc(env(safe-area-inset-right) + 62px))}#ufLangQuickButton{padding:6px 9px;font-size:11px}}
    @media(prefers-reduced-motion:reduce){#ufLangQuick *{transition:none!important}}
  `;
  document.head.appendChild(css);
  const wrap=document.createElement('div');wrap.id='ufLangQuick';
  wrap.innerHTML='<button id="ufLangQuickButton" type="button" aria-expanded="false" aria-controls="ufLangQuickPanel">🌐 LANGUAGE</button><div id="ufLangQuickPanel" role="group" aria-label="Game language / Idioma del juego" hidden><strong>Language · Idioma</strong><button type="button" data-game-lang="en">English</button><button type="button" data-game-lang="es">Español</button><small>The language will apply when the game reloads.</small></div>';
  const button=wrap.querySelector('#ufLangQuickButton'), panel=wrap.querySelector('#ufLangQuickPanel');
  const selected=supported.includes(window.__LANG)?window.__LANG:(stored()||'en');
  button.textContent=selected==='es'?'🌐 IDIOMA':'🌐 LANGUAGE';
  panel.querySelector('small').textContent=selected==='es'?'El juego se recargará para aplicar el idioma.':'The game reloads to apply the language.';
  for(const item of panel.querySelectorAll('[data-game-lang]')){
    item.setAttribute('aria-pressed',String(item.dataset.gameLang===selected));
    item.addEventListener('click',()=>{if(item.dataset.gameLang===selected){panel.hidden=true;button.setAttribute('aria-expanded','false');return;}commit(item.dataset.gameLang);});
  }
  const close=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
  wrap.addEventListener('pointerdown',e=>e.stopPropagation());
  wrap.addEventListener('click',e=>e.stopPropagation());
  wrap.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.stopPropagation();button.focus();}});
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();});
  document.body.appendChild(wrap);
 }
 function init(){
  // Correct the original wall-toggle too: an old ?lang=es query must not
  // override a newly chosen value saved by that existing game control.
  window.__setLang=(lang)=>commit(lang);
  first();
  quickSettings();
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
