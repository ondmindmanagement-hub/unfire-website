/* Unfire · hardware explorer 3D viewer (three.js r147, self-hosted) · 23 Nov 2026
   Static on open; hover tilt hints interactivity; drag with inertia; wheel/pinch zoom. */
(function(){
  var d=document,dlg=d.getElementById('uf-hw-dialog');if(!dlg)return;
  var media=dlg.querySelector('.uf-dlg-media'),V='/assets/vendor/three-r147/',M='/assets/hardware/2026-11/models/';
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var libs=null,st=null,cache={},want=null,running=false,raf=0;
  if(webgl())dlg.classList.add('has3d');

  function load(src){return new Promise(function(ok,ko){var s=d.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;d.head.appendChild(s);});}
  function ensureLibs(){if(!libs){libs=load(V+'three.min.js').then(function(){return Promise.all([load(V+'OrbitControls.js'),load(V+'RoomEnvironment.js'),load(V+'GLTFLoader.js')]);});}return libs;}
  function webgl(){try{var c=d.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')));}catch(e){return false;}}

  function setup(){
    var T=THREE,wrap=d.createElement('div');wrap.className='uf-3d';
    var hint=d.createElement('div');hint.className='uf-3d-hint uf-mono';hint.textContent='Drag to rotate · Scroll or pinch to zoom';
    var r=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;
    r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.setClearColor(0x000000,0);
    wrap.appendChild(r.domElement);wrap.appendChild(hint);media.appendChild(wrap);
    var sc=new T.Scene(),pm=new T.PMREMGenerator(r);sc.environment=pm.fromScene(new T.RoomEnvironment(),.04).texture;
    var cam=new T.PerspectiveCamera(30,1,.005,20);
    var key=new T.DirectionalLight(0xffffff,1.6);key.position.set(-.35,.9,.45);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.radius=6;key.shadow.bias=-.0004;
    var s=key.shadow.camera;s.left=s.bottom=-.4;s.right=s.top=.4;s.near=.05;s.far=3;sc.add(key);sc.add(new T.HemisphereLight(0xffffff,0xd8d4cc,.55));
    var floor=new T.Mesh(new T.PlaneGeometry(4,4),new T.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;sc.add(floor);
    var pivot=new T.Group();sc.add(pivot);
    var ctl=new T.OrbitControls(cam,r.domElement);ctl.enableDamping=true;ctl.dampingFactor=.055;ctl.rotateSpeed=.75;ctl.zoomSpeed=.8;ctl.enablePan=false;
    ctl.minPolarAngle=.15;ctl.maxPolarAngle=Math.PI/2-.06;
    var tilt={x:0,y:0,tx:0,ty:0},touched=false;
    function onMove(e){if(touched||reduce)return;var b=r.domElement.getBoundingClientRect();tilt.ty=((e.clientX-b.left)/b.width-.5)*.22;tilt.tx=((e.clientY-b.top)/b.height-.5)*.08;}
    r.domElement.addEventListener('pointermove',onMove);
    r.domElement.addEventListener('pointerleave',function(){tilt.tx=tilt.ty=0;});
    ctl.addEventListener('start',function(){if(!touched){touched=true;tilt.tx=tilt.ty=0;wrap.classList.add('used');}});
    st={T:T,r:r,sc:sc,cam:cam,ctl:ctl,pivot:pivot,wrap:wrap,tilt:tilt,floor:floor,reset:function(){touched=false;wrap.classList.remove('used');tilt.x=tilt.y=tilt.tx=tilt.ty=0;pivot.rotation.set(0,0,0);}};
    new ResizeObserver(size).observe(media);size();
  }
  function size(){if(!st)return;var w=media.clientWidth,h=media.clientHeight;if(!w||!h)return;st.r.setSize(w,h,false);st.r.domElement.style.width=w+'px';st.r.domElement.style.height=h+'px';st.cam.aspect=w/h;st.cam.updateProjectionMatrix();}
  function frame(obj){
    var T=st.T,box=new T.Box3().setFromObject(obj),c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());
    obj.position.sub(new T.Vector3(c.x,box.min.y,c.z));
    var rad=Math.sqrt(sz.x*sz.x+sz.z*sz.z+sz.y*sz.y*.25)*.5,fit=rad/Math.sin(st.cam.fov*Math.PI/360)/Math.min(1,st.cam.aspect)*1.12;
    st.ctl.target.set(0,sz.y*.42,0);st.cam.position.set(0,sz.y*.42+fit*.5,fit*.87);st.ctl.minDistance=fit*.38;st.ctl.maxDistance=fit*1.8;
    st.ctl.enableDamping=false;st.ctl.update();st.ctl.enableDamping=true;st.ctl.saveState();
  }
  function show(key){
    want=key;var loader=new st.T.GLTFLoader();
    var go=function(g){if(want!==key)return;st.pivot.clear();var o=g.scene.clone(true);o.traverse(function(m){if(m.isMesh){m.castShadow=true;m.receiveShadow=true;if(window.__ufHwMat)window.__ufHwMat(m,st.T);}});
      st.pivot.add(o);st.reset();frame(o);size();st.r.render(st.sc,st.cam);start();requestAnimationFrame(function(){if(want===key)dlg.classList.add('is3d');});};
    dlg.classList.remove('is3d');
    if(cache[key])return go(cache[key]);
    dlg.classList.add('loading3d');
    loader.load(M+key+'.glb?v=2',function(g){cache[key]=g;dlg.classList.remove('loading3d');go(g);},undefined,function(){dlg.classList.remove('loading3d','is3d');fallback();});
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
  function fallback(){dlg.classList.remove('has3d');var v=dlg.querySelector('video');if(v&&v.dataset.src){v.src=v.dataset.src;v.load();if(!reduce){var p=v.play();if(p&&p.catch)p.catch(function(){});}}}
  function loop(){if(!running)return;var t=st.tilt;t.x+=(t.tx-t.x)*.06;t.y+=(t.ty-t.y)*.06;st.pivot.rotation.set(t.x,t.y,0);st.ctl.update();st.r.render(st.sc,st.cam);raf=requestAnimationFrame(loop);}
  function start(){if(running)return;running=true;size();loop();}
  function stop(){running=false;cancelAnimationFrame(raf);}

  d.addEventListener('uf-hw-open',function(e){
    if(!webgl())return;var key=e.detail&&e.detail.key;if(!key)return;
    ensureLibs().then(function(){if(!st)setup();show(key);}).catch(function(){dlg.classList.remove('is3d','loading3d');fallback();});
  });
  d.addEventListener('uf-hw-close',function(){stop();want=null;dlg.classList.remove('is3d','loading3d');});
})();
