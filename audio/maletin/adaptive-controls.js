/* Unfire Audio · adaptive touch layout and standard Gamepad API bridge.
   Deliberately separate from rendering: no extra animation loops or WebGL allocations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UnfireAdaptiveControls = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const deadzone = (n, threshold = 0.16) => {
    if (!Number.isFinite(n) || Math.abs(n) <= threshold) return 0;
    return Math.sign(n) * clamp((Math.abs(n) - threshold) / (1 - threshold), 0, 1);
  };
  function intersects(a, b, gap = 6) {
    return a.left < b.right + gap && a.right > b.left - gap &&
      a.top < b.bottom + gap && a.bottom > b.top - gap;
  }
  function safePlacement(target, size, limits, occupied, step = 20) {
    const w = size.width, h = size.height;
    if (w > limits.right - limits.left || h > limits.bottom - limits.top) return null;
    const x0 = clamp(target.x - w / 2, limits.left, limits.right - w);
    const y0 = clamp(target.y - h / 2, limits.top, limits.bottom - h);
    const grid = [[0, 0]];
    for (let ring = 1; ring <= Math.ceil(Math.max(limits.right-limits.left,
        limits.bottom-limits.top) / step); ring++) {
      for (let x = -ring; x <= ring; x++) for (let y = -ring; y <= ring; y++) {
        if (Math.max(Math.abs(x), Math.abs(y)) === ring) grid.push([x, y]);
      }
    }
    grid.sort((a, b) => a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
    const seen = new Set();
    for (const [dx, dy] of grid) {
      const left = clamp(x0 + dx * step, limits.left, limits.right - w);
      const top = clamp(y0 + dy * step, limits.top, limits.bottom - h);
      const key = left.toFixed(1) + '/' + top.toFixed(1);
      if (seen.has(key)) continue;
      seen.add(key);
      const rect = {left, top, right:left+w, bottom:top+h};
      if (!occupied.some(o => intersects(rect, o))) return rect;
    }
    return null;
  }
  function profile(width, height, coarse) {
    if (!coarse) return 'desktop';
    // Form factor, not a brand/UA assumption: iPad-like layouts have more room.
    return Math.min(width, height) >= 600 ? 'tablet' : 'phone';
  }
  function init(ctx) {
    const {ROAMS, flightTap} = ctx;
    const nav = typeof navigator === 'undefined' ? {} : navigator;
    const doc = typeof document === 'undefined' ? null : document;
    if (!doc || !ROAMS) return null;
    const controls = ['unfireTouchPad','unfireFly','unfireDown','unfireTalk']
      .map(id => doc.getElementById(id));
    const names = ['pad', 'fly', 'down', 'talk'];
    const state = {active:false, lx:0, ly:0, rx:0, ry:0, up:false,
      down:false, dive:false, sprint:false, last:[]};
    ROAMS.padState = state;
    let editing = false, dragged = null, bar = null, resizeToken = 0;
    const isTouch = !!controls[0];
    const hasButton = (p, i) => !!(p && p.buttons && p.buttons[i] && p.buttons[i].pressed);
    const padEnabled = () => ROAMS.on && !doc.hidden && !(ctx.blocked && ctx.blocked());

    function tick(dt) {
      let p = null;
      try {
        const pads = typeof nav.getGamepads === 'function' ? nav.getGamepads() : [];
        p = Array.from(pads || []).find(g => g && g.connected !== false &&
          g.mapping === 'standard' && g.axes && g.axes.length >= 4);
      } catch (_) {}
      if (!p || !padEnabled()) {
        state.active = false;
        state.lx = state.ly = state.rx = state.ry = 0;
        state.up = state.down = state.dive = state.sprint = false;
        state.last = []; return;
      }
      state.active = true;
      state.lx = deadzone(p.axes[0]);
      state.ly = deadzone(-p.axes[1]);
      state.rx = deadzone(p.axes[2]);
      state.ry = deadzone(p.axes[3]);
      const pressed = i => hasButton(p, i);
      const edge = i => pressed(i) && !state.last[i];
      const up = pressed(0) || pressed(12);
      const down = pressed(1) || pressed(13);
      if ((edge(0) || edge(12)) && typeof flightTap === 'function') flightTap('up');
      if ((edge(1) || edge(13)) && typeof flightTap === 'function') flightTap('down');
      if (up && !ROAMS.fly && !ROAMS.mini) {
        ROAMS.fly = true; ROAMS.climbV = 0; ROAMS.flyT = 0;
      }
      state.up = up; state.down = down;
      state.dive = pressed(7);
      state.sprint = pressed(5) || pressed(10);
      if (edge(3) && ctx.cameraButton) ctx.cameraButton.click();
      if (edge(2)) {
        const chat = doc.getElementById('chat');
        if (chat) {
          chat.classList.toggle('on');
          if (chat.classList.contains('on')) chat.querySelector('input')?.focus();
        }
      }
      if (edge(9)) doc.getElementById('unfireControlsButton')?.click();
      if (padEnabled() && !editing) {
        const delta = Math.min(0.05, Math.max(0, Number(dt) || 0));
        ROAMS.yaw += state.rx * delta * 2.4;
        ROAMS.pitch = clamp(ROAMS.pitch - state.ry * delta * 1.65, -1.33, 1.3);
      }
      state.last = Array.from({length: 16}, (_, i) => pressed(i));
    }
    function stop() {
      state.active = false;
      state.lx = state.ly = state.rx = state.ry = 0;
      state.up = state.down = state.dive = state.sprint = false;
      state.last = [];
      if (ROAMS.touchStick) ROAMS.touchStick = null;
    }
    addEventListener('blur', stop, {passive:true});
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });

    if (!isTouch) return {tick, stop};
    const guide = doc.getElementById('unfireControlGuide');
    const settings = guide && guide.firstElementChild;
    let custom = {};
    const view = () => ({width:innerWidth, height:innerHeight});
    const orient = () => innerWidth >= innerHeight ? 'landscape' : 'portrait';
    const storageKey = () => 'unfire-controls-layout-v2-' +
      profile(innerWidth, innerHeight, true) + '-' + orient();
    const defaultTargets = () => {
      const tablet = profile(innerWidth, innerHeight, true) === 'tablet';
      const landscape = orient() === 'landscape';
      return landscape ?
        {pad:[tablet ? 0.13:0.14,0.78],fly:[0.87,0.79],down:[0.75,0.82],talk:[0.89,0.54]} :
        {pad:[tablet ? 0.16:0.20,0.80],fly:[0.84,0.82],down:[0.65,0.85],talk:[0.86,0.63]};
    };
    function load() {
      custom = {};
      try {
        const value = JSON.parse(localStorage.getItem(storageKey()) || '{}');
        for (const name of names) if (Array.isArray(value[name]) &&
          value[name].length === 2 && value[name].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) {
          custom[name] = value[name];
        }
      } catch (_) {}
    }
    function save() {
      try {localStorage.setItem(storageKey(), JSON.stringify(custom));} catch (_) {}
    }
    const reserved = ['#hud','#tb','#storyHud','#ctlDock','#wradio','#minimap',
      '#chat','#howto','#storyMenu','#unfireControlGuide','#unfireTouchEditorBar',
      '#roamBtn','#atmBtn','#stO','#unfireRecover','#gameHud'];
    function safeInsets() {
      const probe = doc.createElement('div');
      probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;'+
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) '+
        'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      doc.body.appendChild(probe);
      const style = getComputedStyle(probe);
      const values = [style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft]
        .map(x => Math.max(0, parseFloat(x) || 0));
      probe.remove();
      return values;
    }
    function limits() {
      const [top,right,bottom,left] = safeInsets();
      return {left:Math.max(8,left+8),top:Math.max(8,top+8),
        right:innerWidth-Math.max(8,right+8),
        bottom:innerHeight-Math.max(8,bottom+8)};
    }
    function obstacles() {
      const found = [], seen = new Set(), maxArea = innerWidth * innerHeight * 0.44;
      const add = node => {
        if (!node || controls.includes(node) || seen.has(node)) return;
        seen.add(node);
        const s = getComputedStyle(node);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < .05) return;
        const b = node.getBoundingClientRect();
        if (!b.width || !b.height || b.bottom <= 0 || b.top >= innerHeight) return;
        if (b.width*b.height <= maxArea) {
          found.push({left:b.left,top:b.top,right:b.right,bottom:b.bottom});
        } else {
          for (const child of node.querySelectorAll('button,a,input,[role="button"],p,.tx,.nm')) add(child);
        }
      };
      for (const selector of reserved) doc.querySelectorAll(selector).forEach(add);
      return found;
    }
    function dimensions() {
      const tablet=profile(innerWidth,innerHeight,true)==='tablet';
      const short=Math.min(innerWidth,innerHeight)<370;
      return {pad: tablet?136:short?92:108,
        fly:tablet?76:short?53:62,down:tablet?76:short?53:62,
        talk:tablet?70:short?50:58};
    }
    function restyle() {
      const sizes = dimensions();
      controls.forEach((el,i) => {
        const size=sizes[names[i]];
        el.style.boxSizing='border-box';el.style.position='fixed';
        el.style.width=size+'px';el.style.height=size+'px';
        el.style.minWidth=size+'px';el.style.minHeight=size+'px';
        el.style.padding='0';el.style.right='auto';el.style.bottom='auto';
        el.style.borderRadius='50%';el.style.touchAction='none';
        if (i) {
          el.style.font='800 '+(size<60?10:12)+'px system-ui,sans-serif';
          el.style.boxShadow='0 4px 13px rgba(0,0,0,.35)';
        }
      });
      controls[1].textContent='↑ VOLAR';
      controls[2].textContent='↓ BAJAR';
      controls[3].textContent='💬';
      controls[3].setAttribute('aria-label','Hablar con robots');
      controls[1].setAttribute('aria-label','Volar o ascender');
      controls[2].setAttribute('aria-label','Descender y aterrizar');
    }
    function layout() {
      restyle();
      const defaults=defaultTargets(), dims=dimensions(), box=limits();
      const used=obstacles();
      const resolved={};
      for (const name of names) {
        const i=names.indexOf(name), size=dims[name];
        const target=custom[name] || defaults[name];
        const rect=safePlacement({x:target[0]*innerWidth,y:target[1]*innerHeight},
          {width:size,height:size},box,used);
        if (rect) {
          controls[i].style.left=rect.left+'px';
          controls[i].style.top=rect.top+'px';
          controls[i].style.visibility='visible';
          used.push(rect);resolved[name]=rect;
        } else {
          // It is safer to suppress an impossible placement than cover game text.
          controls[i].style.visibility='hidden';
        }
      }
      return resolved;
    }
    function startEdit() {
      if (editing) return;
      editing=true;root.__unfireLayoutEditing=true;
      ROAMS.k[' ']=0;ROAMS.k.s=0;
      if (guide) {guide.classList.remove('on');guide.style.display='none';}
      bar.style.display='flex';layout();
    }
    function endEdit(store) {
      editing=false;root.__unfireLayoutEditing=false;
      dragged=null;bar.style.display='none';
      if (store) save();
      layout();
    }
    if (settings) {
      const edit=document.createElement('button');
      edit.type='button';edit.id='unfireEditTouchLayout';
      edit.textContent='✥ Ajustar controles en pantalla';
      edit.style.cssText='display:block;margin:12px 0;min-height:44px;padding:10px;'+
        'border:1px solid #9edaff;border-radius:12px;background:#244d83;color:white;cursor:pointer';
      edit.onclick=e=>{e.stopPropagation();startEdit();};
      settings.appendChild(edit);
      const note=doc.createElement('p');
      note.style.cssText='font-size:12px;opacity:.8';
      note.textContent='Móvil: joystick compacto. Tablet: botones separados. Mando PlayStation estándar: stick izquierdo mover, derecho cámara, ✕ subir, ○ bajar, R2 picado, R1 correr, △ cámara, □ hablar, Options ajustes. Aterriza mientras avanzas en cualquier dirección.';
      settings.appendChild(note);
    }
    bar=doc.createElement('div');bar.id='unfireTouchEditorBar';
    bar.style.cssText='position:fixed;z-index:110;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);display:none;gap:6px;max-width:96vw;align-items:center;padding:6px 9px;border:1px solid #89d9ff;border-radius:12px;background:#0c1639;color:white;font:600 12px system-ui';
    const label=doc.createElement('span');label.textContent='Arrastra controles';
    const reset=doc.createElement('button');reset.textContent='Restablecer';
    const done=doc.createElement('button');done.textContent='Guardar';
    for (const btn of [reset,done]) {
      btn.type='button';btn.style.cssText='padding:8px;border:1px solid #89d9ff;border-radius:8px;background:#244d83;color:white;font:700 12px system-ui';
    }
    reset.onclick=()=>{custom={};layout();};
    done.onclick=()=>endEdit(true);
    bar.append(label,reset,done);doc.body.appendChild(bar);
    for (const el of controls) {
      el.addEventListener('pointerdown',e=>{
        if (!editing) return;
        e.stopImmediatePropagation();e.preventDefault();
        dragged={el,id:e.pointerId,name:names[controls.indexOf(el)]};
        try {el.setPointerCapture(e.pointerId);} catch (_) {}
      },true);
      el.addEventListener('pointermove',e=>{
        if (!editing || !dragged || dragged.el!==el || dragged.id!==e.pointerId) return;
        e.stopImmediatePropagation();e.preventDefault();
        const old=custom[dragged.name];const sz=dimensions()[dragged.name];
        custom[dragged.name]=[clamp(e.clientX/innerWidth,0,1),
          clamp(e.clientY/innerHeight,0,1)];
        // Candidate must not cover HUD, text or any other control.
        const placed=layout();
        if (!placed[dragged.name]) {
          if (old) custom[dragged.name]=old;
          else delete custom[dragged.name];
          layout();
        }
      },true);
      const finish=e=>{
        if (!editing || !dragged || dragged.el!==el || dragged.id!==e.pointerId) return;
        e.stopImmediatePropagation();e.preventDefault();
        dragged=null;layout();
      };
      el.addEventListener('pointerup',finish,true);
      el.addEventListener('pointercancel',finish,true);
    }
    let lastSize=innerWidth+'x'+innerHeight;
    load();
    const recalc=()=>{
      const now=innerWidth+'x'+innerHeight;
      if (lastSize!==now) {lastSize=now;load();}
      if (resizeToken) clearTimeout(resizeToken);
      resizeToken=setTimeout(layout,80);
    };
    addEventListener('resize',recalc,{passive:true});
    if (root.visualViewport) root.visualViewport.addEventListener('resize',recalc,{passive:true});
    addEventListener('orientationchange',recalc,{passive:true});
    layout();
    return {tick,stop,layout,startEdit,endEdit};
  }
  return {init,deadzone,intersects,safePlacement,profile};
});
