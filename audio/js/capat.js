const CAPAT=(()=>{const base=document.currentScript&&document.currentScript.dataset.base||'';const A={a:new Image(),b:new Image(),cache:{}};
 A.thumb=(i,o)=>{const k=(o?'b':'a')+i;if(A.cache[k])return A.cache[k];const im=A[o?'b':'a'];if(!im.complete||!im.naturalWidth)return null;const c=document.createElement('canvas');c.width=c.height=180;c.getContext('2d').drawImage(im,(i%10)*180,Math.floor(i/10)*180,180,180,0,0,180,180);return A.cache[k]=c.toDataURL('image/webp',.9)};
 const update=(el)=>{const u=A.thumb(+el.dataset.cap,el.dataset.o==='1');if(u&&el.src!==u)el.src=u};
 let filling=false;
 A.fill=()=>{if(filling)return;filling=true;const list=[...document.querySelectorAll('img[data-cap]')];let i=0;
   const batch=()=>{for(let n=0;n<8&&i<list.length;n++,i++)update(list[i]);if(i<list.length)requestAnimationFrame(batch);else filling=false;};
   requestAnimationFrame(batch);
 };
 document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest('[data-capcard]');if(!el)return;const im=el.querySelector('img[data-cap]');if(im&&im.dataset.o!=='1'){im.dataset.o='1';update(im)}});
 document.addEventListener('mouseout',e=>{const el=e.target.closest&&e.target.closest('[data-capcard]');if(!el||el.contains(e.relatedTarget))return;const im=el.querySelector('img[data-cap]');if(im){im.dataset.o='0';update(im)}});
 A.a.onload=A.b.onload=()=>{A.fill();A.ready&&A.ready()};
 let requested=false;
 A.ensure=()=>{if(requested)return;requested=true;A.a.src=base+'img/caps-a.webp';A.b.src=base+'img/caps-b.webp';};
 const reveal=()=>{const section=document.querySelector('#capsulas');if(!section){A.ensure();return;}
   if('IntersectionObserver' in window){const io=new IntersectionObserver((entries)=>{if(entries.some(e=>e.isIntersecting)){A.ensure();io.disconnect();}},{rootMargin:'750px 0px'});io.observe(section);}
   else A.ensure();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reveal,{once:true});else reveal();
 document.addEventListener('pointerover',e=>{if(e.target.closest&&e.target.closest('#capsulas'))A.ensure()},{once:true,passive:true});
 return A})();
