/* Privacy-first telemetry for Unfire Audio. No transmissions before opt-in. */
(()=>{'use strict';
  const endpoint=document.querySelector('meta[name="unfire-analytics-endpoint"]')?.content?.trim();
  if(!endpoint || !/^https:\/\//i.test(endpoint)) return;
  const accepted=()=>{try{return localStorage.getItem('unfire-cookie-consent')==='accepted'}catch{return false}};
  const session=(()=>{try{let v=sessionStorage.getItem('unfire-game-session');if(!v){v=crypto.randomUUID();sessionStorage.setItem('unfire-game-session',v)}return v}catch{return null}})();
  if(!session)return;
  const sent=new Set();
  const emit=(event)=>{
    if(!accepted()||sent.has(event))return;
    sent.add(event);
    const body=JSON.stringify({event,session});
    try{if(navigator.sendBeacon){const ok=navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain'}));if(ok)return}
      fetch(endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body,keepalive:true}).catch(()=>{});
    }catch{}
  };
  const boot=()=>{
    emit('visit');
    const check=()=>{if(document.documentElement.classList.contains('immOn')||document.body.classList.contains('immOn'))emit('play')};
    check();new MutationObserver(check).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    if(document.body)new MutationObserver(check).observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{if(e.target.closest?.('#unfireCaseFirstFrame'))setTimeout(check,250)},true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  // Consent can be granted after initial page load; do not count prior visits until it is.
  document.addEventListener('click',e=>{if(e.target.closest?.('#unfire-cookie-accept'))setTimeout(()=>emit('visit'),0)},true);
})();
