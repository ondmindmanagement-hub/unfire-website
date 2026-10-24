/* UNFIRE AUDIO · 2D expanded map. No WebGL, no background timers while closed. */
(function () {
  'use strict';
  if (window.UnfireExpandedMap) return;
  const PLACES = [
    {x:0,z:40,t:'CASA',size:94,col:'#e8ecff'},
    {x:600,z:0,t:'ATLANTIS',size:340,col:'#e3dad0'},
    {x:80,z:-500,t:'DESIERTO',size:190,col:'#ead4a3'},
    {x:-760,z:-760,t:'HAIKU',size:250,col:'#ffa9d0'},
    {x:-420,z:120,t:'ISLA VERDE',size:70,col:'#9fe86f'},
    {x:300,z:420,t:'ISLA BLANCA',size:60,col:'#e1f5ff'},
    {x:-360,z:-380,t:'ISLA VIOLETA',size:80,col:'#bf96ff'},
    {x:150,z:650,t:'SURF',size:80,col:'#72d9ff'},
    {x:2200,z:-1800,t:'TORRES',size:145,col:'#a0bbff'}
  ];
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  function create(getState, onOpen) {
    let root, board, canvas, context, closeButton, zoneLabel, previousFocus = null;
    let open = false, zone = '', centerX = 0, centerZ = 0, zoom = 1, dirty = true;
    let pointers = new Map(), lastPinch = 0, lastDraw = 0;
    function read() {
      try { return getState() || {}; } catch (_) { return {}; }
    }
    function make() {
      if (root) return;
      root = document.createElement('div');
      root.id = 'unfireExpandedMap';
      root.hidden = true;
      root.setAttribute('role','dialog');
      root.setAttribute('aria-modal','true');
      root.setAttribute('aria-label','Mapa ampliado del juego');
      root.innerHTML = '<section id="ufMapPanel" aria-label="Mapa del mundo">'
        + '<header id="ufMapHeader"><div><small>UNFIRE AUDIO · EXPLORAR</small><h2>🗺 MAPA DEL MUNDO</h2></div>'
        + '<button type="button" id="ufMapClose" aria-label="Cerrar mapa">✕ <span>CERRAR</span></button></header>'
        + '<div id="ufMapSurface"><canvas id="ufMapCanvas" aria-label="Mapa con tu posición y la misión activa"></canvas>'
        + '<div id="ufMapBadge">LA CASA</div></div>'
        + '<footer id="ufMapFooter"><div id="ufMapLegend"><span>◆ JUGADOR</span><span>★ MISIÓN</span><span>● LUGARES</span><span>🛸 ROBOT-NAVE</span></div>'
        + '<div id="ufMapTools"><button type="button" id="ufMapShip" aria-label="Centrar mapa en el robot-nave" title="Localizar el robot-nave">🛸 NAVE</button><button type="button" id="ufMapMinus" aria-label="Alejar mapa">−</button>'
        + '<button type="button" id="ufMapCenter">⌖ CENTRAR</button>'
        + '<button type="button" id="ufMapPlus" aria-label="Acercar mapa">+</button></div></footer>'
        + '<p id="ufMapHelp">Arrastra para explorar · pellizca o usa +/− para ampliar · Esc para cerrar</p></section>';
      document.body.appendChild(root);
      canvas = root.querySelector('#ufMapCanvas');
      context = canvas.getContext('2d', {alpha:false});
      board = root.querySelector('#ufMapSurface');
      zoneLabel = root.querySelector('#ufMapBadge');
      closeButton = root.querySelector('#ufMapClose');
      closeButton.addEventListener('click', hide);
      root.querySelector('#ufMapMinus').addEventListener('click', () => changeZoom(.75));
      root.querySelector('#ufMapPlus').addEventListener('click', () => changeZoom(1.3));
      root.querySelector('#ufMapCenter').addEventListener('click', centerPlayer);
      root.querySelector('#ufMapShip').addEventListener('click', () => {
        const s=read(),ship=s.ship;
        if(s.zone!=='island'||!ship||!Number.isFinite(ship.x)||!Number.isFinite(ship.z))return;
        centerX=ship.x;centerZ=ship.z;zoom=3;
        dirty=true;paint();
      });
      root.addEventListener('click', e => e.stopPropagation());
      for (const eventName of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchend']) {
        root.addEventListener(eventName, e => e.stopPropagation());
      }
      canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
        lastPinch = 0;
      });
      canvas.addEventListener('pointermove', e => {
        if (!pointers.has(e.pointerId)) return;
        const old = pointers.get(e.pointerId);
        pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
        if (pointers.size === 1) {
          const scale = getScale();
          centerX -= (e.clientX - old.x) / scale;
          centerZ -= (e.clientY - old.y) / scale;
          dirty = true; paint();
        } else if (pointers.size === 2) {
          const a = Array.from(pointers.values());
          const d = Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
          if (lastPinch > 0) zoom = clamp(zoom * d/lastPinch,.55,8);
          lastPinch = d;
          dirty = true; paint();
        }
      });
      function release(e) {
        pointers.delete(e.pointerId);
        lastPinch = 0;
      }
      canvas.addEventListener('pointerup',release);
      canvas.addEventListener('pointercancel',release);
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        e.stopPropagation();
        changeZoom(e.deltaY > 0 ? .86 : 1.16);
      }, {passive:false});
      root.addEventListener('pointerdown', e => {
        if (e.target === root) hide();
      });
      window.addEventListener('resize', onResize, {passive:true});
      window.addEventListener('orientationchange',onResize,{passive:true});
      // Capture-phase so Escape never exits roaming or closes the case while the map is open.
      window.addEventListener('keydown',e => {
        if (!open) return;
        if (e.key === 'Escape' || e.key.toLowerCase() === 'm') {
          e.preventDefault(); e.stopImmediatePropagation(); hide(); return;
        }
        if (['w','a','s','d','q','e','f','c',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
          if (!(e.target && e.target.tagName === 'BUTTON' && (e.key === ' '))) {
            e.preventDefault(); e.stopImmediatePropagation();
          }
        }
      }, true);
    }
    function onResize() { if (!open) return; dirty = true; paint(); }
    function changeZoom(k) { zoom = clamp(zoom*k,.55,8); dirty = true; paint(); }
    function centerPlayer() {
      const s = read();
      centerX = Number(s.x) || 0; centerZ = Number(s.z) || 0;
      dirty = true; paint();
    }
    function show() {
      if (open) return;
      make();
      const s = read();
      zone = s.zone || 'house'; zoom = 1;
      centerX = Number(s.x) || 0; centerZ = Number(s.z) || 0;
      previousFocus = document.activeElement;
      pointers.clear(); lastPinch = 0; open = true;
      root.hidden = false;
      document.body.classList.add('unfire-map-open');
      if (onOpen) onOpen();
      dirty = true; paint();
      closeButton.focus({preventScroll:true});
    }
    function hide() {
      if (!open) return;
      open = false; pointers.clear(); root.hidden = true;
      document.body.classList.remove('unfire-map-open');
      if (previousFocus && previousFocus.focus) {
        try { previousFocus.focus({preventScroll:true}); } catch (_) {}
      }
    }
    function baseSize() { return zone === 'table' ? 34 : zone === 'house' ? 240 : 3200; }
    function getScale() {
      const b = canvas ? canvas.getBoundingClientRect() : {width:600,height:400};
      return Math.max(0.01,Math.min(b.width,b.height)/baseSize()*zoom);
    }
    function paint() {
      if (!open || !canvas || !context) return;
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(rect.width),h = Math.floor(rect.height);
      if (w < 15 || h < 15) return;
      const rawRatio = Math.min(1.5,window.devicePixelRatio||1);
      const ratio = Math.min(rawRatio,Math.sqrt(1500000/(w*h)));
      const pxW = Math.max(1,Math.round(w*ratio)),pxH = Math.max(1,Math.round(h*ratio));
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW; canvas.height = pxH;
      }
      const g = context;
      g.setTransform(pxW/w,0,0,pxH/h,0,0);
      g.fillStyle = '#07132b';g.fillRect(0,0,w,h);
      const s = read();
      const mode = s.zone || zone;
      if (mode !== zone) {
        zone = mode;centerX=Number(s.x)||0;centerZ=Number(s.z)||0;zoom=1;
      }
      const scale = getScale(), P = (x,z) => [w*.5+(x-centerX)*scale,h*.5+(z-centerZ)*scale];
      // Only 2D strokes and filled shapes; no imagery, WebGL allocations or remote tiles.
      g.save();
      const step = zone==='table'?5:zone==='house'?25:500;
      g.strokeStyle = 'rgba(100,169,240,.12)'; g.lineWidth=1;g.beginPath();
      const xMin=centerX-w/scale/2,xMax=centerX+w/scale/2;
      const zMin=centerZ-h/scale/2,zMax=centerZ+h/scale/2;
      for(let x=Math.ceil(xMin/step)*step;x<=xMax;x+=step){const p=P(x,centerZ);g.moveTo(p[0],0);g.lineTo(p[0],h);}
      for(let z=Math.ceil(zMin/step)*step;z<=zMax;z+=step){const p=P(centerX,z);g.moveTo(0,p[1]);g.lineTo(w,p[1]);}
      g.stroke();
      function area(x,z,r,col){
        const p=P(x,z),r0=r*scale;
        if(p[0]+r0<0||p[0]-r0>w||p[1]+r0<0||p[1]-r0>h)return;
        g.beginPath();g.arc(p[0],p[1],r0,0,Math.PI*2);g.fillStyle=col;g.fill();
        g.strokeStyle='rgba(210,235,255,.35)';g.lineWidth=1.5;g.stroke();
      }
      function rectArea(x0,z0,x1,z1,col){
        const a=P(x0,z0),b=P(x1,z1);
        g.fillStyle=col;g.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
        g.lineWidth=2;g.strokeStyle='#b0c7e6';g.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
      }
      function textLabel(t,x,z,c){
        const p=P(x,z);
        if(p[0]<-90||p[0]>w+90||p[1]<-20||p[1]>h+20)return;
        g.font='700 11px system-ui,Arial';g.textAlign='center';g.textBaseline='middle';
        g.lineWidth=3;g.strokeStyle='#07132b';g.strokeText(t,p[0],p[1]);g.fillStyle=c||'#f3f6ff';g.fillText(t,p[0],p[1]);
      }
      if (zone==='table') {
        rectArea(-13,-7.45,13,5.05,'#554636');
        rectArea(-2.9,-1.95,2.9,1.95,'#7a8ca5');
        textLabel('MESA',0,-6,'#ffffff');
      } else {
        if(zone==='island'){
          area(0,0,290,'rgba(49,169,97,.36)');
          PLACES.forEach(p => {
            if(p.t==='CASA')return;
            area(p.x,p.z,p.size,p.col+'66');
            textLabel(p.t,p.x,p.z+p.size*.25,'#ffffff');
          });
          textLabel('MAR ABIERTO',-950,780,'#5ebde1');
        }
        rectArea(-80,-16,80,96,zone==='house'?'rgba(229,239,255,.27)':'rgba(229,239,255,.63)');
        if(zone==='house'){
          rectArea(-13,-7.45,13,5.05,'rgba(222,191,149,.48)');
          [[44,8,'ESTUDIO'],[38,44,'GALERÍA'],[-38,40,'SALA'],[-30,93,'PUERTA']].forEach(q => textLabel(q[2],q[0],q[1],'#d3ebff'));
        }else textLabel('CASA',0,45,'#0a1831');
      }
      const obj = s.objective;
      if(obj && Number.isFinite(obj.x) && Number.isFinite(obj.z) && (zone!=='table' || obj.mini)){
        const q=P(obj.x,obj.z);
        if(q[0]>-20&&q[0]<w+20&&q[1]>-20&&q[1]<h+20) {
          g.save();g.translate(q[0],q[1]);
          g.fillStyle='#ffd21a';g.strokeStyle='#663d00';g.lineWidth=2;
          g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:12;
            const x=Math.cos(a)*r,y=Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}
          g.closePath();g.fill();g.stroke();g.restore();
          textLabel('MISIÓN',obj.x,obj.z+16/scale,'#ffe484');
        }
      }
      // The ship pin reads live coordinates from the actual stationary titan, not
      // a duplicated hardcoded marker, and never appears indoors or on the Moon.
      const ship=s.ship;
      const shipButton=root.querySelector('#ufMapShip');
      if(shipButton)shipButton.hidden=!(zone==='island'&&ship&&Number.isFinite(ship.x)&&Number.isFinite(ship.z));
      if(zone==='island'&&ship&&Number.isFinite(ship.x)&&Number.isFinite(ship.z)){
        const [mx,mz]=P(ship.x,ship.z);
        if(mx>16&&mx<w-16&&mz>20&&mz<h-20){
          g.save();g.beginPath();g.arc(mx,mz,15,0,Math.PI*2);
          g.fillStyle='#081d32';g.strokeStyle='#ffcf65';g.lineWidth=2.3;g.fill();g.stroke();
          g.font='21px Apple Color Emoji,Segoe UI Emoji,sans-serif';g.textAlign='center';g.textBaseline='middle';
          g.fillText('🛸',mx,mz+1);g.restore();
          if(mx>60&&mx<w-60&&mz<h-50)textLabel('ROBOT-NAVE',ship.x,ship.z+27/scale,'#ffe4ab');
        }
      }
      const player=P(Number(s.x)||0,Number(s.z)||0);
      if(player[0]>-40&&player[0]<w+40&&player[1]>-40&&player[1]<h+40){
        g.save();g.translate(player[0],player[1]);g.rotate(Number(s.yaw)||0);
        g.beginPath();g.moveTo(0,-14);g.lineTo(9,10);g.lineTo(0,6);g.lineTo(-9,10);g.closePath();
        g.fillStyle='#c0ff56';g.strokeStyle='#081825';g.lineWidth=3;g.fill();g.stroke();g.restore();
      }
      g.restore();
      zoneLabel.textContent=zone==='table'?'LA MESA':zone==='island'?'LA ISLA':'LA CASA';
      dirty=false;lastDraw=Date.now();
    }
    function tick(){
      if (!open) return;
      if (dirty || Date.now()-lastDraw>360) paint();
    }
    return {show,hide,toggle(){open?hide():show();},tick,get isOpen(){return open;}};
  }
  window.UnfireExpandedMap={create};
})();