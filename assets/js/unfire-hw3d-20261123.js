/* Unfire · hardware explorer 3D viewer (three.js r147, self-hosted) · 23 Nov 2026
   Static on open; hover tilt hints interactivity; drag with inertia; wheel/pinch zoom. */
(function(){
  var d=document,dlg=d.getElementById('uf-hw-dialog');if(!dlg)return;
  var media=dlg.querySelector('.uf-dlg-media'),V='/assets/vendor/three-r147/',M='/assets/hardware/2026-11/models/';
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var libs=null,st=null,cache={},want=null,running=false,raf=0,loadTimer=0;
  var capable=webgl(),generation=0,mobile=window.matchMedia&&window.matchMedia('(any-pointer: coarse), (max-width: 860px)').matches;
  var low=mobile||(navigator.deviceMemory||8)<=4,scale=1,slow=0,lastTick=0,lastRender=0;
  var maxPixels=low?280000:1400000;
  function limitExpand(){dlg.classList.add('uf-low-gpu');d.dispatchEvent(new CustomEvent('uf-hw-low-gpu'));}
  if(capable)dlg.classList.add('has3d');else limitExpand();if(low&&!mobile)limitExpand();

  function load(src){return new Promise(function(ok,ko){var s=d.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;d.head.appendChild(s);});}
  function ensureLibs(){if(!libs){libs=load(V+'three.min.js').then(function(){return Promise.all([load(V+'OrbitControls.js'),load(V+'RoomEnvironment.js'),load(V+'GLTFLoader.js')]);}).catch(function(e){libs=null;throw e;});}return libs;}
  function webgl(){try{var c=d.createElement('canvas');var gl=window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl'));if(gl){var ext=gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}return !!gl;}catch(e){return false;}}

  function setup(){
    var T=THREE,wrap=d.createElement('div');wrap.className='uf-3d';
    var hint=d.createElement('div');hint.className='uf-3d-hint uf-mono';hint.textContent='Drag to rotate · Scroll or pinch to zoom';
    var r=new T.WebGLRenderer({antialias:!low,alpha:true,powerPreference:low?'low-power':'high-performance'});
    r.setPixelRatio(1);r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;
    r.shadowMap.enabled=!low;r.shadowMap.autoUpdate=false;r.shadowMap.type=T.PCFSoftShadowMap;r.setClearColor(0x000000,0);
    wrap.appendChild(r.domElement);wrap.appendChild(hint);media.appendChild(wrap);
    var sc=new T.Scene(),pm=new T.PMREMGenerator(r),room=new T.RoomEnvironment();sc.environment=pm.fromScene(room,.04).texture;pm.dispose();if(room.dispose)room.dispose();
    var cam=new T.PerspectiveCamera(30,1,.005,20);
    var key=new T.DirectionalLight(0xffffff,1.6);key.position.set(-.35,.9,.45);key.castShadow=!low;key.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);key.shadow.radius=6;key.shadow.bias=-.0004;
    var s=key.shadow.camera;s.left=s.bottom=-.4;s.right=s.top=.4;s.near=.05;s.far=3;sc.add(key);sc.add(new T.HemisphereLight(0xffffff,0xd8d4cc,.55));
    var floor=new T.Mesh(new T.PlaneGeometry(4,4),new T.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.visible=!low;sc.add(floor);
    var pivot=new T.Group();sc.add(pivot);
    var ctl=new T.OrbitControls(cam,r.domElement);ctl.enableDamping=true;ctl.dampingFactor=.055;ctl.rotateSpeed=.75;ctl.zoomSpeed=.8;ctl.enablePan=false;
    ctl.minPolarAngle=.15;ctl.maxPolarAngle=Math.PI/2-.06;
    var tilt={x:0,y:0,tx:0,ty:0},touched=false;
    function onMove(e){if(touched||reduce||low)return;var b=r.domElement.getBoundingClientRect();tilt.ty=((e.clientX-b.left)/b.width-.5)*.22;tilt.tx=((e.clientY-b.top)/b.height-.5)*.08;start();}
    r.domElement.addEventListener('pointermove',onMove);
    r.domElement.addEventListener('pointerleave',function(){tilt.tx=tilt.ty=0;start();});
    ctl.addEventListener('start',function(){if(!touched){touched=true;tilt.tx=tilt.ty=0;wrap.classList.add('used');}});
    ctl.addEventListener('change',start);
    ctl.addEventListener('start',start);
    st={T:T,r:r,sc:sc,cam:cam,ctl:ctl,pivot:pivot,wrap:wrap,tilt:tilt,floor:floor,reset:function(){touched=false;wrap.classList.remove('used');tilt.x=tilt.y=tilt.tx=tilt.ty=0;pivot.rotation.set(0,0,0);}};
    r.domElement.addEventListener('webglcontextlost',function(e){e.preventDefault();limitExpand();fallback(true);});
    new ResizeObserver(size).observe(media);size();
  }
  function size(){if(!st||!capable)return;var w=media.clientWidth,h=media.clientHeight;if(!w||!h)return;
    var ratio=Math.min(window.devicePixelRatio||1,low?1:1.5,Math.sqrt(maxPixels/(w*h)))*scale;
    if(Math.abs(st.r.getPixelRatio()-ratio)>.02)st.r.setPixelRatio(ratio);
    st.r.setSize(w,h,false);st.r.domElement.style.width=w+'px';st.r.domElement.style.height=h+'px';st.cam.aspect=w/h;st.cam.updateProjectionMatrix();start();}
  function frame(obj){
    var T=st.T,box=new T.Box3().setFromObject(obj),c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());
    obj.position.sub(new T.Vector3(c.x,box.min.y,c.z));
    var rad=Math.sqrt(sz.x*sz.x+sz.z*sz.z+sz.y*sz.y*.25)*.5,fit=rad/Math.sin(st.cam.fov*Math.PI/360)/Math.min(1,st.cam.aspect)*1.12;
    st.ctl.target.set(0,sz.y*.42,0);st.cam.position.set(0,sz.y*.42+fit*.5,fit*.87);st.ctl.minDistance=fit*.38;st.ctl.maxDistance=fit*1.8;
    st.ctl.enableDamping=false;st.ctl.update();st.ctl.enableDamping=true;st.ctl.saveState();
  }
  function status(message){var el=dlg.querySelector('.uf-3d-status');el.textContent=message;el.hidden=!message;}
  function show(key,token){stop();var loader=new st.T.GLTFLoader();
    var go=function(g){if(want!==key||generation!==token||!dlg.open)return;
      try{st.pivot.clear();var o=g.scene.clone(true);o.traverse(function(m){if(m.isMesh){m.castShadow=!low;m.receiveShadow=!low;if(!low&&window.__ufHwMat)window.__ufHwMat(m,st.T);}});
      st.pivot.add(o);st.reset();size();frame(o);st.r.shadowMap.needsUpdate=true;
      // Render synchronously while hidden, then reveal only the actual model.
      stop();st.r.render(st.sc,st.cam);
      if(want!==key||generation!==token||!dlg.open)return;
      clearTimeout(loadTimer);dlg.classList.remove('loading3d','error3d');dlg.classList.add('is3d');status('');start();
      }catch(e){if(generation===token)fallback(false);}};
    if(cache[key])return go(cache[key]);
    loader.load(M+key+'.glb?v=2',function(g){cache[key]=g;if(generation===token)go(g);},undefined,function(){if(generation===token)fallback(false);});
  }
  /* micro-surface: object-space value noise perturbs roughness and normal (no UVs needed); colours untouched */
  var NZ='float ufH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nfloat ufN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(ufH(i),ufH(i+vec3(1,0,0)),f.x),mix(ufH(i+vec3(0,1,0)),ufH(i+vec3(1,1,0)),f.x),f.y),mix(mix(ufH(i+vec3(0,0,1)),ufH(i+vec3(1,0,1)),f.x),mix(ufH(i+vec3(0,1,1)),ufH(i+vec3(1,1,1)),f.x),f.y),f.z);}\nfloat ufF(vec3 p){return ufN(p)*.55+ufN(p*2.13)*.3+ufN(p*4.7)*.15;}\n';
  function micro(m){
    var mt=m.material;if(!mt||!mt.isMeshStandardMaterial||mt.userData.uf)return;if(mt.emissiveIntensity>3)mt.emissiveIntensity=1.1;if(mt.emissiveMap||mt.map){mt.userData.uf=1;return;}
    var c=mt.color,lum=c.r*.3+c.g*.59+c.b*.11,metal=mt.metalness>.6,brushed=/gun|alu/i.test(mt.name||'');
    var sc=metal?2600.:1800.,amp=metal?.06:.09,bmp=lum>.5?.035:.05;
    mt.userData.uf=1;
    mt.onBeforeCompile=function(sh){
      sh.uniforms.ufS={value:sc};sh.uniforms.ufA={value:amp};sh.uniforms.ufB={value:bmp};sh.uniforms.ufBr={value:brushed?1:0};
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vUfP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvUfP=(modelMatrix*vec4(position,1.)).xyz;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vUfP;uniform float ufS,ufA,ufB,ufBr;\n'+NZ)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nvec3 ufP=vUfP*ufS;if(ufBr>.5)ufP.x*=.04;float ufV=ufF(ufP);roughnessFactor=clamp(roughnessFactor+(ufV-.5)*ufA*2.+ (ufN(vUfP*ufS*.03)-.5)*ufA,.04,1.);')
        .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{float e=.7;vec3 q=vUfP*ufS;if(ufBr>.5)q.x*=.04;float h0=ufF(q);vec3 g=vec3(ufF(q+vec3(e,0,0))-h0,ufF(q+vec3(0,e,0))-h0,ufF(q+vec3(0,0,e))-h0);vec3 gv=(viewMatrix*vec4(g,0.)).xyz;normal=normalize(normal-ufB*(gv-dot(gv,normal)*normal));}');
    };
    mt.customProgramCacheKey=function(){return 'uf'+sc+amp+bmp+(brushed?1:0);};mt.needsUpdate=true;
  }
  window.__ufHwMat=function(m){try{micro(m);}catch(e){}};
  function fallback(still){stop();clearTimeout(loadTimer);++generation;want=null;if(still){capable=false;limitExpand();}dlg.classList.remove('is3d','loading3d');dlg.classList.add('error3d');status(still?'Interactive 3D is unavailable on this device. Device details remain available.':'The 3D model could not load. Close and reopen to retry.');}
  var quiet=0;
  function loop(now){
    if(!running||!want||d.hidden||!capable||!dlg.classList.contains('is3d')){stop();return;}
    var elapsed=lastTick?now-lastTick:0;lastTick=now;
    if(elapsed>55&&elapsed<1000)slow++;else if(elapsed&&elapsed<40)slow=Math.max(0,slow-1);
    if(slow>=8){slow=0;if(scale>.66){scale*=.72;limitExpand();size();}else{fallback(true);return;}}
    if(low&&lastRender&&now-lastRender<30){raf=requestAnimationFrame(loop);return;}
    lastRender=now;
    var t=st.tilt,delta=Math.max(Math.abs(t.tx-t.x),Math.abs(t.ty-t.y));
    t.x+=(t.tx-t.x)*.06;t.y+=(t.ty-t.y)*.06;
    if(delta<.0001){t.x=t.tx;t.y=t.ty;}
    st.pivot.rotation.set(t.x,t.y,0);
    var moved=st.ctl.update();
    st.r.render(st.sc,st.cam);
    quiet=(moved||delta>=.0001)?0:quiet+1;
    if(quiet>=3){stop();return;}
    raf=requestAnimationFrame(loop);
  }
  function start(){if(running||!st||!want||d.hidden||!capable||!dlg.classList.contains('is3d'))return;quiet=0;lastTick=0;lastRender=0;running=true;raf=requestAnimationFrame(loop);}
  function stop(){running=false;cancelAnimationFrame(raf);raf=0;}
  d.addEventListener('visibilitychange',function(){if(d.hidden)stop();else if(dlg.open)start();});
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',function(){if(dlg.open)start();});
  d.addEventListener('uf-hw-open',function(e){
    stop();clearTimeout(loadTimer);dlg.classList.remove('is3d','error3d');dlg.classList.add('loading3d');status('Preparing 3D model…');
    if(!capable){fallback(true);return;}var key=e.detail&&e.detail.key;if(!key)return;
    want=key;var token=++generation;
    loadTimer=setTimeout(function(){if(generation===token)fallback(false);},15000);
    ensureLibs().then(function(){if(generation!==token||want!==key||!dlg.open)return;if(!st)setup();show(key,token);}).catch(function(){if(generation!==token)return;libs=null;fallback(false);});
  });
  d.addEventListener('uf-hw-close',function(){stop();clearTimeout(loadTimer);want=null;++generation;dlg.classList.remove('is3d','loading3d','error3d');status('');});

})();
