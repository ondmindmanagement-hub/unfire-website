/* UNFIRE AUDIO — single ship titan, continuous cabin flight, procedural moon.
   One WebGL renderer, zero texture downloads, no additional animation loop.
   All lunar assets are generated from primitive geometry and recycled by distance.
*/
(() => {
  'use strict';
  if (window.UnfireLunarWorld) return;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const height = (x,z) => {
    let h = Math.sin(x*.028)*2.2+Math.cos(z*.021)*2.6+Math.sin((x+z)*.046)*.8;
    for(let i=0;i<7;i++){
      const cx=Math.sin(11+i*17)*120, cz=Math.cos(3+i*19)*120;
      const d=Math.hypot(x-cx,z-cz),r=11+i*2.1;
      h-=3.8*Math.exp(-Math.pow(d/r,2));
      h+=1.2*Math.exp(-Math.pow((d-r*1.18)/(r*.17),2));
    }
    return h;
  };
  function buildWorld({THREE, S, ROAMS, LOWDEV, say, WRADIO, REC}) {
    const scene=S.scene,cam=S.camera,store={mode:'island',time:0,moonX:0,moonZ:16,yaw:Math.PI,stage:0,lap:0,lastRing:0,wins:0,recording:false};
    const mat=(hex,rough=.4,metal=.3)=>new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness:metal});
    const bl=(hex)=>new THREE.MeshBasicMaterial({color:hex,toneMapped:false});
    const ship=new THREE.Group(),moon=new THREE.Group();
    ship.layers.set(2);moon.layers.set(3);scene.add(ship,moon);
    const layer=(root,n)=>root.traverse(o=>{o.layers.set(n);if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    const add=(parent,geo,ma,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,ma);q.position.set(x,y,z);parent.add(q);return q;};
    const box=(parent,w,h,d,ma,x,y,z)=>add(parent,new THREE.BoxGeometry(w,h,d),ma,x,y,z);
    const orb=(parent,r,ma,x,y,z,seg=16)=>add(parent,new THREE.SphereGeometry(r,seg,Math.max(8,seg/2)),ma,x,y,z);
    const chrome=mat(0xb8c8d4,.2,.84),dark=mat(0x090d1d,.5,.6),violet=mat(0x862aab,.28,.5),gold=mat(0xffc257,.18,.8),pink=bl(0xff57b7),cyan=bl(0x71dfff);
    ship.add(new THREE.AmbientLight(0xe5f0ff,1.6));
    const cabinLamp=new THREE.PointLight(0x6fbcff,2.3,65,2);cabinLamp.position.set(0,11,3);ship.add(cabinLamp);
    // Shared chest room: one physical-sized cabin with a real round window and view to space.
    box(ship,29,1,32,dark,0,-.6,0);box(ship,29,1,32,chrome,0,13.4,0);
    for(const side of [-1,1]){
      box(ship,1.1,13,33,chrome,side*14,6,0);
      for(let j=0;j<7;j++)box(ship,.13,11,.19,pink,side*13.39,6,-14+j*4.7);
      box(ship,1.9,1.2,34,violet,side*12.8,12,0);
      for(let j=0;j<3;j++)orb(ship,.68,cyan,side*11.2,1.2,-9+j*9,10);
    }
    box(ship,29,14,1,chrome,0,6,16);
    const front=box(ship,29,14,1.2,dark,0,6,-16);
    // Window is an actual opening in the cabin geometry (dark wall is only partial).
    ship.remove(front);
    for(const [x,y,z,w,h,d] of [[-10,7,-16,9,13,1],[10,7,-16,9,13,1],[0,13,-16,12,2,1],[0,1,-16,12,2,1]])
      box(ship,w,h,d,chrome,x,y,z);
    const ring=add(ship,new THREE.TorusGeometry(5.9,.45,12,48),gold,0,7,-15.4);
    const ringInner=add(ship,new THREE.TorusGeometry(5.17,.18,8,48),pink,0,7,-15.15);
    const deck=box(ship,11,1.25,5,chrome,0,2,-1);
    for(const side of [-1,1]){
      const disc=add(ship,new THREE.CylinderGeometry(1.8,1.8,.2,24),dark,side*3,2.76,-1.0);
      add(ship,new THREE.TorusGeometry(1.12,.07,7,28),pink,side*3,2.9,-1).rotation.x=Math.PI/2;
      orb(ship,.16,cyan,side*3,2.91,-1);
    }
    for(let k=0;k<7;k++){const b=box(ship,.36,.9,.26,k%2?pink:cyan,-2.2+k*.72,3.06,1.2);b.userData.eq=k;}
    // The DJ robot uses low-poly pieces: no duplicate high-resolution mutant rig.
    const dj=new THREE.Group();dj.position.set(0,0,-5);ship.add(dj);
    box(dj,2.4,3.6,1.6,violet,0,4.6,0);
    const djHead=orb(dj,1.7,chrome,0,7.5,0,14);djHead.scale.set(1.2,.8,.86);
    for(let side of [-1,1]){
      orb(dj,.46,pink,side*.8,7.6,-1.1,12);
      const arm=box(dj,.65,3,.7,chrome,side*1.8,4.8,-.2);arm.rotation.z=side*.5;
    }
    const disco=orb(ship,1.65,chrome,0,10.8,2.1,12);
    for(let i=0;i<24;i++){
      const a=i*Math.PI*2/24;const q=orb(ship,.22,i%3?cyan:pink,Math.cos(a)*1.58,10.8+Math.sin(a*.7)*.7,2.1+Math.sin(a)*1.1,8);
      disco.add(q);q.position.sub(disco.position);
    }
    // View through circular chest opening: planets visibly travel without a cut.
    const starsG=new THREE.BufferGeometry(),starPos=new Float32Array((LOWDEV?90:220)*3);
    for(let i=0;i<starPos.length;i+=3){
      const a=i*13.31;starPos[i]=Math.sin(a*3.71)*160;starPos[i+1]=Math.cos(a*1.39)*100+8;
      starPos[i+2]=-105-Math.abs(Math.sin(a*2.37)*80);
    }
    starsG.setAttribute('position',new THREE.BufferAttribute(starPos,3));
    ship.add(new THREE.Points(starsG,new THREE.PointsMaterial({color:0xcddfff,size:1.4,sizeAttenuation:true,depthWrite:false})));
    const home=orb(ship,12,mat(0x158dba,1,0),-19,12,-100,28);
    const landbands=mat(0x6cce9a,1,0);
    for(let i=0;i<5;i++){const patch=orb(home,1,landbands,Math.sin(i*7)*.65,Math.cos(i*11)*.62,.55,10);patch.scale.set(.31,.14,.12);}
    const moonDest=orb(ship,7,mat(0xc8ced9,1,0),10,8,-108,28);
    const craterMat=mat(0x9ca5b8,1,0);
    for(let i=0;i<11;i++)orb(moonDest,.22,craterMat,Math.sin(i*2.17)*.64,Math.cos(i*1.37)*.64,.68,8).scale.set(2,1.4,.2);
    // Reusable infinite-ish terrain: nine stitched tiles, rebuilt only on tile crossing.
    moon.add(new THREE.HemisphereLight(0xc9dcff,0x30344c,2.0));
    const sun=new THREE.DirectionalLight(0xffdbb4,2.4);sun.position.set(90,160,-35);moon.add(sun);
    const terrainMat=mat(0x9ca2b2,.92,.05);
    const tiles=[],tileSize=180,div=24;
    for(let i=0;i<9;i++){
      const g=new THREE.PlaneGeometry(tileSize,tileSize,div,div);g.rotateX(-Math.PI/2);
      const m=new THREE.Mesh(g,terrainMat);m.frustumCulled=true;m.userData.ix=Infinity;
      moon.add(m);tiles.push(m);
    }
    const starBackdrop=new THREE.Points(starsG.clone(),new THREE.PointsMaterial({color:0xe8e7ff,size:4,sizeAttenuation:false}));
    moon.add(starBackdrop);starBackdrop.scale.set(6,6,6);
    const blueWorld=orb(moon,42,mat(0x168dc5,.9,0),-390,160,-720,24);
    for(let i=0;i<7;i++)orb(blueWorld,1,landbands,Math.sin(i*9)*.55,Math.cos(i*7)*.52,.70,9).scale.set(.3,.2,.06);
    const moonSky=add(moon,new THREE.SphereGeometry(1200,24,12),new THREE.MeshBasicMaterial({color:0x080b1e,side:THREE.BackSide,depthWrite:false}),0,0,0);
    const audience=[];
    const roboM=[chrome,gold,violet,mat(0x2c8cc9),mat(0xc4aac8)];
    for(let i=0;i<(LOWDEV?9:18);i++){
      const bot=new THREE.Group(),r=.5;
      box(bot,1.25,1.9,.75,roboM[i%5],0,1.5,0);
      const head=orb(bot,.78,chrome,0,3,0,10);head.scale.set(1,.8,.73);
      orb(bot,.14,pink,-.26,3,.67,8);orb(bot,.14,cyan,.26,3,.67,8);
      bot.position.set(Math.cos(i*.49)*65,0,Math.sin(i*.49)*65);moon.add(bot);audience.push(bot);
    }
    const rings=[];
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+Math.PI/4,x=Math.cos(a)*85,z=Math.sin(a)*85;
      const group=new THREE.Group();group.position.set(x,height(x,z)+14,z);
      const tor=add(group,new THREE.TorusGeometry(9,.6,8,32),i%2?cyan:pink);
      tor.rotation.y=-a;moon.add(group);rings.push(group);
    }
    const dolphin=orb(moon,1,mat(0xa7e8ef,.3,.5),-130,95,-120,16);dolphin.scale.set(8,2,2.5);
    const tail=box(moon,3,.4,7,chrome,-140,95,-120);tail.rotation.y=.5;
    const moonShip=add(moon,new THREE.ConeGeometry(4,14,7),chrome,120,110,-130);moonShip.rotation.x=Math.PI/2;
    // Separate, safe interaction UI. It appears only near the stationary ship.
    const css=document.createElement('style');
    css.textContent='#unfireLunarGate{position:fixed;left:max(12px,env(safe-area-inset-left));top:calc(245px + env(safe-area-inset-top));z-index:47;display:none;color:white;background:#091d38f0;border:1px solid #73ccff;border-radius:15px;padding:9px 11px;font:700 11px system-ui;max-width:min(245px,43vw)}'+
      '#unfireLunarUI{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:78;display:none;max-width:94vw;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;color:#fff;background:#081224cf;border:1px solid #739fff88;border-radius:15px;padding:9px;font:700 12px system-ui}'+
      '#unfireLunarUI button{background:#194a82;color:#fff;border:1px solid #6fbaff;border-radius:10px;padding:9px;min-height:40px;font:inherit;cursor:pointer}'+
      'body.unfire-lunar #ctlDock,body.unfire-lunar #minimap,body.unfire-lunar #wradio,body.unfire-lunar #ufNear,body.unfire-lunar #unfireCoinHud,body.unfire-lunar #unfireFly,body.unfire-lunar #unfireDown,body.unfire-lunar #unfireTalk,body.unfire-lunar #unfireTouchPad,body.unfire-lunar #storyHud{display:none!important}'+
      '@media(max-height:430px){#unfireLunarGate{top:calc(120px + env(safe-area-inset-top))}#unfireLunarUI{font-size:10px;padding:5px}}';
    document.head.appendChild(css);
    const gate=document.createElement('button');gate.id='unfireLunarGate';gate.type='button';document.body.appendChild(gate);
    const ui=document.createElement('div');ui.id='unfireLunarUI';document.body.appendChild(ui);
    const info=document.createElement('span'),action=document.createElement('button'),back=document.createElement('button');
    ui.append(info,action,back);
    back.textContent='↩ VOLVER';
    const memory=()=>{try{return localStorage.getItem('unfire_lunar_champion_v1')==='1'}catch(_){return false;}};
    const save=()=>{try{localStorage.setItem('unfire_lunar_champion_v1','1');localStorage.setItem('unfire_unlock','99')}catch(_){}};
    const status=()=>{info.textContent=store.mode==='flight'?'🚀 VENTANAL DEL PECHO · '+Math.floor(store.time/28*100)+'%':
      store.mode==='ship'?'🎶 UK BASS WAVES · CABINA DEL GIGANTE':
      store.mode==='landed'?'🌙 LUNA · ABRIR COMPUERTA':'🌙 LUNA LIBRE · VUELTA '+store.lap+'/3 · PUERTA '+(store.stage+1)+'/8';
      action.textContent=store.mode==='ship'?'🚀 VIAJAR A LA LUNA':store.mode==='flight'?'🎥 MIRAR POR LA VENTANA':store.mode==='landed'?'🚪 EXPLORAR':store.mode==='moon'?'🏁 CORRER':'CONTINUAR';
    };
    let savedCamera=null;
    function mode(next){
      if(next!=='island'&&!ROAMS.on)return;
      store.mode=next;store.time=0;
      if(next!=='island'){
        document.body.classList.add('unfire-lunar');ui.style.display='flex';gate.style.display='none';
        if(REC && REC.on)REC.set(false);
      }else{
        document.body.classList.remove('unfire-lunar');ui.style.display='none';const pad=document.getElementById('unfireLunarPad');if(pad)pad.style.display='none';cam.layers.set(0);
        if(savedCamera!==null){cam.fov=savedCamera;cam.updateProjectionMatrix();savedCamera=null;}
      }
      status();
    }
    function gateInfo(){
      const G=(window.__OUTGIANTS||[]).find(g=>g.lunarShip);
      if(!G||!window.ATM_OUT||!ROAMS.on)return null;
      const px=ROAMS.p.x-G.w.position.x,pz=ROAMS.p.z-G.w.position.z;
      const d=Math.hypot(px,pz),alt=ROAMS.h||0;
      if(d>G.h*.48||alt>G.h*1.6)return null;
      const chest=alt>G.h*.32;return {label:chest?'🛸 ENTRAR POR EL PECHO':'🦶 ENTRAR POR EL PIE DERECHO',d,chest};
    }
    gate.onclick=e=>{e.stopPropagation();if(gateInfo())mode('ship');};
    const keys={};
    addEventListener('keydown',e=>{
      if(store.mode==='island'){
        if((e.key==='e'||e.key==='E')&&gateInfo()){e.preventDefault();mode('ship');}
        return;
      }
      if(e.key==='Escape'){e.preventDefault();mode('island');return;}
      keys[e.key.toLowerCase()]=1;
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))e.preventDefault();
    },true);
    addEventListener('keyup',e=>{delete keys[e.key.toLowerCase()]},true);
    back.onclick=()=>{if(store.mode==='moon')mode('landed');else mode('island')};
    // Reusable touch movement controls only in the moon scene.
    const pad=document.createElement('div');pad.id='unfireLunarPad';
    pad.style.cssText='position:fixed;left:max(10px,env(safe-area-inset-left));bottom:calc(112px + env(safe-area-inset-bottom));z-index:79;display:none;gap:5px;flex-wrap:wrap;width:176px;max-width:49vw;touch-action:none';
    for(const [label,k] of [['↑','w'],['↓','s'],['↶','q'],['↷','e']]){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label','Mover Luna '+label);
      b.style.cssText='min-width:40px;height:45px;border:1px solid #8ad7ff;border-radius:12px;background:#122e56e6;color:#fff;font:900 20px system-ui;touch-action:none';
      b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();keys[k]=1;b.setPointerCapture&&b.setPointerCapture(e.pointerId)};
      for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>{delete keys[k]});
      pad.appendChild(b);
    }
    document.body.appendChild(pad);
    action.onclick=()=>{
      if(store.mode==='ship'){mode('flight');if(WRADIO && WRADIO.st && !WRADIO.st.on)WRADIO.toggle();say('🚀 El gigante despierta. Próximo destino: la Luna.');}
      else if(store.mode==='landed'){mode('moon');store.moonX=0;store.moonZ=16;store.stage=0;store.lap=0;}
      else if(store.mode==='moon'){store.racing=!store.racing;store.stage=0;store.lap=0;status();}
    };
    function refreshTiles(){
      const cx=Math.round(store.moonX/tileSize),cz=Math.round(store.moonZ/tileSize);
      tiles.forEach((m,i)=>{
        const ix=cx+i%3-1,iz=cz+Math.floor(i/3)-1,key=ix+','+iz;
        if(m.userData.ix===key)return;
        m.userData.ix=key;const g=m.geometry,a=g.attributes.position;
        for(let k=0;k<a.count;k++){
          const x=ix*tileSize+a.getX(k),z=iz*tileSize+a.getZ(k);
          a.setY(k,height(x,z));
        }
        a.needsUpdate=true;g.computeVertexNormals();m.position.set(ix*tileSize,0,iz*tileSize);
      });
    }
    let pending=0;
    function tick(dt,t){
      dt=Math.min(.06,Math.max(0,dt));
      if(store.mode==='island'){
        pending+=dt;if(pending>.25){pending=0;const near=gateInfo();gate.style.display=near?'block':'none';if(near)gate.textContent=near.label;}
        return;
      }
      // Do not allow the main island movement controls to act while in the dedicated scene.
      for(const k in ROAMS.k)ROAMS.k[k]=0;
      store.time+=dt;pad.style.display=store.mode==='moon'?'flex':'none';cam.layers.set(store.mode==='moon'?3:2);
      if(savedCamera===null)savedCamera=cam.fov;
      cam.fov=store.mode==='moon'?(innerWidth<innerHeight?69:64):65;cam.near=.12;cam.far=2500;cam.updateProjectionMatrix();
      if(store.mode==='ship'||store.mode==='flight'||store.mode==='landed'){
        const progress=clamp(store.time/28,0,1);
        cam.position.set(Math.sin(t*.21)*.1,5.5+Math.sin(t*1.9)*.08,12);
        cam.lookAt(0,6,-16);
        ship.position.set(0,0,0);ring.rotation.z=Math.sin(t*.3)*.05;
        disco.rotation.y+=dt*.6;
        for(const c of deck.parent.children)if(c.userData.eq!==undefined)c.scale.y=.6+Math.abs(Math.sin(t*3+c.userData.eq))*.9;
        djHead.rotation.z=Math.sin(t*1.2)*.14;
        cabinLamp.intensity=1.4+Math.sin(t*2.6)*.6;
        home.position.x=-20-progress*32;home.position.z=-100-progress*34;
        moonDest.position.set(30-progress*25,10,-107+progress*76);
        moonDest.scale.setScalar(1+progress*2.8);
        if(store.mode==='flight'&&store.time>=28){mode('landed');say('🌙 Hemos aterrizado. Ahora puedes salir a explorar.');}
      }else{
        const forward=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);
        const strafe=(keys.d?1:0)-(keys.a?1:0);
        // Side rotation is handled by Q/E and the arrow keys below.
        if(keys.q)store.yaw+=dt*1.7;if(keys.e)store.yaw-=dt*1.7;
        if(keys.arrowleft)store.yaw+=dt*1.7;if(keys.arrowright)store.yaw-=dt*1.7;
        const speed=(keys.shift?30:17)*dt;
        store.moonX+=Math.sin(store.yaw)*forward*speed+Math.cos(store.yaw)*strafe*speed;
        store.moonZ+=-Math.cos(store.yaw)*forward*speed+Math.sin(store.yaw)*strafe*speed;
        refreshTiles();
        const sy=height(store.moonX,store.moonZ);
        cam.position.set(store.moonX,sy+7.5,store.moonZ);
        cam.lookAt(store.moonX+Math.sin(store.yaw)*20,sy+7.2,store.moonZ-Math.cos(store.yaw)*20);
        moonSky.position.set(store.moonX,0,store.moonZ);
        starBackdrop.position.set(store.moonX,0,store.moonZ);
        moonShip.position.set(store.moonX+130,110+Math.sin(t*.2)*8,store.moonZ-130);
        dolphin.position.set(store.moonX-105,98+Math.sin(t*.5)*3,store.moonZ-130);
        tail.position.set(dolphin.position.x-10,dolphin.position.y,dolphin.position.z);
        if(store.racing){
          const cp=rings[store.stage],dist=Math.hypot(store.moonX-cp.position.x,store.moonZ-cp.position.z);
          if(dist<12){
            store.stage=(store.stage+1)%8;
            if(store.stage===0)store.lap++;
            if(store.lap===3){
              store.racing=false;store.wins++;save();
              say('🏆 CAMPEÓN DE LA LUNA · clave secreta ULTIMATEROBOTS desbloqueada.');
            }else say('✨ Puerta '+store.stage+'/8 · vuelta '+(store.lap+1)+'/3');
          }
        }
        for(const [i,r] of rings.entries())r.visible=!store.racing||i===store.stage;
      }
      if (!store.lastStatus || store.time-store.lastStatus>.24) {store.lastStatus=store.time;status();}
    }
    layer(ship,2);layer(moon,3);
    const api=Object.freeze({tick,preTick(){if(store.mode!=='island')for(const k in ROAMS.k)ROAMS.k[k]=0;},get active(){return store.mode!=='island';},get mode(){return store.mode;},get near(){return gateInfo();},enter:()=>mode('ship'),returnToIsland:()=>mode('island'),get state(){return Object.assign({},store)},get champion(){return memory()},advanceInLocalTest(frames=1){if(!['localhost','127.0.0.1'].includes(location.hostname))return false;for(let i=0;i<Math.min(520,Math.max(0,frames));i++)tick(.06,i*.06);return store.mode;}});
    window.__UNFIRE_LUNAR=api;return api;
  }
  // The costly geometry never exists until the player nears the actual ship.
  // No extra render pass, physics ticker or new worker while exploring the island.
  function create(args) {
    let world=null,probe=0;
    function wake(dt) {
      if(world)return world;
      probe += Math.max(0,Number(dt)||0);
      if(probe<.4)return null;
      probe=0;
      if(!args.ROAMS.on||!window.ATM_OUT)return null;
      const g=(window.__OUTGIANTS||[]).find(g=>g.lunarShip);
      if(!g)return null;
      if(Math.hypot(args.ROAMS.p.x-g.w.position.x,args.ROAMS.p.z-g.w.position.z)>260)return null;
      world=buildWorld(args);
      return world;
    }
    return Object.freeze({
      tick(dt,t){const w=wake(dt);if(w)w.tick(dt,t)},
      preTick(){if(world)world.preTick()},
      get active(){return world?world.active:false},
      get mode(){return world?world.mode:'island'},
      get state(){return world?world.state:{mode:'island'}},
      get champion(){return world?world.champion:false},
      enter(){const w=world||buildWorld(args);world=w;w.enter()},
      returnToIsland(){if(world)world.returnToIsland()}
    });
  }
  window.UnfireLunarWorld=Object.freeze({create,terrainHeight:height});
})();