/* UNFIRE · Offline coins, collectibles & transform shop.
   Isolated local-only economy: never used for online rooms or money transactions. */
(() => {
  'use strict';
  const SAVE_KEY = 'unfire_offline_coins_v1';
  const CLAIM_KEY = 'unfire_offline_coin_claims_v1';
  const MAX_BALANCE = 999999;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const clean = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const initial = { balance: 0, owned: ['robot-4','robot-1'], morph: 'robot-4', aura: '', color: '', magnet: false, bonus: false, deco: false, footprint: false };
  const saved = read(SAVE_KEY, initial);
  const state = { ...initial, ...saved, balance: Number.isSafeInteger(saved.balance) && saved.balance >= 0 ? Math.min(saved.balance, MAX_BALANCE) : 0,
    owned: Array.isArray(saved.owned) ? [...new Set(saved.owned.filter(v => typeof v === 'string'))].slice(0,100) : initial.owned.slice() };
  const persist = () => write(SAVE_KEY, state);
  const day = () => { const d = new Date(); return [d.getFullYear(),d.getMonth()+1,d.getDate()].join('-'); };
  const prev = read(CLAIM_KEY, {});
  const dayKey = value => { const parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value || '')); return parts ? Number(parts[1])*10000 + Number(parts[2])*100 + Number(parts[3]) : 0; };
  // Never replenish coins by moving the local clock backwards within a session or reopening the page.
  let date = dayKey(prev.date) > dayKey(day()) ? prev.date : day();
  const claimed = new Set(prev.date === date && Array.isArray(prev.ids) ? prev.ids.filter(v => Number.isInteger(v) && v >= 0 && v < 40) : []);
  const persistClaims = () => write(CLAIM_KEY, { date, ids: [...claimed] });
  function rolloverClaims() {
    const today = day();
    if (dayKey(today) <= dayKey(date)) return;
    date = today;
    claimed.clear();
    persistClaims();
  }
  const MORPH_ORDER = [4,1,7,10,13,16,2,5,8,11,14,17,3,6,9,12,15,18,0,19];
  const EXTRAS = [
    { id:'aura-cyan', title:'Aura azul neón', price:12, group:'Efectos', kind:'aura', value:'cyan' },
    { id:'aura-pink', title:'Aura rosa neón', price:12, group:'Efectos', kind:'aura', value:'pink' },
    { id:'color-gold', title:'Acabado dorado', price:10, group:'Personalización', kind:'color', value:'#ffd21a' },
    { id:'color-violet', title:'Acabado violeta', price:10, group:'Personalización', kind:'color', value:'#9b6bff' },
    { id:'footprints', title:'Huellas de luz', price:14, group:'Efectos', kind:'footprint' },
    { id:'deco', title:'Lámpara de la casa', price:18, group:'Decoración', kind:'deco' },
    { id:'magnet', title:'Imán de monedas', price:16, group:'Exploración', kind:'magnet' },
    { id:'bonus', title:'Moneda doble', price:24, group:'Exploración', kind:'bonus' }
  ];
  const coords = [
    [-30,24],[-44,37],[-57,63],[-19,72],[25,76],[56,62],[64,30],[37,13],
    [15,48],[-64,10],[-20,0],[44,-3],[-30,111],[-55,130],[0,153],
    [55,135],[86,115],[115,82],[-90,77],[-133,42],[147,33],
    [-185,125],[205,10],[9,210],[-35,246],[242,65],
    [308,140],[-290,-10],[400,-60],[-480,200],[530,70],[610,80]
  ];
  window.UNFIRE_COINS_BOOT = function ({ROAMS, THREE, S, MUTANTS}) {
    if (window.UNFIRE_COINS) return window.UNFIRE_COINS;
    const active = () => !!ROAMS.on && !(window.ONLINE_ON && window.ONLINE_ON());
    const entries = MORPH_ORDER.filter(n => n < MUTANTS.list.length).map((n,i) => ({
      id:'robot-'+n, title:MUTANTS.list[n].name || 'Robot '+n, kind:'robot', value:n,
      price:i<2?0:20+Math.floor((i-2)/3)*8, group:'Transformaciones'
    })).concat(EXTRAS);
    const root = document.createElement('div'); root.id = 'unfireCoinSystem'; root.innerHTML =
      '<style>\n' +
      '#unfireCoinHud{position:fixed;z-index:43;top:calc(env(safe-area-inset-top) + 63px);right:max(12px,env(safe-area-inset-right));display:none;align-items:center;gap:9px;border:1px solid #e7ba4f8e;border-radius:999px;background:#10192bee;color:#ffe38a;padding:7px 11px;font:800 12px system-ui;box-shadow:0 4px 19px #0006;cursor:pointer;min-height:38px}\n' +
      '#unfireCoinHud:focus-visible,#unfireCoinShop button:focus-visible{outline:3px solid #7fcbff;outline-offset:2px}\n' +
      '#unfireCoinShop{position:fixed;inset:0;z-index:98;background:#020816d8;display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font:13px system-ui;color:#eaf4ff}\n' +
      '#unfireCoinShop.open{display:flex}\n' +
      '#unfireCoinShop .panel{width:min(620px,100%);max-height:min(85dvh,800px);overflow-y:auto;overscroll-behavior:contain;border:1px solid #478cc9;border-radius:20px;padding:18px;background:linear-gradient(165deg,#15263b,#081321);box-shadow:0 22px 90px #000b}\n' +
      '#unfireCoinShop .heading{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}\n' +
      '#unfireCoinShop h2{font-size:19px;margin:0}#unfireCoinShop h3{font-size:13px;color:#86ddff;margin:17px 0 7px}\n' +
      '#unfireCoinShop .items{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px}\n' +
      '#unfireCoinShop button{border:1px solid #4774aa;border-radius:12px;background:#1b3651;color:#fff;padding:11px;min-height:44px;cursor:pointer;font:700 12px system-ui;text-align:left}\n' +
      '#unfireCoinShop .items button[disabled]{opacity:.5;cursor:default}#unfireCoinShop small{display:block;color:#ffde7c;margin-top:6px}\n' +
      '#unfireCoinShop [data-close]{flex:none;background:#28445e}#unfireCoinShop .hint{color:#bdd3e7;font-size:12px;line-height:1.4}\n' +
      'body.storyOn #unfireCoinHud,body.storyOn #unfireCoinShop{display:none!important}\n' +
      '@media(max-height:480px){#unfireCoinHud{top:calc(env(safe-area-inset-top) + 39px);font-size:11px}#unfireCoinShop .panel{max-height:88dvh;padding:11px}}\n' +
      '@media(prefers-reduced-motion:reduce){#unfireCoinSystem *{animation:none!important;transition:none!important}}\n' +
      '</style><button id="unfireCoinHud" type="button" aria-label="Abrir tienda de monedas"><span aria-hidden="true">🟡</span><span data-wallet>0</span><span aria-hidden="true">＋</span></button>' +
      '<section id="unfireCoinShop" role="dialog" aria-modal="true" aria-label="Tienda de monedas" aria-hidden="true"><div class="panel"><div class="heading"><h2>🟡 Unfire Coins</h2><button data-close type="button" aria-label="Cerrar tienda">✕</button></div><div class="hint">Recoge monedas explorando y desbloquea cosas para tu partida individual. No cuesta dinero. No afecta al online.</div><p data-available aria-live="polite"></p><div data-products></div><p data-message aria-live="polite"></p></div></section>';
    document.body.appendChild(root);
    const hud = root.querySelector('#unfireCoinHud'), shop = root.querySelector('#unfireCoinShop'), list = root.querySelector('[data-products]'),
      available = root.querySelector('[data-available]'), msg = root.querySelector('[data-message]'), wallet = root.querySelector('[data-wallet]');
    const current = () => entries.find(e => e.kind==='robot' && e.id===state.morph);
    let previousFocus = null;
    let lastBalance=-1,lastActive=null;
    function updateHud() { const a=active();if(lastBalance!==state.balance){wallet.textContent=state.balance.toLocaleString('es-ES');lastBalance=state.balance;}if(a!==lastActive){hud.style.display=a?'flex':'none';lastActive=a;} }
    function owned(item) { return item.price===0 || state.owned.includes(item.id); }
    function isEquipped(e) { return e.kind==='robot' ? state.morph===e.id
      : e.kind==='aura' ? state.aura===e.value : e.kind==='color' ? state.color===e.value
      : !!state[e.kind]; }
    function render() {
      available.textContent='Monedas disponibles: '+state.balance;
      list.innerHTML='';
      ['Transformaciones','Personalización','Efectos','Decoración','Exploración'].forEach(group => {
        const items=entries.filter(e=>e.group===group);
        if(!items.length)return;
        const heading=document.createElement('h3');heading.textContent=group;list.appendChild(heading);
        const grid=document.createElement('div');grid.className='items';
        items.forEach(e => {
          const b=document.createElement('button');b.type='button';b.dataset.item=e.id;
          b.disabled=!owned(e)&&state.balance<e.price;
          b.innerHTML=clean(e.title)+'<small>'+ (isEquipped(e)?'✓ Equipado':owned(e)?'Usar':e.price+' 🟡')+'</small>';
          grid.appendChild(b);
        });
        list.appendChild(grid);
      });
    }
    function equip(e) {
      if(e.kind==='robot'){state.morph=e.id; ROAMS.myType=e.value;}
      else if(e.kind==='aura')state.aura=e.value;
      else if(e.kind==='color'){state.color=e.value;ROAMS.myCol=e.value;}
      else state[e.kind]=true;
      if((e.kind==='robot'||e.kind==='color') && ROAMS.av){if(ROAMS.av.w)S.scene.remove(ROAMS.av.w);ROAMS.av=null;}
      persist(); render();
      msg.textContent='✓ '+e.title+' activado';
    }
    function buy(id){
      if(!active() || !shop.classList.contains('open'))return false;
      const e=entries.find(e=>e.id===id);if(!e)return false;
      if(!owned(e)){
        if(state.balance<e.price)return false;
        state.balance-=e.price;state.owned.push(e.id);persist();updateHud();
      }
      equip(e);return true;
    }
    function open(){if(!active())return;previousFocus=document.activeElement;ROAMS.k={};render();shop.classList.add('open');shop.setAttribute('aria-hidden','false');shop.querySelector('[data-close]').focus();}
    function close(){shop.classList.remove('open');shop.setAttribute('aria-hidden','true');msg.textContent='';if(previousFocus&&previousFocus.focus)previousFocus.focus();}
    hud.onclick=open;
    shop.querySelector('[data-close]').onclick=close;
    shop.onclick=e=>{if(e.target===shop)close();const b=e.target.closest('[data-item]');if(b)buy(b.dataset.item);};
    shop.addEventListener('pointerdown',e=>e.stopPropagation(),true);
    shop.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    shop.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.preventDefault();}e.stopImmediatePropagation();},true);
    addEventListener('keydown',e=>{if(e.key==='Escape'&&shop.classList.contains('open')){close();e.stopImmediatePropagation();}},true);
    // Fixed-size instanced geometry. No new WebGL context, texture, light or perpetual timer.
    const gold = new THREE.MeshStandardMaterial({color:0xffcd3a,emissive:0xffbc1b,emissiveIntensity:0.58,metalness:0.6,roughness:0.26});
    const ring = new THREE.TorusGeometry(0.62,0.15,6,14);
    const coins = new THREE.InstancedMesh(ring,gold,coords.length);
    coins.frustumCulled=false;coins.userData.noCollide=true;S.scene.add(coins);
    const dummy=new THREE.Object3D();let frame=0;
    function draw(t){
      coords.forEach(([x,z],i)=>{
        const visible=active()&&!!window.ATM_OUT===(i>=12)&&!claimed.has(i);
        dummy.position.set(x,visible?-8.9+1.7+Math.sin(t*2+i)*0.25:-30000,z);
        dummy.scale.setScalar(visible?1:0.001);
        dummy.rotation.set(0,t*1.5+i*0.2,0);dummy.updateMatrix();
        coins.setMatrixAt(i,dummy.matrix);
      });coins.instanceMatrix.needsUpdate=true;
    }
    const glow=new THREE.Mesh(new THREE.TorusGeometry(0.9,0.08,5,18),new THREE.MeshBasicMaterial({color:0x54dfff,transparent:true,opacity:0.8,depthWrite:false}));
    glow.rotation.x=-Math.PI/2;glow.visible=false;S.scene.add(glow);
    const print=new THREE.Mesh(new THREE.RingGeometry(0.25,0.4,9),new THREE.MeshBasicMaterial({color:0xffb238,side:THREE.DoubleSide,transparent:true,opacity:0.64,depthWrite:false}));
    print.rotation.x=-Math.PI/2;print.visible=false;S.scene.add(print);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.6,1.2),new THREE.MeshBasicMaterial({color:0x66dfff}));
    lamp.position.set(-17,-7.5,-11);lamp.visible=false;S.scene.add(lamp);
    function tick(dt,t) {
      frame++;
      // A cheap periodic check also handles long-running sessions that cross local midnight.
      if(frame%90===0) rolloverClaims();
      if(frame%20===0) updateHud();
      const on=active();
      if(!on&&shop.classList.contains('open'))close();
      if(frame%4===0)draw(t);
      if(on&&frame%3===0){
        for(let i=0;i<coords.length;i++){
          if(claimed.has(i)||!!window.ATM_OUT!==(i>=12))continue;
          const [x,z]=coords[i];const radius=(ROAMS.mini?1.35:3.6)*(state.magnet?2.25:1);
          if(Math.hypot(ROAMS.p.x-x,ROAMS.p.z-z)>radius || (ROAMS.h||0)>10)continue;
          claimed.add(i);persistClaims();
          state.balance=Math.min(MAX_BALANCE,state.balance+(state.bonus?2:1));persist();updateHud();
        }
      }
      glow.visible=on&&!!state.aura;print.visible=on&&state.footprint&&!!ROAMS.moving;lamp.visible=on&&!!state.deco;
      if(glow.visible){glow.material.color.set(state.aura==='pink'?0xff52b9:0x54dfff);glow.scale.setScalar(ROAMS.mini?0.4:1.2);glow.position.set(ROAMS.p.x,-8.9+(ROAMS.h||0)+0.14,ROAMS.p.z);}
      if(print.visible){print.scale.setScalar(ROAMS.mini?0.3:1.5);print.position.set(ROAMS.p.x,-8.9+(ROAMS.h||0)+0.07,ROAMS.p.z+0.55);print.material.opacity=0.3+0.3*Math.sin(t*9);}
    }
    // Existing online selection remains untouched. Set the offline avatar only when not in a room.
    if(current() && !window.ONLINE_ON?.()) ROAMS.myType=current().value;
    if(state.color && !window.ONLINE_ON?.())ROAMS.myCol=state.color;
    updateHud();draw(0);
    return window.UNFIRE_COINS={tick,open,close,buy,get balance(){return state.balance;},
      get owned(){return state.owned.slice();},get shopItems(){return entries.map(e=>({...e}));}};
  };
})();