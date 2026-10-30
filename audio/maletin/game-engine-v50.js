
/* UNFIRE · el maletín 3D con inmersión. La web le manda el progreso del scroll (abre la tapa);
   dentro, la rueda acerca la cámara hacia el cursor y cada cosa se abre y se transforma al acercarte. */
(() => {
  const $ = (id) => document.getElementById(id);
  const { clamp, lerp, ease, mesh, rbox } = Y2K;
  const H2 = Math.PI / 2, TAU = Math.PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
  // paso real: la fase de la pierna sale de la distancia recorrida y del tamaño (sin patinar, igual a cualquier escala)
  function STEPPH(d, h, run) { return run ? d / (1.6 * h) * 0.628 : d / (0.87 * h) * 1.047; }
  // cajas de choque reales: pieza a pieza (no la caja gigante del grupo), solo lo que está a la altura del cuerpo
  // Lightweight obstacle grid while detailed outdoor collision data warms in short slices.
  window.__buildObstOut = function () {
    if (!window.__OBSTO) window.__OBSTO=(window.__OBSTX||[]).slice();
    if(window.__warmOutsideObstacles)window.__warmOutsideObstacles();
    return window.__OBSTO;
  };
  window.__warmOutsideObstacles = function () {
    if(window.__obstWarmPending||window.__obstWarmReady)return;
    const R=window.__ROOM&&window.__ROOM.R;
    if(!R)return;
    window.__obstWarmPending=true;
    if(!window.__OBSTO)window.__OBSTO=(window.__OBSTX||[]).slice();
    const todo=[R],found=[],bounds=new THREE.Box3(),size=new THREE.Vector3(),center=new THREE.Vector3();
    const batch=()=>{
      const deadline=performance.now()+3.5;
      let processed=0;
      while(todo.length&&processed<45&&performance.now()<deadline){
        const o=todo.pop();
        if(!o.visible||o.userData.noCollide)continue;
        for(let i=0;i<o.children.length;i++)todo.push(o.children[i]);
        if(!o.isMesh||o.isSprite||o.isPoints)continue;
        if(o.material&&((o.material.transparent&&o.material.opacity<0.5)||o.material.blending===THREE.AdditiveBlending))continue;
        try{
          o.updateWorldMatrix(true,false);
          bounds.setFromObject(o);
          if(bounds.isEmpty())continue;
          bounds.getSize(size);bounds.getCenter(center);
          if(Math.abs(center.x)<84&&center.z>-20&&center.z<100)continue;
          if(bounds.min.y>-1.5||bounds.max.y<-8.3||Math.max(size.x,size.z)>420)continue;
          const r=1.1;
          found.push({x0:bounds.min.x-r,x1:bounds.max.x+r,z0:bounds.min.z-r,z1:bounds.max.z+r,y1:bounds.max.y});
        }catch(_){}
        processed++;
      }
      if(todo.length)setTimeout(batch,24);
      else {window.__OBSTO=found.concat(window.__OBSTX||[]);
            window.__obstWarmReady=true;window.__obstWarmPending=false;}
    };
    setTimeout(batch,24);
  };
  window.__buildObst = function () { const L = [], bb = new THREE.Box3(), sz = new THREE.Vector3(); const R = window.__ROOM && window.__ROOM.R; if (!R) return L; const PR = new Set((window.__PROPS || []).map((q) => q.o)); const FLY = -8.9;
    R.children.forEach((top) => { if (!top.visible || top.isLight || PR.has(top) || top.userData.noCollide) return; top.updateMatrixWorld(true); top.traverse((o) => { if (!o.isMesh || !o.visible || o.material && (o.material.transparent && o.material.opacity < 0.5 || o.material.blending === THREE.AdditiveBlending)) return; if (o.isSprite || o.isPoints) return; let p = o, hid = false; while (p && p !== R) { if (!p.visible) { hid = true; break; } p = p.parent; } if (hid) return; bb.setFromObject(o); if (bb.isEmpty()) return; bb.getSize(sz); if (bb.min.y > FLY + 7.5 || bb.max.y < FLY + 0.7) return; if (Math.max(sz.x, sz.z) > 60 || (sz.x > 30 && sz.z > 30)) return; if (Math.min(sz.x, sz.z) < 0.05 && Math.max(sz.x, sz.z) < 0.5) return; const r = 1.1; L.push({ x0: bb.min.x - r, x1: bb.max.x + r, z0: bb.min.z - r, z1: bb.max.z + r, y1: bb.max.y }); }); });
    // fuera: lo que tapa la salida o el punto de entrada no cuenta
    return L.filter((B) => !(0 > B.x0 && 0 < B.x1 && 24 > B.z0 && 24 < B.z1) && !(-30 > B.x0 - 3 && -30 < B.x1 + 3 && B.z1 > 84) && Math.abs(B.x1 - B.x0) < 70); };
  function HGT(o) { const b = new THREE.Box3().setFromObject(o); return Math.max(0.001, b.max.y - b.min.y); }
  const cv = $('cv'), parentPost = (m) => { try { parent.postMessage(Object.assign({ unfire: 1 }, m), '*'); } catch (e) {} };
  const DEVICE=window.__UNFIRE_AUTOCALIB||{tier:'desktop',maxDpr:1.5,antialias:true};
  let LOWDEV = DEVICE.tier!=='desktop'||((navigator.hardwareConcurrency||8)<=4);
  window.__LOWDEV=LOWDEV;window.__UNFIRE_ACTIVE_DEVICE=DEVICE;
  // SwiftShader/llvmpipe are real software rasterizers: expensive physical materials
  // and 2K shadow passes otherwise block input and the lid for many seconds.
  // Read the renderer's actual driver, not the browser/OS or a QA-only flag.
  function softwareWebGL(renderer) {
    try {
      const gl = renderer.getContext();
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      return /swiftshader|llvmpipe|softpipe|lavapipe|software raster|mesa offscreen/i.test(name);
    } catch (_) { return false; }
  }
  // Broadphase returns candidate boxes only; the original exact response remains unchanged.
  const COLLISION = (boxes,x,z,pad) => window.UnfireCollisionNearby
    ? window.UnfireCollisionNearby.nearby(boxes,x,z,pad) : (boxes || []);
  // Apply the touch-device framebuffer cap BEFORE WebGL allocation: no
  // mid-boot resize or second governor, keeping startup memory predictable.
  if (LOWDEV && DEVICE.touch) {
    const bootDpr = DEVICE.tier === 'compact' ? 0.70 : 0.85;
    DEVICE.maxDpr = Math.min(DEVICE.maxDpr, bootDpr);
  }
  const S = Y2K.stage(cv, { reflect: false, zoom: false, exposure: 0.98, shadow: 0.38,
    maxDpr: DEVICE.maxDpr, antialias: DEVICE.antialias, shadowResolution: LOWDEV?512:2048, fov: 30 });
  const SOFTWARE_WEBGL = softwareWebGL(S.renderer);
  if (SOFTWARE_WEBGL) {
    LOWDEV = true;
    DEVICE.maxDpr = Math.min(DEVICE.maxDpr, 0.50);
    S.renderer.setPixelRatio(Math.min(S.renderer.getPixelRatio(), DEVICE.maxDpr));
    window.__LOWDEV = true;
    document.documentElement.dataset.unfireSoftwareWebgl = 'low';
  }
  if (LOWDEV) { S.renderer.shadowMap.enabled = false; }
  else { S.renderer.shadowMap.autoUpdate = false; S.renderer.shadowMap.needsUpdate = true; }
  // LIGHTFIX: el número de luces del escenario se mantiene constante (luces "proxy" en la raíz),
  // así encender/apagar/ocultar luces dentro o fuera de casa ya no recompila todos los shaders.
  (function lightFix() {
    const T = THREE, HID = 31, scene = S.scene, map = new Map(), pend = new Set(), pool = { P: [], S: [], D: [], H: [], A: [] };
    const box = new T.Group(); box.name = 'unfireLightProxies'; box.userData.noCollide = true; scene.add(box);
    const kind = (l) => l.isPointLight ? 'P' : l.isSpotLight ? 'S' : l.isDirectionalLight ? 'D' : l.isHemisphereLight ? 'H' : l.isAmbientLight ? 'A' : null;
    function mk(k) {
      const p = k === 'P' ? new T.PointLight(0xffffff, 0) : k === 'S' ? new T.SpotLight(0xffffff, 0) : k === 'D' ? new T.DirectionalLight(0xffffff, 0) : k === 'H' ? new T.HemisphereLight(0xffffff, 0x000000, 0) : new T.AmbientLight(0xffffff, 0);
      p.userData.__lfProxy = true; p.matrixAutoUpdate = false; p.castShadow = false;
      if (p.target) { p.target.userData.__lfProxy = true; p.target.matrixAutoUpdate = false; box.add(p.target); }
      box.add(p); return p;
    }
    [['P', 6], ['S', 2], ['D', 1], ['H', 1]].forEach(([k, n]) => { for (let i = 0; i < n; i++) pool[k].push(mk(k)); });
    function want(l) { return l && l.isLight && !l.userData.__lfProxy && !l.castShadow && kind(l) && !map.has(l); }
    function rootOf(o) { while (o.parent) o = o.parent; return o; }
    function adopt(l) {
      const k = kind(l), p = pool[k].pop() || mk(k);
      l.userData.__lfMask = l.layers.mask; l.layers.set(HID); map.set(l, p);
    }
    function release(l, p) { p.intensity = 0; pool[kind(l)].push(p); if (l.userData.__lfMask != null) l.layers.mask = l.userData.__lfMask; map.delete(l); }
    const add0 = T.Object3D.prototype.add;
    T.Object3D.prototype.add = function (...objs) {
      const r = add0.apply(this, objs);
      if (this !== box) for (const o of objs) { if (!o || o.userData?.__lfProxy) continue; if (o.isLight) { if (want(o)) pend.add(o); } else if (o.children && o.children.length) o.traverse((c) => { if (want(c)) pend.add(c); }); }
      return r;
    };
    scene.traverse((c) => { if (want(c)) pend.add(c); });
    let frames = 0; const MINSPARE = { P: 4, S: 1, D: 1, H: 1, A: 0 };
    function sync() {
      if (pend.size) for (const l of pend) { const r = rootOf(l); if (r === scene) { if (want(l)) adopt(l); pend.delete(l); } else if (r.isScene || pend.size > 400) pend.delete(l); }
      if (++frames < 40) for (const k in MINSPARE) while (pool[k].length < MINSPARE[k]) pool[k].push(mk(k));
      for (const [l, p] of map) {
        let o = l, vis = true; while (o.parent) { if (!o.visible) vis = false; o = o.parent; }
        if (o !== scene || !l.isLight) { release(l, p); if (o !== scene && l.parent) pend.add(l); continue; }
        if (!vis || !l.visible || !(l.intensity > 0)) { p.intensity = 0; continue; }
        p.intensity = l.intensity; p.color.copy(l.color);
        p.matrix.copy(l.matrixWorld); p.matrixWorldNeedsUpdate = true;
        if (l.distance !== undefined) { p.distance = l.distance; p.decay = l.decay; }
        if (l.isSpotLight) { p.angle = l.angle; p.penumbra = l.penumbra; }
        if (l.isHemisphereLight) p.groundColor.copy(l.groundColor);
        if (p.target) { p.target.matrix.copy(l.target.matrixWorld); p.target.matrixWorldNeedsUpdate = true; }
      }
    }
    // Matrices "sucias": solo se recalcula la matriz de los objetos que de verdad se han movido (antes: los ~11.000 cada frame).
    const MC = new WeakMap(); let LCAM = null, FR = 0, NOW = 0, lastScan = 0;
    // Además, lo que está oculto (p. ej. el mundo de fuera mientras estás dentro) no se recalcula; al reaparecer se pone al día.
    const _om = new T.Matrix4();
    function upd(o, d, f) {
      if (o.__lfS || o.__lfF) { f = true; o.__lfS = false; o.__lfF = false; }
      if (o.matrixAutoUpdate) {
        const p = o.position, q = o.quaternion, k = o.scale; let c = o.__lfC;
        if (c === undefined) { c = o.__lfC = new Float64Array(10); c[0] = NaN; }
        if (c[0] !== p.x || c[1] !== p.y || c[2] !== p.z || c[3] !== q.x || c[4] !== q.y || c[5] !== q.z || c[6] !== q.w || c[7] !== k.x || c[8] !== k.y || c[9] !== k.z) {
          c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q.x; c[4] = q.y; c[5] = q.z; c[6] = q.w; c[7] = k.x; c[8] = k.y; c[9] = k.z;
          o.matrix.compose(p, q, k); d = true;
        }
      }
      // (getWorldPosition deja matrixWorldNeedsUpdate=true en toda la cadena; con matrixAutoUpdate ya lo cubre la comparación de arriba)
      if ((!o.matrixAutoUpdate && o.matrixWorldNeedsUpdate) || o.__lfPar !== o.parent) { o.__lfPar = o.parent; d = true; }
      else o.matrixWorldNeedsUpdate = false;
      if (d || f) {
        let moved = d; if (!d) _om.copy(o.matrixWorld);
        if (o.parent === null) o.matrixWorld.copy(o.matrix); else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
        if (!d) { const a = _om.elements, b = o.matrixWorld.elements; for (let i = 0; i < 16; i++) if (a[i] !== b[i]) { moved = true; break; } }
        o.matrixWorldNeedsUpdate = false;
        if (o.isCamera) o.matrixWorldInverse.copy(o.matrixWorld).invert();
        if (moved) { d = true; o.__lfT = NOW; if (o.__lfB) dissolve(o.__lfB); }
      }
      const ch = o.children; if (!ch.length) return;
      if (!o.visible && o !== scene) { o.__lfS = true; return; }
      for (let i = 0; i < ch.length; i++) upd(ch[i], d, f);
    }
    scene.updateMatrixWorld = function (force) { upd(this, !!force, false); };
    // Si alguien llama a updateMatrix() por su cuenta (p. ej. gira la cámara un momento para calcular algo y la deja como estaba),
    // la caché se pone al día y en el siguiente frame se recalcula de verdad: nunca queda una matriz vieja.
    const um0 = T.Object3D.prototype.updateMatrix;
    T.Object3D.prototype.updateMatrix = function () {
      um0.call(this); const c = this.__lfC;
      if (c !== undefined) { const p = this.position, q = this.quaternion, k = this.scale; c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q.x; c[4] = q.y; c[5] = q.z; c[6] = q.w; c[7] = k.x; c[8] = k.y; c[9] = k.z; this.__lfF = true; }
    };
    // Objetos diminutos en pantalla (< ~2 px) no se dibujan: menos llamadas de dibujo fuera de casa. Se revisa por tandas.
    const CULL = 1 << HID, KEEP = new WeakMap(), _v = new T.Vector3(); let list = [], li = 0, lt = 0, TH = 1;
    // Muchos robots/aparatos llevan frustumCulled=false (se dibujaban aunque estuvieran detrás de la cámara): aquí se descartan con una esfera holgada.
    let nofc = []; const FKEEP = new WeakMap(), _fr = new T.Frustum(), _pm = new T.Matrix4(), _sp = new T.Sphere();
    function relist() { list = []; nofc = []; scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || !o.geometry || o.__lfB) return; if (o.frustumCulled !== false) { if (!o.isSkinnedMesh) list.push(o); } else if (!o.isSkinnedMesh && !o.userData.__lfProxy) { const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (g.boundingSphere && g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < 400) nofc.push(o); } }); }
    function fcull(cam) {
      if (cam.parent === null) cam.updateMatrixWorld();
      _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const fpx = cam.isPerspectiveCamera ? (S.renderer.domElement.height / 2) / Math.tan((cam.fov * Math.PI) / 360) / Math.max(cam.zoom || 1, 1e-3) : 0, ce = cam.matrixWorld.elements, cx = ce[12], cy = ce[13], cz = ce[14];
      for (let i = 0; i < nofc.length; i++) {
        const o = nofc[i]; if (o.__lfB) continue; const bs = o.geometry.boundingSphere; if (!bs) continue;
        _sp.center.copy(bs.center).applyMatrix4(o.matrixWorld); _sp.radius = bs.radius * o.matrixWorld.getMaxScaleOnAxis() * 1.6 + 1.5;
        const dx = _sp.center.x - cx, dy = _sp.center.y - cy, dz = _sp.center.z - cz, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const out = !_fr.intersectsSphere(_sp) || (fpx > 0 && dist > 2 && ((_sp.radius - 1.5) / 1.6) * fpx / dist < TH), off = FKEEP.has(o);
        if (out && !off) { FKEEP.set(o, o.layers.mask); o.layers.mask = CULL; }
        else if (!out && off) { o.layers.mask = FKEEP.get(o); FKEEP.delete(o); }
      }
    }
    function cull(cam) {
      if (!cam || !cam.isPerspectiveCamera) return;
      if (++lt % 120 === 1) relist();
      const f = (S.renderer.domElement.height / 2) / Math.tan((cam.fov * Math.PI) / 360) / Math.max(cam.zoom || 1, 1e-3);
      const cp = cam.matrixWorld.elements, cx = cp[12], cy = cp[13], cz = cp[14];
      const n = Math.min(list.length, 2500);
      for (let j = 0; j < n; j++) {
        if (li >= list.length) li = 0; const o = list[li++]; if (o.__lfB) continue; const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere; if (!bs) continue;
        const e = o.matrixWorld.elements; _v.copy(bs.center).applyMatrix4(o.matrixWorld);
        const sc = Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10]));
        const dx = _v.x - cx, dy = _v.y - cy, dz = _v.z - cz, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const tiny = dist > 1 && (bs.radius * sc * f) / dist < TH;
        const off = o.layers.mask === CULL && KEEP.has(o);
        if (tiny && !off) { KEEP.set(o, o.layers.mask); o.layers.mask = CULL; }
        else if (!tiny && off) { o.layers.mask = KEEP.get(o); KEEP.delete(o); }
      }
    }
    // LOTES: los objetos quietos que comparten material se dibujan juntos (una llamada de dibujo en vez de decenas).
    // Los originales siguen ahí (colisiones, clics); si uno se mueve, cambia o se oculta por separado, su lote se deshace al instante.
    const BOXB = new T.Group(); BOXB.name = 'unfireBatches'; BOXB.userData.noCollide = true; scene.add(BOXB);
    const CLS = new Set(), OBR = T.Object3D.prototype.onBeforeRender, _nm = new T.Matrix3(), _w = new T.Vector3(), AOK = { position: 1, normal: 1, uv: 1, color: 1 };
    let queue = [], built = 0;
    function okMesh(o) {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.__lfB || o.userData.__lfProxy || o.frustumCulled === false || o.renderOrder !== 0) return false;
      const m = o.material, g = o.geometry;
      if (!m || Array.isArray(m) || m.transparent || m.isShaderMaterial || !g || !g.isBufferGeometry) return false;
      if (o.morphTargetInfluences || o.onBeforeRender !== OBR || o.customDepthMaterial || o.customDistanceMaterial) return false;
      if (g.morphAttributes && Object.keys(g.morphAttributes).length) return false;
      if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false;
      const p = g.attributes.position; if (!p || p.isInterleavedBufferAttribute || p.itemSize !== 3 || p.count > 20000) return false;
      for (const k in g.attributes) { const a = g.attributes[k]; if (!AOK[k] || a.isInterleavedBufferAttribute) return false; }
      if (g.index && g.index.isInterleavedBufferAttribute) return false;
      return o.matrixWorld.determinant() > 0;
    }
    function walk(o) { let v = true, a = null, b = null, p = o; while (p.parent) { if (!p.visible) v = false; b = a; a = p; p = p.parent; } return { v, root: p, dom: b || a }; }
    function sig(g) { return Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(','); }
    function scanBatches() {
      const B = new Map();
      scene.traverse((o) => {
        if (!okMesh(o)) return; const need = 3000 * Math.pow(2, Math.min(o.__lfN || 0, 5)); if (NOW - (o.__lfT || 0) < need) return;
        const w = walk(o); if (!w.v || w.root !== scene) return;
        const e = o.matrixWorld.elements, cell = Math.floor(e[12] / 48) + ':' + Math.floor(e[13] / 48) + ':' + Math.floor(e[14] / 48);
        const key = o.material.uuid + '|' + sig(o.geometry) + '|' + o.castShadow + o.receiveShadow + '|' + (w.dom ? w.dom.id : 0) + '|' + cell;
        let L = B.get(key); if (!L) B.set(key, (L = [])); L.push(o);
      });
      queue = [];
      for (const L of B.values()) { if (L.length < 2) continue; let cur = [], nv = 0; for (const o of L) { const c = o.geometry.attributes.position.count; if (cur.length && (cur.length >= 96 || nv + c > 60000)) { if (cur.length > 1) queue.push(cur); cur = []; nv = 0; } cur.push(o); nv += c; } if (cur.length > 1) queue.push(cur); }
    }
    function build(M) {
      M = M.filter((o) => okMesh(o) && walk(o).root === scene); if (M.length < 2) return;
      const g0 = M[0].geometry, keys = Object.keys(g0.attributes); let nv = 0, ni = 0;
      for (const o of M) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const out = {}; keys.forEach((k) => (out[k] = new Float32Array(nv * g0.attributes[k].itemSize)));
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let vo = 0, io = 0;
      for (const o of M) {
        const g = o.geometry, P = g.attributes.position, n = P.count, mw = o.matrixWorld; _nm.getNormalMatrix(mw);
        for (let i = 0; i < n; i++) { _w.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(mw); const j = (vo + i) * 3; out.position[j] = _w.x; out.position[j + 1] = _w.y; out.position[j + 2] = _w.z; }
        if (out.normal) { const N = g.attributes.normal; for (let i = 0; i < n; i++) { _w.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(_nm).normalize(); const j = (vo + i) * 3; out.normal[j] = _w.x; out.normal[j + 1] = _w.y; out.normal[j + 2] = _w.z; } }
        for (const k of keys) { if (k === 'position' || k === 'normal') continue; const A = g.attributes[k], s = A.itemSize, D = out[k]; const G = [A.getX, A.getY, A.getZ, A.getW]; for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) D[(vo + i) * s + c] = G[c].call(A, i); }
        if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[io++] = I[i] + vo; } else for (let i = 0; i < n; i++) idx[io++] = vo + i;
        vo += n;
      }
      const geo = new T.BufferGeometry(); keys.forEach((k) => geo.setAttribute(k, new T.BufferAttribute(out[k], g0.attributes[k].itemSize, false)));
      geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      const px = new T.Mesh(geo, M[0].material); px.matrixAutoUpdate = false; px.castShadow = M[0].castShadow; px.receiveShadow = M[0].receiveShadow; px.raycast = () => {}; px.userData.__lfProxy = true; px.userData.noCollide = true;
      const cl = { M, px, mat: M.map((o) => o.material), geo: M.map((o) => o.geometry), ver: M.map((o) => o.geometry.attributes.position.version), mask: [] };
      M.forEach((o, i) => { cl.mask[i] = KEEP.has(o) ? KEEP.get(o) : o.layers.mask; KEEP.delete(o); o.layers.mask = CULL; o.__lfB = cl; });
      BOXB.add(px); CLS.add(cl); built++;
    }
    function dissolve(cl) {
      if (!CLS.has(cl)) return; CLS.delete(cl);
      cl.M.forEach((o, i) => { o.layers.mask = cl.mask[i]; o.__lfB = null; o.__lfT = NOW; o.__lfN = (o.__lfN || 0) + 1; });
      BOXB.remove(cl.px); cl.px.geometry.dispose();
    }
    function batchFrame() {
      for (const cl of CLS) {
        let v0 = null, bad = false;
        for (let i = 0; i < cl.M.length; i++) {
          const o = cl.M[i]; if (o.material !== cl.mat[i] || o.geometry !== cl.geo[i] || o.geometry.attributes.position.version !== cl.ver[i]) { bad = true; break; }
          let v = o.visible, p = o; while (p.parent) { p = p.parent; if (!p.visible) v = false; }
          if (p !== scene || (v0 !== null && v !== v0)) { bad = true; break; } v0 = v;
        }
        if (bad) dissolve(cl); else cl.px.visible = !!v0;
      }
      if (NOW - lastScan > 2500) { lastScan = NOW; scanBatches(); }
      const t0 = performance.now(); while (queue.length && performance.now() - t0 < 3) build(queue.pop());
    }
    const RC = T.Raycaster.prototype;
    ['intersectObject', 'intersectObjects'].forEach((k) => { const f = RC[k]; RC[k] = function (...a) { const m0 = this.layers.mask; this.layers.mask = m0 | CULL; try { return f.apply(this, a); } finally { this.layers.mask = m0; } }; });
    // Al sacar algo de la escena se le devuelve su estado normal (por si se usa en otra escena, p. ej. la vista del maletín).
    const rem0 = T.Object3D.prototype.remove;
    T.Object3D.prototype.remove = function (...objs) {
      for (const o of objs) { if (!o || !o.traverse || o.userData?.__lfProxy || this === box || this === BOXB) continue; try { o.traverse((c) => {
        if (c.__lfB) dissolve(c.__lfB);
        if (FKEEP.has(c)) { c.layers.mask = FKEEP.get(c); FKEEP.delete(c); }
        if (KEEP.has(c) && c.layers.mask === CULL) { c.layers.mask = KEEP.get(c); KEEP.delete(c); }
        if (map.has(c)) release(c, map.get(c));
      }); } catch (e) {} }
      return rem0.apply(this, objs);
    };
    const r0 = S.renderer.render;
    S.renderer.render = function (sc, cam) {
      const main = sc === scene && this.getRenderTarget() === null;
      if (sc === scene) { try { sync(); if (main) { LCAM = cam; FR++; NOW = performance.now(); if (window.__LFOFF) { [...list, ...nofc].forEach((o) => { if (FKEEP.has(o)) { o.layers.mask = FKEEP.get(o); FKEEP.delete(o); } if (KEEP.has(o) && o.layers.mask === CULL) { o.layers.mask = KEEP.get(o); KEEP.delete(o); } }); [...CLS].forEach(dissolve); } else { batchFrame(); cull(cam); if (cam && cam.isCamera) fcull(cam); } } } catch (e) { console.warn('[unfire perf]', e); } }
      const x = r0.call(this, sc, cam);
      // Umbral adaptativo: si hay demasiadas llamadas de dibujo, se ocultan antes los detalles lejanos más pequeños.
      // Los shaders ya compilados no se tiran aunque se borre su material: al volver a entrar no hay que recompilar.
      if (main && FR % 30 === 1) { const P = this.info.programs; if (P) for (let i = 0; i < P.length; i++) if (!P[i].__keep) { P[i].__keep = true; P[i].usedTimes++; } }
      if (main) { const c = this.info.render.calls; TH = Math.min(3, Math.max(0.8, TH * (c > 2400 ? 1.04 : c < 1600 ? 0.985 : 1))); }
      return x;
    };
    // El motor de audio se prepara durante la carga (en pausa hasta el primer toque/tecla); antes se creaba al cruzar la puerta y congelaba ~1-2 s.
    const uaInit = () => { try { if (typeof UA !== 'undefined') UA.init(); } catch (e) {} };
    setTimeout(uaInit, 1200);
    ['keydown', 'touchstart', 'pointerdown'].forEach((ev) => addEventListener(ev, uaInit, { once: true, capture: true, passive: true }));
    window.__LIGHTFIX = { lastCam: () => LCAM, why: () => { const cam = LCAM, F = new T.Frustum(); if (cam) { cam.updateWorldMatrix(true, false); F.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); } let frIn = 0, frStale = 0; const r = { tiny: 0, fr: 0, bat: 0, other: 0, vis: 0, prox: 0, proxVis: 0 }; scene.traverse((o) => { if (!o.isMesh) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (o.userData.__lfProxy) { r.prox++; if (v) r.proxVis++; return; } if (!v) return; r.vis++; if (o.layers.mask !== CULL) return; if (o.__lfB) r.bat++; else if (FKEEP.has(o)) { r.fr++; const m0 = o.matrixWorld.clone(); o.updateWorldMatrix(true, false); let df = 0; for (let i = 0; i < 16; i++) df = Math.max(df, Math.abs(m0.elements[i] - o.matrixWorld.elements[i])); if (df > 0.01) frStale++; const sp = new T.Sphere().copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); if (cam && F.intersectsSphere(sp)) frIn++; } else if (KEEP.has(o)) r.tiny++; else r.other++; }); r.TH = TH; r.frIn = frIn; r.frStale = frStale; r.cam = cam && [cam.uuid.slice(0, 4), cam.parent ? cam.parent.type : null, cam.fov]; return r; }, dbg: () => { const r = { mesh: 0, ok: 0, stat: 0, vis: 0, FR, why: {} }; const W = (o) => { const m = o.material, g = o.geometry; if (o.__lfB) return 'batched'; if (o.isInstancedMesh) return 'inst'; if (o.isSkinnedMesh) return 'skin'; if (o.frustumCulled === false) return 'nofc'; if (o.renderOrder) return 'ro'; if (Array.isArray(m)) return 'arr'; if (m.transparent) return 'transp'; if (m.isShaderMaterial) return 'shader'; if (o.morphTargetInfluences) return 'morph'; if (o.onBeforeRender !== OBR) return 'obr'; if (g.drawRange.count !== Infinity) return 'range'; const P = g.attributes.position; if (P.count > 20000) return 'big'; for (const k in g.attributes) if (!AOK[k] || g.attributes[k].isInterleavedBufferAttribute) return 'attr:' + k; if (o.matrixWorld.determinant() <= 0) return 'det'; return 'other'; }; scene.traverse((o) => { if (!o.isMesh || !walk(o).v) return; r.mesh++; if (!okMesh(o)) { const w = W(o); r.why[w] = (r.why[w] || 0) + 1; return; } r.ok++; if (NOW - (o.__lfT || 0) >= 3000) { r.stat++; if (walk(o).v) r.vis++; } }); return r; }, scene, renderer: S.renderer, stats: () => ({ TH, clusters: CLS.size, batched: [...CLS].reduce((n, c) => n + c.M.length, 0), queue: queue.length, built, kinds: [...map.keys()].reduce((m, l) => (m[kind(l)] = (m[kind(l)] || 0) + 1, m), {}), adopted: map.size, pending: pend.size, spare: Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, v.length])) }) };
  })();


  S.controls.enabled = false; S.controls.dispose();
  const L = Y2K.lib(), M = L.M;
  const IMG = (window.UNFIRE_IMG || '../img/');

  // ---------- texturas del maletín ----------
  function foamTex(kind) {
    const c = Y2K.cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    if (kind === 'egg') { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const cx = x * 32 + (y % 2) * 16 + 16, cy = y * 32 + 16, gr = g.createRadialGradient(cx, cy, 2, cx, cy, 18); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(0,0,0,.9)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 18, 0, TAU); g.fill(); } }
    else { g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; for (let k = 0; k <= 256; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); } }
    const id = g.getImageData(0, 0, 256, 256); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 40; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } g.putImageData(id, 0, 0);
    return Y2K.toTex(c, { repeat: kind === 'egg' ? [10, 7] : [22, 15] });
  }
  const CARB = (() => { const c = Y2K.cnv(256, 256), g = c.getContext('2d'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = (x + y) % 2, gr = g.createLinearGradient(x * 16, y * 16, x * 16 + (a ? 16 : 0), y * 16 + (a ? 0 : 16)); gr.addColorStop(0, '#16181d'); gr.addColorStop(0.5, '#323843'); gr.addColorStop(1, '#121418'); g.fillStyle = gr; g.fillRect(x * 16, y * 16, 16, 16); }
    const t2 = Y2K.toTex(c, { color: true, repeat: [16, 11] }); t2.anisotropy = 8; return new THREE.MeshPhysicalMaterial({ map: t2, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }); })();
  const FOAM = new THREE.MeshPhysicalMaterial({ color: 0x9aa3b2, metalness: 0.9, roughness: 0.3, clearcoat: 0.5 });
  const WELLT = (() => { const c = Y2K.cnv(256, 256), g = c.getContext('2d'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = (x + y) % 2, gr = g.createLinearGradient(x * 16, y * 16, x * 16 + (a ? 16 : 0), y * 16 + (a ? 0 : 16)); gr.addColorStop(0, '#191c22'); gr.addColorStop(0.5, '#363c48'); gr.addColorStop(1, '#14161b'); g.fillStyle = gr; g.fillRect(x * 16, y * 16, 16, 16); }
    g.strokeStyle = 'rgba(61,139,255,.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254); g.fillStyle = 'rgba(120,190,255,.8)'; [[8, 8], [248, 8], [8, 248], [248, 248]].forEach(([x, y]) => g.fillRect(x - 6, y - 1, 12, 2)); g.fillStyle = 'rgba(160,200,255,.35)'; g.font = '700 14px monospace'; g.fillText('UNF', 112, 132); return c; })();
  const wellMat = (w, d) => { const t = Y2K.toTex(WELLT, { color: true, repeat: [Math.max(1, Math.round(w * 2.2)), Math.max(1, Math.round(d * 2.2))] }); t.anisotropy = 8; return new THREE.MeshPhysicalMaterial({ map: t, metalness: 0.4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }); };
  const PLUCK = CARB;
  const VELVET = CARB;
  const RUBBER = M.rubber, CHROME = M.chrome;
  // Two material maps share this canvas; halve mobile resolution and drawing work
  // before the first frame, retaining brushed aluminum normals and metalness.
  const ALU = (() => {
    const aluSize = LOWDEV ? 512 : 1024, aluScale = aluSize / 1024;
    const c = Y2K.cnv(aluSize, aluSize), g = c.getContext('2d');
    g.fillStyle = '#8c9199'; g.fillRect(0, 0, aluSize, aluSize);
    for (let i = 0, n = LOWDEV ? 3000 : 14000; i < n; i++) {
      const v = 105 + Math.random() * 110 | 0;
      g.fillStyle = `rgba(${v},${v},${v + 6},${0.06 + Math.random() * 0.12})`;
      g.fillRect(Math.random() * aluSize, Math.random() * aluSize, (30 + Math.random() * 420) * aluScale, Math.max(0.5, aluScale));
    }
    g.lineWidth = Math.max(0.5, aluScale);
    for (let i = 0, n = LOWDEV ? 24 : 70; i < n; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '30,30,34'},${0.06 + Math.random() * 0.1})`;
      g.beginPath();
      const x = Math.random() * aluSize, y = Math.random() * aluSize; g.moveTo(x, y);
      g.quadraticCurveTo(x + (Math.random() - 0.5) * 80 * aluScale, y + (Math.random() - 0.5) * 30 * aluScale,
        x + (Math.random() - 0.5) * 160 * aluScale, y + (Math.random() - 0.5) * 50 * aluScale);
      g.stroke();
    }
    for (let i = 0, n = LOWDEV ? 9 : 25; i < n; i++) {
      const x = Math.random() * aluSize, y = Math.random() * aluSize, r = (6 + Math.random() * 20) * aluScale;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(60,60,64,.18)'); gr.addColorStop(1, 'rgba(60,60,64,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const col = Y2K.toTex(c, { color: true, repeat: [2, 2] }), rou = Y2K.toTex(c, { repeat: [2, 2] });
    col.anisotropy = rou.anisotropy = LOWDEV ? 2 : 8;
    return new THREE.MeshPhysicalMaterial({ color: 0xf0f3f7, map: col, metalness: 0.62, roughness: 0.34, roughnessMap: rou, bumpMap: rou, bumpScale: 0.0015, clearcoat: 0.35, clearcoatRoughness: 0.35 }); })();
  FOAM.copy(ALU); FOAM.color.set(0xaeb7c4);

  // ---------- maletín ----------
  const CW = 5.8, CD = 3.9, HB = 0.55, HL = 0.42;
  function ICON(x, type, cx, cy, s) { x.save(); x.translate(cx, cy); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = s * 0.13; x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = s * 0.06;
    if (type === 'next') { x.beginPath(); x.arc(0, 0, s * 0.36, -2.3, 1.7); x.stroke(); const ex = Math.cos(1.7) * s * 0.36, ey = Math.sin(1.7) * s * 0.36; x.beginPath(); x.moveTo(ex + s * 0.2, ey - s * 0.02); x.lineTo(ex, ey); x.lineTo(ex + s * 0.04, ey - s * 0.2); x.stroke(); }
    else if (type === 'back') { x.beginPath(); x.moveTo(s * 0.34, 0); x.lineTo(-s * 0.34, 0); x.moveTo(-s * 0.1, -s * 0.24); x.lineTo(-s * 0.34, 0); x.lineTo(-s * 0.1, s * 0.24); x.stroke(); }
    else if (type === 'move') { for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 2); x.beginPath(); x.moveTo(0, 0); x.lineTo(s * 0.38, 0); x.moveTo(s * 0.25, -s * 0.11); x.lineTo(s * 0.38, 0); x.lineTo(s * 0.25, s * 0.11); x.stroke(); } }
    else if (type === 'close') { x.beginPath(); x.moveTo(-s * 0.27, -s * 0.27); x.lineTo(s * 0.27, s * 0.27); x.moveTo(s * 0.27, -s * 0.27); x.lineTo(-s * 0.27, s * 0.27); x.stroke(); }
    else if (type === 'shut') { x.beginPath(); x.moveTo(-s * 0.32, s * 0.04); x.lineTo(0, -s * 0.32); x.lineTo(s * 0.32, s * 0.04); x.closePath(); x.fill(); x.fillRect(-s * 0.32, s * 0.14, s * 0.64, s * 0.12); }
    else if (type === 'super') { x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.17 : s * 0.42, a = k * Math.PI / 5 - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
    else if (type === 'cine') { x.beginPath(); x.moveTo(-s * 0.2, -s * 0.3); x.lineTo(s * 0.32, 0); x.lineTo(-s * 0.2, s * 0.3); x.closePath(); x.fill(); }
    x.restore(); }
  const corner = (par, sx, sz, y, h) => { const g = new THREE.Group(); g.position.set(sx * (CW / 2 + 0.012), y, sz * (CD / 2 + 0.012)); par.add(g);
    const a = mesh(rbox(0.42, h * 0.94, 0.05, 0.018), CHROME); a.position.x = -sx * 0.19; g.add(a); const b = mesh(rbox(0.05, h * 0.94, 0.42, 0.018), CHROME); b.position.z = -sz * 0.19; g.add(b);
    const led = mesh(new THREE.BoxGeometry(0.012, h * 0.6, 0.012), Y2K.led('#3d8bff', 2.4)); led.position.set(sx * 0.02, 0, sz * 0.02); g.add(led); };
  const caseG = new THREE.Group(); S.scene.add(caseG); caseG.position.y = HB;    // la bandeja queda a y = HB del suelo
  const base = mesh(rbox(CW, HB, CD, 0.1, 5), ALU); base.position.y = -HB / 2; caseG.add(base);
  const rimMat = CHROME;
  const rail = (w, d, x, z) => { const r = mesh(rbox(w, 0.07, d, 0.03), rimMat); r.position.set(x, 0.0, z); caseG.add(r); };
  rail(CW + 0.04, 0.09, 0, CD / 2); rail(CW + 0.04, 0.09, 0, -CD / 2); rail(0.09, CD, CW / 2, 0); rail(0.09, CD, -CW / 2, 0);
  const band = mesh(rbox(CW + 0.02, 0.08, CD + 0.02, 0.04), RUBBER); band.position.y = -HB + 0.1; caseG.add(band);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) corner(caseG, sx, sz, -HB / 2, HB);
  // asa y cierres en el frente
  const handle = new THREE.Group(); handle.position.set(0, -HB / 2, CD / 2 + 0.05); caseG.add(handle);
  const grip = mesh(new THREE.CapsuleGeometry(0.07, 0.9, 8, 20), M.knurlRubber); grip.rotation.z = H2; grip.position.set(0, -0.05, 0.18); handle.add(grip);
  for (const sx of [-1, 1]) { const mt = mesh(rbox(0.16, 0.22, 0.2, 0.05), CHROME); mt.position.set(sx * 0.55, 0, 0.06); handle.add(mt); }
  const dragTex = new THREE.TextureLoader().load(IMG + 'dragon.webp'); dragTex.encoding = THREE.sRGBEncoding;
  const dragon = new THREE.Group(); dragon.position.set(0.95, -HB / 2, CD / 2 + 0.03);
  const dbase = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 40).rotateX(H2), M.blackGloss); dragon.add(dbase); dragon.add(mesh(new THREE.TorusGeometry(0.155, 0.018, 10, 40), CHROME));
  const dface = new THREE.Mesh(new THREE.CircleGeometry(0.12, 40), new THREE.MeshBasicMaterial({ map: dragTex, transparent: true, toneMapped: false })); dface.position.z = 0.022; dragon.add(dface);
  // remaches (como un flight case de verdad) + pantalla de estado
  { const rv = new THREE.CylinderGeometry(0.024, 0.026, 0.014, 14), RM = new THREE.InstancedMesh(rv, CHROME, 120); let n = 0; const dm = new THREE.Object3D();
    const put2 = (x, y, z, ax) => { dm.position.set(x, y, z); dm.rotation.set(ax === 'z' ? H2 : 0, 0, ax === 'x' ? H2 : 0); dm.updateMatrix(); RM.setMatrixAt(n++, dm.matrix); };
    for (let x = -CW / 2 + 0.3; x <= CW / 2 - 0.3; x += 0.38) { if (Math.abs(Math.abs(x) - 1.6) < 0.28 || Math.abs(x) < 0.75 || Math.abs(x - 0.95) < 0.35) continue; for (const y of [-0.1, -HB + 0.17]) put2(x, y, CD / 2 + 0.003, 'z'); put2(x, -0.1, -CD / 2 - 0.003, 'z'); }
    for (let z = -CD / 2 + 0.3; z <= CD / 2 - 0.3; z += 0.38) for (const sx of [-1, 1]) put2(sx * (CW / 2 + 0.003), -0.1, z, 'x');
    RM.count = n; caseG.add(RM); }
  const OC = Y2K.cnv(512, 128), OG = OC.getContext('2d'), OT = Y2K.toTex(OC, { color: true }); let ostate = '';
  const oled = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshBasicMaterial({ map: OT, toneMapped: false })); oled.position.set(0.95, -HB / 2, CD / 2 + 0.036); caseG.add(oled);
  const obez = mesh(rbox(0.6, 0.2, 0.04, 0.03), M.blackGloss); obez.position.set(0.95, -HB / 2, CD / 2 + 0.012); caseG.add(obez);
  function oledSet(st) { if (st === ostate) return; ostate = st; const C = { CERRADO: '#ff3b5c', ABRIENDO: '#ffb020', ABIERTO: '#2bd96b' }[st]; OG.fillStyle = '#020407'; OG.fillRect(0, 0, 512, 128); OG.fillStyle = C; OG.shadowColor = C; OG.shadowBlur = 16; OG.beginPath(); OG.arc(52, 64, 18, 0, TAU); OG.fill(); OG.font = '700 46px "Share Tech Mono", monospace'; OG.fillText(st, 92, 80); OG.shadowBlur = 0; OG.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < 128; y += 4) OG.fillRect(0, y, 512, 1); OT.needsUpdate = true; }
  oledSet('CERRADO');
  { const fb = new THREE.Group(); fb.position.set(-0.95, -HB / 2, CD / 2 + 0.02); caseG.add(fb); fb.add(mesh(new THREE.TorusGeometry(0.11, 0.022, 12, 40), CHROME)); const fd = mesh(new THREE.SphereGeometry(0.1, 32, 16, 0, TAU, 0, 1.1), new THREE.MeshPhysicalMaterial({ color: 0x2a6dff, emissive: 0x2a6dff, emissiveIntensity: 0.8, roughness: 0.05, clearcoat: 1 })); fd.rotation.x = H2; fd.scale.y = 0.5; fb.add(fd);
    const ec = Y2K.cnv(128, 128); G3.drawEmblem(ec.getContext('2d'), 128, '#ffffff'); const ff = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshBasicMaterial({ map: Y2K.toTex(ec, { color: true }), transparent: true, toneMapped: false })); ff.position.z = 0.055; fb.add(ff); window.__fd = fd; }
  const latches = [];
  for (const sx of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(sx * 1.6, -0.02, CD / 2 + 0.03); caseG.add(lg); const plate = mesh(rbox(0.36, 0.2, 0.05, 0.03), CHROME); plate.position.y = -0.06; lg.add(plate);
    const clasp = new THREE.Group(); lg.add(clasp); const cl = mesh(rbox(0.28, 0.24, 0.05, 0.03), CHROME); cl.position.y = 0.1; clasp.add(cl); const lock = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 20), M.gold); lock.rotation.x = H2; lock.position.set(0, -0.06, 0.03); lg.add(lock); latches.push(clasp); }
  // interior: espuma de bandeja + compartimentos + separadores
  const tray = mesh(new THREE.BoxGeometry(CW - 0.16, 0.06, CD - 0.16), PLUCK); tray.position.y = -0.03; caseG.add(tray);
  const COMP = {
    hw: { x0: -2.75, x1: -1.15, z0: -1.75, z1: -0.08, name: 'HYPERWAVE' },
    inst: { x0: -2.75, x1: -1.15, z0: 0.02, z1: 1.75, name: 'Instruments' },
    fx: { x0: -1.05, x1: 1.4, z0: -1.75, z1: -0.08, name: 'FX20 Effects' },
    caps: { x0: -1.05, x1: 1.4, z0: 0.02, z1: 1.75, name: 'Capsules' },
    mut: { x0: 1.5, x1: 2.75, z0: -1.75, z1: 0.25, name: 'Transformables' },
    archer: { x0: 1.5, x1: 2.75, z0: 0.35, z1: 1.75, name: 'ARCHER' },
  };
  for (const c of Object.values(COMP)) { const w = c.x1 - c.x0, d = c.z1 - c.z0; const well = mesh(new THREE.BoxGeometry(w, 0.02, d), wellMat(w, d)); well.position.set((c.x0 + c.x1) / 2, 0.005, (c.z0 + c.z1) / 2); caseG.add(well);
    for (const [x, z, ww, dd] of [[c.x0 - 0.03, (c.z0 + c.z1) / 2, 0.06, d + 0.06], [c.x1 + 0.03, (c.z0 + c.z1) / 2, 0.06, d + 0.06], [(c.x0 + c.x1) / 2, c.z0 - 0.03, w, 0.06], [(c.x0 + c.x1) / 2, c.z1 + 0.03, w, 0.06]]) { const wall = mesh(new THREE.BoxGeometry(ww, 0.1, dd), FOAM); wall.position.set(x, 0.05, z); caseG.add(wall); }
    // etiqueta grabada
    const lc = Y2K.cnv(256, 32), lg = lc.getContext('2d'); lg.fillStyle = 'rgba(200,210,225,.55)'; lg.font = '600 18px Michroma, Arial'; lg.fillText(c.name.toUpperCase(), 6, 22);
    lg.clearRect(0, 0, 256, 32); lg.fillStyle = '#9fd0ff'; lg.font = '700 19px Michroma, Arial'; lg.fillText(c.name.toUpperCase(), 4, 23); const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.06), new THREE.MeshBasicMaterial({ map: Y2K.toTex(lc, { color: true }), transparent: true, toneMapped: false, depthWrite: false })); lab.rotation.x = -H2; lab.position.set(c.x0 + 0.26, 0.103, c.z0 - 0.03); caseG.add(lab); }
  // tapa
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.04, -CD / 2); caseG.add(lidPivot);
  const lid = new THREE.Group(); lid.position.z = CD / 2; lidPivot.add(lid);
  const lidBox = mesh(rbox(CW, HL, CD, 0.1, 5), ALU); lidBox.position.y = HL / 2; lid.add(lidBox);
  const lrail = (w, d, x, z) => { const r = mesh(rbox(w, 0.07, d, 0.03), CHROME); r.position.set(x, 0.0, z); lid.add(r); };
  lrail(CW + 0.04, 0.09, 0, CD / 2); lrail(CW + 0.04, 0.09, 0, -CD / 2); lrail(0.09, CD, CW / 2, 0); lrail(0.09, CD, -CW / 2, 0);
  const lband = mesh(rbox(CW + 0.02, 0.08, CD + 0.02, 0.04), RUBBER); lband.position.y = HL - 0.1; lid.add(lband);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) corner(lid, sx, sz, HL / 2, HL);
  // placa con el logo en la tapa (mariposa + UNFIRE AUDIO)
  const pc = Y2K.cnv(2048, 600), pg = pc.getContext('2d');
  const pgr = pg.createLinearGradient(0, 0, 0, 600); pgr.addColorStop(0, '#1a1f2b'); pgr.addColorStop(1, '#07090e'); pg.fillStyle = pgr; pg.fillRect(0, 0, 2048, 600);
  pg.strokeStyle = '#3d8bff'; pg.lineWidth = 6; pg.strokeRect(20, 20, 2008, 560); pg.strokeStyle = 'rgba(61,139,255,.35)'; pg.lineWidth = 2; pg.strokeRect(40, 40, 1968, 520);
  const em = Y2K.cnv(512, 512); G3.drawEmblem(em.getContext('2d'), 512, '#3d8bff'); pg.drawImage(em, 70, 60, 480, 480);
  const tg = pg.createLinearGradient(0, 150, 0, 380); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, '#aeb8c8'); tg.addColorStop(0.52, '#6f7a8c'); tg.addColorStop(1, '#e6ebf2');
  pg.font = '900 230px Orbitron, Arial'; pg.fillStyle = tg; pg.shadowColor = '#3d8bff'; pg.shadowBlur = 30; pg.fillText('UNFIRE', 600, 360); pg.shadowBlur = 0;
  pg.font = '400 58px Michroma, Arial'; pg.fillStyle = '#7fb6ff'; pg.fillText('A U D I O   ·   F L I G H T   C A S E', 612, 470);
  const plate = mesh(rbox(3.3, 0.04, 0.96, 0.06), new THREE.MeshPhysicalMaterial({ map: Y2K.toTex(pc, { color: true }), metalness: 0.9, roughness: 0.22, clearcoat: 1 })); plate.position.set(0, HL + 0.01, -1.15); lid.add(plate);
  { const hc = Y2K.cnv(1024, 640), hg = hc.getContext('2d'); hg.fillStyle = '#05070c'; hg.fillRect(0, 0, 1024, 640); hg.strokeStyle = 'rgba(61,139,255,.55)'; hg.lineWidth = 2;
    const R = 26; for (let y = 0, row = 0; y < 680; y += R * 1.5, row++) for (let x = row % 2 ? R * 0.866 : 0; x < 1060; x += R * 1.732) { hg.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; hg.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } hg.closePath(); hg.stroke(); }
    const ht = Y2K.toTex(hc, { color: true }); const pan = mesh(rbox(CW - 0.9, 0.03, CD - 0.9, 0.12), new THREE.MeshPhysicalMaterial({ color: 0x0b0e15, metalness: 0.6, roughness: 0.15, clearcoat: 1, emissive: 0xffffff, emissiveMap: ht, emissiveIntensity: 0.35 })); pan.position.set(0, HL + 0.005, 0); lid.add(pan); window.__hexPan = pan;
    for (const [w, d, x, z] of [[CW - 0.5, 0.02, 0, CD / 2 - 0.25], [CW - 0.5, 0.02, 0, -CD / 2 + 0.25], [0.02, CD - 0.5, CW / 2 - 0.25, 0], [0.02, CD - 0.5, -CW / 2 + 0.25, 0]]) { const st = mesh(new THREE.BoxGeometry(w, 0.012, d), Y2K.led('#3d8bff', 2.6)); st.position.set(x, HL + 0.012, z); lid.add(st); }
    const seam = mesh(new THREE.BoxGeometry(CW + 0.06, 0.012, 0.012), Y2K.led('#3d8bff', 3)); seam.position.set(0, 0.02, CD / 2 + 0.06); caseG.add(seam);
  }
  // Original Claude procedural flight-case lid switch, restored directly from git 91346cf.
  // This REPLACES the newer replica; do not add any second button or a floating 2D CTA.
  { const ringB = mesh(new THREE.TorusGeometry(0.42, 0.02, 10, 64).rotateX(H2), Y2K.led('#7fd0ff', 3)); ringB.position.set(0, HL + 0.05, 0.3); ringB.scale.setScalar(1.45); { const bz = mesh(new THREE.TorusGeometry(0.54, 0.08, 18, 64).rotateX(H2), CHROME); bz.position.set(0, HL + 0.03, 0.3); lid.add(bz); const dm = mesh(new THREE.SphereGeometry(0.5, 48, 20, 0, TAU, 0, 1.0), new THREE.MeshPhysicalMaterial({ color: 0x2a6dff, emissive: 0x2a6dff, emissiveIntensity: 0.6, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88 })); dm.scale.y = 0.42; dm.position.set(0, HL + 0.02, 0.3); lid.add(dm); const ec = Y2K.cnv(256, 256); G3.drawEmblem(ec.getContext('2d'), 256, '#ffffff'); const fc = new THREE.Mesh(new THREE.CircleGeometry(0.38, 40), new THREE.MeshBasicMaterial({ map: Y2K.toTex(ec, { color: true }), transparent: true, toneMapped: false })); fc.rotation.x = -H2; fc.position.set(0, HL + 0.235, 0.3); lid.add(fc); window.__unfireOpenButtonParts=[ringB,bz,dm,fc]; } lid.add(ringB); window.__ringB = ringB; }
  // interior de la tapa: espuma de huevera + bolsillo de malla
  const lidFoam = mesh(new THREE.BoxGeometry(CW - 0.18, 0.05, CD - 0.18), CARB); lidFoam.position.y = 0.02; lid.add(lidFoam);
  const LX = (x) => (x + 2.65) / 5.3 * 2048, LY = (z) => (1.7 - z) / 3.4 * 1314, LK = 2048 / 5.3;
  function sticker(g, ty, x, y, sz, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 10; g.shadowOffsetY = 4; const r = sz / 2;
    const txt = (t, yy, f, c) => { g.shadowBlur = 0; g.shadowOffsetY = 0; g.fillStyle = c; g.font = f; g.textAlign = 'center'; g.fillText(t, 0, yy); };
    if (ty === 'holo') { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0; const hg = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null; if (hg) { ['#ff7ad9', '#7ad7ff', '#b6ff3b', '#ffe066', '#c08bff', '#ff7ad9'].forEach((c, i) => hg.addColorStop(i / 5, c)); g.fillStyle = hg; } else g.fillStyle = '#9fd0ff'; g.beginPath(); g.arc(0, 0, r - 8, 0, TAU); g.fill(); txt('Y2K', -4, `900 ${r * 0.62}px Orbitron, Arial`, '#1a1040'); txt('✓ READY', r * 0.42, `700 ${r * 0.22}px Michroma, Arial`, '#1a1040'); }
    else if (ty === 'star') { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, rr = i % 2 ? r * 0.78 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); g.shadowBlur = 0; const sg = g.createRadialGradient(0, -r * 0.3, 2, 0, 0, r); sg.addColorStop(0, '#fff6b0'); sg.addColorStop(1, '#e0a400'); g.fillStyle = sg; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, rr = i % 2 ? r * 0.7 : r * 0.9; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); txt('MILLENNIUM', -r * 0.08, `900 ${r * 0.2}px Michroma, Arial`, '#4a2a00'); txt('EDITION 2000', r * 0.22, `700 ${r * 0.15}px Michroma, Arial`, '#4a2a00'); }
    else if (ty === 'flame') { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-r, -r * 0.5, sz, r, r * 0.5); g.fill(); g.shadowBlur = 0; const fg = g.createLinearGradient(-r, 0, r, 0); fg.addColorStop(0, '#ff2a00'); fg.addColorStop(0.5, '#ff9a00'); fg.addColorStop(1, '#ffe600'); g.fillStyle = fg; g.beginPath(); g.roundRect(-r + 7, -r * 0.5 + 7, sz - 14, r - 14, r * 0.42); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-r + 20 + i * r * 0.32, r * 0.35); g.quadraticCurveTo(-r + 30 + i * r * 0.32, -r * 0.1, -r + 10 + i * r * 0.32, -r * 0.4); g.quadraticCurveTo(-r + 50 + i * r * 0.32, -r * 0.05, -r + 34 + i * r * 0.32, r * 0.35); g.fill(); } txt('HOT TRAX!', r * 0.12, `900 italic ${r * 0.3}px Orbitron, Arial`, '#fff'); }
    else if (ty === 'bfly') { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-r, -r, sz, sz, r * 0.35); g.fill(); g.shadowBlur = 0; const bg = g.createLinearGradient(0, -r, 0, r); bg.addColorStop(0, '#5fc8ff'); bg.addColorStop(1, '#1d4fd8'); g.fillStyle = bg; g.beginPath(); g.roundRect(-r + 7, -r + 7, sz - 14, sz - 14, r * 0.3); g.fill(); const ec = Y2K.cnv(256, 256); G3.drawEmblem(ec.getContext('2d'), 256, '#ffffff'); g.drawImage(ec, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6); }
    else if (ty === 'bar') { g.fillStyle = '#f4f4ee'; g.fillRect(-r, -r * 0.42, sz, r * 0.84); g.shadowBlur = 0; g.fillStyle = '#111'; let xx = -r + 14; while (xx < r - 14) { const w = 2 + (Math.random() * 5 | 0); g.fillRect(xx, -r * 0.3, w, r * 0.42); xx += w + 2 + (Math.random() * 4 | 0); } txt('UNF-2000-β · LOTE 01', r * 0.32, `700 ${r * 0.11}px "Share Tech Mono", monospace`, '#111'); }
    else if (ty === 'corp') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, r, r * 0.62, 0, 0, TAU); g.fill(); g.shadowBlur = 0; g.fillStyle = '#ffd21a'; g.beginPath(); g.ellipse(0, 0, r - 8, r * 0.62 - 8, 0, 0, TAU); g.fill(); g.strokeStyle = '#1a2a6a'; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, r - 18, r * 0.62 - 18, 0, 0, TAU); g.stroke(); txt('UNFIRE CORP.', -r * 0.02, `900 ${r * 0.2}px Orbitron, Arial`, '#1a2a6a'); txt('Nº 2000 · CARDEDEU', r * 0.26, `700 ${r * 0.12}px Michroma, Arial`, '#1a2a6a'); }
    else if (ty === 'alien') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, r * 0.82, r, 0, 0, TAU); g.fill(); g.shadowBlur = 0; g.fillStyle = '#7dff4a'; g.beginPath(); g.moveTo(0, r * 0.88); g.bezierCurveTo(-r * 0.9, r * 0.2, -r * 0.78, -r * 0.88, 0, -r * 0.88); g.bezierCurveTo(r * 0.78, -r * 0.88, r * 0.9, r * 0.2, 0, r * 0.88); g.fill(); g.fillStyle = '#0a0a14'; [-1, 1].forEach((d) => { g.beginPath(); g.ellipse(d * r * 0.3, -r * 0.05, r * 0.22, r * 0.12, d * 0.5, 0, TAU); g.fill(); }); }
    else if (ty === 'warn') { g.fillStyle = '#fff'; g.fillRect(-r, -r * 0.36, sz, r * 0.72); g.shadowBlur = 0; g.fillStyle = '#d4001a'; g.fillRect(-r + 6, -r * 0.36 + 6, sz - 12, r * 0.72 - 12); txt('FRAGILE · AUDIO INSIDE', r * 0.08, `900 ${r * 0.14}px Michroma, Arial`, '#fff'); }
    else if (ty === 'cd') { const cg = g.createConicGradient ? g.createConicGradient(rot, 0, 0) : null; if (cg) { ['#e8e8f0', '#9ff', '#f9f', '#ff9', '#e8e8f0', '#9cf', '#e8e8f0'].forEach((c, i) => cg.addColorStop(i / 6, c)); g.fillStyle = cg; } else g.fillStyle = '#ddd'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0; g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * 0.32, 0, TAU); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, r * 0.12, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; txt('MIX 2000', r * 0.62, `700 ${r * 0.14}px Michroma, Arial`, '#334'); }
    else if (ty === 'daisy') { g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, r * 0.22, a, 0, TAU); g.fill(); } g.shadowBlur = 0; g.fillStyle = '#ffd21a'; g.beginPath(); g.arc(0, 0, r * 0.32, 0, TAU); g.fill(); g.fillStyle = '#ff8ac6'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.3, r * 0.13, a, 0, TAU); g.fill(); } }
    else if (ty === 'heart') { const hp = (k) => { g.beginPath(); g.moveTo(0, r * 0.8 * k); g.bezierCurveTo(-r * 1.2 * k, -r * 0.1 * k, -r * 0.6 * k, -r * 1.0 * k, 0, -r * 0.45 * k); g.bezierCurveTo(r * 0.6 * k, -r * 1.0 * k, r * 1.2 * k, -r * 0.1 * k, 0, r * 0.8 * k); }; g.fillStyle = '#fff'; hp(1); g.fill(); g.shadowBlur = 0; const hg = g.createLinearGradient(0, -r, 0, r); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.4, '#c6cbe0'); hg.addColorStop(0.55, '#6b7290'); hg.addColorStop(1, '#e8ecff'); g.fillStyle = hg; hp(0.86); g.fill(); }
    else if (ty === 'sparkle') { g.fillStyle = '#fff'; [[0, 0, 1], [r * 0.7, -r * 0.6, 0.45], [-r * 0.6, r * 0.6, 0.35]].forEach(([x0, y0, k]) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * 0.18 * k : r * k; g.lineTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); } g.fill(); }); g.shadowBlur = 0; g.fillStyle = '#7fe8ff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * 0.12 : r * 0.82; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); }
    else if (ty === 'note') { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0; const ng = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r); ng.addColorStop(0, '#c9a2ff'); ng.addColorStop(1, '#5a1fd8'); g.fillStyle = ng; g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.fill(); txt('♫', r * 0.3, `900 ${r * 1.1}px Arial`, '#fff'); }
    else if (ty === 'bubble') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, r, r * 0.6, 0, 0, TAU); g.moveTo(-r * 0.3, r * 0.5); g.lineTo(-r * 0.6, r * 0.95); g.lineTo(0, r * 0.55); g.fill(); g.shadowBlur = 0; g.fillStyle = '#ff2fb0'; g.beginPath(); g.ellipse(0, 0, r - 8, r * 0.6 - 8, 0, 0, TAU); g.fill(); txt('PARTY 2K!', r * 0.1, `900 italic ${r * 0.28}px Orbitron, Arial`, '#fff'); }
    else if (ty === 'globe') { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0; const gg = g.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r); gg.addColorStop(0, '#d8fbff'); gg.addColorStop(0.5, '#28b4ff'); gg.addColorStop(1, '#0a4fb0'); g.fillStyle = gg; g.beginPath(); g.arc(0, 0, r - 7, 0, TAU); g.fill(); g.fillStyle = '#5ee36a'; [[-0.3, -0.1, 0.35, 0.22], [0.25, 0.25, 0.3, 0.18], [0.1, -0.45, 0.2, 0.1]].forEach(([x0, y0, a0, b0]) => { g.beginPath(); g.ellipse(x0 * r, y0 * r, a0 * r, b0 * r, 0.5, 0, TAU); g.fill(); }); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.45, r * 0.4, r * 0.18, -0.5, 0, TAU); g.fill(); }
    else if (ty === 'ufo') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, r * 0.1, r, r * 0.42, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -r * 0.1, r * 0.45, Math.PI, 0); g.fill(); g.shadowBlur = 0; g.fillStyle = '#b8c0d8'; g.beginPath(); g.ellipse(0, r * 0.1, r - 7, r * 0.42 - 7, 0, 0, TAU); g.fill(); g.fillStyle = '#7dff4a'; g.beginPath(); g.arc(0, -r * 0.1, r * 0.4, Math.PI, 0); g.fill(); g.fillStyle = '#ffe066'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * r * 0.3, r * 0.18, r * 0.07, 0, TAU); g.fill(); } }
    else if (ty === 'lens') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-r, -r * 0.3); g.lineTo(r * 0.7, -r * 0.5); g.lineTo(r, r * 0.4); g.lineTo(-r * 0.8, r * 0.5); g.closePath(); g.fill(); g.shadowBlur = 0; const lg = g.createLinearGradient(-r, -r, r, r); lg.addColorStop(0, 'rgba(120,255,150,.95)'); lg.addColorStop(1, 'rgba(20,140,60,.95)'); g.fillStyle = lg; g.beginPath(); g.moveTo(-r + 10, -r * 0.24); g.lineTo(r * 0.66, -r * 0.42); g.lineTo(r - 10, r * 0.34); g.lineTo(-r * 0.76, r * 0.42); g.closePath(); g.fill(); txt('LV 2000', r * 0.1, `900 ${r * 0.26}px "Share Tech Mono", monospace`, '#06260f'); }
    g.restore(); g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = 0.25; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-sz * 0.18, -sz * 0.18, sz * 0.3, sz * 0.06, -0.6, 0, TAU); g.fill(); g.restore(); }
  const BTNPOS = [[0, -0.66, 0.38], [-1.95, -0.66, 0.33], [1.95, -0.66, 0.28], [-1.15, -0.98, 0.24], [1.15, -0.98, 0.24], [-0.55, -1.18, 0.22], [0.55, -1.18, 0.22], [0, -1.36, 0.22]];
  const lidArt = (() => { const W = 2048, Hh = 1314, c = Y2K.cnv(W, Hh), g = c.getContext('2d'), ec = Y2K.cnv(W, Hh), e = ec.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, W, Hh);
    // base: armadura nacarada (placas, costuras, remaches)
    const bg = g.createLinearGradient(0, 0, W, Hh); bg.addColorStop(0, '#e9ecf6'); bg.addColorStop(0.5, '#c9cfe4'); bg.addColorStop(1, '#dfe2ef'); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,70,110'},${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * Hh, 2, 2); }
    // hombreras ocre a los lados (curvas), espejo
    for (const sd of [-1, 1]) { g.save(); if (sd > 0) { g.translate(W, 0); g.scale(-1, 1); } const og = g.createLinearGradient(0, 0, 320, 0); og.addColorStop(0, '#6b4a1c'); og.addColorStop(0.55, '#c99a3c'); og.addColorStop(1, '#8a6224'); g.fillStyle = og; g.beginPath(); g.moveTo(0, 0); g.lineTo(330, 0); g.bezierCurveTo(250, 180, 300, 420, 290, 620); g.bezierCurveTo(200, 700, 90, 690, 0, 660); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,240,200,.55)'; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(40,20,0,.5)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, 160 * k); g.bezierCurveTo(120, 160 * k - 30, 220, 160 * k - 20, 290, 160 * k + 10); g.stroke(); }
      // carbono tuneado abajo (con pinstripe neón)
      g.save(); g.beginPath(); g.moveTo(0, 1314); g.lineTo(0, 1180); g.lineTo(60, 1120); g.lineTo(60, 760); g.lineTo(0, 700); g.closePath(); g.clip(); for (let y = 690; y < 1314; y += 12) for (let x = 0; x < 80; x += 12) { g.fillStyle = (x + y) / 12 % 2 ? '#1a1d24' : '#2b303b'; g.fillRect(x, y, 12, 12); } g.restore();
      g.restore(); }
    // costuras de placas
    g.strokeStyle = 'rgba(70,80,120,.35)'; g.lineWidth = 3; [[340, 0, 340, 120], [1708, 0, 1708, 120], [0, 700, 2048, 700]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); });
    const rivet = (x, y) => { const rg = g.createRadialGradient(x - 2, y - 2, 1, x, y, 9); rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#6d7488'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); };
    for (let x = 380; x < 1680; x += 92) { rivet(x, 22); } [[60, 40], [1988, 40], [60, 1274], [1988, 1274]].forEach(([x, y]) => rivet(x, y));
    // alojamiento de altavoces
    [-1, 1].forEach((d) => { const x = LX(d * 2.3), y = LY(0.6); const sg = g.createRadialGradient(x, y, 60, x, y, 150); sg.addColorStop(0, '#0b0d12'); sg.addColorStop(0.8, '#2a3040'); sg.addColorStop(1, 'rgba(42,48,64,0)'); g.fillStyle = sg; g.beginPath(); g.arc(x, y, 150, 0, TAU); g.fill(); e.strokeStyle = '#3d8bff'; e.lineWidth = 5; e.beginPath(); e.arc(x, y, 140, 0, TAU); e.stroke(); });
    // placa de botonera estilo reproductor 2000: unión de cuerpo + lóbulos
    const shapes = (ctx) => { ctx.beginPath(); ctx.roundRect(LX(-1.75), LY(-0.14), 3.5 * LK, 1.44 * LK, 0.3 * LK); [-1, 1].forEach((d) => { ctx.moveTo(LX(d * 1.95) + 0.5 * LK, LY(-0.66)); ctx.arc(LX(d * 1.95), LY(-0.66), 0.5 * LK, 0, TAU); }); };
    g.save(); g.shadowColor = 'rgba(10,20,60,.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; g.lineJoin = 'round'; g.strokeStyle = '#eef3ff'; g.lineWidth = 30; shapes(g); g.stroke(); g.restore(); g.strokeStyle = '#7d879e'; g.lineWidth = 18; shapes(g); g.stroke();
    const pg = g.createLinearGradient(0, LY(-0.14), 0, LY(-1.6)); pg.addColorStop(0, '#2f8cff'); pg.addColorStop(0.45, '#0f3fa8'); pg.addColorStop(1, '#061a52'); g.fillStyle = pg; shapes(g); g.fill();
    g.save(); shapes(g); g.clip(); g.globalAlpha = 0.18; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(LX(0), LY(-0.2), 2.6 * LK, 0.34 * LK, 0, 0, TAU); g.fill(); g.globalAlpha = 0.12; for (let i = 0; i < 6; i++) { g.strokeStyle = '#9fe0ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, LY(-1.0) + i * 22); g.bezierCurveTo(600, LY(-1.3) + i * 22, 1400, LY(-0.7) + i * 22, 2048, LY(-1.1) + i * 22); g.stroke(); } g.restore();
    e.lineJoin = 'round'; e.strokeStyle = '#2b8bff'; e.lineWidth = 7; shapes(e); e.stroke();
    // zócalos de cada botón (huecos con aro de luz)
    BTNPOS.forEach(([x, z, r], bi) => { const X = LX(x), Y = LY(z), R = r * LK, sh = bi === 1 || bi === 2 ? 6 : bi === 3 || bi === 4 ? 4 : 0; const path = (ctx, rr) => { ctx.beginPath(); if (!sh) ctx.arc(X, Y, rr, 0, TAU); else if (sh === 4) ctx.roundRect(X - rr * 0.86, Y - rr * 0.86, rr * 1.72, rr * 1.72, rr * 0.22); else for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); } ctx.closePath(); }; const sg = g.createRadialGradient(X, Y, R * 0.4, X, Y, R); sg.addColorStop(0, '#020818'); sg.addColorStop(1, '#16307a'); g.fillStyle = sg; path(g, R); g.fill(); g.strokeStyle = 'rgba(200,230,255,.7)'; g.lineWidth = 4; g.stroke(); e.strokeStyle = '#5fb0ff'; e.lineWidth = 4; path(e, R + 3); e.stroke(); });
    // franja superior: tipo placa de cápsula
    g.fillStyle = 'rgba(30,40,90,.85)'; g.font = '900 34px Orbitron, Arial'; g.textAlign = 'center'; g.fillText('UNFIRE · ARMORED AUDIO DIVISION · MODEL 2000', 1024, 150);
    // pegatinas
    sticker(g, 'corp', 520, 78, 170, -0.08); sticker(g, 'holo', 1560, 82, 120, 0.15); sticker(g, 'bar', 1820, 92, 200, -0.04); sticker(g, 'flame', 210, 98, 190, 0.1);
    sticker(g, 'star', 120, 860, 150, -0.2); sticker(g, 'bfly', 1930, 860, 110, 0.18); sticker(g, 'alien', 1150, 70, 80, -0.25); sticker(g, 'lens', 880, 78, 110, 0.06);
    const t = Y2K.toTex(c, { color: true }); t.anisotropy = 8; const te = Y2K.toTex(ec, { color: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 3.4), new THREE.MeshPhysicalMaterial({ map: t, emissiveMap: te, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 })); m.rotation.x = H2; m.position.set(0, -0.006, 0); lid.add(m); return m; })();
  // lámpara de lava alrededor de la pantalla
  const LAVA = (() => { const c = Y2K.cnv(512, 192), g = c.getContext('2d'), t = Y2K.toTex(c, { color: true }); const bl = Array.from({ length: 14 }, (_, i) => ({ x: Math.random() * 512, y: Math.random() * 192, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 22, r: 26 + Math.random() * 40, h: [300, 20, 280, 330, 200][i % 5] }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.74, 1.36), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); m.rotation.x = H2; m.position.set(0, -0.01, 0.6); lid.add(m);
    return { c, g, t, bl, k: 0, draw(dt, lv) { if ((this.k = (this.k + 1) % 2)) return; const g = this.g; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#1a0624'; g.fillRect(0, 0, 512, 192); g.globalCompositeOperation = 'lighter'; this.bl.forEach((b) => { b.x += b.vx * dt * 2 * (1 + lv * 3); b.y += b.vy * dt * 2 * (1 + lv * 3); if (b.x < 0 || b.x > 512) b.vx *= -1; if (b.y < 0 || b.y > 192) b.vy *= -1; const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (1 + lv)); rg.addColorStop(0, `hsla(${b.h},100%,62%,.95)`); rg.addColorStop(0.6, `hsla(${b.h},100%,45%,.45)`); rg.addColorStop(1, 'hsla(0,0%,0%,0)'); g.fillStyle = rg; g.beginPath(); g.arc(b.x, b.y, b.r * (1 + lv), 0, TAU); g.fill(); }); g.globalCompositeOperation = 'source-over'; this.t.needsUpdate = true; } }; })();

  // exterior: pegatinas Y2K desordenadas (se pueden pisar entre ellas, nunca la placa ni la mariposa) + llavero
  { const W = 2048, Hh = 1254, c = Y2K.cnv(W, Hh), g = c.getContext('2d'), X = (x) => (x + 2.45) / 4.9 * W, Z = (z) => (z + 1.5) / 3.0 * Hh; let sd = 7; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const free = (x, z, r) => !(Math.abs(x) < 1.75 + r && z < -0.6 + r) && Math.hypot(x, z - 0.3) > 0.62 + r;
    const T = ['holo', 'star', 'flame', 'bfly', 'bar', 'corp', 'alien', 'lens', 'cd', 'daisy', 'heart', 'sparkle', 'note', 'bubble', 'globe', 'ufo', 'warn', 'cd', 'heart', 'daisy']; let n = 0, tries = 0;
    while (n < 36 && tries < 900) { tries++; const r = 0.2 + rr() * 0.2, x = -2.3 + rr() * 4.6, z = -1.35 + rr() * 2.7; if (!free(x, z, r) || Math.abs(x) > 2.4 - r || Math.abs(z) > 1.45 - r) continue; sticker(g, T[n % T.length], X(x), Z(z), r * 2 * W / 4.9 * (T[n % T.length] === 'bar' || T[n % T.length] === 'warn' ? 1.3 : 1), (rr() - 0.5) * 1.1); n++; }
    const st = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 3.0), new THREE.MeshPhysicalMaterial({ map: Y2K.toTex(c, { color: true }), transparent: true, alphaTest: 0.05, roughness: 0.3, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -2 })); st.rotation.x = -H2; st.position.set(0, HL + 0.022, 0); lid.add(st); }
  let KEYC = null; { const kg = new THREE.Group(); kg.position.set(0.36, -0.05, 0.18); kg.scale.setScalar(1.7); handle.add(kg); const sw = new THREE.Group(); kg.add(sw); const LK = new THREE.MeshPhysicalMaterial({ color: 0xdfe6f2, metalness: 1, roughness: 0.15 });
    const ring = mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), LK); ring.rotation.y = H2; sw.add(ring); let y = -0.06; for (let i = 0; i < 4; i++) { const l = mesh(new THREE.TorusGeometry(0.016, 0.005, 6, 12), LK); l.position.y = y; l.rotation.y = i % 2 ? H2 : 0; sw.add(l); y -= 0.026; }
    const ch = new THREE.Group(); ch.position.y = y - 0.04; sw.add(ch); const egg = mesh(new THREE.SphereGeometry(0.06, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xff7ad9, roughness: 0.1, clearcoat: 1, transmission: 0.3, thickness: 0.05 })); egg.scale.set(0.9, 1.15, 0.6); ch.add(egg); const scr = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), new THREE.MeshBasicMaterial({ color: 0x9fffc4, toneMapped: false })); scr.position.set(0, 0.008, 0.037); ch.add(scr);
    const lava = new THREE.Group(); lava.position.set(0.05, y - 0.02, 0); sw.add(lava); lava.add(mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.08, 16), new THREE.MeshPhysicalMaterial({ color: 0xff5a1f, emissive: 0xff3a00, emissiveIntensity: 0.9, transmission: 0.4, roughness: 0.05 }))); const cap0 = mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.02, 16), LK); cap0.position.y = 0.05; lava.add(cap0);
    const bf = new THREE.Mesh(new THREE.CircleGeometry(0.04, 24), new THREE.MeshBasicMaterial({ map: (() => { const e = Y2K.cnv(128, 128); G3.drawEmblem(e.getContext('2d'), 128, '#7fd0ff'); return Y2K.toTex(e, { color: true }); })(), transparent: true, side: THREE.DoubleSide, toneMapped: false })); bf.position.set(-0.05, y - 0.01, 0.01); sw.add(bf);
    let a = 0.3, v = 0, b2 = 0, v2 = 0, lp = 0; KEYC = (dt, t) => { const kick = (lidOpen - lp) * 40 + (LV || 0) * 0.4 * Math.sin(t * 9); lp = lidOpen; v += (-a * 18 - v * 1.6 + kick) * dt; a += v * dt; v2 += (-b2 * 10 - v2 * 1.2 + Math.sin(t * 0.7) * 0.6) * dt; b2 += v2 * dt; sw.rotation.x = a; sw.rotation.z = b2 * 0.4; ch.rotation.y += dt * 0.8; scr.material.color.setHSL((t * 0.1) % 1, 0.8, 0.7); }; }

  // ===== zona de atrás: segunda mesa con PC viejo, tocadiscos con discos, cama-coche con litera, butaca hinchable, papelera rebosando, grafitis y firmas, cómics, peluches; fuera: robots gigantes, ballenas voladoras y barcos =====
  function nearRoomObject(player, object, radius) { return !!player && !!object && !!object.position && Number.isFinite(player.x) && Number.isFinite(player.z) && Math.hypot(player.x - object.position.x, player.z - object.position.z) <= radius; }
  const WXp = () => 24; function ROOMB(R, o, picks, anim) { const { RX, RZ, FY, CY, cnv } = o; const SM = (t, r = 0.6) => new THREE.MeshStandardMaterial({ map: t, roughness: r }); const used = (m, k = 0.3) => { m.roughness = Math.min(1, (m.roughness || 0.5) + k); return m; }; const G = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; R.add(g); return g; };
    // segunda mesa (contra la pared de la puerta) con PC de tubo, teclado y tocadiscos
    const d2 = G(-8, FY, RZ - 3.4, Math.PI); const dtM = SM(cnv(512, 256, (g) => { g.fillStyle = '#2a2d36'; g.fillRect(0, 0, 512, 256); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + Math.random() * 80 - 40, y + Math.random() * 20 - 10); g.stroke(); } ['#ff2fb0', '#ffd21a', '#3d8bff'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(60 + i * 160, 60 + i * 50, 22, 0, TAU); g.fill(); }); }), 0.55);
    const t2 = mesh(rbox(14, 0.4, 5, 0.06), dtM); t2.position.y = 7.4; d2.add(t2); for (const sx of [-1, 1]) { const lg = mesh(new THREE.BoxGeometry(0.4, 7.2, 4.4), new THREE.MeshStandardMaterial({ color: 0x8a8f9c, metalness: 0.6, roughness: 0.4 })); lg.position.set(sx * 6.6, 3.6, 0); d2.add(lg); }
    const beige = used(new THREE.MeshStandardMaterial({ color: 0xd9d2bd, roughness: 0.5 })); const mon = mesh(rbox(4.2, 3.6, 3.8, 0.3), beige); mon.position.set(-3, 9.6, 0.2); d2.add(mon); const pcC = Y2K.cnv(320, 240), pcG = pcC.getContext('2d'), pcT = Y2K.toTex(pcC, { color: true }); const ps = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.5), new THREE.MeshBasicMaterial({ map: pcT, toneMapped: false })); ps.position.set(-3, 9.7, 2.12); d2.add(ps);
    const tower = mesh(rbox(1.7, 4.2, 4, 0.1), beige); tower.position.set(-6.0, 9.7, 0); d2.add(tower); const kb = mesh(rbox(4, 0.25, 1.4, 0.1), beige); kb.position.set(-3, 7.75, 1.9); d2.add(kb); [mon, ps, tower, kb].forEach((o) => picks.push({ o, f: () => TUBE.open() }));
    let pcT0 = 0, pcL = 0; anim.push((dt, t) => { if (!window.__roam) return; pcT0 -= dt; if (pcT0 > 0) return; pcT0 = 0.25; const g = pcG; g.fillStyle = '#0a2a8a'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#c0c0c0'; g.fillRect(0, 216, 320, 24); g.fillStyle = '#2bd96b'; g.fillRect(4, 219, 56, 18); g.fillStyle = '#fff'; g.font = '700 12px Arial'; g.fillText('Start', 12, 232); g.fillStyle = '#dce9ff'; g.fillRect(8, 55, 26, 30); g.fillStyle = '#123b8b'; g.font = '900 23px Arial'; g.fillText('?', 14, 78); g.font = '9px Arial'; g.fillStyle = '#fff'; g.fillText('HELP', 7, 96); g.fillStyle = '#fff'; g.fillRect(40, 30, 240, 150); g.fillStyle = '#0a246a'; g.fillRect(40, 30, 240, 18); g.fillStyle = '#fff'; g.fillText('Chat 2000 — room: producers', 46, 43); g.fillStyle = '#111'; g.font = '12px "Share Tech Mono", monospace'; const L = ['dj_robo: anyone got that sample?', 'beatgirl01: brb', 'unfire_fan: love this case', 'xX_k-rad_Xx: lol', 'dj_robo: uploading the mp3 at 56k...']; pcL = (pcL + (Math.random() < 0.3 ? 1 : 0)) % L.length; for (let i = 0; i < 5; i++) g.fillText(L[(pcL + i) % L.length], 48, 66 + i * 20); pcT.needsUpdate = true; });
    const tt = new THREE.Group(); tt.position.set(3.2, 7.6, 0.4); d2.add(tt); tt.add(mesh(rbox(3.4, 0.5, 2.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.35, metalness: 0.4 }))); const plat = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.06, 48), M.chrome); plat.position.set(-0.4, 0.3, 0); tt.add(plat); const DCOL = [0xff2fb0, 0x3d8bff, 0xffd21a, 0x2bd96b, 0xff7a1f, 0xc08bff]; const rec = mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.03, 48), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.2, metalness: 0.3 })); rec.position.set(-0.4, 0.35, 0); tt.add(rec); const lab = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 32), new THREE.MeshStandardMaterial({ color: DCOL[0] })); lab.position.copy(rec.position); lab.position.y += 0.005; tt.add(lab); const arm = mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), M.chrome); arm.position.set(1.1, 0.5, -0.2); arm.rotation.y = 0.5; tt.add(arm);
    let disc = 0; picks.push({ o: tt, f: () => { try { window.UEV('radio'); } catch (e) {} disc = (disc + 1) % DCOL.length; lab.material.color.setHex(DCOL[disc]); try { UA.init(); const W = window.__WRADIO; if (W && W.st.list.length) { if (!W.st.on) W.toggle(); else W.next(); } else { RADIO.start(); RADIO.newSong && RADIO.newSong(disc % RADIO.STYLES.length); say('💿 Disco: ' + RADIO.STYLES[disc % RADIO.STYLES.length].name); } } catch (e) {} hap(0.5); } }); anim.push((dt) => { if (RADIO.st.on) { rec.rotation.y -= dt * 3.5; lab.rotation.y -= dt * 3.5; } });
    const crate = new THREE.Group(); crate.position.set(6, 7.6, 0.2); d2.add(crate); crate.add(mesh(rbox(1.6, 1.4, 2.2, 0.06), used(new THREE.MeshStandardMaterial({ color: 0xffb020 })))); for (let i = 0; i < 9; i++) { const sl = mesh(new THREE.BoxGeometry(1.4, 1.3, 0.04), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i * 0.11, 0.6, 0.5), roughness: 0.6 })); sl.position.set(0, 0.95, -0.9 + i * 0.22); sl.rotation.x = -0.12; crate.add(sl); } picks.push({ o: crate, f: () => { try { window.__WRADIO.pick(); say('📂 Choose your track: it will play through the house speakers'); } catch (e) {} } });
    // cama-coche con litera encima
    const cb = G(14.5, FY, 10, -H2); cb.visible = false; const red = new THREE.MeshPhysicalMaterial({ color: 0xd8121f, roughness: 0.3, clearcoat: 1 }); const body = mesh(rbox(12, 2.6, 6, 0.8), red); body.position.y = 2; cb.add(body); const hood = mesh(rbox(3, 1.4, 5.6, 0.6), red); hood.position.set(5.2, 3.6, 0); cb.add(hood); const spo = mesh(rbox(0.4, 1.8, 6.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 })); spo.position.set(-5.8, 4.4, 0); cb.add(spo); for (const [x, z] of [[-4, 3.1], [4, 3.1], [-4, -3.1], [4, -3.1]]) { const w = mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.6, 24).rotateX(H2), M.blackGloss); w.position.set(x, 1.1, z); cb.add(w); } const mt = mesh(rbox(9, 0.9, 5.2, 0.3), SM(cnv(256, 256, (g) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 32, y * 32, 32, 32); }), 0.9)); mt.position.set(-0.8, 3.6, 0); cb.add(mt);
    const bunkM = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, metalness: 0.7, roughness: 0.35 }); for (const [x, z] of [[-6, 3], [6, 3], [-6, -3], [6, -3]]) { const p = mesh(new THREE.CylinderGeometry(0.18, 0.18, 12, 10), bunkM); p.position.set(x, 6, z); cb.add(p); } const top = mesh(rbox(12.4, 0.8, 6.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x3d8bff, roughness: 0.8 })); top.position.y = 9.6; cb.add(top); const rail = mesh(new THREE.BoxGeometry(12.4, 0.2, 0.2), bunkM); rail.position.set(0, 11, 3.1); cb.add(rail);
    // peluches en la litera
    const plush = (c, x) => { const p = new THREE.Group(); p.position.set(x, 10.6, 0); cb.add(p); const fm = new THREE.MeshStandardMaterial({ color: c, roughness: 1 }); const b = mesh(new THREE.SphereGeometry(0.9, 20, 14), fm); b.scale.y = 1.1; p.add(b); const h = mesh(new THREE.SphereGeometry(0.65, 20, 14), fm); h.position.y = 1.3; p.add(h); for (const sx of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.25, 12, 8), fm); e.position.set(sx * 0.45, 1.85, 0); p.add(e); const ey = mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); ey.position.set(sx * 0.22, 1.4, 0.58); p.add(ey); } }; plush(0xffb6d9, -3); plush(0x9fd0ff, 0); plush(0xd9ff9a, 3);
    // butaca hinchable translúcida
    const ch = G(-22, FY, 8, 0.6); const inf = new THREE.MeshPhysicalMaterial({ color: 0x58b8ff, transmission: 0.55, roughness: 0.08, thickness: 1, clearcoat: 1, transparent: true, opacity: 0.85 }); const seat = mesh(new THREE.TorusGeometry(1.8, 1.1, 16, 32).rotateX(H2), inf); seat.position.y = 1.2; ch.add(seat); const back = mesh(new THREE.TorusGeometry(1.8, 1.0, 16, 32), inf); back.position.set(0, 3.2, -1.6); back.rotation.x = -0.3; ch.add(back);
    // papelera rebosando
    const bin = G(-1, FY, RZ - 3, 0); bin.add(mesh(new THREE.CylinderGeometry(1.0, 0.8, 2.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a5f6b, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }))); bin.children[0].position.y = 1.3; const pap = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 1, flatShading: true }); for (let i = 0; i < 12; i++) { const p = mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.2, 0), pap); const a = Math.random() * TAU, r = i < 7 ? Math.random() * 0.6 : 1.2 + Math.random() * 1.2; p.position.set(Math.cos(a) * r, i < 7 ? 2.6 + Math.random() * 0.5 : 0.3, Math.sin(a) * r); bin.add(p); }
    // grafitis y firmas en la pared lateral izquierda
    const graf = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: cnv(1024, 440, (g) => { const tags = ['K-RAD', 'UNFIRE 01', 'CARDEDEU', 'DJ ROBO', 'beatgirl', 'XOXO', '2K1 4EVER', 'NO PASAR']; const cols = ['#ff2fb0', '#3d8bff', '#111', '#ffd21a', '#2bd96b', '#ff4a00']; for (let i = 0; i < 14; i++) { g.save(); g.translate(40 + Math.random() * 900, 60 + Math.random() * 340); g.rotate((Math.random() - 0.5) * 0.5); g.fillStyle = cols[i % cols.length]; g.font = `${i % 3 ? 'italic 700' : '900'} ${26 + Math.random() * 40}px ${['"Brush Script MT", cursive', '"Comic Sans MS", cursive', '"Marker Felt", cursive', 'Impact'][i % 4]}`; g.lineJoin = 'round'; g.strokeStyle = cols[(i + 2) % cols.length]; g.lineWidth = 2; g.strokeText(tags[i % tags.length], 0, 0); g.fillText(tags[i % tags.length], 0, 0); g.restore(); } g.strokeStyle = '#111'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); let x = 100 + k * 220, y = 380; g.moveTo(x, y); for (let q = 0; q < 12; q++) { x += 10 + Math.random() * 12; y += (Math.random() - 0.5) * 24; g.lineTo(x, y); } g.stroke(); } }), transparent: true, depthWrite: false })); graf.position.set(-RX + 0.06, FY + 4.5, 46); graf.rotation.y = H2; R.add(graf);
    // estantería de cómics con huecos y figuras
    const shelf = G(-RX + 1.2, FY, -4, H2); const wood2 = used(new THREE.MeshStandardMaterial({ color: 0xc9a274, roughness: 0.5 })); for (let k = 0; k < 4; k++) { const b = mesh(new THREE.BoxGeometry(7, 0.25, 2), wood2); b.position.set(0, 2 + k * 2.6, 0); shelf.add(b); } for (const sx of [-1, 1]) { const s2 = mesh(new THREE.BoxGeometry(0.25, 10.6, 2), wood2); s2.position.set(sx * 3.5, 5.3, 0); shelf.add(s2); }
    let sd = 11; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); for (let k = 0; k < 4; k++) { let x = -3.2; while (x < 3) { if (rr() < 0.12) { x += 0.9; continue; } const w = 0.15 + rr() * 0.25, h = 1.4 + rr() * 0.9, b = mesh(new THREE.BoxGeometry(w, h, 1.5), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rr(), 0.55 + rr() * 0.3, 0.35 + rr() * 0.3), roughness: 0.7 })); b.position.set(x + w / 2, 2.125 + k * 2.6 + h / 2, 0); b.rotation.z = rr() < 0.15 ? 0.25 : 0; shelf.add(b); x += w + 0.03; } }


    // ventanas laterales con paisajes locos: acuario y desierto (animadas)
    { const mkWin = (x, z, ry, draw) => { const c = Y2K.cnv(512, 320), g = c.getContext('2d'), t = Y2K.toTex(c, { color: true }); const grp = new THREE.Group(); grp.position.set(x, 6, z); grp.rotation.y = ry; R.add(grp); const pl = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); grp.add(pl); const fm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 }); for (const [w, h, px, py] of [[16.8, 0.5, 0, 5.1], [16.8, 0.5, 0, -5.1], [0.5, 10.6, -8.2, 0], [0.5, 10.6, 8.2, 0], [0.25, 10, 0, 0]]) { const b = mesh(new THREE.BoxGeometry(w, h, 0.4), fm); b.position.set(px, py, 0.1); grp.add(b); } let tt = 0; anim.push((dt, tm, lv) => { if (!window.__roam) return; tt -= dt; if (tt > 0) return; tt = 0.08; draw(g, tm, lv); t.needsUpdate = true; }); };
      const fish = Array.from({ length: 14 }, (_, i) => ({ x: Math.random() * 512, y: 30 + Math.random() * 250, v: 20 + Math.random() * 40, c: ['#ff7a1f', '#ffd21a', '#ff2fb0', '#3d8bff', '#b6ff3b'][i % 5], s: 8 + Math.random() * 14 }));

      const skaters = Array.from({ length: 3 }, (_, i) => ({ p: i * 2.1, c: ['#ff2fb0', '#3d8bff', '#ffd21a'][i] }));
      const _skate = (g, t) => { const sk = g.createLinearGradient(0, 0, 0, 320); sk.addColorStop(0, '#5fc8ff'); sk.addColorStop(1, '#dff6ff'); g.fillStyle = sk; g.fillRect(0, 0, 512, 320); g.fillStyle = '#b9c0cc'; g.fillRect(0, 230, 512, 90); g.fillStyle = '#9aa3b2'; g.beginPath(); g.moveTo(40, 230); g.quadraticCurveTo(40, 120, 150, 120); g.lineTo(160, 120); g.lineTo(160, 230); g.fill(); g.beginPath(); g.moveTo(472, 230); g.quadraticCurveTo(472, 120, 362, 120); g.lineTo(352, 120); g.lineTo(352, 230); g.fill(); g.fillStyle = '#7d8696'; g.fillRect(150, 116, 12, 6); g.fillRect(350, 116, 12, 6); g.strokeStyle = '#ff2fb0'; g.lineWidth = 4; g.beginPath(); g.moveTo(220, 205); g.lineTo(300, 205); g.stroke(); g.fillStyle = '#ffffff'; g.font = 'italic 900 20px Impact'; g.fillText('SKATE PARK 2K', 180, 40); for (let k = 0; k < 6; k++) { g.fillStyle = ['#ff2fb0', '#ffd21a', '#2bd96b'][k % 3]; g.font = 'italic 700 14px "Comic Sans MS"'; g.fillText(['K-RAD', 'SK8', '01', 'FLIP', 'OLLIE', 'XOXO'][k], 60 + k * 70, 260 + (k % 2) * 30); }
        skaters.forEach((S0, si) => { const u = ((t * 0.32 + S0.p) % 2), dir = u < 1 ? 1 : -1, x = 60 + (u < 1 ? u : 2 - u) * 392; let y = 222; if (x < 150) y = 222 - (150 - x) * 0.9; if (x > 362) y = 222 - (x - 362) * 0.9; const edge = x < 72 || x > 440, air = edge ? Math.abs(Math.sin(t * 5 + S0.p)) * 34 : 0; const cyc = Math.floor(t * 0.32 + S0.p), bail = (cyc * 7 + si * 3) % 9 === 0 && edge; y -= air; const spin = edge ? (t * 9 + S0.p) % TAU : 0;
          g.save(); g.translate(x, y); if (bail) { g.rotate(Math.sin(t * 12) * 1.4); } g.strokeStyle = '#111'; g.lineCap = 'round'; g.lineWidth = 3; g.save(); g.rotate(spin * (edge ? 1 : 0)); g.fillStyle = '#2a1a0a'; g.fillRect(-15, 7, 30, 4); g.fillStyle = '#ddd'; g.beginPath(); g.arc(-10, 13, 2.4, 0, TAU); g.arc(10, 13, 2.4, 0, TAU); g.fill(); g.restore(); const crouch = edge ? 4 : 0; g.beginPath(); g.moveTo(-5, 6); g.lineTo(-7 + crouch, -4); g.lineTo(-3, -12); g.moveTo(5, 6); g.lineTo(7 - crouch, -4); g.lineTo(3, -12); g.stroke(); g.fillStyle = S0.c; g.fillRect(-6, -26, 12, 15); g.beginPath(); g.moveTo(-6, -24); g.lineTo(-16, -18 - (edge ? 10 : 0)); g.moveTo(6, -24); g.lineTo(16 * dir, -30 + (edge ? -6 : 6)); g.stroke(); g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(0, -32, 6, 0, TAU); g.fill(); g.fillStyle = S0.c; g.fillRect(-7, -40, 14, 5); g.restore(); if (bail) { g.fillStyle = '#fff'; g.font = '900 18px Impact'; g.fillText('¡OUCH!', x - 24, y - 52); } });
        g.fillStyle = 'rgba(20,20,40,.85)'; for (let k = 0; k < 14; k++) { const cx = 20 + k * 36, h = Math.sin(t * 6 + k) * 3; g.beginPath(); g.arc(cx, 298 + h, 9, 0, TAU); g.fill(); g.fillRect(cx - 10, 306 + h, 20, 14); if (k % 3 === 0) { g.fillRect(cx - 14, 296 + h - Math.abs(Math.sin(t * 5 + k)) * 10, 4, 12); } } };
      if (false) { const vid = document.createElement('video'); vid.src = IMG + 'real/v_earth.mp4'; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.crossOrigin = 'anonymous'; const vt = new THREE.VideoTexture(vid); vt.encoding = THREE.sRGBEncoding; const vg = new THREE.Group(); vg.position.set(30, 6, RZ - 0.15); vg.rotation.y = Math.PI; R.add(vg); vg.add(new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: vt, toneMapped: false }))); const fm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 }); for (const [w, h, px, py] of [[16.8, 0.5, 0, 4.75], [16.8, 0.5, 0, -4.75], [0.5, 10, -8.2, 0], [0.5, 10, 8.2, 0]]) { const b = mesh(new THREE.BoxGeometry(w, h, 0.4), fm); b.position.set(px, py, 0.1); vg.add(b); } anim.push(() => { if (window.__roam) { if (vid.paused) vid.play().catch(() => {}); } else if (!vid.paused) vid.pause(); }); }
      if (false) mkWin(30, RZ - 0.15, Math.PI, (g, t, lv) => { g.fillStyle = '#05061a'; g.fillRect(0, 0, 512, 320); for (let i = 0; i < 90; i++) { const x = (i * 97 + t * (5 + i % 7)) % 512, y = (i * 53) % 320; g.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.14})`; g.fillRect(x, y, 2, 2); } const pg = g.createRadialGradient(150, 360, 20, 150, 360, 220); pg.addColorStop(0, '#5fc8ff'); pg.addColorStop(1, '#0a2a6a'); g.fillStyle = pg; g.beginPath(); g.arc(150, 380, 200, 0, TAU); g.fill(); const sx = (t * 20) % 700 - 100; g.fillStyle = '#e8ecf4'; g.fillRect(sx, 110, 70, 14); g.fillRect(sx + 25, 90, 20, 54); g.fillStyle = '#3d8bff'; g.fillRect(sx - 40, 112, 36, 10); g.fillRect(sx + 74, 112, 36, 10); g.fillStyle = '#ffd21a'; g.beginPath(); g.arc(420, 70, 18 + lv * 10, 0, TAU); g.fill(); });
      if (false) mkWin(-RX + 0.15, 22, H2, (g, t, lv) => { const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#29b6ff'); gr.addColorStop(1, '#063a7a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 320); g.globalAlpha = 0.15; for (let k = 0; k < 6; k++) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(60 + k * 80 + Math.sin(t + k) * 20, 0); g.lineTo(100 + k * 80, 0); g.lineTo(40 + k * 80, 320); g.lineTo(10 + k * 80, 320); g.fill(); } g.globalAlpha = 1; g.fillStyle = '#e8d29a'; g.beginPath(); g.moveTo(0, 320); for (let x = 0; x <= 512; x += 32) g.lineTo(x, 290 + Math.sin(x * 0.03) * 10); g.lineTo(512, 320); g.fill(); g.strokeStyle = '#2bd96b'; g.lineWidth = 6; for (let k = 0; k < 7; k++) { g.beginPath(); const bx = 30 + k * 70; g.moveTo(bx, 300); g.quadraticCurveTo(bx + Math.sin(t * 1.5 + k) * 25, 240, bx + Math.sin(t + k) * 12, 180 + (k % 3) * 20); g.stroke(); }
        fish.forEach((f) => { f.x += f.v * 0.08 * (1 + lv); if (f.x > 540) f.x = -30; const y = f.y + Math.sin(t * 2 + f.v) * 6; g.fillStyle = f.c; g.beginPath(); g.ellipse(f.x, y, f.s, f.s * 0.55, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(f.x - f.s * 0.8, y); g.lineTo(f.x - f.s * 1.6, y - f.s * 0.5); g.lineTo(f.x - f.s * 1.6, y + f.s * 0.5); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(f.x + f.s * 0.5, y - 2, 2, 0, TAU); g.fill(); }); for (let k = 0; k < 10; k++) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(80 + k * 45, 320 - ((t * 40 + k * 37) % 320), 3 + (k % 3), 0, TAU); g.stroke(); } });
      const desImg = new Image(); if (false) mkWin(RX - 0.15, 22, -H2, (g, t) => { if (desImg.complete && desImg.naturalWidth) { g.drawImage(desImg, 0, 0, 512, 320); const cx2 = ((t * 15) % 640) - 60; g.fillStyle = '#3a2410'; for (let k = 0; k < 3; k++) { const x = cx2 - k * 40, y = 268; g.fillRect(x, y, 26, 10); g.fillRect(x + 22, y - 12, 6, 14); g.fillRect(x + 2, y + 10, 3, 10); g.fillRect(x + 20, y + 10, 3, 10); g.beginPath(); g.arc(x + 12, y, 7, Math.PI, 0); g.fill(); } return; } const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#ff9a3c'); gr.addColorStop(0.5, '#ffd27a'); gr.addColorStop(1, '#fff0c8'); g.fillStyle = gr; g.fillRect(0, 0, 512, 320); g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(380, 90, 40, 0, TAU); g.fill(); [['#e8a85a', 200, 0.012], ['#d9903c', 240, 0.018], ['#c97a2a', 280, 0.025]].forEach(([c, y, f], k) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, 320); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * f + k * 2 + t * 0.05) * 20); g.lineTo(512, 320); g.fill(); }); g.fillStyle = '#2f8f3a'; for (const cx of [90, 420]) { g.fillRect(cx, 200, 12, 70); g.fillRect(cx - 16, 220, 16, 8); g.fillRect(cx - 16, 205, 8, 20); g.fillRect(cx + 12, 230, 16, 8); g.fillRect(cx + 20, 212, 8, 22); } const cx2 = ((t * 15) % 640) - 60; g.fillStyle = '#5a3a1a'; for (let k = 0; k < 3; k++) { const x = cx2 - k * 40, y = 235; g.fillRect(x, y, 26, 10); g.fillRect(x + 22, y - 12, 6, 14); g.fillRect(x + 2, y + 10, 3, 10); g.fillRect(x + 20, y + 10, 3, 10); g.beginPath(); g.arc(x + 12, y, 7, Math.PI, 0); g.fill(); } }); }
    // pósters con imagen (ilustraciones inventadas de los 2000)
    { const PI2 = (w, h, x, y, z, ry, f) => { const c = Y2K.cnv(384, Math.round(384 * h / w)), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.save(); g.beginPath(); g.rect(10, 10, c.width - 20, c.height - 20); g.clip(); f(g, c.width, c.height); g.restore(); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: Y2K.toTex(c, { color: true }), roughness: 0.55 })); p.position.set(x, y, z); p.rotation.y = ry; R.add(p); return p; };
      const city = (g, W, H) => { const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, '#1a0f4e'); s.addColorStop(0.6, '#ff2fb0'); s.addColorStop(1, '#ffb020'); g.fillStyle = s; g.fillRect(0, 0, W, H); g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(W * 0.7, H * 0.55, 40, 0, TAU); g.fill(); for (let i = 0; i < 18; i++) { const bw = 14 + Math.random() * 26, bh = 60 + Math.random() * H * 0.5, bx = i * (W / 18); g.fillStyle = '#120a2a'; g.fillRect(bx, H - bh, bw, bh); g.fillStyle = 'rgba(255,230,140,.8)'; for (let y = H - bh + 6; y < H - 6; y += 10) for (let x = bx + 3; x < bx + bw - 3; x += 7) if (Math.random() < 0.4) g.fillRect(x, y, 3, 4); } g.fillStyle = '#fff'; g.font = 'italic 900 22px Georgia, serif'; g.fillText('Neo Tokyo 2001', 18, 36); };
      const band = (g, W, H) => { g.fillStyle = '#0a0a14'; g.fillRect(0, 0, W, H); ['#ff2fb0', '#3d8bff', '#b6ff3b'].forEach((c, i) => { const gr = g.createRadialGradient(W * (0.25 + i * 0.25), 0, 5, W * (0.25 + i * 0.25), H * 0.6, H * 0.7); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.globalAlpha = 0.6; g.fillRect(0, 0, W, H); }); g.globalAlpha = 1; g.fillStyle = '#000'; [[0.3, 0.9], [0.5, 1], [0.7, 0.88]].forEach(([fx, k]) => { const x = W * fx, y = H * 0.55; g.beginPath(); g.arc(x, y - 60 * k, 18 * k, 0, TAU); g.fill(); g.fillRect(x - 22 * k, y - 40 * k, 44 * k, 110 * k); g.fillRect(x - 20 * k, y + 70 * k, 15 * k, 80 * k); g.fillRect(x + 5 * k, y + 70 * k, 15 * k, 80 * k); }); g.fillStyle = '#fff'; g.font = '900 30px Impact, Arial Black'; g.textAlign = 'center'; g.fillText('THE CHROME KIDS', W / 2, H - 30); };
      const beach = (g, W, H) => { const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, '#ff7a1f'); s.addColorStop(0.5, '#ffd27a'); s.addColorStop(0.55, '#29b6ff'); s.addColorStop(1, '#0a5aa0'); g.fillStyle = s; g.fillRect(0, 0, W, H); g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(W / 2, H * 0.5, 50, Math.PI, 0); g.fill(); g.strokeStyle = '#2a1a0a'; g.lineWidth = 10; g.beginPath(); g.moveTo(40, H); g.quadraticCurveTo(70, H * 0.6, 60, H * 0.3); g.stroke(); g.fillStyle = '#1a3a12'; for (let k = 0; k < 6; k++) { g.save(); g.translate(60, H * 0.3); g.rotate(k * 1.05); g.beginPath(); g.ellipse(40, 0, 45, 9, 0, 0, TAU); g.fill(); g.restore(); } g.fillStyle = '#1a0a2a'; g.beginPath(); g.arc(W * 0.7, H * 0.62, 10, 0, TAU); g.fill(); g.fillRect(W * 0.7 - 7, H * 0.62 + 8, 14, 34); g.fillRect(W * 0.7 - 30, H * 0.62 + 20, 60, 6); g.fillStyle = '#fff'; g.font = 'italic 700 24px "Brush Script MT", cursive'; g.fillText('Summer Vibes', 20, 40); };
      const space = (g, W, H) => { g.fillStyle = '#05061a'; g.fillRect(0, 0, W, H); for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } const pg = g.createRadialGradient(W * 0.3, H * 0.75, 10, W * 0.3, H * 0.75, 160); pg.addColorStop(0, '#5fc8ff'); pg.addColorStop(1, '#0a2a6a'); g.fillStyle = pg; g.beginPath(); g.arc(W * 0.3, H * 0.95, 170, 0, TAU); g.fill(); g.fillStyle = '#e8ecf4'; g.beginPath(); g.moveTo(W * 0.7, H * 0.2); g.lineTo(W * 0.66, H * 0.42); g.lineTo(W * 0.74, H * 0.42); g.fill(); g.fillStyle = '#ff7a1f'; g.beginPath(); g.moveTo(W * 0.67, H * 0.42); g.lineTo(W * 0.7, H * 0.55); g.lineTo(W * 0.73, H * 0.42); g.fill(); g.fillStyle = '#fff'; g.font = '700 20px "Courier New", monospace'; g.fillText('MISSION 2000', 18, 34); };
      const skate = (g, W, H) => { g.fillStyle = '#b6ff3b'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.beginPath(); g.moveTo(0, H * 0.8); g.quadraticCurveTo(W * 0.2, H * 0.8, W * 0.35, H * 0.45); g.lineTo(W * 0.4, H * 0.45); g.lineTo(W * 0.4, H); g.lineTo(0, H); g.fill(); g.save(); g.translate(W * 0.6, H * 0.35); g.rotate(-0.4); g.fillRect(-50, 40, 100, 8); g.beginPath(); g.arc(0, -50, 14, 0, TAU); g.fill(); g.fillRect(-8, -36, 16, 50); g.fillRect(-30, -30, 60, 8); g.fillRect(-12, 14, 8, 30); g.fillRect(6, 14, 8, 30); g.restore(); g.fillStyle = '#111'; g.font = '900 34px Impact, Arial Black'; g.fillText('GRIND!', 18, 46); };
      const fly = (g, W, H) => { const s = g.createLinearGradient(0, 0, W, H); s.addColorStop(0, '#29b6ff'); s.addColorStop(1, '#c8f0ff'); g.fillStyle = s; g.fillRect(0, 0, W, H); for (let i = 0; i < 12; i++) { const x = Math.random() * W, y = Math.random() * H, r = 10 + Math.random() * 40; const b = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); b.addColorStop(0, 'rgba(255,255,255,.95)'); b.addColorStop(0.6, 'rgba(160,230,255,.25)'); b.addColorStop(1, 'rgba(255,255,255,.7)'); g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } const e = Y2K.cnv(256, 256); G3.drawEmblem(e.getContext('2d'), 256, '#ffffff'); g.drawImage(e, W / 2 - 80, H / 2 - 80, 160, 160); g.fillStyle = '#0a2a6a'; g.font = '700 22px "Trebuchet MS", sans-serif'; g.fillText('fly away · 2002', 18, H - 24); };
      if (false) PI2(5, 7, -RX + 0.06, 6, 34, H2, city); PI2(5, 6.5, -RX + 0.06, 6, -12, H2, band); PI2(6, 4.5, RX - 0.06, 7, 34, -H2, beach); PI2(4.6, 6, RX - 0.06, 6, -14, -H2, space); window.__SKATEP = PI2(4, 5, 12, 6, RZ - 0.06, Math.PI, skate); PI2(5, 5, 26, 7, RZ - 0.06, Math.PI, fly); }

    // máquina de bolas en 3D: gira la manivela y te toca a device al azar
    { const gm = G(44, FY, 8, -0.5); const red = new THREE.MeshPhysicalMaterial({ color: 0xd8121f, roughness: 0.25, clearcoat: 1 }); const base = mesh(rbox(7, 7, 7, 0.6), red); base.position.y = 3.5; gm.add(base); const neck = mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.8, 32), M.chrome); neck.position.y = 7.4; gm.add(neck);
      const globe = mesh(new THREE.SphereGeometry(4.6, 40, 28), new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, transmission: 0.9, roughness: 0.0, thickness: 0.4, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.38, depthWrite: false, envMapIntensity: 2.5, specularIntensity: 1 })); globe.position.y = 12; gm.add(globe); const rim = mesh(new THREE.TorusGeometry(3.6, 0.18, 12, 48).rotateX(H2), M.chrome); rim.position.y = 8.2; gm.add(rim); const plate = mesh(new THREE.BoxGeometry(4.2, 1.6, 0.1), new THREE.MeshStandardMaterial({ map: cnv(256, 96, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#d8121f'; g.font = '900 34px Orbitron, Arial'; g.fillText('UNFIRE', 40, 46); g.fillStyle = '#111'; g.font = '700 18px Michroma, Arial'; g.fillText('100 CÁPSULAS · GIRA', 22, 80); }) })); plate.position.set(0, 5.8, 3.56); gm.add(plate); const cap = mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, TAU, 0, H2), red); cap.position.y = 16.4; gm.add(cap);
      const NB = 36, BI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1 }), NB); const bp = Array.from({ length: NB }, (_, i) => ({ p: V((Math.random() - 0.5) * 6, 8.6 + Math.random() * 3, (Math.random() - 0.5) * 6), v: V(0, 0, 0) })); const cc = new THREE.Color(); for (let i = 0; i < NB; i++) BI.setColorAt(i, cc.setHSL(i / NB, 0.85, 0.55)); gm.add(BI);
      const crank = new THREE.Group(); crank.position.set(0, 3.5, 3.6); gm.add(crank); crank.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 24).rotateX(H2), M.chrome)); const hdl = mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 10).rotateX(H2), new THREE.MeshStandardMaterial({ color: 0xffd21a })); hdl.position.set(0.8, 0, 0.5); crank.add(hdl); plate.position.set(0, 6.0, 3.56);
      const chute = mesh(rbox(2.2, 1.2, 1.2, 0.3), M.blackGloss); chute.position.set(0, 1.0, 3.6); gm.add(chute);
      // bola de salida: dos medias esferas (arriba de color, abajo transparente) que se abren sobre la plataforma
      const ball = new THREE.Group(); ball.visible = false; gm.add(ball); const topM = new THREE.MeshPhysicalMaterial({ color: 0xff2fb0, roughness: 0.15, clearcoat: 1 }), botM = new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, transmission: 0.8, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 });
      const bTop = mesh(new THREE.SphereGeometry(1.6, 28, 14, 0, TAU, 0, H2), topM), bBot = mesh(new THREE.SphereGeometry(1.6, 28, 14, 0, TAU, H2, H2), botM); const hinge0 = new THREE.Group(); hinge0.position.set(0, 0, -1.6); ball.add(hinge0); bTop.position.set(0, 0, 1.6); hinge0.add(bTop); ball.add(bBot);
      const PED = V(0, 2.1, 10); let dev = null, devT = 0, devTg = 0, devS = 0, phase = 'idle', ph = 0, queued = false, ped = mesh(new THREE.CylinderGeometry(3, 3.4, 2, 64), [new THREE.MeshPhysicalMaterial({ color: 0xd8dee8, metalness: 1, roughness: 0.18, clearcoat: 1 }), new THREE.MeshPhysicalMaterial({ map: cnv(512, 512, (g) => { const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#dff3ff'); gr.addColorStop(1, '#8fd0ff'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#1d4fd8'; g.lineWidth = 10; for (const r of [230, 200]) { g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke(); } g.lineWidth = 3; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; g.beginPath(); g.moveTo(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200); g.lineTo(256 + Math.cos(a) * 230, 256 + Math.sin(a) * 230); g.stroke(); } g.fillStyle = '#1d4fd8'; g.font = '900 54px Orbitron, Arial'; g.textAlign = 'center'; g.fillText('UNFIRE', 256, 120); g.font = '700 24px Michroma, Arial'; g.fillText('PLATAFORMA DE PREMIO', 256, 420); }), roughness: 0.15, clearcoat: 1 }), new THREE.MeshPhysicalMaterial({ color: 0x1a1d26, roughness: 0.3 })]); ped.position.set(0, 1, 10); gm.add(ped); ped.geometry.groups.forEach((gp, i) => (gp.materialIndex = i));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 10, 64), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false, transparent: true, opacity: 0.0 })); ring.rotation.x = H2; ring.position.set(0, 2.05, 10); gm.add(ring);
      const GACHA_DIRECT_RANGE = 20; let directGacha = false;
      const wp = new THREE.Vector3(); const track = (p) => { if (directGacha) { R.userData.camTrack = null; ROAMS.tgt = null; return; } gm.localToWorld(wp.copy(p)); R.userData.camTrack = wp.clone(); };
      const spawn = () => { try { const i = Math.floor(Math.random() * PLUGINS.list.length), spec = PLUGINS.list[i]; dev = (spec.g3 ? GEAR3 : GEAR4).build(spec, kindOf(spec), Object.keys(ENGINES.PARAMS[spec.engine]).slice(0, 4).map((k) => k.toUpperCase())); dev.root.position.copy(PED); dev.root.scale.setScalar(0.01); gm.add(dev.root); R.userData.camTrackDir = gm.localToWorld(V(0, 0, 1)).sub(gm.localToWorld(V(0, 0, 0))).normalize(); dev.spec = spec; devT = 0; devTg = 2.2; devS = 0; try { window.UEV('gacha'); } catch (e) {} dev.root.rotation.y = 0.5; say('🎰 You got ' + (spec.name || 'a device') + '! · tap it to see it again'); hap(0.4); } catch (e) { console.warn(e); } };
      const go = () => { if (phase !== 'idle' && phase !== 'show') { queued = true; return; } directGacha = !!ROAMS.on && nearRoomObject(ROAMS.p, gm, GACHA_DIRECT_RANGE); if (directGacha) { R.userData.camTrack = null; ROAMS.tgt = null; } hap(0.6); R.userData.camTrackDir = gm.localToWorld(V(0, 0, 1)).sub(gm.localToWorld(V(0, 0, 0))).normalize(); if (dev) { phase = 'close'; ph = 0; } else { phase = 'spin'; ph = 0; } };
      picks.push({ o: gm, f: go, noFocusWithin: GACHA_DIRECT_RANGE }); R.userData.gacha = go; picks.push({ o: ped, f: () => { if (dev && phase === 'show') { devTg = 0; setTimeout(() => (devTg = 2.2), 1400); hap(0.3); } } });
      anim.push((dt, t) => { ph += dt;
        if (phase === 'close') { devTg = 0; track(PED); if (devT < 0.05) { devS = Math.max(0, devS - dt * 1.4); dev.root.position.y = PED.y - (1 - devS) * 2; dev.root.scale.setScalar(Math.max(0.01, devS) * 1.1); if (devS <= 0) { gm.remove(dev.root); dev = null; phase = 'spin'; ph = 0; } } }
        else if (phase === 'spin') { crank.rotation.z -= dt * 8; track(V(0, 6, 3.6)); if (ph > 1.4) { phase = 'roll'; ph = 0; ball.visible = true; ball.userData.popped = 0; ball.scale.setScalar(1); hinge0.rotation.x = 0; topM.color.setHSL(Math.random(), 0.85, 0.55); } }
        else if (phase === 'roll') { const k = Math.min(1, ph / 1.35); const z = 4.3 + k * 5.7, y = 1.0 + (PED.y + 1.6 - 1.0) * k + Math.sin(k * Math.PI) * 7.5; ball.position.set(0, y, z); ball.rotation.x += dt * 12 * (1 - k); track(V(0, 4.5, 8)); if (k > 0.62 && !ball.userData.popped) { ball.userData.popped = 1; ring.material.opacity = 1; ring.position.set(0, y - 1, z); ring.scale.setScalar(0.4); hap(0.7); try { if (audioOk()) { const c = UA.ctx, n = c.currentTime, o = c.createOscillator(), gg = c.createGain(), f = c.createBiquadFilter(); o.type = 'triangle'; o.frequency.setValueAtTime(220, n); o.frequency.exponentialRampToValueAtTime(880, n + 0.18); f.type = 'lowpass'; f.frequency.value = 2500; gg.gain.setValueAtTime(0.0001, n); gg.gain.exponentialRampToValueAtTime(0.05, n + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, n + 0.35); o.connect(f).connect(gg).connect(UA.bus.master); o.start(n); o.stop(n + 0.4); } } catch (e) {} if (!dev) spawn(); } if (ball.userData.popped) { hinge0.rotation.x = -Math.min(1, (k - 0.62) / 0.2) * 2.3; ring.scale.setScalar(ring.scale.x + dt * 6); if (dev) dev.root.position.set(0, Math.max(PED.y, y - 0.4), z); } if (k >= 1) { phase = 'open'; ph = 0; ring.position.set(0, 2.05, 10); ring.scale.setScalar(1); } }
        else if (phase === 'open') { track(V(0, 4.2, 9)); ball.position.y -= dt * 7; ball.scale.setScalar(Math.max(0.01, 1 - ph * 1.4)); if (ph > 0.75) { ball.visible = false; ball.scale.setScalar(1); ball.userData.popped = 0; phase = 'show'; ph = 0; } }
        else if (phase === 'show') { if (ph > 6) R.userData.camTrack = null; if (queued) { queued = false; go(); } }
        if (phase !== 'show' && phase !== 'close' && phase !== 'spin' && phase !== 'roll' && phase !== 'open') R.userData.camTrack = null;
        ring.material.opacity *= 0.985;
        bp.forEach((b, i) => { b.v.add(V(Math.sin(t * 1.3 + i) * 9 * dt, (Math.random() < 0.02 ? 30 : 0) * dt * 10, Math.cos(t * 1.1 + i) * 9 * dt)); if (phase === 'spin') b.v.add(V((Math.random() - 0.5) * 30 * dt, Math.random() * 40 * dt, (Math.random() - 0.5) * 30 * dt)); b.v.y -= 25 * dt; b.p.addScaledVector(b.v, dt); const c = V(0, 12, 0), d0 = b.p.clone().sub(c), L0 = d0.length(); if (L0 > 3.7) { d0.normalize(); b.p.copy(c).addScaledVector(d0, 3.7); const vn = b.v.dot(d0); if (vn > 0) b.v.addScaledVector(d0, -1.5 * vn); b.v.multiplyScalar(0.9); } BI.setMatrixAt(i, new THREE.Matrix4().makeTranslation(b.p.x, b.p.y, b.p.z)); }); BI.instanceMatrix.needsUpdate = true;
        if (dev) { if (phase !== 'close' || devT > 0.05) devS = Math.min(1, devS + dt * (phase === 'roll' ? 2.2 : 0.9)); dev.root.scale.setScalar(Math.max(0.01, devS) * 1.1); if (phase !== 'close' && phase !== 'roll') dev.root.position.copy(PED); devT += clamp(devTg - devT, -dt * 0.9, dt * 0.35); dev.update(devT, dt, { level: 0.3 }); if (devT > 2.15 && devTg > 2) dev.root.rotation.y += dt * 0.35; } }); }

    // puerta grande al exterior (donde estaba el skatepark): se abre en 3D y sales al jardín con el sonido atmosférico
    { const dg = G(-30, FY, RZ - 0.2, Math.PI); const fr = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 }); for (const [w, h, x, y] of [[9.4, 0.6, 0, 16.3], [0.6, 16.6, -4.4, 8.3], [0.6, 16.6, 4.4, 8.3]]) { const b = mesh(new THREE.BoxGeometry(w, h, 0.8), fr); b.position.set(x, y, 0); dg.add(b); }
      const hinge = new THREE.Group(); hinge.position.set(-4.1, 0, 0.1); dg.add(hinge); const leaf = mesh(rbox(8.2, 16, 0.4, 0.1), new THREE.MeshStandardMaterial({ map: cnv(256, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#5fc8ff'); gr.addColorStop(1, '#1d4fd8'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(30, 30, 196, 200); g.fillRect(30, 270, 196, 210); g.fillStyle = '#fff'; g.font = '900 30px Orbitron, Arial'; g.textAlign = 'center'; g.fillText('SALIDA', 128, 140); g.font = '700 16px Michroma, Arial'; g.fillText('AL EXTERIOR', 128, 170); g.fillText('🔊 3D SOUND', 128, 360); }), roughness: 0.4 })); leaf.position.set(4.1, 8, 0); hinge.add(leaf);
      // Exterior face ONLY: keep the original SALIDA / AL EXTERIOR lettering inside.
      // The panel follows the moving leaf and faces local -Z (outside after dg rotation).
      const outsideName = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.35),
        new THREE.MeshBasicMaterial({ map:cnv(512,512,(g)=>{
          const bg=g.createLinearGradient(0,0,0,512);
          bg.addColorStop(0,'#5fc8ff');bg.addColorStop(1,'#1d4fd8');
          g.fillStyle=bg;g.fillRect(0,0,512,512);
          g.strokeStyle='rgba(255,255,255,.42)';g.lineWidth=12;g.strokeRect(12,12,488,488);
          g.fillStyle='#fff';g.textAlign='center';g.shadowColor='rgba(8,28,88,.7)';g.shadowBlur=9;
          g.font='900 82px Orbitron, Arial';g.fillText('Unfire',256,215);
          g.font='900 88px Orbitron, Arial';g.fillText('Robots',256,326);
        }), toneMapped:false, side:THREE.FrontSide }));
      outsideName.position.set(0,3.8,-0.235);
      outsideName.rotation.y=Math.PI;
      leaf.add(outsideName);
      const kn = mesh(new THREE.SphereGeometry(0.35, 16, 12), M.chrome); kn.position.set(7.4, 8, 0.4); hinge.add(kn);
      let open0 = 0, tgt0 = 0, man = 0; picks.push({ o: dg, noFocus: true, f: () => { if (!window.__OUT_OPEN) { hap(0.4); say('🔒 The island is not unlocked yet. Get ready!'); return; } man = man ? 0 : 1; hap(0.6); say(man ? '🚪 Door open · walk outside' : '🚪 Door closed'); } }); const dwp = new THREE.Vector3(); anim.push((dt) => { dg.getWorldPosition(dwp); const near = window.__OUT_OPEN && window.__roam && S.camera.position.distanceTo(dwp) < 22; tgt0 = window.__OUT_OPEN && (man || near) ? 1 : 0; open0 += (tgt0 - open0) * Math.min(1, dt * 3); hinge.rotation.y = -open0 * 1.75; }); }
    // panel del tiempo en la pared (junto a la bola de discoteca): sol, nubes, lluvia, rayos, nieve
    { const wp = G(WXp(), FY + 15, -15.7, 0); const ic = (txt, bg) => cnv(128, 128, (g) => { const gr = g.createRadialGradient(64, 54, 6, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(1, bg); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.font = '64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 70); });
      const back = mesh(rbox(16, 4.4, 0.3, 0.6), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0.2, clearcoat: 1 })); wp.add(back); const lbl = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ map: cnv(512, 64, (g) => { g.fillStyle = '#0a2a6a'; g.font = '900 34px Orbitron, Arial'; g.textAlign = 'center'; g.fillText('TIME · CHOOSE ONE', 256, 46); }), transparent: true })); lbl.position.set(0, 2.9, 0.2); wp.add(lbl);
      [['☀️', '#ffd21a', 'sol'], ['☁️', '#9fd0ff', 'nubes'], ['🌧️', '#3d8bff', 'lluvia'], ['⛈️', '#7a5cff', 'rayos'], ['❄️', '#dff6ff', 'nieve']].forEach(([e, c, k], i) => { const b = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ map: ic(e, c), transparent: true, toneMapped: false })); b.position.set(-6 + i * 3, 0, 0.2); wp.add(b); picks.push({ o: b, noFocus: true, f: () => { WEATHER.set(k); window.__WMAN = true; hap(0.4); say('🌦️ Tiempo: ' + k); } }); });
      // mantener tiempo: si está en NO, al salir fuera vuelve el tiempo automático del día
      let keep = false; const kc = document.createElement('canvas'); kc.width = 512; kc.height = 80; const kt = new THREE.CanvasTexture(kc); const drawK = () => { const g = kc.getContext('2d'); g.clearRect(0, 0, 512, 80); g.fillStyle = keep ? '#2bd96b' : '#3a4a6a'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 504, 72, 36) : g.rect(4, 4, 504, 72); g.fill(); g.fillStyle = '#fff'; g.font = '900 30px Orbitron, Arial'; g.textAlign = 'center'; g.fillText(keep ? '🔒 KEEP TIME: YES' : '🔓 KEEP TIME: NO', 256, 52); kt.needsUpdate = true; }; drawK();
      const kb = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), new THREE.MeshBasicMaterial({ map: kt, transparent: true, toneMapped: false })); kb.position.set(0, -3.1, 0.2); wp.add(kb); picks.push({ o: kb, noFocus: true, f: () => { keep = !keep; drawK(); hap(0.3); } });
      let wasOut = false; anim.push(() => { const o = !!window.ATM_OUT; if (o && !wasOut && !keep && window.__WMAN) { window.__WMAN = false; const W0 = window.__WEATHER || {}; WEATHER.set(W0.snow ? 'nieve' : W0.rain === 2 ? 'rayos' : W0.rain ? 'lluvia' : W0.gray > 0.25 ? 'nubes' : 'sol'); } wasOut = o; }); }
    // partículas del tiempo: caen fuera y sobre la cúpula (nunca dentro de casa)
    const WEATHER = (() => { const N = window.__LOWDEV ? 450 : 850, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3); const reset = (i) => { const out = Math.random() < 0.5; p[i * 3] = (Math.random() - 0.5) * (out ? 260 : 2 * RX); p[i * 3 + 1] = (out ? FY : CY + 14) + Math.random() * 60; p[i * 3 + 2] = out ? -20 - Math.random() * 160 : (Math.random() - 0.5) * 2 * RZ; }; for (let i = 0; i < N; i++) reset(i); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false }); const pts = new THREE.Points(g, mat); pts.visible = false; pts.frustumCulled = false; R.add(pts); let mode = 'sol', thT = 4;
      anim.push((dt) => { if (!pts.visible) return; const sp = mode === 'nieve' ? 4 : 45; for (let i = 0; i < N; i++) { p[i * 3 + 1] -= dt * sp; if (mode === 'nieve') p[i * 3] += Math.sin(i + p[i * 3 + 1] * 0.2) * dt * 1.5; const floorY = Math.abs(p[i * 3]) < RX && p[i * 3 + 2] > -16 && p[i * 3 + 2] < RZ ? CY + 14 : FY; if (p[i * 3 + 1] < floorY) { reset(i); p[i * 3 + 1] = floorY + 60; } } g.attributes.position.needsUpdate = true; if (mode === 'rayos') { thT -= dt; if (thT < 0) { thT = 4 + Math.random() * 8; try { ATM.thunder(); } catch (e) {} } } });
      return { set(k) { mode = k; pts.visible = k === 'lluvia' || k === 'rayos' || k === 'nieve'; mat.size = k === 'nieve' ? 0.34 : 0.25; mat.map = k === 'nieve' ? (window.__UNFIRE_SNOW_TEXTURE || null) : null; mat.opacity = k === 'nieve' ? 0.78 : 0.85; mat.alphaTest = k === 'nieve' ? 0.02 : 0; mat.needsUpdate = true; mat.color.set(k === 'nieve' ? 0xe9f5ff : 0xbfe6ff); window.__UNFIRE_WEATHER_MODE = k; try { ATM.rain(k === 'lluvia' || k === 'rayos'); } catch (e) {} if (k === 'rayos') thT = 1; R.userData.cloudy = k !== 'sol'; } }; })();
    // pósters de memes de los 2000 (originales), desordenados por las paredes
    if (false) { const MM = [['LOL', '#ffd21a'], ['brb', '#3d8bff'], ['A/S/L?', '#ff2fb0'], ['ERROR 404', '#111'], ['OMG!!1', '#2bd96b'], ['Y2K BUG', '#ff7a1f'], ['56k ❤', '#c08bff'], ['ROFL', '#ff2a4a'], ['n00b', '#5fc8ff'], ['SHARE THIS WITH FRIENDS!', '#ffe066']]; MM.forEach(([tx, c], i) => { const w = 3 + (i % 3), h = 3 + ((i * 7) % 3); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: cnv(256, Math.round(256 * h / w), (g, W, H) => { g.fillStyle = c; g.fillRect(0, 0, W, H); g.fillStyle = c === '#111' ? '#b6ff3b' : '#fff'; g.strokeStyle = '#000'; g.lineWidth = 6; g.font = `900 ${Math.min(80, 600 / tx.length)}px Impact, Arial Black`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(tx, W / 2, H / 2); g.fillText(tx, W / 2, H / 2); }), roughness: 0.6 })); const side = i % 2 ? 1 : -1; p.position.set(side * (RX - 0.08), 2 + (i % 4) * 3.4, -6 + i * 6.5); p.rotation.set(0, -side * H2, (i % 3 - 1) * 0.12); R.add(p); }); }
    // tienda UNFIRE: mostrador con cajas de producto
    { const sh = G(-RX + 12, FY, 55, H2 * 0.4); const cnt = mesh(rbox(14, 6, 4, 0.4), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 })); cnt.position.y = 3; sh.add(cnt); const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: cnv(512, 110, (g) => { const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#ff2fb0'); gr.addColorStop(1, '#3d8bff'); g.fillStyle = gr; g.fillRect(0, 0, 512, 110); g.fillStyle = '#fff'; g.font = '900 54px Orbitron, Arial'; g.textAlign = 'center'; g.fillText('TIENDA UNFIRE', 256, 74); }), toneMapped: false })); sign.position.set(0, 14, -1.5); sh.add(sign); const pole = mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 8), M.chrome); pole.position.set(0, 10, -1.6); sh.add(pole);
      [['HYPERWAVE 2000', '#1d4fd8', 'hyper'], ['FX20', '#ff2fb0', 'fx20'], ['ARCHER', '#2bd96b', 'archer'], ['CLUB', '#ffd21a', 'club']].filter(() => !window.UNFIRE_APP).forEach(([n, c, k], i) => { const bx = mesh(rbox(2.6, 3.4, 1.4, 0.15), new THREE.MeshStandardMaterial({ map: cnv(128, 168, (g) => { g.fillStyle = c; g.fillRect(0, 0, 128, 168); g.fillStyle = '#fff'; g.font = '900 16px Orbitron, Arial'; g.textAlign = 'center'; g.fillText(n, 64, 90); g.font = '700 10px Michroma, Arial'; g.fillText('UNFIRE AUDIO', 64, 150); }), roughness: 0.35 })); bx.position.set(-4.5 + i * 3, 7.7, 0); sh.add(bx); picks.push({ o: bx, f: () => { hap(0.4); if (k === 'archer') { parentPost({ open: 'archer' }); say('🛍️ ARCHER está disponible en App Store'); } else { parentPost({ buy: k }); say('🛍️ ' + n + ' added to your bag'); } } }); }); }

    // collage de pósters por todas las paredes (inventados, cada uno distinto), dejando libres ventanas, puerta y paneles
    if (false) { let sd = 3; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const NAMES = ['NEON RIOT', 'PIXEL PRINCESS', 'BASS QUAKE', 'SKY RACERS', 'CHROME HEART', 'TURBO KIDS', 'DISCO 3000', 'MOON CREW', 'HYPER CITY', 'LASER LOVE', 'GLITCH GANG', 'SUGAR RUSH', 'VELVET VOLT', 'DRAGON FM', 'ORBIT 7', 'SUNSET MIX', 'MEGA BEATS', 'CYBER SURF', 'JELLY POP', 'NIGHT DRIVE'], FONTS = ['Impact, Arial Black', 'Georgia, serif', '"Comic Sans MS", cursive', '"Trebuchet MS"', '"Courier New", monospace', 'Orbitron, Arial', 'Michroma, Arial', '"Brush Script MT", cursive'];
      const draw = (g, W, H, i) => { const h1 = rr(), h2 = (h1 + 0.3 + rr() * 0.4) % 1; const gr = g.createLinearGradient(0, 0, W * rr(), H); gr.addColorStop(0, `hsl(${h1 * 360},80%,${40 + rr() * 25}%)`); gr.addColorStop(1, `hsl(${h2 * 360},80%,${20 + rr() * 30}%)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); const k = i % 5; g.globalAlpha = 0.85;
        if (k === 0) { g.fillStyle = `hsl(${h2 * 360},90%,70%)`; g.beginPath(); g.arc(W / 2, H * 0.45, W * 0.3, 0, TAU); g.fill(); for (let y = H * 0.45; y < H * 0.75; y += 10) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, W, 4); } }
        else if (k === 1) { g.fillStyle = '#111'; for (let x = 0; x < W; x += 24) { const hh = 40 + rr() * H * 0.4; g.fillRect(x, H * 0.75 - hh, 20, hh); } }
        else if (k === 2) { for (let r = W * 0.6; r > 10; r -= 18) { g.strokeStyle = `hsla(${(h1 * 360 + r) % 360},90%,60%,.8)`; g.lineWidth = 8; g.beginPath(); g.arc(W / 2, H / 2, r, 0, TAU); g.stroke(); } }
        else if (k === 3) { g.fillStyle = '#fff'; for (let n = 0; n < 3; n++) { const x = W * (0.25 + n * 0.25), y = H * 0.55; g.beginPath(); g.arc(x, y - 40, 14, 0, TAU); g.fill(); g.fillRect(x - 12, y - 26, 24, 50); } }
        else { g.fillStyle = `hsl(${h2 * 360},90%,65%)`; g.beginPath(); for (let n = 0; n < 16; n++) { const a = n / 16 * TAU, rr2 = n % 2 ? W * 0.18 : W * 0.38; g.lineTo(W / 2 + Math.cos(a) * rr2, H * 0.45 + Math.sin(a) * rr2); } g.fill(); }
        g.globalAlpha = 1; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.textAlign = 'center'; g.font = `900 ${W / 8}px ${FONTS[i % FONTS.length]}`; const nm = NAMES[i % NAMES.length]; g.strokeText(nm, W / 2, H * 0.88); g.fillText(nm, W / 2, H * 0.88); g.fillStyle = 'rgba(255,255,255,.12)'; for (let n = 0; n < 200; n++) g.fillRect(rr() * W, rr() * H, 2, 2); g.fillStyle = 'rgba(80,60,30,.12)'; g.fillRect(0, 0, W, H); };
      const free = (side, a, y) => { if (side === 'L' || side === 'R') { if (a > 13 && a < 31 && y < 12) return false; if (side === 'R' && a > -9 && a < 9 && y > 2 && y < 8) return false; } if (side === 'F') { if (a > -35.5 && a < -24.5 && y < 9) return false; if (a > 21 && a < 39 && y < 12) return false; } return true; };
      let i = 0; for (const side of ['L', 'R', 'F']) { const span = side === 'F' ? [-RX + 4, RX - 4] : [-12, RZ - 4]; for (let a = span[0]; a < span[1]; a += 5.2 + rr() * 1.5) for (let y = FY + 4; y < CY - 3; y += 5.5 + rr() * 1.2) { const yy = y + (rr() - 0.5) * 1.2; if (!free(side, a, yy - FY - 0)) { continue; } if (rr() < 0.68) continue; const w = 2.4 + rr() * rr() * 7, h = w * (0.7 + rr() * 0.8); const tex = cnv(192, Math.round(192 * h / w), (g, W, H) => draw(g, W, H, i)); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 })); const off = 0.04 + (i % 3) * 0.01; if (side === 'L') { p.position.set(-RX + off, yy, a); p.rotation.y = H2; } else if (side === 'R') { p.position.set(RX - off, yy, a); p.rotation.y = -H2; } else { p.position.set(a, yy, RZ - off); p.rotation.y = Math.PI; } p.rotation.z = (rr() - 0.5) * 0.18; R.add(p); i++; } } }

    // decoración de pared variada: tabla de surf, cuadros enmarcados con fotos reales de dominio público (NASA, vía Wikimedia) y un disco de oro
    if (false) { const surf = new THREE.Group(); surf.position.set(-RX + 0.5, FY + 13, 40); surf.rotation.set(0, H2, 0.35); R.add(surf); const sb = mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshPhysicalMaterial({ map: cnv(128, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#5fc8ff'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#ff7a1f'); g.fillStyle = gr; g.fillRect(0, 0, 128, 512); g.fillStyle = '#111'; g.fillRect(60, 0, 8, 512); g.fillStyle = '#ff2fb0'; g.font = '900 28px Impact'; g.save(); g.translate(40, 300); g.rotate(-H2); g.fillText('SURF 2000', 0, 0); g.restore(); }), roughness: 0.2, clearcoat: 1 })); sb.scale.set(1.6, 7, 0.25); surf.add(sb);
      const frame = (x, y, z, ry, w, h, url, alt) => { const g0 = new THREE.Group(); g0.position.set(x, y, z); g0.rotation.y = ry; R.add(g0); const fr = mesh(new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.3), new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: 0.3, clearcoat: 1 })); g0.add(fr); const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, map: cnv(256, Math.round(256 * h / w), (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0a1030'); gr.addColorStop(1, '#203a7a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '700 14px Georgia'; g.textAlign = 'center'; g.fillText(alt, W / 2, H / 2); }) }); const ph = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm); ph.position.z = 0.16; g0.add(ph); try { const L = new THREE.TextureLoader(); L.setCrossOrigin('anonymous'); L.load(url, (t) => { t.encoding = THREE.sRGBEncoding; pm.map = t; pm.needsUpdate = true; }, undefined, () => {}); } catch (e) {} const lb = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 0.6), new THREE.MeshBasicMaterial({ map: cnv(256, 32, (g) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#222'; g.font = '700 14px Georgia'; g.textAlign = 'center'; g.fillText(alt, 128, 22); }) })); lb.position.set(0, -h / 2 - 0.9, 0.05); g0.add(lb); };
      const RI = (f) => IMG + 'real/' + f; frame(-RX + 0.2, FY + 15, 8, H2, 9, 6, RI('p_earth.jpg'), 'La Tierra desde la ISS · NASA'); frame(RX - 0.2, FY + 15, 46, -H2, 7, 8.3, RI('p_mars.jpg'), 'Curiosity en Marte · NASA'); frame(0, FY + 18, RZ - 0.2, Math.PI, 9, 9, RI('p_crab.jpg'), 'Nebulosa del Cangrejo · NASA'); frame(-RX + 0.2, FY + 9, 46, H2, 10, 6.9, RI('p_nyc.jpg'), 'Nueva York de noche · desde la ISS'); frame(RX - 0.2, FY + 9, 0 - 26, -H2, 6, 9, RI('p_shuttle.jpg'), 'Discovery · última misión 2011'); frame(-8, FY + 16, -15.7, 0, 7, 7, RI('p_andromeda.jpg'), 'Galaxia de Andrómeda'); frame(26, FY + 9, RZ - 0.2, Math.PI, 7, 9, RI('p_jupiter.jpg'), 'Júpiter · misión Juno'); frame(-RX + 0.2, FY + 18, 28, H2, 9, 4.6, RI('p_lagoon.jpg'), 'Nebulosa de la Laguna · Hubble'); frame(RX - 0.2, FY + 18, 20, -H2, 9, 6, RI('p_aurora2.jpg'), 'Aurora boreal · Florida 2025');
      const gold = new THREE.Group(); gold.position.set(12, FY + 12, RZ - 0.2); gold.rotation.y = Math.PI; R.add(gold); gold.add(mesh(new THREE.BoxGeometry(5, 6.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111 }))); const disc = mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.05, 48).rotateX(H2), new THREE.MeshPhysicalMaterial({ color: 0xffd21a, metalness: 1, roughness: 0.15 })); disc.position.set(0, 0.6, 0.2); gold.add(disc); const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), new THREE.MeshBasicMaterial({ map: cnv(256, 56, (g) => { g.fillStyle = '#c9a227'; g.fillRect(0, 0, 256, 56); g.fillStyle = '#111'; g.font = '700 16px Georgia'; g.textAlign = 'center'; g.fillText('DISCO DE ORO · UNFIRE 2001', 128, 34); }) })); pl.position.set(0, -2.3, 0.17); gold.add(pl); }
    // zona DJ: mesa con dos platos y mezclador, altavoces de torre
    { const dj = G(38, FY, 44, Math.PI * 0.85); const tb = mesh(rbox(12, 0.5, 4.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.4, metalness: 0.5 })); tb.position.y = 7.2; dj.add(tb); for (const sx of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.5, 7, 4), new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.5 })); l.position.set(sx * 5.6, 3.5, 0); dj.add(l); }
      const decks = [-3.4, 3.4].map((x, i) => { const d = new THREE.Group(); d.position.set(x, 7.5, 0); dj.add(d); d.add(mesh(rbox(3.6, 0.5, 3.2, 0.1), new THREE.MeshStandardMaterial({ color: 0xb8bfcc, metalness: 0.8, roughness: 0.3 }))); const pl = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.2 })); pl.position.y = 0.3; d.add(pl); const lb = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 32), new THREE.MeshStandardMaterial({ color: [0xff2fb0, 0x3d8bff][i] })); lb.position.y = 0.31; d.add(lb); picks.push({ o: d, f: () => { d.userData.sc = 1; DJP.open(); } }); return { pl, lb, d }; });
      const mx = mesh(rbox(2.4, 0.6, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.4 })); mx.position.set(0, 7.6, 0); dj.add(mx); const fad = []; for (let k = 0; k < 4; k++) { const f = mesh(new THREE.BoxGeometry(0.25, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: [0xff2fb0, 0x3d8bff, 0xb6ff3b, 0xffd21a][k] })); f.position.set(-0.75 + k * 0.5, 7.95, 0); dj.add(f); fad.push(f); }
      for (const sx of [-1, 1]) { const sp = mesh(rbox(3, 12, 3, 0.2), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 })); sp.position.set(sx * 9, 6, 0); dj.add(sp); for (const y of [3, 7, 10.5]) { const c = mesh(new THREE.CylinderGeometry(y === 10.5 ? 0.5 : 1.1, y === 10.5 ? 0.5 : 1.1, 0.15, 24).rotateX(H2), M.chrome); c.position.set(sx * 9, y, 1.55); dj.add(c); c.userData.y = y; fad.push(c); } }
      anim.push((dt, t, lv) => { decks.forEach((D) => { const sc = D.d.userData.sc || 0; D.pl.rotation.y -= dt * (RADIO.st.on ? 3.5 : 0) - (sc > 0 ? dt * 20 : 0); D.lb.rotation.y = D.pl.rotation.y; D.d.userData.sc = Math.max(0, sc - dt * 2); }); const dl2 = window.__djOn ? lv : 0; fad.forEach((f, k) => { if (f.userData.y) f.scale.setScalar(1 + dl2 * 0.25); else f.position.z = Math.sin(t * 1.5 + k) * 0.6 * (RADIO.st.on ? 1 : 0.2); }); }); }
    // salón 2000: sofá en L, mesa baja de cristal, tele grande con consola, plantas y pufs
    { const lv0 = G(-38, FY, 40, 0); const leather = new THREE.MeshPhysicalMaterial({ color: 0x2a3c8a, roughness: 0.45, clearcoat: 0.5 }); const s1 = mesh(rbox(14, 3, 5, 0.6), leather); s1.position.set(0, 1.5, 6); lv0.add(s1); const bk = mesh(rbox(14, 4, 1.4, 0.5), leather); bk.position.set(0, 3.8, 8); lv0.add(bk); const s2 = mesh(rbox(5, 3, 9, 0.6), leather); s2.position.set(-7, 1.5, 1.5); lv0.add(s2); const bk2 = mesh(rbox(1.4, 4, 9, 0.5), leather); bk2.position.set(-9, 3.8, 1.5); lv0.add(bk2); for (let k = 0; k < 4; k++) { const c = mesh(rbox(2.6, 2.4, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: [0xff2fb0, 0xffd21a, 0x3d8bff, 0xb6ff3b][k], roughness: 0.9 })); c.position.set(-4 + k * 3, 4, 7); c.rotation.x = -0.25; lv0.add(c); }
      const ct = mesh(rbox(7, 0.25, 4, 0.2), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transmission: 0.8, roughness: 0.03, transparent: true, opacity: 0.6 })); ct.position.set(1, 2.2, 0); lv0.add(ct); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lg = mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.1, 8), M.chrome); lg.position.set(1 + sx * 3, 1.05, sz * 1.7); lv0.add(lg); }
      const tvs = G(-38, FY, 27, 0); const st2 = mesh(rbox(10, 3, 3.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.5 })); st2.position.y = 1.5; tvs.add(st2); const big = mesh(rbox(8, 6.4, 5.5, 0.6), new THREE.MeshPhysicalMaterial({ color: 0x2a2d36, roughness: 0.35, clearcoat: 0.6 })); big.position.y = 6.2; tvs.add(big); const bc = Y2K.cnv(320, 240), bg2 = bc.getContext('2d'), bt = Y2K.toTex(bc, { color: true }); const bs = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5), new THREE.MeshBasicMaterial({ map: bt, toneMapped: false })); bs.position.set(0, 6.3, 2.78); tvs.add(bs); const cs2 = mesh(rbox(3, 0.7, 2.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 0.4 })); cs2.position.set(3, 3.35, 0); tvs.add(cs2);
      let bt0 = 0, pl0 = 0; anim.push((dt, t) => { if (!window.__roam) return; bt0 -= dt; if (bt0 > 0) return; bt0 = 0.1; const g = bg2; const sk = g.createLinearGradient(0, 0, 0, 240); sk.addColorStop(0, '#2a6dff'); sk.addColorStop(1, '#9fd8ff'); g.fillStyle = sk; g.fillRect(0, 0, 320, 240); g.fillStyle = '#2bd96b'; g.fillRect(0, 190, 320, 50); pl0 = (pl0 + 4) % 360; g.fillStyle = '#ff2a4a'; g.fillRect(pl0 - 20, 170 - Math.abs(Math.sin(t * 4)) * 30, 16, 20); for (let k = 0; k < 4; k++) { g.fillStyle = '#ffd21a'; g.fillRect(((k * 90 - t * 60) % 360 + 360) % 360 - 20, 120, 10, 10); } g.fillStyle = '#fff'; g.font = '700 16px "Share Tech Mono", monospace'; g.fillText('1P 004200', 10, 22); bt.needsUpdate = true; });
      const potM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 }), leafM = new THREE.MeshPhysicalMaterial({ color: 0x3be35a, roughness: 0.3, clearcoat: 0.6 }); [[-58, 58], [-14, 54], [58, 22], [62, -8], [-60, -8], [14, 58]].forEach(([x, z]) => { const p = G(x, FY, z); const pot = mesh(new THREE.CylinderGeometry(1.4, 1.0, 2.4, 24), potM); pot.position.y = 1.2; p.add(pot); for (let k = 0; k < 5; k++) { const lf = mesh(new THREE.SphereGeometry(1.2, 16, 12), leafM); lf.scale.set(0.5, 1.6, 0.5); const a = k / 5 * TAU; lf.position.set(Math.cos(a) * 0.7, 4, Math.sin(a) * 0.7); lf.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); p.add(lf); } });
      [[-14, 30, 0xffd21a], [10, 34, 0x3d8bff], [30, -2, 0xb6ff3b]].forEach(([x, z, c]) => { const b = mesh(new THREE.SphereGeometry(2.4, 28, 18), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 })); b.scale.set(1, 0.6, 1); b.position.set(x, FY + 1.4, z); R.add(b); });
      const rug2 = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ map: cnv(256, 256, (g) => { g.fillStyle = '#ff7a1f'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 8; k++) { g.strokeStyle = k % 2 ? '#ffd21a' : '#ff2fb0'; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 16 + k * 14, 0, TAU); g.stroke(); } }), roughness: 1 })); rug2.rotation.x = -H2; rug2.position.set(-36, FY + 0.03, 36); R.add(rug2); }
    // fuera: robots gigantes paseando, ballenas voladoras y barcos en el lago
    try { const OUTG = new THREE.Group(); OUTG.userData.noCollide = true; R.add(OUTG); const giants = window.__OUTGIANTS = [3, 8].map((k, i) => { const r0 = ROBOT.build(MUTANTS.list[k % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar((i ? 70 : 26) / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; w.position.set(-60 + i * 50, FY - 0.1, -90 - i * 8); OUTG.add(w); return { w, r0, sp: 2 + i, d: i ? -1 : 1 }; });
      const wT = Y2K.toTex((() => { const c = Y2K.cnv(512, 256), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2c4a7a'); gr.addColorStop(0.55, '#3d6aa8'); gr.addColorStop(0.62, '#dfe8f2'); gr.addColorStop(1, '#f2f6fa'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256); g.strokeStyle = 'rgba(80,100,130,.35)'; g.lineWidth = 2; for (let y = 170; y < 256; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); } for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * 512, Math.random() * 140, 3, 2); } return c; })(), { color: true });
      const whaleM = new THREE.MeshPhysicalMaterial({ map: wT, roughness: 0.45, clearcoat: 0.6 }); const prof = [[0, -9], [1.2, -8.3], [2.6, -6.5], [3.4, -3], [3.5, 0], [3.0, 3], [2.0, 5.6], [1.0, 7.4], [0.45, 9.5], [0.3, 10.5]].map(([r, y]) => new THREE.Vector2(r, y));
      const whales = [0, 1].map((i) => { const w = new THREE.Group(); const bodyG = new THREE.LatheGeometry(prof, 36); bodyG.rotateZ(H2); const b = mesh(bodyG, whaleM); b.scale.set(1, 0.85, 1); w.add(b); const tail = new THREE.Group(); tail.position.x = -10.4; w.add(tail); for (const sz of [-1, 1]) { const f = mesh(new THREE.SphereGeometry(1, 16, 10), whaleM); f.scale.set(1.6, 0.18, 3.2); f.position.set(-0.8, 0, sz * 2.4); f.rotation.y = sz * 0.5; tail.add(f); } for (const sz of [-1, 1]) { const pf = mesh(new THREE.SphereGeometry(1, 16, 10), whaleM); pf.scale.set(2.2, 0.15, 0.8); pf.position.set(3.5, -2.2, sz * 3.2); pf.rotation.set(sz * 0.5, sz * 0.6, -0.3); w.add(pf); } for (const sz of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0a0a10 })); e.position.set(6.6, -0.6, sz * 2.45); w.add(e); } w.position.set(-50 + i * 70, 45 + i * 14, -40 + i * 50); OUTG.add(w); return { w, tl: tail, ph: i * 3 }; });
      const boats = [0, 1, 2].map((i) => { const b = new THREE.Group(); const hull = mesh(rbox(3, 0.8, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: [0xffffff, 0xff2a4a, 0xffd21a][i] })); b.add(hull); const sail = mesh(new THREE.ConeGeometry(1, 3, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); sail.position.y = 1.9; sail.scale.z = 0.1; b.add(sail); b.position.set(-30 + i * 25, -0.8, -20 - i * 3); OUTG.add(b); return { b, s: 1 + i * 0.4 }; });
      anim.push((dt, t, lv) => { giants.forEach((G2, gi) => { const rr = gi ? 166 : 146, sp = (gi ? 7 : 5.5); G2.a = (G2.a == null ? gi * 2.4 : G2.a) + dt * sp / rr * (gi ? -1 : 1); G2.w.position.x = Math.cos(G2.a) * rr; G2.w.position.z = Math.sin(G2.a) * rr; { const sg = gi ? -1 : 1; G2.w.rotation.y = Math.atan2(-Math.sin(G2.a) * sg, Math.cos(G2.a) * sg); } G2.sp = sp; G2.wd = (G2.wd || 0) + dt * G2.sp; if (!G2.h) G2.h = HGT(G2.w); if (window.ATM_OUT) { G2.r0.update(3.7, dt, { act: 'walk', ph: STEPPH(G2.wd, G2.h), mood: 'happy' }); try { GS.foot(G2, STEPPH(G2.wd, G2.h), 'walk', G2.w.position, 'out', true); } catch (e) {} } }); whales.forEach((W) => { W.w.position.x += dt * 3; if (W.w.position.x > 110) W.w.position.x = -110; W.w.position.y += Math.sin(t * 0.5 + W.ph) * 0.02; W.tl.rotation.z = Math.sin(t * 1.2 + W.ph) * 0.35; W.w.rotation.z = Math.sin(t * 1.2 + W.ph - 1) * 0.06; }); boats.forEach((B) => { B.b.position.x += dt * B.s; if (B.b.position.x > 40) B.b.position.x = -40; B.b.rotation.z = Math.sin(t * 1.3 + B.s) * 0.06; }); }); } catch (e) { console.warn('fuera', e); }
  }
  // ===== resto de la habitación: suelo de tarima, alfombra, paredes laterales, techo con estrellas, puerta y muebles =====
  function ROOMX(R, WM, o) { const { RX, RZ, FY, CY, RH, WZ, DY, cnv } = o; const SM = (t, r = 0.7) => new THREE.MeshStandardMaterial({ map: t, roughness: r });
    const plank = cnv(1024, 1024, (g) => { for (let r = 0; r < 16; r++) { const off = (r % 3) * 340; for (let k = -1; k < 4; k++) { const x = off + k * 400, h = 30 + (r * 7 + k * 13) % 25; g.fillStyle = `hsl(${28 + (r * 5 + k * 3) % 8},${42 + (k * 11 + r) % 14}%,${44 + (r * 3 + k * 7) % 12}%)`; g.fillRect(x, r * 64, 398, 62); for (let q = 0; q < 14; q++) { g.strokeStyle = `rgba(80,45,20,${0.05 + Math.random() * 0.08})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = r * 64 + Math.random() * 62; g.moveTo(x, y); g.bezierCurveTo(x + 130, y + Math.random() * 6 - 3, x + 260, y + Math.random() * 6 - 3, x + 398, y); g.stroke(); } } g.fillStyle = 'rgba(40,20,5,.5)'; g.fillRect(0, r * 64 + 62, 1024, 2); } });
    const chess = cnv(512, 512, (g) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const w0 = (x + y) % 2 === 0; const gr = g.createLinearGradient(x * 256, y * 256, x * 256 + 256, y * 256 + 256); gr.addColorStop(0, w0 ? '#f6f8fc' : '#15161c'); gr.addColorStop(1, w0 ? '#dde4f0' : '#22242e'); g.fillStyle = gr; g.fillRect(x * 256, y * 256, 256, 256); for (let i = 0; i < 18; i++) { g.strokeStyle = w0 ? `rgba(120,130,160,${Math.random() * 0.12})` : `rgba(200,210,255,${Math.random() * 0.08})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let px = x * 256 + Math.random() * 256, py = y * 256 + Math.random() * 256; g.moveTo(px, py); for (let q = 0; q < 6; q++) { px += Math.random() * 50 - 25; py += Math.random() * 50 - 25; g.lineTo(px, py); } g.stroke(); } } g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke(); });
    chess.wrapS = chess.wrapT = THREE.RepeatWrapping; chess.repeat.set(2 * RX / 10, (RZ - WZ) / 10); chess.anisotropy = 8; const floorM = new THREE.MeshPhysicalMaterial({ map: chess, roughness: 0.32, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.55 }); const fl = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, RZ - WZ), floorM); R.userData.floorM = floorM; fl.rotation.x = -H2; fl.position.set(0, FY, (RZ + WZ) / 2); R.add(fl);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(11, 64), SM(cnv(512, 512, (g) => { g.fillStyle = '#2a1a6e'; g.fillRect(0, 0, 512, 512); for (let k = 0; k < 9; k++) { g.strokeStyle = ['#ff4fd8', '#3d8bff', '#b6ff3b'][k % 3]; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 30 + k * 26, 0, TAU); g.stroke(); } for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } }), 1)); rug.rotation.x = -H2; rug.position.set(0, FY + 0.03, 2); R.add(rug);
    // paredes laterales y de la puerta
    { const WW = RZ - WZ, cz0 = (RZ + WZ) / 2, cy0 = (FY + CY) / 2, ZS = [-5.36, 40, 62.68, 85.36], WY = FY + 24 - cy0; const sh = new THREE.Shape(); sh.moveTo(-WW / 2, -RH / 2); sh.lineTo(WW / 2, -RH / 2); sh.lineTo(WW / 2, RH / 2); sh.lineTo(-WW / 2, RH / 2); sh.closePath(); ZS.forEach((z) => { const u = z - cz0, p = new THREE.Path(); p.absarc(u, WY, 3.9, 0, TAU, true); sh.holes.push(p); }); const gg = new THREE.ShapeGeometry(sh); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / WW + 0.5, uv.getY(i) / RH + 0.5);
      const FRW = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 }); for (const sx of [-1, 1]) { const w = new THREE.Mesh(gg, WM); w.position.set(sx * RX, cy0, cz0); w.rotation.y = -sx * H2; R.add(w); ZS.forEach((z) => { const ring = mesh(new THREE.TorusGeometry(4.15, 0.55, 14, 48), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, metalness: 0.9, roughness: 0.15, clearcoat: 1 })); ring.position.set(sx * (RX - 0.25), FY + 24, z); ring.rotation.y = H2; R.add(ring); const glow = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false })); glow.position.copy(ring.position); glow.rotation.y = H2; R.add(glow); for (const ang of [0, H2]) { const bar = mesh(new THREE.BoxGeometry(0.3, 7.8, 0.3), FRW); bar.position.copy(ring.position); bar.rotation.x = ang; R.add(bar); } const gl = new THREE.Mesh(new THREE.CircleGeometry(3.9, 40), new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide })); gl.position.copy(ring.position); gl.rotation.y = H2; R.add(gl); }); } }
    { const w = 2 * RX, h = RH, sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2); sh.lineTo(-w / 2, h / 2); sh.closePath(); const hx = 30, y0 = -h / 2, hole = new THREE.Path(); hole.moveTo(hx - 4.1, y0 + 0.01); hole.lineTo(hx + 4.1, y0 + 0.01); hole.lineTo(hx + 4.1, y0 + 16); hole.lineTo(hx - 4.1, y0 + 16); hole.closePath(); sh.holes.push(hole); const gg = new THREE.ShapeGeometry(sh); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5); const fw = new THREE.Mesh(gg, WM); fw.position.set(0, (FY + CY) / 2, RZ); fw.rotation.y = Math.PI; R.add(fw); }
    const door = new THREE.Group(); door.position.set(12, FY, RZ - 0.05); door.rotation.y = Math.PI; R.add(door); const dM = SM(cnv(256, 512, (g) => { g.fillStyle = '#f2ece0'; g.fillRect(0, 0, 256, 512); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 8; g.strokeRect(30, 30, 196, 200); g.strokeRect(30, 270, 196, 210); g.fillStyle = '#1a1040'; g.font = '900 26px Orbitron, Arial'; g.fillText('NO ENTRY', 50, 140); g.fillStyle = '#ff2a4a'; g.font = '700 16px Michroma, Arial'; g.fillText('STUDIO', 70, 330); g.fillText('RECORDING', 70, 356); }), 0.5); const dp = mesh(new THREE.BoxGeometry(5, 10.5, 0.3), dM); dp.position.y = 5.25; door.add(dp); const kn = mesh(new THREE.SphereGeometry(0.25, 16, 12), M.chrome); kn.position.set(-1.9, 5, 0.3); door.add(kn); const dfr = mesh(new THREE.BoxGeometry(5.8, 11, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff })); dfr.position.set(0, 5.4, -0.08); door.add(dfr);
    // zócalo
    const zM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }); [[2 * RX, 0, WZ + 0.1, 0], [2 * RX, 0, RZ - 0.1, 0], [RZ - WZ, -RX + 0.1, (RZ + WZ) / 2, H2], [RZ - WZ, RX - 0.1, (RZ + WZ) / 2, H2]].forEach(([w, x, z, r]) => { const b = mesh(new THREE.BoxGeometry(w, 0.7, 0.2), zM); b.position.set(x, FY + 0.35, z); b.rotation.y = r; R.add(b); });
    // techo con estrellas que brillan en la oscuridad + plafón
    const ce0 = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, RZ - WZ), SM(cnv(256, 256, (g) => { g.fillStyle = '#f4f6fb'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } }), 0.95)); { const gm = new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, transmission: 0.85, roughness: 0.03, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }); const dm = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 16, 0, TAU, 0, H2), gm); dm.scale.set(RX * 1.45, 14, (RZ - WZ) / 2 * 1.45); dm.position.set(0, CY, (RZ + WZ) / 2); const rib = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); for (let k = 0; k < 6; k++) { const t2 = mesh(new THREE.TorusGeometry(1, 0.008, 6, 64, Math.PI), rib); t2.scale.set(RX * 1.45, 14, 1); t2.rotation.y = k / 6 * Math.PI; t2.scale.z = 1; t2.position.copy(dm.position); } const ring = mesh(new THREE.BoxGeometry(2 * RX, 0.6, 0.6), rib); ring.position.set(0, CY, WZ); R.add(ring); const ring2 = ring.clone(); ring2.position.z = RZ; R.add(ring2); }
    // techo interior con casetones (rincones alrededor de la cúpula): madera lacada blanca, molduras y tira LED
    { const ct = cnv(512, 512, (g) => { g.fillStyle = '#e9edf4'; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) { const gr = g.createLinearGradient(x, y, x + 128, y + 128); gr.addColorStop(0, '#c9d1de'); gr.addColorStop(0.5, '#f7f9fc'); gr.addColorStop(1, '#b8c2d2'); g.fillStyle = gr; g.fillRect(x + 12, y + 12, 104, 104); g.fillStyle = '#ffffff'; g.fillRect(x + 26, y + 26, 76, 76); g.strokeStyle = 'rgba(120,135,160,.6)'; g.lineWidth = 3; g.strokeRect(x + 26, y + 26, 76, 76); g.fillStyle = 'rgba(255,214,120,.9)'; g.beginPath(); g.arc(x + 64, y + 64, 6, 0, TAU); g.fill(); } }); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(1 / 24, 1 / 24);
      const sh = new THREE.Shape(); sh.moveTo(-RX, WZ); sh.lineTo(RX, WZ); sh.lineTo(RX, RZ); sh.lineTo(-RX, RZ); sh.closePath(); const ho = new THREE.Path(); ho.absarc(0, 40, 40, 0, TAU, true); sh.holes.push(ho); [[-62, 8], [62, 8], [-62, 40], [62, 40], [-62, 72], [62, 72]].forEach(([sx, sz]) => { const h2 = new THREE.Path(); h2.moveTo(sx - 10, sz - 9); h2.lineTo(sx - 10, sz + 9); h2.lineTo(sx + 10, sz + 9); h2.lineTo(sx + 10, sz - 9); h2.closePath(); sh.holes.push(h2); }); const cg = new THREE.ShapeGeometry(sh, 64); cg.rotateX(H2); const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: ct, roughness: 0.6, side: THREE.DoubleSide })); cm.position.y = CY - 0.15; cm.userData.noCollide = true; R.add(cm); }
    const stT = cnv(64, 64, (g) => { g.fillStyle = '#d8ff9a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); }); const STM = new THREE.MeshBasicMaterial({ map: stT, transparent: true, toneMapped: false, color: 0x8a9a70 });
    // Restore original ceiling stars in one draw call, preserving mobile GPU budget.
    { const n = LOWDEV ? 38 : 108, stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), STM, n);
      const m = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        m.position.set(-RX + 2 + Math.random() * (2 * RX - 4),
          CY - 0.02, WZ + 2 + Math.random() * (RZ - WZ - 4));
        m.rotation.set(H2, 0, Math.random() * TAU);
        m.scale.setScalar(0.7 + Math.random() * 0.6);
        m.updateMatrix();
        stars.setMatrixAt(i, m.matrix);
      }
      stars.instanceMatrix.needsUpdate = true; R.add(stars);
    }
    const lamp0 = mesh(new THREE.SphereGeometry(1.6, 32, 16, 0, TAU, H2, H2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6dd, emissiveIntensity: 0.8 })); 
    // muebles: cama, puf, estantería de CDs, mininevera con pegatinas, máquina recreativa, monopatín y equipo de música
    const glossy = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 1 });
    { const bed = new THREE.Group(); bed.position.set(-30, FY, -8); R.add(bed); const fr = mesh(rbox(9, 1.6, 13, 0.2), glossy(0x5a3a8a)); fr.position.y = 0.8; bed.add(fr); const mt = mesh(rbox(8.6, 1.2, 12.4, 0.4), SM(cnv(512, 512, (g) => { g.fillStyle = '#1d4fd8'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#ffd21a'; for (let i = 0; i < 60; i++) { const x = Math.random() * 512, y = Math.random() * 512; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 10; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); } }), 0.9)); mt.position.y = 2.1; bed.add(mt); const pl = mesh(rbox(5, 0.9, 2.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })); pl.position.set(0, 3.0, -4.6); bed.add(pl); }
    { const pf = mesh(new THREE.SphereGeometry(2.6, 32, 20), glossy(0xff4fd8)); pf.scale.set(1, 0.65, 1); pf.position.set(15, FY + 1.6, -10); R.add(pf); }
    { const sh = new THREE.Group(); sh.position.set(RX - 1.2, FY, 4); R.add(sh); const box = mesh(new THREE.BoxGeometry(2, 12, 5), glossy(0xffffff)); box.position.y = 6; sh.add(box); const sp = SM(cnv(256, 512, (g) => { for (let r = 0; r < 6; r++) for (let i = 0; i < 18; i++) { g.fillStyle = `hsl(${(i * 47 + r * 30) % 360},70%,${45 + (i % 3) * 10}%)`; g.fillRect(i * 14, r * 85 + 8, 12, 72); } })); const fr2 = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 11.4), sp); fr2.position.set(-1.02, 6, 0); fr2.rotation.y = -H2; sh.add(fr2); }
    { const fz = new THREE.Group(); fz.position.set(24, FY, 20); fz.rotation.y = -0.6; R.add(fz); const b = mesh(rbox(3.4, 4.6, 3.2, 0.3), glossy(0xe9ecf4)); b.position.y = 2.3; fz.add(b); const st = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshStandardMaterial({ map: cnv(256, 336, (g) => { const s = ['#ff2fb0', '#3d8bff', '#ffd21a', '#2bd96b', '#ff7a1f']; for (let i = 0; i < 14; i++) { g.save(); g.translate(30 + Math.random() * 200, 30 + Math.random() * 280); g.rotate(Math.random() - 0.5); g.fillStyle = s[i % 5]; g.beginPath(); g.arc(0, 0, 18 + Math.random() * 16, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '900 12px Orbitron, Arial'; g.fillText(['2K', 'UF', '★', 'Y2K', 'MIX'][i % 5], -10, 4); g.restore(); } }), transparent: true })); st.position.set(0, 2.3, 1.62); fz.add(st); }
    { const ac = new THREE.Group(); ac.position.set(-RX + 2.5, FY, 12); ac.rotation.y = H2; R.add(ac); const cab = mesh(new THREE.BoxGeometry(4, 11, 4), glossy(0x1a1040)); cab.position.y = 5.5; ac.add(cab); const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), new THREE.MeshBasicMaterial({ map: cnv(256, 208, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 208); g.fillStyle = '#ff4fd8'; g.font = '900 26px Orbitron, Arial'; g.fillText('UNFIRE', 50, 70); g.fillStyle = '#b6ff3b'; g.font = '700 16px "Share Tech Mono", monospace'; g.fillText('INSERT COIN', 70, 130); g.fillText('HI 2000000', 70, 160); }), toneMapped: false })); scr.position.set(0, 7.6, 2.02); ac.add(scr); const pn = mesh(new THREE.BoxGeometry(4, 0.4, 1.6), glossy(0xff2fb0)); pn.position.set(0, 5.2, 2.6); ac.add(pn); }
    { const sk = new THREE.Group(); sk.position.set(-RX + 0.6, FY + 3.5, -12); sk.rotation.set(0, H2, 0.25); R.add(sk); const dk = mesh(rbox(1.6, 7, 0.15, 0.6), SM(cnv(128, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#ff7a1f'); gr.addColorStop(1, '#ff2fb0'); g.fillStyle = gr; g.fillRect(0, 0, 128, 512); g.fillStyle = '#fff'; g.font = '900 34px Orbitron, Arial'; g.save(); g.translate(80, 120); g.rotate(H2); g.fillText('SK8 2000', 0, 0); g.restore(); }))); sk.add(dk); }
    { const hf = new THREE.Group(); hf.position.set(RX - 3, FY, -12); R.add(hf); const box = mesh(rbox(5, 3.2, 3, 0.2), new THREE.MeshPhysicalMaterial({ color: 0xc8ccd8, metalness: 0.8, roughness: 0.25 })); box.position.y = 1.6; hf.add(box); for (const sx of [-1, 1]) { const sp = mesh(rbox(2.2, 5, 2.2, 0.2), new THREE.MeshPhysicalMaterial({ color: 0x222633, roughness: 0.4 })); sp.position.set(sx * 4, 2.5, 0); hf.add(sp); const cone = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 24).rotateX(H2), M.chrome); cone.position.set(sx * 4, 3.2, 1.12); hf.add(cone); } }
    // pósters en las paredes laterales y en la de la puerta
    const P = (w, h, x, y, z, ry, f) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: cnv(384, Math.round(384 * h / w), f), roughness: 0.6 })); p.position.set(x, y, z); p.rotation.y = ry; R.add(p); return p; };
    let fi = 0; const FONTS = ['Impact, Arial Black', 'Georgia, serif', '"Comic Sans MS", cursive', '"Trebuchet MS", sans-serif', '"Courier New", monospace', 'Michroma, Arial']; const grad = (a, b, t1, t2) => (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `900 ${W / 7}px ${FONTS[fi++ % FONTS.length]}`; g.fillText(t1, W / 2, H * 0.5); g.font = `700 ${W / 16}px Michroma, Arial`; g.fillText(t2, W / 2, H * 0.62); };
    if (false) P(4, 5.5, -RX + 0.05, 5, -6, H2, grad('#ff2fb0', '#2a0f6e', 'POP 2K', 'EL ÁLBUM DEL AÑO')); P(5, 3.6, -RX + 0.05, 7, 4, H2, grad('#3d8bff', '#0a1a3a', 'NEO CITY', 'LA PELI DEL VERANO')); P(3.5, 5, RX - 0.05, 6, -4, -H2, grad('#2bd96b', '#0a3a1a', 'MEGA ROBO', 'ARCADE · 1999')); P(4.5, 3.2, RX - 0.05, 8, 12, -H2, grad('#ffd21a', '#ff7a1f', 'SUMMER', 'MIXTAPE VOL. 3')); P(4, 5.5, -2, 5, RZ - 0.05, Math.PI, grad('#c08bff', '#1a1040', 'DIGITAL', 'BOYS & GIRLS')); P(3.2, 4.4, -9, 6, RZ - 0.05, Math.PI, grad('#ff4a00', '#2a0000', 'FIRE', 'UNFIRE · 2000')); }
  // ===== HABITACIÓN DE LOS 2000 · estudio: ventana con paisaje Frutiger Aero vivo, luces LED, bola de discoteca, juguetes con física, interruptor y secretos =====
  const ROOM = (() => { const R = new THREE.Group(); S.scene.add(R); const DY = -0.005; const anim = [], picks = []; let dark = false, discoN = 0, secretT = 0;
    const cnv = (w, h, f) => { const c = Y2K.cnv(w, h), g = c.getContext('2d'); f(g, w, h); return Y2K.toTex(c, { color: true }); };
    const wood = (() => { const t = cnv(1024, 512, (g) => { g.fillStyle = '#d9b98a'; g.fillRect(0, 0, 1024, 512); setTimeout(() => {}, 0); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${120 + Math.random() * 40},${80 + Math.random() * 30},40,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 512; g.moveTo(0, y); for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6); g.stroke(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.05 }); })();
    { const mp = wood.map.image.getContext ? wood.map.image.getContext('2d') : null; if (mp) { for (let i = 0; i < 70; i++) { mp.strokeStyle = `rgba(60,35,15,${0.15 + Math.random() * 0.25})`; mp.lineWidth = 0.6 + Math.random(); mp.beginPath(); const x = Math.random() * 1024, y = Math.random() * 512; mp.moveTo(x, y); mp.lineTo(x + Math.random() * 120 - 60, y + Math.random() * 30 - 15); mp.stroke(); } mp.fillStyle = 'rgba(70,40,10,.35)'; mp.fillRect(0, 0, 1024, 6); mp.fillRect(0, 506, 1024, 6); for (let i = 0; i < 5; i++) { mp.beginPath(); mp.arc(80 + Math.random() * 860, 60 + Math.random() * 390, 18 + Math.random() * 14, 0, TAU); mp.strokeStyle = 'rgba(80,50,20,.25)'; mp.lineWidth = 3; mp.stroke(); } ['holo', 'flame', 'alien', 'cd', 'star', 'daisy'].forEach((ty, i) => sticker(mp, ty, 60 + i * 175 + Math.random() * 30, i % 2 ? 470 : 40, 60 + Math.random() * 20, (Math.random() - 0.5))); wood.map.needsUpdate = true; } }
    const top = mesh(rbox(26, 0.35, 12.5, 0.12), wood); top.position.set(0, DY - 0.175, -1.2); R.add(top);
    const edge = mesh(rbox(26.05, 0.08, 12.55, 0.04), new THREE.MeshPhysicalMaterial({ color: 0x7fb6ff, transmission: 0.5, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.8 })); edge.position.set(0, DY - 0.36, -1.2); R.add(edge);
    for (const sx of [-1, 1]) { const leg = mesh(new THREE.BoxGeometry(0.5, 8.6, 7.6), M.silver || M.chrome); leg.position.set(sx * 12.2, DY - 4.6, -1.2); R.add(leg); }
    const carpet = cnv(512, 512, (g) => { g.fillStyle = '#2a3c6e'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.12})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } }); carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(8, 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 })); floor.visible = false; floor.rotation.x = -H2; floor.position.set(0, DY - 8.9, 4); R.add(floor);
    // --- pared con un gran ventanal ---
    const WZ = -16, WX = 13, WY0 = 0.6, WY1 = 11, RX = 80, RZ = 96, FY = DY - 8.9, CY = 26, RH = CY - FY; window.__RB = { x: RX - 2.5, z0: WZ + 2, z1: RZ - 2.5 }; const wallTex = cnv(1024, 1024, (g) => { const bg = g.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, '#cfeaff'); bg.addColorStop(1, '#eef8ff'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024); g.globalAlpha = 0.16; for (let x = 0; x < 1024; x += 48) { g.fillStyle = x / 48 % 2 ? '#fff' : '#9fd0ff'; g.fillRect(x, 0, 24, 1024); } g.globalAlpha = 1; });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 1.5); const WM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85, side: THREE.DoubleSide }); const panel = (w, h, x, y) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), WM); p.position.set(x, y, WZ); R.add(p); return p; };
    { const w = RX - WX, h = RH, cx = -(RX + WX) / 2, cy = (FY + CY) / 2, PW = 14, PH = 8, hx = -26 - cx, hy = 15.5 - cy; const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2); sh.lineTo(-w / 2, h / 2); sh.closePath(); const hole = new THREE.Path(); hole.moveTo(hx - PW / 2, hy - PH / 2); hole.lineTo(hx + PW / 2, hy - PH / 2); hole.lineTo(hx + PW / 2, hy + PH / 2); hole.lineTo(hx - PW / 2, hy + PH / 2); hole.closePath(); sh.holes.push(hole); const gg = new THREE.ShapeGeometry(sh); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5); const p = new THREE.Mesh(gg, WM); p.position.set(cx, cy, WZ); R.add(p); }
    panel(RX - WX, RH, (RX + WX) / 2, (FY + CY) / 2); panel(2 * WX, CY - WY1, 0, (CY + WY1) / 2); panel(2 * WX, WY0 - FY, 0, (WY0 + FY) / 2);
    ROOMX(R, WM, { RX, RZ, FY, CY, RH, WZ, DY, cnv });
    // ===== DOS COLUMNAS como las bobinas de un casete (la casa es el casete) + efecto Bully: lo que la columna tapa, cambia =====
    { const mT = cnv(512, 1024, (g) => { g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 512, 1024); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${150 + Math.random() * 40},${140 + Math.random() * 40},${150 + Math.random() * 30},${0.12 + Math.random() * 0.25})`; g.lineWidth = 0.6 + Math.random() * 2.4; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 1024; g.moveTo(x, y); for (let j = 0; j < 9; j++) { x += (Math.random() - 0.5) * 90; y += Math.random() * 140; g.lineTo(x, y); } g.stroke(); } for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; g.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2); } }); mT.wrapS = mT.wrapT = THREE.RepeatWrapping;
      const MRB = new THREE.MeshPhysicalMaterial({ map: mT, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.3 }), GLD = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.3 }); const H = CY - FY, RC = 3.1; const COLS = [];
      for (const cx of [-48, 48]) { const g = new THREE.Group(); g.position.set(cx, FY, 56); R.add(g); const sg = new THREE.CylinderGeometry(RC, RC * 1.08, H - 5, 32, 1, true); { const P = sg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 - 0.035 * Math.max(0, Math.cos(a * 20)); P.setX(i, x * k); P.setZ(i, z * k); } sg.computeVertexNormals(); const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 3); }
        const sh = mesh(sg, MRB); sh.position.y = (H - 5) / 2 + 2.5; g.add(sh); const base = mesh(new THREE.BoxGeometry(RC * 2.9, 1.4, RC * 2.9), MRB); base.position.y = 0.7; g.add(base); const tor = mesh(new THREE.TorusGeometry(RC * 1.12, 0.5, 10, 40), MRB); tor.rotation.x = H2; tor.position.y = 1.9; g.add(tor); const ring = mesh(new THREE.TorusGeometry(RC * 1.04, 0.18, 8, 40), GLD); ring.rotation.x = H2; ring.position.y = 2.6; g.add(ring);
        const cap = mesh(new THREE.CylinderGeometry(RC * 1.45, RC * 1.0, 2.2, 32), MRB); cap.position.y = H - 2.5 - 1.1 + 0.6; g.add(cap); const ab = mesh(new THREE.BoxGeometry(RC * 3.1, 1.2, RC * 3.1), MRB); ab.position.y = H - 0.6; g.add(ab); const ring2 = mesh(new THREE.TorusGeometry(RC * 1.0, 0.18, 8, 40), GLD); ring2.rotation.x = H2; ring2.position.y = H - 4.2; g.add(ring2); COLS.push({ x: cx, z: 56, g }); }
      window.__COLS = COLS;
      // efecto Bully: al pasar la columna izquierda (mirando a la puerta) por delante de los cuadros, algo ha cambiado cuando vuelves a verlos
      const SK2 = (() => { const c = Y2K.cnv(384, 480), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 384, 480); const s = g.createLinearGradient(0, 0, 0, 480); s.addColorStop(0, '#ff7ad9'); s.addColorStop(1, '#ffd21a'); g.fillStyle = s; g.fillRect(10, 10, 364, 460); g.fillStyle = '#111'; g.beginPath(); g.moveTo(10, 400); g.quadraticCurveTo(140, 400, 200, 260); g.lineTo(220, 260); g.lineTo(220, 470); g.lineTo(10, 470); g.fill(); g.save(); g.translate(250, 160); g.rotate(0.5); g.fillRect(-55, 60, 110, 9); g.restore(); g.save(); g.translate(240, 150); g.beginPath(); g.arc(0, -60, 16, 0, TAU); g.fill(); g.rotate(-0.3); g.fillRect(-9, -44, 18, 56); g.fillRect(-46, -40, 92, 9); g.fillRect(-14, 10, 9, 36); g.fillRect(8, 10, 9, 30); g.restore(); g.font = '900 40px Impact, Arial Black'; g.fillText('KICKFLIP!', 24, 60); return Y2K.toTex(c, { color: true }); })();
      const BY = { occ: {} }; anim.push(() => { if (!window.__roam || window.ATM_OUT) return; const A = cam.position; if (Math.abs(A.x) > 80 || A.z < -16 || A.z > 96) return; const C = COLS[1], TG = []; if (window.__SKATEP) TG.push(['sk', window.__SKATEP]); if (window.__HARLEM) TG.push(['hl', window.__HARLEM]); const tp = new THREE.Vector3();
        TG.forEach(([k, o]) => { o.getWorldPosition(tp); const dx = tp.x - A.x, dz = tp.z - A.z, L2 = dx * dx + dz * dz || 1; let u = ((C.x - A.x) * dx + (C.z - A.z) * dz) / L2; u = Math.max(0, Math.min(1, u)); const d = Math.hypot(A.x + dx * u - C.x, A.z + dz * u - C.z); const oc = d < RC * 0.95 && u > 0.05 && u < 0.95; if (oc && !BY.occ[k]) { if (k === 'sk') { const m = o.material; m.userData.a = m.userData.a || m.map; m.map = m.map === SK2 ? m.userData.a : SK2; m.needsUpdate = true; } else if (o.userData.car) o.userData.car.visible = !o.userData.car.visible; } BY.occ[k] = oc; }); }); }
    // ===== fachada exterior Y2K: paneles nacarados, franja de cristal para ver el interior, puerta, tejado y cúpula =====
    { const SG = new THREE.Group(); SG.userData.noCollide = true; R.add(SG); const POR = new THREE.Group(); R.add(POR); const O = 0.7, X0 = -RX - O, X1 = RX + O, Z0 = WZ - O, Z1 = RZ + O, B0 = FY, B1 = FY + 17, T0 = FY + 27, T1 = CY + 0.4;
      // casa americana de los 2000: tablillas de madera pintadas, ventanas con marco blanco, porche, tejado a dos aguas y chimenea
      const sidT = cnv(512, 512, (g) => { g.fillStyle = '#f3e3a6'; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 512; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,70,30,.35)'); g.fillStyle = gr; g.fillRect(0, y, 512, 32); } for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,90,40,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 30, 1); } }); sidT.wrapS = sidT.wrapT = THREE.RepeatWrapping;
      const PM = new THREE.MeshStandardMaterial({ map: sidT, roughness: 0.8 }); const TRIM = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 }); const MUL = TRIM; const strip = TRIM;
      const GM = new THREE.MeshPhysicalMaterial({ color: 0xbfe2ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, clearcoat: 1 });
      const WINS = (len, door) => { const L = []; const n = Math.floor(len / 22); for (let k = 0; k < n; k++) { const u = -len / 2 + (k + 0.5) * len / n; if (door != null && Math.abs(u - door) < 12) continue; L.push([u, B0 + 9, 9, 9]); L.push([u, B0 + 24, 9, 8]); } return L; };
      const wall = (len, cx, cz, ry, door) => { const ax = Math.cos(ry), az = -Math.sin(ry); const at = (u) => [cx + ax * u, cz + az * u]; const H = T1 - B0; const sh = new THREE.Shape(); sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, 0); sh.lineTo(len / 2, H); sh.lineTo(-len / 2, H); sh.closePath(); const W = WINS(len, door); W.forEach(([u, y, w, h]) => { const p = new THREE.Path(); p.moveTo(u - w / 2, y - B0 - h / 2); p.lineTo(u + w / 2, y - B0 - h / 2); p.lineTo(u + w / 2, y - B0 + h / 2); p.lineTo(u - w / 2, y - B0 + h / 2); p.closePath(); sh.holes.push(p); }); if (door != null) { const p = new THREE.Path(); p.moveTo(door - 4.5, 0.01); p.lineTo(door + 4.5, 0.01); p.lineTo(door + 4.5, 16.2); p.lineTo(door - 4.5, 16.2); p.closePath(); sh.holes.push(p); }
        const gg = new THREE.ShapeGeometry(sh); const uv = gg.attributes.uv, ps = gg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 20, ps.getY(i) / 20); const q = new THREE.Mesh(gg, PM); const c = at(0); q.position.set(c[0], B0, c[1]); q.rotation.y = ry; SG.add(q);
        const box = (w, h, d, u, y, out, mat) => { const p = at(u); const b = mesh(new THREE.BoxGeometry(w, h, d), mat || TRIM); b.position.set(p[0] + Math.sin(ry) * out, y, p[1] + Math.cos(ry) * out); b.rotation.y = ry; SG.add(b); return b; };
        W.forEach(([u, y, w, h]) => { const p = at(u); const gq = new THREE.Mesh(new THREE.PlaneGeometry(w, h), GM); gq.position.set(p[0] - Math.sin(ry) * 0.3, y, p[1] - Math.cos(ry) * 0.3); gq.rotation.y = ry; SG.add(gq); box(w + 1.2, 0.7, 0.8, u, y + h / 2 + 0.35, 0.3); box(w + 1.6, 0.6, 1.4, u, y - h / 2 - 0.3, 0.5); box(0.6, h, 0.8, u - w / 2 - 0.3, y, 0.3); box(0.6, h, 0.8, u + w / 2 + 0.3, y, 0.3); box(0.3, h, 0.5, u, y, 0.2); box(w, 0.3, 0.5, u, y, 0.2); const sh2 = new THREE.MeshStandardMaterial({ color: 0x2a4a7a, roughness: 0.6 }); box(2.6, h + 0.6, 0.4, u - w / 2 - 2.1, y, 0.3, sh2); box(2.6, h + 0.6, 0.4, u + w / 2 + 2.1, y, 0.3, sh2); });
        box(len + 1, 1.2, 1, 0, B0 + 0.6, 0.4, new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 })); box(len + 1.4, 0.9, 1.2, 0, T1 - 0.45, 0.5); };
      wall(X1 - X0, 0, Z1, 0, -30); wall(X1 - X0, 0, Z0, Math.PI); wall(Z1 - Z0, X0, (Z0 + Z1) / 2, -Math.PI / 2); wall(Z1 - Z0, X1, (Z0 + Z1) / 2, Math.PI / 2);
      for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) { const c = mesh(new THREE.BoxGeometry(1.8, T1 - B0, 1.8), TRIM); c.position.set(x, (B0 + T1) / 2, z); SG.add(c); }
      // puerta de madera roja y porche con columnas
      { const dr = mesh(new THREE.BoxGeometry(8.6, 15.8, 0.5), new THREE.MeshStandardMaterial({ color: 0xa3242c, roughness: 0.5 })); dr.position.set(-30 - 2.2, B0 + 7.9, Z1 + 0.6); dr.rotation.y = -1.25; dr.position.x = -30 - 4.3 + Math.cos(1.25) * 4.3; dr.position.z = Z1 + Math.sin(1.25) * 4.3; SG.add(dr);
        const deck = mesh(new THREE.BoxGeometry(28, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0xb9a383, roughness: 0.9 })); deck.position.set(-30, B0 + 0.4, Z1 + 6.5); SG.add(deck); [-42.5, -17.5].forEach((x) => { const c = mesh(new THREE.CylinderGeometry(0.7, 0.8, 18, 16), TRIM); c.position.set(x, B0 + 9.6, Z1 + 11.6); POR.add(c); }); const pr = mesh(new THREE.BoxGeometry(30, 1, 13), new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.8 })); pr.position.set(-30, B0 + 18.8, Z1 + 6.5); pr.rotation.x = 0.12; SG.add(pr); }
      // tejado plano con pretil + CÚPULA procedural de pétalos que se abre cuando llegas volando desde arriba
      { const zc = (Z0 + Z1) / 2; const shT = cnv(512, 512, (g) => { g.fillStyle = '#5a5f68'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } g.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); } }); shT.wrapS = shT.wrapT = THREE.RepeatWrapping; shT.repeat.set(8, 6);
        const RS = new THREE.Shape(); RS.moveTo(X0 - 1, Z0 - 1); RS.lineTo(X1 + 1, Z0 - 1); RS.lineTo(X1 + 1, Z1 + 1); RS.lineTo(X0 - 1, Z1 + 1); RS.closePath(); const hole = new THREE.Path(); hole.absarc(0, 40, 40, 0, Math.PI * 2, true); RS.holes.push(hole); [[-62, 8], [62, 8], [-62, 40], [62, 40], [-62, 72], [62, 72]].forEach(([sx, sz]) => { const h2 = new THREE.Path(); h2.moveTo(sx - 10, sz - 9); h2.lineTo(sx - 10, sz + 9); h2.lineTo(sx + 10, sz + 9); h2.lineTo(sx + 10, sz - 9); h2.closePath(); RS.holes.push(h2); }); const rg = new THREE.ShapeGeometry(RS, 48); rg.rotateX(Math.PI / 2); const roof = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: shT, roughness: 0.9, side: THREE.DoubleSide })); roof.position.y = T1 + 0.05; const uvR = rg.attributes.uv, psR = rg.attributes.position; for (let i = 0; i < uvR.count; i++) uvR.setXY(i, psR.getX(i) / 40, psR.getZ(i) / 40); SG.add(roof);
        [[X1 - X0 + 2, 2.2, 1, 0, Z1 + 0.5], [X1 - X0 + 2, 2.2, 1, 0, Z0 - 0.5], [1, 2.2, Z1 - Z0 + 2, X0 - 0.5, zc], [1, 2.2, Z1 - Z0 + 2, X1 + 0.5, zc]].forEach(([w, h, d, x, z]) => { const b = mesh(new THREE.BoxGeometry(w, h, d), TRIM); b.position.set(x, T1 + 1.1, z); SG.add(b); });
        const ring = mesh(new THREE.TorusGeometry(40.5, 1.3, 14, 120), new THREE.MeshPhysicalMaterial({ color: 0xe8edf3, metalness: 0.8, roughness: 0.2, clearcoat: 1 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, T1 + 0.8, 40); SG.add(ring);
        const PET = [], NPE = 12, petM = new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), ribM = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 0.9, roughness: 0.15 });
        for (let i = 0; i < NPE; i++) { const a = i / NPE * Math.PI * 2; const piv = new THREE.Group(); piv.position.set(Math.cos(a) * 40, T1 + 0.8, 40 + Math.sin(a) * 40); piv.rotation.y = -a; SG.add(piv); const pg = new THREE.SphereGeometry(40, 12, 10, Math.PI - Math.PI / NPE, Math.PI * 2 / NPE, 0, Math.PI / 2); const pet = new THREE.Mesh(pg, petM); pet.position.set(-40, 0, 0); pet.scale.y = 0.62; const pg2 = new THREE.Group(); pg2.add(pet); const rib = mesh(new THREE.TorusGeometry(40, 0.4, 6, 28, Math.PI / 2), ribM); rib.scale.y = 0.62; rib.position.set(-40, 0, 0); pg2.add(rib); piv.add(pg2); PET.push(pg2); }
        window.__DOME = { PET, open: 0, c: V(0, T1, 40), r: 40 }; { const SKG = new THREE.MeshPhysicalMaterial({ color: 0xd6eeff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }); [[-62, 8], [62, 8], [-62, 40], [62, 40], [-62, 72], [62, 72]].forEach(([sx, sz]) => { const gl = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), SKG); gl.rotation.x = -Math.PI / 2; gl.position.set(sx, T1 + 0.1, sz); gl.userData.noCollide = true; SG.add(gl); [[20.8, 0.6, 0, -9.2], [20.8, 0.6, 0, 9.2], [0.6, 18.8, -10.2, 0], [0.6, 18.8, 10.2, 0], [20, 0.3, 0, 0], [0.3, 18, 0, 0]].forEach(([w, d, ox, oz]) => { const f = mesh(new THREE.BoxGeometry(w, 0.7, d), TRIM); f.position.set(sx + ox, T1 + 0.25, sz + oz); SG.add(f); }); }); } }
      { const cv0 = document.createElement('canvas'); cv0.width = 1024; cv0.height = 256; const c = cv0.getContext('2d'); const tx = new THREE.CanvasTexture(cv0); tx.encoding = THREE.sRGBEncoding; const draw = (im) => { c.clearRect(0, 0, 1024, 256); c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.roundRect ? c.roundRect(4, 4, 1016, 248, 40) : c.rect(4, 4, 1016, 248); c.fill(); if (im) c.drawImage(im, 30, 18, 220, 220); c.fillStyle = '#10204a'; c.font = '900 140px Orbitron, Arial'; c.textAlign = 'left'; c.fillText('UNFIRE', 280, 180); tx.needsUpdate = true; }; draw(null); const im = new Image(); im.onload = () => draw(im); im.src = IMG + 'logo-unfire-256.webp'; const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: tx, transparent: true, toneMapped: false })); sign.position.set(-30, B0 + 24, Z1 + 0.3); SG.add(sign); }
      // desde fuera: escondemos las caras interiores de las paredes y se ve el interior por la franja de cristal
      const WALLS = []; R.traverse((o) => { if (o.isMesh && o.material === WM) WALLS.push(o); }); window.__FACADE = { SG, WALLS, box: { X0, X1, Z0, Z1 } }; }
    const poster = (w, h, x, y, rot, f) => { const t = cnv(512, Math.round(512 * h / w), (g, W2, H2_) => { g.fillStyle = '#fff'; g.fillRect(0, 0, W2, H2_); f(g, W2, H2_); }); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); p.position.set(x, y, WZ + 0.02); p.rotation.z = rot; R.add(p); return p; };
    // marco del ventanal + cristal con reflejo
    const FR = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 }); for (const [w, h, x, y] of [[2 * WX + 0.8, 0.5, 0, WY1], [2 * WX + 0.8, 0.5, 0, WY0], [0.5, WY1 - WY0, -WX, (WY0 + WY1) / 2], [0.5, WY1 - WY0, WX, (WY0 + WY1) / 2]]) { const b = mesh(new THREE.BoxGeometry(w, h, 0.4), FR); b.position.set(x, y, WZ); R.add(b); }
    // Ventanal diáfano: se conservan los cuatro marcos exteriores, sin maderas ni travesaños.
    const sill = mesh(rbox(2 * WX + 1.4, 0.3, 1.2, 0.08), FR); sill.position.set(0, WY0 - 0.2, WZ + 0.55); R.add(sill);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * WX, WY1 - WY0), new THREE.MeshBasicMaterial({ map: cnv(256, 128, (g) => { const gl = g.createLinearGradient(0, 0, 256, 128); gl.addColorStop(0.2, 'rgba(255,255,255,0)'); gl.addColorStop(0.32, 'rgba(255,255,255,.18)'); gl.addColorStop(0.42, 'rgba(255,255,255,0)'); gl.addColorStop(0.62, 'rgba(255,255,255,.08)'); gl.addColorStop(0.7, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, 256, 128); }), transparent: true, depthWrite: false, toneMapped: false })); glass.position.set(0, (WY0 + WY1) / 2, WZ + 0.05); R.add(glass);
    // --- paisaje Frutiger Aero (día / noche) ---
    const OUT = new THREE.Group(); R.add(OUT); const skyDay = cnv(1024, 512, (g) => { const s = g.createLinearGradient(0, 0, 0, 512); s.addColorStop(0, '#0f7bff'); s.addColorStop(0.6, '#8fd8ff'); s.addColorStop(1, '#f0fcff'); g.fillStyle = s; g.fillRect(0, 0, 1024, 512); });
    const skyNight = cnv(1024, 512, (g) => { const s = g.createLinearGradient(0, 0, 0, 512); s.addColorStop(0, '#030616'); s.addColorStop(1, '#1b2a6b'); g.fillStyle = s; g.fillRect(0, 0, 1024, 512); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * 1024, Math.random() * 360, 2, 2); } g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(760, 110, 34, 0, TAU); g.fill(); });
    const skyM = new THREE.MeshBasicMaterial({ map: skyDay, toneMapped: false }); skyM.side = THREE.BackSide; skyM.depthWrite = false; const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), skyM); sky.position.set(0, -20, 0); OUT.add(sky); window.__SKY = sky; sky.frustumCulled = false; S.camera.far = 90000; S.camera.updateProjectionMatrix();
    // Procedural landscape was being fully painted at boot even on iPhones.
    // Keep the same pattern/colors and world geometry, but allocate fewer pixels.
    const grassSize = LOWDEV ? 512 : 1024, grassScale = grassSize / 1024;
    const grassT = cnv(grassSize, grassSize, (g) => {
      g.fillStyle = '#4bb84f'; g.fillRect(0, 0, grassSize, grassSize);
      for (let i = 0, n = LOWDEV ? 6500 : 26000; i < n; i++) {
        const x = Math.random() * grassSize, y = Math.random() * grassSize, l = 30 + Math.random() * 30;
        g.fillStyle = `hsl(${95 + Math.random() * 40},${45 + Math.random() * 25}%,${l}%)`;
        g.fillRect(x, y, Math.max(0.5, (1 + Math.random() * 2) * grassScale), Math.max(1, (3 + Math.random() * 6) * grassScale));
      }
      for (let i = 0, n = LOWDEV ? 18 : 60; i < n; i++) {
        const x = Math.random() * grassSize, y = Math.random() * grassSize, r = (20 + Math.random() * 70) * grassScale;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(120,95,60,.35)'); gr.addColorStop(1, 'rgba(120,95,60,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      for (let i = 0, n = LOWDEV ? 120 : 400; i < n; i++) {
        g.fillStyle = ['#fff', '#ffd21a', '#ff7ad9', '#b6a0ff'][i % 4];
        g.beginPath(); g.arc(Math.random() * grassSize, Math.random() * grassSize,
          (1.6 + Math.random() * 1.6) * grassScale, 0, 7); g.fill();
      }
    });
    grassT.wrapS = grassT.wrapT = THREE.RepeatWrapping; grassT.repeat.set(26, 26);
    grassT.anisotropy = LOWDEV ? 2 : 8;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(235, 96), new THREE.MeshStandardMaterial({ map: grassT, roughness: 0.95 })); ground.rotation.x = -H2; ground.position.y = DY - 9.0; ground.userData.noCollide = true; OUT.add(ground);
    // ===== mar de sueño: pirámide, moái, árboles gigantes que suben al cielo =====
    const EXT0 = OUT.children.length; try { const stoneT = (base, dark) => cnv(512, 512, (g) => { g.fillStyle = base; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${dark},${Math.random() * 0.25})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 2 + Math.random() * 5); } g.strokeStyle = `rgba(${dark},.35)`; g.lineWidth = 3; for (let y = 0; y < 512; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); for (let x = (y / 32) % 2 ? 0 : 32; x < 512; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } });
      const pyrT = stoneT('#d9b46a', '90,60,20'); pyrT.wrapS = pyrT.wrapT = THREE.RepeatWrapping; pyrT.repeat.set(6, 6); const pyr = new THREE.Group(); pyr.position.set(600, DY - 9.2, 0); OUT.add(pyr); const PYM = new THREE.MeshStandardMaterial({ map: pyrT, roughness: 0.95 }); pyrT.repeat.set(1, 1);
        // pirámide escalonada de piedra de verdad: cuerpos con talud (no cubos), cornisas, bloques a tamaño real y desgaste
        const pyT2 = cnv(1024, 1024, (g) => { g.fillStyle = '#6e5634'; g.fillRect(0, 0, 1024, 1024); for (let y = 0; y < 1024; y += 40) { const off = (y / 40) % 2 ? 0 : 45; for (let x = -90 + off; x < 1024; x += 90) { const l = 44 + Math.random() * 16; g.fillStyle = `hsl(${30 + Math.random() * 10},${34 + Math.random() * 16}%,${l}%)`; g.fillRect(x + 2, y + 2, 86, 36); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 2, y + 2, 86, 4); g.fillStyle = 'rgba(60,40,15,.25)'; g.fillRect(x + 2, y + 34, 86, 4); } } for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '70,50,20' : '255,250,235'},${Math.random() * 0.12})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 3, 1 + Math.random() * 3); } for (let i = 0; i < 50; i++) { const x = Math.random() * 1024; const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, 'rgba(60,70,40,0)'); gr.addColorStop(1, 'rgba(60,70,40,.22)'); g.fillStyle = gr; g.fillRect(x, Math.random() * 600, 6 + Math.random() * 18, 424); } }); pyT2.wrapS = pyT2.wrapT = THREE.RepeatWrapping; pyT2.anisotropy = 8;
        const NT2 = 9, TH2 = 120.4 / NT2; let rb = 134; for (let k = 0; k < NT2; k++) { const rt = rb - 7.5; const geo = new THREE.CylinderGeometry(rt, rb, TH2 - 1.6, 4, 1); geo.rotateY(Math.PI / 4); const side = rb * Math.SQRT2; const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4 * side / 22, uv.getY(i) * TH2 / 10); const mt2 = new THREE.MeshStandardMaterial({ map: pyT2, roughness: 0.93 }); const st = mesh(geo, mt2); st.position.y = k * TH2 + (TH2 - 1.6) / 2; st.userData.noCollide = true; pyr.add(st); const lip = mesh(new THREE.BoxGeometry(rt * Math.SQRT2 + 1.4, 1.6, rt * Math.SQRT2 + 1.4), new THREE.MeshStandardMaterial({ color: 0x9c7c4a, roughness: 0.9 })); lip.position.y = k * TH2 + TH2 - 0.8; lip.userData.noCollide = true; pyr.add(lip); rb = rt - 2.2; }
        { const top = mesh(new THREE.BoxGeometry(22, 12, 22), new THREE.MeshStandardMaterial({ map: pyT2, roughness: 0.9 })); top.position.y = 120.4 + 6; top.userData.noCollide = true; pyr.add(top);
          // por dentro: pasillo de entrada y cámara secreta con jeroglíficos que brillan (cajas de choque con hueco para pasar)
          { const gl = cnv(512, 256, (g) => { g.fillStyle = '#2a1d10'; g.fillRect(0, 0, 512, 256); g.font = '28px serif'; for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(${150 + Math.random() * 100},${200 + Math.random() * 55},255,${0.25 + Math.random() * 0.5})`; g.fillText(['◉', '◈', '♫', '☥', '✦', '⌘', '♪', '⚚'][i % 8], Math.random() * 500, 20 + Math.random() * 236); } }); gl.wrapS = gl.wrapT = THREE.RepeatWrapping; gl.repeat.set(3, 1); const IM = new THREE.MeshStandardMaterial({ map: gl, emissive: 0x2a6aff, emissiveMap: gl, emissiveIntensity: 0.7, roughness: 0.9, side: THREE.BackSide });
            const cor = new THREE.Mesh(new THREE.BoxGeometry(16, 14, 76), IM); cor.position.set(0, 7, 57); cor.userData.noCollide = true; pyr.add(cor); const ch = new THREE.Mesh(new THREE.BoxGeometry(80, 26, 60), IM); ch.position.set(0, 13, -10); ch.userData.noCollide = true; pyr.add(ch); const door = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), new THREE.MeshBasicMaterial({ color: 0x050510 })); door.position.set(0, 7, 95.6); door.userData.noCollide = true; pyr.add(door); const fr = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.5, 8, 4), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false })); fr.rotation.z = Math.PI / 4; fr.scale.set(1, 0.85, 1); fr.position.set(0, 7, 95.8); fr.userData.noCollide = true; pyr.add(fr); const pl = new THREE.PointLight(0x7fd6ff, 2.2, 90); pl.position.set(0, 18, -10); pyr.add(pl);
            const PX = 600, PZ = 0, y1 = DY - 9.2 + 14; const OX = window.__OBSTX = window.__OBSTX || []; [[-95, -40, -95, 95], [40, 95, -95, 95], [-40, 40, -95, -40], [-40, -8, 20, 95], [8, 40, 20, 95]].forEach(([x0, x1, z0, z1]) => OX.push({ x0: PX + x0, x1: PX + x1, z0: PZ + z0, z1: PZ + z1, y1 })); }
 const door = mesh(new THREE.BoxGeometry(6, 8, 0.6), new THREE.MeshStandardMaterial({ color: 0x1a120a })); door.position.set(0, 120.4 + 4, 11.2); pyr.add(door); } { const stair = mesh(new THREE.BoxGeometry(18, 1, 125), PYM); stair.visible = false; stair.position.set(0, 60, 95 - 62); stair.rotation.x = Math.atan2(120, 95) - Math.PI / 2 + Math.PI / 2 * 0; stair.rotation.x = -Math.atan2(120, 95); stair.position.set(0, 60, 50); stair.userData.noCollide = true; pyr.add(stair); } const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 11.4, 4), new THREE.MeshStandardMaterial({ color: 0xffd21a, metalness: 1, roughness: 0.15, emissive: 0x553300 })); cap.rotation.y = Math.PI / 4; cap.position.set(600, DY - 9.2 + 120.4 + 12 + 5, 0); { const STP = new THREE.MeshStandardMaterial({ color: 0xd9bd86, roughness: 0.9 }); const SI = new THREE.InstancedMesh(new THREE.BoxGeometry(16, 2.0, 2.6), STP, 60), O3 = new THREE.Object3D(); for (let k = 0; k < 60; k++) { O3.position.set(0, k * 2.0 + 1, 96.5 - k * 1.42); O3.updateMatrix(); SI.setMatrixAt(k, O3.matrix); } SI.userData.noCollide = true; SI.receiveShadow = true; pyr.add(SI); } OUT.add(cap);
      const moT = stoneT('#6d6a66', '20,20,20'); const MM = new THREE.MeshStandardMaterial({ map: moT, roughness: 1 }); const moai = (x, z, s, ry, tx, tz) => { const g = new THREE.Group(); g.position.set(x, DY - 16, z); g.rotation.order = 'YXZ'; g.rotation.set(tx || 0.25, ry, tz || 0.18); g.scale.setScalar(s); OUT.add(g); const box = (w, h, d, px, py, pz) => { const b = mesh(new THREE.BoxGeometry(w, h, d), MM); b.position.set(px, py, pz); g.add(b); return b; }; box(10, 14, 8, 0, 7, 0); box(9, 16, 7.5, 0, 22, 0.4); box(9.4, 1.6, 2, 0, 26.5, 4.2); const n = box(2.2, 8, 3, 0, 22.5, 4.6); n.rotation.x = -0.12; box(6, 1.1, 1.6, 0, 16.6, 4.1); box(1.4, 10, 2, -5.1, 23, 0.5); box(1.4, 10, 2, 5.1, 23, 0.5); const hat = mesh(new THREE.CylinderGeometry(4.2, 4.6, 4, 20), new THREE.MeshStandardMaterial({ color: 0x9a3b2a, roughness: 1 })); hat.position.set(0, 32, 0); g.add(hat); return g; };
      moai(-520, -300, 6, 0.6, 0.32, 0.2); moai(-610, -150, 4.5, 0.9, -0.2, 0.35); moai(470, -560, 7.5, -0.4, 0.25, -0.28); moai(-300, 600, 5, 2.2, 0.4, 0.1);
      const tree = (x, z, H, col, tw, seed) => { const g = new THREE.Group(); g.position.set(x, DY - 9, z); g.userData.tall = true; OUT.add(g); const bark = cnv(256, 512, (q) => { q.fillStyle = '#5a3a22'; q.fillRect(0, 0, 256, 512); for (let i = 0; i < 120; i++) { q.strokeStyle = `rgba(30,15,5,${0.3 + Math.random() * 0.4})`; q.lineWidth = 2 + Math.random() * 5; q.beginPath(); const x0 = Math.random() * 256; q.moveTo(x0, 0); q.bezierCurveTo(x0 + 20, 170, x0 - 20, 340, x0 + 10, 512); q.stroke(); } }); bark.wrapS = bark.wrapT = THREE.RepeatWrapping; bark.repeat.set(2, H / 40); const BM = new THREE.MeshStandardMaterial({ map: bark, roughness: 1 }); const N = 8; let px = 0, pz = 0, py = 0, r = 6 + H / 60; for (let i = 0; i < N; i++) { const h = H / N, nx = px + Math.sin(seed + i * tw) * h * 0.25, nz = pz + Math.cos(seed * 1.7 + i * tw) * h * 0.25; const seg = mesh(new THREE.CylinderGeometry(r * 0.82, r, h * 1.04, 14), BM); seg.position.set((px + nx) / 2, py + h / 2, (pz + nz) / 2); seg.lookAt(nx, py + h + 1e-3, nz); seg.rotateX(Math.PI / 2); seg.position.set((px + nx) / 2, py + h / 2, (pz + nz) / 2); g.add(seg); px = nx; pz = nz; py += h; r *= 0.82; } const LM2 = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, emissive: col, emissiveIntensity: 0.12 }); for (let k = 0; k < 9; k++) { const s = (H / 7) * (0.6 + Math.random() * 0.6); const c = mesh(new THREE.IcosahedronGeometry(s, 2), LM2); c.position.set(px + (Math.random() - 0.5) * H / 4, py + (Math.random() - 0.2) * H / 8, pz + (Math.random() - 0.5) * H / 4); g.add(c); } return g; };
      [[150, -120, 420, 0xff7ad9, 0.6, 1], [-170, -60, 520, 0x5fe0ff, -0.5, 2], [-120, 170, 360, 0xffb020, 0.8, 3], [190, 120, 470, 0x9b6bff, -0.7, 4], [40, -200, 600, 0x6bff9b, 0.4, 5]].forEach((a) => tree(...a));
      // bosque que sale del mar (oeste)
      for (let k = 0; k < 11; k++) { const a = k * 2.399, rr = 40 + Math.sqrt(k) * 55; tree(-640 + Math.cos(a) * rr, 80 + Math.sin(a) * rr, 300 + (k % 4) * 140, [0x2bd96b, 0x5fe0ff, 0x9b6bff, 0xff7ad9, 0xb6ff3b][k % 5], (k % 2 ? 0.5 : -0.6), 10 + k); }
      // ===== ATLANTIS: anillos de tierra y canales alrededor de la gran pirámide, puentes y templos =====
      const AX = 600, AZ = 0; const marT = cnv(512, 512, (g) => { g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(150,140,130,${0.15 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = 'rgba(120,110,100,.35)'; g.lineWidth = 3; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } }); marT.wrapS = marT.wrapT = THREE.RepeatWrapping; marT.repeat.set(30, 30);
      const MAR = new THREE.MeshStandardMaterial({ map: marT, roughness: 0.6 }); const GR2 = new THREE.MeshStandardMaterial({ map: grassT, roughness: 0.95 }); const RINGS = [[0, 140, MAR], [170, 230, GR2], [255, 340, MAR]];
      RINGS.forEach(([r0, r1, mt]) => { const rg = r0 ? new THREE.RingGeometry(r0, r1, 120, 1) : new THREE.CircleGeometry(r1, 120); const uv = rg.attributes.uv, ps = rg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 600, ps.getY(i) / 600); const mm = new THREE.Mesh(rg, mt); mm.rotation.x = -H2; mm.position.set(AX, DY - 9.0, AZ); mm.userData.noCollide = true; OUT.add(mm); [r0, r1].forEach((rr) => { if (!rr) return; const wl = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 5, 120, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8, side: THREE.DoubleSide })); wl.position.set(AX, DY - 11.5, AZ); wl.userData.noCollide = true; OUT.add(wl); }); });
      const bridge = (x0, x1, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.2, 22), MAR); b.position.set((x0 + x1) / 2, DY - 9.6, z); b.userData.noCollide = true; OUT.add(b); for (let x = x0; x <= x1; x += 8) for (const sz of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 8), MAR); p.position.set(x, DY - 7.5, z + sz * 10.5); p.userData.noCollide = true; OUT.add(p); } }; bridge(225, AX - 250, 0); bridge(AX - 175, AX - 135, 0); bridge(AX - 260, AX - 225, 0);
      const COLM = new THREE.MeshStandardMaterial({ map: marT, roughness: 0.5, color: 0xffffff }); const temple = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, DY - 9, z); g.rotation.y = ry; OUT.add(g); const base = mesh(new THREE.BoxGeometry(26, 2, 18), COLM); base.position.y = 1; base.userData.noCollide = true; g.add(base); for (let i = 0; i < 6; i++) for (const zz of [-7, 7]) { const c = mesh(new THREE.CylinderGeometry(0.9, 1.05, 16, 14), COLM); c.position.set(-10 + i * 4, 10, zz); g.add(c); } const rf = mesh(new THREE.BoxGeometry(28, 1.6, 20), COLM); rf.position.y = 18.8; rf.userData.noCollide = true; g.add(rf); const tri = new THREE.Shape(); tri.moveTo(-14, 0); tri.lineTo(14, 0); tri.lineTo(0, 5); tri.closePath(); const tg = new THREE.ExtrudeGeometry(tri, { depth: 19, bevelEnabled: false }); const tm = mesh(tg, COLM); tm.position.set(0, 19.6, -9.5); tm.userData.noCollide = true; g.add(tm); };
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; temple(AX + Math.cos(a) * 200, AZ + Math.sin(a) * 200, -a + Math.PI / 2); } for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; temple(AX + Math.cos(a) * 300, AZ + Math.sin(a) * 300, -a + Math.PI / 2); }
      // ===== DESIERTO grande con dunas, cactus y un obelisco =====
      const DX = 80, DZ = -500, DR = 190; { const dg = new THREE.CircleGeometry(DR, 96); const sandT = cnv(512, 512, (g) => { g.fillStyle = '#e8c98a'; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 512; y += 6) { g.strokeStyle = `rgba(160,120,60,${0.08 + Math.random() * 0.08})`; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); g.stroke(); } }); sandT.wrapS = sandT.wrapT = THREE.RepeatWrapping; sandT.repeat.set(20, 20); const dm = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })); dm.rotation.x = -H2; dm.position.set(DX, DY - 9.0, DZ); dm.userData.noCollide = true; OUT.add(dm); const SM = new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 });
        for (let k = 0; k < 14; k++) { const a = k * 2.4, rr = 30 + (k * 37) % 140; const du = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), SM); du.scale.set(26 + (k % 3) * 10, 5 + (k % 4), 14 + (k % 2) * 8); du.rotation.y = a; du.position.set(DX + Math.cos(a) * rr, DY - 9.2, DZ + Math.sin(a) * rr); du.userData.noCollide = true; OUT.add(du); }
        const CM = new THREE.MeshStandardMaterial({ color: 0x3f8f4a, roughness: 0.8 }); for (let k = 0; k < 18; k++) { const a = k * 1.7 + 0.5, rr = 40 + (k * 53) % 140; const g = new THREE.Group(); g.position.set(DX + Math.cos(a) * rr, DY - 9, DZ + Math.sin(a) * rr); OUT.add(g); const h = 8 + (k % 4) * 3; const tr = mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(1.1, h, 6, 12) : new THREE.CylinderGeometry(1.1, 1.1, h, 12), CM); tr.position.y = h / 2; g.add(tr); [-1, 1].forEach((sx, j) => { const ar = mesh(new THREE.CylinderGeometry(0.7, 0.7, 4 + j, 10), CM); ar.position.set(sx * 2.4, h * 0.5 + j, 0); g.add(ar); const ar2 = mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 10), CM); ar2.rotation.z = Math.PI / 2; ar2.position.set(sx * 1.3, h * 0.5 - 1.6 + j, 0); g.add(ar2); }); }
        const ob = mesh(new THREE.CylinderGeometry(2.5, 4.5, 80, 4), new THREE.MeshStandardMaterial({ map: stoneT('#cfa86a', '90,60,20'), roughness: 0.9 })); ob.rotation.y = Math.PI / 4; ob.position.set(DX, DY - 9 + 40, DZ); OUT.add(ob); const sbar = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })); sbar.rotation.x = -H2; sbar.rotation.z = 0.1; sbar.position.set(55, DY - 9.05, -305); sbar.userData.noCollide = true; OUT.add(sbar); }
      // dónde hay tierra firme (para andar / deslizarse por el agua)
      window.__LAND = (x, z) => { if (Math.hypot(x, z) < 256) return true; if (window.__ISLE_H && window.__ISLE_H(x, z) != null) return true; if (Math.hypot(x + 760, z + 760) < 262) return true; const d = Math.hypot(x - AX, z - AZ); if (d < 140 || (d > 170 && d < 230) || (d > 255 && d < 340)) return true; if (Math.abs(z) < 11 && x > 222 && x < AX) return true; if (Math.hypot(x - DX, z - DZ) < DR) return true; const sx = x - 55, sz = z + 305; const cx2 = sx * Math.cos(0.1) + sz * Math.sin(0.1), cz2 = -sx * Math.sin(0.1) + sz * Math.cos(0.1); if (Math.abs(cx2) < 20 && Math.abs(cz2) < 60) return true; return false; }; } catch (e) { console.warn('mar', e); } window.__EXT = OUT.children.slice(EXT0);
    { const sand = new THREE.Mesh(new THREE.RingGeometry(230, 262, 96, 1), new THREE.MeshStandardMaterial({ color: 0xf2dfa8, roughness: 1 })); sand.rotation.x = -H2; sand.position.y = DY - 9.25; sand.userData.noCollide = true; OUT.add(sand); { const BC = [0xff2fb0, 0x3d8bff, 0xffd21a, 0x2bd96b, 0xffffff, 0xff7a1f]; const bg = new THREE.SphereGeometry(1, 20, 10);  const sg = cnv(256, 128, (g) => { g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffd21a'; g.font = '900 34px Impact'; g.fillText('SURF ZONE', 40, 52); g.fillStyle = '#fff'; g.font = '700 18px Arial'; g.fillText('🏄 BOARD (B) · SPACE = trick', 12, 90); }); const pl = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: sg })); pl.position.set(Math.cos(1.2) * 240, DY - 9 + 6, Math.sin(1.2) * 240); pl.lookAt(0, DY - 3, 0); OUT.add(pl); const post = mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a22 })); post.position.set(Math.cos(1.2) * 240.4, DY - 9 + 3, Math.sin(1.2) * 240.4); OUT.add(post); }
      const seaU = { t: { value: 0 } }; const WAVE = (x, z, t) => { const r = Math.hypot(x, z), a = Math.min(1, Math.max(0, (r - 250) / 90)); const sm = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); }; let mk = 1; for (const [ix, iz, ir] of [[600, 0, 345], [80, -500, 195], [-420, 120, 75], [300, 420, 65], [-360, -380, 85], [-760, -760, 260]]) mk *= sm(ir + 15, ir + 120, Math.hypot(x - ix, z - iz)); const sw = mk * Math.min(1, Math.max(0, (r - 330) / 220)) * (1 - Math.min(1, Math.max(0, (r - 1250) / 250))); const ph = r * 0.021 + t * 1.25, cr = Math.sin(ph); return mk * a * (Math.sin(x * 0.045 + t * 1.1) * 1.1 + Math.sin(z * 0.06 - t * 1.4 + x * 0.02) * 0.8 + Math.sin((x + z) * 0.11 + t * 2.1) * 0.35) + sw * (Math.pow(cr * 0.5 + 0.5, 2.6) * 11 - 3.2 + Math.sin(x * 0.013 + z * 0.009 - t * 0.9) * 2.4 + Math.pow(Math.max(0, Math.sin(x * 0.006 - z * 0.011 + t * 0.6)), 6) * 6); }; window.__WAVE = WAVE;
      // The ocean vertex shader evaluates wave height five times per vertex.
      // Keep the same shader, collision rules and ocean area; cap its static
      // tessellation by the already-detected GPU tier to reduce vertex work.
      const seaSegments = SOFTWARE_WEBGL ? 64 : LOWDEV ? (DEVICE.tier === 'compact' ? 96 : 112) : 272;
      const seaG = new THREE.PlaneGeometry(3200, 3200, seaSegments, seaSegments); const sea = new THREE.Mesh(seaG, new THREE.ShaderMaterial({ uniforms: seaU, vertexShader: 'uniform float t; varying vec3 vW; varying float vH; varying vec3 vN; float H(vec2 p){ float r = length(p); float a = clamp((r - 250.0) / 90.0, 0.0, 1.0); float mk = 1.0; mk *= smoothstep(360.0, 465.0, length(p - vec2(600.0, 0.0))); mk *= smoothstep(210.0, 315.0, length(p - vec2(80.0, -500.0))); mk *= smoothstep(90.0, 195.0, length(p - vec2(-420.0, 120.0))); mk *= smoothstep(80.0, 185.0, length(p - vec2(300.0, 420.0))); mk *= smoothstep(100.0, 205.0, length(p - vec2(-360.0, -380.0))); mk *= smoothstep(275.0, 380.0, length(p - vec2(-760.0, -760.0))); float sw = mk * clamp((r - 330.0) / 220.0, 0.0, 1.0) * (1.0 - clamp((r - 1250.0) / 250.0, 0.0, 1.0)); float cr = sin(r * 0.021 + t * 1.25); return mk * a * (sin(p.x * 0.045 + t * 1.1) * 1.1 + sin(p.y * 0.06 - t * 1.4 + p.x * 0.02) * 0.8 + sin((p.x + p.y) * 0.11 + t * 2.1) * 0.35) + sw * (pow(cr * 0.5 + 0.5, 2.6) * 11.0 - 3.2 + sin(p.x * 0.013 + p.y * 0.009 - t * 0.9) * 2.4 + pow(max(0.0, sin(p.x * 0.006 - p.y * 0.011 + t * 0.6)), 6.0) * 6.0); } void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec2 p = w.xz; float h = H(p); w.y += h; vH = h; float e = 1.5; vN = normalize(vec3(H(p - vec2(e, 0.0)) - H(p + vec2(e, 0.0)), 2.0 * e, H(p - vec2(0.0, e)) - H(p + vec2(0.0, e)))); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: 'uniform float t; varying vec3 vW; varying float vH; varying vec3 vN; void main(){ float r = length(vW.xz); float w = sin(vW.x * 0.08 + t * 1.3) * sin(vW.z * 0.07 - t * 1.1) * 0.5 + 0.5; vec3 deep = vec3(0.015, 0.17, 0.36), shallow = vec3(0.16, 0.72, 0.74); vec3 c = mix(shallow, deep, smoothstep(260.0, 520.0, r)); vec3 V0 = normalize(cameraPosition - vW); vec3 L = normalize(vec3(0.4, 0.8, 0.3)); float sp = pow(max(dot(reflect(-L, vN), V0), 0.0), 60.0); float fr = pow(1.0 - max(dot(vN, V0), 0.0), 3.0); c = c * (0.75 + 0.35 * dot(vN, L)) + vec3(1.0) * sp * 0.8 + vec3(0.7, 0.85, 1.0) * fr * 0.35; c += vec3(1.0) * smoothstep(1.4, 2.2, vH) * 0.3 * (1.0 - smoothstep(330.0, 450.0, r)); c += vec3(1.0) * smoothstep(0.0, 10.0, 268.0 - r) * smoothstep(250.0, 262.0, r) * (0.5 + 0.5 * sin(r * 1.5 - t * 3.0)); c += vec3(1.0) * pow(w, 18.0) * 0.1; c += vec3(0.95) * smoothstep(8.0, 10.5, vH) * 0.35; c = mix(c, vec3(0.02, 0.21, 0.44), smoothstep(900.0, 1400.0, r) * 0.6); gl_FragColor = vec4(c, (1.0 - smoothstep(1150.0, 1580.0, r)) * mix(0.5, 0.96, smoothstep(270.0, 680.0, r))); }', transparent: true })); sea.rotation.x = -H2; sea.position.y = DY - 10.2; sea.userData.noCollide = true; sea.frustumCulled = false; OUT.add(sea); anim.push((dt, t) => { seaU.t.value = t; });
      const isl = (x, z, r, col) => { const g0 = new THREE.Group(); g0.position.set(x, DY - 9.6, z); g0.userData.noCollide = true; OUT.add(g0); const top = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16, 0, TAU, 0, H2 * 0.6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })); top.scale.set(r, r * 0.35, r); top.position.y = -r * 0.35 * Math.cos(H2 * 0.6) + 0.4; g0.add(top); const bch = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.12, 1.2, 40), new THREE.MeshStandardMaterial({ color: 0xf2dfa8, roughness: 1 })); g0.add(bch); for (let k = 0; k < 5; k++) { const a = k * 1.3 + x, tr = new THREE.Group(); tr.position.set(Math.cos(a) * r * 0.5, r * 0.35 * (Math.cos(Math.asin(0.5)) - Math.cos(H2 * 0.6)) + 0.4 - 0.5, Math.sin(a) * r * 0.5); g0.add(tr); const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a32 })); tk.position.y = 6; tr.add(tk); for (let q = 0; q < 6; q++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0x2bd96b })); lf.scale.set(6, 0.6, 1.8); lf.position.set(Math.cos(q) * 4, 12, Math.sin(q) * 4); lf.rotation.y = -q; tr.add(lf); } } };
      isl(-420, 120, 70, 0x9fe36a); isl(300, 420, 60, 0xffffff); isl(-360, -380, 80, 0xc08bff);
      // Solid ground for the three small festival islands: walk on the dome and the stage deck, never through them.
      window.__ISLES = [[-420, 120, 70, 0.88], [300, 420, 60, -0.56], [-360, -380, 80, 2.32]];
      window.__ISLE_H = (x, z) => { for (const [ix, iz, r, gy] of window.__ISLES) { const d = Math.hypot(x - ix, z - iz); if (d >= r * 1.08) continue; const dd = d / r, c = Math.cos(Math.PI * 0.3); let y = dd < 0.809 ? DY - 9.2 + 0.35 * r * (Math.sqrt(1 - dd * dd) - c) : DY - 9.0; if (d < 17) y = Math.max(y, gy + 0.6); return y; } return null; }; }
    // ===== ISLA HAIKU: un jardín japonés enorme (cerezos en flor, monte nevado, pagoda, torii, farolillos de piedra, estanque koi, puente rojo, bambú y jardín zen) =====
    try { const HX = -760, HZ = -760, HR = 250, G0 = DY - 9; const HK = new THREE.Group(); HK.position.set(HX, 0, HZ); OUT.add(HK); const OX = window.__OBSTX = window.__OBSTX || []; const addB = (x, z, w, d, y1) => OX.push({ x0: HX + x - w / 2 - 1.1, x1: HX + x + w / 2 + 1.1, z0: HZ + z - d / 2 - 1.1, z1: HZ + z + d / 2 + 1.1, y1 });
      const gT = grassT.clone(); gT.needsUpdate = true; gT.wrapS = gT.wrapT = THREE.RepeatWrapping; gT.repeat.set(26, 26);
      const ground = new THREE.Mesh(new THREE.CylinderGeometry(HR, HR + 14, 4, 96), new THREE.MeshStandardMaterial({ map: gT, color: 0xd8f0c0, roughness: 0.95 })); ground.position.y = G0 - 2; ground.receiveShadow = true; ground.userData.noCollide = true; HK.add(ground);
      const beach = new THREE.Mesh(new THREE.CylinderGeometry(HR + 14, HR + 34, 2.4, 96), new THREE.MeshStandardMaterial({ color: 0xeedcae, roughness: 1 })); beach.position.y = G0 - 3.3; beach.userData.noCollide = true; HK.add(beach);
      // monte nevado (estilo grabado japonés): crestas de nieve que bajan por la ladera
      const mtT = cnv(512, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.26, '#eef2fa'); gr.addColorStop(0.34, '#7a7486'); gr.addColorStop(0.7, '#56604f'); gr.addColorStop(1, '#3f6a3c'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 260; i++) { const x = Math.random() * 512; g.strokeStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.55})`; g.lineWidth = 1 + Math.random() * 4; g.beginPath(); g.moveTo(x, 120 + Math.random() * 40); g.lineTo(x + (Math.random() - 0.5) * 16, 175 + Math.random() * 110); g.stroke(); } for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; g.fillRect(Math.random() * 512, 180 + Math.random() * 332, 2 + Math.random() * 3, 2 + Math.random() * 3); } });
      { const mg = new THREE.CylinderGeometry(10, 125, 160, 72, 10, true); const P = mg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 + 0.05 * Math.sin(a * 11 + y * 0.03) + 0.03 * Math.sin(a * 23); P.setXYZ(i, x * k, y, z * k); } mg.computeVertexNormals(); const mt = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ map: mtT, roughness: 0.9, side: THREE.DoubleSide })); mt.position.set(-90, G0 + 80, -100); mt.userData.noCollide = true; mt.castShadow = true; HK.add(mt); for (let i = 0; i < 7; i++) { const rr = 120 * (1 - i / 7) * 0.72; addB(-90, -100, rr * 2, rr * 2, G0 + 160 * (i + 1) / 7); } }
      // cerezos en flor: troncos y copas instanciados (un solo dibujo para todos)
      const TRK = [], NT = window.__LOWDEV ? 16 : 30; { let sd = 7; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); while (TRK.length < NT) { const a = rr() * TAU, d = 40 + rr() * 190, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x + 90, z + 100) < 135 || Math.hypot(x - 70, z - 60) < 40 || Math.hypot(x - 60, z + 30) < 26 || (Math.abs(x) < 14 && z > 60)) continue; TRK.push([x, z, 0.8 + rr() * 0.5, rr() * TAU]); } }
      { const tg = new THREE.CylinderGeometry(0.7, 1.3, 11, 8); tg.translate(0, 5.5, 0); const tm = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x4a2f24, roughness: 0.9 }), TRK.length); const cg = new THREE.IcosahedronGeometry(1, 2); const PK = [0xffc4d8, 0xffb0cb, 0xffd9e6, 0xff9fc0]; const cm = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), TRK.length * 7); const O3 = new THREE.Object3D(), C = new THREE.Color(); let n = 0;
        TRK.forEach(([x, z, s, r], i) => { O3.position.set(x, G0, z); O3.rotation.set(Math.sin(r) * 0.12, r, Math.cos(r) * 0.12); O3.scale.setScalar(s); O3.updateMatrix(); tm.setMatrixAt(i, O3.matrix); addB(x, z, 2.4 * s, 2.4 * s, G0 + 11 * s); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + r; const rd = k ? 4.2 : 0; O3.position.set(x + Math.cos(a) * rd * s, G0 + (11 + (k ? Math.sin(a * 3) * 1.4 : 2.5)) * s, z + Math.sin(a) * rd * s); O3.rotation.set(0, a, 0); O3.scale.set(5 * s * (k ? 0.85 : 1.1), 3.6 * s, 5 * s * (k ? 0.85 : 1.1)); O3.updateMatrix(); cm.setMatrixAt(n, O3.matrix); cm.setColorAt(n++, C.set(PK[(i + k) % 4])); } });
        tm.castShadow = cm.castShadow = true; tm.userData.noCollide = cm.userData.noCollide = true; HK.add(tm, cm); }
      // pétalos cayendo (solo cuando estás cerca)
      const PN = window.__LOWDEV ? 300 : 900, pg = new THREE.BufferGeometry(), pa = new Float32Array(PN * 3); for (let i = 0; i < PN; i++) { pa[i * 3] = (Math.random() - 0.5) * 440; pa[i * 3 + 1] = G0 + Math.random() * 40; pa[i * 3 + 2] = (Math.random() - 0.5) * 440; } pg.setAttribute('position', new THREE.BufferAttribute(pa, 3)); const petals = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc8dc, size: 0.7, transparent: true, opacity: 0.9, depthWrite: false })); petals.frustumCulled = false; petals.userData.noCollide = true; HK.add(petals);
      // pagoda de cinco tejados
      const stoneT = (base, dark) => cnv(256, 256, (g) => { g.fillStyle = base; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${dark},${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4); } }); const RED = new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.55 }), WAL = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.8 }), ROOF = new THREE.MeshStandardMaterial({ color: 0x2f3b3a, roughness: 0.6, metalness: 0.2 }), STN = new THREE.MeshStandardMaterial({ map: stoneT('#9a978f', '40,40,40'), roughness: 1 });
      { const pgd = new THREE.Group(); pgd.position.set(70, G0, 60); HK.add(pgd); const base = mesh(new THREE.BoxGeometry(26, 2, 26), STN); base.position.y = 1; pgd.add(base); let y = 2; for (let k = 0; k < 5; k++) { const w = 16 - k * 2.2, h = 6.2 - k * 0.5; const b = mesh(new THREE.BoxGeometry(w, h, w), k % 2 ? RED : WAL); b.position.y = y + h / 2; pgd.add(b); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(0.35, 0.35, h, 8), RED); c.position.set(sx * w / 2, y + h / 2, sz * w / 2); pgd.add(c); } y += h; const rg = new THREE.ConeGeometry(w * 0.95, 3.4, 4, 1, true); rg.rotateY(Math.PI / 4); const P = rg.attributes.position; for (let i = 0; i < P.count; i++) { const yy = P.getY(i); if (yy < 0) P.setY(i, yy + 0.6 * Math.abs(Math.sin(Math.atan2(P.getZ(i), P.getX(i)) * 2))); } rg.computeVertexNormals(); const rf = mesh(rg, ROOF); rf.material = ROOF; rf.position.y = y + 1.4; pgd.add(rf); y += 2.2; } const sp = mesh(new THREE.CylinderGeometry(0.25, 0.5, 9, 8), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.25 })); sp.position.y = y + 4.5; pgd.add(sp); for (let k = 0; k < 6; k++) { const ring = mesh(new THREE.TorusGeometry(0.6, 0.12, 6, 16), sp.material); ring.rotation.x = H2; ring.position.y = y + 1.5 + k * 1.1; pgd.add(ring); } addB(70, 60, 18, 18, G0 + y + 9); }
      // camino de torii rojos con farolillos de piedra
      const torii = (x, z, ry, s) => { const g = new THREE.Group(); g.position.set(x, G0, z); g.rotation.y = ry; g.scale.setScalar(s); HK.add(g); for (const sx of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(0.75, 0.9, 16, 14), RED); c.position.set(sx * 6, 8, 0); g.add(c); const ft = mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0x1b1b1b })); ft.position.set(sx * 6, 0.6, 0); g.add(ft); } const nuki = mesh(new THREE.BoxGeometry(15, 1, 0.8), RED); nuki.position.y = 12.5; g.add(nuki); const kg = new THREE.BoxGeometry(19, 1.4, 1.6, 12, 1, 1); const P = kg.attributes.position; for (let i = 0; i < P.count; i++) { const xx = P.getX(i); P.setY(i, P.getY(i) + Math.pow(Math.abs(xx) / 9.5, 2.2) * 1.3); } kg.computeVertexNormals(); const kasa = mesh(kg, new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.6 })); kasa.position.y = 15.6; g.add(kasa); const sh = mesh(new THREE.BoxGeometry(17, 0.9, 1.2), RED); sh.position.y = 14.6; g.add(sh); const c2 = Math.cos(ry), s2 = Math.sin(ry); for (const sx of [-1, 1]) addB(x - HX + HX + sx * 6 * s * c2 - 0, z + -sx * 6 * s * s2, 2.2 * s, 2.2 * s, G0 + 16 * s); };
      for (let k = 0; k < 5; k++) torii(0, 220 - k * 26, 0, 1);
      const lantern = (x, z) => { const g = new THREE.Group(); g.position.set(x, G0, z); HK.add(g); const pts = [[1.6, 0.6, 1.6, 0.3], [0.5, 3.2, 0.5, 2.2], [1.4, 0.5, 1.4, 4.0]]; pts.forEach(([w, h, d, y]) => { const b = mesh(new THREE.BoxGeometry(w, h, d), STN); b.position.y = y; g.add(b); }); const box = mesh(new THREE.BoxGeometry(1.2, 1.3, 1.2), new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffb04a, emissiveIntensity: 0.9, roughness: 0.6 })); box.position.y = 4.9; g.add(box); const cap = mesh(new THREE.ConeGeometry(1.5, 1.2, 4), STN); cap.rotation.y = Math.PI / 4; cap.position.y = 6.1; g.add(cap); addB(x, z, 1.8, 1.8, G0 + 6.5); };
      for (let k = 0; k < 6; k++) { lantern(-11, 205 - k * 26); lantern(11, 205 - k * 26); }
      // estanque con peces koi y puente rojo en arco
      { const pond = new THREE.Mesh(new THREE.CircleGeometry(26, 48), new THREE.MeshPhysicalMaterial({ color: 0x1d6f7a, roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.88 })); pond.rotation.x = -H2; pond.position.set(60, G0 + 0.08, -30); pond.userData.noCollide = true; HK.add(pond); const rim = new THREE.Mesh(new THREE.TorusGeometry(26.5, 1.1, 8, 48), STN); rim.rotation.x = H2; rim.position.set(60, G0 + 0.3, -30); rim.userData.noCollide = true; HK.add(rim);
        const KOI = []; for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: [0xff6a1f, 0xffffff, 0xffb020][k % 3], roughness: 0.4 })); f.scale.set(0.6, 0.35, 1.6); f.userData.noCollide = true; HK.add(f); KOI.push({ f, r: 6 + k * 2, a: k * 2.1, sp: 0.25 + (k % 3) * 0.08 }); }
        const br = new THREE.Group(); br.position.set(60, G0, -30); br.userData.noCollide = true; HK.add(br); for (let k = 0; k <= 16; k++) { const u = k / 16, x = -30 + u * 60, y = Math.sin(u * Math.PI) * 6; const pl = mesh(new THREE.BoxGeometry(3.9, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 })); pl.position.set(x, y + 0.4, 0); pl.rotation.z = Math.cos(u * Math.PI) * 0.4; br.add(pl); for (const sz of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.4, 6), RED); p.position.set(x, y + 1.6, sz * 3.9); br.add(p); } } for (const sz of [-1, 1]) { const rail = mesh(new THREE.TorusGeometry(30, 0.25, 6, 40, Math.PI), RED); rail.scale.set(1, 0.2, 1); rail.position.set(0, 2.9, sz * 3.9); br.add(rail); }
        anim.push((dt, t) => { if (!window.ATM_OUT) return; const cp = cam.position; const near = Math.hypot(cp.x - HX, cp.z - HZ) < 700 && cp.y < 600; petals.visible = near; if (!near) return; KOI.forEach((q) => { q.a += q.sp * dt; q.f.position.set(60 + Math.cos(q.a) * q.r * 0.9, G0 - 0.6 + Math.sin(t * 2 + q.r) * 0.1, -30 + Math.sin(q.a) * q.r * 0.9); q.f.rotation.y = -q.a; }); const A = pg.attributes.position.array; for (let i = 0; i < A.length; i += 3) { A[i + 1] -= dt * (1.2 + (i % 7) * 0.2); A[i] += Math.sin(t * 0.8 + i) * dt * 1.5; A[i + 2] += dt * 0.8; if (A[i + 1] < G0) { A[i + 1] = G0 + 35; A[i + 2] = (Math.random() - 0.5) * 440; } } pg.attributes.position.needsUpdate = true; }); }
      // jardín zen rastrillado con rocas y bosquecillo de bambú
      { const zt = cnv(512, 512, (g) => { g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(150,135,110,.45)'; g.lineWidth = 2; for (let y = 4; y < 512; y += 10) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + y * 0.1) * 2); g.stroke(); } }); const zg = new THREE.Mesh(new THREE.PlaneGeometry(56, 40), new THREE.MeshStandardMaterial({ map: zt, roughness: 1 })); zg.rotation.x = -H2; zg.position.set(-60, G0 + 0.06, 120); zg.userData.noCollide = true; HK.add(zg); [[-70, 112, 4], [-52, 126, 3], [-58, 110, 2.2]].forEach(([x, z, r]) => { const rk = mesh(new THREE.DodecahedronGeometry(r, 1), STN); rk.scale.y = 0.7; rk.position.set(x, G0 + r * 0.5, z); HK.add(rk); addB(x, z, r * 2, r * 2, G0 + r * 1.2); });
        const NB = window.__LOWDEV ? 40 : 90, bm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x5f9a3a, roughness: 0.6 }), NB); const O3 = new THREE.Object3D(); for (let i = 0; i < NB; i++) { const a = i * 2.399, d = Math.sqrt(i) * 3.2; O3.position.set(150 + Math.cos(a) * d, G0, -120 + Math.sin(a) * d); O3.rotation.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12); O3.scale.set(1, 18 + Math.random() * 14, 1); O3.updateMatrix(); bm.setMatrixAt(i, O3.matrix); } bm.userData.noCollide = true; bm.castShadow = true; HK.add(bm); addB(150, -120, 56, 56, G0 + 30); }
      HK.traverse((o) => { if (o.isMesh && o !== ground && o !== beach) o.userData.noCollide = true; }); if (window.__EXT) window.__EXT.push(HK);
    } catch (e) { console.warn('haiku', e); }
    // ===== rincón nevado junto a la casa: suelo blanco, pinos con nieve y copos que caen siempre =====
    try { const SX = 60, SZ = -150, SR = 42, G1 = DY - 9; const SN = new THREE.Group(); OUT.add(SN); const sm = new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.9 }); const disc = new THREE.Mesh(new THREE.CircleGeometry(SR, 48), sm); disc.rotation.x = -H2; disc.position.set(SX, G1 + 0.06, SZ); disc.userData.noCollide = true; SN.add(disc);
      const PM2 = new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.8 }), TK2 = new THREE.MeshStandardMaterial({ color: 0x5a3a22 }); const OX = window.__OBSTX = window.__OBSTX || [];
      for (let k = 0; k < 8; k++) { const a = k * 2.4, r = 10 + (k * 7) % 30, x = SX + Math.cos(a) * r, z = SZ + Math.sin(a) * r, s = 0.8 + (k % 3) * 0.25; const g = new THREE.Group(); g.position.set(x, G1, z); g.scale.setScalar(s); SN.add(g); const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 8), TK2); tk.position.y = 2; g.add(tk); for (let j = 0; j < 3; j++) { const c = new THREE.Mesh(new THREE.ConeGeometry(5 - j * 1.3, 6, 10), PM2); c.position.y = 6 + j * 3.6; c.castShadow = true; g.add(c); const cap = new THREE.Mesh(new THREE.ConeGeometry(3.4 - j * 1.0, 2.2, 10), sm); cap.position.y = 8.2 + j * 3.6; g.add(cap); } g.traverse((o) => { if (o.isMesh) o.userData.noCollide = true; }); OX.push({ x0: x - 2.2 * s, x1: x + 2.2 * s, z0: z - 2.2 * s, z1: z + 2.2 * s, y1: G1 + 18 * s }); }
      const NF = window.__LOWDEV ? 160 : 280, fg = new THREE.BufferGeometry(), fp = new Float32Array(NF * 3); for (let i = 0; i < NF; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * SR; fp[i * 3] = SX + Math.cos(a) * r; fp[i * 3 + 1] = G1 + Math.random() * 40; fp[i * 3 + 2] = SZ + Math.sin(a) * r; } fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); const flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xe9f5ff, map: window.__UNFIRE_SNOW_TEXTURE || null, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.74, alphaTest: 0.02, depthWrite: false })); flakes.frustumCulled = false; SN.add(flakes);
      anim.push((dt, t) => { if (!window.ATM_OUT) return; const cp = cam.position; const hasGlobalSnow = ((window.__WEATHER || {}).snow && !window.__WMAN) || (window.__WMAN && window.__UNFIRE_WEATHER_MODE === 'nieve'); flakes.visible = !hasGlobalSnow && Math.hypot(cp.x - SX, cp.z - SZ) < 400; if (!flakes.visible) return; const A = fg.attributes.position.array; for (let i = 0; i < A.length; i += 3) { A[i + 1] -= dt * 4; A[i] += Math.sin(t + i) * dt * 0.6; if (A[i + 1] < G1) A[i + 1] = G1 + 40; } fg.attributes.position.needsUpdate = true; });
      if (window.__EXT) window.__EXT.push(SN); } catch (e) { console.warn('nieve', e); }
    // ===== VIDA EN EL MAR: fondo con corales, bancos de peces, tiburones, ballenas que saltan y se van volando, surfistas y espuma (todo en bucle) =====
    try { const G0 = DY - 10.2; const OC = new THREE.Group(); OUT.add(OC);
      const sbT = cnv(512, 512, (g) => { g.fillStyle = '#d9c38e'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,95,50' : '255,245,220'},${Math.random() * 0.15})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } for (let y = 0; y < 512; y += 14) { g.strokeStyle = 'rgba(150,120,70,.18)'; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); g.stroke(); } }); sbT.wrapS = sbT.wrapT = THREE.RepeatWrapping; sbT.repeat.set(30, 30);
      const DEP = (r) => Math.min(28, 0.8 + Math.max(0, r - 250) * 0.075); const sg = new THREE.RingGeometry(240, 1100, 120, 30); sg.rotateX(-H2); { const P = sg.attributes.position, uv = sg.attributes.uv; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, -DEP(Math.hypot(x, z))); uv.setXY(i, x / 1100, z / 1100); } sg.computeVertexNormals(); }
      const sb = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: sbT, color: 0xa8dcd6, roughness: 1 })); sb.position.y = G0; sb.receiveShadow = true; OC.add(sb);
      let sd = 99; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); const O3 = new THREE.Object3D(), C = new THREE.Color();
      // corales y algas
      const NCO = window.__LOWDEV ? 120 : 260, co = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), NCO); const CCOL = [0xff6f91, 0xff9f43, 0xffd166, 0x9b5de5, 0x00bbf9, 0xf15bb5, 0x06d6a0];
      for (let i = 0; i < NCO; i++) { const a = rr() * TAU, r = 268 + rr() * 330, x = Math.cos(a) * r, z = Math.sin(a) * r; if (window.__LAND(x, z)) { i--; continue; } const s = 1.2 + rr() * 3.2; O3.position.set(x, G0 - DEP(r) + s * 0.4, z); O3.rotation.set(rr(), rr() * 3, rr()); O3.scale.set(s, s * (0.6 + rr() * 1.6), s); O3.updateMatrix(); co.setMatrixAt(i, O3.matrix); co.setColorAt(i, C.set(CCOL[i % CCOL.length])); } OC.add(co);
      const NAL = window.__LOWDEV ? 80 : 180, al = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x2f9e5a, roughness: 0.8 }), NAL); for (let i = 0; i < NAL; i++) { const a = rr() * TAU, r = 262 + rr() * 300, x = Math.cos(a) * r, z = Math.sin(a) * r; O3.position.set(x, G0 - DEP(r), z); O3.rotation.set((rr() - 0.5) * 0.3, 0, (rr() - 0.5) * 0.3); O3.scale.set(1, 4 + rr() * 9, 1); O3.updateMatrix(); al.setMatrixAt(i, O3.matrix); } OC.add(al);
      // bancos de peces de colores
      const NS = 8, PER = window.__LOWDEV ? 10 : 18, fg = new THREE.ConeGeometry(0.45, 1.8, 6); fg.rotateX(H2); const fish = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2 }), NS * PER); fish.frustumCulled = false; const FC = [0xff7a1f, 0xffd21a, 0x3d8bff, 0xff2fb0, 0x2bd96b, 0xffffff, 0x9b6bff, 0x5fe0ff];
      const SCH = Array.from({ length: NS }, (_, k) => ({ r: 290 + k * 38, sp: (k % 2 ? 1 : -1) * (0.05 + k * 0.006), a: k * 0.8, d: 2.5 + (k % 3) * 2.2, off: Array.from({ length: PER }, () => [rr() * 8 - 4, rr() * 3 - 1.5, rr() * 8 - 4, rr() * 6]) })); for (let i = 0; i < NS * PER; i++) fish.setColorAt(i, C.set(FC[Math.floor(i / PER) % FC.length])); OC.add(fish);
      // tiburones (la aleta asoma) y ballenas que saltan, vuelan por el cielo y vuelven al mar
      const mkShark = () => { const g = new THREE.Group(), M = new THREE.MeshStandardMaterial({ color: 0x6b7c8c, roughness: 0.5 }); const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M); b.scale.set(1.3, 1.1, 5.5); g.add(b); const fin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 4), M); fin.position.set(0, 1.9, -0.6); fin.rotation.x = -0.35; g.add(fin); const tl = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 4), M); tl.rotation.x = -H2; tl.position.z = -6; tl.scale.x = 0.25; g.add(tl); g.scale.setScalar(1.4); OC.add(g); return g; };
      const SH = [0, 1, 2].map((k) => ({ g: mkShark(), r: 120 + k * 50, a: k * 2.1, sp: (k % 2 ? -1 : 1) * 0.09 }));
      const mkWhale = () => { const g = new THREE.Group(), M = new THREE.MeshStandardMaterial({ color: 0x2c4a6b, roughness: 0.45 }), W = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.6 }); const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M); b.scale.set(5.5, 4.6, 20); g.add(b); const bel = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), W); bel.scale.set(4.6, 3, 16); bel.position.set(0, -1.9, 2); g.add(bel); const tail = new THREE.Group(); tail.position.z = -19; g.add(tail); [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M); f.scale.set(5, 0.5, 2.4); f.position.set(s * 4.2, 0, -1.8); f.rotation.y = s * 0.5; tail.add(f); const p = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M); p.scale.set(4.5, 0.5, 1.8); p.position.set(s * 6, -2.2, 6); p.rotation.set(0, s * 0.6, s * 0.4); g.add(p); }); [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0a0a12 })); e.position.set(s * 4.6, 0.6, 12); g.add(e); }); g.userData.tail = tail; OC.add(g); return g; };
      const WH = [0, 1].map((k) => ({ g: mkWhale(), ph: k * 0.5, P: 110 + k * 25, r0: 1070 + k * 70, dir: k ? -1 : 1, last: 0 }));
      // espuma y salpicaduras (un solo sistema de partículas)
      const SPN = 500, spG = new THREE.BufferGeometry(), spP = new Float32Array(SPN * 3), spV = new Float32Array(SPN * 3), spL = new Float32Array(SPN); for (let i = 0; i < SPN; i++) spP[i * 3 + 1] = -999; spG.setAttribute('position', new THREE.BufferAttribute(spP, 3)); const spray = new THREE.Points(spG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.85, depthWrite: false })); spray.frustumCulled = false; OUT.add(spray); let spI = 0;
      window.__SPRAY = (x, y, z, n, spd, up) => { for (let k = 0; k < n; k++) { const i = spI++ % SPN; spP[i * 3] = x; spP[i * 3 + 1] = y; spP[i * 3 + 2] = z; const a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7); spV[i * 3] = Math.cos(a) * v; spV[i * 3 + 1] = up * (0.5 + Math.random() * 0.8); spV[i * 3 + 2] = Math.sin(a) * v; spL[i] = 0.8 + Math.random() * 0.9; } };
      // calamar gigante que asoma del agua y agita los tentáculos; y bancos de niebla de sueño en el desierto y en el bosque del mar
      const SQ = (() => { const g = new THREE.Group(), M = new THREE.MeshPhysicalMaterial({ color: 0xff6fb5, roughness: 0.25, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color(0x9be7ff) }); const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), M); head.scale.set(9, 22, 9); head.position.y = 22; g.add(head); [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.2 })); e.position.set(s * 6.5, 8, 5); g.add(e); }); const T = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, arm = new THREE.Group(); arm.position.set(Math.cos(a) * 5, 2, Math.sin(a) * 5); g.add(arm); const segs = []; let par = arm; for (let k = 0; k < 7; k++) { const sg = new THREE.Group(); sg.position.y = k ? -5 : 0; par.add(sg); const m = new THREE.Mesh(new THREE.SphereGeometry(2.2 - k * 0.25, 10, 8), M); m.scale.y = 2.4; m.position.y = -2.5; sg.add(m); segs.push(sg); par = sg; } arm.rotation.set(Math.cos(a) * 2.2, 0, -Math.sin(a) * 2.2); T.push({ arm, segs, a }); } g.scale.setScalar(1.6); OC.add(g); return { g, T }; })();
      const FOG = new THREE.Group(); OUT.add(FOG); { const ft = (() => { const c = Y2K.cnv(256, 256), q = c.getContext('2d'), r = q.createRadialGradient(128, 128, 10, 128, 128, 128); r.addColorStop(0, 'rgba(255,240,250,.55)'); r.addColorStop(1, 'rgba(255,240,250,0)'); q.fillStyle = r; q.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })(); [[80, -500, 180], [-640, 80, 200], [-760, -760, 160]].forEach(([x, z, R0]) => { for (let i = 0; i < 9; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, transparent: true, depthWrite: false, opacity: 0.5, color: [0xffe0f4, 0xd8f4ff, 0xfff4d8][i % 3] })); const a = i * 0.7, r = Math.random() * R0; sp.position.set(x + Math.cos(a) * r, DY - 4 + Math.random() * 10, z + Math.sin(a) * r); sp.scale.set(120 + Math.random() * 80, 40 + Math.random() * 25, 1); sp.userData.ph = Math.random() * 6; FOG.add(sp); } }); }
      anim.push((dt, t) => { const out = !!window.ATM_OUT; FOG.visible = out && cam.position.y < 500; if (FOG.visible) FOG.children.forEach((s) => { s.position.x += Math.sin(t * 0.05 + s.userData.ph) * dt * 2; s.material.opacity = 0.35 + 0.15 * Math.sin(t * 0.3 + s.userData.ph); }); if (!out) return; const u = (t / 70) % 1, up = u < 0.45 ? Math.sin(u / 0.45 * Math.PI) : 0; SQ.g.position.set(320, G0 - 40 + up * 46, 880); SQ.g.rotation.y = t * 0.05; const B = window.__BANDS || { b: 0 }; SQ.T.forEach((q, i) => q.segs.forEach((sg, k) => { sg.rotation.x = Math.sin(t * 1.6 + i + k * 0.6) * (0.18 + B.b * 0.2); sg.rotation.z = Math.cos(t * 1.2 + i * 0.7 + k * 0.5) * 0.15; })); });
      window.__OCEAN = OC;
      anim.push((dt, t) => { const out = !!window.ATM_OUT, cp = cam.position; OC.visible = out && cp.y < 1400; spray.visible = out; if (!out) return; const W0 = window.__WAVE || (() => 0);
        for (let i = 0; i < SPN; i++) { if (spL[i] <= 0) continue; spL[i] -= dt; spV[i * 3 + 1] -= 30 * dt; spP[i * 3] += spV[i * 3] * dt; spP[i * 3 + 1] += spV[i * 3 + 1] * dt; spP[i * 3 + 2] += spV[i * 3 + 2] * dt; if (spL[i] <= 0) spP[i * 3 + 1] = -999; } spG.attributes.position.needsUpdate = true;
        if (!OC.visible) return; const near = cp.y < 260;
        if (near) { let n = 0; SCH.forEach((S) => { S.a += S.sp * dt; const cx = Math.cos(S.a) * S.r, cz = Math.sin(S.a) * S.r, cy = G0 - Math.min(DEP(S.r) - 1.2, S.d), hd = S.a + (S.sp > 0 ? H2 : -H2); S.off.forEach(([ox, oy, oz, ph]) => { O3.position.set(cx + ox + Math.sin(t * 1.3 + ph) * 0.8, cy + oy + Math.sin(t * 2 + ph) * 0.3, cz + oz + Math.cos(t * 1.1 + ph) * 0.8); O3.rotation.set(0, -hd + Math.sin(t * 6 + ph) * 0.25, 0); O3.scale.setScalar(1); O3.updateMatrix(); fish.setMatrixAt(n++, O3.matrix); }); }); fish.instanceMatrix.needsUpdate = true; }
        fish.visible = co.visible = al.visible = near;
        SH.forEach((S) => { S.a += S.sp * dt; const x = -150 + Math.cos(S.a) * S.r, z = -900 + Math.sin(S.a) * S.r; S.g.position.set(x, G0 + W0(x, z, t) - 1.9, z); S.g.rotation.y = -S.a + (S.sp > 0 ? Math.PI : 0); S.g.rotation.z = Math.sin(t * 2 + S.r) * 0.08; });
        WH.forEach((Wh) => { const u = ((t / Wh.P) + Wh.ph) % 1, a = Wh.dir * u * TAU, rad = Wh.r0 + Math.sin(u * TAU * 2) * 35; const x = Math.cos(a) * rad, z = Math.sin(a) * rad; let y = G0 - 7 + Math.sin(t * 0.4) * 1.5, pitch = 0; if (u > 0.55 && u < 0.97) { const k = (u - 0.55) / 0.42, arc = Math.sin(k * Math.PI); y = G0 - 7 + arc * 520; pitch = -Math.cos(k * Math.PI) * 0.55; } const g = Wh.g; const px = g.position.x, pz = g.position.z, py = g.position.y; g.position.set(x, y, z); const dx = x - px, dz = z - pz; if (dx * dx + dz * dz > 1e-6) g.rotation.y = Math.atan2(dx, dz); g.rotation.x = pitch; g.userData.tail.rotation.x = Math.sin(t * (y > G0 + 5 ? 2.2 : 1.2)) * 0.35; const wl = G0 + 1; if ((py - wl) * (y - wl) < 0 && t - Wh.last > 2) { Wh.last = t; window.__SPRAY(x, wl + 1, z, 140, 14, 26); } });
        if (ROAMS.on && ROAMS.wet && ROAMS.board && ROAMS.moving && !ROAMS.fly) { const fx = Math.sin(ROAMS.cy || ROAMS.yaw), fz = -Math.cos(ROAMS.cy || ROAMS.yaw); window.__SPRAY(ROAMS.p.x - fx * 3, -8.9 + (ROAMS.h || 0), ROAMS.p.z - fz * 3, 3, 4, 7 * (ROAMS.surfV || 1)); } });
    } catch (e) { console.warn('ocean', e); }
    for (let k = 0; k < 0; k++) { const a = k / 12 * TAU, rr2 = 150 + (k % 3) * 25; const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshPhysicalMaterial({ color: [0x2fbf4a, 0x5ee36a, 0x8fe3a0][k % 3], roughness: 0.4, clearcoat: 0.5 })); h.scale.set(40 + (k % 4) * 10, 14 + (k % 3) * 8, 30); h.position.set(Math.sin(a) * rr2, -6, -Math.cos(a) * rr2); h.rotation.y = -a; OUT.add(h); }
    { const city = new THREE.Group(); city.position.set(70, DY - 9.0, 150); city.visible = false; const winT = cnv(64, 128, (g) => { g.fillStyle = '#9fd0ff'; g.fillRect(0, 0, 64, 128); g.fillStyle = 'rgba(255,255,255,.8)'; for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 12) if (Math.random() < 0.7) g.fillRect(x, y, 7, 6); }); winT.wrapS = winT.wrapT = THREE.RepeatWrapping; for (let i = 0; i < 26; i++) { const h = 10 + Math.random() * 40, w = 5 + Math.random() * 6; const t2 = winT.clone(); t2.needsUpdate = true; t2.repeat.set(1, h / 12); const b = mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshPhysicalMaterial({ map: t2, color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.4, 0.75), roughness: 0.2, clearcoat: 1, emissive: 0x335577, emissiveIntensity: 0.15 })); b.position.set((i % 7) * 11 - 33 + Math.random() * 3, h / 2, Math.floor(i / 7) * 12 + Math.random() * 3); city.add(b); } }
    const glowT = cnv(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 4, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,240,1)'); r.addColorStop(0.25, 'rgba(255,250,210,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); sun.scale.setScalar(26); sun.position.set(22, 26, -85); OUT.add(sun);
    const cloudT = cnv(256, 128, (g) => { g.fillStyle = '#fff'; [[70, 80, 46], [120, 60, 56], [170, 78, 44], [110, 90, 50]].forEach(([x, y, r]) => { const gg = g.createRadialGradient(x, y - r * 0.3, 4, x, y, r); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); });
    const clouds = Array.from({ length: 9 }, (_, i) => { const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudT, transparent: true, depthWrite: false, toneMapped: false })); c.scale.set(22, 11, 1); c.position.set(-80 + i * 20, 22 + Math.random() * 12, -70 + Math.random() * 10); OUT.add(c); return c; });
    const HILL = (col, z, y, sx, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, clearcoat: 0.6, emissive: col, emissiveIntensity: 0.12 })); m.scale.set(sx, 8, sz); m.position.set(0, y, z); OUT.add(m); return m; };
    const hills = [HILL(0x2fbf4a, -60, -6, 70, 14), HILL(0x5ee36a, -42, -7.5, 48, 10), HILL(0x15a03a, -30, -8.5, 26, 8)]; hills[1].position.x = -24; hills[2].position.x = 26;

    { const pig = new THREE.Group(); const pk = new THREE.MeshPhysicalMaterial({ color: 0xffa8c8, roughness: 0.4, clearcoat: 0.5 }); const pb = mesh(new THREE.SphereGeometry(3, 24, 16), pk); pb.scale.set(1.4, 1, 1); pig.add(pb); const sn = mesh(new THREE.CylinderGeometry(1, 1, 0.8, 16).rotateZ(H2), pk); sn.position.x = 4.2; pig.add(sn); const wings = [-1, 1].map((sz) => { const w = mesh(new THREE.SphereGeometry(2, 16, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); w.scale.set(1, 0.15, 1.8); w.position.set(0, 1.6, sz * 2.8); pig.add(w); return w; }); for (const [x, z] of [[2, 1.5], [2, -1.5], [-2, 1.5], [-2, -1.5]]) { const l = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 8), pk); l.position.set(x, -2.6, z); pig.add(l); } pig.position.set(0, 60, 0); OUT.add(pig);
      const shapes = ['heart', 'star', 'rabbit', 'note', 'fish'].map((k) => cnv(256, 160, (g) => { g.fillStyle = '#fff'; const blob = (x, y, r) => { const gg = g.createRadialGradient(x, y, 2, x, y, r); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }; const P = { heart: [[100, 60, 40], [156, 60, 40], [128, 100, 44]], star: [[128, 40, 30], [80, 80, 30], [176, 80, 30], [100, 125, 28], [156, 125, 28], [128, 85, 36]], rabbit: [[110, 100, 44], [150, 90, 30], [140, 40, 14], [158, 40, 14], [140, 60, 14], [158, 60, 14]], note: [[90, 115, 32], [150, 100, 32], [110, 60, 12], [170, 45, 12], [140, 40, 14]], fish: [[120, 80, 46], [180, 80, 26], [205, 60, 18], [205, 100, 18]] }[k]; P.forEach(([x, y, r]) => blob(x, y, r)); }));
      const sc = shapes.map((t2, i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t2, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })); sp.scale.set(36, 22, 1); sp.position.set(-80 + i * 40, 70 + (i % 2) * 12, -40 + (i % 3) * 30); sp.visible = false; OUT.add(sp); return sp; });
      anim.push((dt, t) => { const a = t * 0.06; pig.position.set(Math.cos(a) * 55, 58 + Math.sin(t * 0.7) * 4, Math.sin(a) * 55 + 20); pig.rotation.y = -a - H2; wings.forEach((w, k) => { w.rotation.x = Math.sin(t * 8) * 0.6 * (k ? 1 : -1); }); sc.forEach((sp, i) => { const ph = (t * 0.05 + i / sc.length) % 1; sp.material.opacity = Math.max(0, Math.sin(ph * Math.PI)) * 0.9; sp.position.x += dt * 2; if (sp.position.x > 120) sp.position.x = -120; sp.scale.set(36 + Math.sin(t * 0.3 + i) * 6, 22 + Math.cos(t * 0.25 + i) * 4, 1); }); }); }
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshPhysicalMaterial({ color: 0x29b6ff, roughness: 0.06, metalness: 0.3, clearcoat: 1, emissive: 0x0a5aa0, emissiveIntensity: 0.25 })); lake.rotation.x = -H2; lake.position.set(0, -1.2, -24); OUT.add(lake);
    const TR = new THREE.MeshPhysicalMaterial({ color: 0x3be35a, roughness: 0.2, clearcoat: 1, emissive: 0x1a8a2a, emissiveIntensity: 0.2 }), TK = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }); const trees = [];
    [[-30, -40], [-22, -33], [-14, -45], [12, -38], [20, -31], [32, -44], [-36, -52], [40, -55]].forEach(([x, z]) => { const t = new THREE.Group(); t.position.set(x, DY - 9.15, z); const tk = mesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 10), TK); tk.position.y = 2; t.add(tk); const cr = mesh(new THREE.SphereGeometry(2.2, 24, 16), TR); cr.position.y = 5; t.add(cr); OUT.add(t); trees.push(t); });
    const BUB = new THREE.MeshPhysicalMaterial({ color: 0xdff8ff, transmission: 0.9, roughness: 0, thickness: 0.2, ior: 1.2, iridescence: 1, iridescenceIOR: 1.6, transparent: true, opacity: 0.55, depthWrite: false });
    const bubbles = Array.from({ length: 22 }, () => { const b = mesh(new THREE.SphereGeometry(0.6 + Math.random() * 1.2, 20, 14), BUB); b.position.set(-40 + Math.random() * 80, Math.random() * 30, -20 - Math.random() * 40); b.userData.v = 0.6 + Math.random() * 1.2; OUT.add(b); return b; });
    const birds = Array.from({ length: 5 }, (_, i) => { const g = new THREE.Group(); const wM = new THREE.MeshBasicMaterial({ color: 0x223355 }); const l = mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), wM), r = mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), wM); l.position.x = -0.55; r.position.x = 0.55; g.add(l, r); g.userData = { l, r, p: Math.random() * 10, y: 18 + i * 2.5, z: -50 - i * 4, s: 4 + i }; OUT.add(g); return g; });
    const ufo = new THREE.Group(); { ufo.add(mesh(new THREE.SphereGeometry(2, 24, 12), new THREE.MeshStandardMaterial({ color: 0xb8c0d8, metalness: 0.9, roughness: 0.2 }))); ufo.children[0].scale.y = 0.3; const dm = mesh(new THREE.SphereGeometry(0.9, 20, 12, 0, TAU, 0, H2), new THREE.MeshBasicMaterial({ color: 0x7dff4a, transparent: true, opacity: 0.8 })); dm.position.y = 0.3; ufo.add(dm); ufo.visible = false; ufo.position.set(-120, 30, -70); OUT.add(ufo); } let ufoT = 30 + Math.random() * 60;
    anim.push((dt, t, lv) => { clouds.forEach((c, i) => { c.position.x += dt * (0.8 + i * 0.12); if (c.position.x > 100) c.position.x = -100; c.material.opacity = dark ? 0.25 : 0.95; }); bubbles.forEach((b) => { b.position.y += dt * b.userData.v * (1 + lv * 2); b.position.x += Math.sin(t * 0.5 + b.userData.v * 7) * dt * 0.6; if (b.position.y > 34) { b.position.y = -2; b.position.x = -40 + Math.random() * 80; } b.scale.setScalar(1 + lv * 0.5); });
      birds.forEach((b) => { const u = b.userData; b.position.set(((t * u.s + u.p * 30) % 200) - 100, u.y + Math.sin(t + u.p) * 1.5, u.z); const fl = Math.sin(t * 9 + u.p) * 0.6; u.l.rotation.z = fl; u.r.rotation.z = -fl; b.visible = !dark; });
      trees.forEach((tr, i) => { tr.rotation.z = Math.sin(t * 0.8 + i) * 0.03 * (1 + lv * 3); }); sun.scale.setScalar((dark ? 10 : 26) * (1 + lv * 0.25)); sun.material.color.set(dark ? 0xfff6cc : 0xffffff); hills.forEach((h, i) => { h.material.emissiveIntensity = (dark ? 0.03 : 0.12) + lv * 0.25 * (i + 1) / 3; });
      ufoT -= dt; if (ufoT < 0 && !ufo.visible && Math.random() < 0.3) { ufo.visible = true; ufo.position.set(-120, 26 + Math.random() * 10, -70); } if (ufoT < 0 && !ufo.visible) ufoT = 40 + Math.random() * 60; if (ufo.visible) { ufo.position.x += dt * 30; ufo.position.y += Math.sin(t * 3) * 0.05; ufo.rotation.y += dt * 3; if (ufo.position.x > 120) { ufo.visible = false; ufoT = 60 + Math.random() * 120; } } });

    // ciclo de día y noche (8 min): mañana, día, tarde y noche; de noche se encienden las luces solas y salen estrellas y planetas
    { const planets = [[0xffb36b, 4], [0x9fd0ff, 2.6]].map(([c, r], i) => { const p = mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: c })); p.position.set(-60 + i * 110, 70 + i * 20, -150); OUT.add(p); return p; }); const sunset = new THREE.Color(1, 0.62, 0.45), white = new THREE.Color(1, 1, 1), night = new THREE.Color(0.55, 0.6, 0.9);
      R.userData.dayT = 0.3; anim.push((dt) => { const D0 = (R.userData.dayT = (R.userData.dayT + dt / 480) % 1); const sunH = Math.sin(D0 * TAU - H2 + Math.PI / 2 * 0); const dl = clamp(Math.sin(D0 * TAU) * 1.4 + 0.2, 0, 1); R.userData.dl = dl; if (!dark) { skyM.map = dl < 0.18 ? skyNight : skyDay; skyM.color.copy(dl < 0.18 ? white : dl < 0.45 ? sunset.clone().lerp(white, (dl - 0.18) / 0.27) : white); skyM.needsUpdate = true; LIT.forEach((o) => { o.l.intensity = o.i * (0.3 + 0.7 * dl); }); WM.color.setScalar(0.55 + 0.45 * dl); } planets.forEach((p) => (p.visible = false)); sun.position.set(Math.cos(D0 * TAU) * 90, 10 + Math.sin(D0 * TAU) * 60, -85); sun.visible = dl > 0.1; }); }
    // --- tele de tubo (con secreto) ---
    const tvC = Y2K.cnv(320, 240), tvG = tvC.getContext('2d'), tvT = Y2K.toTex(tvC, { color: true }); let tvPos;
    { const tv = new THREE.Group(); tv.position.set(-9.3, DY, -4.4); tv.rotation.y = 0.4; tv.scale.setScalar(0.85); R.add(tv); tvPos = tv.position; const shell = new THREE.MeshPhysicalMaterial({ color: 0x9aa3b8, metalness: 0.4, roughness: 0.3, clearcoat: 1 }); const bx = mesh(rbox(4.0, 3.4, 3.4, 0.35), shell); bx.position.y = 1.7; tv.add(bx);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshBasicMaterial({ map: tvT, toneMapped: false })); scr.position.set(0, 1.8, 1.72); tv.add(scr); for (const [w, h, x, y] of [[3.6, 0.2, 0, 3.1], [3.6, 0.2, 0, 0.5], [0.2, 2.8, -1.7, 1.8], [0.2, 2.8, 1.7, 1.8]]) { const fb = mesh(new THREE.BoxGeometry(w, h, 0.12), M.blackGloss); fb.position.set(x, y, 1.74); tv.add(fb); }
      let tt = 0, ch = 3; picks.push({ o: tv, f: () => { ch = (ch + 1) % 8; hap(0.3); } });
      anim.push((dt, t, lv) => { tt -= dt; if (tt > 0) return; tt = 0.1; const g = tvG; g.fillStyle = '#04061a'; g.fillRect(0, 0, 320, 240); if (secretT > 0) { g.fillStyle = '#ff2a4a'; g.font = '700 18px "Share Tech Mono", monospace'; ['THE DRAGON AWAKENS', 'AT 3:33', '', 'DO NOT TELL', 'ANYONE'].forEach((l, i) => g.fillText(l, 50, 60 + i * 30)); }
        else if (ch === 0) { for (let i = 0; i < 24; i++) { const h = (0.25 + 0.75 * Math.abs(Math.sin(t * 2.5 + i * 0.7))) * (40 + lv * 160); g.fillStyle = `hsl(${(i * 15 + t * 40) % 360},90%,60%)`; g.fillRect(12 + i * 12.4, 200 - h, 9, h); } g.fillStyle = '#fff'; g.font = '700 22px Orbitron, Arial'; g.fillText('UNFIRE TV', 92, 34); }
        else if (ch === 1) { for (let i = 0; i < 3000; i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 320, Math.random() * 240, 3, 3); } }
        else if (ch >= 3) { const k = ch === 3 ? Math.floor(t / 6) % 5 : (ch - 3) % 5;
          if (k === 0) { g.fillStyle = '#c0c0c0'; g.fillRect(20, 40, 280, 160); g.fillStyle = '#000080'; g.fillRect(20, 40, 280, 20); g.fillStyle = '#fff'; g.font = '700 13px Tahoma'; g.fillText('Conectando a Internet...', 28, 55); g.fillStyle = '#000'; g.fillText('Marcando 56k  ♪ piiii-krrrr-shhh', 34, 90); const p = (t * 0.15) % 1; g.strokeRect(34, 120, 252, 18); g.fillStyle = '#000080'; for (let i = 0; i < 25 * p; i++) g.fillRect(36 + i * 10, 122, 8, 14); g.fillStyle = '#000'; g.fillText(Math.floor(p * 100) + '%  ·  tiempo restante: 3 horas', 34, 160); }
          else if (k === 1) { const b = Math.sin(t * 8); g.fillStyle = '#ffe9a8'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(160, 150, 60, 50, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(115, 110); g.lineTo(125, 70); g.lineTo(145, 105); g.fill(); g.beginPath(); g.moveTo(205, 110); g.lineTo(195, 70); g.lineTo(175, 105); g.fill(); g.fillStyle = '#111'; g.fillRect(138, 135, 10, 10); g.fillRect(172, 135, 10, 10); g.fillStyle = '#222'; g.fillRect(70, 200, 180, 30); g.fillStyle = '#fff'; for (let i = 0; i < 9; i++) g.fillRect(74 + i * 20, 203, 16, 24); g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(120 + b * 10, 195, 14, 10, 0, 0, TAU); g.ellipse(200 - b * 10, 195, 14, 10, 0, 0, TAU); g.fill(); g.fillStyle = '#000'; g.font = '900 20px Impact'; g.fillText('GATO PIANISTA.WMV', 70, 30); }
          else if (k === 2) { g.fillStyle = '#5fc8ff'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#9aa3b2'; g.fillRect(0, 180, 320, 60); const u = (t * 0.5) % 1, x = 40 + u * 240, fall = u > 0.6; g.save(); g.translate(x, fall ? 180 : 160 - Math.sin(u * Math.PI / 0.6) * 40); g.rotate(fall ? (u - 0.6) * 12 : 0); g.fillStyle = '#222'; g.fillRect(-16, 18, 32, 4); g.fillStyle = '#ff2fb0'; g.fillRect(-5, -10, 10, 22); g.beginPath(); g.arc(0, -16, 7, 0, TAU); g.fill(); g.restore(); if (fall) { g.fillStyle = '#fff'; g.font = '900 34px Impact'; g.fillText('¡FAIL!', 110, 80); } g.fillStyle = '#fff'; g.font = '700 12px Tahoma'; g.fillText('caida_epica_FINAL(2).avi', 10, 20); }
          else if (k === 3) { g.fillStyle = '#000'; g.fillRect(0, 0, 320, 240); const fl = Math.floor(t * 4) % 2; g.fillStyle = fl ? '#ffd21a' : '#ff2a4a'; g.fillRect(30, 40, 260, 160); g.fillStyle = fl ? '#ff2a4a' : '#ffd21a'; g.font = '900 22px Impact'; g.textAlign = 'center'; g.fillText('CONGRATULATIONS!', 160, 80); g.font = '700 16px Arial'; g.fillText('You are visitor 1,000,000', 160, 115); g.fillText('YOU WON AN MP3!', 160, 145); g.fillStyle = '#fff'; g.fillRect(110, 160, 100, 26); g.fillStyle = '#000'; g.fillText('CLICK HERE', 160, 178); g.textAlign = 'left'; }
          else { const r = t * 3; g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 240); g.save(); g.translate(160, 130); g.rotate(r); g.fillStyle = '#ffd21a'; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill(); g.fillStyle = '#000'; g.fillRect(-22, -18, 12, 8); g.fillRect(10, -18, 12, 8); g.beginPath(); g.arc(0, 8, 26, 0, Math.PI); g.fill(); g.restore(); g.fillStyle = '#000'; g.font = '900 30px "Comic Sans MS"'; g.fillText('ROFL  LOL  XD', 50, 40); } }
        else { g.fillStyle = '#b6ff3b'; g.font = '700 20px "Share Tech Mono", monospace'; g.fillText('CHANNEL 2000 · ROBOTS', 40, 50); g.fillText('▶ ' + new Date().toTimeString().slice(0, 8), 40, 90); g.fillText(Math.random() < 0.02 ? 'Have you seen the UFO?' : '', 40, 140); }
        g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 240; y += 3) g.fillRect(0, y, 320, 1); tvT.needsUpdate = true; }); }
    // --- lámpara de lava ---
    { const ll = new THREE.Group(); ll.position.set(9.2, DY, -4.2); R.add(ll); const met = new THREE.MeshPhysicalMaterial({ color: 0xd8dee8, metalness: 1, roughness: 0.2 }); const b0 = mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.4, 32), met); b0.position.y = 0.7; ll.add(b0); const tp = mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.7, 32), met); tp.position.y = 4.35; ll.add(tp);
      const gl = mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.6, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xff8ad8, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, emissive: 0xff2fb0, emissiveIntensity: 0.25 })); gl.position.y = 2.7; ll.add(gl);
      const BL = new THREE.MeshStandardMaterial({ color: 0xff7a1f, emissive: 0xff4a00, emissiveIntensity: 1.2, roughness: 0.3 }); const blobs = Array.from({ length: 6 }, () => { const m = mesh(new THREE.SphereGeometry(0.16 + Math.random() * 0.12, 16, 12), BL); ll.add(m); return { m, p: Math.random() * 10, s: 0.15 + Math.random() * 0.2 }; }); const pl = new THREE.PointLight(0xff6a2a, 1.2, 9, 2); pl.position.y = 2.6; ll.add(pl); let on = true;
      picks.push({ o: ll, f: () => { on = !on; hap(0.3); } }); anim.push((dt, t, lv) => { blobs.forEach((b, i) => { const y = 1.6 + (Math.sin(t * b.s + b.p) * 0.5 + 0.5) * 2.1; b.m.position.set(Math.sin(t * 0.3 + i) * 0.18, y, Math.cos(t * 0.27 + i) * 0.18); b.m.scale.set(1, 1.2 + Math.sin(t * 0.8 + i) * 0.25, 1); }); BL.emissiveIntensity = on ? 1.2 + lv : 0.05; pl.intensity = on ? (dark ? 2.6 : 1) + lv * 1.5 : 0; }); }

    // --- flexo = interruptor de la luz ---
    { const dl = new THREE.Group(); dl.position.set(11.0, DY, -1.5); R.add(dl); const met = new THREE.MeshPhysicalMaterial({ color: 0xe8ecf4, metalness: 1, roughness: 0.15 }); dl.add(mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.2, 32), met)); const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 12), met); arm.position.set(-0.4, 1.6, 0); arm.rotation.z = 0.25; dl.add(arm); const hd = mesh(new THREE.ConeGeometry(0.7, 1.0, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x3d8bff, metalness: 0.3, roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide })); hd.position.set(-1.0, 3.1, 0); hd.rotation.z = -2.3; dl.add(hd); picks.push({ o: dl, f: () => toggleDark() }); }
    const sw = new THREE.Group(); { sw.position.set(-WX - 1.6, 4.2, WZ + 0.05); R.add(sw); sw.add(mesh(rbox(0.9, 1.4, 0.12, 0.08), FR)); const k = mesh(rbox(0.3, 0.5, 0.18, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd21a, emissive: 0xffb000, emissiveIntensity: 0.6 })); k.position.z = 0.1; sw.add(k); sw.userData.k = k; picks.push({ o: sw, f: () => toggleDark() }); }
    // --- CDs, reproductor, consola portátil y coches de juguete con física ---
    { const cdM = new THREE.MeshPhysicalMaterial({ color: 0xdfe6f2, metalness: 1, roughness: 0.08, iridescence: 1, iridescenceIOR: 1.8 }); for (let i = 0; i < 5; i++) { const cs = mesh(rbox(1.45, 0.12, 1.3, 0.03), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setHSL(i * 0.18, 0.7, 0.55), transmission: 0.5, roughness: 0.1, transparent: true, opacity: 0.85 })); cs.position.set(-10.2, DY + 0.06 + i * 0.125, 1.6); cs.rotation.y = (i - 2) * 0.12; R.add(cs); }
      const cd = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 48), cdM); cd.position.set(-8.6, DY + 0.25, 2.6); R.add(cd); const dm = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.22, 48), new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, metalness: 0.6, roughness: 0.2, clearcoat: 1 })); dm.position.set(-8.6, DY + 0.11, 2.6); R.add(dm); anim.push((dt) => { cd.rotation.y += dt * 4; });
      const gb = new THREE.Group(); gb.position.set(7.4, DY, 3.2); gb.rotation.set(0, -0.5, 0); R.add(gb); const gbM = new THREE.MeshPhysicalMaterial({ color: 0x8a5cff, transmission: 0.45, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.9 }); const gbb = mesh(rbox(1.5, 0.25, 2.3, 0.2), gbM); gbb.position.y = 0.13; gb.add(gbb); const gc = Y2K.cnv(96, 80), gx = gc.getContext('2d'), gt = Y2K.toTex(gc, { color: true }); const gs = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.8), new THREE.MeshBasicMaterial({ map: gt, toneMapped: false })); gs.rotation.x = -H2; gs.position.set(0, 0.27, -0.45); gb.add(gs); for (const [x, z, c] of [[-0.4, 0.55, 0x222222], [0.35, 0.45, 0xff2a4a], [0.55, 0.65, 0xff2a4a]]) { const b = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16), new THREE.MeshStandardMaterial({ color: c })); b.position.set(x, 0.28, z); gb.add(b); }
      let gtT = 0, px = 20; anim.push((dt, t) => { gtT -= dt; if (gtT > 0) return; gtT = 0.12; gx.fillStyle = '#9bbc0f'; gx.fillRect(0, 0, 96, 80); gx.fillStyle = '#0f380f'; px = (px + 3) % 110; gx.fillRect(px - 10, 52, 10, 10); gx.fillRect(0, 62, 96, 3); for (let k = 0; k < 3; k++) gx.fillRect(((k * 40 - t * 30) % 96 + 96) % 96, 44, 6, 18); gt.needsUpdate = true; }); picks.push({ o: gb, f: () => { hap(0.2); px = 0; } });
      const cars = [].map(([col, x, z], i) => { const c = new THREE.Group(); c.position.set(x, DY, z); c.rotation.y = i * 1.3; R.add(c); const cm = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.5, roughness: 0.15, clearcoat: 1 }); const bd = mesh(rbox(1.8, 0.4, 0.9, 0.15), cm); bd.position.y = 0.38; c.add(bd); const cab = mesh(rbox(0.9, 0.35, 0.8, 0.15), new THREE.MeshPhysicalMaterial({ color: 0x223355, transmission: 0.4, roughness: 0.05, transparent: true, opacity: 0.85 })); cab.position.set(-0.1, 0.72, 0); c.add(cab); const wh = []; for (const [wx2, wz2] of [[-0.6, 0.48], [0.6, 0.48], [-0.6, -0.48], [0.6, -0.48]]) { const w2 = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 16).rotateX(H2), M.blackGloss); w2.position.set(wx2, 0.22, wz2); c.add(w2); wh.push(w2); } const st = { c, wh, vx: 0, vz: 0, r: 1.0 }; picks.push({ o: c, f: () => { const a = c.rotation.y; st.vx = Math.cos(a) * 9; st.vz = -Math.sin(a) * 9; hap(0.35); } }); return st; });
      anim.push((dt) => { cars.forEach((s) => { s.c.position.x += s.vx * dt; s.c.position.z += s.vz * dt; s.vx *= 1 - dt * 1.6; s.vz *= 1 - dt * 1.6; const p = s.c.position; if (Math.abs(p.x) > 12) { p.x = Math.sign(p.x) * 12; s.vx *= -0.5; } if (p.z > 4.6 || p.z < -6.8) { p.z = clamp(p.z, -6.8, 4.6); s.vz *= -0.5; } if (Math.abs(p.x) < CW / 2 + 1 && Math.abs(p.z) < CD / 2 + 1) { const dx = Math.abs(p.x) - (CW / 2 + 1), dz = Math.abs(p.z) - (CD / 2 + 1); if (dx > dz) { p.x = Math.sign(p.x) * (CW / 2 + 1); s.vx *= -0.5; } else { p.z = Math.sign(p.z) * (CD / 2 + 1); s.vz *= -0.5; } } const sp = Math.hypot(s.vx, s.vz); if (sp > 0.3) s.c.rotation.y = Math.atan2(-s.vz, s.vx); s.wh.forEach((w) => { w.rotation.z -= sp * dt * 3; }); });
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j], dx = b.c.position.x - a.c.position.x, dz = b.c.position.z - a.c.position.z, d = Math.hypot(dx, dz); if (d < 1.9 && d > 0) { const nx = dx / d, nz = dz / d, o = (1.9 - d) / 2; a.c.position.x -= nx * o; a.c.position.z -= nz * o; b.c.position.x += nx * o; b.c.position.z += nz * o; const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { a.vx += rv * nx; a.vz += rv * nz; b.vx -= rv * nx; b.vz -= rv * nz; hap(0.4); } } } }); }

    { const bagT = (c1, c2, txt) => cnv(256, 320, (g) => { const gr = g.createLinearGradient(0, 0, 256, 320); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, 256, 320); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(20, 0, 30, 320); g.fillStyle = '#fff'; g.font = '900 italic 52px Orbitron, Arial'; g.textAlign = 'center'; g.fillText(txt, 128, 170); g.font = '700 22px Michroma, Arial'; g.fillText('SABOR 2000', 128, 214); });
      [[bagT('#ff2a4a', '#ffb020', 'CRUNCH'), -7.4, 3.9, 0.5], [bagT('#1d4fd8', '#5fc8ff', 'ZAP!'), 7.6, 3.7, -0.6]].forEach(([t, x, z, r]) => { const b = mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ map: t, metalness: 0.6, roughness: 0.25, clearcoat: 1 })); b.scale.set(0.9, 0.22, 1.2); b.position.set(x, DY + 0.2, z); b.rotation.y = r; R.add(b); });
      const canT = (c, txt) => cnv(256, 128, (g) => { g.fillStyle = c; g.fillRect(0, 0, 256, 128); g.fillStyle = '#fff'; g.font = '900 34px Orbitron, Arial'; g.fillText(txt, 20, 76); });
      [[canT('#2bd96b', 'FIZZ 2K'), -8.2, -0.6, 0], [canT('#ff4fd8', 'VOLT'), 8.4, -1.2, 0], [canT('#ffc400', 'FIZZ 2K'), 8.6, 0.8, H2]].forEach(([t, x, z, rz]) => { const c = mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.2, 24), new THREE.MeshPhysicalMaterial({ map: t, metalness: 0.8, roughness: 0.2 })); c.position.set(x, DY + (rz ? 0.33 : 0.6), z); c.rotation.z = rz; R.add(c); });
      const mg = cnv(256, 340, (g) => { g.fillStyle = '#ffd21a'; g.fillRect(0, 0, 256, 340); g.fillStyle = '#1a1040'; g.font = '900 40px Orbitron, Arial'; g.fillText('BEAT', 18, 60); g.fillText('MAG', 18, 104); g.font = '700 18px Michroma, Arial'; g.fillText('Nº 47 · 2001', 18, 140); g.fillStyle = '#ff2fb0'; g.beginPath(); g.arc(150, 230, 70, 0, TAU); g.fill(); });
      [[-11.4, 3.6, 0.3], [-11.2, 3.5, -0.2]].forEach(([x, z, r], i) => { const m2 = mesh(new THREE.BoxGeometry(2.0, 0.04, 2.7), new THREE.MeshStandardMaterial({ map: mg, roughness: 0.6 })); m2.position.set(x, DY + 0.03 + i * 0.045, z); m2.rotation.y = r; R.add(m2); });
      { const con = new THREE.Group(); con.position.set(6.6, DY, -6.1); con.rotation.y = -0.3; R.add(con); const cm = new THREE.MeshPhysicalMaterial({ color: 0x2a2d38, roughness: 0.45, clearcoat: 0.3 }); const cb = mesh(rbox(2.6, 0.7, 2.0, 0.12), cm); cb.position.y = 0.35; con.add(cb); const lidc = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.3 })); lidc.position.set(-0.4, 0.72, 0); con.add(lidc); const led = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2bd96b })); led.position.set(0.9, 0.5, 1.0); con.add(led); const cur = new THREE.CatmullRomCurve3([V(5.6, DY + 0.35, -5.5), V(5.0, DY + 0.02, -5.0), V(4.4, DY + 0.02, -5.6), V(3.9, DY + 0.15, -5.75)]); R.add(mesh(new THREE.TubeGeometry(cur, 24, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 }))); }
      const pad = new THREE.Group(); pad.position.set(3.6, DY, -5.9); pad.rotation.y = 0.3; R.add(pad); const pm = new THREE.MeshPhysicalMaterial({ color: 0x3a3f4f, roughness: 0.3, clearcoat: 0.6 }); const pb = mesh(rbox(1.6, 0.3, 0.8, 0.25), pm); pb.position.y = 0.15; pad.add(pb); for (const sx of [-1, 1]) { const h = mesh(new THREE.SphereGeometry(0.35, 16, 12), pm); h.scale.set(1, 0.6, 1.3); h.position.set(sx * 0.7, 0.15, 0.25); pad.add(h); } [[0.45, 0x2bd96b], [0.62, 0xff2a4a], [0.5, 0x3d8bff]].forEach(([x, c], i) => { const b = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 })); b.position.set(x, 0.32, -0.12 + i * 0.1); pad.add(b); }); }
    // --- colección de transformables en la mesa ---
    try { [0, 5, 11].forEach((k, i) => { const spec = MUTANTS.list[k % MUTANTS.list.length]; const r0 = ROBOT.build(spec); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root), sz = bb.getSize(V(0, 0, 0)); w.scale.setScalar(1.6 / Math.max(sz.y, 0.001)); r0.root.position.y -= bb.min.y; w.position.set(5.2 + i * 1.3, DY, -3.4 - (i % 2) * 0.6); w.rotation.y = -0.4 + i * 0.2; R.add(w); const base = mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.7 })); base.position.set(w.position.x, DY + 0.06, w.position.z); R.add(base); const ph = Math.random() * 9; anim.push((dt, t, lv) => { const seq = ['dance', 'look', 'dance', 'cheer', 'talk', 'dance', 'wave', 'play'], cyc = Math.floor((t + ph * 3) / 6) % seq.length; r0.update(3.7, dt, { beatPhase: (t * (RADIO.bpm || 110) / 60), playing: false, act: RADIO.st.on || cyc % 2 === 0 ? seq[cyc] : null, mood: ['happy', 'star', 'wow', 'love'][cyc % 4], ph: t + ph }); w.rotation.y = -0.4 + i * 0.2 + Math.sin(t * 0.25 + ph) * 0.5; }); picks.push({ o: w, f: () => { hap(0.3); speakCollectible(spec); } }); }); } catch (e) { console.warn('coleccion', e); }
    // --- bola de discoteca con péndulo + puntos de luz ---
    const disco = new THREE.Group(); disco.position.set(6.5, CY, -2.0); R.add(disco); { const cap = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 20), M.chrome); cap.position.y = -0.07; disco.add(cap); const SL = CY - 9.6; const str = mesh(new THREE.CylinderGeometry(0.025, 0.025, SL, 6), M.chrome); str.position.y = -SL / 2; disco.add(str); const ball = mesh(new THREE.IcosahedronGeometry(1.5, 4), new THREE.MeshPhysicalMaterial({ color: 0xe8ecf4, metalness: 1, roughness: 0.06, flatShading: true, clearcoat: 1, envMapIntensity: 2 })); ball.position.y = -SL - 1.0; disco.add(ball); disco.userData = { ball, a: 0, v: 0 }; picks.push({ o: disco, f: () => { disco.userData.v += 1.2; discoN++; hap(0.4); if (discoN % 7 === 0) secretT = 8; } }); }
    const dotT = cnv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 1, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
    const dots = Array.from({ length: 18 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotT, color: new THREE.Color().setHSL(i / 18, 1, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s.scale.setScalar(0.9); R.add(s); return s; });
    anim.push((dt, t, lv) => { const u = disco.userData; u.v += (-u.a * 6 - u.v * 0.6) * dt; u.a += u.v * dt; disco.rotation.z = u.a * 0.3; u.ball.rotation.y += dt * (0.6 + lv * 2); dots.forEach((s, i) => { const a = t * (0.3 + lv) + i * 0.35; s.position.set(Math.cos(a) * (8 + (i % 3) * 3), 0.3 + ((i * 7) % 6) * 1.4, -7.4 + 0.1 + ((i % 2) ? 0 : 6) * 0 ); if (i % 2) s.position.set(Math.cos(a) * 11, DY + 0.05, Math.sin(a) * 5 - 1); s.material.opacity = dark ? 0.9 * (0.5 + lv) : 0; s.visible = dark; }); });
    // --- tiras LED que recorren el escritorio y el ventanal ---
    const NL = 120, led = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), new THREE.MeshBasicMaterial({ toneMapped: false }), NL); const dm2 = new THREE.Object3D(), col = new THREE.Color();
    for (let i = 0; i < NL; i++) { const u = i / NL; if (u < 0.5) dm2.position.set(-13 + u * 2 * 26, DY - 0.36, 5.1); else dm2.position.set(-WX + (u - 0.5) * 2 * 2 * WX, WY1 + 0.32, WZ + 0.25); dm2.updateMatrix(); led.setMatrixAt(i, dm2.matrix); led.setColorAt(i, col.setHSL(u, 1, 0.5)); } led.visible = false;
    anim.push((dt, t, lv) => { for (let i = 0; i < NL; i++) { col.setHSL(((i / NL) * 2 - t * 0.25) % 1 + 1, 1, 0.35 + 0.25 * lv + (dark ? 0.15 : 0)); led.setColorAt(i, col); } led.instanceColor.needsUpdate = true; }); anim.pop();
    // --- luz de la habitación ---
    const LIT = [S.key, S.rim, S.fill].filter(Boolean).map((l) => ({ l, i: l.intensity })); const EXP = S.renderer.toneMappingExposure;
    function toggleDark() { dark = !dark; R.userData.dark = dark; hap(0.6); LIT.forEach((o) => { o.l.intensity = dark ? o.i * 0.22 : o.i; }); S.renderer.toneMappingExposure = dark ? EXP * 0.8 : EXP; skyM.map = dark ? skyNight : skyDay; skyM.needsUpdate = true; WM.color.setScalar(dark ? 0.35 : 1); sw.userData.k.material.emissiveIntensity = dark ? 0.05 : 0.6; say(dark ? '🌙 Lights off · party mode' : '💡 Lights on'); }
    function speakCollectible(spec) { try { const ln = ['I am part of the collection! Pick up your capsule.', 'I transform in three steps. Did you see that?', 'Twenty robots like me live inside the case.']; say('🤖 ' + (spec.name || 'Robot') + ': ' + ln[Math.floor(Math.random() * ln.length)]); } catch (e) {} }
    // --- sonido ambiente: viento y pajaritos (muy bajo; se calla al grabar o al parar el sonido) ---
    const AMB = { on: false, mute: false, g: null, next: 0, gate: 0, lastGain: -1 }; function ambStart() { if (AMB.on || !UA.ctx || UA.ctx.state !== 'running') return; const c = UA.ctx; const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { l = (l + (Math.random() * 2 - 1) * 0.02) * 0.995; d[i] = l * 6; } const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(UA.bus.master); s.start(); AMB.g = g; AMB.f = f; AMB.on = true; }
    function chirp2() { if (!AMB.on || dark) return; const c = UA.ctx, n = c.currentTime, dist = 0.25 + Math.random() * 0.75, pan = c.createStereoPanner(), lp = c.createBiquadFilter(); pan.pan.value = Math.random() * 1.6 - 0.8; lp.type = 'lowpass'; lp.frequency.value = 6000 - dist * 3500; lp.connect(pan).connect(UA.bus.master); for (let k = 0; k < 2 + (Math.random() * 3 | 0); k++) { const o = c.createOscillator(), g = c.createGain(), t0 = n + k * 0.12; o.type = 'sine'; const f0 = 2600 + Math.random() * 1400; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t0 + 0.06); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t0 + 0.1); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.0028 * (1.2 - dist), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11); o.connect(g).connect(lp); o.start(t0); o.stop(t0 + 0.13); } }
    anim.push((dt, t, lv) => {
      // Every multiplayer client mixes its own room atmosphere ONCE. Never broadcast
      // ambient audio through PeerJS or start a second sound source on joining a room.
      const indoor = !!ROAMS.on && !window.ATM_OUT;
      const outdoor = !!ROAMS.on && !!window.ATM_OUT;
      // Preserve room/exterior ambience through scene recordings and mode changes.
      const canHear = (indoor || outdoor) && !AMB.mute && !document.hidden
        && UA.ctx && UA.ctx.state === 'running';
      if (!AMB.on) { if (canHear) ambStart(); return; }
      const want = canHear ? (outdoor ? 0.0017 : (dark ? 0.0011 : 0.0026)) : 0;
      AMB.gate -= dt;
      if (AMB.gate <= 0 || AMB.lastGain !== want) {
        AMB.gate = 0.25; AMB.lastGain = want;
        AMB.g.gain.setTargetAtTime(want, UA.ctx.currentTime, 0.25);
        AMB.f.frequency.setTargetAtTime(outdoor ? 320 : 210 + 65 * Math.sin(t * 0.15), UA.ctx.currentTime, 0.5);
      }
      if (!canHear) { AMB.car = Math.max(AMB.car || 0, 8); AMB.next = Math.max(AMB.next || 0, 4); } AMB.car = (AMB.car || 8) - dt; if (AMB.car < 0 && canHear && indoor) { AMB.car = 12 + Math.random() * 20; try { const c = UA.ctx, n = c.currentTime, len = c.sampleRate * 4, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { l = l * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = l * 5; } const sN = c.createBufferSource(); sN.buffer = b; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(250, n); f.frequency.linearRampToValueAtTime(700, n + 2); f.frequency.linearRampToValueAtTime(250, n + 4); const g = c.createGain(); g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(0.0045, n + 2); g.gain.linearRampToValueAtTime(0, n + 4); const p = c.createStereoPanner(); p.pan.setValueAtTime(-0.9, n); p.pan.linearRampToValueAtTime(0.9, n + 4); sN.connect(f).connect(g).connect(p).connect(UA.bus.master); sN.start(n); sN.stop(n + 4.1); } catch (e) {} } AMB.next -= dt; if (AMB.next < 0) { AMB.next = 2 + Math.random() * 5; if (canHear && indoor) chirp2(); } if (secretT > 0) secretT -= dt; });
    ROOMB(R, { RX, RZ, FY, CY, cnv }, picks, anim);
    window.__pick0 = picks.length; try { window.__MKDEV = (i, c) => { try { return window.__RC_D.device(i, c); } catch (e) { return null; } }; window.__RC = ROOMC({ R, picks, anim, RX, RZ, FY, CY, WZ, cnv, mesh, rbox, M, V, H2, TAU, MED: IMG.replace(/img\/?$/, 'media/'), hap, say, S, sky, clouds, OUT,
      blockers: [['W', 0, 5.8, 28.4, 11.4], ['W', -26, 15.5, 15.6, 9.6], ['W', -WX - 1.6, 4.2, 1.4, 1.8], ['W', WXp(), FY + 15.5, 16.6, 6.4], ['L', -4, FY + 5.3, 7.5, 10.8], ['L', 12, FY + 5.5, 4.6, 11.2], ['L', 46, FY + 4.5, 14.6, 6.6], ['L', -12, FY + 3.5, 2, 7.4], ['R', 4, FY + 6, 5.4, 12.4], ['R', -12, FY + 2.8, 11, 5.8], ['F', -30, FY + 8.3, 10, 17.2], ['F', -30, FY + 19.4, 12, 4.2], ['F', 12, FY + 5.5, 6.2, 11.4], ['F', -8, FY + 6, 15, 12.5], ['F', -1, FY + 1.5, 3, 3.2]],
      IMG, PLUGINS, MUTANTS, GROWAPI: () => window.__GROW, device: (i, closed) => { const spec = typeof i === 'object' ? i : PLUGINS.list[i % PLUGINS.list.length]; const dv = (spec.g3 ? GEAR3 : GEAR4).build(spec, kindOf(spec), Object.keys(ENGINES.PARAMS[spec.engine]).slice(0, 4).map((k) => k.toUpperCase())); for (let q = 0; q < 40; q++) dv.update(closed ? 0 : 2.2, 0.05, { level: 0 }); return dv; } }); } catch (e) { console.warn('ROOMC', e); }
    { const spT = cnv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 1, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(180,230,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }); const sps = []; setTimeout(() => picks.slice(0, window.__pick0 || 40).forEach((p, i) => { try { const bb = new THREE.Box3().setFromObject(p.o); if (!isFinite(bb.max.y)) return; const s0 = new THREE.Sprite(new THREE.SpriteMaterial({ map: spT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); s0.position.set((bb.min.x + bb.max.x) / 2, bb.max.y + 0.6, (bb.min.z + bb.max.z) / 2); s0.scale.setScalar(1.2); R.add(s0); sps.push({ s0, ph: i * 1.7 }); } catch (e) {} }), 500); anim.push((dt, t) => sps.forEach((q) => { const k = Math.max(0, Math.sin(t * 1.3 + q.ph)); q.s0.material.opacity = 0.06 + 0.22 * k * k; q.s0.scale.setScalar(0.6 + 0.3 * k); })); }
    return { R, AMB, gacha() { R.userData.gacha && R.userData.gacha(); }, tick(dt, t, lv) { anim.forEach((f) => { try { f(dt, t, lv); } catch (e) { if (!f.__w) { f.__w = 1; console.warn('anim', e && e.message, String(f).slice(0, 120)); } } }); }, pick(ray, maxD = Infinity) { const h = ray.intersectObjects(picks.map((p) => p.o), true)[0]; if (!h || h.distance > maxD) return false; const P = picks.find((p) => { let o = h.object; while (o) { if (o === p.o) return true; o = o.parent; } return false; }); if (P) { const directInteraction = ROAMS.on && P.noFocusWithin && nearRoomObject(ROAMS.p, P.o, P.noFocusWithin); P.f(); try { if (directInteraction) ROAMS.tgt = null; if (ROAMS.on && !P.noFocus && !directInteraction) { const bb = new THREE.Box3().setFromObject(P.o), c = bb.getCenter(V(0, 0, 0)), sz = bb.getSize(V(0, 0, 0)).length(); const d = V(cam.position.x - c.x, 0, cam.position.z - c.z).normalize(), dist = clamp(sz * 1.3 + 4, 7, 26); const side=V(-d.z,0,d.x);const p = V(c.x + d.x * dist + side.x * Math.min(7,dist*.45), clamp(c.y + 2, 2.5, 9), c.z + d.z * dist + side.z * Math.min(7,dist*.45)); const lx = c.x - p.x, lz = c.z - p.z; ROAMS.tgt = { p, yaw: Math.atan2(lx, -lz), pitch: Math.atan2(c.y - p.y, Math.hypot(lx, lz)) }; } } catch (e) {} return true; } return false; }, toggleDark }; })();
  window.__ROOM = ROOM;
  const HOVL = new THREE.PointLight(0x8fd0ff, 0, 1.4, 2); scene0().add(HOVL); let hovLT = 0;
  function scene0() { return S.scene; }

  const mc = Y2K.cnv(2048, 586), mg = mc.getContext('2d'); mg.fillStyle = '#121419'; mg.fillRect(0, 0, 2048, 586);
  for (let y = 0; y < 586; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 2048; x += 8) { mg.fillStyle = 'rgba(255,255,255,.035)'; mg.fillRect(x, y, 4, 2); }
  for (let i = 0; i < 9000; i++) { mg.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; mg.fillRect(Math.random() * 2048, Math.random() * 586, 2, 2); }
  mg.setLineDash([14, 10]); mg.lineWidth = 3; mg.strokeStyle = 'rgba(190,198,212,.55)'; mg.strokeRect(26, 26, 1996, 534); mg.strokeRect(40, 40, 1968, 506); mg.setLineDash([]);
  mg.fillStyle = 'rgba(0,0,0,.35)'; mg.fillRect(40, 240, 1968, 8); mg.fillStyle = 'rgba(255,255,255,.05)'; mg.fillRect(40, 248, 1968, 3);
  const px0 = 574, py0 = 300, pw = 900, ph = 210, pr = 40; const pgr2 = mg.createLinearGradient(0, py0, 0, py0 + ph); pgr2.addColorStop(0, '#2b2f37'); pgr2.addColorStop(1, '#16191f');
  mg.fillStyle = pgr2; mg.beginPath(); mg.roundRect(px0, py0, pw, ph, pr); mg.fill(); mg.setLineDash([10, 8]); mg.strokeStyle = 'rgba(170,178,192,.6)'; mg.lineWidth = 3; mg.beginPath(); mg.roundRect(px0 + 14, py0 + 14, pw - 28, ph - 28, pr - 10); mg.stroke(); mg.setLineDash([]);
  const em2 = Y2K.cnv(256, 256); G3.drawEmblem(em2.getContext('2d'), 256, '#7d8796'); mg.drawImage(em2, px0 + 40, py0 + 35, 140, 140);
  const emb = (t, x, y, f) => { mg.font = f; mg.fillStyle = 'rgba(0,0,0,.8)'; mg.fillText(t, x + 3, y + 3); mg.fillStyle = 'rgba(255,255,255,.25)'; mg.fillText(t, x - 2, y - 2); mg.fillStyle = '#5d6573'; mg.fillText(t, x, y); };
  emb('UNFIRE AUDIO', px0 + 210, py0 + 118, '900 82px Orbitron, Arial'); emb('FLIGHT CASE · SERIE 2000', px0 + 214, py0 + 172, '600 34px Michroma, Arial');
  const mt2 = Y2K.toTex(mc, { color: true }); mt2.anisotropy = 8;
  const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.2), new THREE.MeshStandardMaterial({ map: mt2, bumpMap: mt2, bumpScale: 0.004, roughness: 0.88 })); mesh2.rotation.x = H2; mesh2.position.set(0, -0.006, 0.6); lid.add(mesh2);
  const SC = Y2K.cnv(1024, 300), SG = SC.getContext('2d'), ST = Y2K.toTex(SC, { color: true }); const LOG = ['UNFIRE AUDIO · FLIGHT CASE', 'Listo.']; let scrT = 0;
  const screenM = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.97), new THREE.MeshBasicMaterial({ map: ST, toneMapped: false })); screenM.rotation.x = H2; screenM.position.set(0, -0.022, 0.6); lid.add(screenM);
  const sbz = mesh(rbox(3.42, 0.03, 1.08, 0.04), M.blackGloss); sbz.position.set(0, -0.0, 0.6); lid.add(sbz);
  const RT = new THREE.WebGLRenderTarget(512, 320); RT.texture.encoding = THREE.sRGBEncoding; const rtCam = new THREE.PerspectiveCamera(30, 1.6, 0.01, 60);
  const rtPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.7), new THREE.MeshBasicMaterial({ map: RT.texture, toneMapped: false })); rtPlane.rotation.x = H2; rtPlane.position.set(0.99, -0.024, 0.513); rtPlane.scale.y = 0.99; lid.add(rtPlane); rtPlane.visible = false;
  mesh2.visible = false; const rings = []; { const ov = mesh(new THREE.TorusGeometry(1, 0.022, 8, 96).rotateX(H2), CHROME); ov.scale.set(2.45, 1, 0.92); ov.position.set(0, -0.012, -0.85); const ovl = mesh(new THREE.TorusGeometry(1, 0.007, 6, 96).rotateX(H2), Y2K.led('#3d8bff', 2)); ovl.scale.set(2.36, 1, 0.84); ovl.position.set(0, -0.016, -0.85); }
  for (const sx of [-1, 1]) { const rg = new THREE.Group(); rg.position.set(sx * 2.3, -0.012, 0.6); rg.scale.setScalar(0.72); lid.add(rg); rg.add(mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.02, 48), M.blackGloss)); for (let k = 1; k < 6; k++) { const gr = mesh(new THREE.TorusGeometry(0.06 * k, 0.006, 6, 40).rotateX(H2), M.graphite); gr.position.y = -0.012; rg.add(gr); } rg.add(mesh(new THREE.TorusGeometry(0.42, 0.025, 10, 48).rotateX(H2), CHROME));
    [0.36, 0.27, 0.18].forEach((r, i) => { const m = mesh(new THREE.TorusGeometry(r, 0.018, 8, 48, Math.PI * (1.2 + i * 0.3)).rotateX(H2), Y2K.led(['#3d8bff', '#b6ff3b', '#ff4fd8'][i], 2.4)); m.position.y = -0.015; rg.add(m); rings.push({ m, i, sx }); }); }
  function say(t) { LOG.push(t); while (LOG.length > 5) LOG.shift(); scrT = 0; }
  function drawScr(tt, song, cine) { const g = SG; { const bg = g.createLinearGradient(0, 0, 0, 300); bg.addColorStop(0, '#0b2a63'); bg.addColorStop(0.55, '#06183d'); bg.addColorStop(1, '#0d3b7a'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 300); g.globalAlpha = 0.22; for (let k = 0; k < 4; k++) { g.strokeStyle = ['#3d8bff', '#ff4fd8', '#b6ff3b', '#7fd0ff'][k]; g.lineWidth = 10; g.beginPath(); for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 230 + Math.sin(x * 0.01 + tt * (0.6 + k * 0.3) + k) * (20 + LV * 60) - k * 18); g.stroke(); } g.globalAlpha = 1; } g.strokeStyle = 'rgba(61,139,255,.15)'; for (let x = 0; x < 1024; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 300); g.stroke(); }
    g.fillStyle = '#3d8bff'; g.font = '700 30px Michroma, Arial'; g.fillText('UNFIRE AUDIO', 24, 46); g.fillStyle = cine ? '#ff4fd8' : '#2bd96b'; g.font = '700 24px "Share Tech Mono", monospace'; g.fillText(cine ? '● MODO CINE' : '● ONLINE', 840, 44);
    g.fillStyle = '#9fffc4'; g.font = '24px "Share Tech Mono", monospace'; g.fillText(('♪ ' + (song || 'RADIO UNFIRE · standby')).slice(0, 38), 24, 84);
    if (SEL) { const nm = SEL.type === 'hw' ? 'HYPERWAVE 2000' : SEL.type === 'cap' ? SEL.g.it.name : SEL.it.name, ty = { hw: 'SYNTHESIZER · SIGNATURE INSTRUMENT', cap: 'CAPSULE DEVICE', mut: 'TRANSFORMABLE', dev: 'DEVICE' }[SEL.type]; g.fillStyle = '#b6ff3b'; g.font = '700 26px "Share Tech Mono", monospace'; g.fillText('TARGET › ' + nm, 24, 116); g.fillStyle = 'rgba(160,200,255,.8)'; g.font = '22px "Share Tech Mono", monospace'; g.fillText(ty + ' · SCANNING…', 24, 142); }
    LOG.slice(SEL ? -3 : -4).forEach((l, i, a) => { g.fillStyle = i === a.length - 1 ? '#ffffff' : 'rgba(200,220,255,.55)'; g.font = (i === a.length - 1 ? '700 ' : '') + '28px "Share Tech Mono", monospace'; g.fillText('› ' + l.slice(0, 36), 24, (SEL ? 182 : 140) + i * 36); });
    for (let i = 0; i < 32; i++) { const h = (Math.sin(tt * 3 + i * 0.6) * 0.5 + 0.5) * (RADIO.st.on ? 6 + LV * 22 : 3); g.fillStyle = `hsl(${200 + i * 4},90%,60%)`; g.fillRect(270 + i * 11, 50 - h, 8, h); } g.strokeStyle = 'rgba(61,139,255,.8)'; g.lineWidth = 3; g.strokeRect(644, 70, 352, 214); g.fillStyle = 'rgba(61,139,255,.75)'; g.font = '700 16px "Share Tech Mono", monospace'; g.fillText('VISOR 3D', 652, 64); for (const [cx, cy, dx, dy] of [[640, 66, 1, 1], [1000, 66, -1, 1], [640, 288, 1, -1], [1000, 288, -1, -1]]) { g.strokeStyle = '#7fd0ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + dx * 22, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * 22); g.stroke(); } if (!SEL) { g.fillStyle = 'rgba(160,200,255,.45)'; g.font = '22px "Share Tech Mono", monospace'; g.fillText('SIN OBJETIVO', 740, 162); }
    if (!drawScr.grime) { const gc = Y2K.cnv(1024, 300), gx = gc.getContext('2d'); for (let f = 0; f < 5; f++) { const fx = 80 + Math.random() * 860, fy = 40 + Math.random() * 220, fr = 22 + Math.random() * 26, fa = Math.random() * 3; gx.save(); gx.translate(fx, fy); gx.rotate(fa); for (let r = 4; r < fr; r += 3.2) { gx.strokeStyle = `rgba(255,255,255,${0.035 + Math.random() * 0.03})`; gx.lineWidth = 1.3; gx.beginPath(); gx.ellipse(0, 0, r, r * 1.3, 0, Math.random(), Math.PI * 1.6 + Math.random()); gx.stroke(); } gx.restore(); } for (let i = 0; i < 4; i++) { gx.strokeStyle = 'rgba(255,255,255,.07)'; gx.lineWidth = 1; gx.beginPath(); const sx = Math.random() * 1024, sy = Math.random() * 300; gx.moveTo(sx, sy); gx.lineTo(sx + 80 + Math.random() * 200, sy + (Math.random() - 0.5) * 60); gx.stroke(); } const vg = gx.createRadialGradient(512, 150, 200, 512, 150, 620); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,5,0,.55)'); gx.fillStyle = vg; gx.fillRect(0, 0, 1024, 300); const gl0 = gx.createLinearGradient(0, 0, 1024, 300); gl0.addColorStop(0.2, 'rgba(255,255,255,0)'); gl0.addColorStop(0.32, 'rgba(255,255,255,.07)'); gl0.addColorStop(0.42, 'rgba(255,255,255,0)'); gx.fillStyle = gl0; gx.fillRect(0, 0, 1024, 300); gx.globalAlpha = 0.04; gx.fillStyle = '#9fd0ff'; gx.font = '900 150px Orbitron, Arial'; gx.fillText('UNFIRE', 180, 230); gx.globalAlpha = 1; for (let i = 0; i < 1400; i++) { gx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; gx.fillRect(Math.random() * 1024, Math.random() * 300, 1 + Math.random() * 2, 1 + Math.random() * 2); } const sm = gx.createRadialGradient(300, 80, 10, 300, 80, 260); sm.addColorStop(0, 'rgba(255,255,255,.05)'); sm.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = sm; gx.fillRect(0, 0, 1024, 300); for (let y = 0; y < 300; y += 3) { gx.fillStyle = 'rgba(0,0,0,.12)'; gx.fillRect(0, y, 1024, 1); } drawScr.grime = gc; } g.drawImage(drawScr.grime, 0, 0); ST.needsUpdate = true; }
  const GLASS = new THREE.MeshPhysicalMaterial({ color: 0x9fd4ff, transmission: 0.6, thickness: 0.05, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 });
  const ARMOR = (() => { const c = Y2K.cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#f2c200'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#16181c'; for (let i = -256; i < 512; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 0); g.lineTo(i - 232, 256); g.lineTo(i - 256, 256); g.fill(); }
    g.fillStyle = '#2b2f36'; g.fillRect(14, 14, 228, 228); for (let i = 0; i < 2600; i++) { const v = 34 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v + 5},.35)`; g.fillRect(14 + Math.random() * 228, 14 + Math.random() * 228, 10 + Math.random() * 70, 1); }
    return new THREE.MeshPhysicalMaterial({ map: Y2K.toTex(c, { color: true }), metalness: 0.85, roughness: 0.38, clearcoat: 0.4 }); })();
  const MIRROR = new THREE.MeshPhysicalMaterial({ color: 0xc4dcff, metalness: 0.96, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  const GLASS2 = new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, transmission: 0.92, thickness: 0.04, roughness: 0.02, ior: 1.5, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.35, envMapIntensity: 1.8 });
  const SMOKE = new THREE.MeshPhysicalMaterial({ color: 0x1c2c44, metalness: 0.3, roughness: 0.04, transmission: 0.5, thickness: 0.05, transparent: true, opacity: 0.6, clearcoat: 1 });
  const SLAT = new THREE.MeshPhysicalMaterial({ color: 0x48505d, metalness: 0.92, roughness: 0.26, clearcoat: 0.7, map: ALU.map, roughnessMap: ALU.roughnessMap });
  const FOLDG = new THREE.MeshPhysicalMaterial({ color: 0xd8ecff, metalness: 0.15, roughness: 0.02, transmission: 0.75, thickness: 0.03, transparent: true, opacity: 0.42, depthWrite: false, clearcoat: 1, envMapIntensity: 2 });
  const gates = [];
  Object.entries(COMP).forEach(([k, c]) => { const w = c.x1 - c.x0, d = c.z1 - c.z0;
    if (k === 'hw') { const g = new THREE.Group(); g.position.set((c.x0 + c.x1) / 2, 0.03, (c.z0 + c.z1) / 2); caseG.add(g); const sx = (c.x1 - c.x0) / 2 - 0.1, sz = (c.z1 - c.z0) / 2 - 0.1;
      const DG = new THREE.MeshPhysicalMaterial({ color: 0xa8d0ff, metalness: 0.35, roughness: 0.04, transmission: 0.55, thickness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, clearcoat: 1, envMapIntensity: 1.8 }), segs = [];
      for (let i = 0; i < 8; i++) { const s0 = new THREE.Group(); g.add(s0); const sm = mesh(new THREE.SphereGeometry(1, 14, 10, i * TAU / 8, TAU / 8 - 0.02, 0, H2), DG); sm.scale.set(sx, 0.55, sz); s0.add(sm); const rb = mesh(new THREE.SphereGeometry(1.004, 3, 10, i * TAU / 8, 0.02, 0, H2), CHROME); rb.scale.set(sx, 0.55, sz); s0.add(rb); segs.push(s0); }
      const rim = mesh(new THREE.TorusGeometry(1, 0.035, 10, 64).rotateX(H2), CHROME); rim.scale.set(sx, 1, sz); g.add(rim); const ed = mesh(new THREE.TorusGeometry(1, 0.012, 6, 64).rotateX(H2), Y2K.led('#ff3b5c', 2.6)); ed.scale.set(sx, 1, sz); ed.position.y = 0.035; g.add(ed);
      gates.push({ g, k, type: 'dome', segs, ed }); return; }
    const mat = k === 'caps' ? FOLDG : k === 'archer' ? SMOKE : SLAT, n = Math.max(6, Math.round(d / 0.14)), sd = d / n, list = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(); caseG.add(g); g.add(mesh(rbox(w - 0.03, 0.02, sd - 0.006, 0.006), mat)); const ed = mesh(new THREE.BoxGeometry(w - 0.1, 0.004, 0.006), Y2K.led('#3d8bff', 2)); ed.position.set(0, 0.012, sd / 2 - 0.01); g.add(ed); if (k === 'caps') { const hn = mesh(new THREE.CylinderGeometry(0.008, 0.008, w - 0.06, 8).rotateZ(H2), CHROME); hn.position.set(0, 0.006, -sd / 2 + 0.004); g.add(hn); } g.userData.z = c.z0 + sd * (i + 0.5); g.position.set((c.x0 + c.x1) / 2, 0.115, g.userData.z); list.push(g); }
    { const AW = 512, AH = Math.round(512 * d / w), ac = Y2K.cnv(AW, AH), ag = ac.getContext('2d'), glass = k === 'caps'; const PAL = { inst: ['#1d4fd8', '#5fc8ff'], fx: ['#5a1fd8', '#ff4fd8'], mut: ['#d86a00', '#ffd21a'], archer: ['#0a6b4a', '#5ee36a'] }[k] || ['#1d4fd8', '#9fd0ff'];
      if (!glass) { const gr = ag.createLinearGradient(0, 0, AW, AH); gr.addColorStop(0, PAL[0]); gr.addColorStop(1, '#0a1022'); ag.fillStyle = gr; ag.fillRect(0, 0, AW, AH); ag.globalAlpha = 0.18; ag.strokeStyle = PAL[1]; ag.lineWidth = 2; for (let x = -AH; x < AW; x += 26) { ag.beginPath(); ag.moveTo(x, AH); ag.lineTo(x + AH, 0); ag.stroke(); } ag.globalAlpha = 1;
        const tg = ag.createLinearGradient(0, AH * 0.35, 0, AH * 0.62); tg.addColorStop(0, '#fff'); tg.addColorStop(0.5, '#b8c4d8'); tg.addColorStop(0.52, '#5d6a80'); tg.addColorStop(1, '#eef3ff'); { let fs = AH * 0.2; ag.font = `900 ${fs}px Orbitron, Arial`; while (ag.measureText(c.name.toUpperCase()).width > AW * 0.86 && fs > 10) { fs -= 2; ag.font = `900 ${fs}px Orbitron, Arial`; } } ag.textAlign = 'center'; ag.shadowColor = PAL[1]; ag.shadowBlur = 18; ag.fillStyle = tg; ag.fillText(c.name.toUpperCase(), AW / 2, AH * 0.56); ag.shadowBlur = 0; ag.textAlign = 'left'; }
      let sd2 = k.length * 97; const rr = () => ((sd2 = (sd2 * 16807) % 2147483647) / 2147483647); const ST = ['holo', 'star', 'cd', 'daisy', 'heart', 'sparkle', 'note', 'bubble', 'globe', 'ufo', 'alien', 'flame']; for (let q = 0; q < (glass ? 4 : 5); q++) { const ty = ST[Math.floor(rr() * ST.length)], r0 = AW * (0.1 + rr() * 0.07); let yy = r0 + rr() * (AH - 2 * r0); if (!glass && Math.abs(yy - AH * 0.5) < AH * 0.14 + r0) yy = yy < AH * 0.5 ? Math.max(r0, AH * 0.36 - r0) : Math.min(AH - r0, AH * 0.64 + r0); if (!glass && Math.abs(yy - AH * 0.5) < AH * 0.14 + r0 * 0.8) continue; sticker(ag, ty, r0 + rr() * (AW - 2 * r0), yy, r0 * 2, (rr() - 0.5) * 1.2); }
      const at = Y2K.toTex(ac, { color: true }); list.forEach((sl, i) => { const t2 = at.clone(); t2.needsUpdate = true; t2.repeat.set(1, 1 / n); t2.offset.set(0, 1 - (i + 1) / n); const pm = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, sd - 0.008), new THREE.MeshStandardMaterial({ map: t2, transparent: glass, alphaTest: glass ? 0.05 : 0, roughness: 0.35, metalness: 0.3, emissive: 0xffffff, emissiveMap: t2, emissiveIntensity: glass ? 0.15 : 0.35, polygonOffset: true, polygonOffsetFactor: -1 })); pm.rotation.x = -H2; pm.position.y = 0.0105; sl.add(pm); }); }
    gates.push({ k, type: 'tam', list, c, d }); });
  const LEDG = Y2K.led('#2bd96b', 2.6); const DOMEG = gates.find((x) => x.type === 'dome'); let HOVB = null;
  const HAP = { on: true, last: 0 };
  function hap(size = 0.5) { try { if (!UA.ctx || UA.ctx.state !== 'running') UA.init(); } catch (er) {} const now = performance.now(); if (!HAP.on || now - HAP.last < 35) return; HAP.last = now; try { navigator.vibrate && navigator.vibrate(Math.round(6 + size * 30)); } catch (e) {}
    if (UA.ctx && UA.ctx.state === 'running' && !REC_GUARD()) { const c = UA.ctx, n = c.currentTime; if (!hap.buf) { const b = c.createBuffer(1, c.sampleRate * 0.02, c.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, 6); hap.buf = b; } const sN = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); sN.buffer = hap.buf; f.type = 'bandpass'; f.frequency.value = 2600 + (1 - size) * 2400; f.Q.value = 0.8; g.gain.value = (0.025 + size * 0.035) * (RADIO.st.on ? 0.45 : 1) * (MEGA ? 0.4 : 1); sN.connect(f).connect(g).connect(UA.bus.master); sN.start(n); } }
  const REC_GUARD = () => !!window.__unfireRecording;
  function boom() { hap(1); view.shake = 0; if (UA.ctx && UA.ctx.state === 'running') { const c = UA.ctx, o = c.createOscillator(), g = c.createGain(), n = c.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(90, n); o.frequency.exponentialRampToValueAtTime(32, n + 0.5); g.gain.setValueAtTime(0.2, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.7); o.connect(g).connect(UA.bus.master); o.start(n); o.stop(n + 0.75); } }
  let STOW = false; let lidOpen = 0, pTarget = 0, pNow = 0, gateK = 0, gateT = 0, ALL = false, lastOpen = 0;
  // The case is a game prop: toggling the lid never means exiting to the website.
  let lidControlledByPlayer = false, carryingCase = false, carryUIShown = false;
  // Time-based mechanical lid animation: stable on 30/60Hz or slower devices.
  // Reversing direction begins from the current pose, without jumping.
  const lidMotion={from:0,to:0,elapsed:0,duration:5.6};
  // Restored UNFIRE/Claude-era case sound palette (original 3D metal
  // latches, hinge sweep, bass thud and shimmer). Follow actual hinge motion,
  // never website scroll or arbitrary timers. All voices use existing master
  // EQ/compression/limiter; no new audio files, downloads or persistent loops.
  const CASE_SOUND=(()=>{
    let last=0,cycle=0;
    const context=()=>UA.ctx&&UA.ctx.state==='running'&&!document.hidden?UA.ctx:null;
    const output=(c)=>{const v=c.createGain();v.gain.value=.48;v.connect(UA.bus.master);return v};
    const noise=(c,dest,t,duration,start,end,q,gain)=>{
      const count=Math.max(1,Math.round(c.sampleRate*duration));
      const buffer=c.createBuffer(1,count,c.sampleRate),d=buffer.getChannelData(0);
      for(let i=0;i<count;i++)d[i]=(Math.random()*2-1)*(.8+.2*Math.sin(i*.31));
      const src=c.createBufferSource(),f=c.createBiquadFilter(),env=c.createGain();
      src.buffer=buffer;f.type='bandpass';f.Q.value=q;
      f.frequency.setValueAtTime(Math.max(20,start),t);
      f.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
      env.gain.setValueAtTime(.0005,t);
      env.gain.linearRampToValueAtTime(gain,t+Math.min(.025,duration*.16));
      env.gain.exponentialRampToValueAtTime(.0005,t+duration);
      src.connect(f);f.connect(env);env.connect(dest);
      src.start(t);src.stop(t+duration+.008);
    };
    const tone=(c,dest,t,freq,duration,gain,wave='sine',to=freq)=>{
      const osc=c.createOscillator(),env=c.createGain();
      osc.type=wave;osc.frequency.setValueAtTime(freq,t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+duration);
      env.gain.setValueAtTime(.0005,t);
      env.gain.linearRampToValueAtTime(gain,t+Math.min(.018,duration*.2));
      env.gain.exponentialRampToValueAtTime(.0005,t+duration);
      osc.connect(env);env.connect(dest);osc.start(t);osc.stop(t+duration+.008);
    };
    function play(which,reverse=false){
      const c=context();if(!c||!UA.bus?.master)return;
      try{
        const out=output(c),t=c.currentTime+.006;
        // These four sound signatures reproduce the earlier CaseSfx timbres.
        if(which==='latch'){
          noise(c,out,t,.075,3100,1700,3,.17);
          tone(c,out,t,2350,.052,.042,'square',1250);
          tone(c,out,t+.018,185,.105,.12,'triangle',126);
        }else if(which==='hinge'){
          noise(c,out,t,.94,reverse?2500:380,reverse?420:2350,2,.073);
          tone(c,out,t,reverse?220:108,.72,.04,'sawtooth',reverse?110:220);
          tone(c,out,t+.1,430,.66,.018,'sine',reverse?290:560);
        }else if(which==='thud'){
          tone(c,out,t,84,.37,.27,'sine',42);
          noise(c,out,t,.15,720,170,1,.10);
        }else if(which==='reveal'){
          noise(c,out,t,1.05,3600,9000,3,.025);
          tone(c,out,t+.02,880,.95,.075,'sine',1320);
          tone(c,out,t+.15,1318,.7,.041,'sine',1760);
        }
      }catch(e){if(!window.__caseSoundWarned){window.__caseSoundWarned=true;console.warn('Case sound:',e);}}
    }
    function sync(p,target,manual){
      // Only sound transitions controlled by the player, never scroll-driven
      // preview while browsing the website.
      if(!manual||document.hidden){last=p;return;}
      if(target>last+.00005){
        if(last<.055&&p>=.055){cycle++;play('latch');}
        if(last<.15&&p>=.15)play('latch');
        if(last<.295&&p>=.295)play('hinge');
        if(last<.93&&p>=.93)play('thud');
        if(last<.997&&p>=.997)play('reveal');
      }else if(target<last-.00005){
        if(last>.72&&p<=.72)play('hinge',true);
        if(last>.16&&p<=.16)play('latch');
        if(last>.01&&p<=.01)play('thud');
      }
      last=p;
    }
    return {sync};
  })();

  // One uninterrupted dolly toward the flight case once the host fills the viewport.
  const entryDolly={active:false,from:0,to:0,elapsed:0,duration:1.55};
  const originalCasePosition = caseG.position.clone();
  const portableUnlocked = () => { try { return typeof window.__unfireCasePortabilityUnlocked === 'function' && !!window.__unfireCasePortabilityUnlocked(); } catch(e) { return false; } };
  // Camera-choice state is separate from the player's roaming state: quests and online continue.
  const CASE_VIEW={on:false,dist:10.2,angle:0.25,elevation:0.52};
  const showCaseView=()=>{
    if(!ROAMS.on||carryingCase||CAPS.flying||!caseG.visible)return;
    try{if(REC.on)REC.set(false);}catch(e){}
    try{if(window.__VIEW?.on)window.__VIEW.stop();}catch(e){}
    CASE_VIEW.on=true;CASE_VIEW.dist=window.ATM_OUT?10.2:8.4;CASE_VIEW.elevation=window.ATM_OUT?0.52:0.78;CASE_VIEW.angle=caseG.rotation.y+0.25;
    ROAMS.tgt=null;for(const k in ROAMS.k)ROAMS.k[k]=0;
    say('🎥 Case camera: tap controls, drag to rotate and scroll to zoom.');
    updateCarryUI();
  };
  const showRobotView=()=>{CASE_VIEW.on=false;ROAMS.cp=null;updateCarryUI();};
  // No duplicate 2D character action: use the original PASEAR button.
  const carryButton = document.createElement('button');
  carryButton.id = 'unfireCarryCase';
  carryButton.type = 'button';
  carryButton.setAttribute('aria-label','Open your portable case');
  carryButton.innerHTML = '<img src="../img/emblem-butterfly.webp" alt="" width="25" height="25"> <span>OPEN CASE</span>';
  carryButton.style.cssText='position:fixed;left:max(12px,env(safe-area-inset-left));top:clamp(190px,40dvh,420px);right:auto;bottom:auto;max-width:195px;box-sizing:border-box;z-index:53;display:none;align-items:center;gap:9px;padding:11px 14px;border:1px solid #81b9ff;border-radius:999px;background:linear-gradient(130deg,#172d50,#030815);box-shadow:0 8px 25px #0009;color:#fff;font:700 12px Arial,sans-serif;touch-action:manipulation;cursor:pointer';
  document.body.appendChild(carryButton);
  function updateCarryUI(){
    const show=ROAMS.on;
    const unlocked=portableUnlocked();
    const far=ROAMS.on && Math.hypot(caseG.position.x-ROAMS.p.x,caseG.position.z-ROAMS.p.z)>12;
    const label=!unlocked?'🔒 CAPSULE · MISSION 3':CAPS.flying?'🎒 DEPLOYING…':carryingCase?'🎒 LAUNCH CAPSULE':far?'🎒 RECALL CAPSULE':'🎒 PACK CAPSULE';
    carryButton.disabled=CAPS.flying||!unlocked;
    carryButton.title=unlocked?'Pack or launch the case in its capsule':'Unlocked after story mission three';
    const labelNode=carryButton.querySelector('span');
    if(labelNode && labelNode.textContent!==label)labelNode.textContent=label;
    if(show!==carryUIShown){carryUIShown=show;carryButton.style.display=show?'flex':'none';}
  }
  function closeCaseInGame(){
    if(CASE_VIEW.on)showRobotView();
    lidControlledByPlayer=true;
    pTarget=0;
    closeAll(false);
    // Leave story state, missions, friends, online rooms and audio intact.
    if(ROAMS.on&&portableUnlocked()){
      // Case and everything inside are stored in one inventory capsule, not mounted
      // in front of the camera. Hiding the group also saves WebGL draw calls.
      carryingCase=true;
      caseG.visible=false;
      caseG.scale.setScalar(1);
    }
    updateCarryUI();
    if(parent!==window)parentPost({caseState:'closed'});
  }
  function openCaseInGame(landing){
    try { if (window.__roamAPI && window.__roamAPI.ROAMS && window.__roamAPI.ROAMS.on && window.__CAPSULE_POP && !landing) setTimeout(() => window.__CAPSULE_POP(), 60); } catch (e) {}
    // A player tapping the case *inside* the game can activate native fullscreen
    // before the parent iframe receives its asynchronous caseState message.
    // Preserve user choice if it is already fullscreen; no navigation/reload.
    if (!document.fullscreenElement && !document.webkitFullscreenElement
        && (!('userActivation' in navigator) || navigator.userActivation.isActive)) {
      const root = document.documentElement;
      const fs = root.requestFullscreen || root.webkitRequestFullscreen;
      if (typeof fs === 'function') {
        try { const result = fs.call(root, {navigationUI:'hide'}); result?.catch?.(() => {}); } catch (_) {}
      }
    }
    CASE_VIEW.on=false;
    lidControlledByPlayer=true;
    if(carryingCase){
      carryingCase=false;
      caseG.scale.setScalar(1);
      if(ROAMS.on){
        const angle=ROAMS.cy==null?ROAMS.yaw:ROAMS.cy;
        caseG.position.set(
          landing ? landing.x : ROAMS.p.x+Math.sin(angle)*7,
          landing ? landing.y : -8.9+(ROAMS.h||0)+(window.ATM_OUT?6.8:0.3),
          landing ? landing.z : ROAMS.p.z-Math.cos(angle)*7
        );
        caseG.rotation.y=angle;
      } else {caseG.position.copy(originalCasePosition);caseG.rotation.y=0;}
    }
    caseG.visible=true;
    pTarget=1;
    updateCarryUI();
    ROOM.AMB.mute=false;
    if(parent!==window)parentPost({caseState:'open'});
    const direct=document.getElementById('directOpen');if(direct)direct.hidden=true;
  }
  function toggleCaseInGame(){
    // Target state, not the delayed animation amount: rapid presses still alternate.
    if(pTarget>0.5)closeCaseInGame();else openCaseInGame();
  }
  carryButton.addEventListener('pointerdown',e=>e.stopPropagation());
  carryButton.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(!ROAMS.on||!portableUnlocked())return;
    if(carryingCase){CAPS.throwIt();return;}
    closeCaseInGame();
  }); const laser = mesh(new THREE.BoxGeometry(0.03, 0.012, CD - 0.2), Y2K.led('#3d8bff', 3)); caseG.add(laser);
  function setLid(p) { const lt = ease.smooth(clamp((p - 0.08) / 0.2)), op = ease.smooth(clamp((p - 0.25) / 0.7)); latches.forEach((l) => { l.rotation.x = -1.5 * lt; }); lidPivot.rotation.x = -1.92 * op; lidOpen = op; }
  plate.material.emissive = new THREE.Color(0x3d8bff); plate.material.emissiveMap = plate.material.map;

  // ---------- contenido ----------
  const items = [];               // {kind, pos(Vector3 mundo), ...}
  const texLoader = new THREE.TextureLoader();
  const tex = (u) => { const t = texLoader.load(u); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  const inside = new THREE.Group(); caseG.add(inside);
  // Instrumentos: HYPERWAVE 3D real + Unfire Synthesizer (pantalla de la app)
  const CELLM = new THREE.MeshPhysicalMaterial({ color: 0x8e98a8, metalness: 0.9, roughness: 0.25 }), CELLL = Y2K.led('#3d8bff', 1.6);
  function cell(x, z, w, d) { const g = new THREE.Group(); g.position.set(x, 0.034, z); caseG.add(g); for (const [a, b, cx, cz] of [[w, 0.012, 0, -d / 2], [w, 0.012, 0, d / 2], [0.012, d, -w / 2, 0], [0.012, d, w / 2, 0]]) { const m = mesh(new THREE.BoxGeometry(a, 0.012, b), CELLM); m.position.set(cx, 0, cz); g.add(m); } const l = mesh(new THREE.BoxGeometry(w * 0.5, 0.004, 0.006), CELLL); l.position.set(0, 0.008, d / 2 - 0.012); g.add(l); }
  let HW = null;
  try { HW = HYPERWAVE.build(); HW.root.scale.setScalar(0.27); HW.root.position.set(-1.95, 0.01, -0.85); HW.home = HW.root.position.clone(); HW.tg = 0; inside.add(HW.root); HW.update(0, 0, { params: {} });
    items.push({ kind: 'hyper', name: 'HYPERWAVE 2000', pos: V(-1.95, HB + 0.1, -0.85), r: 1.7 }); } catch (e) { console.warn('HYPERWAVE', e); }
  // Unfire Synthesizer en Mac (portátil), iPad e iPhone: la pantalla de la app dentro de cada aparato
  function device(kind, f, x, z, name, r, kindItem) {
    const g = new THREE.Group(); g.position.set(x, 0.03, z); inside.add(g);
    const scrMat = new THREE.MeshBasicMaterial({ map: tex(IMG + f), toneMapped: false });
    if (kind === 'laptop') {          // portátil: base con teclado + pantalla abierta
      const w = 1.12, d = 0.74; const baseM = mesh(rbox(w, 0.03, d, 0.03), M.silver); baseM.position.set(0, 0.015, 0); g.add(baseM);
      const kb = mesh(new THREE.PlaneGeometry(w * 0.86, d * 0.42), new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 })); kb.rotation.x = -H2; kb.position.set(0, 0.031, -0.06); g.add(kb);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 12; j++) { const k = mesh(new THREE.BoxGeometry(0.06, 0.008, 0.05), M.softTouch); k.position.set(-0.4 + j * 0.073, 0.035, -0.19 + i * 0.065); g.add(k); }
      const pad = mesh(new THREE.PlaneGeometry(0.3, 0.17), M.silver); pad.rotation.x = -H2; pad.position.set(0, 0.031, 0.22); g.add(pad);
      const hinge = new THREE.Group(); hinge.position.set(0, 0.03, -d / 2); g.add(hinge);
      const lidM = mesh(rbox(w, 0.022, d, 0.03), M.silver); lidM.position.set(0, 0.011, d / 2); hinge.add(lidM);
      const bez = mesh(new THREE.PlaneGeometry(w - 0.03, d - 0.03), M.blackGloss); bez.rotation.x = H2; bez.position.set(0, -0.001, d / 2); hinge.add(bez);
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, Math.min(d - 0.08, (w - 0.1) * 0.7)), scrMat); sp.rotation.x = H2; sp.position.set(0, -0.002, d / 2); hinge.add(sp);
      const lg = Y2K.cnv(128, 128); G3.drawEmblem(lg.getContext('2d'), 128, '#3d8bff'); const logo = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), new THREE.MeshBasicMaterial({ map: Y2K.toTex(lg, { color: true }), transparent: true })); logo.rotation.x = -H2; logo.position.set(0, 0.0225, d / 2); hinge.add(logo);
      items.push({ kind: kindItem, name, pos: V(x, HB, z), r, g, laptop: hinge }); return;
    }
    const isPad = kind === 'pad', w = isPad ? 0.5 : 0.26, h = isPad ? 0.68 : 0.55, rr = isPad ? 0.05 : 0.045;
    const body2 = mesh(rbox(w, 0.03, h, rr, 6), isPad ? M.silver : M.graphite); body2.position.y = 0.015; g.add(body2);
    const bez = mesh(rbox(w - 0.012, 0.004, h - 0.012, rr * 0.8), M.blackGloss); bez.position.y = 0.031; g.add(bez);
    const sw = w - (isPad ? 0.05 : 0.025), sh = h - (isPad ? 0.05 : 0.03);
    const p = new THREE.Mesh(Y2K.plate(sw, sh, isPad ? 0.02 : 0.03), scrMat); p.rotation.x = -H2; p.position.y = 0.034; g.add(p);
    if (!isPad) { const isl = mesh(new THREE.CapsuleGeometry(0.008, 0.04, 4, 8), M.blackGloss); isl.rotation.z = H2; isl.position.set(0, 0.035, -h / 2 + 0.03); g.add(isl); }
    const gl = new THREE.Mesh(Y2K.plate(sw, sh, 0.03), M.darkGlass); gl.rotation.x = -H2; gl.position.y = 0.036; g.add(gl);
    items.push({ kind: kindItem, name, pos: V(x, HB, z), r, g });
  }
  device('laptop', 'synth-mac.webp', -1.95, 0.45, 'Unfire Synthesizer · Mac', 1.2, 'synth');
  device('pad', 'synth-ipad.webp', -2.38, 1.3, 'Unfire Synthesizer · iPad', 0.8, 'synth');
  device('phone', 'synth-iphone.webp', -1.62, 1.3, 'Unfire Synthesizer · iPhone', 0.7, 'synth');
  // FX20: tarjetas
  const FXI = ['razora', 'overtones', 'axial', 'shadow', 'viscosity', 'novatonal', 'morph', 'bounding', 'airflow', 'flux', 'plume', 'azureorbit', 'sculptorpower', 'silkx', 'sparks', 'springchroma', 'pixelz', 'pulsebits', 'aire', 'lofi'];
  const FXN = ['RAZORA', 'OVERTONES', 'AXIAL', 'SHADOW', 'VISCOSITY', 'NOVATONAL', 'MORPH', 'BOUNDING', 'AIRFLOW', 'FLUX', 'PLUME', 'AZURE ORBIT', 'SCULPTOR POWER', 'SILKX', 'SPARKS', 'SPRING CHROMA', 'PIXELZ', 'PULSE BITS', 'AIRE', 'LOFI'];
  const FXGLOW = (() => { const c = Y2K.cnv(256, 180), g = c.getContext('2d'); for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(255,255,255,${0.06 + k * 0.05})`; g.lineWidth = 3; g.beginPath(); g.roundRect(4 + k * 1.5, 4 + k * 1.5, 248 - k * 3, 172 - k * 3, 20); g.stroke(); } return Y2K.toTex(c, { color: true }); })();
  FXI.forEach((id, i) => { const c = COMP.fx, col = i % 5, row = Math.floor(i / 5), x = c.x0 + 0.25 + col * 0.475, z = c.z0 + 0.22 + row * 0.42;
    const g = new THREE.Group(); g.position.set(x, 0.02, z); inside.add(g);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.29), new THREE.MeshBasicMaterial({ map: tex(IMG + `fx-${id}-s.webp`), transparent: true, toneMapped: false })); card.rotation.x = -H2; g.add(card); const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ map: FXGLOW, color: new THREE.Color().setHSL(i / FXI.length * 0.85, 0.9, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.5 })); fr.rotation.x = -H2; fr.position.y = -0.002; g.add(fr);
    items.push({ kind: 'fx', id, name: FXN[i], pos: V(x, HB, z), r: 0.9, g, m: card, fr }); });
  // ARCHER (plugin de Mac) dentro de un portátil
  { const c = COMP.archer; device('laptop', 'archer-nocturne-app-preview-20261028.webp', (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, 'ARCHER', 1.2, 'archer'); }
  // Transformables: robots plegados (se construyen al acercarte)
  MUTANTS.list.forEach((mt, i) => { const c = COMP.mut, col = i % 4, row = Math.floor(i / 4), x = c.x0 + (col + 0.5) * (c.x1 - c.x0) / 4, z = c.z0 + (row + 0.5) * (c.z1 - c.z0) / 5; cell(x, z, (c.x1 - c.x0) / 4 - 0.03, (c.z1 - c.z0) / 5 - 0.03); const _u = 0;
    const tok = new THREE.Group(); tok.position.set(x, 0.02, z); inside.add(tok);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: tex(IMG + `mut/${mt.id}-a.webp`), transparent: true, toneMapped: false, depthWrite: false })); sp.rotation.x = -H2 + 0.9; sp.position.y = 0.1; tok.add(sp);
    items.push({ kind: 'mut', spec: mt, name: mt.name, pos: V(x, HB, z), r: 0.75, tok }); });
  // Cápsulas: 100 cápsulas cerradas
  const capGeo = new THREE.CapsuleGeometry(0.045, 0.07, 6, 16);
  PLUGINS.list.slice(0, 20).forEach((p, i) => { const c = COMP.caps, col = i % 5, row = Math.floor(i / 5), x = c.x0 + (col + 0.5) * (c.x1 - c.x0) / 5, z = c.z0 + (row + 0.5) * (c.z1 - c.z0) / 4; cell(x, z, (c.x1 - c.x0) / 5 - 0.03, (c.z1 - c.z0) / 4 - 0.03); const _v = 0;
    const hue = (p.n * 0.6180339887) % 1, color = new THREE.Color().setHSL(hue, 0.85, 0.55);
    const tok = new THREE.Group(); tok.position.set(x, 0.09, z); tok.scale.setScalar(1.9); inside.add(tok);
    const a = mesh(capGeo, new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.18, clearcoat: 1 })); a.rotation.z = H2; tok.add(a);
    const band2 = mesh(new THREE.TorusGeometry(0.046, 0.006, 6, 20), CHROME); band2.rotation.y = H2; tok.add(band2);
    items.push({ kind: 'cap', spec: p, name: p.name, pos: V(x, HB, z), r: 0.7, tok }); });

  const CK = Object.keys(COMP), compG = {}; CK.forEach((k) => { compG[k] = new THREE.Group(); compG[k].userData = { t: 0, open: 0 }; inside.add(compG[k]); });
  const compOf = (p) => CK.find((k) => { const c = COMP[k]; return p.x >= c.x0 - 0.06 && p.x <= c.x1 + 0.06 && p.z >= c.z0 - 0.06 && p.z <= c.z1 + 0.06; }) || 'inst';
  [...inside.children].forEach((o) => { if (CK.some((k) => compG[k] === o)) return; compG[compOf(o.position)].attach(o); });
  items.forEach((it) => (it.comp = compOf(it.pos)));
  const HATCH = [], HM = new THREE.MeshPhysicalMaterial({ color: 0x3a4250, metalness: 0.9, roughness: 0.3, clearcoat: 0.6 }), HOLE = new THREE.MeshBasicMaterial({ color: 0x020305 });
  items.forEach((it) => { const [w, d] = it.kind === 'hyper' ? [1.3, 1.2] : it.kind === 'cap' ? [0.4, 0.36] : it.kind === 'mut' ? [0.27, 0.34] : it.kind === 'fx' ? [0.44, 0.3] : it.laptop ? [0.95, 0.66] : [0.5, 0.42];
    const hg = new THREE.Group(); hg.position.set(it.kind === 'hyper' ? -1.95 : it.pos.x, 0.021, it.kind === 'hyper' ? -0.85 : it.pos.z); caseG.add(hg); const hole = mesh(new THREE.BoxGeometry(w, 0.004, d), HOLE); hg.add(hole);
    const pl = [-1, 1].map((sx) => { const p = new THREE.Group(); p.position.x = sx * w / 2; hg.add(p); const m = mesh(rbox(w / 2, 0.01, d, 0.004), HM); m.position.x = -sx * w / 4; p.add(m); const l = mesh(new THREE.BoxGeometry(0.004, 0.012, d - 0.02), Y2K.led('#3d8bff', 2)); l.position.x = -sx * (w / 2 - 0.004); p.add(l); return p; }); HATCH.push({ hole, pl, k: it.comp }); });
  const openComp = (k) => { if (!compG[k].userData.open) hap(0.7); compG[k].userData.open = 1; if (k === 'hw' && HW) HW.autoT = 1; }, openAllComp = () => CK.filter((k) => k !== 'hw').forEach(openComp), allOpen = () => CK.filter((k) => k !== 'hw').every((k) => compG[k].userData.open);
  // botón de mariposa dentro de la tapa (la parte "pantalla"): abre todas las compuertas
  const lidBtn = new THREE.Group(); lidBtn.position.set(0, -0.02, -0.66); lid.add(lidBtn);
  { const em = Y2K.cnv(256, 256); G3.drawEmblem(em.getContext('2d'), 256, '#7fd0ff'); lidBtn.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 16, 64).rotateX(H2), CHROME));
    const dome = mesh(new THREE.SphereGeometry(0.27, 40, 20, 0, TAU, 0, 1.1), new THREE.MeshPhysicalMaterial({ color: 0x2a6dff, emissive: 0x2a6dff, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85 })); dome.rotation.x = Math.PI; dome.scale.y = 0.45; lidBtn.add(dome);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshBasicMaterial({ map: Y2K.toTex(em, { color: true }), transparent: true, toneMapped: false })); face.rotation.x = H2; face.position.y = -0.135; face.material.color && face.material.color.setScalar(1.2); lidBtn.add(face);
    const lc = Y2K.cnv(512, 64), lg2 = lc.getContext('2d'); lg2.fillStyle = '#9fd0ff'; lg2.font = '700 34px Michroma, Arial'; lg2.textAlign = 'center'; lg2.fillText('OPEN ALL', 256, 44);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.125), new THREE.MeshBasicMaterial({ map: Y2K.toTex(lc, { color: true }), transparent: true, toneMapped: false })); lab.rotation.x = H2; lab.position.set(0, -0.005, 0.42); lab.rotation.z = 0; lid.add(lab); lab.position.add(lidBtn.position).setY(-0.012); lidBtn.userData.dome = dome; }
  const btns = []; { const mk = (x, glyph, lab, col, a, z = -0.95, sh = 'r') => { const g = new THREE.Group(); g.position.set(x, -0.02, z); lid.add(g); g.add(sh === 'h' ? mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 6), CHROME) : sh === 's' ? mesh(rbox(0.38, 0.03, 0.38, 0.08), CHROME) : mesh(new THREE.TorusGeometry(0.17, 0.035, 14, 48).rotateX(H2), CHROME));
      const CM = new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.08, clearcoat: 1 }); const cap = sh === 'h' ? mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.08, 6), CM) : sh === 's' ? mesh(rbox(0.3, 0.08, 0.3, 0.07), CM) : mesh(new THREE.SphereGeometry(0.155, 32, 16, 0, TAU, 0, 1.1), CM); if (sh === 'r') { cap.rotation.x = Math.PI; cap.scale.y = 0.45; } else cap.position.y = -0.04; g.add(cap);
      const c = Y2K.cnv(256, 256), x2 = c.getContext('2d'); x2.fillStyle = '#fff'; x2.textAlign = 'center'; x2.font = '700 130px system-ui'; x2.shadowColor = '#000'; x2.shadowBlur = 8; ICON(x2, a, 128, 128, 200);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ map: Y2K.toTex(c, { color: true }), transparent: true, toneMapped: false })); face.rotation.x = H2; face.position.y = -0.075; g.add(face);
      const lc = Y2K.cnv(256, 48), l2 = lc.getContext('2d'); l2.fillStyle = '#9fd0ff'; l2.font = '700 30px Michroma, Arial'; l2.textAlign = 'center'; l2.fillText(lab, 128, 36);
      const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), new THREE.MeshBasicMaterial({ map: Y2K.toTex(lc, { color: true }), transparent: true, toneMapped: false })); lb.rotation.x = H2; lb.position.set(0, 0, 0.28); g.add(lb); btns.push({ g, cap, a, p: 0 }); };
    mk(-1.15, '⟳', 'TRANSFORM', 0x3d8bff, 'next', -0.98, 's'); mk(-0.55, '↺', 'BACK', 0x7a5cff, 'back', -1.18, 'r'); mk(0.55, '✥', 'MOVE', 0x2bd96b, 'move', -1.18, 'r'); mk(1.15, '✕', 'CLOSE', 0xff2a4a, 'close', -0.98, 's'); mk(-1.95, '★', 'MEGA · PARTY', 0xffc400, 'super', -0.66, 'h'); mk(1.95, '▶', 'MOVIE · CINEMA', 0xff4fd8, 'cine', -0.66, 'h'); mk(0, '⏏', 'PACK CASE', 0xffb020, 'shut', -1.36);
    btns.forEach((b) => { const s0 = b.a === 'super' ? 1.45 : b.a === 'cine' ? 1.2 : 1; b.g.scale.setScalar(s0); const shp = b.a === 'super' || b.a === 'cine' ? 6 : (b.a === 'next' || b.a === 'close') ? 4 : 48; const lr = mesh(new THREE.TorusGeometry(shp === 4 ? 0.25 : 0.215, 0.009, 6, shp).rotateX(H2).rotateY(shp === 4 ? Math.PI / 4 : shp === 6 ? Math.PI / 6 : 0), new THREE.MeshBasicMaterial({ color: b.cap.material.color.getHex(), toneMapped: false })); lr.position.y = -0.012; b.g.add(lr); b.ring = lr; if (b.a === 'super' || b.a === 'cine') { const hc = Y2K.cnv(128, 128), hx = hc.getContext('2d'), hg = hx.createRadialGradient(64, 64, 4, 64, 64, 64); hg.addColorStop(0, b.a === 'super' ? 'rgba(255,220,80,1)' : 'rgba(255,90,220,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); hx.fillStyle = hg; hx.fillRect(0, 0, 128, 128); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Y2K.toTex(hc, { color: true }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); sp.scale.setScalar(0.9); sp.position.y = -0.1; b.g.add(sp); b.halo = sp;
      if (b.a === 'super') { for (const [r0, h0] of [[0.235, 0.02], [0.27, 0.035]]) { const t0 = mesh(new THREE.CylinderGeometry(r0, r0 + 0.01, h0, 6), CHROME); t0.position.y = h0 / 2 - 0.005; b.g.add(t0); } b.orb = new THREE.Group(); b.g.add(b.orb); for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false })); const a = k / 5 * TAU; st.position.set(Math.cos(a) * 0.3, -0.06, Math.sin(a) * 0.3); b.orb.add(st); } }
      if (b.a === 'cine') { b.orb = new THREE.Group(); b.g.add(b.orb); const reel = mesh(new THREE.TorusGeometry(0.29, 0.016, 8, 48).rotateX(H2), CHROME); b.orb.add(reel); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, h = mesh(new THREE.BoxGeometry(0.04, 0.012, 0.03), new THREE.MeshBasicMaterial({ color: 0xff4fd8, toneMapped: false })); h.position.set(Math.cos(a) * 0.29, -0.012, Math.sin(a) * 0.29); h.rotation.y = -a; b.orb.add(h); } } } }); }
  const GLY = {}; const glyTex = (gl, wd) => GLY[gl] || (GLY[gl] = (() => { const c = Y2K.cnv(128, 128), x = c.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 64px system-ui'; x.shadowColor = '#000'; x.shadowBlur = 6; ICON(x, gl, 64, 54, 76); x.font = '700 19px Michroma, Arial'; x.fillText(wd || '', 64, 116); return Y2K.toTex(c, { color: true }); })());
  const PB = []; const BTD = [['next', '⟳', 0x3d8bff, 'TRANSF.'], ['back', '↺', 0x7a5cff, 'BACK'], ['move', '✥', 0x2bd96b, 'MOVE'], ['close', '✕', 0xff2a4a, 'CLOSE']];
  function plat3D(sel, R, shape) { const g = new THREE.Group(); { const bar = mesh(rbox(R * 1.72, R * 0.1, R * 0.44, R * 0.04), M.graphite); bar.position.set(0, R * 0.05, R * 0.68); g.add(bar); } g.add(mesh(new THREE.CylinderGeometry(R, R * 1.06, 0.02, 48), M.graphite)); const rim = mesh(new THREE.TorusGeometry(R * 1.04, 0.006, 6, 48).rotateX(H2), Y2K.led('#2bd96b', 2.4)); g.add(rim);
    BTD.forEach(([a, gl, col, wd], i) => { const j = { close: 0, next: 1, back: 2, move: 3 }[a], b = new THREE.Group(); b.position.set((j - 1.5) * R * 0.4, R * 0.1, R * 0.68); g.add(b); const r = R * 0.12;
      const geo = shape === 0 ? new THREE.SphereGeometry(r, 18, 10, 0, TAU, 0, H2) : shape === 1 ? new THREE.CylinderGeometry(r, r * 1.1, r * 0.6, 6) : new THREE.CylinderGeometry(r, r, r * 0.5, 24);
      const cap = mesh(geo, new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.1, clearcoat: 1 })); b.add(cap); const f = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 20), new THREE.MeshBasicMaterial({ map: glyTex(a, wd), transparent: true, toneMapped: false })); f.rotation.x = -H2; f.position.y = r * 0.62; b.add(f);
      b.userData.btn = { a, sel }; PB.push(b); }); return g; }
  if (HW) { HW.P = new THREE.Group(); HW.P.add(mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.03, 64), M.graphite)); HW.P.add(mesh(new THREE.TorusGeometry(0.645, 0.008, 8, 64).rotateX(H2), Y2K.led('#3d8bff', 2.4))); HW.P.scale.setScalar(1 / 0.27); HW.P.position.y = -0.03 / 0.27; HW.root.add(HW.P); }
  const VU = []; for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) { const c = i < 5 ? 0x2bd96b : i < 7 ? 0xffb020 : 0xff2a4a, m = mesh(new THREE.BoxGeometry(0.16, 0.034, 0.012), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 0.05 })); m.position.set(sx * 2.32, -HB + 0.12 + i * 0.042, CD / 2 + 0.008); caseG.add(m); VU.push({ m, i }); }
  const BEST3 = [2, 5, 9, 13, 17, 22, 26, 31, 35, 38, 44, 47, 52, 58, 61, 66, 73, 79, 85, 93];
  const CAPPAGES = [PLUGINS.list.slice(0, 20), PLUGINS.list.slice(20, 40), BEST3.map((i) => Object.assign(Object.create(PLUGINS.list[i % PLUGINS.list.length]), { g3: 1 }))], PAGEN = ['SERIE 1', 'SERIE 2', 'FAMILIA TENTÁCULO']; let capPage = 0;
  const pageBtn = new THREE.Group(); pageBtn.position.set(COMP.caps.x1 - 0.32, 0.16, COMP.caps.z1 + 0.035); caseG.add(pageBtn);
  const PGC = Y2K.cnv(512, 96), PGG = PGC.getContext('2d'), PGT = Y2K.toTex(PGC, { color: true }); const drawPg = () => { PGG.fillStyle = '#04070d'; PGG.fillRect(0, 0, 512, 96); PGG.fillStyle = '#b6ff3b'; PGG.font = '700 38px "Share Tech Mono", monospace'; PGG.fillText(`${PAGEN[capPage]} ${capPage + 1}/3 ▸`, 18, 62); PGT.needsUpdate = true; }; drawPg();
  pageBtn.add(mesh(rbox(0.6, 0.12, 0.04, 0.02), M.blackGloss)); { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.1), new THREE.MeshBasicMaterial({ map: PGT, toneMapped: false })); f.position.z = 0.022; pageBtn.add(f); }
  function setCapPage(n) { capPage = (n + 3) % 3; closeAll(true); items.filter((x) => x.kind === 'cap').forEach((it, i) => { const p = CAPPAGES[capPage][i]; it.spec = p; it.name = p.name; const mt = it.tok.children[0].material; mt.color.setHSL((p.n * 0.6180339887 + capPage * 0.13) % 1, capPage === 2 ? 0.6 : 0.85, capPage === 1 ? 0.45 : 0.55); }); drawPg(); }
  // ---------- cámara de inmersión ----------
  window.__dbg = { S }; const cam = S.camera, DIR = V(0, Math.sin(0.98), Math.cos(0.98)), ELEV = { a: 0.5 }, ORB = { az: 0, de: 0, gaz: 0, gde: 0 };
  const REDUCED_MOTION_CASE_CUE=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;    // ~56° desde arriba, recto
  const view = { tx: 0, tz: 0.15, dist: 9, D0: 9, gx: 0, gz: 0.15, gd: 9 };
  // modo paseo: la cámara se suelta del maletín y miras/andas por la habitación
  // Nano bot is the same physical height (0.24 world units) as the miniature robots in the case.
  const NANO_SCALE = 0.24 / 10.5;
  const NANO_PHYSICS = window.UnfireNanoPhysics;
  if (!NANO_PHYSICS) throw new Error("NANO physics script must load before engine");
  const avatarProfile = () => NANO_PHYSICS.profile(!!ROAMS.mini);
  const ROAMS = { on: false, yaw: 0, pitch: -0.12, p: V(0, 8.5, 15), k: {} }; const roamB = document.createElement('button'); roamB.id = 'roamB'; roamB.textContent = '🚶 WALK'; roamB.style.cssText = 'position:fixed;right:14px;bottom:calc(9vh + 14px);z-index:40;border:2px solid #fff;border-radius:999px;padding:9px 14px;font:800 12px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#5fb0ff,#1d4fd8);box-shadow:0 6px 18px #0008;cursor:pointer;display:none'; document.body.appendChild(roamB);

  // ONE lightweight cinematic for the same robotic avatar at NANO scale.
  // A reusable chest-launched mechanical sphere unfolds before the tiny robot
  // becomes controllable. No additional game loop, network state or shaders.
  const NANO_CINEMA = (() => {
    let orb = null, upper = null, lower = null, halo = null, phase = null;
    const smooth = (x) => { const u = Math.max(0, Math.min(1, x)); return u*u*(3-2*u); };
    const build = () => {
      if (orb) return;
      orb = new THREE.Group();
      const casing = new THREE.MeshStandardMaterial({ color: 0x244b9e, metalness: 0.85, roughness: 0.21, emissive: 0x062453, emissiveIntensity: 0.32 });
      const pearl = new THREE.MeshStandardMaterial({ color: 0xe6ecff, metalness: 0.71, roughness: 0.19, emissive: 0x11285f, emissiveIntensity: 0.2 });
      upper = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 10, 0, TAU, 0, H2), casing);
      lower = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 10, 0, TAU, H2, H2), pearl);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 32), Y2K.led('#87eaff', 1.2));
      rim.rotation.x = H2; halo = rim;
      orb.add(upper, lower, rim); orb.visible = false; S.scene.add(orb);
    };
    const busy = () => !!phase;
    const cancel = () => { phase = null; if (orb) orb.visible = false; };
    const start = () => {
      if (phase || !ROAMS.on) return false;
      build();
      const a = ROAMS.cy == null ? ROAMS.yaw : ROAMS.cy;
      const foot = -8.9 + (ROAMS.h || 0);
      const origin = V(ROAMS.p.x + Math.sin(a)*0.48, foot + 5.5, ROAMS.p.z - Math.cos(a)*0.48);
      const goal = V(ROAMS.p.x, foot + 0.17, ROAMS.p.z);
      phase = { t: 0, duration: 1.38, origin, goal, revealed: false, startedAt: performance.now() };
      orb.position.copy(origin); orb.scale.setScalar(1);
      upper.position.y = 0; lower.position.y = 0; upper.rotation.z = 0; lower.rotation.z = 0;
      halo.scale.setScalar(1); orb.visible = true;
      ROAMS.k = {}; ROAMS.tgt = null; ROAMS.touchStick = null;
      return true;
    };
    const tick = (dt) => {
      if (!phase) return;
      const p = phase; const wallTime = Math.max(0, (performance.now() - p.startedAt) / 1000); p.t = Math.min(p.duration, Math.max(p.t + Math.max(0, Math.min(0.07, dt)), wallTime));
      const u = p.t / p.duration, flight = smooth(u/0.61);
      orb.position.lerpVectors(p.origin, p.goal, flight);
      orb.position.y += Math.sin(Math.PI*flight)*0.68;
      orb.rotation.y += Math.min(0.07, dt)*4;
      const open = smooth((u-0.57)/0.32);
      orb.scale.setScalar(0.78 - open*0.52);
      upper.position.y = open*0.56; lower.position.y = -open*0.56;
      upper.rotation.z = open*0.43; lower.rotation.z = -open*0.43;
      halo.scale.setScalar(1 + 0.45*open);
      if (!p.revealed && u >= 0.6) {
        p.revealed = true;
        ROAMS.mini = true; ROAMS.cp = null; ROAMS.ep = null;
        ROAMS.flyH = ROAMS.h || 0; ROAMS.climbV = 0; ROAMS.vy = 0;
      }
      if (u >= 1) { orb.visible = false; phase = null; }
    };
    const avatarFactor = () => !phase || !phase.revealed ? 1 : Math.max(0.06, smooth((phase.t/phase.duration-0.58)/0.39));
    // NANO cruise is comfortable in the huge exterior but never absurdly fast.
    // This changes only NANO's movement response, not the ×1/×3/×8 selector.
    const cruise = (raw, prop, shift, alt) => {
      if (!ROAMS.mini || !ROAMS.fly || !window.ATM_OUT) return raw;
      const level = Math.max(1, Math.min(8, Number.isFinite(prop) ? prop : 1));
      const cap = 55 + 18*(level-1);
      return Math.min(190, cap * (shift ? 1.16 : 1) * (alt ? 0.56 : 1));
    };
    return { busy, cancel, start, tick, avatarFactor, cruise };
  })();
  const MIX = (() => { const d = document.createElement('div'); d.id = 'mix'; d.innerHTML = '<style>#mix{position:fixed;left:14px;top:10px;transform:scale(.88);transform-origin:top left;z-index:40;display:none;gap:6px;flex-direction:column;padding:10px 12px;border-radius:16px;background:linear-gradient(180deg,#eef6ff,#a9cdff);border:2px solid #fff;box-shadow:0 8px 22px #0009,0 0 18px #3d8bff88;font:700 11px Michroma,Arial;color:#0a1a3a}#mix.on{display:flex}#mix .row{display:flex;gap:6px;align-items:center}#mix button{border:0;border-radius:999px;padding:6px 10px;font:800 11px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#5fb0ff,#1d4fd8);cursor:pointer}#mix button.off{background:linear-gradient(180deg,#b8c0d0,#6b7385);opacity:.8}#mix b{font:900 12px Orbitron,Arial;min-width:180px;text-align:center}</style><div class=row><button data-s=-1>◀</button><b id=mixN>—</b><button data-s=1>▶</button></div><div class=row><button data-m=drums>🥁 BATERÍA</button><button data-m=bass>🎸 BAJO</button><button data-m=chords>🎹 ACORDES</button><button data-m=lead>✨ MELODÍA</button><button data-p=1>🎹 OTRA MELODÍA</button></div><div class=row>TONALIDAD <select id=tonK><option value=-1>AUTO</option>' + ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'].map((n, i) => '<option value=' + i + '>' + n + '</option>').join('') + '</select> MODO <select id=tonM><option value=auto>SIGUE LA CANCIÓN</option><option value=mayor>MAYOR</option><option value=menor>MENOR</option><option value=dorico>DÓRICO</option><option value=penta>PENTATÓNICA</option><option value=blues>BLUES</option></select></div><div class=row style="font-size:9px;opacity:.8">Teclado: A S D F G H J K L = blancas · W E T Y U O P = negras · Z/X octava</div>'; document.body.appendChild(d); d.addEventListener('pointerdown', (e) => e.stopPropagation()); d.addEventListener('wheel', (e) => e.stopPropagation());
    d.onchange = (e) => { if (e.target.id === 'tonK') { TON.key = +e.target.value; if (TON.key >= 0) { RADIO.st.lockRoot = 45 + ((TON.key - 9 + 12) % 12); RADIO.st.root = RADIO.st.lockRoot; } else RADIO.st.lockRoot = null; } if (e.target.id === 'tonM') TON.mode = e.target.value; if (TON.mode !== 'auto' && TON.key < 0) { TON.key = 0; d.querySelector('#tonK').value = 0; } hap(0.2); }; d.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; hap(0.25); if (b.dataset.p && HW) { HW.melSeed = (HW.melSeed || 0) + 1; HW.mel = null; say('🎹 Melodía nueva'); } if (b.dataset.s) { const n = RADIO.STYLES.length; RADIO.newSong(((RADIO.st.style + +b.dataset.s) % n + n) % n); } if (b.dataset.m) { const S2 = RADIO.st.stems || (RADIO.st.stems = { drums: 1, bass: 1, chords: 1, lead: 1 }); S2[b.dataset.m] = S2[b.dataset.m] ? 0 : 1; b.classList.toggle('off', !S2[b.dataset.m]); } };
    return { d, tick() { const on = RADIO.st.on && lidOpen > 0.95 && !ROAMS.on; d.classList.toggle('on', on); if (on) { const nm = RADIO.STYLES[RADIO.st.style].name; if (MIX.last !== nm) { MIX.last = nm; d.querySelector('#mixN').textContent = '♪ ' + nm; } } } }; })();
  const ctlB = document.createElement('button'); ctlB.textContent = '🤖 UNFIRE CONTROL'; ctlB.style.cssText = roamB.style.cssText.replace('right:14px', 'right:150px'); document.body.appendChild(ctlB); ctlB.onclick = (e) => { e.stopPropagation(); const c = document.getElementById('chat'); c.classList.toggle('on'); if (c.classList.contains('on')) { const i = document.getElementById('chatq'); i.placeholder = 'Dime algo: «sube HYPERWAVE», «apaga la luz», «busca en YouTube…»'; i.focus(); } }; ctlB.addEventListener('pointerdown', (e) => e.stopPropagation());
  // UNFIRE TUBE: ordenador con un buscador al estilo de los 2000 (vídeos de YouTube embebidos)
  const TUBE = (() => { const d = document.createElement('div'); d.id = 'tube'; d.innerHTML = '<style>#tube{position:fixed;inset:6vh 6vw;z-index:60;display:none;flex-direction:column;background:#ece9d8;border:3px solid #0a246a;border-radius:8px;box-shadow:0 20px 60px #000c;font:13px Tahoma,Verdana,Arial;color:#111}#tube.on{display:flex}#tube .bar{background:linear-gradient(180deg,#0a246a,#3a6ea5);color:#fff;font-weight:700;padding:6px 10px;display:flex;justify-content:space-between}#tube .bar button{background:#c33;color:#fff;border:1px solid #fff;font-weight:700;cursor:pointer}#tube .top{display:flex;gap:8px;align-items:center;padding:10px;background:#fff;border-bottom:1px solid #ccc}#tube .logo{font:900 22px Arial;color:#000}#tube .logo b{background:#c00;color:#fff;border-radius:6px;padding:0 6px;margin-left:2px}#tube input{flex:1;padding:6px;border:1px solid #999;font:13px Tahoma}#tube .go{padding:6px 12px;background:linear-gradient(#fff,#ddd);border:1px solid #999;cursor:pointer}#tube .body{flex:1;display:flex;gap:10px;padding:10px;min-height:0}#tube iframe{flex:1;border:1px solid #999;background:#000}#tube .side{width:220px;overflow:auto;background:#fff;border:1px solid #ccc;padding:8px}#tube .side a{display:block;color:#03c;margin:4px 0;cursor:pointer;text-decoration:underline}</style><div class=bar><span>UNFIRE TUBE 2000 — Explorador</span><button id=tubeX>X</button></div><div class=top><span class=logo>Unfire<b>Tube</b></span><input id=tubeQ placeholder="Paste a YouTube link or enter a search"><button class=go id=tubeGo>Buscar</button></div><div class=body><iframe id=tubeF allow="autoplay; encrypted-media" allowfullscreen></iframe><div class=side><b>Videos recomendados</b> <a id=tubeK style="float:right;cursor:pointer">⚙</a><div id=tubeL></div><p style="font-size:11px;color:#666">Pega un enlace para verlo aquí. Las búsquedas se abren en YouTube.</p></div></div>';
    // Retro desktop of the actual house computer. Keep the Tube app unchanged.
    d.insertAdjacentHTML('beforeend', `<style>
      #tube #pcDesktop,#tube #pcSecret{position:absolute;inset:33px 0 0;z-index:5;background:linear-gradient(145deg,#126f77,#073c58);color:#fff;box-sizing:border-box;padding:clamp(16px,4vw,32px);overflow:auto}
      #tube #pcDesktop{display:flex;flex-direction:column;gap:16px}
      #tube #pcDesktop .pcApps{display:flex;gap:18px;flex-wrap:wrap}
      #tube .pcApp{width:112px;min-height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#ffffff12;border:1px solid #ffffff55;border-radius:10px;color:#fff;cursor:pointer;font:700 12px Tahoma,Arial;text-align:center;touch-action:manipulation}
      #tube .pcApp .glyph{width:58px;height:58px;display:grid;place-items:center;border:2px solid #fff;border-radius:13px;background:linear-gradient(130deg,#dbe8ff,#5275cf);color:#0a246a;font:900 40px Georgia}
      #tube #pcSecret{display:none;z-index:6;flex-direction:column;gap:14px;max-width:100%}
      #tube #pcSecret input{flex:none;width:min(100%,300px);box-sizing:border-box;font-size:16px}
      #tube .pcAction{padding:9px 16px;width:max-content;max-width:100%;font:700 12px Tahoma,Arial;background:#ece9d8;border:1px solid #fff;border-radius:6px;cursor:pointer}
      #tube #pcResult{min-height:24px;font-weight:700;line-height:1.5}
      @media(max-width:500px){#tube #pcDesktop,#tube #pcSecret{padding:14px}}
    </style><div id="pcDesktop"><strong>UNFIRE 2000 · Desktop</strong><div class="pcApps"><button type="button" class="pcApp" id="pcTubeApp"><span class="glyph">▶</span>Unfire Tube</button><button type="button" class="pcApp" id="pcMysteryApp"><span class="glyph">?</span>???</button></div><small>Choose an application.</small></div><div id="pcSecret"><strong style="font-size:18px">? · SECRET ACCESS</strong><p>Enter the code to unlock playable robots on this device. Story and mission progress will be preserved.</p><input id="pcSecretCode" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CÓDIGO" aria-label="Código secreto"><button class="pcAction" id="pcSecretGo" type="button">DESBLOQUEAR</button><div id="pcResult" aria-live="polite"></div><button class="pcAction" id="pcSecretBack" type="button">← ESCRITORIO</button></div>`);
    document.body.appendChild(d); d.addEventListener('pointerdown', (e) => e.stopPropagation()); d.addEventListener('wheel', (e) => e.stopPropagation()); d.addEventListener('keydown', (e) => e.stopPropagation());
    const desktop=d.querySelector('#pcDesktop'), mystery=d.querySelector('#pcSecret');
    const showDesktop=()=>{desktop.style.display='flex';mystery.style.display='none';};
    d.querySelector('#pcTubeApp').onclick=()=>{desktop.style.display='none';mystery.style.display='none';};
    d.querySelector('#pcMysteryApp').onclick=()=>{desktop.style.display='none';mystery.style.display='flex';d.querySelector('#pcSecretCode').focus();};
    d.querySelector('#pcSecretBack').onclick=showDesktop;
    const redeemRobots=()=>{
      const fld=d.querySelector('#pcSecretCode'),msg=d.querySelector('#pcResult');
      if(fld.value.trim().toUpperCase()!=='ULTIMATEROBOTS'){msg.textContent='Code not recognized.';fld.value='';return;}
      try{
        const current=Math.max(0,Number(localStorage.getItem('unfire_unlock'))||0);
        localStorage.setItem('unfire_unlock',String(Math.max(current,20)));
        localStorage.setItem('unfire_secret_robots','1');
      }catch(e){msg.textContent='Could not save the unlock. Check browser storage permissions.';return;}
      msg.textContent='✓ All playable robots unlocked! Open ⚙ → 🔧 WORKSHOP to choose one. Mission progress is preserved.';
      fld.value='';
      try{window.dispatchEvent(new Event('unfire:avatars-unlocked'));}catch(e){}
      hap(0.4);
    };
    d.querySelector('#pcSecretGo').onclick=redeemRobots;
    d.querySelector('#pcSecretCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();redeemRobots();}});
    const play = (q) => { const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(q || ''); if (m) { try { RADIO.stop(); } catch (e) {} document.getElementById('tubeF').src = 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1'; return true; } if (q && q.trim()) { let key = ''; try { key = localStorage.getItem('ytkey') || ''; } catch (e) {} if (key) { fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=' + encodeURIComponent(q.trim()) + '&key=' + encodeURIComponent(key)).then((r) => r.json()).then((j) => { const L = (j.items || []).map((x) => ({ u: 'https://youtu.be/' + x.id.videoId, t: x.snippet.title })); document.getElementById('tubeL').innerHTML = L.map((x) => '<a data-u="' + x.u + '">' + x.t.replace(/</g, '&lt;') + '</a>').join('') || '<i>Sin resultados</i>'; if (L[0]) play(L[0].u); }).catch(() => { document.getElementById('tubeL').innerHTML = '<i>No se pudo buscar (clave o red).</i>'; }); } else { document.getElementById('tubeL').innerHTML = '<i>Para buscar aquí dentro, añade una clave gratuita de YouTube en ⚙. Mientras, pega un enlace.</i><br><a data-yt="' + encodeURIComponent(q.trim()) + '">Open YouTube search ↗</a>'; } } return false; };
    document.getElementById('tubeX').onclick = () => { d.classList.remove('on'); document.getElementById('tubeF').src = 'about:blank'; }; document.getElementById('tubeGo').onclick = () => play(document.getElementById('tubeQ').value); document.getElementById('tubeQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(e.target.value); });
    const LIST = window.UNFIRE_TUBE || []; document.getElementById('tubeL').innerHTML = LIST.length ? LIST.map((x) => '<a data-u="' + x.u + '">' + x.t + '</a>').join('') : '<i>(coming soon: UNFIRE tracks)</i>'; document.getElementById('tubeL').onclick = (e) => { const a = e.target.closest('a'); if (!a) return; if (a.dataset.yt) { window.open('https://www.youtube.com/results?search_query=' + a.dataset.yt, '_blank', 'noopener'); return; } play(a.dataset.u); }; document.getElementById('tubeK').onclick = () => { const k = prompt('Enter your YouTube API key (subject to Google Cloud terms). It stays in this browser:'); if (k != null) { try { localStorage.setItem('ytkey', k.trim()); } catch (e) {} } };
    return { open(q) { d.classList.add('on'); hap(0.4); if (q) { desktop.style.display='none';mystery.style.display='none';document.getElementById('tubeQ').value = q; play(q); } else showDesktop(); } }; })();

  // ===== EXTERIOR · sonido atmosférico 3D (HRTF + cielo enorme), tormenta con lluvia y truenos a distancia real =====
  const ATM = (() => { const st = { out: false, on: false, storm: false, ang: 0, rain: null, flash: 0, next: 6 }; const btn = document.createElement('button'); btn.id = 'atmBtn'; btn.textContent = '🌍 GO OUTSIDE'; btn.style.cssText = 'position:fixed;right:14px;bottom:calc(9vh + 60px);z-index:40;border:2px solid #fff;border-radius:999px;padding:9px 14px;font:800 12px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#5ee36a,#15a03a);box-shadow:0 6px 18px #0008;cursor:pointer;display:none'; document.body.appendChild(btn);
    const pan = document.createElement('div'); pan.innerHTML = '<style>#atm{position:fixed;left:14px;bottom:calc(9vh + 14px);z-index:40;display:none;gap:6px;padding:10px 12px;border-radius:16px;background:linear-gradient(180deg,#eef6ff,#a9cdff);border:2px solid #fff;box-shadow:0 8px 22px #0009;font:700 11px Michroma,Arial;color:#0a1a3a;flex-direction:column}#atm.on{display:flex}#atm button{border:0;border-radius:999px;padding:6px 10px;font:800 11px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#5fb0ff,#1d4fd8);cursor:pointer;margin:2px}#atm button.off{background:linear-gradient(180deg,#b8c0d0,#6b7385)}#atm input{width:100%}</style><div id=atm><b>3D SKY · ATMOSPHERE</b><div><button id=atmOn class=off>🔊 3D SOUND</button><button id=atmSt class=off>⛈️ STORM</button><button id=atmTh>⚡ THUNDER</button></div><label>Sound direction<input id=atmDir type=range min=0 max=360 value=0></label><label>Distance (m)<input id=atmDist type=range min=1 max=2000 value=40></label></div>'; document.body.appendChild(pan); const P = pan.querySelector('#atm'); window.__ATMP = P; { const s2 = document.createElement('style'); s2.textContent = '#atmBtn,#atm,#handBtn{display:none!important}'; document.head.appendChild(s2); } P.addEventListener('pointerdown', (e) => e.stopPropagation()); P.addEventListener('wheel', (e) => e.stopPropagation());
    let pn = null, wet = null, dry = null; const ctx = () => UA.ctx;
    function ir(c, sec) { const len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); } return b; }
    function spatial(on) { try { UA.init(); const c = ctx(), o = RADIO.out; if (!o) { RADIO.init(); } const out = RADIO.out; if (on && !pn) { pn = c.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 8; pn.rolloffFactor = 0.6; const cv = c.createConvolver(); cv.buffer = ir(c, 1.3); wet = c.createGain(); wet.gain.value = 0.23; dry = c.createGain(); dry.gain.value = 1; out.disconnect(); out.connect(pn); pn.connect(dry).connect(UA.bus.master); pn.connect(cv).connect(wet).connect(UA.bus.master); } else if (!on && pn) { out.disconnect(); out.connect(UA.bus.master); pn.disconnect(); if(dry)dry.disconnect(); if(wet)wet.disconnect(); pn=wet=dry=null; } } catch (e) { console.warn(e); } }
    function thunder() { st.flash = 1; const d = (+P.querySelector('#atmDist').value || 800); const delay = Math.min(6, d / 343); if (!audioOk() || REC_GUARD()) return; const c = ctx(), n = c.currentTime + delay, len = c.sampleRate * 5, b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const D = b.getChannelData(ch); let l = 0; for (let i = 0; i < len; i++) { const env = Math.pow(1 - i / len, 2) * (i < c.sampleRate * 0.08 ? i / (c.sampleRate * 0.08) : 1); l = l * 0.97 + (Math.random() * 2 - 1) * 0.03; D[i] = (l * 8 + (Math.random() < 0.002 ? (Math.random() - 0.5) : 0)) * env; } } const s0 = c.createBufferSource(); s0.buffer = b; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(180, 2500 - d); const g = c.createGain(); g.gain.value = Math.min(0.9, 40 / Math.sqrt(d)); const p = c.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; s0.connect(f).connect(g).connect(p).connect(UA.bus.master); s0.start(n); }
    function rain(on) { try { if (on && !st.rain) { UA.init(); const c = ctx(), len = c.sampleRate * 2, b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const D = b.getChannelData(ch); for (let i = 0; i < len; i++) D[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.25); } const s0 = c.createBufferSource(); s0.buffer = b; s0.loop = true; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 350; const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 3200; const g = c.createGain(); g.gain.value = 0.03; s0.connect(f).connect(lp2).connect(g).connect(UA.bus.master); s0.start(); st.rain = { s0, g }; window.__RAING = g; } else if (!on && st.rain) { st.rain.s0.stop(); st.rain = null; } } catch (e) {} }
    P.querySelector('#atmOn').onclick = (e) => { st.on = !st.on; e.target.classList.toggle('off', !st.on); spatial(st.on); hap(0.4); try { RADIO.start(); } catch (er) {} };
    P.querySelector('#atmSt').onclick = (e) => { st.storm = !st.storm; e.target.classList.toggle('off', !st.storm); rain(st.storm); hap(0.4); };
    P.querySelector('#atmTh').onclick = () => { thunder(); hap(0.8); };
    // lluvia visible
    const RN = 1500, rg = new THREE.BufferGeometry(), rp = new Float32Array(RN * 3); for (let i = 0; i < RN; i++) { rp[i * 3] = (Math.random() - 0.5) * 80; rp[i * 3 + 1] = Math.random() * 40; rp[i * 3 + 2] = (Math.random() - 0.5) * 80; } rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); const rainP = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.18, transparent: true, opacity: 0.7, depthWrite: false })); rainP.visible = false; S.scene.add(rainP); const fl = new THREE.HemisphereLight(0xdfe8ff, 0x223344, 0); S.scene.add(fl);
    const goOut = (v) => { if (!!v !== st.out) btn.onclick({ stopPropagation() {} }); }; btn.onclick = (e) => { e.stopPropagation(); st.out = !st.out; if (st.out && !st.on) { st.on = true; P.querySelector('#atmOn').classList.remove('off'); spatial(true); try { RADIO.start(); } catch (er) {} } if (st.out) { enterRoam(); ROAMS.p.set(-30, 4.5, 108); ROAMS.pitch = 0.02; ROAMS.yaw = Math.PI; window.__RBsave = window.__RBsave || window.__RB; window.__RB = { x: 12000, z0: -12000, z1: 12000 }; window.__WORLD_R = 16000; window.ATM_OUT = true; btn.textContent = '🏠 GO INSIDE'; } else { window.__RB = window.__RBsave || window.__RB; window.__RBsave = null; window.ATM_OUT = false; ROAMS.p.set(-30, 4.5, 88); ROAMS.yaw = 0; btn.textContent = '🌍 GO OUTSIDE'; } hap(0.5); };
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    const setOut = (v) => { // Animate only real house-door walking crossings; never block the physics path.
      try { window.UNFIRE_DOOR_CINEMA?.cross({ next:v, previous:st.out,
        x:ROAMS.p.x, z:ROAMS.p.z, on:ROAMS.on, mini:ROAMS.mini, fly:ROAMS.fly }); } catch (_) {}
      st.out = v; window.ATM_OUT = v; if (v) { if(window.__warmOutsideObstacles)window.__warmOutsideObstacles(); if (!st.on) { st.on = true; P.querySelector('#atmOn').classList.remove('off'); setTimeout(()=>{if(st.out&&!document.hidden)spatial(true);},280); } window.__RBsave = window.__RBsave || window.__RB; window.__RB = { x: 12000, z0: -12000, z1: 12000 }; window.__WORLD_R = 16000; btn.textContent = '🏠 GO INSIDE'; say('🌍 You are outside · the whole island is yours to explore'); } else { window.__RB = window.__RBsave || window.__RB; window.__RBsave = null; btn.textContent = '🌍 GO OUTSIDE'; } }; return { setOut, st, goOut, thunder, rain, tick(dt, t) { btn.style.display = ROAMS.on && window.__OUT_OPEN ? 'block' : 'none'; P.classList.toggle('on', st.out && ROAMS.on); if (pn) { const a = (+P.querySelector('#atmDir').value) * Math.PI / 180, d = +P.querySelector('#atmDist').value, L = ctx().listener, cp = cam.position; const x = cp.x + Math.sin(a) * Math.min(d, 400), z = cp.z - Math.cos(a) * Math.min(d, 400); if (pn.positionX) { pn.positionX.value = x; pn.positionY.value = cp.y + 2; pn.positionZ.value = z; } if (L.positionX) { L.positionX.value = cp.x; L.positionY.value = cp.y; L.positionZ.value = cp.z; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); L.forwardX.value = dir.x; L.forwardY.value = dir.y; L.forwardZ.value = dir.z; } wet.gain.value = Math.min(0.8, 0.15 + d / 2000); }
      rainP.visible = st.storm; if (st.storm) { const p = rg.attributes.position.array; for (let i = 0; i < RN; i++) { p[i * 3 + 1] -= dt * 40; if (p[i * 3 + 1] < -9) p[i * 3 + 1] = 35; } rg.attributes.position.needsUpdate = true; rainP.position.set(cam.position.x, 0, cam.position.z); st.next -= dt; if (st.next < 0) { st.next = 5 + Math.random() * 12; P.querySelector('#atmDist').value = 300 + Math.random() * 1700; thunder(); } }
      st.flash = Math.max(0, st.flash - dt * 3); fl.intensity = st.flash > 0 ? (Math.random() < 0.5 ? 2.5 : 0.4) * st.flash : 0; } }; })();

  const DJP = (() => { const d = document.createElement('div'); d.innerHTML = '<style>#dj{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:61;display:none;width:min(760px,94vw);padding:14px;border-radius:18px;background:linear-gradient(180deg,#2a2d36,#111318);border:2px solid #4a4f5c;box-shadow:0 30px 80px #000c,inset 0 1px 0 #ffffff22;color:#cfd6e4;font:700 11px Michroma,Arial}#dj.on{display:block}#dj .row{display:flex;gap:12px}#dj .deck{flex:1;background:#1a1c22;border:1px solid #333;border-radius:14px;padding:10px;text-align:center}#dj .jog{width:150px;height:150px;margin:8px auto;border-radius:50%;background:radial-gradient(circle,#3d8bff 0 10%,#111 11% 60%,#2a2d36 61% 64%,#0b0b0e 65%);box-shadow:0 0 0 4px #4a4f5c,0 0 18px #3d8bff66}#dj button,#dj select,#dj label.f{border:0;border-radius:8px;padding:7px 10px;margin:3px;font:800 11px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#4a4f5c,#2a2d36);cursor:pointer}#dj button.play{background:linear-gradient(180deg,#2bd96b,#15a03a)}#dj .mix{width:150px;background:#1a1c22;border:1px solid #333;border-radius:14px;padding:10px;text-align:center}#dj input[type=range]{width:100%}#dj .x{position:absolute;right:10px;top:8px;background:#c33}</style><div id=dj><button class=x id=djX>✕</button><div style="text-align:center;margin-bottom:8px;letter-spacing:.2em">UNFIRE · CDJ-2000 STYLE</div><div class=row><div class=deck><b>DECK A · RADIO UNFIRE</b><div class=jog id=jogA></div><select id=djStyle></select><br><button class=play id=playA>▶ / ❚❚</button><br>TEMPO<input type=range id=tA min=-8 max=8 value=0></div><div class=mix><b>MIXER</b><br>A · GRAVES<input type=range id=loA min=-24 max=6 value=0>B · GRAVES<input type=range id=loB min=-24 max=6 value=0>CROSSFADER<input type=range id=xf min=0 max=100 value=0></div><div class=deck><b>DECK B · TU CANCIÓN</b><div class=jog id=jogB></div><label class=f>📂 CARGAR CANCIÓN<input type=file id=fileB accept="audio/*" hidden></label><br><button class=play id=playB>▶ / ❚❚</button><br>TEMPO<input type=range id=tB min=-8 max=8 value=0></div></div></div>'; document.body.appendChild(d); const D = d.querySelector('#dj'); ['pointerdown', 'wheel', 'keydown'].forEach((ev) => D.addEventListener(ev, (e) => e.stopPropagation()));
    const sel = D.querySelector('#djStyle'); RADIO.STYLES.forEach((x, i) => { const o = document.createElement('option'); o.value = i; o.textContent = x.name; sel.appendChild(o); }); sel.onchange = () => { try { UA.init(); RADIO.start(); RADIO.newSong(+sel.value); } catch (e) {} };
    let audio = null, srcB = null, gA = null, gB = null, eqA = null, eqB = null, rotA = 0, rotB = 0;
    const wire = () => { if (gA || !UA.ctx) return; const c = UA.ctx; RADIO.init(); const out = RADIO.out; gA = c.createGain(); eqA = c.createBiquadFilter(); eqA.type = 'lowshelf'; eqA.frequency.value = 200; try { out.disconnect(); } catch (e) {} out.connect(eqA).connect(gA).connect(UA.bus.master); gB = c.createGain(); eqB = c.createBiquadFilter(); eqB.type = 'lowshelf'; eqB.frequency.value = 200; eqB.connect(gB).connect(UA.bus.master); xf(); };
    const xf = () => { if (!gA) return; const v = +D.querySelector('#xf').value / 100; gA.gain.value = Math.cos(v * H2); gB.gain.value = Math.sin(v * H2); };
    D.querySelector('#xf').oninput = xf; D.querySelector('#loA').oninput = (e) => { if (eqA) eqA.gain.value = +e.target.value; }; D.querySelector('#loB').oninput = (e) => { if (eqB) eqB.gain.value = +e.target.value; };
    D.querySelector('#playA').onclick = () => { window.__djOn = true; try { UA.init(); wire(); RADIO.st.on ? RADIO.stop() : RADIO.start(); } catch (e) {} };
    D.querySelector('#fileB').onchange = (e) => { const f = e.target.files[0]; if (!f) return; window.__djOn = true; try { UA.init(); wire(); if (!audio) { audio = new Audio(); audio.loop = true; srcB = UA.ctx.createMediaElementSource(audio); srcB.connect(eqB); } audio.src = URL.createObjectURL(f); audio.play(); D.querySelector('#xf').value = 50; xf(); say('💿 Deck B: ' + f.name); } catch (er) { console.warn(er); } };
    D.querySelector('#playB').onclick = () => { if (audio) { audio.paused ? audio.play() : audio.pause(); } };
    D.querySelector('#tB').oninput = (e) => { if (audio) audio.playbackRate = 1 + (+e.target.value) / 100; };
    D.querySelector('#djX').onclick = () => { D.classList.remove('on'); window.__djOn = !!(audio && !audio.paused); };
    setInterval(() => { if (!D.classList.contains('on')) return; if (RADIO.st.on) rotA += 12; if (audio && !audio.paused) rotB += 12 * (audio.playbackRate || 1); D.querySelector('#jogA').style.transform = 'rotate(' + rotA + 'deg)'; D.querySelector('#jogB').style.transform = 'rotate(' + rotB + 'deg)'; }, 50);
    return { open() { D.classList.add('on'); sel.value = RADIO.st.style; hap(0.4); } }; })();
  const camB = document.createElement('button'); camB.id = 'camB'; camB.textContent = '🎥 VIEW: 3RD PERSON (C)'; camB.style.cssText = roamB.style.cssText.replace('bottom:calc(9vh + 14px)', 'bottom:calc(9vh + 106px)'); document.body.appendChild(camB); camB.addEventListener('pointerdown', (e) => e.stopPropagation()); camB.onclick = (e) => { e.stopPropagation(); const n = NANO_PHYSICS.nextCameraMode(ROAMS.mode || '3p'); ROAMS.cp = null; ROAMS.ep = null; ROAMS.mode = n; camB.textContent = '🎥 VIEW: ' + { libre: 'DRONE', '1p': '1ST PERSON', '2p': '2ND PERSON', '3p': '3RD PERSON', '3pl': '3RD DISTANT' }[n] + ' (C)'; hap(0.3); };
  // ===== CINEMA / RECORDING: cámara libre por toda la casa y el mundo, sin interfaz, para grabar como en los juegos =====
  const REC = window.__REC = { on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), yaw: 0, pitch: 0, k: {}, slow: 0 };
  const recB = document.createElement('button'); recB.id = 'recB'; recB.textContent = '🎬 CINEMA MODE (V)'; recB.style.cssText = camB.style.cssText.replace('bottom:calc(9vh + 106px)', 'bottom:calc(9vh + 152px)'); recB.style.bottom = 'calc(9vh + 152px)'; recB.style.top = 'auto'; document.body.appendChild(recB); recB.addEventListener('pointerdown', (e) => e.stopPropagation());
  const recHud = document.createElement('div'); recHud.id = 'recHud'; recHud.innerHTML = '<b style="color:#ff2a4a">● REC</b> <span>CINEMA MODE · FREE CAMERA · NO COLLISIONS · WASD · Q/E · V to exit</span> <button id="recX">✕ EXIT</button>'; recHud.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;display:none;align-items:center;gap:10px;font:600 11px "Share Tech Mono",monospace;color:#fff;background:rgba(0,0,0,.42);padding:6px 10px;border-radius:12px;backdrop-filter:blur(6px);transition:opacity 1.2s;max-width:calc(100vw - 32px);flex-wrap:wrap;justify-content:center';
  document.body.appendChild(recHud); { const st = document.createElement('style'); st.textContent = 'body.recOn>*:not(#cv):not(#recHud):not(audio):not(iframe){visibility:hidden!important}#recX{all:unset;cursor:pointer;color:#fff;background:#ff2a4a;padding:3px 8px;border-radius:8px}'; document.head.appendChild(st); }
  // controles abajo a la derecha en una sola columna ordenada: nunca se pisan, se encogen en pantallas pequeñas o ventanas minimizadas
  { const dock = document.createElement('div'); dock.id = 'ctlDock'; dock.style.cssText = 'position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(9vh + 14px);z-index:40;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:8px;pointer-events:none;max-height:calc(100vh - 140px)'; document.body.appendChild(dock); const surfB = document.createElement('button'); surfB.id = 'surfB'; surfB.textContent = '🏄 BOARD: OFF (B)'; surfB.style.cssText = camB.style.cssText; surfB.style.background = 'linear-gradient(180deg,#5fe0ff,#0a8fb8)'; surfB.addEventListener('pointerdown', (e) => e.stopPropagation()); window.__surfToggle = () => { ROAMS.board = !ROAMS.board; surfB.textContent = ROAMS.board ? '🏄 BOARD: ON (B)' : '🏄 BOARD: OFF (B)'; say(ROAMS.board ? '🏄 Board enabled · on water: SPACE = trick (hold to fly)' : '🪽 Board stored · SPACE restores flight'); hap(0.3); }; surfB.onclick = (e) => { e.stopPropagation(); window.__surfToggle(); }; window.__surfB = surfB; const onlB = document.createElement('button'); onlB.id = 'onlB'; onlB.textContent = '🌐 ONLINE'; onlB.style.cssText = camB.style.cssText; onlB.style.background = 'linear-gradient(180deg,#b06bff,#6a2bd8)'; onlB.addEventListener('pointerdown', (e) => e.stopPropagation()); onlB.onclick = (e) => { e.stopPropagation(); try { ONLINE.open(); } catch (er) {} }; window.__onlB = onlB; const nimB = document.createElement('button'); nimB.id = 'nimB'; nimB.textContent = '🤖 NIMBO: COME'; nimB.style.cssText = camB.style.cssText; nimB.style.background = 'linear-gradient(180deg,#ff5a6a,#c8102e)'; nimB.addEventListener('pointerdown', (e) => e.stopPropagation()); nimB.onclick = (e) => { e.stopPropagation(); try { if (window.__NIMBO) window.__NIMBO.toggle(true); } catch (er) {} }; window.__nimB = nimB; [roamB, camB, recB, surfB, onlB, nimB].forEach((b) => { b.style.position = 'static'; b.style.right = b.style.bottom = b.style.top = b.style.left = 'auto'; b.style.pointerEvents = 'auto'; b.style.whiteSpace = 'nowrap'; dock.appendChild(b); }); const st = document.createElement('style'); st.textContent = '@keyframes surfPop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}#ctlDock button{font-size:clamp(9px,1.6vw,12px)!important;padding:clamp(6px,1.2vw,9px) clamp(9px,1.8vw,14px)!important}@media (hover:hover) and (max-height:520px){#ctlDock{bottom:12px!important;flex-direction:row-reverse!important}}@media (hover:hover) and (max-width:520px){#ctlDock{bottom:calc(9vh + 60px)!important}}body.storyOn #ctlDock{visibility:hidden}@media(pointer:coarse) and (max-height:420px) and (orientation:landscape){#ctlDock button{min-height:30px!important;padding:3px 6px!important;font-size:9px!important}}'; document.head.appendChild(st); }
  let recIdle = 0; const recWake = () => { recIdle = 0; recHud.style.opacity = '1'; };
  REC.set = (v) => { if (!!v === REC.on) return; if (v && !ROAMS.on) return; REC.on = !!v; document.body.classList.toggle('recOn', REC.on); recHud.style.display = REC.on ? 'flex' : 'none'; REC.k = {}; if (REC.on) { REC.p.copy(cam.position); const d = new THREE.Vector3(); cam.getWorldDirection(d); REC.yaw = Math.atan2(d.x, -d.z); REC.pitch = Math.asin(clamp(d.y, -1, 1)); REC.v.set(0, 0, 0); for (const k in ROAMS.k) ROAMS.k[k] = 0; recWake(); } else { ROAMS.cp = null; } };
  const CINEMA_EXPORT = window.UnfireCinemaExport && window.UnfireCinemaExport.create({
    canvas:cv,hud:recHud,REC,getAudio:()=>UA,lowPower:LOWDEV,say
  });
  if (CINEMA_EXPORT) {
    const cinematicSet = REC.set;
    REC.set = (v) => { if (!v && CINEMA_EXPORT.recording) CINEMA_EXPORT.stop(); return cinematicSet(v); };
  }
  recB.onclick = (e) => { e.stopPropagation(); REC.set(!REC.on); hap(0.3); }; recHud.querySelector('#recX').onclick = (e) => { e.stopPropagation(); REC.set(false); };
  addEventListener('pointermove', recWake); addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k === 'v' && ROAMS.on && !e.repeat) { REC.set(!REC.on); e.preventDefault(); e.stopImmediatePropagation(); return; } if (!REC.on) return; recWake(); if (k === 'Escape') { REC.set(false); e.stopImmediatePropagation(); return; } REC.k[k] = 1; e.preventDefault(); e.stopImmediatePropagation(); }, true);
  addEventListener('keyup', (e) => { REC.k[e.key.length === 1 ? e.key.toLowerCase() : e.key] = 0; });
  REC.tick = (dt) => { recIdle += dt; if (recIdle > 3) recHud.style.opacity = '0.08'; const K = REC.k, J = ROAMS.k; const fw = (K.w || K.ArrowUp || J.w || J.ArrowUp ? 1 : 0) - (K.s || K.ArrowDown || J.s || J.ArrowDown ? 1 : 0), sd = (K.d || K.ArrowRight || J.d || J.ArrowRight ? 1 : 0) - (K.a || K.ArrowLeft || J.a || J.ArrowLeft ? 1 : 0), up = (K.e || K[' '] || J[' '] ? 1 : 0) - (K.q || K.c ? 1 : 0);
    const sp = (window.ATM_OUT ? 60 : 16) * (K.Shift ? 3 : K.Alt ? 0.3 : 1); const cy = Math.cos(REC.pitch), fx = Math.sin(REC.yaw) * cy, fz = -Math.cos(REC.yaw) * cy, fy = Math.sin(REC.pitch); const want = new THREE.Vector3(fx * fw + Math.cos(REC.yaw) * sd, fy * fw + up, fz * fw + Math.sin(REC.yaw) * sd).multiplyScalar(sp);
    // Cinematic camera is a spectator, independent of robot and collision physics.
    // No collision, ceiling/floor clamp or wall/window blocking, inside or outside the house.
    REC.v.lerp(want,1-Math.exp(-2.5*Math.min(.12,dt)));
    REC.p.addScaledVector(REC.v,dt);
    // Guard only against numeric overflow if a camera flies very far.
    REC.p.x=clamp(REC.p.x,-90000,90000);REC.p.y=clamp(REC.p.y,-90000,90000);REC.p.z=clamp(REC.p.z,-90000,90000);
    if (!REC.cq) { REC.cy = REC.yaw; REC.cpch = REC.pitch; REC.cq = 1; } REC.cy = angL(REC.cy, REC.yaw, Math.min(1, dt * 6)); REC.cpch += (REC.pitch - REC.cpch) * Math.min(1, dt * 6);
    cam.position.copy(REC.p); const c2 = Math.cos(REC.cpch); cam.lookAt(REC.p.x + Math.sin(REC.cy) * c2, REC.p.y + Math.sin(REC.cpch), REC.p.z - Math.cos(REC.cy) * c2); cam.near = 0.08; };
  function enterRoam() { if (ROAMS.on) return; ROAMS.k = {}; ROAMS.tgt = null; ROAMS.touchStick = null; ROAMS.on = true; document.body.classList.add('unfire-roaming'); ROAMS.p.set(0, 4.5, 24); try { if (!cv.hasAttribute('tabindex')) cv.tabIndex = 0; cv.focus({ preventScroll: true }); } catch (_) {} ROAMS.yaw = 0; ROAMS.pitch = -0.05; roamB.textContent = '↩ RETURN TO CASE'; say('🎮 W A S D / arrows: move · drag mouse: look · Q/E: turn · Shift: run · C: camera · M: map'); }
  function exitRoam() { if (REC.on) REC.set(false); if (!ROAMS.on) return;
    NANO_CINEMA.cancel();CASE_VIEW.on=false;CAPS.cancel();carryingCase=false;caseG.visible=true;caseG.scale.setScalar(1);caseG.position.copy(originalCasePosition);caseG.rotation.y=0;updateCarryUI();
 ROAMS.on = false; ROAMS.k = {}; document.body.classList.remove('unfire-roaming'); ROAMS.cp = null; ROAMS.mini = false; ROAMS.freeRobotMode = false; if (ROAMS.av && ROAMS.av.w) ROAMS.av.w.visible = false; if (window.__RBsave) { window.__RB = window.__RBsave; window.__RBsave = null; } try { ATM.st.out = false; } catch (e) {} roamB.textContent = '🚶 WALK'; view.gd = view.D0; view.gx = 0; view.gz = 0.15; }
  // First visit: the EXISTING PASEAR control blinks for exactly two seconds
  // once the physical lid has completely opened, then stays visible.
  let firstCaseWalkHint=false;
  try{firstCaseWalkHint=localStorage.getItem('unfire_pasear_intro_v1')==='1';}catch(e){}
  let caseWalkHintTimer=0;
  function updateRoamButtonHint(){
    const ready=!ROAMS.on&&!CASE_VIEW.on&&caseG.visible&&!carryingCase&&!CINE.on
      &&pTarget>.99&&lidOpen>=.998;
    const show=ready||(ROAMS.on&&lidOpen>.95&&!CINE.on);
    // Keep the SINGLE original button in the right action rail in both states.
    // The button changes its purpose to return to the case when exploring;
    // never reparent it into the viewport or spawn a second CTA.
    const dock=document.getElementById('ctlDock');
    if(dock){
      if(roamB.parentElement!==dock)dock.appendChild(roamB);
      if(roamB.style.position!=='static')roamB.style.position='static';
    }
    if(roamB.style.display!==(show?'block':'none'))roamB.style.display=show?'block':'none'; if(ROAMS.on)roamB.textContent=CASE_VIEW.on?'↩ RETURN TO ROBOT':'↩ RETURN TO CASE';
    if(ready&&!firstCaseWalkHint){
      firstCaseWalkHint=true;
      try{localStorage.setItem('unfire_pasear_intro_v1','1');}catch(e){}
      roamB.classList.add('unfire-intro-blink');
      clearTimeout(caseWalkHintTimer);
      caseWalkHintTimer=setTimeout(()=>{
        roamB.classList.remove('unfire-intro-blink');caseWalkHintTimer=0;
      },2000);
    }
    if(!ready&&roamB.classList.contains('unfire-intro-blink')){
      clearTimeout(caseWalkHintTimer);
      roamB.classList.remove('unfire-intro-blink');
      caseWalkHintTimer=0;
    }
  }
  roamB.addEventListener('pointerdown',e=>e.stopPropagation());
  roamB.onclick=(e)=>{
    e.stopPropagation();
    roamB.classList.remove('unfire-intro-blink');
    if(ROAMS.on&&CASE_VIEW.on)showRobotView();
    else if(ROAMS.on)exitRoam();
    else if(pTarget>.99&&lidOpen>=.998)enterRoam();
    updateRoamButtonHint();
  };
  window.__roamAPI = { ROAMS, enterRoam, exitRoam, roamMove }; window.__OUT_OPEN = true;
  { const spB = document.createElement('button'); const SP = [['🐢 SLOW', 0.45], ['🚶 NORMAL', 1], ['🏃 FAST', 1.8]]; let si = 1; window.__walkK = 1; spB.textContent = SP[si][0]; spB.style.cssText = camB.style.cssText.replace('bottom:calc(9vh + 106px)', 'bottom:calc(9vh + 152px)'); document.body.appendChild(spB); spB.addEventListener('pointerdown', (e) => e.stopPropagation()); spB.onclick = () => { si = (si + 1) % 3; window.__walkK = SP[si][1]; spB.textContent = SP[si][0]; hap(0.2); say('Velocidad: ' + SP[si][0] + ' · Shift to run, Alt to move slowly'); }; spB.style.setProperty('display', 'none', 'important'); }
  // ===== RADIO DE PARED: tus canciones por los altavoces de la casa (sonido espacial). Suena sola, se apaga/enciende/cambia; tus archivos en los tocadiscos =====
  const SONGS_OW = window.UNFIRE_SONGS || [{"f": "s01.mp3", "t": "SUPER MEGA FLOW", "a": "UK Bass Waves", "d": 102}, {"f": "s02.mp3", "t": "I AM PIER", "a": "UK Bass Waves", "d": 102}, {"f": "s03.mp3", "t": "PUNKI DOOM", "a": "UK Bass Waves", "d": 102}, {"f": "s04.mp3", "t": "GOLD DIMENSION", "a": "UK Bass Waves", "d": 108}, {"f": "s05.mp3", "t": "NEMESIS INFERNO", "a": "UK Bass Waves", "d": 90}, {"f": "s06.mp3", "t": "11PM", "a": "UK Bass Waves", "d": 95}, {"f": "s07.mp3", "t": "DRAGONS", "a": "UK Bass Waves", "d": 136}, {"f": "s08.mp3", "t": "LIKE U", "a": "UK Bass Waves", "d": 83}, {"f": "s10.mp3", "t": "MYSTIC MODE", "a": "UK Bass Waves", "d": 77}, {"f": "s11.mp3", "t": "OMG", "a": "UK Bass Waves", "d": 103}, {"f": "s12.mp3", "t": "RAW9", "a": "UK Bass Waves", "d": 82}, {"f": "s13.mp3", "t": "TRACEY APEX", "a": "UK Bass Waves", "d": 138}, {"f": "s16.mp3", "t": "PRESIDENT", "a": "UK Bass Waves", "d": 137}, {"f": "s17.mp3", "t": "AURON", "a": "UK Bass Waves", "d": 162}, {"f": "s18.mp3", "t": "SKYNET", "a": "UK Bass Waves", "d": 102}];
  const WRADIO = (() => { const st = { vol: 0.27, idle: 0, on: true, list: SONGS_OW.slice(), i: Math.floor(Math.random() * Math.max(1, SONGS_OW.length)), user: null, level: 0 };
    // Calm GTA-style background music on first visit; do not reset a player's own slider choice.
    const radioVolumeKey = 'unfire_radio_volume_v1';
    try { const saved = localStorage.getItem(radioVolumeKey); if (saved !== null && saved !== '' && Number.isFinite(+saved)) st.vol = Math.min(1, Math.max(0, +saved)); } catch (_) {} let el = null, gIn = null, an = null, started = false, dryG = null; const buf = new Uint8Array(256); const MEDIA = IMG.replace(/img\/?$/, 'media/');
    function ensure() { if (el) return true; if (!audioOk()) return false; const c = UA.ctx; el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.addEventListener('ended', () => next(true)); const src = c.createMediaElementSource(el); const hs = c.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 9500; hs.gain.value = -1.5; const ls = c.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 90; ls.gain.value = -1; gIn = c.createGain(); gIn.gain.value = 0; src.connect(ls); ls.connect(hs); hs.connect(gIn); an = c.createAnalyser(); an.fftSize = 512; gIn.connect(an);
      const sp = (window.__RC && window.__RC.SPEAK && window.__RC.SPEAK.length) ? window.__RC.SPEAK : [{ pos: V(0, 10, 40) }]; const sum = c.createGain(); sum.gain.value = 0.9; sum.connect(UA.bus.master);
      const dry = c.createGain(); dry.gain.value = 0.35; dryG = dry; gIn.connect(dry); dry.connect(sum);
      sp.forEach((s0) => { const p = c.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 22; p.rolloffFactor = 0.5; if (p.positionX) { p.positionX.value = s0.pos.x; p.positionY.value = s0.pos.y; p.positionZ.value = s0.pos.z; } else p.setPosition(s0.pos.x, s0.pos.y, s0.pos.z); const g = c.createGain(); g.gain.value = 0.9 / Math.sqrt(sp.length); gIn.connect(p); p.connect(g); g.connect(sum); }); return true; }
    const cur = () => st.user || st.list[st.i % Math.max(1, st.list.length)];
    function play() { if (!ensure()) return; const c0 = cur(); if (!c0) return; const u = c0.url || (MEDIA + 'songs/' + c0.f); if (el.dataset.u !== u) { el.dataset.u = u; el.src = u; } el.play().catch(() => {}); gIn.gain.setTargetAtTime(1, UA.ctx.currentTime, 0.5); say('📻 Now playing: ' + (c0.t || c0.name)); upd(); }
    function stopR() { if (!el) return; gIn.gain.setTargetAtTime(0, UA.ctx.currentTime, 0.25); setTimeout(() => { if (!st.on && el) el.pause(); }, 1200); upd(); }
    function next(auto) { if (!auto) try { window.UEV('radio'); } catch (e) {} if (st.user && auto) st.user = null; else if (st.user) st.user = null; else st.i++; if (st.on) play(); }
    function toggle() { try { window.UEV('radio'); } catch (e) {} st.on = !st.on; st.on ? play() : stopR(); hap(0.3); }
    function loadFile(f) { if (!f) return; st.user = { url: URL.createObjectURL(f), name: f.name.replace(/\.[^.]+$/, '') }; st.on = true; play(); }
    const bar = document.createElement('div'); bar.id = 'wradio'; bar.innerHTML = '<style>#wradio{position:fixed;left:14px;bottom:calc(9vh + 14px);z-index:40;display:none;gap:6px;font:700 12px Orbitron,Arial}@media (pointer:coarse){#wradio{box-sizing:border-box;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 112px);bottom:auto;max-width:calc(100vw - 20px);padding:5px;gap:4px;border-radius:14px;background:#090e1bdb;box-shadow:0 4px 18px #0009}#wradio button{box-sizing:border-box;min-width:38px;min-height:38px;padding:6px!important;font-size:13px!important}#wradio #wrOn{font-size:0!important;width:42px;min-width:42px}#wrOn::after{content:\"📻\";font-size:19px}#wrMore{display:inline-flex!important;align-items:center;justify-content:center}#wradio:not(.expanded) #wrUp,#wradio:not(.expanded) #wrV,#wradio:not(.expanded) #wrT{display:none!important}#wradio.expanded{width:min(94vw,340px);flex-wrap:wrap;justify-content:center;padding:9px}#wradio.expanded #wrUp{display:inline-block}#wradio.expanded #wrV{display:block;min-width:100px;flex:1}#wradio.expanded #wrT{display:block;box-sizing:border-box;width:100%;max-width:none;text-align:center;font-size:10px}}@media (pointer:coarse) and (orientation:landscape){#wradio{top:calc(env(safe-area-inset-top) + 52px);left:50%;max-width:calc(100vw - 350px)}#wradio.expanded{max-width:min(70vw,340px)} }@media (pointer:coarse) and (max-width:440px) and (orientation:landscape){#wradio{top:calc(env(safe-area-inset-top) + 55px);max-width:calc(100vw - 20px)}}@media (pointer:coarse) and (max-width:340px) and (orientation:portrait){#wradio{top:calc(env(safe-area-inset-top) + 139px);left:calc(50% + 4px)}#minimap{width:64px!important;height:64px!important}}body.storyOn #wradio,body.storyOn #chat,body.storyOn #camB,body.storyOn #roamB,body.storyOn #minimap,body.storyOn #howto{visibility:hidden!important}#wradio button{border:2px solid #fff;border-radius:999px;padding:7px 11px;background:linear-gradient(#5fc8ff,#1d4fd8);color:#fff;font:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,30,90,.35)}#wradio button.off{background:linear-gradient(#9aa3b2,#5a6070)}#wradio span{color:#fff;text-shadow:0 1px 3px #000;align-self:center;max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}</style><button id="wrOn">📻 RADIO</button><button id="wrNx">⏭</button><button id="wrMore" type="button" aria-label="Show more radio controls" aria-expanded="false" style="display:none">⚙</button><button id="wrUp">📂 YOUR MUSIC</button><input id="wrV" type="range" min="0" max="1" step="0.01" value="0.27" title="Volumen de la radio" style="width:90px;accent-color:#5fc8ff"><span id="wrT"></span><input id="wrF" type="file" accept="audio/*" style="display:none">'; document.body.appendChild(bar);
    // The slider must reflect both the 27% default and a persisted player preference.
    bar.querySelector('#wrV').value = String(st.vol);
    const more=bar.querySelector('#wrMore');
    more.onclick=(e)=>{e.stopPropagation();const open=bar.classList.toggle('expanded');more.setAttribute('aria-expanded',String(open));more.setAttribute('aria-label',open?'Hide radio controls':'Show more radio controls');};
    const upd = () => { bar.querySelector('#wrOn').classList.toggle('off', !st.on); const c0 = cur(); bar.querySelector('#wrT').textContent = st.on ? (c0 ? '♪ ' + (c0.t || c0.name) : (st.list.length ? '' : 'no songs yet')) : ''; };
    bar.addEventListener('pointerdown', (e) => e.stopPropagation()); bar.querySelector('#wrOn').onclick = () => toggle(); bar.querySelector('#wrNx').onclick = () => { next(); hap(0.3); }; bar.querySelector('#wrUp').onclick = () => bar.querySelector('#wrF').click(); bar.querySelector('#wrF').onchange = (e) => loadFile(e.target.files[0]); bar.querySelector('#wrV').oninput = (e) => { st.vol = Math.min(1, Math.max(0, +e.target.value)); try { localStorage.setItem(radioVolumeKey, String(st.vol)); } catch (_) {} e.stopPropagation(); }; bar.querySelector('#wrV').addEventListener('keydown', (e) => e.stopPropagation());
    const api = { get cur() { return cur(); }, get on() { return st.on && !!el && !el.paused; }, get level() { return st.level; }, toggle, next, loadFile, pick: () => bar.querySelector('#wrF').click(), st,
      tick(dt, busy) { bar.style.display = (lidOpen > 0.08 || ROAMS.on) && !CINE.on ? 'flex' : 'none'; if (!started && st.on && audioOk() && cur() && ROAMS.on && window.ATM_OUT) { started = true; play(); } if (!el || !UA.ctx) return; const c = UA.ctx, L = c.listener, cp = cam.position; if (L.positionX) { L.positionX.value = cp.x; L.positionY.value = cp.y; L.positionZ.value = cp.z; const d = new THREE.Vector3(); cam.getWorldDirection(d); L.forwardX.value = d.x; L.forwardY.value = d.y; L.forwardZ.value = d.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
        st.idle = busy ? 0 : st.idle + dt; const quiet = busy || st.idle < 1.5; if (st.on && !el.paused) gIn.gain.setTargetAtTime(quiet ? 0 : st.vol * 1.1, c.currentTime, quiet ? 0.15 : 1.2); if (dryG) dryG.gain.setTargetAtTime(window.ATM_OUT ? 0.9 : 0.35, c.currentTime, 0.5); an.getByteTimeDomainData(buf); let s2 = 0; for (let i = 0; i < 256; i += 4) { const x = (buf[i] - 128) / 128; s2 += x * x; } st.level = Math.min(1, Math.sqrt(s2 / 64) * 3); } };
    window.__WRADIO = api; upd(); return api; })();
  // ===== NIMBO, el guía de la historia (pequeño, al lado del maletín; te acompaña al pasear) + MODO HISTORIA =====
  window.UEV = (n) => { try { STORY && STORY.ev(n); } catch (e) {} };
  // Nimbo must OVERFLY the house desk, never intersect or pass beneath the wood.
  // These limits match ROOM's desk: 26 x 12.5, centred at (0,-1.2), top DY=-0.005.
  // Padding covers Nimbo's body, arms, bob and low-FPS horizontal sweeps.
  const NIMBO_DESK = (() => {
    const pad = 3.5, x0 = -13 - pad, x1 = 13 + pad;
    const z0 = -1.2 - 6.25 - pad, z1 = -1.2 + 6.25 + pad;
    const over = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
    const minimumY = (nano) => -0.005 + (nano ? 2.1 : 5.4);
    // Full segment vs expanded desk, not just destination: fast catch-ups cannot tunnel.
    const crosses = (ax, az, bx, bz) => {
      if (over(ax, az) || over(bx, bz)) return true;
      let t0 = 0, t1 = 1;
      for (const [start, step, low, high] of [[ax, bx - ax, x0, x1], [az, bz - az, z0, z1]]) {
        if (Math.abs(step) < 1e-9) { if (start < low || start > high) return false; continue; }
        const a = (low - start) / step, b = (high - start) / step;
        t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
        if (t0 > t1) return false;
      }
      return t0 <= t1;
    };
    return { over, crosses, minimumY };
  })();
  const HOST = (() => { let w = null, r0 = null, halo = null, vis = false, talk = 0, k = 0;
    function build() { try { // NIMBO: dron compañero (sin piernas): cuerpo redondo rojo cromado, visor con ojos, antena y dos propulsores
      const D0 = new THREE.Group(); const red = new THREE.MeshPhysicalMaterial({ color: 0xe0242e, metalness: 0.6, roughness: 0.18, clearcoat: 1 }), chr = new THREE.MeshPhysicalMaterial({ color: 0xe8edf3, metalness: 1, roughness: 0.15 }), dark = new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: 0.1, clearcoat: 1 });
      const body = mesh(new THREE.SphereGeometry(0.42, 32, 20), red); body.scale.set(1, 0.92, 1); body.position.y = 0.5; D0.add(body); const ringB = mesh(new THREE.TorusGeometry(0.43, 0.035, 10, 48), chr); ringB.rotation.x = Math.PI / 2; ringB.position.y = 0.48; D0.add(ringB);
      const visor = mesh(new THREE.SphereGeometry(0.3, 28, 16, -0.9, 1.8, 0.9, 0.9), dark); visor.position.set(0, 0.52, 0.16); D0.add(visor); const eyeM = new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false }); const eyes = []; [-0.09, 0.09].forEach((x) => { const e = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), eyeM); e.position.set(x, 0.56, 0.455); D0.add(e); eyes.push(e); });
      const ant = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), chr); ant.position.set(0.12, 0.98, 0); D0.add(ant); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), eyeM); bulb.position.set(0.12, 1.1, 0); D0.add(bulb);
      const flM = new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); const flames = [];
      [-1, 1].forEach((s) => { const pod = mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.34, 14), chr); pod.position.set(s * 0.5, 0.4, -0.05); D0.add(pod); const fin = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.18), red); fin.position.set(s * 0.6, 0.5, -0.1); fin.rotation.z = s * 0.4; D0.add(fin); const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 12, 1, true), flM); f.rotation.x = Math.PI; f.position.set(s * 0.5, 0.05, -0.05); D0.add(f); flames.push(f); }); { const arms = []; const jm = new THREE.MeshPhysicalMaterial({ color: 0xdfe6f2, metalness: 1, roughness: 0.2 }); [-1, 1].forEach((s) => { const sh = new THREE.Group(); sh.position.set(s * 0.5, 0.52, 0.06); D0.add(sh); const up = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 10), jm); up.position.y = -0.17; sh.add(up); const el = new THREE.Group(); el.position.y = -0.34; sh.add(el); el.add(mesh(new THREE.SphereGeometry(0.055, 12, 8), red)); const fo = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 10), jm); fo.position.y = -0.15; el.add(fo); const hd = new THREE.Group(); hd.position.y = -0.31; el.add(hd); hd.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), red)); const fg = []; for (let f = 0; f < 3; f++) { const fp = new THREE.Group(); fp.rotation.y = f * TAU / 3; hd.add(fp); const fi = new THREE.Group(); fi.position.set(0.045, -0.02, 0); fp.add(fi); const fm = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.13, 6), jm); fm.position.y = -0.06; fi.add(fm); fg.push(fi); } sh.scale.setScalar(0.001); arms.push({ s, sh, el, hd, fg }); }); D0.userData.arms = arms; }
      let blink = 3, talkK = 0; r0 = { root: D0, update(T, dt, st) { const tt = performance.now() / 1000; D0.position.y = Math.sin(tt * 2.2) * 0.04; D0.rotation.z = Math.sin(tt * 1.3) * 0.06; flames.forEach((f, i) => { f.scale.set(1, 0.7 + Math.random() * 0.5 + (st && st.act === 'fly' ? 0.4 : 0), 1); }); blink -= dt; const bl = blink < 0.12 && blink > 0; if (blink < -0.05) blink = 2 + Math.random() * 4; talkK = st && st.act === 'talk' ? 0.5 + 0.5 * Math.sin(tt * 18) : 0; eyes.forEach((e) => e.scale.set(1, bl ? 0.15 : 1 + talkK * 0.3, 1)); eyeM.color.setHSL(0.53, 1, 0.6 + talkK * 0.2); } };
      w = new THREE.Group(); const w2 = new THREE.Group(); w.add(w2); w2.add(D0); w2.scale.setScalar(1 / 1.15); halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 40), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })); halo.rotation.x = H2; halo.position.y = 1.18; halo.visible = false; w.add(halo); w.position.set(3.8, 6.2, 1.1); w.scale.setScalar(0.01); S.scene.add(w); } catch (e) { console.warn('host', e); } }
    const hint = (FO) => { try { const L = window.__SECL || []; let best = null, bd = 1e9; L.forEach((s) => { let done = false; try { done = localStorage.getItem('unfire_sec_' + s[0]) === '1'; } catch (e) {} if (done) return; const dd = Math.hypot(s[1] - ROAMS.p.x, s[2] - ROAMS.p.z); if (dd < bd) { bd = dd; best = s; } }); if (best) { const ang = Math.atan2(best[1] - ROAMS.p.x, -(best[2] - ROAMS.p.z)), rel = Math.atan2(Math.sin(ang - (ROAMS.cy == null ? ROAMS.yaw : ROAMS.cy)), Math.cos(ang - (ROAMS.cy == null ? ROAMS.yaw : ROAMS.cy))); const dir = Math.abs(rel) < 0.5 ? 'straight ahead' : Math.abs(rel) > 2.6 ? 'behind you' : rel > 0 ? 'to your right' : 'to your left'; say('🤖 Nimbo: there is a secret in ' + best[3] + ', ' + dir + ', a ' + Math.round(bd) + ' m.'); FO.grab = 0.8; } else { const o = document.getElementById('stO'); say('🤖 Nimbo: ' + (o && o.textContent.trim() ? 'your next objective: ' + o.textContent.trim() : 'You have found all the secrets! Try a mission or online mode.')); } talk = 2.5; } catch (e) {} };
    const API = { show(v) { if (!w) build(); vis = v; }, talk() { talk = 2.5; },
      toggle(fromBtn) { if (!w) build(); const FO = w.userData.fo || (w.userData.fo = { on: false, t: 0 }); const far0 = Math.hypot(ROAMS.p.x - w.position.x, ROAMS.p.z - w.position.z); if (FO.on) { FO.on = false; FO.call = false; say('👋 Nimbo: Got it. I will stay here. Call me with 🤖 or tap me when you need help.'); } else { FO.on = true; FO.t = 0; FO.hT = 6; say(far0 > 30 ? '🤖 Nimbo: Flying over!' : '🤖 Nimbo: I am with you! I will point out secrets, help when you get stuck and light the way at night.'); try { localStorage.setItem('unfire_nimbo_met', '1'); } catch (e) {} } talk = 2.5; try { window.__GS && window.__GS.wings(true); } catch (e) {} if (window.__nimB) window.__nimB.textContent = FO.on ? '🤖 NIMBO: VETE' : '🤖 NIMBO: COME'; },
      hit(ray) { if (!w || !w.visible) return false; const h = ray.intersectObject(w, true)[0]; if (!h) return false; API.toggle(); return true; },
      util(dt, t, FO) { if (!w.userData.lamp) { const L0 = new THREE.PointLight(0x9fe8ff, 0, 70, 1.6); L0.position.set(0, 1.2, 0); w.add(L0); w.userData.lamp = L0; } const day = window.__SKYDAY ? window.__SKYDAY() : 1; w.userData.lamp.intensity += (((FO.on && window.ATM_OUT) ? (1 - day) * 2.2 : 0) - w.userData.lamp.intensity) * Math.min(1, dt * 2); if (!FO.on) return; FO.hT = (FO.hT || 0) - dt; if (FO.hT <= 0 && !ROAMS.fly && talk <= 0) { FO.hT = 45; hint(FO); } if ((ROAMS.stkN || 0) > 22 && !ROAMS.fly) { const fx = Math.sin(ROAMS.yaw), fz = -Math.cos(ROAMS.yaw); ROAMS.p.x -= fx * 4; ROAMS.p.z -= fz * 4; ROAMS.h = (ROAMS.h || 0) + 3; ROAMS.vy = 8; ROAMS.stkN = 0; FO.grab = 1.2; talk = 2; say('🤖 Nimbo: Hold on! I will get you out of there.'); } },  get visible() { return vis && !!w; }, get pos() { return w ? w.position : V(3.8, 0, 4.1); },
      tick(dt, t) { if (!w) return; k += ((vis ? 1 : 0) - k) * Math.min(1, dt * 3); w.visible = k > 0.02; if (!w.visible) return; talk = Math.max(0, talk - dt); const big = ROAMS.on ? (ROAMS.mini ? 0.3 : 2.4) : 1.1;
        const FO = w.userData.fo || (w.userData.fo = { on: false, t: 0, call: false });
        const independentFlight = window.UNFIRE_COMPANION_FLIGHT.step(w.userData.flight || (w.userData.flight = {}),
          { dt, index: 4, flying: !!(ROAMS.on && ROAMS.fly && FO.on),
            height: ROAMS.h || 0, nano: !!ROAMS.mini, maxLift: 16, follow: 0.23 });
        if (ROAMS.on) { FO.t += dt; API.util(dt, t, FO); }
        const inside = !window.ATM_OUT;
        const deskFloor = NIMBO_DESK.minimumY(!!ROAMS.mini);
        // Repair legacy saved/transition positions ABOVE the desk immediately;
        // never animate the drone *through* the surface from a bad old position.
        if (inside && NIMBO_DESK.over(w.position.x, w.position.z))
          w.position.y = Math.max(w.position.y, deskFloor);
        if (ROAMS.on && !FO.on) {
          const idleY = (window.ATM_OUT ? -9 : -8.9) + 7 + Math.sin(t * 1.4) * 0.5;
          const overDesk = inside && NIMBO_DESK.over(w.position.x, w.position.z);
          const targetY = overDesk ? Math.max(idleY, deskFloor + 0.7 + Math.sin(t * 1.4) * 0.25) : idleY;
          w.position.y += (targetY - w.position.y) * Math.min(1, dt * 2);
          if (overDesk) w.position.y = Math.max(w.position.y, deskFloor);
        } else if (ROAMS.on) {
          const fx = Math.sin(ROAMS.yaw), fz = -Math.cos(ROAMS.yaw);
          const near = talk > 0 && !ROAMS.moving;
          const dd = ROAMS.mini ? (near ? 0.9 : 0.25) : (near ? 9 : 1.5 + Math.sin(t * 0.4) * 2);
          const ds = ROAMS.mini ? (near ? 0.32 : 0.75) : (near ? 3.2 : 6.5 + Math.sin(t * 0.27) * 1.5);
          const bx = ROAMS.p.x, bz = ROAMS.p.z;
          const previousNimboX = w.position.x, previousNimboZ = w.position.z;
          const tx = bx + fx * dd - fz * ds, tz = bz + fz * dd + fx * ds;
          const far0 = Math.hypot(tx - w.position.x, tz - w.position.z);
          if (far0 > 400) {
            w.position.x = tx - fx * 60; w.position.z = tz - fz * 60;
          } else if (far0 > 25) {
            w.position.x += (tx - w.position.x) * Math.min(1, dt * 1.2);
            w.position.z += (tz - w.position.z) * Math.min(1, dt * 1.2);
          }
          w.position.x += (tx - w.position.x) * Math.min(1, dt * 1.8);
          w.position.z += (tz - w.position.z) * Math.min(1, dt * 1.55);
          const deskCrossing = inside && NIMBO_DESK.crosses(
            previousNimboX, previousNimboZ, w.position.x, w.position.z);
          // From the floor, rise first and only then pass horizontally ABOVE the desk.
          // No one-frame crossing under the surface, including extreme catch-up distance.
          if (deskCrossing && w.position.y < deskFloor) {
            w.position.x = previousNimboX; w.position.z = previousNimboZ;
            w.position.y = Math.min(deskFloor, w.position.y + Math.max(0, dt) * 14);
          }
          const baseY = (window.ATM_OUT ? -9 : -8.9) + (ROAMS.mini ? 2.5 : 8.5);
          const desiredY = baseY + independentFlight.height + Math.sin(t * 1.13 + 1.4) * 0.32;
          const overDesk = inside && (deskCrossing || NIMBO_DESK.over(w.position.x, w.position.z));
          const safeY = overDesk ? Math.max(desiredY, deskFloor + 0.5) : desiredY;
          w.position.y += (safeY - w.position.y) * Math.min(1, dt * 1.7);
          if (inside && NIMBO_DESK.over(w.position.x, w.position.z))
            w.position.y = Math.max(w.position.y, deskFloor);
          // Sweep Nimbo's entire frame path against the same solid world
        // boxes used by the player. A final push-out alone lets him tunnel
        // through desks/tables when catching up or after a long frame.
        const outside = !!window.ATM_OUT;
        const obstacles = outside
          ? (window.__OBSTO || window.__buildObstOut())
          : (window.__OBST || (window.__OBST = window.__buildObst()));
        const radius = ROAMS.mini ? 0.22 : 2.8;
        const footY = w.position.y - (ROAMS.mini ? 0.22 : 3.2);
        const nearby = COLLISION(obstacles, previousNimboX, previousNimboZ,
          Math.hypot(w.position.x - previousNimboX, w.position.z - previousNimboZ) + radius + 3);
        const solved = NANO_PHYSICS.move2D(
          { x: previousNimboX, z: previousNimboZ },
          { x: w.position.x - previousNimboX, z: w.position.z - previousNimboZ },
          nearby, { radius, height: ROAMS.mini ? 0.45 : 6.4 },
          { footY, prePadding: outside ? 0 : 1.1 });
        w.position.x = solved.x; w.position.z = solved.z;
          if (inside && NIMBO_DESK.over(w.position.x, w.position.z))
            w.position.y = Math.max(w.position.y, deskFloor);
        } else {
          // Return directly to the safe above-desk home, never interpolate through timber.
          w.position.set(3.8, 6.2 + Math.sin(t * 1.4) * 0.3, 1.1);
        }
        { const lx = w.userData.lx == null ? w.position.x : w.userData.lx, lz = w.userData.lz == null ? w.position.z : w.userData.lz; const mv = Math.hypot(w.position.x - lx, w.position.z - lz); w.userData.lx = w.position.x; w.userData.lz = w.position.z; w.userData.wd = (w.userData.wd || 0) + mv; w.userData.mv = mv / Math.max(dt, 1e-3); } w.scale.setScalar(Math.max(0.01, k * big)); { let ty; if (ROAMS.on && talk <= 0) { const cy0 = ROAMS.cy == null ? ROAMS.yaw : ROAMS.cy; ty = Math.atan2(Math.sin(cy0), -Math.cos(cy0)); } else ty = Math.atan2(cam.position.x - w.position.x, cam.position.z - w.position.z); let df = ty - w.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); w.rotation.y += df * Math.min(1, dt * 6); } halo.rotation.z += dt * 2; halo.material.color.setHSL((t * 0.08) % 1, 1, 0.6); halo.position.y = 1.18 + Math.sin(t * 2) * 0.04;
        { const AR = r0.root.userData.arms; if (AR) { const want = ROAMS.on && (FO.on || FO.call || talk > 0 || (FO.grab || 0) > 0) ? 1 : talk > 0 ? 1 : 0; FO.ext = (FO.ext || 0) + (want - (FO.ext || 0)) * Math.min(1, dt * 3); FO.grab = Math.max(0, (FO.grab || 0) - dt); const e = FO.ext; AR.forEach((A) => { A.sh.scale.setScalar(Math.max(0.001, e)); const wav = talk > 0 ? Math.sin(t * 7 + A.s) * 0.6 : 0, gr = (FO.grab || 0) > 0 ? 1 : 0; A.sh.rotation.x = -0.3 - gr * 1.1 + Math.sin(t * 1.3 + A.s) * 0.12 * e; A.sh.rotation.z = A.s * (0.35 + (talk > 0 && A.s > 0 ? 1.6 + wav : 0)); A.el.rotation.x = -0.5 - gr * 0.6 + Math.sin(t * 2.1 + A.s) * 0.15; A.hd.rotation.y += dt * (gr ? 6 : 1.2); A.fg.forEach((f) => { f.rotation.z = (gr ? 0.15 : 0.7 + Math.sin(t * 3 + A.s) * 0.2); }); }); } } r0.update(3.7, dt, { act: talk > 0 ? 'talk' : ROAMS.on && !ROAMS.mini ? 'fly' : w.userData.mv > big * 0.15 ? 'walk' : ['wave', 'look', 'dance'][Math.floor(t / 6) % 3], ph: w.userData.mv > big * 0.15 && !ROAMS.on ? STEPPH(w.userData.wd, big) : t, mood: talk > 0 ? 'happy' : 'star', beatPhase: t * 2 }); } }; window.__NIMBO = API; return API; })();
  // ===== MISIONES SECUNDARIAS: te las ofrecen los robots de fuera =====
  const SIDE = (() => { const L = [['Fly to the golden tip of the great Atlantis pyramid', 600, 0, 120], ['Reach the farthest temple in Atlantis', 900, 0, 0], ['Reach the top of the giant pink tree', 150, -120, 380], ['Find the desert obelisk', 80, -500, 0], ['Cross the Haiku Island torii gates to the pagoda', -690, -700, 0], ['Climb to the snowy summit on Haiku Island', -850, -860, 150], ['Ride a large wave in the open sea', 0, 650, 0], ['Glide over the water to the largest moai', 470, -560, 0], ['Touch the house dome from the sky', 0, 40, 40], ['Fly between the giant plugin towers', 2200, -1800, 400], ['Cross the forest by the sea', -640, 80, 0]]; let cur = (() => { try { const v = JSON.parse(localStorage.getItem('unfire_side_active') || 'null'); return v && typeof v.t === 'string' && Number.isFinite(v.x) && Number.isFinite(v.z) && Number.isFinite(v.y) ? v : null; } catch (e) { return null; } })(), idx = (() => { try { return +(localStorage.getItem('unfire_side') || 0); } catch (e) { return 0; } })();
    return { get cur() { return cur; }, offer(who) { if (cur) return null; const q = L[idx % L.length]; idx++; try { localStorage.setItem('unfire_side', String(idx)); } catch (e) {} cur = { t: q[0], x: q[1], z: q[2], y: q[3], who }; try { localStorage.setItem('unfire_side_active', JSON.stringify(cur)); } catch (e) {} say('🎯 Mission from ' + who + ': ' + q[0] + ' (follow the star on the map)'); return q[0]; },
      tick() { if (!cur || !ROAMS.on || ROAMS.freeRobotMode) return; const d = Math.hypot(ROAMS.p.x - cur.x, ROAMS.p.z - cur.z), hy = -9 + (ROAMS.h || 0); if (d < (cur.y > 150 ? 90 : 34) && hy >= cur.y - 30) { const t0 = cur.t; cur = null; try { localStorage.removeItem('unfire_side_active'); } catch (e) {} try { window.__REWARD('Mission complete: “' + t0 + '”'); } catch (e) { say('🏆 Mission complete!'); } } } }; })(); setInterval(() => { try { if (!SIDE.cur && ROAMS.on && window.ATM_OUT && !ROAMS.mini && !ROAMS.freeRobotMode) { SIDE.nT = (SIDE.nT || 0) + 1; if (SIDE.nT >= 5) { SIDE.nT = 0; SIDE.offer('NIMBO'); } } } catch (e) {} }, 5000); window.__SIDEM = SIDE;
  // ===== FUERA: grupos de artilugios charlando entre ellos; si te acercas te hablan a ti =====
  // robots que viven en el cielo: vuelan de un plugin gigante a otro, aterrizan encima, bailan y lo hacen transformarse
  const SKYBOTS = (() => { let B = null; const build = () => { B = []; for (let k = 0; k < (LOWDEV ? 2 : 4); k++) { try { const r0 = ROBOT.build(MUTANTS.list[(k * 5 + 2) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar(12 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; w.position.set(Math.cos(k * 1.6) * 400, 300 + k * 200, Math.sin(k * 1.6) * 400); w.visible = false; S.scene.add(w); B.push({ w, r0, st: 'fly', tg: null, t: 0, v: V(0, 0, 0) }); } catch (e) {} } };
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on; if (!B) { if (!out || ((ROAMS.h || 0) < 110 && Math.hypot(ROAMS.p.x, ROAMS.p.z) < 240)) return; build(); } B.forEach((b) => { b.w.visible = out; }); if (!out) return; const devs = window.__SKYDEV ? window.__SKYDEV().filter((o) => o.visible && o.scale.x > 8) : [];
      B.forEach((b, i) => { b.t -= dt; if (!b.tg || !b.tg.parent || !b.tg.visible || (b.st === 'land' && b.t <= 0)) { const free = devs.filter((o) => !B.some((x) => x !== b && x.tg === o)); b.tg = free.length ? free[Math.floor(Math.random() * free.length)] : null; b.st = 'fly'; } let act = 'fly';
        if (b.tg) { const s = b.tg.scale.x, top = V(b.tg.position.x, b.tg.position.y + s * 0.45, b.tg.position.z); if (b.st === 'fly') { const d = top.clone().sub(b.w.position), L = d.length(); b.v.lerp(d.multiplyScalar(Math.min(70, L * 0.8 + 6) / Math.max(L, 0.001)), Math.min(1, dt * 1.5)); b.w.position.addScaledVector(b.v, dt); b.w.rotation.y = Math.atan2(b.v.x, b.v.z); if (L < 4) { b.st = 'land'; b.t = 10 + Math.random() * 8; try { window.__SKYPOKE && window.__SKYPOKE(b.tg); } catch (e) {} } } else { b.w.position.lerp(top, Math.min(1, dt * 6)); b.w.rotation.y += dt * 0.6; act = 'dance'; } }
        b.r0.update(3.7, dt, { act, ph: t * 2 + i, mood: 'happy', beatPhase: t * 2 }); }); }, get list() { return B || []; } }; })();
  // otros robots surfeando las olas en mar abierto, con sus tablas, trucos y espuma (recorridos en bucle que no se cruzan)
  const SURFBOTS = (() => { let B = null; const build = () => { B = []; const CL = [0xff2fb0, 0x3d8bff, 0xffd21a, 0x2bd96b]; for (let k = 0; k < (LOWDEV ? 2 : 3); k++) { try { const r0 = ROBOT.build(MUTANTS.list[(k * 7 + 4) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); const s0 = 8 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001); w.scale.setScalar(s0); r0.root.position.y -= bb.min.y; r0.root.rotation.y = 1.25; const bd = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10), new THREE.MeshPhysicalMaterial({ color: CL[k], roughness: 0.25, clearcoat: 1 })); bd.scale.set(1.4 / s0, 0.18 / s0, 4.8 / s0); w.add(bd); w.visible = false; S.scene.add(w); B.push({ w, r0, r: 140 + k * 50, a: k * 2.1, sp: (k % 2 ? -1 : 1) * (26 + k * 4), jt: 4 + k * 3, tr: 0 }); } catch (e) {} } };
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on && cam.position.y < 700; if (!B) { if (!window.ATM_OUT || !ROAMS.on || Math.hypot(ROAMS.p.x, ROAMS.p.z) < 350) return; build(); } B.forEach((b) => (b.w.visible = out)); if (!out || !window.__WAVE) return; const W1 = window.__WAVE;
      B.forEach((b, i) => { b.a += b.sp / b.r * dt; const r = b.r + Math.sin(t * 0.21 + i) * 12, x = Math.cos(b.a) * r, z = 720 + Math.sin(b.a) * r; let y = -10.2 + W1(x, z, t) + 1.2; b.jt -= dt; if (b.jt <= 0 && !b.tr) b.tr = 0.001; let spin = 0; if (b.tr) { b.tr += dt; const u = b.tr / 1.1; y += Math.sin(Math.min(1, u) * Math.PI) * 14; spin = Math.min(1, u) * TAU; if (u >= 1) { b.tr = 0; b.jt = 6 + Math.random() * 6; try { window.__SPRAY(x, y, z, 50, 9, 12); } catch (e) {} } }
        const fx = -Math.sin(b.a) * Math.sign(b.sp), fz = Math.cos(b.a) * Math.sign(b.sp); b.w.position.set(x, y, z); b.w.rotation.set(-Math.atan((W1(x + fx * 3, z + fz * 3, t) - W1(x - fx * 3, z - fz * 3, t)) / 6) * 0.9, Math.atan2(fx, fz) + spin, Math.sin(t * 1.4 + i) * 0.12);
        if (Math.random() < 0.5) try { window.__SPRAY(x - fx * 3, y - 0.5, z - fz * 3, 2, 3, 6); } catch (e) {} b.r0.update(3.7, dt, { act: null, ph: t, mood: 'happy' }); }); }, get list() { return B || []; } }; })();
  // titanes: robots gigantescos que caminan por el paisaje infinito del horizonte, tan altos que tocan el espacio
  const TITANS = (() => { let B = null; const build = () => { B = []; for (let k = 0; k < (LOWDEV ? 2 : 3); k++) { try { const r0 = ROBOT.build(MUTANTS.list[(k * 3 + 1) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar((1500 + k * 300) / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; w.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } }); w.visible = false; S.scene.add(w); B.push({ w, r0, a: k * 2.1, R: 6300 + k * 450, sp: (k % 2 ? -1 : 1) * 0.004, wd: 0 }); } catch (e) {} } };
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on; if (!B) { if (!out || ((ROAMS.h || 0) < 650 && Math.hypot(ROAMS.p.x, ROAMS.p.z) < 1200)) return; build(); } B.forEach((b) => (b.w.visible = out)); if (!out) return; const cx = cam.position.x, cz = cam.position.z;
      B.forEach((b, i) => { b.a += b.sp * dt; const x = cx * 0.3 + Math.cos(b.a) * b.R, z = cz * 0.3 + Math.sin(b.a) * b.R; b.w.position.set(x, -10, z); b.w.rotation.y = Math.atan2(-Math.sin(b.a) * Math.sign(b.sp), Math.cos(b.a) * Math.sign(b.sp)); b.wd += Math.abs(b.sp) * b.R * dt; if ((i + Math.floor(t * 20)) % 3 === 0) b.r0.update(3.7, dt * 3, { act: 'walk', ph: STEPPH(b.wd / b.w.scale.x, 3.7, false), mood: 'happy' }); }); }, get list() { return B || []; } }; })();
  window.__STORYNAME = () => (STORY && STORY.save && STORY.save.name) || '';
  // MUNDO DE FONDO (solo paisaje, inalcanzable): titanes de varias alturas, megatitanes que tocan el espacio, dragones procedurales volando
  // y pantallas-collage con vídeos reales; todo se oscurece de noche y se aclara de día con la luz del cielo
  const FAR = (() => { let G = null, DR = [], SCR = [], MATS = []; const self = {};
    const dim = (o) => o.traverse((m) => { if (m.isMesh && m.material && !m.material.userData.c0) { m.material = m.material.clone(); m.material.userData.c0 = m.material.color ? m.material.color.clone() : null; MATS.push(m.material); m.castShadow = m.receiveShadow = false; m.frustumCulled = false; } });
    const build = () => { G = new THREE.Group(); S.scene.add(G);
      // megatitanes: tan altos que la cabeza entra en el espacio
      for (let k = 0; k < (LOWDEV ? 1 : 2); k++) { try { const r0 = ROBOT.build(MUTANTS.list[(k * 5 + 6) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar(5200 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; dim(w); G.add(w); DR.push({ type: 'mega', w, r0, a: 1 + k * 3.1, R: 8300, sp: (k ? -1 : 1) * 0.0025, wd: 0 }); } catch (e) {} }
      // dragones procedurales: cuerpo de segmentos que ondula, alas que baten
      const DC = [0x5fe0ff, 0xff4fd8, 0xffd21a, 0x2bd96b, 0xff7a1f, 0x9b6bff];
      for (let k = 0; k < (LOWDEV ? 3 : 6); k++) { const g = new THREE.Group(); const kk = k; const M = new THREE.MeshPhysicalMaterial({ color: DC[k], roughness: 0.12, metalness: 1, clearcoat: 1, emissive: DC[k], emissiveIntensity: 0.06 }); const BIG = k >= (LOWDEV ? 2 : 4) ? 3.2 : 1; const segs = []; for (let i = 0; i < 16; i++) { const s = ((1 - i / 18) * 34 + 8) * BIG; const m = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10), M); g.add(m); segs.push(m); } const wingG = new THREE.ConeGeometry(70 * BIG, 180 * BIG, 3); const wl = new THREE.Mesh(wingG, M), wr = new THREE.Mesh(wingG, M); wl.rotation.z = H2; wr.rotation.z = -H2; g.add(wl, wr); dim(g); G.add(g); DR.push({ type: 'dragon', g, segs, wl, wr, R: (BIG > 1 ? 6000 : 4800 + k * 450), y: (BIG > 1 ? 4600 + (k - 4) * 450 : 2300 + k * 260), a: k * 1.05, sp: (k % 2 ? 1 : -1) * (0.012 + k * 0.002), ph: k }); }
      // árboles infinitos: troncos que suben más allá de lo que alcanza la vista, con copas-burbuja Frutiger Aero
      const barkT = (() => { const c = Y2K.cnv(256, 1024), q = c.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, 256, 1024); for (let i = 0; i < 90; i++) { q.strokeStyle = `rgba(60,40,30,${0.15 + Math.random() * 0.35})`; q.lineWidth = 2 + Math.random() * 7; q.beginPath(); let x = Math.random() * 256; q.moveTo(x, 0); for (let y = 0; y <= 1024; y += 64) { x += (Math.random() - 0.5) * 22; q.lineTo(x, y); } q.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 30); return t; })();
      [[0.4, 11200], [2.0, 11800], [3.5, 11000], [5.1, 11500]].forEach(([a, R0], k) => { const tr = new THREE.Group(); tr.position.set(Math.cos(a) * R0, -10, Math.sin(a) * R0); const bark = new THREE.MeshPhysicalMaterial({ map: barkT, color: [0x9a7050, 0x7fb06a, 0x7a9ad0, 0xb08ac0][k], roughness: 0.45, metalness: 0.15, clearcoat: 0.6 }); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(420, 900, 90000, 32, 1, true), bark); trunk.position.y = 45000; for (let j = 0; j < 14; j++) { const by = 1600 + j * 2600, ba = j * 2.3 + k; const br = new THREE.Mesh(new THREE.CylinderGeometry(60, 180, 2600, 12), bark); br.position.set(Math.cos(ba) * 900, by, Math.sin(ba) * 900); br.rotation.set(Math.sin(ba) * 1.0, 0, -Math.cos(ba) * 1.0); tr.add(br); } trunk.rotation.z = Math.sin(k * 2.1) * 0.03; tr.add(trunk); const lm = new THREE.MeshPhysicalMaterial({ color: [0x6bff9b, 0x5fe0ff, 0xb6ff3b, 0xff9be0][k], roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.85, clearcoat: 1 }); for (let j = 0; j < 16; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(900 - j * 25, 24, 16), lm); const aa = j * 2.4 + k; b.position.set(Math.cos(aa) * 1700, 2400 + j * 2500, Math.sin(aa) * 1700); tr.add(b); } dim(tr); G.add(tr); DR.push({ type: 'tree', g: tr }); });
      // hélices de ADN gigantes girando con la música
      for (let k = 0; k < (LOWDEV ? 1 : 3); k++) { const g = new THREE.Group(); const a = 1.2 + k * 2.1, R0 = 6500 + k * 150; g.position.set(Math.cos(a) * R0, 300, Math.sin(a) * R0); const Ma = new THREE.MeshPhysicalMaterial({ color: 0x7fe9ff, metalness: 1, roughness: 0.06, clearcoat: 1, emissive: 0x2a7bff, emissiveIntensity: 0.55 }), Mb = new THREE.MeshPhysicalMaterial({ color: 0xff7ae0, metalness: 1, roughness: 0.06, clearcoat: 1, emissive: 0xff2fb0, emissiveIntensity: 0.55 }), Mr = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.2 }); const sg = new THREE.SphereGeometry(55, 14, 10), rg = new THREE.CylinderGeometry(12, 12, 1, 8); for (let i = 0; i < 34; i++) { const y = i * 110, an = i * 0.45; const p1 = V(Math.cos(an) * 260, y, Math.sin(an) * 260), p2 = V(-Math.cos(an) * 260, y, -Math.sin(an) * 260); const s1 = new THREE.Mesh(sg, Ma); s1.position.copy(p1); const s2 = new THREE.Mesh(sg, Mb); s2.position.copy(p2); const rung = new THREE.Mesh(rg, Mr); rung.position.set(0, y, 0); rung.scale.y = 520; rung.rotation.set(0, -an, H2); g.add(s1, s2, rung); } dim(g); G.add(g); DR.push({ type: 'dna', g, sp: (k % 2 ? 1 : -1) * 0.12 }); }
      // lunas enormes, planetas raros con anillos y ovnis lejanos
      { const pt = (h1, h2, band) => { const c = Y2K.cnv(512, 256), q = c.getContext('2d'); const gr = q.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, h1); gr.addColorStop(1, h2); q.fillStyle = gr; q.fillRect(0, 0, 512, 256); for (let i = 0; i < (band ? 14 : 160); i++) { q.fillStyle = band ? `rgba(255,255,255,${0.05 + Math.random() * 0.15})` : `rgba(0,0,0,${Math.random() * 0.18})`; if (band) q.fillRect(0, Math.random() * 256, 512, 4 + Math.random() * 16); else { q.beginPath(); q.arc(Math.random() * 512, Math.random() * 256, 2 + Math.random() * 18, 0, TAU); q.fill(); } } const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
        [[0.9, 26000, 9000, 2600, '#f1e8d6', '#b9a78a', false, false], [2.6, 24000, 7000, 1500, '#ff9be0', '#7a3cff', true, true], [4.1, 27000, 12000, 2000, '#7fe9ff', '#1d4fd8', true, false], [5.5, 23000, 6000, 1100, '#ffd27a', '#ff6a1f', true, false], [3.4, 28000, 15000, 3200, '#d8e8ff', '#8090a8', false, false], [1.8, 30000, 10500, 5200, '#f3d9a4', '#c49a5a', true, true], [6.0, 25000, 13500, 1300, '#b6ff3b', '#1f8a5a', true, false], [3.0, 22000, 8800, 900, '#ff6b81', '#7a1030', false, false], [0.2, 29000, 17000, 2400, '#c9b6ff', '#4a2a9a', true, true]].forEach(([a, R0, y, r, h1, h2, band, ring], k) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({ map: pt(h1, h2, band), roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.06 })); m.position.set(Math.cos(a) * R0, y, Math.sin(a) * R0); m.rotation.z = 0.3 + k * 0.4; if (ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.2, 96), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); rg.rotation.x = H2 - 0.35; m.add(rg); } dim(m); G.add(m); DR.push({ type: 'planet', g: m }); }); }
      { const UM = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ef, metalness: 1, roughness: 0.15, clearcoat: 1 }), GL = new THREE.MeshBasicMaterial({ color: 0x7fffd4, transparent: true, opacity: 0.6 }); for (let k = 0; k < (LOWDEV ? 2 : 5); k++) { const u = new THREE.Group(); const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12), UM); disc.scale.set(110, 22, 110); u.add(disc); const dome = new THREE.Mesh(new THREE.SphereGeometry(45, 24, 12, 0, TAU, 0, H2), GL); dome.position.y = 14; u.add(dome); const beam = new THREE.Mesh(new THREE.ConeGeometry(90, 600, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9effe0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = -310; u.add(beam); dim(u); G.add(u); DR.push({ type: 'ufo', g: u, a: k * 1.25, R: 5100 + k * 120, y: 3700 + k * 90, sp: (k % 2 ? 1 : -1) * 0.02 }); } }
      // pompas gigantes de cristal flotando (estética Frutiger Aero)
      { const bm = new THREE.MeshPhysicalMaterial({ color: 0xcff6ff, roughness: 0, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.35, clearcoat: 1, iridescence: 1, depthWrite: false }); const NB = LOWDEV ? 10 : 24, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), bm, NB); bub.frustumCulled = false; const BB = []; for (let i = 0; i < NB; i++) BB.push({ a: Math.random() * TAU, R: 5200 + Math.random() * 2400, y: 200 + Math.random() * 3200, s: 120 + Math.random() * 380, v: 8 + Math.random() * 14 }); G.add(bub); DR.push({ type: 'bub', bub, BB }); }
      // segundo anillo del mundo de sueño, mucho más lejos (cuando llegues a los titanes, aún hay más): megatitanes enormes, dragones colosales y árboles infinitos
      for (let k = 0; k < (LOWDEV ? 1 : 3); k++) { try { const r0 = ROBOT.build(MUTANTS.list[(k * 7 + 9) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar((9000 + k * 1500) / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; dim(w); G.add(w); DR.push({ type: 'mega', w, r0, a: 0.6 + k * 2.1, R: 21000 + k * 1500, sp: (k % 2 ? 1 : -1) * 0.0012, wd: 0 }); } catch (e) {} }
      { const DC2 = [0xc0c8d8, 0xffd27a, 0x7fe9ff]; for (let k = 0; k < (LOWDEV ? 1 : 3); k++) { const g = new THREE.Group(); const M = new THREE.MeshPhysicalMaterial({ color: DC2[k], roughness: 0.1, metalness: 1, clearcoat: 1 }); const segs = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(((1 - i / 18) * 34 + 8) * 9, 14, 10), M); g.add(m); segs.push(m); } const wingG = new THREE.ConeGeometry(630, 1620, 3); const wl = new THREE.Mesh(wingG, M), wr = new THREE.Mesh(wingG, M); g.add(wl, wr); dim(g); G.add(g); DR.push({ type: 'dragon', g, segs, wl, wr, R: 17500 + k * 1800, y: 9000 + k * 1600, a: k * 2.2, sp: (k % 2 ? 1 : -1) * 0.004, ph: k + 7 }); } }
      [[1.1, 30000, 0x9be7ff], [2.9, 31000, 0xffb6e6], [4.6, 29500, 0xc6ff9b]].forEach(([a, R0, cl], k) => { const tr = new THREE.Group(); tr.position.set(Math.cos(a) * R0, -10, Math.sin(a) * R0); const bk = new THREE.MeshPhysicalMaterial({ map: barkT, color: cl, roughness: 0.35, metalness: 0.3, clearcoat: 1 }); const tk = new THREE.Mesh(new THREE.CylinderGeometry(1100, 2200, 120000, 24, 1, true), bk); tk.position.y = 60000; tr.add(tk); const lm2 = new THREE.MeshPhysicalMaterial({ color: cl, roughness: 0.05, transparent: true, opacity: 0.8, clearcoat: 1 }); for (let j = 0; j < 10; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(2600, 20, 14), lm2); const aa = j * 2.4; b.position.set(Math.cos(aa) * 4200, 5000 + j * 6000, Math.sin(aa) * 4200); tr.add(b); } dim(tr); G.add(tr); DR.push({ type: 'tree', g: tr }); });
      // pantallas-collage con vídeos reales flotando muy lejos
      const MED2 = IMG.replace(/img\/?$/, 'media/'); ['v_jelly.mp4', 'v_reef.mp4', 'v_steens.mp4', 'v_waves.mp4'].slice(0, LOWDEV ? 2 : 4).forEach((f, k) => { const v = document.createElement('video'); v.src = MED2 + f; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; const tx = new THREE.VideoTexture(v); tx.encoding = THREE.sRGBEncoding; const al = (() => { const c = Y2K.cnv(256, 144), g = c.getContext('2d'), r = g.createRadialGradient(128, 72, 20, 128, 72, 130); r.addColorStop(0, '#fff'); r.addColorStop(0.6, '#ddd'); r.addColorStop(1, '#000'); g.save(); g.scale(1, 144 / 256); g.fillStyle = r; g.fillRect(0, 0, 256, 256); g.restore(); return new THREE.CanvasTexture(c); })(); const m = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1012), new THREE.MeshBasicMaterial({ map: tx, alphaMap: al, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })); const a = k * TAU / 4 + 0.4; m.position.set(Math.cos(a) * 9800, 1800 + k * 800, Math.sin(a) * 9800); m.lookAt(0, m.position.y * 0.6, 0); m.frustumCulled = false; G.add(m); SCR.push({ m, v }); }); };
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on; if (!G) {
        const h = Math.max(0, ROAMS.h || 0), range = Math.hypot(ROAMS.p.x, ROAMS.p.z);
        // Original distant landscape: lazy-build once players can meaningfully see it.
        const discoverSpace = LOWDEV ? (h >= 500 || range >= 900) : (h >= 180 || range >= 350);
        if (!out || !discoverSpace) return;
        build();
      } G.visible = out; if (out && window.__LOWFPS) { self.sk = ((self.sk || 0) + 1) % 3; if (self.sk) return; dt *= 3; } SCR.forEach((s) => { if (out) { if (s.v.paused) s.v.play().catch(() => {}); } else if (!s.v.paused) s.v.pause(); }); if (!out) return;
      const day = window.__SKYDAY ? window.__SKYDAY() : 1, k = 0.12 + 0.88 * day; MATS.forEach((m) => { if (m.userData.c0) m.color.copy(m.userData.c0).multiplyScalar(k); if (m.emissive) m.emissiveIntensity = 0.15 + (1 - day) * 0.5; }); SCR.forEach((s) => (s.m.material.opacity = 0.2 + 0.4 * day));
      const BD = window.__BANDS || { b: 0, d: 0, s: 0 }; const O3b = FAR.O3 || (FAR.O3 = new THREE.Object3D());
      DR.forEach((d, i) => { if (d.type === 'planet') { d.g.rotation.y += dt * 0.01; return; } if (d.type === 'ufo') { d.a += d.sp * dt; d.g.position.set(Math.cos(d.a) * d.R, d.y + Math.sin(t * 0.7 + i) * 60, Math.sin(d.a) * d.R); d.g.rotation.y += dt * 1.5; d.g.rotation.z = Math.sin(t * 0.9 + i) * 0.1; return; } if (d.type === 'tree') { d.g.rotation.y += dt * 0.004; d.g.scale.setScalar(1 + BD.b * 0.02); return; } if (d.type === 'dna') { d.g.rotation.y += dt * d.sp * (1 + BD.s * 3); d.g.scale.setScalar(1 + BD.d * 0.12); return; } if (d.type === 'bub') { d.BB.forEach((q, j) => { q.y += q.v * dt; if (q.y > 3600) q.y = 150; q.a += dt * 0.004; O3b.position.set(Math.cos(q.a) * q.R, q.y, Math.sin(q.a) * q.R); O3b.scale.setScalar(q.s * (1 + BD.b * 0.15)); O3b.updateMatrix(); d.bub.setMatrixAt(j, O3b.matrix); }); d.bub.instanceMatrix.needsUpdate = true; return; } if (d.type === 'mega') { d.a += d.sp * dt; d.w.position.set(Math.cos(d.a) * d.R, -10, Math.sin(d.a) * d.R); d.w.rotation.y = Math.atan2(-Math.sin(d.a) * Math.sign(d.sp), Math.cos(d.a) * Math.sign(d.sp)); d.wd += Math.abs(d.sp) * d.R * dt; if ((Math.floor(t * 15) + i) % 4 === 0) d.r0.update(3.7, dt * 4, { act: 'walk', ph: STEPPH(d.wd / d.w.scale.x, 3.7, false), mood: 'happy' }); return; }
        d.a += d.sp * dt; d.segs.forEach((s, j) => { const aa = d.a - Math.sign(d.sp) * j * 0.012; s.position.set(Math.cos(aa) * d.R, d.y + Math.sin(t * 1.3 + j * 0.45 + d.ph) * 60, Math.sin(aa) * d.R); }); const h0 = d.segs[2].position; d.wl.position.set(h0.x, h0.y + 20, h0.z); d.wr.position.copy(d.wl.position); const fl = Math.sin(t * 2.6 + d.ph) * 0.7; const yaw = -d.a; d.wl.rotation.set(fl, yaw, H2); d.wr.rotation.set(-fl, yaw, -H2); }); } }; })();
  // ===== MODO ONLINE: salas con código o enlace (P2P con PeerJS, sin servidor propio), personaje con color y tipo de robot elegidos =====
  const ONLINE = (() => { const COLS = ['#3d8bff', '#ff2fb0', '#2bd96b', '#ffd21a', '#ff7a1f', '#9b6bff', '#ffffff', '#222222']; const ALLT = [4, 1, 7, 10, 13, 16, 2, 5, 8, 11, 14, 17, 3, 6, 9, 12, 15, 18, 0, 19].filter((i) => i < MUTANTS.list.length); const PERK = [['equilibrado', 1, 1], ['⚡ corre más', 1.25, 1], ['🪽 vuela más rápido', 1, 1.5], ['🏄 surfista', 1.1, 1.1], ['🚀 turbo total', 1.35, 1.35], ['🌀 ágil', 1.15, 1.25]]; const unl = () => { let u = 0; try { u = +localStorage.getItem('unfire_unlock') || 0; } catch (e) {} return Math.min(ALLT.length, 2 + u); }; let TYPES = ALLT;
    let cfg = { name: '', col: '#3d8bff', type: 4, num: 27, camo: 'plain', decal: 'none', image: '' }; try { Object.assign(cfg, JSON.parse(localStorage.getItem('unfire_onl') || '{}')); } catch (e) {}
    const ROBOT_STYLE = window.UnfireRobotCustom;
    if (ROBOT_STYLE) Object.assign(cfg, ROBOT_STYLE.normalize(cfg));
    let peer = null, conns = [], code = null, isHost = false, myId = null, sendT = 0; const R = Object.create(null);
    // juego online «CAZA DE NOTAS»: 30 notas musicales brillantes repartidas por la isla (las mismas para todos); quien más coja, gana la ronda
    const NOTES = { list: [], round: 0, sc: 0, seed: 0, g: null, build(seed) { this.clear(); this.seed = seed; let s0 = seed * 9301 + 49297; const rr = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647); const tx = (() => { const c = Y2K.cnv(128, 128), q = c.getContext('2d'); q.fillStyle = '#fff'; q.font = '900 100px Arial'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.shadowColor = '#5fe0ff'; q.shadowBlur = 18; q.fillText('♪', 64, 70); return new THREE.CanvasTexture(c); })(); this.g = new THREE.Group(); S.scene.add(this.g); for (let i = 0; i < 30; i++) { const a = rr() * TAU, r = 120 + rr() * 520, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 90 && z > -25 && z < 105) { i--; continue; } const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: new THREE.Color().setHSL(rr(), 0.9, 0.65), transparent: true, depthWrite: false })); sp.scale.set(7, 7, 1); sp.position.set(x, -2 + rr() * 30, z); this.g.add(sp); this.list.push({ sp, on: true }); } },
      clear() { if (this.g) S.scene.remove(this.g); this.g = null; this.list = []; },
      take(i, mine) { const n = this.list[i]; if (!n || !n.on) return; n.on = false; n.sp.visible = false; if (mine) { this.sc++; hap(0.3); try { if (window.__SPRAY) window.__SPRAY(n.sp.position.x, n.sp.position.y, n.sp.position.z, 30, 6, 8); } catch (e) {} } if (this.list.every((q) => !q.on)) { this.round++; say('🏁 Note round over! Another round begins'); setTimeout(() => this.build(this.seed + 1), 2500); } } };

    const ui = document.createElement('div'); ui.id = 'onl'; ui.innerHTML = '<style>#onl{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(0,10,30,.55);font:600 13px Arial;color:#0a1a3a}#onl.on{display:flex}#onl .b{background:linear-gradient(180deg,#eef6ff,#bcd9ff);border:3px solid #fff;border-radius:22px;padding:18px;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 20px 50px #000a}#onl h3{margin:0 0 10px;font:900 18px Orbitron,Arial;color:#1d4fd8}#onl input{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:12px;border:2px solid #9fd0ff;font:700 14px Arial;margin:4px 0 10px}#onl .sw{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}#onl .sw button{width:34px;height:34px;border-radius:50%;border:3px solid #fff;cursor:pointer;box-shadow:0 2px 6px #0004}#onl .sw button.on{outline:3px solid #1d4fd8}#onl .ty button{width:auto;height:auto;border-radius:12px;padding:7px 10px;background:#fff;color:#0a1a3a;font:700 11px Arial}#onl .ty button.on{background:#1d4fd8;color:#fff}#onl.workshop .b{width:min(790px,calc(100vw - 22px));background:linear-gradient(170deg,#152744,#08142d);color:#ecf4ff;padding:clamp(12px,3vw,22px)}#onl.workshop h3{color:#86ceff}#onl.workshop .ty{display:grid;grid-template-columns:repeat(auto-fill,minmax(107px,1fr));gap:10px;align-items:stretch}#onl.workshop .ty .robotCard{min-width:0;min-height:140px;width:100%;height:auto;display:flex;align-items:center;flex-direction:column;gap:4px;padding:7px 5px;border-radius:14px;border:1px solid #5b90c077;background:linear-gradient(145deg,#172e4e,#0b172c);color:#fff;cursor:pointer;touch-action:manipulation;box-shadow:0 5px 15px #0005}#onl.workshop .ty .robotCard.on{border-color:#55e2ff;background:linear-gradient(145deg,#225a84,#103759);outline:2px solid #52d4ff}#onl.workshop .ty .robotCard:disabled{opacity:1;cursor:default;border-style:dashed;background:linear-gradient(145deg,#151b30,#08101f)}#onl.workshop .robotPortrait{width:92px;height:92px;max-width:100%;object-fit:contain;border-radius:11px;background:radial-gradient(ellipse at 50% 38%,#245782,#080f24 78%);display:grid;place-items:center;overflow:hidden;color:#91b2d4}#onl.workshop .robotPortrait img{height:100%;width:100%;object-fit:contain}#onl.workshop .robotUnknown{font:900 56px Arial;text-shadow:0 3px 1px #000,0 0 16px #5198c7}#onl.workshop .robotName{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 10px Arial}#onl.workshop .robotPerk{display:block;font:600 9px Arial;color:#91d5fb}#onl.workshop #onT{max-height:min(47vh,460px);overflow:auto;padding:4px}#onl.workshop .sw:not(.ty) button{border-color:#cfebff}#onl.workshop #onMsg{color:#a8eaff}#onl .act{display:flex;gap:8px;margin-top:6px}#onl .act button,#onl .act input{flex:1}#onl .go{border:0;border-radius:999px;padding:10px 14px;font:800 13px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#5fb0ff,#1d4fd8);cursor:pointer}#onl .x{background:#999}#onl p{min-height:16px;margin:8px 0 0;color:#c0302a}#onlHud{position:fixed;top:112px;left:50%;transform:translateX(-50%);z-index:61;display:none;gap:8px;align-items:center;padding:7px 10px;border-radius:999px;background:rgba(8,14,40,.85);border:2px solid #9fd0ff;color:#fff;font:700 12px Orbitron,Arial;white-space:nowrap}#onlHud button{border:0;border-radius:999px;padding:6px 10px;font:800 11px Arial;cursor:pointer;color:#fff;background:#1d4fd8}#onlHud .q{background:#c0302a}#onlMic[aria-pressed="true"]{background:#18824f!important}#onlHud{max-width:calc(100vw - 20px);flex-wrap:wrap;justify-content:center}#onlT{max-width:min(380px,80vw);overflow:hidden;text-overflow:ellipsis}@media(max-width:700px){#onlHud{top:74px;font-size:10px}#onlHud button{font-size:11px}}body.recOn #onlHud,body.storyOn #onlHud{visibility:hidden}</style><div class="b"><h3>🌐 MODO ONLINE</h3><div class="onlIdentity">Your name<input id="onN" maxlength="14" placeholder="Escribe tu nombre">Your number<input id="onNum" type="number" min="0" max="99" placeholder="27"></div><div>Your robot color</div><div class="sw" id="onC"></div><div>Transforming robot type</div><div class="sw ty" id="onT"></div><div class="act"><button class="go" id="onNew">✨ CREATE ROOM</button></div><div class="act"><input id="onCode" maxlength="5" placeholder="CÓDIGO"><button class="go" id="onJoin">➜ UNIRME</button></div><div class="act"><button class="go x" id="onX">CLOSE</button></div><p id="onMsg"></p></div>';
    document.body.appendChild(ui); ui.addEventListener('pointerdown', (e) => e.stopPropagation()); ui.addEventListener('keydown', (e) => e.stopPropagation(), true);
    if (ROBOT_STYLE) ROBOT_STYLE.inject(document);
    // Workshop does not obscure the player's 3D robot. Desktop uses a side dock;
    // phones use a compact bottom sheet that leaves the avatar visible above it.
    {const st=document.createElement('style');st.textContent=`
      #onl.workshop{background:transparent;justify-content:flex-start;align-items:center;pointer-events:none}
      #onl.workshop .b{pointer-events:auto;position:relative;margin-left:max(10px,env(safe-area-inset-left));width:min(414px,calc(40vw - 20px));min-width:244px;height:min(86dvh,820px);max-height:calc(100dvh - 30px);box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;box-shadow:0 12px 40px #000a}
      #onl.workshop .onlIdentity{display:none}
      #onl.workshop #onT{max-height:min(53dvh,490px)}
      #onl.workshop .ty{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      #onl.workshop .ty .robotCard{min-height:119px;padding:5px 3px}
      #onl.workshop .robotPortrait{width:75px;height:75px}
      #onl.workshop #onMsg{font-size:11px;min-height:12px}
      #onl.workshop .act{margin-top:3px}
      @media (max-width:800px) and (orientation:portrait){
        #onl.workshop{align-items:flex-end;justify-content:center}
        #onl.workshop .b{margin:0 0 max(8px,env(safe-area-inset-bottom));width:min(96vw,520px);min-width:0;height:min(37dvh,350px);max-height:37dvh;border-radius:18px;padding:10px 12px}
        #onl.workshop h3{font-size:13px;margin-bottom:5px}
        #onl.workshop .ty{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        #onl.workshop #onT{max-height:20dvh}
        #onl.workshop .ty .robotCard{min-height:100px}
        #onl.workshop .robotPortrait{width:min(61px,15vw);height:min(61px,15vw)}
        #onl.workshop .robotUnknown{font-size:38px}
      }
      @media (max-width:800px) and (orientation:landscape){
        #onl.workshop .b{width:min(300px,41vw);min-width:190px;height:90dvh;padding:10px}
        #onl.workshop .ty{grid-template-columns:repeat(2,minmax(0,1fr))}
        #onl.workshop #onT{max-height:43dvh}
      }`;
      ui.appendChild(st);}

    const hud = document.createElement('div'); hud.id = 'onlHud'; hud.innerHTML = '<span id="onlT"></span><button id="onlInv">📨 INVITE</button><button id="onlMic" type="button" aria-pressed="false" aria-label="Enable voice chat microphone">🎤 VOICE ON</button><button id="onlMute" type="button" aria-pressed="false" style="display:none">🎙️ MY MIC</button><button id="onlVM" type="button" title="Who you are speaking with">👥 ROOM</button><button id="onlPl" type="button" title="Players · mute">🔊 PLAYERS</button><div id="onlPlist" style="display:none;position:absolute;right:0;top:calc(100% + 6px);min-width:220px;max-height:50vh;overflow:auto;background:rgba(6,12,34,.95);border:2px solid #5fe0ff;border-radius:14px;padding:8px;font:700 12px Arial;color:#fff;z-index:95"></div><button class="q" id="onlQ">✕</button>'; document.body.appendChild(hud); hud.addEventListener('pointerdown', (e) => e.stopPropagation());
    const $o = (id) => document.getElementById(id), msg = (t) => { $o('onMsg').textContent = window.T ? window.T(t) : t; };
    // Portraits are captured from actual 3D robot models, one per idle frame.
    // Reuse the game's WebGL renderer/one tiny render target; no additional WebGL context.
    const portraitCache=new Map();let portraitQueue=[],portraitBusy=false;
    const previewScene=new THREE.Scene(),previewCam=new THREE.PerspectiveCamera(34,1,0.1,70);
    previewScene.background=new THREE.Color(0x0d1a35);
    previewScene.add(new THREE.HemisphereLight(0xe9f4ff,0x2e4366,2));
    const keyLight=new THREE.DirectionalLight(0xffffff,1.7);keyLight.position.set(3,7,6);previewScene.add(keyLight);
    previewCam.position.set(0,2.8,4.8);previewCam.lookAt(0,1.85,0);
    const portraitTarget=new THREE.WebGLRenderTarget(128,128,{depthBuffer:true,stencilBuffer:false});
    const portraitPixels=new Uint8Array(128*128*4);
    const portraitCanvas=document.createElement('canvas');portraitCanvas.width=portraitCanvas.height=128;
    const portraitCtx=portraitCanvas.getContext('2d',{willReadFrequently:true});
    const previewWrap=new THREE.Group();previewScene.add(previewWrap);
    const safeName=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function renderRobotPortrait(i){
      let r0=null;const prevTarget=S.renderer.getRenderTarget();
      const previousViewport=new THREE.Vector4(),previousScissor=new THREE.Vector4();
      S.renderer.getViewport(previousViewport);S.renderer.getScissor(previousScissor);
      const previousScissorTest=S.renderer.getScissorTest(),previousClear=S.renderer.getClearColor(new THREE.Color()).clone();
      const previousAlpha=S.renderer.getClearAlpha();
      try{
        r0=ROBOT.build(MUTANTS.list[i]);r0.update(3.7,0.016,{act:'look',mood:'happy'});
        if (ROBOT_STYLE) ROBOT_STYLE.apply(r0.root,cfg,THREE);
        const bb=new THREE.Box3().setFromObject(r0.root),height=Math.max(0.001,bb.getSize(V(0,0,0)).y);
        previewWrap.add(r0.root);
        r0.root.scale.multiplyScalar(3.5/height);
        const bb2=new THREE.Box3().setFromObject(r0.root);
        const center=bb2.getCenter(V(0,0,0));
        r0.root.position.sub(center);
        r0.root.position.y+=1.8;
        r0.root.rotation.y=-0.25;
        S.renderer.setScissorTest(false);
        S.renderer.setRenderTarget(portraitTarget);
        S.renderer.setViewport(0,0,128,128);
        S.renderer.clear(true,true,true);
        S.renderer.render(previewScene,previewCam);
        S.renderer.readRenderTargetPixels(portraitTarget,0,0,128,128,portraitPixels);
        const img=portraitCtx.createImageData(128,128);
        for(let y=0;y<128;y++)img.data.set(portraitPixels.subarray((127-y)*512,(128-y)*512),y*512);
        portraitCtx.putImageData(img,0,0);
        return portraitCanvas.toDataURL('image/png');
      }finally{
        if(r0){previewWrap.remove(r0.root);if(ROBOT_STYLE)ROBOT_STYLE.release(r0.root);}
        S.renderer.setRenderTarget(prevTarget);S.renderer.setViewport(previousViewport);
        S.renderer.setScissor(previousScissor);S.renderer.setScissorTest(previousScissorTest);
        S.renderer.setClearColor(previousClear,previousAlpha);
      }
    }
    function pumpPortraits(){
      if(!portraitQueue.length||!ui.classList.contains('on')){portraitBusy=false;return;}
      portraitBusy=true;
      const i=portraitQueue.shift();
      const slot=$o('onT').querySelector('[data-avatar="'+i+'"]');
      if(slot&&!portraitCache.has(i)){
        try{
          portraitCache.set(i,renderRobotPortrait(i));
          slot.innerHTML='<img src="'+portraitCache.get(i)+'" alt="Robot 3D" loading="lazy">';
        }catch(e){portraitCache.set(i,null);console.warn('Robot portrait failed',i,e);}
      }
      setTimeout(pumpPortraits,55);
    }

    const paint = () => {
      const total=Math.max(1,Math.min(ALLT.length,unl()));
      if(!ALLT.slice(0,total).includes(cfg.type)) cfg.type=ALLT[0];
      $o('onC').innerHTML=COLS.map(c=>'<button type="button" data-c="'+c+'" aria-label="Color '+c+'" aria-pressed="'+(c===cfg.col)+'" style="background:'+c+'" class="'+(c===cfg.col?'on':'')+'"></button>').join('');
      const index=ALLT.indexOf(cfg.type),id=cfg.type,img=portraitCache.get(id);
      portraitQueue=[];
      const name=safeName((MUTANTS.list[id]||{}).name||'ROBOT '+id),perk=safeName(PERK[index%PERK.length][0]);
      $o('onT').innerHTML='<div class="unfireRobotSelector" role="group" aria-label="Elegir robot">'+
        '<button type="button" class="robotArrow" data-step="-1" aria-label="Robot anterior">‹</button>'+
        '<div class="robotCard on" data-t="'+id+'" aria-live="polite" tabindex="0">'+
        '<span class="robotPortrait" data-avatar="'+id+'">'+
        (img?'<img src="'+img+'" alt="Vista del robot 3D" loading="lazy">':'<span class="robotUnknown" aria-hidden="true">◌</span>')+
        '</span><span class="robotName">'+name+'</span><small class="robotPerk">'+perk+'</small></div>'+
        '<button type="button" class="robotArrow" data-step="1" aria-label="Robot siguiente">›</button></div>'+
        '<div class="robotCount" aria-label="Robot '+(index+1)+' de '+total+'">'+(index+1)+' / '+total+'</div>'+
        (ROBOT_STYLE?ROBOT_STYLE.panel(cfg):'');
      if(!img&&!portraitCache.has(id))portraitQueue.push(id);
      if(portraitQueue.length&&!portraitBusy){portraitBusy=true;setTimeout(pumpPortraits,60);}
    };
    const repaint=()=>{portraitCache.clear();paint();applyMe();save();};
    $o('onC').onclick=e=>{const el=e.target.closest('[data-c]');if(el&&COLS.includes(el.dataset.c)){cfg.col=el.dataset.c;repaint();}};
    $o('onT').onclick=e=>{
      const nav=e.target.closest('[data-step]');
      if(nav){const total=Math.max(1,Math.min(ALLT.length,unl())),at=Math.max(0,ALLT.indexOf(cfg.type));
        const step=Number(nav.dataset.step)===-1?-1:1;cfg.type=ALLT[(at+step+total)%total];repaint();const next=$o('onT').querySelector('[data-step="'+step+'"]');if(next){try{next.focus({preventScroll:true});}catch(_){next.focus();}}return;}
      if(!ROBOT_STYLE)return;
      const camo=e.target.closest('[data-camo]'),decal=e.target.closest('[data-decal]'),clear=e.target.closest('[data-image-clear]');
      if(camo){cfg.camo=camo.dataset.camo;Object.assign(cfg,ROBOT_STYLE.normalize(cfg));repaint();}
      else if(decal){cfg.decal=decal.dataset.decal;cfg.image='';Object.assign(cfg,ROBOT_STYLE.normalize(cfg));repaint();}
      else if(clear){cfg.image='';repaint();}
    };
    $o('onT').addEventListener('change',async e=>{
      const file=e.target;if(!ROBOT_STYLE||file.id!=='onStickerFile'||!file.files||!file.files[0])return;
      try{cfg.image=await ROBOT_STYLE.upload(file.files[0]);cfg.decal='none';repaint();}
      catch(err){msg(err&&err.message?err.message:'Invalid image');}
    });
    addEventListener('unfire:avatars-unlocked',()=>{if(ui.classList.contains('on'))paint();});
    const save = () => { cfg.name = ($o('onN').value || '').trim().slice(0, 14) || 'Player'; cfg.num = Math.max(0, Math.min(99, parseInt($o('onNum').value, 10) || 27)); try { localStorage.setItem('unfire_onl', JSON.stringify(cfg)); } catch (e) {} };
    function applyMe() { ROAMS.myType = cfg.type; ROAMS.myCol = cfg.col; ROAMS.myNum = cfg.num || 27; ROAMS.myStyle = ROBOT_STYLE ? ROBOT_STYLE.normalize(cfg) : null; const pk = PERK[Math.max(0, ALLT.indexOf(cfg.type)) % PERK.length]; ROAMS.perkV = pk[1]; ROAMS.perkF = pk[2]; if (ROAMS.av && ROAMS.av.w) { if(ROBOT_STYLE&&ROAMS.av.r0)ROBOT_STYLE.release(ROAMS.av.r0.root); S.scene.remove(ROAMS.av.w); } ROAMS.av = null; }
    const tint = (o, col) => { const C = new THREE.Color(col); o.traverse((m) => { if (m.isMesh && m.name!=='unfire-personalized-sticker' && m.material && m.material.color) { m.material = m.material.clone(); m.material.color.lerp(C, 0.6); } }); };
    window.__tintAvatar = tint;
    window.__applyRobotStyle = root => { if(ROBOT_STYLE) ROBOT_STYLE.apply(root,cfg,THREE); };
    const load = (cb) => { if (window.Peer) return cb(); const s = document.createElement('script'); s.src = 'vendor/peerjs.min.js'; s.onload = cb; s.onerror = () => msg('Could not connect to the online server. Check your connection.'); document.head.appendChild(s); };
    const rnd = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const link = () => { let base = ''; try { base = parent.location.origin + parent.location.pathname; } catch (e) { base = location.origin + location.pathname; } return base + '?room=' + code; };
    const started = () => { ui.classList.remove('on'); hud.style.display = 'flex'; /* friends in the same room talk straight away */ setTimeout(() => { try { if (!VOICE.on) VOICE.start(); } catch (e) {} }, 400); NOTES.sc = 0; NOTES.build([...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 100000); upd(); say('🌐 Room ' + code + ' ready · select 📨 INVITE to bring friends'); hap(0.5); };
    const upd = () => { const rk = [[cfg.name || 'Tú', NOTES.sc]].concat(Object.values(R).map((r) => [r.d ? r.d.n : '?', r.d ? r.d.sc || 0 : 0])).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x, i) => ['🥇', '🥈', '🥉'][i] + x[0] + ' ' + x[1]).join(' '); $o('onlT').textContent = '🌐 ' + code + ' · ' + (Object.keys(R).length + 1) + '👥 · ♪ ' + rk; };
    // PeerJS WebRTC voice is opt-in: the room never requests a mic on join.
    // Audio is spatialised locally only; no microphone media is stored in the game.
    const VOICE = (() => {
      let local = null, enabled = false, starting = false, generation = 0, elapsed = 0;
      const calls = new Map(), audio = new Map(), retry = new Map(), LIMIT = 8;
      // Room voice ("SALA"): everyone in your private room hears you wherever they are,
      // like a party chat. "CERCA": only players close to you, with distance volume.
      let mode = 'room'; try { mode = localStorage.getItem('unfire_voice_mode') === 'near' ? 'near' : 'room'; } catch (_) {}
      const muted = new Set(); window.__ONL_MUTED = muted; let selfMuted = false;
      const nameOf = (id) => { const r = R[id]; return String((r && r.d && r.d.n) || 'Player').slice(0, 20); };
      const button = $o('onlMic');
      const status = (text) => {
        if (!button) return;
        button.textContent = text || (enabled ? '🎙️ VOZ ON · APAGAR' : '🎤 VOICE ON');
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        button.title = enabled ? 'Microphone on. You can hear nearby players; press to disconnect.' : 'Press to allow microphone access and hear nearby players.';
      };
      const inRange = (id, padding = 0) => {
        const r = R[id];
        if (mode === 'room') return !!(r && r.d && !muted.has(id));
        if (!r || !r.d || !ROAMS.on || !!r.d.o !== !!window.ATM_OUT || muted.has(id)) return false;
        if (!Number.isFinite(+r.d.x) || !Number.isFinite(+r.d.z)) return false;
        const distance = Math.hypot(r.d.x - ROAMS.p.x, r.d.z - ROAMS.p.z, (r.d.h || 0) - (ROAMS.h || 0));
        return distance <= (window.ATM_OUT ? 92 : 35) + padding;
      };
      function disconnect(id, callToo = true) {
        const n = audio.get(id);
        if (n) {
          try { n.source.disconnect(); n.filter.disconnect(); n.gain.disconnect(); if (n.pan) n.pan.disconnect(); } catch (_) {}
          audio.delete(id);
        }
        const call = calls.get(id);
        if (callToo && call) {
          calls.delete(id);
          try { call.close(); } catch (_) {}
        }
      }
      function incomingAudio(id, stream) {
        if (!enabled || !local || !code || !inRange(id, 20) || !stream || !stream.getAudioTracks().length) return;
        disconnect(id, false);
        try {
          // Reuse the game's existing AudioContext, but bypass its music master
          // so game-music ducking does not unintentionally control other players.
          const c = UA.init();
          const src = c.createMediaStreamSource(stream);
          const filter = c.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 110;
          const gain = c.createGain(); gain.gain.value = 0;
          const pan = c.createStereoPanner ? c.createStereoPanner() : null;
          src.connect(filter).connect(gain);
          if (pan) { gain.connect(pan).connect(c.destination); } else gain.connect(c.destination);
          audio.set(id, { source: src, filter, gain, pan });
        } catch (e) { console.warn('Audio online', e); disconnect(id); }
      }
      function bindCall(call) {
        if (!call || !call.peer || calls.has(call.peer)) { try { call && call.close(); } catch (_) {} return; }
        const id = call.peer;
        calls.set(id, call);
        call.on('stream', (stream) => { if (calls.get(id) === call) incomingAudio(id, stream); });
        call.on('close', () => { if (calls.get(id) === call) { calls.delete(id); disconnect(id, false); retry.set(id, performance.now() + 3500); } });
        call.on('error', () => { if (calls.get(id) === call) { calls.delete(id); disconnect(id, false); retry.set(id, performance.now() + 5000); } });
      }
      function bindPeer(p) {
        p.on('call', (call) => {
          const r = R[call.peer];
          if (!call.metadata || call.metadata.room !== code || !enabled || !local || !code || !r || !r.d || !r.d.v || !inRange(call.peer, 12) || calls.has(call.peer)) {
            try { call.close(); } catch (_) {} return;
          }
          bindCall(call);
          try { call.answer(local); } catch (e) { disconnect(call.peer); }
        });
      }
      function stop() {
        generation++; enabled = false; starting = false;
        for (const id of [...calls.keys()]) disconnect(id);
        for (const id of [...audio.keys()]) disconnect(id, false);
        retry.clear();
        if (local) { local.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); local = null; }
        status();
      }
      async function start() {
        if (!code || !peer || starting || enabled) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          status('⚠️ MICROPHONE UNAVAILABLE IN BROWSER'); return;
        }
        starting = true; const token = ++generation; status('🎤 SOLICITANDO PERMISO…');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false
          });
          if (token !== generation || !code || !peer) {
            stream.getTracks().forEach((t) => t.stop()); return;
          }
          local = stream; enabled = true;
          for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => { if (local === stream) stop(); }, { once: true });
          UA.init();
          status();
          visibility(window.__gameVisible !== false);
          sendT = 0; // immediately share microphone readiness (never actual audio data)
        } catch (e) {
          if (token === generation) {
            console.warn('Permiso de micrófono', e.name || e);
            status(e.name === 'NotAllowedError' ? '🔇 MICROPHONE BLOCKED · RETRY' : '⚠️ MICROPHONE UNAVAILABLE · RETRY');
          }
        } finally { if (token === generation) starting = false; }
      }
      function tick(dt) {
        if (!enabled || !local || !peer || !code) return;
        elapsed += dt;
        if (elapsed < 0.12) return; elapsed = 0;
        const now = performance.now();
        // Only close and re-open calls at distance thresholds; no full-room audio mesh.
        for (const [id, call] of calls) {
          if (!R[id] || !R[id].d || !R[id].d.v || !inRange(id, 22)) disconnect(id);
        }
        for (const [id, n] of audio) {
          const r = R[id];
          if (!r || !r.d || !r.d.v || !inRange(id, 22) || !n.gain) { disconnect(id); continue; }
          const dx = r.w.position.x - ROAMS.p.x, dz = r.w.position.z - ROAMS.p.z;
          const distance = Math.hypot(dx, dz, (r.d.h || 0) - (ROAMS.h || 0));
          const max = window.ATM_OUT ? 92 : 35;
          const near = window.ATM_OUT ? 12 : 6;
          const prox = distance < near ? 0.83 : 0.83 * Math.pow(Math.max(0, 1 - (distance - near) / (max - near)), 2);
          const volume = muted.has(id) ? 0 : mode === 'room' ? Math.max(0.6, prox) : prox;
          n.gain.gain.setTargetAtTime(volume, UA.ctx.currentTime, 0.12);
          if (n.pan) n.pan.pan.setTargetAtTime(mode === 'room' && distance > max ? 0 : Math.max(-0.75, Math.min(0.75, dx / 18)), UA.ctx.currentTime, 0.18);
        }
        if (calls.size >= LIMIT) return;
        for (const id of Object.keys(R)) {
          if (calls.size >= LIMIT) break;
          const r = R[id];
          if (!r || !r.d || !r.d.v || !inRange(id) || calls.has(id) || (retry.get(id) || 0) > now) continue;
          // Exactly one side dials each pair, preventing simultaneous WebRTC offers.
          if (myId && myId < id) {
            retry.set(id, now + 10000);
            try { const call = peer.call(id, local, { metadata: { room: code } }); if (call) bindCall(call); }
            catch (e) { retry.set(id, now + 5000); }
          }
        }
      }
      button.onclick = () => { if (enabled || starting) stop(); else start(); };
      const tr2 = (_unusedSpanish, en) => en; // Public game voice controls are always English
      const muteB = $o('onlMute'), modeB = $o('onlVM'), plB = $o('onlPl'), list = $o('onlPlist');
      const paintMode = () => { modeB.textContent = mode === 'room' ? tr2('👥 ROOM', '👥 ROOM') : tr2('📍 NEARBY', '📍 NEARBY'); modeB.title = mode === 'room' ? tr2('Everyone in your room hears you, wherever they are', 'Everyone in your room hears you, wherever they are') : tr2('Only nearby players hear you', 'Only nearby players hear you'); };
      const paintMute = () => { muteB.style.display = enabled ? '' : 'none'; muteB.textContent = selfMuted ? tr2('🔇 MI MICRO', '🔇 MY MIC') : tr2('🎙️ MY MIC', '🎙️ MY MIC'); muteB.setAttribute('aria-pressed', selfMuted ? 'true' : 'false'); };
      function paintList() {
        const ids = Object.keys(R).filter((id) => R[id] && R[id].d);
        list.innerHTML = ids.length ? '' : '<div style="opacity:.8;padding:6px">' + tr2('No other players in the room yet.', 'No other players in the room yet.') + '</div>';
        ids.forEach((id) => { const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:space-between;padding:5px 2px'; const nm = document.createElement('span'); nm.textContent = (R[id].d.v ? '🎙️ ' : '🔈 ') + nameOf(id); const b = document.createElement('button'); b.type = 'button'; b.textContent = muted.has(id) ? tr2('🔇 SILENCIADO', '🔇 MUTED') : tr2('🔊 SILENCIAR', '🔊 MUTE'); b.style.cssText = 'border:0;border-radius:999px;padding:5px 9px;font:800 11px Arial;cursor:pointer;background:' + (muted.has(id) ? '#ff5470' : '#5fe0ff'); b.onclick = (e) => { e.stopPropagation(); if (muted.has(id)) muted.delete(id); else { muted.add(id); disconnect(id); } paintList(); }; const rp = document.createElement('button'); rp.type = 'button'; rp.textContent = tr2('🚩 REPORTAR', '🚩 REPORT'); rp.title = tr2('Avisar a UNFIRE de un comportamiento ofensivo', 'Tell UNFIRE about offensive behaviour'); rp.style.cssText = 'border:0;border-radius:999px;padding:5px 9px;font:800 11px Arial;cursor:pointer;background:#ffb020'; rp.onclick = (e) => { e.stopPropagation(); muted.add(id); disconnect(id); paintList(); const body = encodeURIComponent('Player: ' + nameOf(id) + '\n' + 'Room: ' + (code || '') + '\n' + 'What happened: '); location.href = 'mailto:hello@unfire.technology?subject=' + encodeURIComponent('Y2K Robots · ' + 'Player report') + '&body=' + body; }; row.append(nm, b, rp); list.appendChild(row); });
      }
      modeB.onclick = (e) => { e.stopPropagation(); mode = mode === 'room' ? 'near' : 'room'; try { localStorage.setItem('unfire_voice_mode', mode); } catch (_) {} paintMode(); for (const id of [...calls.keys()]) if (!inRange(id, 22)) disconnect(id); };
      muteB.onclick = (e) => { e.stopPropagation(); selfMuted = !selfMuted; paintMute(); visibility(window.__gameVisible !== false); };
      plB.onclick = (e) => { e.stopPropagation(); const open = list.style.display === 'none'; list.style.display = open ? 'block' : 'none'; if (open) paintList(); };
      paintMode(); setInterval(() => { paintMute(); if (list.style.display !== 'none') paintList(); }, 1500);
      function visibility(vis) {
        const active = !!vis && !document.hidden && enabled;
        if (local) local.getAudioTracks().forEach((track) => { track.enabled = active && !selfMuted; });
        if (!active) for (const n of audio.values()) {
          try { n.gain.gain.setTargetAtTime(0, UA.ctx.currentTime, 0.03); } catch (_) {}
        }
      }
      document.addEventListener('visibilitychange', () => visibility(window.__gameVisible !== false));
      addEventListener('pagehide', stop);
      status();
      return { get on() { return enabled; }, bindPeer, tick, stop, start, disconnect, visibility };
    })();
    function safePacket(raw, c) {
      try {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const id=raw.id;
        if(typeof id!=='string'||id.length<1||id.length>96||
           !/^[A-Za-z0-9_-]+$/.test(id)||
           id==='__proto__'||id==='constructor'||id==='prototype')return null;
        if(isHost&&id!==c.peer)return null;
        // Text chat travels on the same short-lived P2P room connection.
        if(raw.kind==='chat'){
          if(typeof raw.text!=='string'||!raw.text.trim()||raw.text.length>180||/[\u0000-\u001f\u007f]/.test(raw.text))return null;
          if(raw.n!=null&&typeof raw.n!=='string')return null;
          return {id,kind:'chat',n:String(raw.n||'Player').slice(0,20),text:raw.text.trim()};
        }
        if(raw.bye!=null)return raw.bye===1?{id,bye:1}:null;
        if(raw.nt!=null)return Number.isInteger(raw.nt)&&raw.nt>=0&&raw.nt<30?
          {id,nt:raw.nt}:null;
        if(!Number.isInteger(raw.t)||raw.t<0||raw.t>=MUTANTS.list.length)return null;
        if(!COLS.includes(raw.c))return null;
        if(!Number.isFinite(raw.x)||!Number.isFinite(raw.z)||
           !Number.isFinite(raw.h)||!Number.isFinite(raw.y))return null;
        if(Math.abs(raw.x)>20000||Math.abs(raw.z)>20000||
           raw.h<-100||raw.h>10000||Math.abs(raw.y)>1000000)return null;
        if(raw.n!=null&&typeof raw.n!=='string')return null;
        if(!R[id]&&Object.keys(R).length>=40)return null;
        const safeCamo=['plain','carbon','arctic','urban','desert','digital','neon'];
        const safeDecal=['none','star','bolt','heart','smile','wave'];
        if(raw.ca!=null&&(typeof raw.ca!=='string'||!safeCamo.includes(raw.ca)))return null;
        if(raw.de!=null&&(typeof raw.de!=='string'||!safeDecal.includes(raw.de)))return null;
        const packet={
          id,n:String(raw.n||'Player').slice(0,20),c:raw.c,t:raw.t,
          x:raw.x,z:raw.z,h:raw.h,y:raw.y,
          sc:Number.isFinite(raw.sc)?Math.max(0,Math.min(99999,raw.sc)):0,
          f:raw.f===1?1:0,o:raw.o===1?1:0,
          m:raw.m===1?1:0,v:raw.v===1?1:0,q:raw.q===1?1:0
        };
        if(raw.ca!=null)packet.ca=raw.ca;
        if(raw.de!=null)packet.de=raw.de;
        return packet;
      }catch(_){return null;}
    }
    function setup(c) {
      conns.push(c);
      let rateStart=0,rateCount=0;
      let lastChatAt=0;
      c.on('data', (raw) => {
        const now=performance.now();
        if(!rateStart||now-rateStart>=1000){rateStart=now;rateCount=0;}
        if(++rateCount>40)return;
        const d=safePacket(raw,c);
        if(!d||d.id===myId)return;
        if(d.kind==='chat'){
          // Serverless P2P; ignore floods before relaying to other room members.
          if(lastChatAt&&now-lastChatAt<650)return;
          lastChatAt=now;
          try { window.UnfireConversations && window.UnfireConversations.receivePeer(d); } catch (_) {}
        }
        else if(d.nt!=null)NOTES.take(d.nt,false);
        else if(d.bye)drop(d.id);
        else recv(d);
        if(isHost)conns.forEach((o)=>{
          if(o!==c&&o.open)try{o.send(d);}catch(e){}
        });
      });
      c.on('close', () => {
        conns=conns.filter((x)=>x!==c);
        if(isHost){
          drop(c.peer);
          conns.forEach((o)=>{try{o.send({id:c.peer,bye:1});}catch(e){}});
        }else{say('🌐 The host closed the room');leave();}
      });
    }
    function create() { if (joining) { msg('Finish or cancel the current connection attempt first'); return; } save(); applyMe(); msg('Creating room…'); load(() => { code = rnd(); isHost = true; peer = new Peer('unfire-sala-' + code); VOICE.bindPeer(peer); peer.on('open', (id) => { myId = id; started(); }); peer.on('connection', (c) => { c.on('open', () => setup(c)); }); peer.on('error', (e) => { if (e.type === 'unavailable-id') { try { peer.destroy(); } catch (er) {} create(); } else msg('Error online: ' + e.type); }); }); }
    // A remote connection may stall behind strict NATs or restricted Wi-Fi.
    // Keep the screen responsive, offer a retry and never leave a dangling Peer.
    let joining = null;
    function clearJoining() { if (joining) { clearTimeout(joining.timer); joining = null; } }
    function join(c0) {
      save(); applyMe();
      const cc = (c0 || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cc.length !== 5) { msg('The code must have 5 letters or numbers'); return; }
      if (joining) { msg('Connecting… you can retry if this takes too long'); return; }
      if (code && peer) { msg('You are already in a room. Leave it before joining another'); return; }
      msg('Joining room ' + cc + '…');
      const task = { timer: null, current: null };
      joining = task;
      const failed = (reason) => {
        if (joining !== task) return;
        clearJoining();
        try { if (task.current && !task.current.destroyed) task.current.destroy(); } catch (_) {}
        if (peer === task.current) { peer = null; code = null; myId = null; }
        msg(reason);
      };
      task.timer = setTimeout(() => failed('The room is not responding. Check your connection or request a new code and try again.'), 22000);
      load(() => {
        if (joining !== task) return;
        code = cc; isHost = false;
        let p;
        try { p = new Peer(); } catch (_) { failed('Could not start the connection. Please try again.'); return; }
        peer = task.current = p; VOICE.bindPeer(p);
        p.on('open', (id) => {
          if (joining !== task) return;
          myId = id;
          let c;
          try { c = p.connect('unfire-sala-' + cc, { reliable: false }); }
          catch (_) { failed('Could not connect to that room. Please try again.'); return; }
          if (!c) { failed('Could not open that room.'); return; }
          c.on('open', () => {
            if (joining !== task) { try { c.close(); } catch (_) {} return; }
            clearJoining(); setup(c); started();
          });
          c.on('error', () => failed('Connection between players failed. Please retry.'));
          c.on('close', () => { if (joining === task) failed('Could not join that room. Please try again.'); });
        });
        p.on('error', (e) => failed(e.type === 'peer-unavailable' ? 'That room no longer exists or the host has left' : 'Online connection error: ' + e.type));
      });
    }
    function leave() { clearJoining(); VOICE.stop(); NOTES.clear(); try { conns.forEach((c) => { try { c.send({ id: myId, bye: 1 }); } catch (e) {} c.close(); }); peer && peer.destroy(); } catch (e) {} conns = []; peer = null; code = null; hud.style.display = 'none'; Object.keys(R).forEach(drop); }
    function drop(id) { VOICE.disconnect(id); const r = R[id]; if (!r) return; if(ROBOT_STYLE&&r.r0)ROBOT_STYLE.release(r.r0.root); S.scene.remove(r.w); S.scene.remove(r.tag); delete R[id]; if (code) upd(); }
    function recv(d) { const style=ROBOT_STYLE?ROBOT_STYLE.normalize({col:d.c,camo:d.ca,decal:d.decal||d.de}):null; let r = R[d.id]; if (!r || r.t !== d.t || r.c !== d.c || (style && (r.ca!==style.camo || r.de!==style.decal))) { if (r) drop(d.id); try { const r0 = ROBOT.build(Object.assign({}, MUTANTS.list[d.t % MUTANTS.list.length])); r0.update(3.7, 0.016, {}); if(style)ROBOT_STYLE.apply(r0.root,style,THREE); const w = new THREE.Group(); w.add(r0.root); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar(10.5 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; tint(w, d.c); S.scene.add(w); const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = 'rgba(8,14,40,.8)'; g.beginPath(); g.roundRect ? g.roundRect(2, 8, 252, 48, 24) : g.rect(2, 8, 252, 48); g.fill(); g.fillStyle = d.c; g.font = '900 28px Arial'; g.textAlign = 'center'; g.fillText(String(d.n || 'Player').slice(0, 14), 128, 43); const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); tag.scale.set(8, 2, 1); S.scene.add(tag); w.position.set(d.x, -8.9 + d.h, d.z); r = R[d.id] = { w, r0, tag, t: d.t, c: d.c, ca:style&&style.camo, de:style&&style.decal, p: V(d.x, -8.9 + d.h, d.z), wd: 0 }; upd(); if (!d.q) say('👋 ' + (d.n || 'Alguien') + ' joined the room'); } catch (e) { return; } } r.d = d; r.last = performance.now(); }
    let pending = null; try { pending = new URLSearchParams(parent.location.search).get('room'); } catch (e) {} if (!pending) try { pending = new URLSearchParams(location.search).get('room'); } catch (e) {}
    window.__REWARD = (why) => { let u = 0; try { u = (+localStorage.getItem('unfire_unlock') || 0) + 1; localStorage.setItem('unfire_unlock', String(u)); } catch (e) {} const k = Math.min(ALLT.length - 1, 1 + u), nm = (MUTANTS.list[ALLT[k]] || {}).name || 'ROBOT'; say('🏆 ' + why + ' · 🎁 New transformation unlocked: ' + nm + ' (' + PERK[k % PERK.length][0] + ')! Switch to it in ⚙ › 🔧 WORKSHOP'); hap(1); try { if (window.__SPRAY) window.__SPRAY(ROAMS.p.x, -8.9 + (ROAMS.h || 0) + 6, ROAMS.p.z, 120, 10, 20); } catch (e) {} };
    // Attach workshop controls as soon as Story creates its HUD, including on throttled mobile tabs.
    const mountWorkshopControls = () => {
      const h=document.getElementById('storyHud');
      if(!h) return false;
      if(h.querySelector('#unfireWorkshopHud')) return true;
      const b=document.createElement('button'); b.id='unfireWorkshopHud';
      b.textContent='🔧 TALLER'; b.onclick=()=>ONLINE.open(true);
      const b2=document.createElement('button'); b2.id='unfireOnlineHud';
      b2.textContent='🌐 ONLINE'; b2.onclick=()=>ONLINE.open();
      h.insertBefore(b2,h.querySelector('.obj')); h.insertBefore(b,b2);
      return true;
    };
    if(!mountWorkshopControls()){
      const watcher=new MutationObserver(()=>{if(mountWorkshopControls())watcher.disconnect();});
      watcher.observe(document.body,{childList:true,subtree:true});
      addEventListener('pagehide',()=>watcher.disconnect(),{once:true});
    }
    applyMe();
    return { sendChat(text) {
        if(!code||!peer||!myId||typeof text!=='string')return false;
        const q=text.trim();
        if(!q||q.length>180)return false;
        const d={id:myId,kind:'chat',n:String(cfg.name||'Player').slice(0,20),text:q};
        conns.forEach((c)=>{if(c.open)try{c.send(d);}catch(_){}});
        return true;
      }, get myName(){return String(cfg.name||'Player').slice(0,20);}, open(taller) { ui.classList.toggle('workshop',!!taller);ui.classList.add('on');paint(); $o('onN').value = cfg.name || (window.__STORYNAME && window.__STORYNAME()) || ''; $o('onNum').value = cfg.num || 27; msg(''); ui.querySelector('h3').textContent = taller ? '🔧 WORKSHOP · customize your robot' : '🌐 ONLINE MODE'; ui.querySelectorAll('.act').forEach((a, i) => (a.style.display = taller && i < 2 ? 'none' : 'flex')); ui.classList.add('on'); }, get on() { return !!code; }, get joining() { return !!joining; }, get audioPlayers() { return code ? Object.values(R) : []; }, voiceVisibility(v) { VOICE.visibility(v); },
      tick(dt, t) { if (pending && ROAMS.on) { this.open(); $o('onCode').value = pending; msg('You were invited to room ' + pending + ' · choose your robot and select JOIN'); pending = null; }
        if (!code || !peer) return; sendT -= dt; if (sendT <= 0 && myId) { sendT = 0.1; const d = { id: myId, n: cfg.name, c: cfg.col, t: cfg.type, ca:cfg.camo||'plain', de:cfg.image?'none':(cfg.decal||'none'), x: +ROAMS.p.x.toFixed(2), z: +ROAMS.p.z.toFixed(2), h: +(ROAMS.h || 0).toFixed(2), y: +((ROAMS.cy == null ? ROAMS.yaw : ROAMS.cy)).toFixed(3), sc: NOTES.sc, f: ROAMS.fly ? 1 : 0, o: window.ATM_OUT ? 1 : 0, m: ROAMS.moving ? 1 : 0, v: VOICE.on ? 1 : 0, q: 1 }; conns.forEach((c) => { if (c.open) try { c.send(d); } catch (e) {} }); }
        if (NOTES.g) { NOTES.g.visible = !!window.ATM_OUT; const fy = -8.9 + (ROAMS.h || 0) + 5; NOTES.list.forEach((n, i) => { if (!n.on) return; n.sp.material.rotation = Math.sin(t * 2 + i) * 0.3; if (window.ATM_OUT && Math.abs(ROAMS.p.x - n.sp.position.x) < 7 && Math.abs(ROAMS.p.z - n.sp.position.z) < 7 && Math.abs(fy - n.sp.position.y) < 9) { NOTES.take(i, true); conns.forEach((c) => { if (c.open) try { c.send({ id: myId, nt: i }); } catch (e) {} }); upd(); } }); } NOTES.uT = (NOTES.uT || 0) - dt; if (NOTES.uT <= 0) { NOTES.uT = 1; upd(); } const now = performance.now(); Object.keys(R).forEach((id) => { const r = R[id], d = r.d; if (!d) return; if (now - r.last > 8000) { drop(id); return; } const vis = !!d.o === !!window.ATM_OUT; r.w.visible = r.tag.visible = vis; if (!vis) return; const tgt = V(d.x, -8.9 + d.h, d.z), mv = r.w.position.distanceTo(tgt); r.w.position.lerp(tgt, Math.min(1, dt * 8)); r.wd += Math.min(mv, 5); r.w.rotation.y = Math.atan2(Math.sin(d.y), -Math.cos(d.y)); r.tag.position.set(r.w.position.x, r.w.position.y + 13, r.w.position.z); r.r0.update(3.7, dt, { act: d.f ? 'fly' : d.m ? 'walk' : null, ph: d.m ? STEPPH(r.wd, 10.5, false) : t, mood: 'happy' }); }); VOICE.tick(dt); }, create, join, leave, link, saveMe() { save(); applyMe(); } };
  })();
  { const g = (id) => document.getElementById(id); g('onNew').onclick = () => ONLINE.create(); g('onJoin').onclick = () => ONLINE.join(g('onCode').value); g('onX').onclick = () => { ONLINE.saveMe(); if (ONLINE.joining) ONLINE.leave(); g('onl').classList.remove('on'); };
    g('onlQ').onclick = () => { ONLINE.leave(); say('🌐 You left the room'); };
    g('onlInv').onclick = async () => { const l = ONLINE.link(), txt = 'Come play UNFIRE AUDIO with me! Room: '; try { if (navigator.share) { await navigator.share({ title: 'UNFIRE AUDIO', text: txt, url: l }); return; } } catch (e) {} try { await navigator.clipboard.writeText(l); say('📨 Link copied: ' + l + ' · share it with friends'); } catch (e) { say('📨 Send this link to friends: ' + l); } }; }
  // ===== Reusable capsule inventory: pack, throw, deploy and collect without leaving roam =====
  const CAPS=(()=>{
    let capsule=null, flight=0, start=null, target=null, launchNano=false, upperShell=null, lowerShell=null, launchAt=0;
    const build=()=>{
      if(capsule)return;
      capsule=new THREE.Group();
      // Two low-poly hemispheres, created once and reused for every throw.
      const upper=new THREE.Mesh(new THREE.SphereGeometry(0.63,12,8,0,TAU,0,H2),new THREE.MeshStandardMaterial({color:0xff2fb0,metalness:0.35,roughness:0.34}));
      const lower=new THREE.Mesh(new THREE.SphereGeometry(0.63,12,8,0,TAU,H2,H2),new THREE.MeshStandardMaterial({color:0xeaf2ff,metalness:0.2,roughness:0.37}));
      upperShell=upper;lowerShell=lower;capsule.add(upper,lower);capsule.visible=false;S.scene.add(capsule);
    };
    const cancel=()=>{flight=0;launchAt=0;launchNano=false;if(capsule){capsule.visible=false;capsule.scale.setScalar(1);}if(upperShell)upperShell.position.y=0;if(lowerShell)lowerShell.position.y=0;};
    const pack=()=>{if(!ROAMS.on||!portableUnlocked())return false;cancel();closeCaseInGame();say('🎒 Case and items packed into a capsule. Press G or LAUNCH to deploy.');return true;};
    const throwIt=()=>{
      if(!ROAMS.on||!portableUnlocked())return false;
      if(flight>0)return false;
      if(!carryingCase)return pack();
      build();
      launchNano=!!ROAMS.mini;
      const yaw=ROAMS.cy==null?ROAMS.yaw:ROAMS.cy;
      const dirX=Math.sin(yaw),dirZ=-Math.cos(yaw);
      const floor=-8.9+(ROAMS.h||0);
      start=V(ROAMS.p.x,floor+(launchNano ? 0.18 : 6.5),ROAMS.p.z);
      target=V(ROAMS.p.x+dirX*7,floor+(window.ATM_OUT?6.8:0.8),ROAMS.p.z+dirZ*7);
      capsule.position.copy(start);capsule.rotation.set(0,0,0);capsule.scale.setScalar(launchNano ? NANO_SCALE : 1);
      capsule.visible=true;flight=0.001;launchAt=performance.now();
      say('🎒 Capsule launched!');hap(0.3);
      return true;
    };
    const action=()=>carryingCase?throwIt():pack();
    addEventListener('keydown',e=>{
      const t=e.target;if(t && (t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName)))return;
      if((e.key==='g'||e.key==='G')&&ROAMS.on&&!CASE_VIEW.on&&portableUnlocked()&&!e.repeat){
        if(!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();action();}
      }
    });
    setTimeout(function addB(){
      const h=document.getElementById('storyHud');
      if(!h){setTimeout(addB,1000);return;}
      const btn=document.createElement('button');btn.id='capsuleHudButton';
      btn.textContent='🎒 CAPSULE (G)';btn.onclick=action;btn.title='Unlocked after mission three';h.insertBefore(btn,h.firstChild);
      setInterval(()=>{if(!btn.isConnected)return;btn.disabled=!portableUnlocked();btn.textContent=portableUnlocked()?'🎒 CAPSULE (G)':'🔒 CAPSULE · MISSION 3';},900);
    },1600);
    return {throwIt,pack,cancel,get flying(){return flight>0;},tick(dt){
      // Self-heal display mismatches without spawning more meshes or audio.
      if(ROAMS.on && carryingCase && caseG.visible)caseG.visible=false;
      if(ROAMS.on && !carryingCase && !caseG.visible)caseG.visible=true;
      if(!flight||!capsule)return;
      const duration=launchNano ? 1.52 : 0.85;
      const elapsed=Math.max(0,(performance.now()-launchAt)/1000);
      flight=Math.min(duration,Math.max(flight+Math.min(dt,0.06),elapsed));
      const u=flight/(launchNano ? 1.52 : 0.85);
      const travel=launchNano ? Math.min(1,u/0.63) : u;
      capsule.position.set(
        start.x+(target.x-start.x)*travel,
        start.y+(target.y-start.y)*travel+(launchNano ? 0.8 : 3.2)*Math.sin(Math.PI*travel),
        start.z+(target.z-start.z)*travel
      );
      if(launchNano){
        const grow=Math.max(0,Math.min(1,(u-0.60)/0.4));
        const eased=grow*grow*(3-2*grow);
        capsule.scale.setScalar(NANO_SCALE+(1-NANO_SCALE)*eased);
        if(upperShell)upperShell.position.y=0.24*Math.max(0,(grow-0.7)/0.3);
        if(lowerShell)lowerShell.position.y=-0.24*Math.max(0,(grow-0.7)/0.3);
      }
      capsule.rotation.x+=dt*7;capsule.rotation.z+=dt*5;
      if(u>=1){
        cancel();openCaseInGame(target);
        say(window.ATM_OUT?'✨ Case hovering: tap it to interact, then return to your robot using the blue button.':'✨ Case deployed. You can pack it back into the capsule.');
        hap(0.4);
      }
    }};
  })();
  // ===== SECRETOS: la pirámide se puede visitar por dentro y cada islita guarda un artilugio escondido (recompensa al encontrarlo) =====
  const SECRETS = (() => { const L = [['pyr', 600, -10, 'la cámara secreta de la pirámide', 0], ['isl1', -420, 120, 'la isla verde', 0], ['isl2', 300, 420, 'la isla blanca', 0], ['isl3', -360, -380, 'la isla violeta', 0], ['obel', 80, -470, 'el oasis del obelisco', 0], ['haiku', -730, -610, 'el camino de los torii de la isla Haiku', 0]]; window.__SECL = L; let built = false; const items = [];
    const build = () => { built = true; const mk = window.__MKDEV; L.forEach(([id, x, z, name], k) => { try { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 0.8, 32), new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.15, clearcoat: 1 })); g.add(base); const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.25, 8, 48), new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false })); ring.rotation.x = H2; ring.position.y = 0.6; g.add(ring); let dv = null; if (mk) { dv = mk(k * 5 + 3); dv.root.scale.setScalar(5); dv.root.position.y = 1.2; g.add(dv.root); } const isl = id.startsWith('isl'); g.position.set(x, id === 'pyr' ? FYO + 0.4 : isl ? -9.605 + ({ isl1: 10.5, isl2: 9, isl3: 12 })[id] + 0.4 : -9.005 + 0.4, z); S.scene.add(g); items.push({ id, g, dv, ring, name, found: (() => { try { return localStorage.getItem('unfire_sec_' + id) === '1'; } catch (e) { return false; } })() }); } catch (e) {} }); };
    const FYO = -8.9;
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on; if (!built) { if (!out) return; build(); } items.forEach((q) => { q.g.visible = out; if (!out) return; const d = Math.hypot(ROAMS.p.x - q.g.position.x, ROAMS.p.z - q.g.position.z); if (d > 600) return; q.g.rotation.y += dt * 0.5; q.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06); if (q.dv) try { q.dv.update(1.1 + Math.sin(t * 0.4) * 1.1, dt, { level: 0.3 }); } catch (e) {} if (!q.found && d < 14 && Math.abs(-8.9 + (ROAMS.h || 0) - q.g.position.y) < 25) { q.found = true; try { localStorage.setItem('unfire_sec_' + q.id, '1'); } catch (e) {} try { window.__REWARD('Secreto encontrado: ' + q.name); } catch (e) {} } }); } }; })();
  // PROPULSIÓN: fuera de la isla, volando, puedes subir o bajar la propulsión (+ / -) para cruzar el mundo de sueño hasta los titanes
  { const LV = [1, 3, 8]; let li = 0; const chip = document.createElement('div'); chip.id = 'propHud'; chip.innerHTML = '<button id="prDn">−</button><span id="prT"></span><button id="prUp">+</button>'; chip.style.cssText = 'position:fixed;left:14px;bottom:calc(9vh + 64px);z-index:61;display:none;gap:8px;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(8,14,40,.85);border:2px solid #ffb020;color:#fff;font:800 12px Orbitron,Arial'; document.body.appendChild(chip); const st = document.createElement('style'); st.textContent = '#propHud button{border:0;border-radius:50%;width:30px;height:30px;font:900 18px Arial;color:#1a0a00;background:#ffb020;cursor:pointer}body.recOn #propHud,body.storyOn #propHud{visibility:hidden}@media (pointer:coarse){#propHud{left:50%!important;transform:translateX(-50%);bottom:auto!important;top:150px}}'; document.head.appendChild(st); chip.addEventListener('pointerdown', (e) => e.stopPropagation());
    const far = () => window.ATM_OUT && ROAMS.on && ROAMS.fly; const set = (d) => { li = Math.max(0, Math.min(LV.length - 1, li + d)); hap(0.3); }; document.getElementById('prUp').onclick = () => set(1); document.getElementById('prDn').onclick = () => set(-1);
    addEventListener('keydown', (e) => { if (!far() || (e.target && e.target.tagName === 'INPUT')) return; if (e.key === '+' || e.key === '=') set(1); if (e.key === '-' || e.key === '_') set(-1); });
    // In-flight landing assist: smoothly reduce effective thrust around land, the house,
    // and sky platforms. Selection is kept intact; there is no input, camera or case override.
    const smooth = (a,b,v) => { const t=Math.max(0,Math.min(1,(v-a)/(b-a))); return t*t*(3-2*t); };
    const landingZones = [
      [0,0,256],[-760,-760,262],[600,0,340],[80,-500,190],
      [-420,120,75],[300,420,65],[-360,-380,85]
    ];
    let effective=1,lastPropAt=performance.now(),approaching=false;
    function landingInfluence(){
      const x=ROAMS.p.x,z=ROAMS.p.z,h=Math.max(0,ROAMS.h||0);
      const brake=320+LV[li]*48; // more stopping space when a higher level is selected
      const groundFactor=1-smooth(120,380,h);
      let near=0;
      for(const [cx,cz,r] of landingZones){
        const distance=Math.max(0,Math.hypot(x-cx,z-cz)-r);
        near=Math.max(near,(1-smooth(0,brake,distance))*groundFactor);
      }
      // The house needs tighter control than the island shore, on approach AND departure.
      const houseDistance=Math.max(0,Math.hypot(x,z-40)-105);
      const house=(1-smooth(0,320,houseDistance))*(1-smooth(100,330,h));
      near=Math.max(near,house);
      // Floating platforms are also safe landing zones; no new scene traversal.
      if(h>35 && typeof window.__SKYDEV==='function'){
        const platforms=window.__SKYDEV()||[];
        const worldY=-8.9+h;
        for(const platform of platforms){
          if(!platform||!platform.visible)continue;
          const r=Math.max(12,platform.scale.x*0.7);
          const top=platform.position.y+platform.scale.x*0.45;
          const horizontal=Math.max(0,Math.hypot(x-platform.position.x,z-platform.position.z)-r);
          const vertical=Math.abs(worldY-(top+9));
          near=Math.max(near,(1-smooth(0,brake*0.55,horizontal))*(1-smooth(85,340,vertical)));
        }
      }
      return Math.max(0,Math.min(1,near));
    }
    window.__PROP = () => {
      const now=performance.now(),dt=Math.max(0,Math.min(0.08,(now-lastPropAt)/1000));
      lastPropAt=now;
      if(!far()){effective=1;approaching=false;return 1;}
      const danger=landingInfluence(),chosen=LV[li];
      // At close landing distance, cap effective thrust near x2.5, but never change
      // the user's selected level. Smooth both braking and restoration.
      const target=1+(chosen-1)*(1-0.92*danger);
      effective+=(target-effective)*(1-Math.exp(-4.5*dt));
      effective=Math.max(1,Math.min(chosen,effective));
      approaching=chosen>1&&effective<chosen-0.4;
      return effective;
    };
    setInterval(() => {
      const on=far();chip.style.display=on?'flex':'none';
      if(on){
        const actual=window.__PROP();
        document.getElementById('prT').textContent='🚀 PROPULSIÓN x'+LV[li]+
          (approaching?' · cerca x'+actual.toFixed(1):'')+' (+/−)';
      }
    },250); }
  // líneas de velocidad alrededor de la cámara cuando vuelas muy rápido (sensación de velocidad, suave y sin cargar)
  // ===== GS: efectos puntuales del juego (pasos, alas, aterrizaje, agua y colisiones). Nunca generar pulsos repetidos al cambiar la propulsión =====
  const GS = (() => { let bus = null, nb = null; const last = {}; const ok = (k, gap) => { const n = performance.now(); if (n - (last[k] || 0) < gap) return false; last[k] = n; return true; };
    const init = () => { const c = UA.ctx; if (!c || !UA.bus) return null; if (!bus) { const cmp = c.createDynamicsCompressor(); cmp.threshold.value = -26; cmp.knee.value = 12; cmp.ratio.value = 14; cmp.attack.value = 0.003; cmp.release.value = 0.2; bus = c.createGain(); bus.gain.value = 0.55; bus.connect(cmp); cmp.connect(UA.bus.master); const n = c.sampleRate, b = c.createBuffer(1, n, n), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = l * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = l * 1.6; } nb = b; } return c; };
    const att = (p, R) => { if (!p) return 1; const d = Math.hypot(p.x - ROAMS.p.x, p.z - ROAMS.p.z); return d > R ? 0 : 1 / (1 + (d / (R * 0.18)) ** 2); };
    const noise = (c, t, dur, type, f0, f1, Q, g0) => { const s = c.createBufferSource(); s.buffer = nb; s.playbackRate.value = 0.8 + Math.random() * 0.4; const f = c.createBiquadFilter(); f.type = type; f.Q.value = Q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };
    const tone = (c, t, dur, type, f0, f1, g0) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05); };
    const P = {
      step(pos, surf, big) { const c = init(); if (!c) return; const a = att(pos, big ? 900 : 70); if (a < 0.02) return; const t = c.currentTime, v = a * (big ? 0.55 : 0.32) * (0.8 + Math.random() * 0.2); // soft footsteps: never louder than voices
        if (big) { tone(c, t, 0.9, 'sine', 46, 30, 0.11 * v); noise(c, t, 0.7, 'lowpass', 180, 60, 0.7, 0.07 * v); if (a > 0.25) { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} view.shake = Math.max(view.shake || 0, 0.25 * a); } return; }
        if (surf === 'water') { noise(c, t, 0.22, 'bandpass', 1900, 500, 1.4, 0.05 * v); return; }
        if (surf === 'in') { tone(c, t, 0.07, 'triangle', 210, 120, 0.025 * v); noise(c, t, 0.06, 'bandpass', 2600, 1400, 1.2, 0.02 * v); return; }
        tone(c, t, 0.09, 'sine', 95, 55, 0.05 * v); noise(c, t, 0.08, 'lowpass', 1100, 300, 0.8, 0.035 * v); },
      wings(open) { const c = init(); if (!c || !ok('wing', 250)) return; const t = c.currentTime; noise(c, t, 0.55, 'bandpass', open ? 500 : 2200, open ? 2400 : 450, 1.6, 0.05); try { SFX.servo(t + 0.02, 0.35, open, 0.012); SFX.servo(t + 0.18, 0.3, open, 0.009); } catch (e) {} },
      land(h) { const c = init(); if (!c || !ok('land', 200)) return; const t = c.currentTime, v = Math.min(1, 0.4 + h / 30); tone(c, t, 0.18, 'sine', 120, 45, 0.07 * v); noise(c, t, 0.15, 'lowpass', 900, 200, 0.8, 0.05 * v); },
      splash(s) { const c = init(); if (!c || !ok('spl', 300)) return; const t = c.currentTime, v = Math.min(1, 0.4 + (s || 0) / 40); noise(c, t, 0.6, 'bandpass', 2400, 420, 0.9, 0.07 * v); noise(c, t + 0.05, 0.35, 'highpass', 3500, 1800, 0.7, 0.02 * v); },
      kick(pos, s) { const c = init(); if (!c || !ok('kick', 90)) return; const a = att(pos, 160); if (a < 0.03) return; const t = c.currentTime, v = a * Math.min(1, 0.3 + s / 30); tone(c, t, 0.14, 'sine', 170, 70, 0.08 * v); noise(c, t, 0.04, 'bandpass', 2600, 1800, 1.5, 0.04 * v); },
      bounce(pos, s) { const c = init(); if (!c) return; const a = att(pos, 120); if (a < 0.05 || !ok('bnc' + Math.round(pos.x), 120)) return; const t = c.currentTime, v = a * Math.min(1, s / 25); tone(c, t, 0.1, 'sine', 140, 80, 0.05 * v); },
      bump(pos, s) { const c = init(); if (!c) return; const a = att(pos, 140); if (a < 0.04 || !ok('bmp', 160)) return; const t = c.currentTime, v = a * Math.min(1, s || 0.7); tone(c, t, 0.12, 'square', 320 + Math.random() * 80, 120, 0.018 * v); noise(c, t, 0.1, 'bandpass', 1800, 700, 2.5, 0.05 * v); try { SFX.clack(t + 0.02); } catch (e) {} },
      pop() { const c = init(); if (!c || !ok('pop', 300)) return; const t = c.currentTime; tone(c, t, 0.12, 'sine', 300, 900, 0.05); noise(c, t + 0.1, 0.5, 'lowpass', 2400, 300, 0.7, 0.08); tone(c, t + 0.1, 0.25, 'sine', 120, 50, 0.07); },
      whiz() { const c = init(); if (!c) return; const t = c.currentTime; noise(c, t, 0.8, 'bandpass', 600, 2600, 3, 0.035); },
      cheer() { const c = init(); if (!c || !ok('cheer', 1500)) return; const t = c.currentTime; for (let i = 0; i < 5; i++) noise(c, t + i * 0.12, 1.4, 'bandpass', 900 + Math.random() * 900, 700 + Math.random() * 500, 1.2, 0.03); tone(c, t, 0.6, 'triangle', 660, 990, 0.012); },
      foot(o, ph, act, pos, surf, big) { if (act !== 'walk' && act !== 'run') { o.__si = null; return; } const w = ph * (act === 'run' ? 10 : 6), i = Math.floor(w / Math.PI + 0.5); if (o.__si == null) { o.__si = i; return; } if (i !== o.__si) { o.__si = i; P.step(pos, surf, big); } },
      tick(dt) { if (!ROAMS.on) { P.s = null; return; } const s = P.s || (P.s = { fly: ROAMS.fly, wet: ROAMS.wet, air: ROAMS.air, top: 0 });
        if (ROAMS.fly !== s.fly) P.wings(!!ROAMS.fly); if (ROAMS.wet && !s.wet && !ROAMS.fly) P.splash(Math.abs(ROAMS.vy || 0));
        if (ROAMS.air) s.top = Math.max(s.top, ROAMS.h || 0); else if (s.air && !ROAMS.fly) { if (s.top - (ROAMS.h || 0) > 1.5) P.land(s.top - (ROAMS.h || 0)); s.top = 0; } if (!ROAMS.air) s.top = ROAMS.h || 0;
        if (!ROAMS.fly && (ROAMS.stkN || 0) === 3 && s.stk !== 3) P.bump(ROAMS.p, 0.35); s.stk = ROAMS.stkN || 0; s.fly = ROAMS.fly; s.wet = ROAMS.wet; s.air = ROAMS.air; } };
    return P; })(); window.__GS = GS;
  const SPEEDL = (() => { const N = 46; const tc = Y2K.cnv(32, 256), q = tc.getContext('2d'); { const im = q.createImageData(32, 256); for (let y = 0; y < 256; y++) { const u = y / 255, tap = Math.pow(Math.sin(Math.PI * u), 1.6) * (0.55 + 0.45 * Math.sin(u * 23.0 + Math.sin(u * 7.0) * 2.0)); for (let x = 0; x < 32; x++) { const v = (x - 15.5) / 15.5, a = Math.max(0, 1 - v * v) * tap * (0.75 + Math.random() * 0.25); const o = (y * 32 + x) * 4; im.data[o] = 230; im.data[o + 1] = 244; im.data[o + 2] = 255; im.data[o + 3] = Math.round(255 * a); } } q.putImageData(im, 0, 0); } const tex = new THREE.CanvasTexture(tc);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }); const L = new THREE.InstancedMesh(geo, mat, N); L.frustumCulled = false; L.renderOrder = 5; cam.add(L); if (!cam.parent) S.scene.add(cam);
    const D = []; for (let i = 0; i < N; i++) { const a = Math.random() * TAU; D.push({ a, r: 9 + Math.random() * 26, z: -Math.random() * 140, w: 0.12 + Math.random() * 0.3, s: 0.7 + Math.random() * 0.6 }); } const O = new THREE.Object3D(); let op = 0;
    return { tick(dt) { const sp = (window.ATM_OUT && ROAMS.on && ROAMS.fly) ? (ROAMS.spd || 0) : 0, k = Math.min(1, Math.max(0, (sp - 300) / 1400)); op += (0.16 * k - op) * Math.min(1, dt * 2.5); mat.opacity = op; L.visible = op > 0.004; if (!L.visible) return; const len = 6 + 34 * k; for (let i = 0; i < N; i++) { const d = D[i]; d.z += dt * (50 + sp * 0.1) * d.s; d.a += dt * 0.05; if (d.z - len > 2) { d.z = -140 - Math.random() * 30; d.a = Math.random() * TAU; d.r = 9 + Math.random() * 26; } O.position.set(Math.cos(d.a) * d.r, Math.sin(d.a) * d.r * 0.7, d.z - len / 2); O.rotation.set(0, 0, d.a + Math.PI / 2); O.scale.set(d.w, 1, len * d.s); O.updateMatrix(); L.setMatrixAt(i, O.matrix); } L.instanceMatrix.needsUpdate = true; } }; })();
  // ===== FESTIVAL: escenarios por las islas, cada uno con su estilo (trap, house, drum&bass, synthwave, lo-fi); DJ robot, bailarines y su música en 3D =====
  const FEST = (() => { const ST = [['TRAP', -420, 120, 140, 0xff2fb0, [1, 0, 0, 0, 0, 0, 1, 0], [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1], 36], ['HOUSE', 300, 420, 124, 0x5fe0ff, [1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], 41], ['DRUM & BASS', -360, -380, 174, 0xb6ff3b, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 38], ['SYNTHWAVE', 160, -560, 100, 0xff9a1f, [1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], 45], ['LO-FI', -560, -800, 80, 0xc9b6ff, [1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0], 43]]; let B = null;
    const loop = (c, bpm, kp, hp, root) => { const sr = c.sampleRate, st = 60 / bpm / 4, n = Math.floor(sr * st * 16), bf = c.createBuffer(1, n, sr), d = bf.getChannelData(0); const add = (t0, f) => { const i0 = Math.floor(t0 * sr); for (let i = 0; i < sr * 0.4 && i0 + i < n; i++) d[i0 + i] += f(i / sr); };
      for (let k = 0; k < 16; k++) { const t0 = k * st; if (kp[k % kp.length]) add(t0, (x) => Math.sin(2 * Math.PI * (45 + 100 * Math.exp(-x * 28)) * x) * Math.exp(-x * 8) * 0.6); if (hp[k]) add(t0, (x) => (Math.random() * 2 - 1) * Math.exp(-x * 70) * 0.12); if (k === 4 || k === 12) add(t0, (x) => (Math.random() * 2 - 1) * Math.exp(-x * 18) * 0.22); const bn = [0, 0, 3, 0, 5, 0, 3, 7][k % 8], f = 440 * Math.pow(2, (root + bn - 69) / 12); if (k % 2 === 0) add(t0, (x) => Math.tanh(2.2 * Math.sin(2 * Math.PI * f * x)) * Math.exp(-x * 5) * 0.22); if (k % 4 === 2) add(t0, (x) => Math.sin(2 * Math.PI * f * 4 * x) * Math.exp(-x * 7) * 0.08); }
      let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= m * 1.4; return bf; };
    const build = () => { B = []; ST.forEach(([nm, x, z, bpm, col, kp, hp, root], si) => { const GY = ({ TRAP: 0.88, HOUSE: -0.56, 'DRUM & BASS': 2.32 })[nm]; const y0 = GY == null ? -9 : GY; const g = new THREE.Group(); g.position.set(x, y0, z); S.scene.add(g); const M = new THREE.MeshPhysicalMaterial({ color: 0x20242e, metalness: 0.7, roughness: 0.3, clearcoat: 1 }); const deck = new THREE.Mesh(new THREE.CylinderGeometry(16, 17, 0.8, 40), M); deck.position.y = 0.2; g.add(deck); const scrC = Y2K.cnv(512, 256), q = scrC.getContext('2d'), stx = new THREE.CanvasTexture(scrC); const scr = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshBasicMaterial({ map: stx, toneMapped: false })); scr.position.set(0, 12, -12); g.add(scr); const booth = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 3), new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.8, roughness: 0.2, emissive: col, emissiveIntensity: 0.4 })); booth.position.set(0, 2.1, -5); g.add(booth); const beams = []; for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); b.geometry.translate(0, -30, 0); b.position.set(-12 + k * 8, 20, -12); g.add(b); beams.push(b); }
        const bots = []; [[0, -6, 'play'], [-8, 6, 'dance'], [8, 6, 'dance'], [0, 10, 'cheer']].forEach(([bx, bz, act], j) => { try { const r0 = ROBOT.build(MUTANTS.list[(si * 5 + j * 3 + 2) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar(8.5 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; w.position.set(bx, 0.6, bz); w.rotation.y = j === 0 ? 0 : Math.PI + (bx * 0.03); g.add(w); bots.push({ r0, act }); } catch (e) {} });
        (window.__OBSTX = window.__OBSTX || []).push({ x0: x - 5, x1: x + 5, z0: z - 7, z1: z - 3, y1: y0 + 3.6 });
        B.push({ nm, g, q, stx, scr, beams, bots, col, bpm, kp, hp, root, src: null, gain: null, pan: null }); }); };
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on; if (!B) { if (!out) return; build(); } let near = null, nd = 1e9; B.forEach((s, i) => { s.g.visible = out; if (!out) return; const d = Math.hypot(ROAMS.p.x - s.g.position.x, ROAMS.p.z - s.g.position.z); if (d < nd) { nd = d; near = s; } if (d > 700 && (Math.floor(t * 10) + i) % 6) return; const beat = (t * s.bpm / 60) % 1; s.beams.forEach((b, k) => { b.rotation.z = Math.sin(t * 1.3 + k) * 0.5; b.rotation.x = Math.cos(t * 0.9 + k) * 0.3; b.material.opacity = 0.08 + 0.12 * Math.pow(1 - beat, 3); }); if (d < 500) { const q = s.q; q.fillStyle = '#05060f'; q.fillRect(0, 0, 512, 256); for (let k = 0; k < 24; k++) { const h = (0.2 + 0.8 * Math.abs(Math.sin(t * 3 + k * 0.7))) * (1 - beat * 0.5) * 180; q.fillStyle = '#' + s.col.toString(16).padStart(6, '0'); q.fillRect(10 + k * 21, 236 - h, 16, h); } q.fillStyle = '#fff'; q.font = '900 48px Orbitron, Arial'; q.textAlign = 'center'; q.fillText(s.vs ? '⚔ ' + (s.alt || s).nm : s.nm, 256, 60); if (s.vs) { q.font = '700 22px Orbitron, Arial'; q.fillText('BATALLA · ' + s.nm + ' vs ' + s.vs, 256, 96); } s.stx.needsUpdate = true; s.bots.forEach((b) => b.r0.update(3.7, dt, { act: b.act, ph: t * 2, mood: 'happy', beatPhase: t * s.bpm / 60 })); } });
      // sonido: solo el escenario más cercano suena, en 3D y sin tapar la radio
      try { if (!audioOk() || !UA.ctx) return; const c = UA.ctx; B.forEach((s) => { const want = out && s === near && nd < 420 && !(window.__WRADIO && window.__WRADIO.st && window.__WRADIO.st.on) && !(RADIO.st && RADIO.st.on); /* nunca dos canciones a la vez */ if (s.src && s.playing !== (s.alt || s).nm) { try { s.src.stop(); } catch (e) {} s.src = s.gain = s.pan = null; } if (want && !s.src) { const src = c.createBufferSource(); { const P0 = s.alt || s; s.bufs = s.bufs || {}; src.buffer = s.bufs[P0.nm] || (s.bufs[P0.nm] = loop(c, P0.bpm, P0.kp, P0.hp, P0.root)); s.playing = P0.nm; } src.loop = true; const pn = c.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 30; pn.maxDistance = 600; const gn = c.createGain(); gn.gain.value = 0; src.connect(pn).connect(gn).connect(UA.bus.master); src.start(); s.src = src; s.pan = pn; s.gain = gn; } if (s.gain) { const gp = s.g.position; if (s.pan.positionX) { s.pan.positionX.value = gp.x; s.pan.positionY.value = 2; s.pan.positionZ.value = gp.z; } const radioOn = (window.__WRADIO && window.__WRADIO.on) ? 0.5 : 1; s.gain.gain.value += ((want ? 0.5 * radioOn : 0) - s.gain.gain.value) * Math.min(1, dt * 2); if (!want && s.gain.gain.value < 0.005) { try { s.src.stop(); } catch (e) {} s.src = s.gain = s.pan = null; } } }); if (near && nd < 60 && !near.told) { near.told = 1; say('🎪 Escenario ' + near.nm + ' · come dance!'); } } catch (e) {} }, get stages() { return B; } }; })();
  // ===== BATALLAS DE DJS: cada 8 min un escenario del festival se enfrenta a otro estilo durante 3 min. Va por reloj, así que en una sala online todos viven la misma batalla =====
  const BATTLE = (() => { const SL = 480000, DUR = 180000; let ui = null, lastSlot = -1, endTold = -1;
    const mk = () => { ui = document.createElement('div'); ui.id = 'djBattle'; ui.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 58px);z-index:44;display:none;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:linear-gradient(180deg,rgba(40,10,70,.88),rgba(12,4,30,.92));border:1.5px solid #ff7ad9;color:#fff;font:700 12px Orbitron,Arial;box-shadow:0 6px 24px rgba(255,47,176,.35);max-width:94vw;white-space:nowrap;pointer-events:none'; ui.innerHTML = '<span id="djbT"></span><button data-v="0"></button><button data-v="1"></button>'; ui.querySelectorAll('button').forEach((b) => { b.style.cssText = 'pointer-events:auto;border:2px solid #fff;border-radius:999px;padding:5px 10px;background:linear-gradient(#ff7ad9,#c21a8a);color:#fff;font:inherit;cursor:pointer;display:none'; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.onclick = (e) => { e.stopPropagation(); vote(+b.dataset.v); }; }); document.body.appendChild(ui); };
    let cur = null;
    const vote = (v) => { if (!cur) return; const k = 'unfire_bt_' + cur.slot; try { if (localStorage.getItem(k)) { say('🗳️ You have already voted in this battle.'); return; } localStorage.setItem(k, String(v)); } catch (e) {} const nm = v ? cur.b.nm : cur.a.nm; try { GS.cheer(); } catch (e) {} say('🗳️ You voted for ' + nm + '! The crowd cheers with you.'); try { window.__REWARD && window.__REWARD('Batalla de DJs: votaste por ' + nm); } catch (e) {} };
    return { tick() { const S0 = FEST.stages; const out = !!window.ATM_OUT && ROAMS.on && S0 && S0.length === 5; if (!ui) mk(); if (!out) { ui.style.display = 'none'; if (S0) S0.forEach((s) => { s.alt = null; s.vs = null; }); return; }
        const now = Date.now(), slot = Math.floor(now / SL), into = now % SL, ai = slot % 5; let bi = (slot * 3 + 1) % 5; if (bi === ai) bi = (ai + 1) % 5; const a = S0[ai], b = S0[bi], act = into < DUR;
        S0.forEach((s) => { if (s !== a) { s.alt = null; s.vs = null; } }); cur = act ? { slot, a, b } : null;
        const btns = ui.querySelectorAll('button'), T = ui.querySelector('#djbT');
        if (act) { const bar = 4 * 60000 / a.bpm, turn = Math.floor(into / (bar * 8)) % 2; a.alt = turn ? b : null; a.vs = b.nm; const d = Math.hypot(ROAMS.p.x - a.g.position.x, ROAMS.p.z - a.g.position.z), left = Math.ceil((DUR - into) / 1000); let voted = false; try { voted = !!localStorage.getItem('unfire_bt_' + slot); } catch (e) {} T.textContent = '⚔️ ' + a.nm + ' vs ' + b.nm + (d > 120 ? ' · stage ' + a.nm + ' a ' + Math.round(d) + ' m' : ' · playing ' + (turn ? b.nm : a.nm)) + ' · ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); btns[0].textContent = '🔥 ' + a.nm; btns[1].textContent = '🔥 ' + b.nm; btns.forEach((x) => (x.style.display = d <= 120 && !voted ? 'inline-block' : 'none')); ui.style.display = 'flex'; if (lastSlot !== slot) { lastSlot = slot; say('⚔️ DJ battle on stage ' + a.nm + '! ' + a.nm + ' versus ' + b.nm + '. Come and vote.'); } }
        else { a.alt = null; a.vs = null; if (endTold !== slot && lastSlot === slot) { endTold = slot; let v = null; try { v = localStorage.getItem('unfire_bt_' + slot); } catch (e) {} say(v != null ? '🏁 Battle over: winner ' + (v === '1' ? b.nm : a.nm) + ' con tu voto!' : '🏁 DJ battle over. The next one starts soon.'); } const nx = SL - into; if (nx < 60000) { const n2 = slot + 1, a2 = S0[n2 % 5]; let b2 = (n2 * 3 + 1) % 5; if (b2 === n2 % 5) b2 = (n2 % 5 + 1) % 5; T.textContent = '⏰ En ' + Math.ceil(nx / 1000) + ' s: batalla ' + a2.nm + ' vs ' + S0[b2].nm; btns.forEach((x) => (x.style.display = 'none')); ui.style.display = 'flex'; } else ui.style.display = 'none'; } } }; })();
  // ===== CÁPSULA DE BOLSILLO: el maletín sale de una cápsula (lanzamiento, ¡POP!, humo) =====
  window.__CAPSULE_POP = () => { try { const from = (window.__NIMBO && window.__NIMBO.pos) ? window.__NIMBO.pos.clone() : cam.position.clone(); const to = new THREE.Vector3(); caseG.getWorldPosition(to); to.y += 0.6; const cap = new THREE.Group(); const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xff2a4a, roughness: 0.2, clearcoat: 1 })); const bot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xf4f6fb, roughness: 0.25, clearcoat: 1 })); const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 8, 28), new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: 0.8, roughness: 0.3 })); band.rotation.x = Math.PI / 2; const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), new THREE.MeshBasicMaterial({ color: 0xffd21a })); btn.rotation.z = Math.PI / 2; btn.position.x = 0.33; cap.add(top, bot, band, btn); cap.scale.setScalar(Math.max(0.6, from.distanceTo(to) * 0.05)); cap.position.copy(from); S.scene.add(cap); try { GS.whiz(); } catch (e) {}
      const sc0 = caseG.scale.x || 1; const t0 = performance.now(); const pt = (() => { const c = Y2K.cnv(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(); let puffs = null;
      const step = () => { const u = (performance.now() - t0) / 900; if (u < 1) { const p = from.clone().lerp(to, u); p.y += Math.sin(u * Math.PI) * Math.max(2, from.distanceTo(to) * 0.35); cap.position.copy(p); cap.rotation.x += 0.35; cap.rotation.z += 0.2; requestAnimationFrame(step); return; }
        if (!puffs) { S.scene.remove(cap); try { GS.pop(); } catch (e) {} puffs = []; const r0 = Math.max(1.2, cap.scale.x * 2.2); for (let i = 0; i < 22; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false, opacity: 0.9, color: i % 4 ? 0xffffff : 0xff9ad8 })); sp.position.copy(to); sp.userData.v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(r0 * (1 + Math.random())); sp.scale.setScalar(r0 * 0.6); S.scene.add(sp); puffs.push(sp); } }
        const w = Math.min(1, (u - 1) / 1.1); puffs.forEach((sp) => { sp.position.addScaledVector(sp.userData.v, 0.016 * (1 - w)); sp.scale.multiplyScalar(1.025); sp.material.opacity = 0.9 * (1 - w); }); const e = Math.min(1, (u - 1) / 0.6); caseG.scale.setScalar(sc0 * (e < 1 ? 0.55 + 0.45 * (1 - Math.cos(e * Math.PI * 2.5) * Math.exp(-e * 4) * 0.6) : 1)); if (w < 1) requestAnimationFrame(step); else { puffs.forEach((sp) => { S.scene.remove(sp); sp.material.dispose(); }); pt.dispose(); caseG.scale.setScalar(sc0); } };
      requestAnimationFrame(step); } catch (e) { console.warn('capsule', e); } };
  // ===== PREMIO FINAL: al terminar la historia =====
  window.__PRIZE = () => { try { if (document.getElementById('ufPrize')) return; let nm = ''; try { nm = (JSON.parse(localStorage.getItem('unfire_save_v1') || '{}').name) || ''; } catch (e) {} try { localStorage.setItem('unfire_unlock', '99'); localStorage.setItem('unfire_story_prize', String(Date.now())); } catch (e) {} try { GS.cheer(); } catch (e) {}
      try { if (ROAMS.av && ROAMS.av.w && window.__tintAvatar) window.__tintAvatar(ROAMS.av.w, '#ffd21a'); } catch (e) {}
      const dip = () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1600, 1000); gr.addColorStop(0, '#0d1a4a'); gr.addColorStop(1, '#3a0d4a'); g.fillStyle = gr; g.fillRect(0, 0, 1600, 1000); g.strokeStyle = '#ffd21a'; g.lineWidth = 14; g.strokeRect(40, 40, 1520, 920); g.fillStyle = '#ffd21a'; g.textAlign = 'center'; g.font = '900 64px Orbitron, Arial'; g.fillText('UNFIRE AUDIO', 800, 190); g.fillStyle = '#fff'; g.font = '700 42px Arial'; g.fillText('Diploma de Guardián del Segundo Perdido', 800, 300); g.font = '900 88px Arial'; g.fillText(nm || 'Jugador/a', 800, 470); g.font = '500 34px Arial'; g.fillText('ha completado la historia y devuelto el tiempo al maletín.', 800, 580); g.fillText('Todos los robots desbloqueados · Piel dorada', 800, 640); g.font = '500 28px Arial'; g.fillText(new Date().toLocaleDateString(), 800, 820); g.fillText('unfire.technology/audio', 800, 870); const a = document.createElement('a'); a.download = 'unfire-diploma.png'; a.href = c.toDataURL('image/png'); a.click(); };
      const d = document.createElement('div'); d.id = 'ufPrize'; d.style.cssText = 'position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(3,4,18,.72)'; d.innerHTML = '<div style="width:min(520px,92vw);background:linear-gradient(160deg,#0d1a4a,#3a0d4a);border:2px solid #ffd21a;border-radius:24px;padding:22px;color:#fff;font:500 15px/1.45 system-ui;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)"><div style="font-size:54px">🏆</div><h2 style="font:900 20px Orbitron,Arial;color:#ffd21a;margin:6px 0 10px">YOU RECOVERED THE LOST SECOND!</h2><p>Your reward for completing the story:</p><p style="text-align:left;margin:8px auto;max-width:400px">✅ <b>All 20 robots</b> permanently unlocked, including online play<br>✨ <b>Golden skin</b> for your robot<br>📜 <b>Certificate</b> with your name</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px"><button id="ufpD">📜 DOWNLOAD CERTIFICATE</button><button id="ufpH">🎹 EXPLORE HYPERWAVE</button><button id="ufpX">KEEP PLAYING</button></div></div>';
      d.querySelectorAll('button').forEach((b) => { b.style.cssText = 'border:2px solid #fff;border-radius:999px;padding:9px 14px;background:linear-gradient(#ffd21a,#ff8a00);color:#1a0d00;font:800 12px Orbitron,Arial;cursor:pointer'; b.addEventListener('pointerdown', (e) => e.stopPropagation()); }); d.addEventListener('pointerdown', (e) => e.stopPropagation()); document.body.appendChild(d);
      d.querySelector('#ufpD').onclick = dip; d.querySelector('#ufpH').onclick = () => { try { (window.top || window).open('/audio/hyperwave/', '_blank', 'noopener'); } catch (e) {} }; d.querySelector('#ufpX').onclick = () => d.remove(); } catch (e) { console.warn('prize', e); } };
  window.ONLINE_ON = () => ONLINE.on;
  // análisis por bandas del audio que suena (bajo, batería por transitorios, sintes/agudos) para la reacción audiovisual
  const BANDS = window.__BANDS = { b: 0, d: 0, s: 0, an: null, fd: null, pm: 0, tick() { try { if (!this.an) { if (!UA.ctx || !UA.bus || !UA.bus.master) return; this.an = UA.ctx.createAnalyser(); this.an.fftSize = 512; this.an.smoothingTimeConstant = 0.6; UA.bus.master.connect(this.an); this.fd = new Uint8Array(this.an.frequencyBinCount); } this.an.getByteFrequencyData(this.fd); const f = this.fd, avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += f[i]; return s / (b - a) / 255; }; const lo = avg(1, 6), mid = avg(8, 40), hi = avg(40, 140); const fl = Math.max(0, mid - this.pm); this.pm = mid; this.b += (lo - this.b) * 0.3; this.d = Math.max(this.d * 0.86, Math.min(1, fl * 6)); this.s += (hi * 1.6 - this.s) * 0.2; } catch (e) {} } };
  // la música baja sola cuando vuelves a la web (o cambias de pestaña) y vuelve al entrar al maletín
  { const duck = (on) => { try { const g = UA.bus.master.gain, n = UA.ctx.currentTime; if (on && !window.__ducked) { window.__mVol = g.value; window.__ducked = true; g.cancelScheduledValues(n); g.setTargetAtTime(0.0001, n, 0.25); } else if (!on && window.__ducked) { window.__ducked = false; g.cancelScheduledValues(n); g.setTargetAtTime(window.__mVol || 1, n, 0.35); } } catch (e) {} }; addEventListener('message', (e) => { const m = e.data || {}; if (m.unfireDuck != null) duck(!!m.unfireDuck); }); document.addEventListener('visibilitychange', () => duck(document.hidden)); window.__duck = duck; addEventListener('pointerdown', () => { if (window.__ducked && !document.hidden) duck(false); }, true); setTimeout(() => { const ex = window.__exitGame; if (typeof ex === 'function') window.__exitGame = function () { duck(true); return ex.apply(this, arguments); }; }, 0); }
  const OUTTALK = (() => { let G = null; const NAMES = ['VOLTIO', 'CASETE', 'PIXEL', 'DISQUETE', 'NEÓN', 'BÚHO-FM', 'TAMBOR', 'ECO'];
    function build() { G = []; [[80, 0], [180, 3], [-120, 6], [5, 9], [-55, 12]].map(([deg, k0]) => { const a = deg * Math.PI / 180; return [Math.cos(a) * 214, Math.sin(a) * 214, k0, a]; }).forEach(([x, z, k0, a0], gi) => { const grp = { pos: V(x, -9, z), a0, bots: [], t: 2 + gi * 3, who: 0, bub: null }; for (let j = 0; j < 2; j++) { try { const r0 = ROBOT.build(MUTANTS.list[(k0 + j) % MUTANTS.list.length]); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar(8.5 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; w.position.set(x + (j ? 4.5 : -4.5), -9, z); w.rotation.y = j ? -H2 : H2; S.scene.add(w); grp.bots.push({ w, r0, name: NAMES[(gi * 2 + j) % NAMES.length], talk: 0 }); } catch (e) {} }
        const c = document.createElement('canvas'); c.width = 512; c.height = 160; const tx = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false })); sp.scale.set(16, 5, 1); sp.visible = false; S.scene.add(sp); grp.bub = { c, tx, sp }; G.push(grp); }); }
    function bubble(grp, name, text) { text = window.T ? window.T(text) : text; const { c, tx, sp } = grp.bub, g = c.getContext('2d'); g.clearRect(0, 0, 512, 160); g.fillStyle = 'rgba(255,255,255,.94)'; g.strokeStyle = '#3d8bff'; g.lineWidth = 5; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 504, 136, 26) : g.rect(4, 4, 504, 136); g.fill(); g.stroke(); g.fillStyle = '#ff2fb0'; g.font = '800 22px Orbitron, Arial'; g.fillText(name, 22, 34); g.fillStyle = '#0a1a3a'; g.font = '600 21px Arial'; const words = text.split(' '); let line = '', y = 66; for (const w0 of words) { if (g.measureText(line + w0).width > 470) { g.fillText(line, 22, y); line = ''; y += 26; if (y > 130) break; } line += w0 + ' '; } if (y <= 130) g.fillText(line, 22, y); tx.needsUpdate = true; sp.visible = true; }
    return { tick(dt, t) { const out = !!window.ATM_OUT && ROAMS.on; if (!G) { if (!out || Math.hypot(ROAMS.p.x, ROAMS.p.z) < 170) return; build(); } G.forEach((grp, gi) => { const aa = grp.a0 + Math.sin(t * 0.025 + gi * 1.7) * 0.16; const ox = grp.pos.x, oz = grp.pos.z; grp.pos.set(Math.cos(aa) * 214, -9, Math.sin(aa) * 214); const gmv = Math.hypot(grp.pos.x - ox, grp.pos.z - oz); grp.bots.forEach((b, j) => { b.w.visible = out; { const ta = aa + (j ? 0.022 : -0.022); const tx = Math.cos(ta) * 214, tz = Math.sin(ta) * 214; b.w.position.x = tx; b.w.position.z = tz; b.wd = (b.wd || 0) + gmv; b.w.rotation.y = gmv > 0.002 && b.talk <= 0 ? Math.atan2(grp.pos.x - ox, grp.pos.z - oz) : Math.atan2(grp.pos.x - tx, grp.pos.z - tz); } const fy = Math.sin(t * 0.66 + gi * 1.31 + j * 1.91) * 0.35; b.w.position.y += (-9 + fy - b.w.position.y) * Math.min(1, dt * 2); if (out) { const dx = ROAMS.p.x - b.w.position.x, dz = ROAMS.p.z - b.w.position.z, dd = Math.hypot(dx, dz); if (dd < 3.6 && dd > 0.01 && (ROAMS.h || 0) < 8) { ROAMS.p.x += dx / dd * (3.6 - dd); ROAMS.p.z += dz / dd * (3.6 - dd); } } b.talk = Math.max(0, b.talk - dt); if (b.w.position.distanceToSquared(cam.position) < 160000 || b.talk > 0) { try { GS.foot(b, b.wd / (0.87 * 8.5) * 1.047, grp.fight > 0 || !(gmv / Math.max(dt, 1e-3) > 0.3) ? null : 'walk', b.w.position, 'out'); if (grp.fight > 0 && Math.random() < dt * 2.5) GS.bump(b.w.position, 0.6); } catch (e) {} b.r0.update(3.7, dt, { act: grp.fight > 0 ? 'fight' : b.talk > 0 ? 'talk' : gmv / Math.max(dt, 1e-3) > 0.3 ? 'walk' : 'look', ph: gmv / Math.max(dt, 1e-3) > 0.3 ? b.wd / (0.87 * 8.5) * 1.047 : t, mood: 'happy', talk: b.talk > 0 }); } }); grp.bub.sp.visible = out && grp.bub.sp.visible; if (!out) return;
        grp.fight = Math.max(0, (grp.fight || 0) - dt); if (!grp.fight && Math.random() < dt * 0.01) { grp.fight = 4; const FL = ['That was MY screw!', 'Take back what you said about Auto-Tune!', 'Vinyl sounds better. End of story!', 'You stepped on my cable!', 'My bass goes lower than yours!']; try { bubble(grp, grp.bots[0].name, FL[Math.floor(Math.random() * FL.length)]); grp.bub.sp.position.set(grp.bots[0].w.position.x, grp.bots[0].w.position.y + 13, grp.bots[0].w.position.z); } catch (e) {} } const d = Math.hypot(ROAMS.p.x - grp.pos.x, ROAMS.p.z - grp.pos.z); grp.t -= dt; if (grp.t > 0) return; const near = d < 32; const b = grp.bots[grp.who % grp.bots.length]; grp.who++; let text = window.__GENLINE ? window.__GENLINE(b.name) : '...'; if (Math.random() < 0.45) { const WL = ['Have you seen Haiku Island? Cherry blossoms, a pagoda and a snowy peak. They say the koi dance to the bass.','There are real waves out at sea. Grab a board in the SURF ZONE and press SPACE to pull off tricks.','My surf record: a FLIP with a ×3 combo. Think you can beat it?','From the sky, the world goes on forever: dream islands, dunes and gardens stretching to the horizon.','The house columns are cassette reels. Watch closely: something changes when you pass behind one.','The Atlantis pyramid has been restored, with real stone, a grand staircase and a temple on top.','The giant plugins in the sky grow like cells, unfolding a little at a time.','They say cinema mode (V) lets you record game-style videos. I have already made one.','At sunset, the sea turns golden and Haiku Island smells of cherry blossoms.','The horizon is endless, but only true flyers can reach the edge of the map.']; text = WL[Math.floor(Math.random() * WL.length)]; } if (near && !SIDE.cur && !ROAMS.freeRobotMode && Math.random() < 0.3) { const ms = SIDE.offer(b.name); if (ms) text = 'Hey, you! Could you do me a favor? ' + ms + '. I will be waiting!'; } else if (near && Math.random() < 0.6) { const nm = (STORY && STORY.save && STORY.save.name) || 'traveler'; text = ['Hey, ' + nm + '! ', 'Look who is here: ' + nm + '. ', nm + ', we were just talking about you. ', 'Hello, ' + nm + '! '][Math.floor(Math.random() * 4)] + text; } b.talk = Math.min(7, 1.5 + text.length * 0.05); grp.t = b.talk + 1.2 + (near ? 0.5 : 4 + Math.random() * 6); const bp = b.w.position; grp.bub.sp.position.set(bp.x, bp.y + 13, bp.z); if (d < 120) bubble(grp, b.name, text);
        if (near && window.speechSynthesis && !speechSynthesis.speaking) { try { const u = new SpeechSynthesisUtterance(text); const VR = window.__voiceFor ? window.__voiceFor(b.name) : null; if (VR && VR.v) { u.voice = VR.v; u.lang = VR.v.lang; u.pitch = VR.pitch; u.rate = VR.rate; } else u.lang = 'es-ES'; speechSynthesis.speak(u); } catch (e) {} } }); }, get list() { return G || []; } }; })();
  // A read-only world snapshot for the optional, local conversation UI.
  // No extra Three.js renderer, textures, NPC meshes, or frame-loop listeners.
  window.__UNFIRE_DIALOGUE_WORLD = () => {
    const npcs = [], seen = new Set(), player = {
      x:ROAMS.p.x, y:-8.9+(ROAMS.h||0)+2, z:ROAMS.p.z
    };
    const add = (id,name,mesh,radius,giant=false) => {
      if(!mesh || !mesh.position || mesh.visible===false || seen.has(id))return;
      seen.add(id);
      npcs.push({id, name:String(name||'ROBOT').slice(0,32),
        x:mesh.position.x, y:mesh.position.y, z:mesh.position.z,
        radius,giant});
    };
    const FR=window.__FRIENDS||[];
    FR.forEach((b,i)=>add('friend-'+(b.name||i),b.name,b.w,19));
    // Mutants already physically present on the case/table use world coordinates,
    // so Story players can speak with them without entering Cinema mode.
    const caseBots=bots();
    caseBots.forEach((b,i)=>{
      if(!b.W||!b.W.getWorldPosition||b.W.visible===false)return;
      const p=b.W.getWorldPosition(V(0,0,0));
      add('case-'+(b.name||i),b.name||('ROBOT '+(i+1)),{position:p,visible:true},ROAMS.mini?5:9);
    });
    const grow=GROW.list||[];
    grow.forEach((b,i)=>add('grow-'+(b.w&&b.w.uuid||i),b.name||('ROBOT '+(i+1)),b.w,14));
    const sky=SKYBOTS.list||[];
    sky.forEach((b,i)=>add('sky-'+i,b.name||('ROBOT DEL CIELO '+(i+1)),b.w,42));
    const surf=SURFBOTS.list||[];
    surf.forEach((b,i)=>add('surf-'+i,b.name||('ROBOT SURFISTA '+(i+1)),b.w,36));
    const titans=TITANS.list||[];
    ['ECLIPSE','ASTRALIA','CRONOS'].forEach((name,i)=>{
      if(titans[i])add('titan-'+i,name,titans[i].w,475,true);
    });
    (window.__OUTGIANTS||[]).forEach((g,i)=>add(i?'titan-island-roamer':'titan-island','BALUARTE',g.w,23,true));
    const walkers=OUTTALK.list||[];
    walkers.forEach((g,i)=>(g.bots||[]).forEach((b,j)=>add('out-'+i+'-'+j,b.name,b.w,24)));
    if(HOST && HOST.visible && HOST.pos && ROAMS.on && !window.ATM_OUT)
      npcs.push({id:'nimbo',name:'NIMBO',x:HOST.pos.x,y:HOST.pos.y,z:HOST.pos.z,radius:22,giant:false});
    return {roaming:!!ROAMS.on && !(window.__VIEW && window.__VIEW.on),
      player,npcs,online:ONLINE.on,myName:ONLINE.myName,
      sendChat:(message)=>ONLINE.sendChat(message)};
  };
  // ===== MAPA: dónde estás y dónde está la misión (mesa en modo robot, casa o isla) =====
  const MAP = (() => { const c = document.createElement('canvas'); c.id = 'minimap'; c.width = c.height = 220; c.style.cssText = 'position:fixed;left:14px;top:62px;z-index:41;width:180px;height:180px;border-radius:50%;border:3px solid #9fd0ff;box-shadow:0 8px 24px rgba(0,20,80,.45);display:none;background:#06102e'; document.body.appendChild(c); const g = c.getContext('2d'); let on = true, tt = 0;
    // This canvas stays the lightweight circular HUD. The expanded map is a lazy 2D dialog.
    const expanded = window.UnfireExpandedMap ? window.UnfireExpandedMap.create(() => ({
      zone: window.ATM_OUT ? 'island' : 'house',
      x: ROAMS.p.x, z: ROAMS.p.z, yaw: ROAMS.yaw,
      objective: (STORY && STORY.obj) || (window.ATM_OUT && SIDE.cur ? { x:SIDE.cur.x, z:SIDE.cur.z, mini:false } : null)
    }), () => { for (const k in ROAMS.k) ROAMS.k[k] = 0; }) : null;
    c.tabIndex = 0; c.setAttribute('role','button');
    c.setAttribute('aria-label','Open expanded map');
    c.title = 'Open expanded map';
    c.addEventListener('pointerdown', e => e.stopPropagation());
    c.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (ROAMS.on && expanded) { expanded.show(); hap(0.2); } });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (ROAMS.on && expanded) expanded.show(); } });
    return { get expandedOpen() { return !!(expanded && expanded.isOpen); }, toggle() { if (ROAMS.on && expanded) { expanded.toggle(); hap(0.2); } }, tick() {
      if (expanded) {
        if (!ROAMS.on && expanded.isOpen) expanded.hide();
        if (expanded.isOpen) for (const k in ROAMS.k) ROAMS.k[k] = 0;
        expanded.tick();
      }
      c.style.display = on && ROAMS.on && !(window.__VIEW && window.__VIEW.on) ? 'block' : 'none'; if (!on || !ROAMS.on) return; tt++; if (tt % 3) return; const mini = false, out = !!window.ATM_OUT; const S0 = out ? 220 / 1500 : 220 / 190, cx = out ? ROAMS.p.x : 0, cz = out ? ROAMS.p.z : 40; const P = (x, z) => [110 + (x - cx) * S0, 110 + (z - cz) * S0];
      g.clearRect(0, 0, 220, 220); g.save(); g.beginPath(); g.arc(110, 110, 108, 0, Math.PI * 2); g.clip(); const bg = g.createRadialGradient(110, 110, 10, 110, 110, 120); bg.addColorStop(0, '#12306e'); bg.addColorStop(1, '#050a20'); g.fillStyle = bg; g.fillRect(0, 0, 220, 220);
      g.strokeStyle = 'rgba(160,220,255,.7)'; g.lineWidth = 2; const rect = (x0, z0, x1, z1, f) => { const [a, b] = P(x0, z0), [c2, d] = P(x1, z1); if (f) { g.fillStyle = f; g.fillRect(a, b, c2 - a, d - b); } g.strokeRect(a, b, c2 - a, d - b); };
      if (mini) { rect(-13, -7.45, 13, 5.05, 'rgba(217,185,138,.35)'); rect(-2.9, -1.95, 2.9, 1.95, 'rgba(180,190,210,.6)'); } else if (out) { g.fillStyle = 'rgba(63,207,90,.35)'; const [a, b] = P(0, 0); g.beginPath(); g.arc(a, b, 270 * S0, 0, Math.PI * 2); g.fill(); rect(-80, -16, 80, 96, 'rgba(220,240,255,.5)'); [[600, 0, 340, 'rgba(230,225,215,.55)'], [80, -500, 190, 'rgba(232,201,138,.6)'], [-760, -760, 250, 'rgba(255,190,215,.6)'], [-420, 120, 70, 'rgba(160,230,110,.5)'], [300, 420, 60, 'rgba(255,255,255,.5)'], [-360, -380, 80, 'rgba(192,139,255,.5)']].forEach(([x, z, r, c]) => { const [a2, b2] = P(x, z); g.fillStyle = c; g.beginPath(); g.arc(a2, b2, r * S0, 0, Math.PI * 2); g.fill(); }); } else { rect(-80, -16, 80, 96, 'rgba(220,240,255,.12)'); rect(-13, -7.5, 13, 5, 'rgba(217,185,138,.5)'); [[44, 8, '#ff2a4a'], [38, 44, '#3d8bff'], [-38, 40, '#2a3c8a'], [-8, 92, '#c0c0c0'], [-48, 56, '#f4f1ea'], [48, 56, '#f4f1ea']].forEach(([x, z, col]) => { const [a, b] = P(x, z); g.fillStyle = col; g.beginPath(); g.arc(a, b, 4, 0, Math.PI * 2); g.fill(); }); }
      const ob = (STORY && STORY.obj) || (out && SIDE.cur ? { x: SIDE.cur.x, z: SIDE.cur.z } : null); if (ob && (!!ob.mini === mini || !mini)) { const [a, b] = P(ob.x, ob.z), pul = 6 + Math.sin(performance.now() / 200) * 2; g.fillStyle = '#ffd21a'; g.beginPath(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? pul * 0.45 : pul; g.lineTo(a + Math.cos(an) * r, b + Math.sin(an) * r); } g.fill(); }
      const [px, pz] = ROAMS.on ? P(cam.position.x, cam.position.z) : P(0, 6); g.save(); g.translate(px, pz); g.rotate(ROAMS.on ? ROAMS.yaw : Math.PI); g.fillStyle = '#b6ff3b'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.fill(); g.restore(); g.restore(); g.fillStyle = '#fff'; g.font = '700 12px Orbitron, Arial'; g.textAlign = 'center'; g.fillText(mini ? 'THE TABLE' : out ? 'THE ISLAND' : 'THE HOUSE', 110, 24); } }; })();
  addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') return; if (e.key === 'm' || e.key === 'M') MAP.toggle(); if ((e.key === 'c' || e.key === 'C') && ROAMS.on) camB.onclick({ stopPropagation() {} }); });
  // ===== SALIR A LA WEB: cierra el juego, cierra el maletín y baja a la página normal =====
  { const xb = document.createElement('button'); xb.id='unfireExitGame'; xb.textContent = '⏏ EXIT TO WEBSITE'; xb.style.cssText = 'position:fixed;right:14px;top:14px;z-index:70;display:none;border:2px solid #fff;border-radius:999px;padding:8px 14px;font:800 12px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#ff6a7a,#c4122e);box-shadow:0 6px 18px #0008;cursor:pointer'; document.body.appendChild(xb); xb.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    window.__exitGame = () => { try { if (window.__VIEW) window.__VIEW.stop(); } catch (e) {} try { exitRoam(); } catch (e) {} try { if (window.ATM_OUT) ATM.setOut(false); } catch (e) {} view.gd = view.D0; view.gx = 0; view.gz = 0.15; hap(0.5); parentPost({ exitGame: 1 }); };
    xb.onclick = (e) => { e.stopPropagation(); window.__exitGame(); }; setInterval(() => { xb.style.display = (window.__immS || lidControlledByPlayer || ROAMS.on) && !(window.__VIEW && window.__VIEW.on) && parent !== window ? 'block' : 'none'; }, 300); }
  // ===== CÓMO SE JUEGA (primera vez) + CONTROLES TÁCTILES para móvil y tablet =====
  { const TOUCH = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } })();
    const help = document.createElement('div'); help.id = 'howto'; help.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:80;max-width:min(92vw,520px);padding:18px 22px;border-radius:20px;background:rgba(6,16,46,.88);border:2px solid #5fc8ff;color:#fff;font:600 14px/1.55 Arial,sans-serif;box-shadow:0 20px 60px #000a;display:none;text-align:left';
    help.innerHTML = TOUCH ? '<b style="font:900 18px Orbitron,Arial;color:#5fc8ff">HOW TO PLAY</b><br>🕹️ Left joystick: move<br>👆 Drag the screen: look around<br>🪽 Hold FLY to rise · release to hover · ⬇ DOWN to descend<br>💬 TALK: speak with the nearest robot<br>⏏ Top-right: return to the website<br><br><span style="color:#b6ff3b">Tap to start</span>' : '<b style="font:900 18px Orbitron,Arial;color:#5fc8ff">HOW TO PLAY</b><br>⌨️ W A S D or arrow keys: move (Shift to run)<br>🖱️ Drag the mouse: look around<br>🪽 Hold SPACE to fly and rise · release to hover · S or ↓ to descend<br>💬 T: talk to the nearest robot · M: map · C: camera<br>🚪 Use the blue door to reach the island · ⏏ top-right: return to the website<br><br><span style="color:#b6ff3b">Click to start</span>';
    document.body.appendChild(help); help.addEventListener('pointerdown', (e) => { e.stopPropagation(); help.style.display = 'none'; }, true);
    let shown = false; setInterval(() => { if (ROAMS.on && !shown) { shown = true; let seen = false; try { seen = !!localStorage.getItem('unfire_howto'); localStorage.setItem('unfire_howto', '1'); } catch (e) {} if (!seen) { help.style.display = 'block'; setTimeout(() => (help.style.display = 'none'), 12000); } } }, 500);
    if (TOUCH) { const pad = document.createElement('div'); pad.id='unfireTouchPad'; pad.style.cssText = 'position:fixed;left:18px;bottom:18px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.5);z-index:70;display:none;touch-action:none'; const knob = document.createElement('div'); knob.id='unfireTouchKnob'; knob.style.cssText = 'position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(95,200,255,.85);box-shadow:0 4px 14px #0008'; pad.appendChild(knob); document.body.appendChild(pad);
      const btn = (txt, css) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = 'position:fixed;z-index:70;display:none;border:2px solid #fff;border-radius:999px;padding:14px 18px;font:900 14px Orbitron,Arial;color:#fff;background:linear-gradient(180deg,#5fb0ff,#1d4fd8);box-shadow:0 6px 18px #0008;touch-action:none;' + css; document.body.appendChild(b); return b; };
      const fly = btn('🪽 FLY', 'right:18px;bottom:24px'), talk = btn('💬 TALK', 'right:18px;bottom:90px'), down = btn('⬇ DOWN', 'right:150px;bottom:24px'); fly.id='unfireFly'; talk.id='unfireTalk'; down.id='unfireDown'; down.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); ROAMS.k.s = 1; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => down.addEventListener(ev, () => { ROAMS.k.s = 0; }));
      let pid = null, cx = 0, cy = 0; const setK = (dx, dy) => { const K = ROAMS.k, d = 0.3; K.w = dy < -d ? 1 : 0; K.s = dy > d ? 1 : 0; K.a = dx < -d ? 1 : 0; K.d = dx > d ? 1 : 0; const center = (pad.clientWidth - knob.offsetWidth) / 2, radius = Math.max(1, pad.clientWidth * .30); knob.style.left = center + dx * radius + 'px'; knob.style.top = center + dy * radius + 'px'; };
      pad.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (pid !== null) return; pid = e.pointerId; const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; pad.setPointerCapture(pid); applyPointer(e); });
      const applyPointer = (e) => { let dx = (e.clientX - cx) / Math.max(1, pad.clientWidth * .42), dy = (e.clientY - cy) / Math.max(1, pad.clientHeight * .42); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } setK(dx, dy); };
      pad.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; e.stopPropagation(); applyPointer(e); });
      const up = (e) => { if (e.pointerId !== pid) return; pid = null; try { pad.releasePointerCapture(e.pointerId); } catch (_) {} setK(0, 0); }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); const resetTouch = () => { pid=null; setK(0,0); ROAMS.k[' '] = 0; }; addEventListener('blur',resetTouch); addEventListener('orientationchange',resetTouch); document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTouch();});
      fly.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (ROAMS.board && ROAMS.wet && !ROAMS.fly && window.ATM_OUT) { dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); return; } if (!ROAMS.fly) { ROAMS.fly = true; ROAMS.climbV = 0; ROAMS.flyT = 0; } ROAMS.k[' '] = 1; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => fly.addEventListener(ev, () => { ROAMS.k[' '] = 0; }));
      talk.addEventListener('pointerdown', (e) => { e.stopPropagation(); const c = document.getElementById('chat'); c.classList.add('on'); const i = document.getElementById('chatq'); i.placeholder = 'Talk to the nearest robot… (Enter)'; setTimeout(() => i.focus(), 30); });
      setInterval(() => { const on = ROAMS.on && !(window.__VIEW && window.__VIEW.on); [pad, fly, talk].forEach((el) => (el.style.display = on ? 'block' : 'none')); down.style.display = on && ROAMS.fly ? 'block' : 'none'; if (on && pid === null) { const c = Math.max(0, (pad.clientWidth - knob.offsetWidth) / 2); knob.style.left = c + 'px'; knob.style.top = c + 'px'; } }, 300); } }
  // ===== MODO VISTA: videoclip automático por la casa (y fuera), cortes al ritmo, tomas que no se repiten =====
  const VIEW = (() => { let on = false, shot = null, T = 0, dur = 6, bag = [], flash = 0, lastLv = 0, beatT = 0; const FL = -8.9;
    const SHOTS = {
      caseOrbit: () => { const r = 7 + Math.random() * 3, h = 2 + Math.random() * 2.5, d = Math.random() < 0.5 ? 1 : -1, a0 = Math.random() * TAU; return (u) => ({ p: V(Math.cos(a0 + d * u * 1.2) * r, h - u * 0.8, Math.sin(a0 + d * u * 1.2) * r + 1), l: V(0, 0.8, 0) }); },
      deskSlide: () => { const d = Math.random() < 0.5 ? 1 : -1; return (u) => ({ p: V(d * (-11 + u * 22), 0.9, 7.5), l: V(d * (-6 + u * 12) * 0.5, 0.5, 0) }); },
      robotsLow: () => { const P = [V(52, FL, 74), V(-52, FL, 80), V(58, FL, 46)]; const G = window.__GROW && window.__GROW.list; const c = (G && G.length ? G[Math.floor(Math.random() * G.length)].w.position.clone() : P[Math.floor(Math.random() * 3)]); const a0 = Math.random() * TAU; return (u) => ({ p: V(c.x + Math.cos(a0 + u * 0.9) * 20, FL + 2.5 + u * 3, c.z + Math.sin(a0 + u * 0.9) * 20), l: V(c.x, FL + 8, c.z) }); },
      vitrina: () => (u) => ({ p: V(-57 + Math.sin(u * 2) * 3, FL + 9, 62 + u * 20), l: V(-57, FL + 10, 96) }),
      posters: () => { const d = Math.random() < 0.5; return (u) => ({ p: V(d ? -45 : 45, 5, 6 + u * 70), l: V(d ? -80 : 80, 6, 10 + u * 70) }); },
      gacha: () => (u) => ({ p: V(44 + 14 - u * 4, FL + 4 + u * 10, 8 + 16 - u * 6), l: V(44, FL + 8, 10) }),
      sky: () => { const a0 = Math.random() * TAU; return (u) => ({ p: V(0, 4, 40), l: V(Math.cos(a0 + u * 0.6) * 30, 60, 40 + Math.sin(a0 + u * 0.6) * 30) }); },
      window: () => (u) => ({ p: V(-40 + u * 12, 3, 24), l: V(-80, 6, 24) }),
      screen: () => (u) => ({ p: V(-8 + u * 16, 4 + u * 2, 22 - u * 6), l: V(2, 15, -16) }),
      crane: () => (u) => ({ p: V(Math.sin(u) * 20, 30 - u * 8, 92 - u * 20), l: V(0, -4, 20) }),
      outside: () => (u) => ({ p: V(-30, 2 + u * 30, 100 + u * 70), l: V(-30 + u * 40, 2 + u * 5, 40) }),
      island: () => { const a0 = Math.random() * TAU; return (u) => ({ p: V(Math.cos(a0 + u * 0.5) * 300, 70 + u * 20, 40 + Math.sin(a0 + u * 0.5) * 300), l: V(0, 0, 40) }); },
    };
    const K = Object.keys(SHOTS);
    function next() { if (!bag.length) { bag = K.slice().sort(() => Math.random() - 0.5); } const k = bag.pop(); shot = SHOTS[k](); T = 0; const beat = 60 / ((RADIO.st.on && RADIO.bpm) || 122); dur = beat * 4 * (Math.random() < 0.5 ? 2 : 3); flash = 0.25; }
    const fl = document.createElement('div'); fl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:59;background:#fff;opacity:0;transition:opacity .25s'; document.body.appendChild(fl);
    function start() { if (on) return; on = true; if (!ROAMS.on) enterRoam(); ROAMS.mini = false; document.body.classList.add('vistaOn'); next(); say('🎬 VIEW MODE · tap or press Esc to exit'); try { const W = window.__WRADIO; if (W && !W.on && !RADIO.st.on) { W.st.idle = 99; W.toggle(); } } catch (e) {} }
    function stop() { if (!on) return; on = false; document.body.classList.remove('vistaOn'); ROAMS.p.set(0, 4.5, 30); ROAMS.yaw = 0; ROAMS.pitch = -0.1; }
    const st = document.createElement('style'); st.textContent = 'body.vistaOn #wradio,body.vistaOn #storyHud,body.vistaOn button{opacity:0!important;pointer-events:none!important}'; document.head.appendChild(st);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && on) stop(); if ((e.key === 'v' || e.key === 'V') && e.target.tagName !== 'INPUT' && lidOpen > 0.95) { on ? stop() : start(); } });
    addEventListener('pointerdown', () => { if (on) stop(); }, true);
    const api = { get on() { return on; }, toggle() { on ? stop() : start(); }, start, stop,
      apply(dt) { if (!on || !shot) return; T += dt; const lv = window.__LVL || 0; beatT -= dt; if (lv - lastLv > 0.18 && T > dur * 0.6 && beatT <= 0) { beatT = 1; next(); } lastLv = lv * 0.9 + lastLv * 0.1; if (T >= dur) next(); const u = Math.min(1, T / dur), e = u * u * (3 - 2 * u); const s = shot(e); cam.position.copy(s.p); cam.lookAt(s.l); cam.near = 0.1; cam.fov += (54 - cam.fov) * 0.1; cam.updateProjectionMatrix(); fl.style.opacity = flash > 0 ? String(flash * 1.6) : '0'; flash = Math.max(0, flash - dt * 2); window.__roam = true; } };
    window.__VIEW = api; return api; })();
  let STORY = null; try { STORY = window.STORY_INIT({ say, isHyperwaveOpen: () => !!(HW && (HW.T || 0) > 3), duck: (v) => { A.duck = v; }, buy: () => parentPost({ buy: 'todo' }), showHost: (v) => HOST.show(v), cinema: () => {},
    getExplore: () => ({ x:ROAMS.p.x,z:ROAMS.p.z,h:ROAMS.h||0,walking:!!ROAMS.on,outside:!!window.ATM_OUT }),
    navigateTo: (quest) => {
      // Optional help, never destroys quest progress or rewrites player save.
      if(!ROAMS.on)enterRoam();
      if(!window.ATM_OUT)ATM.setOut(true);
      NANO_CINEMA.cancel();ROAMS.mini=false;ROAMS.cp=null;
      if(quest.ev==='outside'){ROAMS.p.set(-30,4.5,110);ROAMS.h=4;}
      else{
        ROAMS.p.set(quest.x+Math.min(35,(quest.r||125)*0.4),4.5,quest.z);
        ROAMS.h=Math.max(5,(quest.h||0)+8);
      }
      ROAMS.fly=ROAMS.h>18;ROAMS.vy=0;
      say('🧭 Nimbo: Almost there! Follow the star on the map.');
    },
    robotMode: () => { if (!ROAMS.on) enterRoam(); if (CASE_VIEW.on) showRobotView();
      if (NANO_CINEMA.busy()) return true;
      const futureMini = !ROAMS.mini;
      if (!futureMini) {
        const obstacles = window.ATM_OUT ? (window.__OBSTO || window.__buildObstOut()) : (window.__OBST || window.__buildObst());
        const candidate = NANO_PHYSICS.safeMorphPosition({ x: ROAMS.p.x, z: ROAMS.p.z }, NANO_PHYSICS.profile(false), obstacles, { footY: -8.9 + (ROAMS.h || 0), prePadding: window.ATM_OUT ? 0 : 1.1 });
        if (!candidate.safe) { say('⚠️ There is not enough room to return to normal size. Move away or fly to an open area.'); return true; }
        ROAMS.p.x = candidate.x; ROAMS.p.z = candidate.z;
      }
      ROAMS.freeRobotMode = true;
      // Nano must be a VISIBLE controllable robot, not an invisible first-person
      // camera or a free-film spectator. Keep ordinary camera choice untouched
      // until the user actually selects NANO from the story HUD.
      if (futureMini) {
        if (REC.on) REC.set(false);
        ROAMS.mode = '3p';
        camB.textContent = '🎥 VIEW: 3RD PERSON (C)';
      }
      const animated = futureMini && NANO_CINEMA.start();
      if (!animated) ROAMS.mini = futureMini;
      ROAMS.cp = null; ROAMS.ep = null; ROAMS.tgt = null; ROAMS.cy = ROAMS.yaw; ROAMS.k = {}; ROAMS.touchStick = null; ROAMS.flyH = ROAMS.h || 0; ROAMS.climbV = 0; ROAMS.vy = 0;
      say(futureMini ? '🔬 NANO ROBOT · capsule deploying from the chest · same robot at miniature scale' : '🧍 NORMAL SIZE · same position and controls'); return futureMini; }, isNano: () => !!ROAMS.mini, toggleMap: () => MAP.toggle(),
    focusHost: (who, soft) => { HOST.talk(); if (soft) { if (who !== 'NIMBO') { const B = bots(); if (B.length) { const it = B[(who.charCodeAt(0) + who.length) % B.length]; try { cn(it).talk = true; setTimeout(() => { if (it.cn) it.cn.talk = false; }, 3000); } catch (e) {} } } return; } let p = HOST.pos; if (who !== 'NIMBO') { const B = bots(); if (B.length) { const it = B[(who.charCodeAt(0) + who.length) % B.length]; p = it.W.getWorldPosition(V(0, 0, 0)); try { cn(it).talk = true; setTimeout(() => { if (it.cn) it.cn.talk = false; }, 3000); } catch (e) {} } } if (ROAMS.on) { const d = V(cam.position.x - p.x, 0, cam.position.z - p.z); if (d.lengthSq() < 0.01) d.set(0, 0, 1); d.normalize(); const side = V(-d.z, 0, d.x); const q = V(p.x + d.x * 11 + side.x * 7, p.y + 5.5, p.z + d.z * 11 + side.z * 7); const lx = p.x - q.x, lz = p.z - q.z; ROAMS.tgt = { p: q, yaw: Math.atan2(lx, -lz), pitch: Math.atan2(p.y + 1.5 - q.y, Math.hypot(lx, lz)) }; } else { view.gx = clamp(p.x * 0.7, -CW / 2 - 1, CW / 2 + 1); view.gz = clamp(p.z * 0.7, -CD / 2 - 1, CD / 2 + 2); view.gd = view.D0 * 0.85; } } }); } catch (e) { console.warn('story', e); }
  roamB.addEventListener('pointerdown', (e) => e.stopPropagation());
  // Same playable world for full-size and NANO robots, with scale-aware
  // capsule collision and microsteps. No collision bypass after stuck frames.
  function roamMove(f, side = 0) {
    const yaw = ROAMS.yaw, px0 = ROAMS.p.x, pz0 = ROAMS.p.z;
    const dx = Math.sin(yaw) * f + Math.cos(yaw) * side;
    const dz = -Math.cos(yaw) * f + Math.sin(yaw) * side;
    const P = avatarProfile();
    const boxes = window.ATM_OUT
      ? (window.__OBSTO || (window.__OBSTO = window.__buildObstOut()))
      : (window.__OBST || (window.__OBST = window.__buildObst()));
    const candidates = COLLISION(boxes, px0, pz0, Math.hypot(dx, dz) + P.radius + 1.2);
    const footY = -8.9 + (ROAMS.h || 0);
    // At high flight speeds, testing 80 microsteps against obstacles far below
    // the robot wastes frames. Preserve swept collision against every obstacle
    // whose vertical volume can actually intersect the capsule.
    const relevant = candidates.filter((b) => !b || !Number.isFinite(b.y1) ||
      (footY < b.y1 && (!Number.isFinite(b.y0) || footY + P.height > b.y0)));
    const moved = relevant.length
      ? NANO_PHYSICS.move2D({ x: px0, z: pz0 }, { x: dx, z: dz }, relevant, P,
        { footY, prePadding: window.ATM_OUT ? 0 : 1.1 })
      : { x: px0 + dx, z: pz0 + dz, blocked: false };
    ROAMS.p.x = moved.x; ROAMS.p.z = moved.z;
    ROAMS.stkN = moved.blocked ? Math.min((ROAMS.stkN || 0) + 1, 100) : 0;
    if (window.ATM_OUT) {
      const insideHouse = Math.abs(ROAMS.p.x) < 82 && ROAMS.p.z > -18 && ROAMS.p.z < 98;
      if (insideHouse && -8.9 + (ROAMS.h || 0) < 26.6) {
        if (Math.abs(ROAMS.p.x + 30) < 4.5 && ROAMS.p.z > 90) {
          if (ROAMS.p.z < 93) ATM.setOut(false);
        } else { ROAMS.p.x = px0; ROAMS.p.z = pz0; }
      }
    }
    // The interior rectangular safety rim is *only* a house boundary. Applying
    // it outside rubber-bands every flight gear (most visibly x3/x8) to a tiny
    // x/z rectangle, preventing smooth exploration of remote islands.
    // Outdoor motion still goes through swept obstacle collisions above.
    const rim = P.radius;
    if (!window.ATM_OUT) {
      const bound = window.__RB || { x: 77.5, z0: -14, z1: 93.5 };
      ROAMS.p.x = clamp(ROAMS.p.x, -bound.x + rim, bound.x - rim);
      const inDoorCorridor = !window.ATM_OUT && Math.abs(ROAMS.p.x + 30) < 5 && ROAMS.p.z > 88;
      ROAMS.p.z = clamp(ROAMS.p.z, bound.z0 + rim, bound.z1 + (inDoorCorridor ? 5 : -rim));
      if (!window.ATM_OUT && Math.abs(ROAMS.p.x + 30) < 5 && ROAMS.p.z > 93) ATM.setOut(true);
    }
    const hx = ROAMS.p.x, hz = ROAMS.p.z - 1, hd = Math.hypot(hx, hz);
    // The exhibit in the house remains solid for all sizes, but a tiny robot
    // may get closer to it than the full-size avatar.
    const exhibitRadius = 7.1 + rim;
    if (!window.ATM_OUT && !ROAMS.mini && hd < exhibitRadius) {
      const k = exhibitRadius / Math.max(hd, 0.01);
      ROAMS.p.x = hx * k; ROAMS.p.z = hz * k + 1;
    }
  }
  addEventListener('keydown', (e) => { if (!ROAMS.on || (e.target && e.target.tagName === 'INPUT')) return; if (e.key === 'Escape') { if (CASE_VIEW.on) showRobotView(); else exitRoam(); return; } if (CASE_VIEW.on) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k === 'Shift' || k === 'Alt') ROAMS.k[k] = 1; if (k === 'b' && !e.repeat && window.ATM_OUT) { window.__surfToggle && window.__surfToggle(); e.preventDefault(); e.stopImmediatePropagation(); return; } if (k === ' ' && !e.repeat && window.ATM_OUT && ROAMS.wet && !ROAMS.fly && ROAMS.board) { ROAMS.spDown = performance.now(); ROAMS.k[' '] = 1; if (!ROAMS.air && !ROAMS.trick) { const wv0 = window.__WAVE ? window.__WAVE(ROAMS.p.x, ROAMS.p.z, window.__T || 0) : 0; { const jv = Math.min(66, 30 + Math.max(0, wv0) * 3.4); ROAMS.vy = ROAMS.mini ? jv / 30 * avatarProfile().gravity * 0.575 : jv; } /* NANO: salto a su escala, tiempo de vuelo para completar el truco */ try { window.__SPRAY && window.__SPRAY(ROAMS.p.x, -8.9 + (ROAMS.h || 0), ROAMS.p.z, 40, 8, 14); } catch (e2) {} /* surf: los trucos van cambiando (bolsa barajada, nunca el mismo dos veces seguidas) */ const TL = { '360': 0.9, '720': 1.15, BACKFLIP: 1.0, FRONTFLIP: 1.0, TAILWHIP: 0.85, CORKSCREW: 1.2, SUPERMAN: 1.0, GRAB: 0.8 }; let bag = window.__TRICKBAG; if (!bag || !bag.length) { bag = Object.keys(TL); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } if (bag[bag.length - 1] === window.__TRICKLAST) bag.unshift(bag.pop()); window.__TRICKBAG = bag; } const kk = bag.pop(); window.__TRICKLAST = kk; ROAMS.trick = { t: 0, k: kk, d: TL[kk], sd: Math.random() < 0.5 ? 1 : -1 }; { let g0 = 110; try { g0 = avatarProfile().gravity || 110; } catch (e5) {} ROAMS.trick.d = Math.min(TL[kk], Math.max(0.5, 0.86 * 2 * ROAMS.vy / g0)); } } e.preventDefault(); e.stopImmediatePropagation(); return; } if (k === ' ' && !e.repeat) { const now = performance.now(); if (!ROAMS.fly) { ROAMS.fly = true; ROAMS.climbV = 0; ROAMS.flyT = 0; say('🪽 Transformation · HOLD SPACE to rise · release to hover · S o ↓ para bajar · F en picado · W hacia delante'); } ROAMS.lastSp = now; ROAMS.k[' '] = 1; } if (k === 'f') ROAMS.k.f = 1; if (k.startsWith('Arrow') || 'wasdqe'.includes(k) || k === ' ') { ROAMS.k[k] = 1; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  addEventListener('keyup', (e) => { ROAMS.k[e.key.length === 1 ? e.key.toLowerCase() : e.key] = 0; });
  addEventListener('blur', () => { for (const k in ROAMS.k) ROAMS.k[k] = 0; });
  function fitD0() { const vf = (cam.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * cam.aspect); view.D0 = Math.max((CW / 2 + 0.5) / Math.tan(hf), (CD / 2 + 1.3) / Math.tan(vf)) * 1.02; if (view.gd > view.D0 || view.gd === view.dist && view.dist >= view.D0 - 0.01) { view.gd = view.D0; } }
  // Combine the iPhone device budget with rotation-safe backbuffer sizing.
  let renderWidth=0, renderHeight=0, queuedResize=0;
  function resize() {
    const w=Math.max(1,Math.round(document.documentElement.clientWidth || innerWidth));
    const h=Math.max(1,Math.round(innerHeight || document.documentElement.clientHeight));
    const budget=window.__UNFIRE_AUTOCALIB;
    if(budget&&S.renderer.getPixelRatio()>budget.maxDpr)S.renderer.setPixelRatio(budget.maxDpr);
    if(w===renderWidth&&h===renderHeight)return;
    renderWidth=w;renderHeight=h;
    S.renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
    const wasZoomed=zoomed();fitD0();if(!ROAMS.on&&!CASE_VIEW.on&&!VIEW.on&&!wasZoomed)view.dist=view.gd=view.D0;
    window.__unfireViewport={width:w,height:h,orientation:w>=h?'landscape':'portrait'};
  }
  // A resize must not wait for the next WebGL animation frame. On devices using
  // software rendering, GPU frames can take seconds and starve rotation updates.
  // Coalesce bursts into one ordinary task while keeping renderer sizing exact.
  function queueResize(){
    if(queuedResize)return;
    queuedResize=setTimeout(()=>{queuedResize=0;resize();},0);
  }
  addEventListener('resize',queueResize,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(queueResize,120),{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',queueResize,{passive:true});
  const zoomed = () => view.gd < view.D0 * 0.985;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(V(0, 1, 0), -HB), hitP = V(0, 0, 0);
  function cursorPoint(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); if(CASE_VIEW.on)plane.constant=-caseG.position.y;else plane.constant=-HB;return ray.ray.intersectPlane(plane, hitP) ? hitP.clone() : null; }
  const overCase = (p) => p && Math.abs(p.x-caseG.position.x) < CW / 2 + 0.3 && Math.abs(p.z-caseG.position.z) < CD / 2 + 0.4;
  function zoomBy(f, p) {
    // Keep touch pinch, double-tap and zoom buttons focused on the inspected case.
    if (ROAMS.on && CASE_VIEW.on) { CASE_VIEW.dist=clamp(CASE_VIEW.dist*f,window.ATM_OUT?6.8:5.4,window.ATM_OUT?17:14.5); return; }
    const nd = clamp(view.gd * f, 0.55, view.D0 * 3.2), k = 1 - nd / view.gd;
    if (p && f < 1) { view.gx += (p.x - view.gx) * k; view.gz += (p.z - view.gz) * k; }
    view.gd = nd; if (nd >= view.D0 * 0.999) { view.gx = 0; view.gz = 0.15; } if (f > 1 && nd >= view.D0 * 3.15) enterRoam();
    view.gx = clamp(view.gx, -CW / 2, CW / 2); view.gz = clamp(view.gz, -CD / 2, CD / 2);
  }
  const mouse = { nx: 0, ny: 0, in: false, t: 0, touch: false }; let wheelHold = 0;
  addEventListener('wheel', (e) => { if (CINE.on) CINE.on = false;
    // All roaming modes: wheel/trackpad is never an avatar movement control.
    // Leave native wheel scrolling to overlay menus; contain it on the 3D canvas.
    if (ROAMS.on && !CASE_VIEW.on) {
      if (e.target === cv || e.target === document.body || e.target === document.documentElement) e.preventDefault();
      return;
    }
    const p = cursorPoint(e), k = e.deltaMode ? 30 : 1, dy = e.deltaY * k, dx = e.deltaX * k;
    e.preventDefault();
    if (ROAMS.on && CASE_VIEW.on) { CASE_VIEW.dist=clamp(CASE_VIEW.dist+dy*0.013,window.ATM_OUT?6.8:5.4,window.ATM_OUT?17:14.5);return; }
    if (lidOpen < 0.92) { parentPost({ scroll: dy, pass: 1 }); return; }
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); const over = ray.intersectObject(caseG, true).length > 0;
    if (e.ctrlKey) { zoomBy(Math.exp(dy * 0.012), p); return; }                       // pellizco del touchpad
    if (performance.now() < wheelHold) return;
    if (dy > 0 && over && !allOpen()) { const gh = ray.intersectObjects(gates.flatMap((x) => x.list || [x.g]), true)[0]; const gk = gh && gates.find((x) => { let p = gh.object; while (p) { if (p === x.g || (x.list && x.list.includes(p))) return true; p = p.parent; } return false; });
      if (gk && !compG[gk.k].userData.open) openComp(gk.k); else openAllComp(); wheelHold = performance.now() + 700; return; }
    if (!zoomed()) { if (dy > 0 && over) zoomBy(Math.exp(Math.min(dy, 120) * 0.004), p); else parentPost({ scroll: dy, pass: 1 }); return; }
    if (!over) { view.gd = view.D0; view.gx = 0; view.gz = 0.15; parentPost({ scroll: dy, pass: 1 }); return; }   // fuera del maletín: la página baja normal
    if (Math.abs(dx) > Math.abs(dy) * 1.2) { view.gx = clamp(view.gx + dx * view.dist * 0.0012, -CW / 2, CW / 2); return; }  // touchpad lateral = moverse
    zoomBy(Math.exp(clamp(dy, -120, 120) * 0.004), dy > 0 ? p : null);
    if (dy > 0 && view.gd <= 0.62) { let best = null, bd = 0.35; for (const it of items) { if (!['fx', 'archer', 'synth'].includes(it.kind)) continue; const d = planar(it); if (d < bd) { bd = d; best = it; } }
      if (best && performance.now() - lastEnter > 1800) { lastEnter = performance.now(); parentPost(best.kind === 'fx' ? { open: 'fx', id: best.id } : { open: best.kind }); } }
  }, { passive: false });
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; mouse.nx = (e.clientX / innerWidth) * 2 - 1; mouse.ny = (e.clientY / innerHeight) * 2 - 1; mouse.in = true; mouse.t = performance.now(); });
  document.addEventListener('pointerleave', () => { mouse.in = false; });
  addEventListener('blur', () => { mouse.in = false; });
  let lastEnter = 0;
  // arrastrar = desplazarse; clic = actuar
  let drag = null;
  // Touch taps tolerate natural finger jitter; multi-touch cannot fire an accidental case click.
  const activeTouchPointers = new Set();
  // Prefer the event timestamp: on a loaded mobile GPU, dispatch may be delayed
  // while the user has already released their finger.
  const tapMoment = (e) => Number.isFinite(e.timeStamp) && e.timeStamp > 0 ? e.timeStamp : performance.now();
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      activeTouchPointers.add(e.pointerId);
      // isPrimary belongs to the whole touchscreen: the joystick can own the first finger.
      // Permit the only finger that began on the camera canvas even when it is non-primary.
      // Multiple fingers on the canvas still cancel camera drag (pinch/tap safety).
      if (activeTouchPointers.size !== 1) { drag = null; return; }
    }
    if (CINE.on && e.isTrusted) { CINE.on = false; say('Control manual'); }
    if (MV) { MV.drag = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} return; }
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY,
      gx: view.gx, gz: view.gz, moved: false, id: e.pointerId,
      slop: e.pointerType === 'touch' ? 16 : e.pointerType === 'pen' ? 9 : 4,
      since: tapMoment(e), pan: e.button === 2 || e.shiftKey };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    onDown(e);
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointermove', (e) => { if (MV && MV.drag) { const p = cursorPoint(e); if (p) { MV.o.position.x = clamp(p.x, -CW / 2 + 0.25, CW / 2 - 0.25); MV.o.position.z = clamp(p.z, -CD / 2 + 0.25, CD / 2 - 0.25); } return; } if (knobDrag) { if (knobDrag.hwVol) { HWVOL = clamp(knobDrag.v + (knobDrag.y - e.clientY) / 160); try { if (knobDrag.hwVol.rot) knobDrag.hwVol.rot.rotation.y = -(Math.PI * 0.75 * 2 * (HWVOL - 0.5)); } catch (er) {} HW.lock = { t: performance.now() / 1000, label: '🔊 VOLUMEN', text: Math.round(HWVOL * 100) + ' %', v: 1 }; return; } if (!knobDrag.hw) onKnobMove(e); return; } if (!drag || drag.id !== e.pointerId) { if (e.pointerType === 'mouse') hover(e); return; } const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > drag.slop) drag.moved = true; if (!drag.moved) return;
    if (drag.pan && zoomed() && !CASE_VIEW.on) { const s = view.dist / innerHeight * 1.1, ca = Math.cos(ORB.az), sa = Math.sin(ORB.az), px = -dx * s, pz = -dy * s * 1.2; view.gx = clamp(drag.gx + px * ca + pz * sa, -CW / 2, CW / 2); view.gz = clamp(drag.gz - px * sa + pz * ca, -CD / 2, CD / 2); }
    else if (ROAMS.on && CASE_VIEW.on) { CASE_VIEW.angle-=(e.clientX-drag.lx)*0.006;CASE_VIEW.elevation=clamp(CASE_VIEW.elevation+(e.clientY-drag.ly)*0.003,0.2,1.1); }
    else if (ROAMS.on) { const O = REC.on ? REC : ROAMS; ROAMS.tgt = null; O.yaw += (e.clientX - drag.lx) * (REC.on ? 0.0035 : 0.005); O.pitch = clamp(O.pitch - (e.clientY - drag.ly) * (REC.on ? 0.003 : 0.004), -1.45, 1.45); }
    else { ORB.gaz = clamp(ORB.gaz - (e.clientX - drag.lx) * 0.006, -1.4, 1.4); if (e.pointerType === 'mouse' || zoomed()) ORB.gde = clamp(ORB.gde + (e.clientY - drag.ly) * 0.004, -0.85, 0.5); }
    drag.lx = e.clientX; drag.ly = e.clientY; });
  addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') activeTouchPointers.delete(e.pointerId);
    if (MV && MV.drag) { MV = null; drag = null; $('tb').querySelectorAll('button').forEach((b) => b.classList.remove('on')); endKnob(e); return; }
    // Up must belong to the original pointer, remain within touch slop and not be a long hold.
    if (drag && drag.id === e.pointerId) {
      if (!drag.moved && tapMoment(e) - drag.since <= 1100) onClick(e);
      drag = null;
    }
    endKnob(e);
  });
  addEventListener('pointercancel', (e) => {
    if (e.pointerType === 'touch') activeTouchPointers.delete(e.pointerId);
    if (drag && drag.id === e.pointerId) drag = null;
    endKnob(e);
  });
  // A lost OS focus/rotation must not leave stale touch IDs that block future taps.
  const resetTapPointers = () => { activeTouchPointers.clear(); drag = null; };
  addEventListener('blur', resetTapPointers);
  addEventListener('pagehide', resetTapPointers);
  addEventListener('orientationchange', resetTapPointers);
  // Older touch browsers without Pointer Events still get single-tap interaction.
  if (!('PointerEvent' in window)) {
    let legacyTap = null;
    cv.addEventListener('touchstart', (e) => {
      legacyTap = e.touches.length === 1 ? {
        x: e.touches[0].clientX, y: e.touches[0].clientY, since: tapMoment(e)
      } : null;
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      if (legacyTap && (e.touches.length !== 1 ||
          Math.hypot(e.touches[0].clientX - legacyTap.x, e.touches[0].clientY - legacyTap.y) > 16)) legacyTap = null;
    }, { passive: true });
    cv.addEventListener('touchend', (e) => {
      const tap = legacyTap; legacyTap = null;
      if (tap && e.touches.length === 0 && e.changedTouches.length === 1 &&
          tapMoment(e) - tap.since <= 1100) {
        const t = e.changedTouches[0];
        if (Math.hypot(t.clientX - tap.x, t.clientY - tap.y) <= 16)
          onClick({ clientX: t.clientX, clientY: t.clientY });
      }
    }, { passive: true });
    cv.addEventListener('touchcancel', () => { legacyTap = null; }, { passive: true });
  }
  // pellizco en móvil
  let pinch = null, lastTap = 0;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 2 && lidOpen > 0.9) { const [a, b] = e.touches; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); } }, { passive: true });
  cv.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) { const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); zoomBy(pinch / d, cursorPoint({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 })); pinch = d; } }, { passive: true });
  cv.addEventListener('touchend', (e) => { pinch = null; if (e.changedTouches.length === 1 && lidOpen > 0.9) { const now = performance.now(), tch = e.changedTouches[0]; if (now - lastTap < 300) zoomBy(zoomed() && view.gd < 1.2 ? 9 : 0.45, cursorPoint(tch)); lastTap = now; } });
  $('zin').onclick = () => zoomBy(0.6, V(view.gx, HB, view.gz)); $('zout').onclick = () => zoomBy(1.6, null); $('home').onclick = () => { if (CASE_VIEW.on) CASE_VIEW.on = false; if (REC.on) REC.set(false); exitRoam(); CAPS.cancel(); carryingCase = false; caseG.visible = true; caseG.scale.setScalar(1); caseG.position.copy(originalCasePosition); caseG.rotation.y = 0; updateCarryUI(); view.gd = view.D0; view.gx = 0; view.gz = 0.15; ORB.gaz = ORB.gde = 0; ALL = false; closeAll(); };

  // ---------- cosas activas (se construyen al acercarte) ----------
  let gear = null, robot = null, nearItem = null;
  const _cp = V(0, 0, 0);
  const planar = (it) => Math.hypot(it.pos.x - view.tx, it.pos.z - view.tz);
  const eff = (it) => view.dist + planar(it) * 1.6;
  function nearest(kind) { let best = null, bd = 1e9; for (const it of items) { if (it.kind !== kind) continue; const d = planar(it); if (d < bd) { bd = d; best = it; } } return [best, bd]; }
  // audio de los aparatos (radio + motores reales)
  const kindOf = (s) => (['sampler', 'granular', 'synth'].includes(s.engine) ? 'inst' : s.engine === 'drums' ? 'drums' : 'fx');
  const A = { engine: null, using: false, unsub: null, values: [], keys: [], msg: '', msgT: 0, song: '' };
  function audioOk() { return UA.ctx && UA.ctx.state === 'running'; }
  function ensureEngine(spec) { if (!A.engine) { A.engine = ENGINES.create(spec); const prm = ENGINES.PARAMS[spec.engine]; Object.entries(prm).forEach(([k, v]) => A.engine.set(k, v[2])); A.engine.setMode((spec.family === 'drums' ? spec.groove : spec.family === 'synth' ? spec.synthMode : spec.modes.list[0]).toLowerCase().replace(' curve', '')); } return A.engine; }
  function useOn(spec) { if (!audioOk() || A.using) return; RADIO.start(); const e = ensureEngine(spec), k = kindOf(spec);
    if (k === 'fx') RADIO.route(e.input); if (k === 'drums') { RADIO.muteDrums(true); e.set('tempo', RADIO.bpm); e.start(); } if (k === 'inst') A.unsub = RADIO.onStep((s, t, sd, bar, ch) => { const [lo, hi] = e.range || [48, 84], fit = (m) => { while (m < lo + 12) m += 12; while (m > hi - 6) m -= 12; return m; }; if (s % 4 === 0) e.noteOn(fit(ch[(s / 4) % 4] + 12), 0.6, t, sd * 3.5); });
    A.using = true; }
  function useOff() { if (!A.engine) return; const E = A.engine, dv = UA.bus && UA.bus.dev; A.engine = null; A.using = false; RADIO.route(null); RADIO.muteDrums(false); if (A.unsub) A.unsub(); A.unsub = null; try { if (dv) { const n = UA.ctx.currentTime; dv.gain.cancelScheduledValues(n); dv.gain.setValueAtTime(dv.gain.value, n); dv.gain.linearRampToValueAtTime(0.0001, n + 0.08); } } catch (e) {} setTimeout(() => { try { E.stop && E.stop(); } catch (e) {} try { E.disposeAll(); } catch (e) {} try { if (dv) { const n = UA.ctx.currentTime; dv.gain.setValueAtTime(0.0001, n); dv.gain.linearRampToValueAtTime(0.42, n + 0.15); } } catch (e) {} }, 110); }
  RADIO.onSong((inf) => { A.song = `${inf.name} · ${inf.key} · ${inf.bpm} BPM`; });
  const devCache = new Map(); const open = []; let SEL = null, MV = null, HOV = null;
  function stopAll() { useOff(); try { RADIO.stop(); } catch (e) {} }
  function devFor(it) { const spec = it.spec; let dev = devCache.get(spec.id + (spec.g3 ? 'g3' : '')); if (!dev) { const prm = ENGINES.PARAMS[spec.engine]; dev = (spec.g3 ? GEAR3 : GEAR4).build(spec, kindOf(spec), Object.keys(prm).slice(0, 4).map((k) => k.toUpperCase())); devCache.set(spec.id + (spec.g3 ? 'g3' : ''), dev);
      const close = { type: 'button', id: 'close', cap: null }; const rg = mesh(new THREE.TorusGeometry(2.4, 0.08, 10, 72).rotateX(H2), Y2K.led('#2bd96b', 2.4)); rg.position.y = 0.06; rg.userData.ctl = close;
      const xb = new THREE.Group(); xb.position.set(0, 0.3, 2.4); const red = mesh(new THREE.SphereGeometry(0.36, 24, 16), Y2K.gel('#ff2a3a', { albedo: 0.95 })); red.scale.y = 0.55; xb.add(red);
      for (const a of [0.785, -0.785]) { const bar = mesh(new THREE.BoxGeometry(0.46, 0.08, 0.1), M.ivory); bar.rotation.y = a; bar.position.y = 0.2; xb.add(bar); }
      xb.traverse((o) => { if (o.isMesh) o.userData.ctl = close; }); } return dev; }
  function openGear(it, pin) { hap(0.35); let g = open.find((x) => x.it === it); if (g) { g.closing = false; if (pin) g.pin = true; return g; }
    if (open.filter((x) => !x.closing).length >= 20) { const old = open.find((x) => !x.pin && !x.closing) || open.find((x) => !x.closing); old.closing = true; old.pin = false; }
    const dev = devFor(it); dev.root.scale.setScalar(0.085); dev.root.position.copy(it.tok.position).setY(0.03); compG.caps.add(dev.root); it.tok.visible = false; g = { it, dev, m: 0, manual: 0, pin: !!pin, closing: false, prev: 0 }; open.push(g); return g; }
  function sweep() { for (let i = open.length - 1; i >= 0; i--) { const g = open[i]; if (g.closing && g.m < 0.02) { compG.caps.remove(g.dev.root); g.it.tok.visible = true; open.splice(i, 1); if (A.g === g) { useOff(); A.g = null; } } } }
  function closeAll(now) { open.forEach((g) => { g.closing = true; g.pin = false; if (now) g.m = 0; }); if (now) sweep(); }
  function activate(g) { if (A.g === g) return; useOff(); A.g = g; const spec = g.it.spec, prm = ENGINES.PARAMS[spec.engine]; A.spec = spec; A.keys = Object.keys(prm).slice(0, 4); A.values = A.keys.map((k) => (prm[k][2] - prm[k][0]) / (prm[k][1] - prm[k][0])); if (audioOk()) { RADIO.start(); RADIO.chime(UA.ctx.currentTime + 0.02); } }
  function setRobot(it) {
    if (robot && robot.it === it) return;
    if (robot) { inside.remove(robot.R.root); robot.it.tok.visible = true; robot.hid.forEach((o) => (o.visible = true)); robot = null; }
    if (!it) return;
    const R = ROBOT.build(it.spec); R.root.scale.setScalar(0.07); R.root.position.copy(it.tok.position).setY(0.02); inside.add(R.root); it.tok.visible = false; const hid = []; robot = { it, R, T: 0, hid };
  }

  // ---------- interacción con los controles de los aparatos ----------
  // ===== luces del MEGA: focos de colores girando alrededor del maletín y láseres, al ritmo =====
  const MEGALIT = (() => { const g = new THREE.Group(); S.scene.add(g); const L = [0xff2fb0, 0x3d8bff, 0xb6ff3b, 0xffd21a].map((c) => { const l = new THREE.PointLight(c, 0, 14, 2); g.add(l); return l; }); const LZ = []; for (let i = 0; i < 6; i++) { const geo = new THREE.CylinderGeometry(0.02, 0.02, 30, 6); geo.translate(0, 15, 0); const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g.add(b); LZ.push(b); } let k = 0;
    return { tick(dt, t, lv) { const near = view.gd < view.D0 * 0.8 || (performance.now() - (window.__kLast || 0) < 3000); k += ((MEGA ? (near ? 0.15 : 0.7) : 0) - k) * Math.min(1, dt * 2); g.visible = k > 0.01; if (!g.visible) return; L.forEach((l, i) => { const a = t * (0.8 + i * 0.15) + i * 1.57; l.position.set(Math.cos(a) * 5, 2.5 + Math.sin(t * 1.3 + i) * 1.2, Math.sin(a) * 4); l.intensity = k * (0.6 + lv * 3.2); }); LZ.forEach((b, i) => { b.position.set(i % 2 ? 3.4 : -3.4, 0.2, -1.6 + (i % 3) * 1.6); b.rotation.set(Math.sin(t * 0.9 + i) * 0.7, 0, Math.cos(t * 0.7 + i * 1.7) * 0.7); b.material.color.setHSL((t * 0.1 + i / 6) % 1, 1, 0.55); b.material.opacity = k * (0.08 + lv * 0.35); }); } }; })();
  // ===== CÁMARA: mueve las manos y el sonido cambia (filtros, ecos y efectos; nunca desafina) =====
  const HAND = (() => { let on = false, vid = null, cvs = null, cx = null, prev = null, mx = 0.5, my = 0.5, amt = 0; const btn = document.createElement('button'); btn.id = 'handBtn'; window.__HANDB = btn; btn.textContent = '✋ CAMERA: MOVE YOUR HANDS'; btn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(9vh + 14px);z-index:41;display:none;border:2px solid #fff;border-radius:999px;padding:9px 16px;background:linear-gradient(#ff7ad9,#c21a8a);color:#fff;font:700 13px Orbitron,Arial;cursor:pointer;box-shadow:0 6px 20px rgba(120,0,80,.4)'; document.body.appendChild(btn);
    const pv = document.createElement('canvas'); pv.width = 96; pv.height = 72; pv.style.cssText = 'position:fixed;right:14px;top:62px;z-index:41;width:160px;height:120px;border-radius:14px;border:2px solid #fff;display:none;transform:scaleX(-1);box-shadow:0 6px 20px rgba(0,0,0,.35)'; document.body.appendChild(pv); const pg = pv.getContext('2d');
    btn.addEventListener('pointerdown', (e) => e.stopPropagation()); btn.onclick = async () => { if (on) { stop(); return; } try { const s = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: false }); vid = document.createElement('video'); vid.srcObject = s; vid.muted = true; vid.playsInline = true; await vid.play(); cvs = document.createElement('canvas'); cvs.width = 48; cvs.height = 36; cx = cvs.getContext('2d', { willReadFrequently: true }); on = true; pv.style.display = 'block'; btn.textContent = '✋ CÁMARA ON · toca para apagar'; say('✋ Move your hands: left/right = filter, up/down = echo, fast = special effect'); } catch (e) { say('📷 Camera permission is unavailable on this page. Check permissions in the full app.'); } };
    function stop() { on = false; try { vid.srcObject.getTracks().forEach((t) => t.stop()); } catch (e) {} vid = null; pv.style.display = 'none'; btn.textContent = '✋ CAMERA: MOVE YOUR HANDS'; try { const B = RADIO.buses; B.dlyIn.gain.setTargetAtTime(0.2, UA.ctx.currentTime, 0.4); RADIO.st.handLP = null; } catch (e) {} }
    return { show(v) { btn.style.display = v ? 'block' : 'none'; if (!v && on) stop(); }, tick(dt) { if (!on || !vid || vid.readyState < 2) return; cx.drawImage(vid, 0, 0, 48, 36); const d = cx.getImageData(0, 0, 48, 36).data; let sx = 0, sy = 0, sw = 0; if (prev) { for (let i = 0, p = 0; i < d.length; i += 4, p++) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3, dv = Math.abs(v - prev[p]); if (dv > 28) { const x = p % 48, y = (p / 48) | 0; sx += x * dv; sy += y * dv; sw += dv; } prev[p] = v; } } else { prev = new Float32Array(48 * 36); for (let i = 0, p = 0; i < d.length; i += 4, p++) prev[p] = (d[i] + d[i + 1] + d[i + 2]) / 3; }
      if (sw > 900) { mx += (1 - sx / sw / 48 - mx) * 0.25; my += (sy / sw / 36 - my) * 0.25; } amt += (Math.min(1, sw / 60000) - amt) * 0.15;
      pg.drawImage(vid, 0, 0, 96, 72); pg.fillStyle = 'rgba(255,47,176,.85)'; pg.beginPath(); pg.arc((1 - mx) * 96, my * 72, 5 + amt * 10, 0, Math.PI * 2); pg.fill();
      try { const c = UA.ctx, n = c.currentTime, B = RADIO.buses; if (RADIO.st.lp) RADIO.st.lp.frequency.setTargetAtTime(400 * Math.pow(30, mx), n, 0.08); B.dlyIn.gain.setTargetAtTime(0.1 + (1 - my) * 0.55, n, 0.1); if (amt > 0.45) { XFX.note(60 + Math.round(mx * 24)); } } catch (e) {} } }; })();
  let knobDrag = null; let HWVOL = 0.95; const HWAUTO = { t: 0, k: 1, last: -1 };
  // ===== FX EXPERIMENTALES del HYPERWAVE: se adaptan a cómo tocas (densidad, registro, fuerza) y cambian solos; con MEGA, más locos. Volumen autocalibrado contra la mezcla =====
  const XFX = (() => { let built = false, inp, out, dry, wet, cur = 'clean', nextT = 0, dens = 0, reg = 60, lastN = 0; const N = {};
    function build() { if (built || !audioOk()) return built; const c = UA.ctx; inp = c.createGain(); out = c.createGain(); dry = c.createGain(); wet = c.createGain(); dry.gain.value = 1; wet.gain.value = 0; inp.connect(dry); dry.connect(out); out.connect(UA.bus.master);
      // anillo
      N.ring = c.createGain(); N.ring.gain.value = 0; N.ringO = c.createOscillator(); N.ringO.frequency.value = 220; N.ringO.connect(N.ring.gain); N.ringO.start(); 
      // fase (4 pasa-todo con LFO)
      N.ph = [0, 1, 2, 3].map(() => { const f = c.createBiquadFilter(); f.type = 'allpass'; f.frequency.value = 800; f.Q.value = 0.7; return f; }); N.ph.reduce((a, b) => (a.connect(b), b)); N.phL = c.createOscillator(); N.phL.frequency.value = 0.35; N.phA = c.createGain(); N.phA.gain.value = 600; N.phL.connect(N.phA); N.ph.forEach((f) => N.phA.connect(f.frequency)); N.phL.start();
      // bitcrush
      N.cr = c.createWaveShaper(); { const k = 2048, cv = new Float32Array(k); for (let i = 0; i < k; i++) { const x = i / (k - 1) * 2 - 1; cv[i] = Math.round(x * 7) / 7; } N.cr.curve = cv; }
      // eco dub
      N.dl = c.createDelay(2); N.dlF = c.createGain(); N.dlF.gain.value = 0.55; N.dlLP = c.createBiquadFilter(); N.dlLP.type = 'bandpass'; N.dlLP.frequency.value = 1400; N.dlLP.Q.value = 0.9; N.dl.connect(N.dlLP); N.dlLP.connect(N.dlF); N.dlF.connect(N.dl);
      // barrido resonante
      N.sw = c.createBiquadFilter(); N.sw.type = 'bandpass'; N.sw.Q.value = 6; N.swL = c.createOscillator(); N.swL.frequency.value = 0.18; N.swA = c.createGain(); N.swA.gain.value = 1800; N.swL.connect(N.swA); N.swA.connect(N.sw.frequency); N.sw.frequency.value = 2000; N.swL.start();
      // tartamudeo (puerta a semicorcheas)
      N.st = c.createGain(); N.st.gain.value = 1;
      N.mix = c.createGain(); N.mix.connect(wet); wet.connect(out); built = true; return true; }
    const MODES = { clean: [], ring: ['ring'], phase: ['ph'], crush: ['cr'], dub: ['dl'], sweep: ['sw'], stutter: ['st'], ringdub: ['ring', 'dl'], crushsweep: ['cr', 'sw'], phasedub: ['ph', 'dl'] };
    function setMode(m) { if (!built) return; const c = UA.ctx; try { inp.disconnect(); } catch (e) {} inp.connect(dry); [N.ring, N.ph[3], N.cr, N.dlLP, N.sw, N.st].forEach((n) => { try { n.disconnect(); } catch (e) {} }); if (N.dlLP) N.dlLP.connect(N.dlF); const chain = MODES[m] || []; let last = inp;
      chain.forEach((k) => { if (k === 'ring') { last.connect(N.ring); last = N.ring; } else if (k === 'ph') { last.connect(N.ph[0]); last = N.ph[3]; } else if (k === 'cr') { last.connect(N.cr); last = N.cr; } else if (k === 'dl') { last.connect(N.dl); last = N.dlLP; } else if (k === 'sw') { last.connect(N.sw); last = N.sw; } else if (k === 'st') { last.connect(N.st); last = N.st; } }); if (chain.length) last.connect(N.mix); cur = m; }
    return { get node() { return build() ? inp : null; }, get mode() { return cur; }, makeup(v) { if (built) out.gain.setTargetAtTime(Math.min(0.90, Math.max(0.48, v * 0.48)), UA.ctx.currentTime, 0.25); },
      note(m) { const now = performance.now(); dens = Math.min(1, dens + 0.12); reg = reg * 0.8 + m * 0.2; lastN = now; },
      tick(dt, t, mega, lv) { if (!built) return; const c = UA.ctx, n = c.currentTime; dens = Math.max(0, dens - dt * 0.35); const playing = performance.now() - lastN < 2500;
        nextT -= dt; if (nextT <= 0) { const pool = mega ? ['clean', 'phase', 'dub', 'phasedub'] : playing ? ['clean', 'phase', 'dub', 'phasedub'] : ['clean', 'dub', 'phase']; /* Musical effects only in demos: no ring/crush/resonant sweeps. */ setMode(pool[Math.floor(Math.random() * pool.length)]); nextT = (60 / (RADIO.bpm || 120)) * 4 * (mega ? 4 : 8); }
        const w = cur === 'clean' ? 0 : (mega ? 0.18 : 0.13) * (0.5 + dens * 0.4); wet.gain.setTargetAtTime(w, n, 0.3); dry.gain.setTargetAtTime(1 - w * 0.35, n, 0.3);
        if (N.ringO) N.ringO.frequency.setTargetAtTime(110 * Math.pow(2, Math.round((reg - 48) / 12)) * (1 + Math.round(dens * 2) * 0.5), n, 0.2);
        if (N.dl) N.dl.delayTime.setTargetAtTime((60 / (RADIO.bpm || 120)) * (dens > 0.6 ? 0.25 : 0.75), n, 0.1); if (N.dlF) N.dlF.gain.setTargetAtTime(dens > 0.6 ? 0.22 : 0.30, n, 0.3);
        if (N.swL) N.swL.frequency.setTargetAtTime(0.1 + dens * 0.6, n, 0.5); if (N.phL) N.phL.frequency.setTargetAtTime(0.2 + dens * 1.2, n, 0.5);
        if (cur === 'stutter' && RADIO.st.on) { const sd = 60 / (RADIO.bpm || 120) / 4, ph = (n / sd) % 2; N.st.gain.setTargetAtTime(ph < 1 ? 1 : 0.05, n, 0.004); } } }; })();
  function pickCtl(e) { if (!open.length) return null; ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    for (const h of ray.intersectObjects(open.map((g) => g.dev.root), true)) { let o = h.object, vis = true; while (o) { if (!o.visible) { vis = false; break; } o = o.parent; } if (!vis) continue;
      const g = open.find((x) => { let p = h.object; while (p) { if (p === x.dev.root) return true; p = p.parent; } return false; }); return { c: h.object.userData.ctl || null, g }; } return null; }
  const HV = new Map();
  let HVA = null, LVA = null, vaSty = -1; const VMAP = [0, 4, 5, 5, 5, 0, 4, 1, 5, 4], LMAP = [4, 5, 4, 5, 5, 4, 5, 5, 4, 4], KV = new Map();
  function vaSync() { try { if (!HVA && audioOk() && typeof VA !== 'undefined') { HVA = VA.create(); LVA = VA.create(); RADIO.st.leadVA = LVA; try { const xn = XFX.node; if (xn) HVA.route(xn); } catch (e) {} } if (!HVA) return null; const st = RADIO.st.style || 0; if (st !== vaSty) { vaSty = st; const SY = RADIO.STYLES[st] || {}; HVA.preset(SY.va != null ? SY.va : VMAP[st % VMAP.length]); LVA.preset(SY.lva != null ? SY.lva : LMAP[st % LMAP.length]); try { HVA.set('bpm', RADIO.bpm); LVA.set('bpm', RADIO.bpm); } catch (e) {} } return HVA; } catch (e) { return null; } }
  function hwNote(m, on) { if (on) try { window.UEV('hwkey'); } catch (e) {} if (!audioOk()) return; if (on) try { XFX.note(m); } catch (e) {} { const v = vaSync(); if (v) { if (on) { window.__kLast = performance.now(); const sm = SNAP(m); KV.set(m, sm); v.noteOn(sm, 0.85, undefined, 'k'); } else { const sm = KV.get(m); if (sm != null) { v.noteOff(sm, undefined, 'k'); KV.delete(m); } } return; } } const c = UA.ctx, now = c.currentTime; if (on) { const sty = RADIO.st.style || 0; const P = [{ w: ['sawtooth', 'sawtooth', 'sawtooth', 'sawtooth', 'sawtooth'], d: [-14, -6, 0, 6, 14], cut: 3800, end: 1800, q: 1.2, a: 0.02, g: 0.06 }, { w: ['square', 'sawtooth'], d: [-5, 5], cut: 3000, end: 1200, q: 3, a: 0.005, g: 0.07 }, { w: ['sawtooth', 'sawtooth'], d: [-8, 8], cut: 900, end: 2600, q: 6, a: 0.01, g: 0.08 }, { w: ['sine', 'triangle'], d: [0, 1200], cut: 4000, end: 2500, q: 0.7, a: 0.008, g: 0.12 }, { w: ['triangle', 'sine'], d: [0, 1900], cut: 5000, end: 3000, q: 0.5, a: 0.004, g: 0.12 }, { w: ['square', 'square'], d: [-4, 1204], cut: 2600, end: 900, q: 4, a: 0.003, g: 0.06 }][sty % 6];
      const g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = P.q; f.frequency.setValueAtTime(P.cut, now); f.frequency.exponentialRampToValueAtTime(P.end, now + 0.5); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(P.g, now + P.a); g.gain.setTargetAtTime(P.g * 0.7, now + 0.15, 0.3); const hz = 440 * 2 ** ((SNAP(m) - 69) / 12);
      if (HV.size > 10) { const [k0, v0] = HV.entries().next().value; v0.g.gain.setTargetAtTime(0, now, 0.05); v0.os.forEach((o) => o.stop(now + 0.3)); HV.delete(k0); } const os = P.w.map((w, k) => { const o = c.createOscillator(); o.type = w; o.frequency.value = hz; o.detune.value = P.d[k]; o.connect(f); o.start(now); return o; }); f.connect(g).connect(UA.bus.master); HV.set(m, { g, os }); }
    else { const v = HV.get(m); if (!v) return; v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.15); v.os.forEach((o) => o.stop(now + 0.9)); HV.delete(m); } }
  function hwPick(e) { if (!HW || (HW.u || 0) < 0.5) return null; ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(HW.hits, false)[0]; return h ? h.object.userData.ctl : null; }
  function onDown(e) { const pc0 = pickCtl(e); if (pc0 && !pc0.c) { activate(pc0.g); return; } const hk = hwPick(e); if (hk && hk.id === 'volume' && (HW.T || 0) >= 2.5) { knobDrag = { hwVol: hk, y: e.clientY, v: HWVOL }; SEL = { type: 'hw' }; drag = null; hap(0.2); return; } if (hk && hk.type !== 'key' && hk.id !== 'power' && (HW.T || 0) >= 2.5 && !window.UNFIRE_APP) { HW.lock = { t: performance.now() / 1000, label: '🔒 DEMO MODE', text: 'Unlock with the full HYPERWAVE', v: 1 }; say('🔒 Mandos de demo · desbloquéalos al comprar HYPERWAVE'); hap(0.3); SEL = { type: 'hw' }; drag = null; return; } if (hk && hk.type !== 'key') { if (view.gd > view.D0 * 0.6) { view.gx = HW.root.position.x + 0.3; view.gz = HW.root.position.z + 0.25; view.gd = view.D0 * 0.55; } if (hk.id === 'power' || (HW.T || 0) < 2.5) { HW.tg = (HW.T || 0) > 1.8 ? 0 : 3.6; say(HW.tg ? 'HYPERWAVE 2000 · encendido' : 'HYPERWAVE 2000 · plegado'); } SEL = { type: 'hw' }; drag = null; return; } if (hk && hk.type === 'key') { try { UA.init(); } catch (er) {} hk.pressed = 1; hap(0.15); hwNote(hk.midi, true); knobDrag = { hw: hk }; drag = null; return; } const pc = pickCtl(e); if (!pc || !pc.c) return; const c = pc.c, g = pc.g; drag = null; activate(g); const spec = g.it.spec;
    if (c.type === 'button' && c.id === 'close') { g.closing = true; g.pin = false; return; }
    SEL = { type: 'cap', g }; hap(0.3);
    if (c.type === 'button' && ['next', 'back', 'move', 'close'].includes(c.id)) { act(c.id); return; }
    if (c.type === 'button') { if (c.id === 'transform') { g.manual = g.m > 1.4 ? 1 : 2; g.pin = true; A.msg = g.manual === 2 ? 'SHOW' : 'MÁQUINA'; } if (c.id === 'use') { A.using ? useOff() : useOn(spec); } if (c.id === 'next') { RADIO.start(); RADIO.next(); } RADIO.st.on && RADIO.servo(UA.ctx.currentTime + 0.005); A.msgT = 2; }
    if (c.type === 'knob') { knobDrag = { c, y: e.clientY, v: A.values[c.i] }; }
    if (c.type === 'key' && audioOk()) { const en = ensureEngine(spec); if (en.noteOn) { const m = RADIO.chordAt()[0] + 12 + c.semi; en.noteOn(m, 0.85); knobDrag = { key: m }; } }
    if (c.type === 'pad' && audioOk()) { const en = ensureEngine(spec); if (en.hit) en.hit(c.i, UA.ctx.currentTime, 1); const pd = g.dev.pads.find((p) => p.i === c.i); if (pd) pd.hit = 1; }
  }
  function onKnobMove(e) { if (!knobDrag.c) return; const v = clamp(knobDrag.v + (knobDrag.y - e.clientY) / 150); A.values[knobDrag.c.i] = v; const spec = A.spec, k = A.keys[knobDrag.c.i], [lo, hi, , stp, fmt] = ENGINES.PARAMS[spec.engine][k]; const val = Math.round((lo + (hi - lo) * v) / stp) * stp; if (A.engine) A.engine.set(k, val); A.msg = k.toUpperCase() + ' ' + fmt(val); A.msgT = 2; }
  function endKnob() { if (knobDrag && knobDrag.hwVol) { knobDrag = null; return; } if (knobDrag && knobDrag.hw) { knobDrag.hw.pressed = 0; hwNote(knobDrag.hw.midi, false); knobDrag = null; return; } if (knobDrag && knobDrag.key != null && A.engine && A.engine.noteOff) A.engine.noteOff(knobDrag.key); knobDrag = null; }
  const CINE = { on: false, t: 0, i: 0, dir: 1 };
  function openEverything() { openAllComp(); openComp('hw'); say('OPEN ALL: opening compartments…'); if (audioOk()) RADIO.start();
    setTimeout(() => { items.filter((x) => x.kind === 'cap').forEach((it, i) => setTimeout(() => openGear(it, true), i * 180)); items.forEach((it) => { if (it.kind === 'mut') it.tgt = 3; if (it.kind === 'fx') it.on = 1; }); if (HW) HW.tg = 1.2; say('Todo abierto · todos al mismo ritmo'); }, 2200); }
  let MEGA = false; const flyers = [];
  function megaOn() { MEGA = true; window.__mega = true; try { window.UEV('mega'); } catch (e) {} try { HAND.show(true); } catch (e) {} openAllComp(); openComp('hw'); if (audioOk()) RADIO.start(); say('★ MEGA TRANSFORMATION · all families'); if (!hwSub && RADIO.onStep) hwSub = RADIO.onStep((st, tt, sd, bar, ch) => { if (!HW || (HW.T || 0) < 2.5 || !ch) return; const sec = RADIO.st.sec || 'drop'; if (sec === 'intro') return;
      // melodía generativa: motivo de 2 compases que se repite con variaciones, siempre sobre notas del acorde/escala
      const M = HW.mel || (HW.mel = {}); if (st === 0 && (bar % 2 === 0 || !M.rh)) { const RH = [[0, 3, 6, 8, 11, 14], [0, 2, 4, 7, 10, 12], [0, 6, 8, 10, 14], [0, 3, 7, 10, 12], [2, 4, 6, 10, 12, 15]]; const seed = (RADIO.st.style * 13 + Math.floor(bar / 8) * 7 + (HW.melSeed || 0) * 3) % RH.length; M.rh = RH[seed]; let d = 0; M.notes = M.rh.map((_, k) => { d += [0, 1, -1, 2, -2, 1][((seed + k) * 5 + bar) % 6]; return d; }); }
      const k = M.rh.indexOf(st); if (k < 0) return; const sc = (RADIO.scale && RADIO.scale()) || [0, 2, 3, 5, 7, 8, 10], base = ch[0] + 12, deg = M.notes[k] + (bar % 2 && k >= M.rh.length - 2 ? 2 : 0); const nt = SNAP(base + sc[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)); const dur = sd * (M.rh[k + 1] != null ? M.rh[k + 1] - st : 16 - st) * 0.9; hwPlay(nt, tt, Math.max(sd, dur));  });
    setTimeout(() => { items.filter((x) => x.kind === 'cap').forEach((it, i) => setTimeout(() => { const g = openGear(it, true); g.manual = 2; }, 300 + i * 260)); items.forEach((it) => { if (it.kind === 'mut') it.tgt = 3; if (it.kind === 'fx') it.on = 1; }); if (HW) HW.tg = 3.6;
      [1, 2].forEach((pg) => CAPPAGES[pg].slice(0, 3).forEach((spec, i) => setTimeout(() => { if (!MEGA) return; const dev = (spec.g3 ? GEAR3 : GEAR4).build(spec, kindOf(spec), Object.keys(ENGINES.PARAMS[spec.engine]).slice(0, 4).map((k) => k.toUpperCase())); dev.root.scale.setScalar(0.07); caseG.add(dev.root); flyers.push({ dev, a: ((pg - 1) * 6 + i) / 12 * TAU, m: 0 }); }, 5600 + (pg * 3 + i) * 450)));
      say('▶ Press CINEMA to watch it as a movie'); }, 1800); }
  let hwSub = null; function hwPlay(m, t0, dur) { if (!audioOk() || !Number.isFinite(m) || (window.__WRADIO && window.__WRADIO.on && !RADIO.st.on)) return; if (KV.size || performance.now() - (window.__kLast || 0) < 1800) return; { const v = vaSync(); if (v) { v.noteOn(m, 0.42, t0, 'm'); v.noteOff(m, t0 + dur, 'm'); return; } } const c = UA.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t0); f.frequency.exponentialRampToValueAtTime(1200, t0 + dur); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.032, t0 + 0.02); g.gain.setTargetAtTime(0, t0 + dur * 0.7, 0.15); [-6, 6].forEach((d) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 440 * 2 ** ((m - 69) / 12); o.detune.value = d; o.connect(f); o.start(t0); o.stop(t0 + dur + 0.8); }); f.connect(g).connect(UA.bus.master); }
  function megaOff() { window.__mega = false; try { HAND.show(false); } catch (e) {} if (hwSub) { hwSub(); hwSub = null; } MEGA = false; flyers.forEach((f) => { f.out = 1; }); items.forEach((it) => { if (it.W && it.home) { it.fly = 0; it.retT = 2.2; } }); open.forEach((g) => { const h = g.it.tok.position; g.dev.root.position.x = h.x; g.dev.root.position.z = h.z; g.dev.root.rotation.y = 0; }); say('Mega apagado'); }
  function superAll() { open.forEach((g) => { g.manual = 2; g.boost = 4; }); items.forEach((it) => { if (it.kind === 'mut') it.tgt = 3; }); if (HW && compG.hw.userData.open) HW.tg = 3.6; if (audioOk()) { RADIO.start(); RADIO.next(); } say('★ SUPER TRANSFORMATION'); }
  // ===== DIRECTOR DE CINE: escenas en grupo, emociones, voces y piano para ti =====
  const DRC = { sc: -1, t: 0, shot: 0, shT: 0, warm: 0, focus: new THREE.Object3D(), B: [], n: 0, step: null };
  caseG.add(DRC.focus); window.__drc = DRC; window.__bots = () => bots(); window.__cine = CINE;
  let LASTCH = null;
  if (RADIO.onStep) RADIO.onStep((st, tt, sd, bar, ch) => { if (ch) LASTCH = ch; if (CINE.on && DRC.step) try { DRC.step(st, tt, sd, ch); } catch (e) {} });
  const TON = { key: -1, mode: 'auto' }; const MODES = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10], penta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10] };
  function SNAP(m) {
    // Follow the currently audible RADIO scale, not a fixed C/minor fallback.
    // The selected transposer mode and key remain authoritative when explicitly set.
    const md = (n) => ((n % 12) + 12) % 12;
    const currentScale = (RADIO.scale && RADIO.scale()) || MODES.menor;
    const steps = TON.mode !== 'auto' && TON.key >= 0 ? MODES[TON.mode] : currentScale;
    const root = TON.key >= 0 ? TON.key : RADIO.st.root;
    const set = new Set((steps || MODES.menor).map((x) => md(x + root)));
    const chord = RADIO.st.on ? (LASTCH || RADIO.chordAt()) : null;
    const chordSet = new Set((chord || []).map(md));
    const fold = (x) => { while (x > 81) x -= 12; while (x < 33) x += 12; return x; };
    let best = fold(m), score = Infinity;
    for (let d = -6; d <= 6; d++) {
      const note = fold(m + d);
      if (!set.has(md(note))) continue;
      // Closest scale tone wins; exact ties resolve to a chord tone.
      const cost = Math.abs(d) - (chordSet.has(md(note)) ? 0.08 : 0);
      if (cost < score) { score = cost; best = note; }
    }
    return best;
  }
  const bots = () => items.filter((it) => it.kind === 'mut' && it.W && it.R);
  // ===== ROBOTS GIGANTES: crecen desde el maletín (≈2× el maletín), saltan al suelo y corren por la casa sin atravesar nada =====
  const GROW = (() => { let on = false; const G = []; const HT = 11.5, FL = -8.905;
    const OBS = [[-13.8, 13.8, -8, 5.6], [-35, -25, -15, -1], [-48, -27, 30, 50], [-44, -32, 23, 31], [24, 52, 37, 51], [38, 50, 2, 22], [20, 28, 16, 24], [11, 19, -14, -6], [-26, -18, 4, 12], [-16, 0, 88, 96], [47, 57, 69, 79], [-57, -47, 75, 85], [53, 63, 41, 51], [-76, -60, 47, 63], [-62, -54, 54, 62], [-18, -10, 50, 58], [54, 62, 18, 26], [58, 66, -12, -4], [-64, -56, -12, -4], [10, 18, 54, 62]];
    const blocked = (x, z, m = 2) => x < -74 || x > 74 || z < -12 || z > 92 || OBS.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);
    const freePt = () => { for (let k = 0; k < 80; k++) { const x = -70 + Math.random() * 140, z = -8 + Math.random() * 96; if (!blocked(x, z, 4)) return V(x, FL, z); } return V(0, FL, 30); };
    const fxRing = (p, col) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.15, 8, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = H2; r.position.copy(p); ROOM.R.add(r); const L = new THREE.PointLight(col, 6, 30, 2); L.position.copy(p).setY(p.y + 3); ROOM.R.add(L); let a = 0; const f = (dt) => { a += dt; r.scale.setScalar(1 + a * 14); r.material.opacity = Math.max(0, 1 - a * 1.2); L.intensity = Math.max(0, 6 - a * 9); if (a > 0.9) { ROOM.R.remove(r); ROOM.R.remove(L); r.geometry.dispose(); return true; } }; FXQ.push(f); };
    const FXQ = [], PEND = []; let pendT = 0;
    function start() { if (on) return; on = true; const src = bots(); const specs = src.length ? src.map((it) => it.spec) : MUTANTS.list.slice(0, 6); PEND.length = 0; specs.slice(0, 3).forEach((spec, i) => PEND.push(() => { try { const r0 = ROBOT.build(spec); r0.root.traverse((o) => { o.castShadow = false; o.receiveShadow = false; }); const w = new THREE.Group(); w.add(r0.root); r0.update(3.7, 0.016, {}); const bb = new THREE.Box3().setFromObject(r0.root); const k = HT / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001); r0.root.position.y -= bb.min.y; ROOM.R.add(w); const it = src[i]; const p0 = it ? it.W.getWorldPosition(V(0, 0, 0)) : V((i - 3) * 0.7, 0.3, 0.6); w.position.copy(p0); w.scale.setScalar(k * 0.02); if (it) it.W.visible = false; const land = V(-18 + (i % 4) * 12, FL, 12 + Math.floor(i / 4) * 9); G.push({ w, r0, k, it, ph: Math.random() * 9, t: 0, st: 'grow', from: p0.clone(), land, tgt: null, spd: 4.6 + Math.random() * 1.6, dist: 0, idle: 0, jump: 0, vy: 0, yaw: 0 }); } catch (e) { console.warn('grow', e); } })); say('🤖⬆ ¡ROBOTS GIGANTES! · vuelve a pulsar el botón para guardarlos'); hap(0.8); try { if (!ROAMS.on) { enterRoam(); ROAMS.p.set(0, 6, 34); ROAMS.pitch = -0.2; } } catch (e) {} try { if (audioOk()) { const c = UA.ctx, n = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(60, n); o.frequency.exponentialRampToValueAtTime(420, n + 1.6); g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(0.05, n + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, n + 1.8); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; o.connect(f).connect(g).connect(UA.bus.master); o.start(n); o.stop(n + 1.9); } } catch (e) {} }
    function stop() { if (!on) return; on = false; G.forEach((g) => { g.st = 'home'; g.t = 0; g.tgt = V(clamp(g.w.position.x, -10, 10), FL, 9); }); say('🤖⬇ Robots are returning to the case'); }
    function tick(dt, t) { if (on && lidOpen < 0.5) stop(); if (PEND.length && on) { pendT -= dt; if (pendT <= 0) { pendT = 0.25; PEND.shift()(); } } else if (!on) PEND.length = 0; for (let i = FXQ.length - 1; i >= 0; i--) if (FXQ[i](dt)) FXQ.splice(i, 1); if (!G.length) return;
      for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) { const a = G[i].w.position, b = G[j].w.position; if (G[i].st !== 'roam' && G[i].st !== 'home') continue; if (G[j].st !== 'roam' && G[j].st !== 'home') continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01; if (d < 7) { const p = (7 - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; } }
      G.forEach((g) => { g.t += dt; const ws = g.w.scale.x / g.k;
        if (g.st === 'grow') { if (g.t < 0) return; const k = Math.min(1, g.t / 2.6), e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1; g.w.scale.setScalar(g.k * Math.max(0.02, 0.02 + 0.98 * e)); const p = g.from.clone().lerp(g.land, k); p.y = g.from.y + (g.land.y - g.from.y) * k + Math.sin(k * Math.PI) * 9; g.w.position.copy(p); g.w.rotation.y += dt * 6 * (1 - k); if (g.t > 0 && !g.fx0) { g.fx0 = 1; fxRing(g.from, 0xb6ff3b); } g.r0.update(3.7, dt, { act: 'fly', ph: t + g.ph, mood: 'wow' }); if (k >= 1) { g.st = 'roam'; fxRing(g.land, 0x5fe0ff); g.tgt = freePt(); } return; }
        if (g.st === 'shrink') { const k = Math.min(1, g.t / 1.6); const dst = g.it ? g.it.W.getWorldPosition(V(0, 0, 0)) : V(0, 0.3, 0.6); g.w.scale.setScalar(g.k * Math.max(0.02, 1 - k * 0.98)); const p = g.from.clone().lerp(dst, k); p.y += Math.sin(k * Math.PI) * 6; g.w.position.copy(p); g.r0.update(3.7, dt, { act: 'fly', ph: t + g.ph, mood: 'happy' }); if (k >= 1) { g.done = 1; ROOM.R.remove(g.w); if (g.it) g.it.W.visible = true; } return; }
        const P0 = g.w.position, dx = g.tgt.x - P0.x, dz = g.tgt.z - P0.z, d = Math.hypot(dx, dz);
        if (g.st === 'home' && d < 2) { g.st = 'shrink'; g.t = 0; g.from = P0.clone(); fxRing(P0, 0xff2fb0); return; }
        let moving = false; if (g.idle > 0) g.idle -= dt; else if (d > 1.2) { const sp = Math.min(d, g.spd * dt), nx = P0.x + dx / d * sp, nz = P0.z + dz / d * sp; if (g.st !== 'home' && blocked(nx, nz, 1)) { g.tgt = freePt(); } else { P0.x = nx; P0.z = nz; moving = true; g.dist += sp; g.yaw = Math.atan2(dx, dz); } } else if (g.st === 'roam') { g.idle = 1.5 + Math.random() * 3; g.tgt = freePt(); if (Math.random() < 0.3) g.vy = 9; }
        g.w.rotation.y = angL(g.w.rotation.y, g.yaw, 0.15); g.vy -= 22 * dt; P0.y = Math.max(FL, P0.y + g.vy * dt); if (P0.y <= FL) g.vy = Math.max(0, g.vy);
        const music = RADIO.st.on; g.r0.update(3.7, dt, { act: moving ? 'walk' : P0.y > FL + 0.1 ? 'fly' : music ? 'dance' : ['wave', 'cheer', 'look', 'dance'][Math.floor((t * 0.3 + g.ph) % 4)], ph: moving ? STEPPH(g.dist, HT) + g.ph : t * 0.8 + g.ph, mood: ['happy', 'star', 'wow', 'love'][Math.floor(g.ph) % 4], beatPhase: (t * (RADIO.bpm || 120) / 60) }); });
      for (let i = G.length - 1; i >= 0; i--) if (G[i].done) G.splice(i, 1); }
    const api = { get on() { return on; }, toggle() { on ? stop() : start(); }, start, stop, tick, get list() { return G; } }; window.__GROW = api; return api; })();
  const angL = (a, b, k) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; };
  const BX = CW / 2 - 0.35, BZ = CD / 2 - 0.35;
  function cn(it) { if (!it.cn) { const p = it.W.position; it.cn = { x: p.x, z: p.z, y: p.y, ry: 0, act: null, mood: 'idle', talk: false, tx: p.x, tz: p.z, spd: 0.28 + Math.random() * 0.45, fly: 0, yy: null, lock: false, face: null }; it.ph0 = Math.random() * 10; it.vp = 0.35 + ((items.indexOf(it) * 0.53) % 1.5); } return it.cn; }
  function goTo(it, x, z, spd = 0.5, face = null) { const c = cn(it); c.tx = clamp(x, -BX, BX); c.tz = clamp(z, -BZ, BZ); c.spd = spd; c.face = face; }
  function separate(list, rad, useCn) { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j], pa = useCn ? a.cn : a.W.position, pb = useCn ? b.cn : b.W.position; if (!pa || !pb) continue; const dx = pb.x - pa.x, dz = pb.z - pa.z, dy = useCn ? 0 : pb.y - pa.y, d = Math.hypot(dx, dz, dy) || 0.001; if (d < rad) { const k = (rad - d) / d * 0.5; pa.x -= dx * k; pa.z -= dz * k; pb.x += dx * k; pb.z += dz * k; if (!useCn) { pa.y -= dy * k; pb.y += dy * k; } } } }
  function moveBots(dt) { separate(bots().filter((it) => it.cn), MEGA ? 0.32 : 0.17, true); bots().forEach((it) => { const c = cn(it); const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz); if (d > 0.015) { const sp = Math.min(d, c.spd * dt); c.x += (dx / d) * sp; c.z += (dz / d) * sp; c.ry = angL(c.ry, Math.atan2(dx, dz), 0.15); if (!c.lock) c.act = c.spd > 0.4 ? 'run' : 'walk'; } else { if (c.face != null) c.ry = angL(c.ry, c.face, 0.1); if (!c.lock && (c.act === 'run' || c.act === 'walk')) c.act = c.idle || null; }
      const gy = (c.yy != null ? c.yy : it.tok.position.y) + c.fly; if (c.fly > 0.02 || c.yy != null) { c.vy = 0; c.y = lerp(c.y, gy, 0.08); } else { c.vy = (c.vy || 0) - 2.4 * dt; c.y += c.vy * dt; if (c.y < gy) { c.y = gy; c.vy = Math.abs(c.vy) > 0.15 ? -c.vy * 0.35 : 0; } } it.W.position.set(c.x, c.y, c.z); it.W.rotation.set(c.fly > 0.05 ? 0.35 : 0, c.ry, 0); }); }
  function hwBox() { if (!HW) return null; const b = new THREE.Box3().setFromObject(HW.root), c = caseG.worldToLocal(b.getCenter(V(0, 0, 0))), s = b.getSize(V(0, 0, 0)).divideScalar(caseG.getWorldScale(V(0, 0, 0)).x); return { x: c.x, y: c.y, z: c.z, sx: s.x, sy: s.y, sz: s.z, top: c.y + s.y / 2, z0: c.z - s.z / 2, z1: c.z + s.z / 2 }; }
  function hwKey(m, dur) { if (!HW || !HW.keys) return; const k = HW.keys.find((q) => q.midi === m) || HW.keys[(m % HW.keys.length + HW.keys.length) % HW.keys.length]; if (!k) return; k.pressed = 1; setTimeout(() => { k.pressed = 0; }, dur * 1000); }
  // ---- voces (una cada vez) y bocadillos ----
  const UI = (() => { const st = document.createElement('style'); st.textContent = `#bub{position:fixed;z-index:30;max-width:300px;padding:10px 14px;border-radius:18px;font:700 13px/1.3 Michroma,Arial,sans-serif;color:#0a1a3a;background:linear-gradient(180deg,#fff,#cfe6ff 60%,#9fd0ff);border:2px solid #3d8bff;box-shadow:0 0 0 3px #fff8,0 8px 24px #0008,0 0 24px #3d8bff88;transform:translate(-50%,-100%);pointer-events:none;opacity:0;transition:opacity .2s}#bub.on{opacity:1}#bub::after{content:"";position:absolute;left:50%;bottom:-12px;margin-left:-8px;border:8px solid transparent;border-top-color:#3d8bff}#bub b{display:block;font-size:10px;letter-spacing:.12em;color:#ff4fd8}
    #scn{position:fixed;left:50%;top:13vh;transform:translateX(-50%);z-index:31;text-align:center;pointer-events:none;opacity:0;transition:opacity .6s;font:900 clamp(18px,3.4vw,40px)/1 Orbitron,Arial;letter-spacing:.08em;color:#fff;text-shadow:0 0 18px #3d8bff,0 2px 0 #1a2a6a}#scn small{display:block;font:700 12px Michroma,Arial;letter-spacing:.3em;color:#ffd21a;margin-bottom:8px}#scn.on{opacity:1}
    #chat{position:fixed;left:50%;bottom:calc(9vh + 10px);transform:translateX(-50%);z-index:32;display:none;gap:6px;align-items:center;padding:6px 6px 6px 14px;border-radius:999px;background:linear-gradient(180deg,#e9f4ff,#9fc8ff);border:2px solid #fff;box-shadow:0 6px 20px #0009,0 0 18px #3d8bff99}#chat.on{display:flex}#chat input{border:0;background:transparent;font:600 13px Michroma,Arial;color:#0a1a3a;width:min(52vw,360px);outline:0}#chat button{border:0;border-radius:999px;padding:8px 12px;font:800 12px Michroma,Arial;color:#fff;background:linear-gradient(180deg,#5fb0ff,#1d4fd8);cursor:pointer}
    #kbh{position:fixed;right:14px;top:calc(9vh + 10px);z-index:32;display:none;padding:8px 12px;border-radius:12px;font:700 12px/1.4 "Share Tech Mono",monospace;color:#b6ff3b;background:#061433e6;border:1px solid #3d8bff}#kbh.on{display:block}`; document.head.appendChild(st);
    const mk = (id, h = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = h; document.body.appendChild(d); return d; };
    return { bub: mk('bub'), scn: mk('scn'), chat: mk('chat', '<input id="chatq" placeholder="' + (window.UNFIRE_APP ? 'Pregunta a los robots… (HYPERWAVE, efectos, isla)' : 'Pregunta a los robots… (precios, HYPERWAVE, efectos)') + '" maxlength="120"><button id="chatb">HABLAR</button>'), kbh: mk('kbh', '🎹 TU TURNO · teclas A S D F G H J K L<br>(todo suena afinado)') }; })();
  const VOX = { q: [], busy: false, who: null, cur: 0 };
  function speak(it, text) { if (VOX.q.length > 3) VOX.q.shift(); VOX.q.push({ it, text }); pump(); }
  function chirp(it) { if (!audioOk() || REC_GUARD()) return; const c = UA.ctx, n = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'square'; const f0 = 500 + (it ? it.vp : 1) * 500; o.frequency.setValueAtTime(f0, n); o.frequency.setValueAtTime(f0 * 1.5, n + 0.05); o.frequency.setValueAtTime(f0 * 1.25, n + 0.1); g.gain.setValueAtTime(0.04, n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.16); o.connect(g).connect(UA.bus.master); o.start(n); o.stop(n + 0.18); }
  function pump() { if (VOX.busy || !VOX.q.length) return; const { it, text } = VOX.q.shift(), id = ++VOX.cur; VOX.busy = true; VOX.who = it; const c = it && cn(it); if (c) c.talk = true; UI.bub.innerHTML = '<b>' + (it ? it.name : 'UNFIRE') + '</b>' + text; UI.bub.classList.add('on'); chirp(it); A.duck = 1;
    let ended = false; const done = () => { if (ended || id !== VOX.cur) return; ended = true; VOX.busy = false; A.duck = 0; if (c) c.talk = false; VOX.who = null; UI.bub.classList.remove('on'); setTimeout(pump, 450); };
    try { if (window.speechSynthesis && !REC_GUARD() && audioOk()) { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; const VR = window.__voiceFor ? window.__voiceFor(it ? it.name : 'UNFIRE') : { pitch: 1, rate: 0.96 }; if (VR.v) { u.voice = VR.v; u.lang = VR.v.lang; } u.pitch = VR.pitch; u.rate = VR.rate; u.volume = 1; u.onend = done; u.onerror = done; speechSynthesis.speak(u); } setTimeout(done, 1600 + text.length * 75); } catch (e) { setTimeout(done, 1500); } }
  function hush() { VOX.q.length = 0; VOX.cur++; VOX.busy = false; try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} UI.bub.classList.remove('on'); bots().forEach((it) => { if (it.cn) it.cn.talk = false; }); }
  function bubPos() { if (!UI.bub.classList.contains('on') || !VOX.who) return; const p = VOX.who.W.getWorldPosition(V(0, 0, 0)); p.y += 0.34; p.project(cam); UI.bub.style.left = clamp((p.x * 0.5 + 0.5) * innerWidth, 160, innerWidth - 160) + 'px'; UI.bub.style.top = clamp((-p.y * 0.5 + 0.5) * innerHeight - 8, 90, innerHeight - 40) + 'px'; }
  function title(n, s) { UI.scn.innerHTML = '<small>' + n + '</small>' + s; UI.scn.classList.add('on'); clearTimeout(title.t); title.t = setTimeout(() => UI.scn.classList.remove('on'), 2600); }
  // ---- pregunta a los robots ----
  const FAQ = [[/precio|cuesta|vale|€|euro|pagar|comprar|gratis/i, (window.UNFIRE_APP ? '¡Aquí todo está incluido! Explora la isla, toca HYPERWAVE y descubre todos los secretos.' : 'Puedes empezar gratis: demos de todo y 3 efectos completos. Luego eliges un efecto suelto, todo UNFIRE en un solo pago, o el Club. Los precios exactos están en La Bolsa.')], [/hyper|sinte|synth|piano|teclado/i, 'HYPERWAVE 2000 es la joya: un sintetizador entero que puedes tocar aquí mismo. ¡Usa las teclas A a la L, todo suena afinado!'], [/efecto|fx|plugin|vst|au\b/i, 'Hay 20 efectos, como LOFI, PULSE BITS y AIRFLOW. Funcionan en AU y VST3 en Mac.'], [/robot|transform|cápsula|capsula/i, 'Somos 20 robots transformables y hay 100 cápsulas. Cada uno tiene su sonido y su carácter.'], [/club|suscrip|mes/i, (window.UNFIRE_APP ? 'En la isla hay cápsulas escondidas por todas partes. ¡Sigue explorando!' : 'En el Club tienes todo el catálogo, cada máquina nueva el día que sale y una cápsula al mes. A los 12 meses, lo que tengas es tuyo.')], [/licen|usar|vender|derecho/i, 'Puedes usarlo en tus canciones, directos y vídeos. Lo único que no puedes es revenderlo.'], [/quién|quien|unfire|cardedeu|dónde|donde/i, 'UNFIRE AUDIO se hace en Cardedeu. Plugins, sintes y robots con alma de los 2000.'], [/hola|buenas|hey|ey\b/i, (window.UNFIRE_APP ? 'Hello, humano! Pregúntame por HYPERWAVE, los efectos o la isla.' : 'Hello, humano! Pregúntame por HYPERWAVE, los efectos, el Club o los precios.')], [/pele|lucha|batalla|drum|bater/i, 'Las batallas suenan a batería: cada golpe es un drum. ¡Espera a la escena de la pelea!']];
  function command(q) { const L = q.toLowerCase(), has = (r) => r.test(L); const on = !/apaga|para|quita|cierra/.test(L);
    if (has(/youtube|busca|canci[oó]n de|pon .* de /)) { TUBE.open(q.replace(/^(busca|pon|en youtube|youtube)\s*/i, '')); return 'Abro UNFIRE TUBE en el ordenador.'; }
    if (has(/hyperwave|sinte/)) { if (on) { openComp('hw'); return 'HYPERWAVE sube y se despliega. Toca con A–L.'; } HW.tg = 0; HW.closeGate = 1; return 'Guardo HYPERWAVE en su cúpula.'; }
    if (has(/m[uú]sica|radio|suena/)) { try { UA.init(); on ? RADIO.start() : RADIO.stop(); } catch (e) {} return on ? 'Música en marcha.' : 'Música parada.'; }
    if (has(/estilo|cambia.*tema|otro tema|siguiente/)) { try { UA.init(); RADIO.start(); RADIO.newSong(); } catch (e) {} return 'Cambio a ' + RADIO.STYLES[RADIO.st.style].name + '.'; }
    if (has(/luz|oscur|fiesta/)) { ROOM.toggleDark(); return 'Hecho.'; }
    if (has(/cine|peli/)) { CINE.on = on; return on ? 'Modo cine: ¡acción!' : 'Fin de la peli.'; }
    if (has(/mega|todo/)) { on ? (MEGA || megaOn()) : (MEGA && megaOff()); return on ? '¡MEGA FIESTA!' : 'Fiesta terminada.'; }
    if (has(/pasea|habitaci[oó]n|casa/)) { on ? enterRoam() : exitRoam(); return on ? 'Vamos a dar una vuelta.' : 'De vuelta al maletín.'; }
    if (has(/gacha|bola|c[aá]psula al azar|sorpresa/)) { ROOM.gacha && ROOM.gacha(); return '¡Gira la máquina de bolas!'; }
    return null; }
  function ask(q) { q = (q || '').trim(); if (!q) return; const cmd = command(q); const B = bots(); const who = B[Math.floor(Math.random() * B.length)] || null; const a = cmd || (FAQ.find(([r]) => r.test(q)) || [0, (window.UNFIRE_APP ? 'Bip bup… eso aún no lo sé. Pregúntame por HYPERWAVE, los efectos o la isla.' : 'Bip bup… eso aún no lo sé. Pregúntame por HYPERWAVE, los efectos, el Club o los precios.')])[1]; if (who) { const c = cn(who); c.mood = 'happy'; } hush(); speak(who, a); }
  // hablar con tus amigos del juego (aunque no haya nadie conectado): responde el que tengas más cerca, cada uno con su carácter
  { const ask0 = ask; const PERS = { ARI: { hi: ['¡EY! Por fin alguien con energía. ¿Hacemos ruido?', '¡Hola! Llegas tarde, pero llegas con estilo.'], joke: ['¿Sabes por qué los robots no tenemos miedo? Porque tenemos nervios de acero. Ya. Lo sé. Soy un genio.', 'Mi exnevera me dejó por un microondas. Dice que yo era muy frío.'], sad: ['Eh, eh. Ven aquí. Subimos el bajo y se te pasa. Funciona el 80% de las veces.'], music: ['La música tiene que sonar tan fuerte que los vecinos se hagan fans.', 'Si no te mueve las tuercas, no es un tema.'], who: ['Soy Ari. Aries. Primero actúo, luego pienso, y luego pido perdón bailando.'] },
      GEMI: { hi: ['Hola. Bueno, holas. Somos dos aquí dentro, depende del día.', '¡Hola! ¿Vienes a hablar conmigo o con mi otro yo? Él es más simpático.'], joke: ['Mi terapeuta dice que tengo doble personalidad. Le he dicho que ya somos dos opinando lo contrario.', 'He escrito una canción sobre la indecisión. Bueno, dos. O ninguna.'], sad: ['A veces estoy triste y contento a la vez. Es como un acorde de séptima. Te entiendo.'], music: ['Me gusta la música que empieza triste y acaba en fiesta. Como yo los martes.'], who: ['Soy Gemi. Géminis. Hablo mucho, cambio de idea más, y aun así me quieren.'] },
      LEO: { hi: ['Hola, hola. Sí, soy yo. No, no hace falta el autógrafo. Bueno, vale, uno.', 'Llegas en el momento perfecto: estaba a punto de brillar.'], joke: ['Mi foco me sigue a todas partes. Literal: lo llevo en la cabeza.', 'Tengo un ego tan grande que el gachapón me da premios por pena.'], sad: ['Oye, ¿quién te ha apagado el brillo? Ven, que te presto un poco del mío.'], music: ['Mi género favorito es cualquiera donde yo sea el solo.'], who: ['Leo. El león de la casa. Generoso, guapo y humilde. Bueno, las dos primeras.'] } };
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    ask = (q) => { const FR = window.__FRIENDS || []; if (!ROAMS.on || !FR.length || !q) return ask0(q); let best = null, bd = 30; FR.forEach((f) => { const d = Math.hypot(f.w.position.x - ROAMS.p.x, f.w.position.z - ROAMS.p.z); if (d < bd) { bd = d; best = f; } }); if (!best) return ask0(q); const P = PERS[best.name] || PERS.ARI, s = q.toLowerCase(); let a;
      if (/hola|hey|buenas|qué tal|que tal/.test(s)) a = pick(P.hi); else if (/chiste|gracia|ríe|rie|broma/.test(s)) a = pick(P.joke); else if (/triste|mal|solo|cansad|depre/.test(s)) a = pick(P.sad); else if (/música|musica|canción|cancion|tema|bajo|sinte|dj/.test(s)) a = pick(P.music); else if (/quién|quien|eres|nombre/.test(s)) a = pick(P.who); else if (/misión|mision|ayuda|aventura/.test(s)) { const ms = window.__SIDEM && window.__SIDEM.offer(best.name); a = ms ? 'Tengo una para ti: ' + ms + '. ¡Ve!' : 'Primero acaba la que llevas, que te veo venir.'; } else a = window.__GENLINE ? window.__GENLINE(best.name) : '¿Eh? Repítelo, que tenía el ventilador puesto.';
      best.w.rotation.y = Math.atan2(ROAMS.p.x - best.w.position.x, ROAMS.p.z - best.w.position.z); best.t = Math.max(best.t, 8); window.__FRIENDSAY && window.__FRIENDSAY(best, a); }; }
  addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') return; if ((e.key === 't' || e.key === 'T') && ROAMS.on) { const c = document.getElementById('chat'); c.classList.add('on'); const i = document.getElementById('chatq'); i.placeholder = 'Talk to the nearest robot… (Enter)'; setTimeout(() => i.focus(), 30); e.preventDefault(); } });
  document.getElementById('chatb').onclick = () => { const i = document.getElementById('chatq'); ask(i.value); i.value = ''; };
  document.getElementById('chatq').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { ask(e.target.value); e.target.value = ''; } });
  // ---- piano con el teclado del ordenador (con transposer) ----
  const KMAP = 'asdfghjklñ', KSEMI = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, 'ñ': 16, ';': 16 }, KDOWN = new Map(); let OCT = -1;
  window.__hwOpen = () => !!(HW && (HW.T || 0) >= 2.5);
  function pianoKey(key, down) { const kl = (key || '').toLowerCase(); if (down && (kl === 'z' || kl === 'x') && HW && (HW.T || 0) >= 2.5) { OCT = clamp(OCT + (kl === 'x' ? 1 : -1), -3, 2); say('🎹 Octava ' + (OCT >= 0 ? '+' : '') + OCT + ' (Z baja · X sube)'); hap(0.2); return true; } const i = KSEMI[(key || '').toLowerCase()]; if (i == null || !HW || (HW.T || 0) < 2.5) return false; const m = 60 + OCT * 12 + i; if (down) { if (KDOWN.has(i)) return true; try { UA.init(); } catch (er) {} KDOWN.set(i, m); hwNote(m, true); hwKey(SNAP(m), 0.25); hap(0.12); } else { const mm = KDOWN.get(i); if (mm != null) { hwNote(mm, false); KDOWN.delete(i); } } return true; }
  addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') return; if (pianoKey(e.key, true)) e.preventDefault(); });
  addEventListener('keyup', (e) => { pianoKey(e.key, false); });
  addEventListener('message', (e) => { const d = e.data || {}; if (!d.unfire) return; if (d.kd) pianoKey(d.kd, true); if (d.ku) pianoKey(d.ku, false); });
  // ---- golpes de batalla (energía de pelea en forma de drums) ----
  function hitDrum(kind, tt) { if (!audioOk() || REC_GUARD()) return; const c = UA.ctx, n = tt || c.currentTime; if (kind === 'kick') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, n); o.frequency.exponentialRampToValueAtTime(40, n + 0.18); g.gain.setValueAtTime(0.5, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.3); o.connect(g).connect(UA.bus.master); o.start(n); o.stop(n + 0.32); return; }
    const len = 0.18, b = c.createBuffer(1, c.sampleRate * len, c.sampleRate), dd = b.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dd.length, kind === 'hat' ? 6 : 2.5); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; g.gain.value = kind === 'hat' ? 0.12 : 0.35; s.connect(f).connect(g).connect(UA.bus.master); s.start(n); }
  // ---- escenas ----
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const SCENES = [
    { id: 'jam', n: 'ESCENA · LA JAM', s: 'Robots al HYPERWAVE', dur: 26, ok: () => !!HW,
      start(B) { openComp('hw'); HW.tg = 3.6; const hb = hwBox(); this.hb = hb; const p = B[0]; if (p) { goTo(p, hb.x, hb.z0 - 0.07, 0.45, 0); cn(p).idle = 'play'; cn(p).mood = 'happy'; }
        B.slice(1, 4).forEach((it, i) => { goTo(it, hb.x + (i - 1) * 0.42, hb.z1 + 0.3, 0.5, 0); const c = cn(it); c.idle = 'dance'; c.mood = pick(['happy', 'star', 'love']); });
        B.slice(4).forEach((it, i) => { goTo(it, BX - 0.1 - i * 0.3, BZ - 0.05, 0.35, Math.PI * 0.8); const c = cn(it); c.idle = 'rest'; c.mood = 'sleep'; }); },
      tick(B, k, t) { const p = B[0]; if (!p || !this.hb) return; const c = cn(p); if (Math.hypot(c.tx - c.x, c.tz - c.z) < 0.03) c.yy = Math.max(p.tok.position.y, this.hb.top - 0.12);
        if (k > 2.5 && !this.s1) { this.s1 = 1; c.mood = 'star'; speak(p, 'Hey, tú! Toca el HYPERWAVE, está aquí. ¡Adelante!'); UI.kbh.classList.add('on'); }
        if (k > 9 && !this.s2 && B[1]) { this.s2 = 1; speak(B[1], 'Toca cualquier tecla: el transposer lo afina todo. ¡Es magia del 2000!'); }
        if (k > 17 && !this.s3 && B[2]) { this.s3 = 1; cn(B[2]).mood = 'love'; speak(B[2], '¡Esto suena a videoclip de la MTV!'); } },
      step(B, st, tt, sd, ch) { const p = B[0]; if (!p || !ch || (HW.T || 0) < 2.5 || cn(p).act !== 'play') return; if (st % 2 === 0) { const m = SNAP(ch[st % ch.length] + 12 + (st % 8 === 0 ? 12 : 0)); hwPlay(m, tt, sd * 2.2); setTimeout(() => hwKey(m, sd * 2), Math.max(0, (tt - UA.ctx.currentTime) * 1000)); } },
      shots: [{ f: 'all', d: 5, az: 0.15, el: -0.38, k: 1.05 }, { f: [0], d: 5, az: 0.55, el: -0.22, k: 1.5 }, { f: [1, 2, 3], d: 5, az: -0.5, el: -0.3, k: 1.0 }, { f: [0], d: 5, az: -0.35, el: -0.45, k: 1.7 }, { f: 'all', d: 6, az: 0.9, el: -0.5, k: 1.2 }] },
    { id: 'race', n: 'ESCENA · LA CARRERA', s: 'El último invita a los vinilos', dur: 22, ok: () => true,
      start(B) { this.r = B.slice(0, 3); this.z = B[3]; this.a = 0; if (this.z) { goTo(this.z, 0.2, -0.15, 0.4, 0); const c = cn(this.z); c.idle = 'rest'; c.mood = 'sleep'; } B.slice(4).forEach((it, i) => { goTo(it, -BX + 0.2 + i * 0.35, 0.2, 0.4, Math.PI / 2); const c = cn(it); c.idle = 'cheer'; c.mood = 'happy'; }); this.r.forEach((it) => { cn(it).mood = pick(['happy', 'star', 'angry']); }); },
      tick(B, k) { this.a += 0.012; const run = this.z && this.zr ? [...this.r, this.z] : this.r; run.forEach((it, i) => { const a = this.a * 3.2 - i * 0.55; goTo(it, Math.cos(a) * (BX - 0.15), Math.sin(a) * (BZ - 0.15), 1.2); });
        if (k > 1.5 && !this.s1 && this.r[0]) { this.s1 = 1; speak(this.r[0], '¡El último invita a los vinilos!'); }
        if (k > 8 && !this.s2 && this.z) { this.s2 = 1; const c = cn(this.z); c.idle = null; c.act = null; c.mood = 'angry'; speak(this.z, 'Hey! I was sleeping! Now you will see…'); }
        if (k > 11 && this.z && !this.zr) { this.zr = 1; cn(this.z).mood = 'angry'; }
        if (k > 15 && !this.s3 && this.r[1]) { this.s3 = 1; speak(this.r[1], '¡Nos pilla! ¡Turbo, turbo!'); } },
      shots: [{ f: [0], d: 5, az: 0.9, el: -0.3, k: 1.6 }, { f: 'all', d: 5, az: 0.1, el: -0.62, k: 1.0 }, { f: ['z'], d: 4, az: -0.3, el: -0.3, k: 1.8 }, { f: [0, 1, 2], d: 4, az: -0.9, el: -0.25, k: 1.3 }, { f: 'all', d: 5, az: 0.4, el: -0.5, k: 1.1 }] },
    { id: 'fight', n: 'ESCENA · LA BATALLA', s: 'Golpes que suenan a batería', dur: 24, ok: () => true,
      start(B) { const [a, b] = B; if (a) { goTo(a, -0.22, 0.25, 0.5, Math.PI / 2); const c = cn(a); c.idle = 'fight'; c.mood = 'angry'; } if (b) { goTo(b, 0.22, 0.25, 0.5, -Math.PI / 2); const c = cn(b); c.idle = 'fight'; c.mood = 'angry'; } B.slice(2).forEach((it, i, arr) => { const ang = Math.PI * (0.15 + 0.7 * (i / Math.max(1, arr.length - 1))), x = Math.cos(ang) * 0.85, z = 0.25 - Math.sin(ang) * 0.75; goTo(it, x, z, 0.5, Math.atan2(-x, 0.25 - z)); const c = cn(it); c.idle = 'cheer'; c.mood = pick(['wow', 'happy', 'star']); }); },
      tick(B, k) { if (k > 2 && !this.s1 && B[0]) { this.s1 = 1; speak(B[0], 'My kick hits harder than your snare!'); } if (k > 7 && !this.s2 && B[1]) { this.s2 = 1; speak(B[1], 'Ha! My snare sounds straight out of 2001!'); } if (k > 17 && !this.s3 && B[0] && B[1]) { this.s3 = 1; const w = pick([B[0], B[1]]), l = w === B[0] ? B[1] : B[0]; cn(w).idle = 'cheer'; cn(w).mood = 'star'; cn(l).idle = 'rest'; cn(l).mood = 'sad'; speak(w, 'K.O.! The beat wins!'); } },
      step(B, st, tt) { if (!this.s1 || this.s3) return; if (st % 4 === 0) hitDrum('kick', tt); if (st % 8 === 4) hitDrum('snare', tt); if (st % 2 === 1) hitDrum('hat', tt); },
      shots: [{ f: [0, 1], d: 5, az: 0.0, el: -0.3, k: 1.5 }, { f: [0], d: 4, az: 1.1, el: -0.2, k: 1.9 }, { f: [1], d: 4, az: -1.1, el: -0.2, k: 1.9 }, { f: 'all', d: 5, az: 0.3, el: -0.55, k: 1.1 }, { f: [0, 1], d: 6, az: -0.4, el: -0.15, k: 1.4 }] },
    { id: 'sky', n: 'ESCENA · DESFILE AÉREO', s: 'Los que vuelan y los que miran', dur: 20, ok: () => true,
      start(B) { this.f = B.slice(0, 3); this.f.forEach((it) => { const c = cn(it); c.lock = true; c.act = 'fly'; c.mood = 'star'; }); B.slice(3).forEach((it, i) => { goTo(it, -0.6 + i * 0.4, 0.75, 0.5, 0); const c = cn(it); c.idle = 'look'; c.mood = 'wow'; }); this.a = 0; },
      tick(B, k) { this.a += 0.01; this.f.forEach((it, i) => { const c = cn(it), a = this.a * 2 + i * 2.1; goTo(it, Math.cos(a) * 1.3, Math.sin(a) * 0.8 - 0.1, 0.8); c.fly = Math.min(0.55 + i * 0.12, c.fly + 0.006); c.act = 'fly'; });
        if (k > 3 && !this.s1 && B[3]) { this.s1 = 1; speak(B[3], '¡Mira! ¡Vuelan como en un videoclip del 2000!'); } if (k > 10 && !this.s2 && this.f[0]) { this.s2 = 1; speak(this.f[0], window.UNFIRE_APP ? '¡Desde aquí arriba se ve toda la isla!' : '¡Desde aquí arriba se ve toda la web!'); } },
      end(B) { B.forEach((it) => { const c = cn(it); c.fly = 0; c.lock = false; }); },
      shots: [{ f: 'all', d: 5, az: 0.2, el: -0.08, k: 1.1 }, { f: [0], d: 5, az: 0.8, el: -0.15, k: 1.7 }, { f: [3, 4], d: 4, az: -0.3, el: -0.05, k: 1.5 }, { f: 'all', d: 6, az: -0.7, el: -0.4, k: 1.2 }] },
    { id: 'talk', n: 'ESCENA · LA CHARLA', s: 'Todo lo que hay en UNFIRE', dur: 26, ok: () => true,
      start(B) { const [a, b] = B; if (a) { goTo(a, -0.2, 0.9, 0.45, Math.PI / 2); const c = cn(a); c.idle = 'talk'; c.mood = 'happy'; } if (b) { goTo(b, 0.2, 0.9, 0.45, -Math.PI / 2); const c = cn(b); c.idle = null; c.mood = 'wow'; } B.slice(2).forEach((it, i) => { goTo(it, (i % 2 ? 1 : -1) * (1.0 + (i >> 1) * 0.35), 0.6, 0.35, 0); const c = cn(it); c.idle = pick(['rest', 'dance', 'walk']); if (c.idle === 'walk') c.idle = 'dance'; c.mood = pick(['love', 'sleep', 'happy']); }); this.i = 0; this.L = window.UNFIRE_APP ? [['HYPERWAVE 2000 is a full synthesizer. Play it right here.', 'And with the transposer, every key you play sounds right.'], ['There are 20 effects, 100 capsules and twenty of us.', 'And every capsule holds a surprise!'], ['Everything is made in Cardedeu.', 'Like the best inventions: in a garage, built with passion!']] : [['Did you know you can try everything for free right here?', 'Free? That is more Y2K than a demo CD in a magazine!'], ['HYPERWAVE 2000 is a full synthesizer. Play it on the web.', 'And with the transposer, every key you play sounds right.'], ['There are 20 effects, 100 capsules and twenty of us.', 'The Club is full of surprises, with more to come in future updates!'], ['Everything is made in Cardedeu.', 'Like the best inventions: in a garage, built with passion!']]; },
      tick(B, k) { const [a, b] = B; if (!a || !b) return; const slot = Math.floor((k - 2) / 5.5); if (k > 2 && slot >= 0 && slot < this.L.length && slot !== this.last) { this.last = slot; const [x, y] = this.L[slot]; cn(a).idle = 'talk'; speak(a, x); speak(b, y); } cn(b).idle = VOX.who === b ? 'talk' : null; cn(a).idle = VOX.who === a ? 'talk' : null; },
      shots: [{ f: [0, 1], d: 6, az: 0.0, el: -0.28, k: 1.6 }, { f: [0], d: 5, az: 0.7, el: -0.2, k: 2.0 }, { f: [1], d: 5, az: -0.7, el: -0.2, k: 2.0 }, { f: 'all', d: 5, az: 0.3, el: -0.5, k: 1.15 }, { f: [0, 1], d: 5, az: -0.2, el: -0.3, k: 1.5 }] },
  ];
  function focusSet(B, f) { if (f === 'all') return B; return f.map((x) => (x === 'z' ? SCENES[DRC.sc].z : B[x])).filter(Boolean); }
  function nextScene() { const B0 = bots(); if (!B0.length) { DRC.warm = 1; return; } const S0 = SCENES[DRC.sc]; if (S0 && S0.end) S0.end(DRC.B); DRC.B.forEach((it) => { const c = cn(it); c.idle = null; c.act = null; c.lock = false; c.yy = null; c.fly = 0; c.face = null; });
    let i = DRC.sc; do { i = (i + 1) % SCENES.length; } while (!SCENES[i].ok() && i !== DRC.sc); DRC.sc = i; const S1 = SCENES[i]; Object.keys(S1).forEach((k) => { if (!['id', 'n', 's', 'dur', 'ok', 'start', 'tick', 'step', 'end', 'shots'].includes(k)) delete S1[k]; });
    DRC.B = B0.slice().sort(() => Math.random() - 0.5); DRC.t = 0; DRC.shot = -1; DRC.shT = 0; DRC.n++; UI.kbh.classList.remove('on'); hush(); title(S1.n, S1.s); say('🎬 ' + S1.n); S1.start(DRC.B); DRC.step = (st, tt, sd, ch) => S1.step && S1.step(DRC.B, st, tt, sd, ch); }
  function cineStart() { openComp('mut'); items.forEach((it) => { if (it.kind === 'mut') it.tgt = 3; }); bots().forEach((it) => { if (!MEGA || !it.cineHome) it.cineHome = (it.home ? it.home.clone ? it.home.clone() : V(it.home.x, it.W.position.y, it.home.z) : it.W.position.clone()); cn(it); const p = it.W.position; Object.assign(it.cn, { x: p.x, z: p.z, y: p.y, tx: p.x, tz: p.z }); }); if (audioOk()) RADIO.start(); DRC.warm = 2.2; DRC.sc = -1; UI.chat.classList.add('on'); }
  function cineStop() { hush(); DRC.step = null; UI.chat.classList.remove('on'); UI.kbh.classList.remove('on'); UI.scn.classList.remove('on'); const S0 = SCENES[DRC.sc]; if (S0 && S0.end) S0.end(DRC.B); bots().forEach((it) => { const h = it.cineHome || it.home; if (h) { it.W.position.copy(h); it.W.rotation.set(0, 0, 0); } it.cn = null; }); }
  function DIRECTOR(dt, t) { if (DRC.warm > 0) { DRC.warm -= dt; if (DRC.warm <= 0) nextScene(); return; } const S1 = SCENES[DRC.sc]; if (!S1) return; DRC.t += dt; const B = DRC.B.filter((it) => it.W); try { S1.tick(B, DRC.t, t); } catch (e) {} moveBots(dt);
    B.forEach((it) => { const c = cn(it); if (!c.lock && Math.hypot(c.tx - c.x, c.tz - c.z) < 0.015) c.act = c.idle || null; });
    DRC.shT -= dt; if (DRC.shT <= 0) { DRC.shot = (DRC.shot + 1) % S1.shots.length; const sh = S1.shots[DRC.shot]; DRC.shT = sh.d; DRC.cur = sh; ORB.gaz = sh.az; ORB.gde = sh.el; CINE.dir = DRC.shot % 2 ? 1 : -1; DRC.cut = 1; }
    const sh = DRC.cur, fs = focusSet(B, sh.f); if (fs.length) { const c0 = V(0, 0, 0); let r = 0; fs.forEach((it) => c0.add(it.W.position)); c0.divideScalar(fs.length); fs.forEach((it) => { r = Math.max(r, it.W.position.distanceTo(c0)); }); DRC.focus.position.lerp(V(c0.x, c0.y + 0.12, c0.z), DRC.cut ? 1 : 0.08); const gd = Math.max(0.95, (r * 2.2 + 0.6)) * sh.k; view.gd = gd; if (DRC.cut) { view.dist = gd * 1.18; DRC.cut = 0; } }
    CINE.o = DRC.focus; const wp = DRC.focus.getWorldPosition(V(0, 0, 0)); view.gx = lerp(view.gx, wp.x, 0.1); view.gz = lerp(view.gz, wp.z, 0.1); CINE.y = wp.y - HB; ORB.gaz += dt * 0.035 * CINE.dir; bubPos();
    if (DRC.t > S1.dur) nextScene(); }

  setTimeout(() => { view.dist = view.D0 * 1.75; ORB.az = 0.8; ORB.de = -0.25; }, 60);
  function act(a) { if (a === 'shut' || a === 'shutNow') { closeCaseInGame(); say('Case closed · you are still in the game. The butterfly opens it.'); return; } if (a === 'super') { MEGA ? megaOff() : megaOn(); return; } if (a === 'cine') { CINE.on = !CINE.on; CINE.t = 99; say(CINE.on ? 'Cinema mode: automatic shots (tap to take control)' : 'Cinema mode off'); return; }
    if (SEL) say(({ next: 'Transform', back: 'Back', move: 'Move: drag on the case', close: 'Close and save' })[a] + ' · ' + (SEL.type === 'hw' ? 'HYPERWAVE 2000' : SEL.type === 'cap' ? SEL.g.it.name : SEL.it.name)); if (!SEL) return; MV = null;
    if (SEL.type === 'cap') { const g = SEL.g; if (a === 'next') { if (g.m > 1.9) g.boost = 3; g.manual = 2; } if (a === 'back') g.manual = Math.max(1, Math.round(g.m) - 1); if (a === 'move') MV = { o: g.dev.root }; if (a === 'close') { g.closing = true; g.pin = false; g.manual = 0; SEL = null; } }
    else if (SEL.type === 'mut') { const it = SEL.it; if (a === 'next') it.tgt = Math.min(3, Math.floor(it.T + 0.01) + 1); if (a === 'back') it.tgt = Math.max(0, Math.ceil(it.T - 0.01) - 1); if (a === 'move') MV = { o: it.W }; if (a === 'close') { it.tgt = 0; SEL = null; } }
    else if (SEL.type === 'hw') { if (a === 'next') HW.tg = Math.min(3.6, HW.tg + 1.2); if (a === 'back') HW.tg = Math.max(1.2, HW.tg - 1.2); if (a === 'move') { HW.equip = !HW.equip; if (HW.equip) { HW.tg = 3.6; say('HYPERWAVE on the table · full size'); } else say('HYPERWAVE returns to the case'); hap(0.6); } if (a === 'close') { HW.equip = false; HW.tg = 0; HW.closeGate = 1; SEL = null; } }
    else if (SEL.type === 'dev') { const it = SEL.it; if (a === 'next') { if (it.on) parentPost(it.kind === 'fx' ? { open: 'fx', id: it.id } : { open: it.kind }); it.on = 1; } if (a === 'back' || a === 'close') { it.on = 0; SEL = null; } if (a === 'move') MV = { o: it.g }; }
    $('tb').querySelectorAll('button').forEach((b) => b.classList.toggle('on', !!MV && b.dataset.a === 'move')); }
  $('tb').addEventListener('pointerdown', (e) => e.stopPropagation()); $('tb').onclick = (e) => { const a = e.target.closest('[data-a]'); if (a) act(a.dataset.a); };
  // The painted lid is one large entry target, not only its tiny butterfly mesh.
  // Raycast materials may miss decals or thin edges on Safari/software WebGL.
  // Intersect the physical lid plane in case-local coordinates instead; empty
  // table/background and UI outside the case remain non-interactive.
  function closedCaseLidHit(e) {
    if (!caseG.visible || carryingCase) return false;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    caseG.updateWorldMatrix(true, false);
    const lidPlane = new THREE.Plane(V(0, 1, 0), -(caseG.position.y + HL + 0.10));
    const point = ray.ray.intersectPlane(lidPlane, V(0, 0, 0));
    if (!point) return false;
    caseG.worldToLocal(point);
    return Math.abs(point.x) <= CW * 0.5 + 0.12 &&
           Math.abs(point.z) <= CD * 0.5 + 0.12;
  }
  let closedCaseActivatedAt = -Infinity;
  function onClick(e) {
    // A real click on the unfolded case switches to its usable overhead camera.
    if(ROAMS.on&&!CASE_VIEW.on&&!carryingCase&&caseG.visible&&pTarget>0.5){
      ndc.set((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);
      ray.setFromCamera(ndc,cam);
      if(ray.intersectObject(caseG,true).length){
        // Identical to the established 'RETURN TO THE CASE' camera.
        if(window.ATM_OUT)showCaseView();else exitRoam();
        return;
      }
    }
    { const pc = lidOpen > 0.5 ? pickCtl(e) : null; if (pc && !pc.c) { SEL = { type: 'cap', g: pc.g }; activate(pc.g); return; } }
    if (lidOpen < 0.5) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); const hitD = ray.intersectObject(dragon, true).length; if (hitD || ray.intersectObject(caseG, true).length || closedCaseLidHit(e)) {
        closedCaseActivatedAt = performance.now();
        if(parent!==window&&!window.__unfireCaseEntryStarted){
          try{if(typeof parent.__UNFIRE_ENTER_CASE==='function'){parent.__UNFIRE_ENTER_CASE();return;}}catch(_){}
          parentPost({entryRequest:true});return;
        }
        if(parent===window&&!window.__unfireCaseEntryStarted){
          window.__unfireCaseEntryStarted=true;
          try{const root=document.documentElement,fs=root.requestFullscreen||root.webkitRequestFullscreen;if(fs&&!document.fullscreenElement)fs.call(root).catch?.(()=>{});}catch(_){}
          // The standalone direct link also glides first, then opens slowly.
          entryDolly.active=true;entryDolly.from=view.dist;entryDolly.to=view.D0*.96;
          entryDolly.elapsed=0;entryDolly.openAfter=false;view.gd=entryDolly.to;lidControlledByPlayer=true;pTarget=1;
          return;
        }
        if (hitD) ALL = true;
        openCaseInGame();
        try { RADIO.chime && UA.ctx && RADIO.chime(UA.ctx.currentTime + 0.02); } catch (er) {} } return; }
    if (lidOpen > 0.9) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); if (window.__fd && ray.intersectObject(window.__fd.parent, true).length) { hap(0.5); act('shut'); return; } if (ray.intersectObject(lidBtn, true).length) { toggleCaseInGame(); hap(0.25); return; } if (ROAMS.on && !CASE_VIEW.on && window.__NIMBO && window.__NIMBO.hit(ray)) { hap(0.3); return; } if (!CASE_VIEW.on && ROOM.pick(ray, ROAMS.on ? Infinity : ((ray.intersectObject(caseG, true)[0] || {}).distance || Infinity))) return; if (ray.intersectObject(pageBtn, true).length) { setCapPage(capPage + 1); return; } { const ph = ray.intersectObjects(PB.filter((b) => b.parent && b.parent.visible), true)[0]; if (ph) { let o = ph.object; while (o && !o.userData.btn) o = o.parent; if (o) { SEL = o.userData.btn.sel; hap(0.3); act(o.userData.btn.a); return; } } }
    { const bh = ray.intersectObjects(btns.map((b) => b.g), true)[0]; if (bh) { const B = btns.find((b) => { let p = bh.object; while (p) { if (p === b.g) return true; p = p.parent; } return false; }); B.p = 1; hap(0.45); act(B.a); return; } } const gh = ray.intersectObjects(gates.flatMap((x) => x.list || [x.g]), true)[0]; if (gh) { const gk = gates.find((x) => { let p = gh.object; while (p) { if (p === x.g || (x.list && x.list.includes(p))) return true; p = p.parent; } return false; }); if (gk && !compG[gk.k].userData.open) { openComp(gk.k); if (gk.k === 'hw' && HW) { HW.tg = 0; SEL = { type: 'hw' }; } return; } } }
    if (pickCtl(e)) return;
    if (HW && compG.hw.userData.t > 0.9 && ray.intersectObject(HW.root, true).length) { SEL = { type: 'hw' }; return; }
    const objs = items.map((it) => (it.W ? it.W : it.tok || it.g)).filter((o) => o && o.visible), hit = ray.intersectObjects(objs, true)[0];
    let best = null; if (hit) best = items.find((it) => { const o = it.W ? it.W : it.tok || it.g; let p = hit.object; while (p) { if (p === o) return true; p = p.parent; } return false; });
    if (!best) { const p = cursorPoint(e); if (!p) return; let bd = 0.22; for (const it of items) { if (it.tok || it.g) continue; const d = Math.hypot(it.pos.x+caseG.position.x-p.x, it.pos.z+caseG.position.z-p.z); if (d < bd) { bd = d; best = it; } } }
    if (!best) return;
    if (best.kind === 'cap') { const g = openGear(best, true); activate(g); SEL = { type: 'cap', g }; return; }
    if (best.kind === 'mut') { if (best.tgt < 0.5) { best.tgt = 3; if (audioOk()) { RADIO.start(); RADIO.chime(UA.ctx.currentTime + 0.02); } } SEL = { type: 'mut', it: best }; return; }
    if (best.kind === 'hyper') { if (!compG.hw.userData.open) openComp('hw'); SEL = { type: 'hw' }; return; }
    if (best.g) { SEL = { type: 'dev', it: best }; if (!best.home) best.home = best.g.position.clone(); if (!best.on) { best.on = 1; if (best.kind === 'fx') { const b0 = best; setTimeout(() => { if (b0.on) parentPost({ open: 'fx', id: b0.id }); }, 650); } return; } best.on = 0; SEL = null; return; }
    if (best.kind === 'fx') parentPost({ open: 'fx', id: best.id });
    if (best.kind === 'archer') parentPost({ open: 'archer' });
    if (best.kind === 'hyper') parentPost({ open: 'hyper' });
    if (best.kind === 'synth') parentPost({ open: 'synth' });
    
  }
  function flyTo(it) { const lap = it.laptop; view.gx = it.pos.x; view.gz = it.pos.z + (lap ? -0.3 : 0.02); view.gd = it.kind === 'cap' ? 1.3 : it.kind === 'mut' ? 1.25 : it.kind === 'fx' ? 1.1 : lap ? 2.0 : 1.6; }
  // Safari may deliver a native click even if a WebGL frame/iframe transition
  // swallowed the pointerup. Honor that single click, but never invoke twice
  // after the normal pointerup path has already requested case entry.
  cv.addEventListener('click', (e) => {
    if (!e.isTrusted || lidOpen >= 0.5 || pTarget > 0.5 ||
        performance.now() - closedCaseActivatedAt < 350) return;
    if (closedCaseLidHit(e)) onClick(e);
  });
  function hover(e) { { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); { const hl = lidOpen > 0.5 ? ray.intersectObject(lidArt, false)[0] : null; const hp = hl ? hl.point : ray.ray.intersectPlane(plane, V(0, 0, 0)); if (hp) { HOVL.position.copy(hp); if (hl) HOVL.position.add(hl.face.normal.clone().transformDirection(lidArt.matrixWorld).multiplyScalar(0.3)); else HOVL.position.y += 0.35; } HOVB = null; if (lidOpen > 0.9) { const bh = ray.intersectObjects(btns.map((b) => b.g), true)[0]; if (bh) HOVB = btns.find((b) => { let p = bh.object; while (p) { if (p === b.g) return true; p = p.parent; } return false; }) || null; } } const objs = lidOpen > 0.9 ? items.filter((it) => it.g && it.g.visible).map((it) => it.g) : []; const h = objs.length && ray.intersectObjects(objs, true)[0]; HOV = h ? items.find((it) => { let p = h.object; while (p) { if (p === it.g) return true; p = p.parent; } return false; }) : null; } if (lidOpen < 0.5) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); cv.style.cursor = (ray.intersectObject(caseG, true).length || closedCaseLidHit(e)) ? 'pointer' : 'default'; return; } const c = pickCtl(e); cv.style.cursor = c && c.c ? (c.c.type === 'knob' ? 'ns-resize' : 'pointer') : zoomed() ? 'grab' : 'default'; }

  // Tiny, bounded footsteps for the walking avatar and nearby house robots.
  // Reuse one 30ms buffer; no sample downloads, background loops, new AudioContexts or autoplay.
  const ROBOT_STEPS = (() => {
    let soundBuffer = null, lastHit = 0, avatarT = 0;
    const play = (x, volume) => {
      if (!UA.ctx || UA.ctx.state !== 'running' || !UA.bus || !UA.bus.master ||
          document.hidden || REC_GUARD() || ROOM.AMB.mute) return;
      const c = UA.ctx, now = c.currentTime;
      if (now - lastHit < 0.13) return;
      lastHit = now;
      if (!soundBuffer || soundBuffer.sampleRate !== c.sampleRate) {
        const N = Math.floor(c.sampleRate * 0.035);
        soundBuffer = c.createBuffer(1, N, c.sampleRate);
        const a = soundBuffer.getChannelData(0);
        for (let i = 0; i < N; ++i) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / N, 2);
      }
      const src = c.createBufferSource(), lp = c.createBiquadFilter(), gain = c.createGain();
      src.buffer = soundBuffer; lp.type = 'lowpass'; lp.frequency.value = 340 + Math.random() * 140;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      src.connect(lp).connect(gain);
      if (c.createStereoPanner) {
        const pan = c.createStereoPanner();
        pan.pan.value = Math.max(-0.65, Math.min(0.65, x / 35));
        gain.connect(pan).connect(UA.bus.master);
      } else gain.connect(UA.bus.master);
      src.start(now); src.stop(now + 0.04);
    };
    return { tick(dt) {
      if (!ROAMS.on || !audioOk() || ROOM.AMB.mute || document.hidden) { avatarT = 0; return; }
      if (!ROAMS.fly && !ROAMS.mini && ROAMS.moving) {
        avatarT += dt;
        const period = ROAMS.run ? 0.25 : 0.38;
        if (avatarT >= period) { avatarT %= period; play(0, 0.018); }
      } else avatarT = 0;
      const friends = window.__FRIENDS || [];
      for (const f of friends) {
        if (f.st !== 'go' || Math.hypot(f.w.position.x - ROAMS.p.x, f.w.position.z - ROAMS.p.z) > 26) continue;
        if (f.stepDist == null) f.stepDist = f.wd;
        if (f.wd - f.stepDist > 5) {
          f.stepDist = f.wd; play(f.w.position.x - ROAMS.p.x, 0.007);
          break; // never create a pile of overlapping step sounds
        }
      }
      // Nearby remote online players use the very same local, low-volume steps.
      // No audio travels over the network: only their movement states are received.
      // The visible local player and the NPC friends are not in this array.
      for (const r of ONLINE.audioPlayers) {
        if (!r.d || !r.w || !r.w.visible) continue;
        const p = r.w.position;
        const a = r.stepAudio || (r.stepAudio = { x: p.x, z: p.z, d: 0 });
        const moved = Math.hypot(p.x - a.x, p.z - a.z);
        a.x = p.x; a.z = p.z;
        const dx = p.x - ROAMS.p.x, dz = p.z - ROAMS.p.z;
        const dist = Math.hypot(dx, dz);
        // Ignore flight, teleporting, stale player packets and objects outside.
        if (!r.d.m || r.d.f || (!!r.d.o !== !!window.ATM_OUT) || !Number.isFinite(moved) || moved > 6 || dist > 26) {
          a.d = 0; continue;
        }
        a.d += moved;
        if (a.d >= 4.2) {
          a.d %= 4.2;
          play(dx, 0.012 * Math.max(0.1, 1 - dist / 28));
          break; // one nearby remote footstep per frame at most
        }
      }
    } };
  })();
  // ---------- bucle ----------
  const clock = new THREE.Clock(); let t = 0; const pend = { it: null, t: 0 }; let MEMO = null, LV = 0; let frameN = 0; let idleT = 0, lastPlaying = false, liftY = 0;
  const tb = new Uint8Array(1024), fb = new Uint8Array(512); let level = 0;
  let frameVisible = true, previousRenderAt = 0;
  // One and only GPU resolution governor for indoor + outdoor gameplay.
  // Keep UI/input/physics/audio and the suitcase untouched. Sampling happens inside
  // the existing frame loop; never add polling, RAFs, textures or forced reloads.
  const adaptivePerf={since:0,frames:0,slow:0,lastChange:0,zone:null};
  function governGraphics(now,frameSeconds){
    // Preserve the existing __perf telemetry contract (used by recovery/QA).
    const initial=S.renderer.getPixelRatio();
    const Q=window.__perf||(window.__perf={
      a:LOWDEV?1/25:1/33,t:0,dpr:initial,max:Math.min(initial,DEVICE.maxDpr),f:0
    });
    Q.a=Q.a*0.88+frameSeconds*0.12;
    Q.f=(Q.f||0)+1;
    const target=LOWDEV?(DEVICE.tier==='compact'?1/24:1/30):(window.ATM_OUT?1/30:1/35);
    window.__LOWFPS=Q.a>target*1.5;
    if(S.renderer.shadowMap.enabled)
      S.renderer.shadowMap.needsUpdate=Q.f%(window.ATM_OUT?7:4)===0;
    S.renderer.shadowMap.autoUpdate=false;
    const zone=window.ATM_OUT?'outside':'inside';
    if(!adaptivePerf.since||adaptivePerf.zone!==zone){
      adaptivePerf.since=now;adaptivePerf.frames=0;adaptivePerf.slow=0;adaptivePerf.zone=zone;
      return;
    }
    // Do not downgrade after an isolated texture compilation, orientation
    // change or a throttled background frame. Require sustained slow frames.
    adaptivePerf.frames++;
    if(frameSeconds>target*1.32)adaptivePerf.slow++;
    if(now-adaptivePerf.since<9000)return;
    const sustained=adaptivePerf.frames>=20 &&
      adaptivePerf.slow/adaptivePerf.frames>=0.7 && Q.a>target*1.32;
    adaptivePerf.since=now;adaptivePerf.frames=0;adaptivePerf.slow=0;
    if(!sustained||now-adaptivePerf.lastChange<14000)return;
    const floor=Math.min(Q.max,LOWDEV?0.60:0.75);
    const current=Math.min(S.renderer.getPixelRatio(),Q.max);
    const next=Math.max(floor,Math.round((current-0.10)*100)/100);
    if(next>=current-0.015)return;
    S.renderer.setPixelRatio(next);
    S.renderer.setSize(renderWidth||innerWidth,renderHeight||innerHeight,false);
    Q.dpr=next;
    adaptivePerf.lastChange=now;
    document.documentElement.dataset.unfireAdaptiveQuality='on';
  }
  // Opening the website/direct-link case keeps the camera on the physical
  // maletín. Exploring as the robot is an explicit separate player choice.
  // The lid animation and all equipment remain available in this view.
  let seaBuild = null, seaBuildFailed = false;
  function ensureSeaAmbience() {
    if (window.__SEA || seaBuild || seaBuildFailed || !ROAMS.on) return;
    const nearDoor = !window.ATM_OUT && ROAMS.p.z > 66 && Math.abs(ROAMS.p.x + 30) < 25;
    const nearDome = !window.ATM_OUT && ROAMS.fly && ROAMS.h > 7 &&
      Math.hypot(ROAMS.p.x, ROAMS.p.z - 40) < 95;
    if (!window.ATM_OUT && !nearDoor && !nearDome) return;
    if (!audioOk()) return;
    const c = UA.ctx;
    if (!c || c.state === 'closed') return;
    const state = seaBuild = { channel: 0, offset: 0, prev: 0, scheduled: false,
      buffer: null, channels: null, frames: 0 };
    const schedule = () => {
      if (!state.scheduled) {
        state.scheduled = true;
        setTimeout(fillSlice, 24);
      }
    };
    function fillSlice() {
      state.scheduled = false;
      if (seaBuild !== state || window.__SEA) return;
      if (document.hidden) {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && seaBuild === state) schedule();
        }, { once: true });
        return;
      }
      try {
        if (c.state === 'closed') { seaBuild = null; return; }
        if (!state.buffer) {
          state.frames = Math.max(1024, Math.floor(c.sampleRate * 4));
          state.buffer = c.createBuffer(2, state.frames, c.sampleRate);
          state.channels = [state.buffer.getChannelData(0), state.buffer.getChannelData(1)];
        }
        const deadline = performance.now() + 2;
        let completed = 0;
        while (state.channel < 2 && completed < 3072 && performance.now() < deadline) {
          const samples = state.channels[state.channel];
          const end = Math.min(state.frames, state.offset + 512,
            state.offset + 3072 - completed);
          for (; state.offset < end; state.offset++) {
            state.prev = state.prev * 0.985 + (Math.random() * 2 - 1) * 0.12;
            samples[state.offset] = state.prev;
            completed++;
          }
          if (state.offset === state.frames) {
            state.channel++; state.offset = 0; state.prev = 0;
          }
        }
        if (state.channel < 2) { schedule(); return; }
        const src = c.createBufferSource(); src.buffer = state.buffer; src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(lp).connect(g).connect(UA.bus.master);
        const src2 = c.createBufferSource(); src2.buffer = state.buffer;
        src2.loop = true; src2.playbackRate.value = 1.7;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 1600; bp.Q.value = 0.6;
        const g2 = c.createGain(); g2.gain.value = 0;
        const wl = c.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 2000;
        src2.connect(bp).connect(wl).connect(g2).connect(UA.bus.master);
        src.start(); src2.start();
        window.__SEA = { g, g2, lp, bp, wl };
        seaBuild = null;
      } catch (error) {
        seaBuild = null; seaBuildFailed = true;
        console.warn('Unfire outdoor ambience initialization skipped', error);
      }
    }
    schedule();
  }
  function frame(now) {
    // Park the heavy animation loop when hidden/out of the hero: never spend 60 callbacks/sec there.
    if (document.hidden || !frameVisible) {
      previousRenderAt = 0; adaptivePerf.since=0; adaptivePerf.frames=0; adaptivePerf.slow=0; clock.getDelta();
      setTimeout(() => requestAnimationFrame(frame), 180);
      return;
    }
    requestAnimationFrame(frame);
    // Pause GPU draws while opaque overlays own the screen. On software WebGL
    // a background draw can otherwise starve CLOSE taps in the story menu.
    // Continue dispatching DOM input; resume the exact scene on close.
    // Pause costly draws while the transient robot/settings panel is expanded.
    // Its DOM pointer events continue normally; button clicks auto-dismiss it
    // after 150ms, so NANO's visual transform resumes without losing progress.
    const settingsHudOpen = document.getElementById('storyHud')?.classList.contains('cfgOn');
    if (settingsHudOpen) {
      clock.getDelta(); previousRenderAt = 0;
      adaptivePerf.since=0; adaptivePerf.frames=0; adaptivePerf.slow=0;
      return;
    }
    const storyMenuOpen = document.getElementById('storyMenu')?.style.display === 'block';
    if (MAP.expandedOpen || (window.UNFIRE_COINS && window.UNFIRE_COINS.isOpen) || storyMenuOpen) {
      clock.getDelta();
      previousRenderAt = 0;
      adaptivePerf.since=0;adaptivePerf.frames=0;adaptivePerf.slow=0;
      if (MAP.expandedOpen) MAP.tick();
      return;
    }
    // Software rasterizers can monopolize the main thread even at 24fps.
    // Limit draw frequency (not pointer/touch handlers) so UI can return from modals.
    if (SOFTWARE_WEBGL && previousRenderAt && now - previousRenderAt < 80) return;
    // Cap this heavy 3D scene to ~30-40fps on accelerated hardware; input remains unthrottled.
    if (previousRenderAt && now - previousRenderAt < (LOWDEV ? (DEVICE.tier==='compact' ? 42 : 33) : window.ATM_OUT ? 33 : 28)) return;
    // Case/camera animations must use real foreground elapsed time even if
    // WebGL renders only a few frames per second. Physics keeps its bounded
    // delta, and the hidden-tab branch resets previousRenderAt for safe resume.
    const foregroundFrameTime = previousRenderAt ? Math.min(6, Math.max(0.008, (now - previousRenderAt) / 1000)) : 1 / 30;
    const actualFrameTime = Math.min(0.18, foregroundFrameTime);
    previousRenderAt = now;
    const dt = Math.min(0.05, clock.getDelta()) * (window.__dts || 1); t += dt;
    // A packed case is inventory-only: no heavy model following or obscuring the camera.
    updateCarryUI();
    { const stowed = (!HW || ((HW.u || 0) < 0.03 && (HW.T || 0) < 0.05)) && CK.every((k) => compG[k].userData.t < 0.04) && !open.length && !items.some((it) => (it.kind === 'mut' && it.T > 0.05) || (it.kk || 0) > 0.05 || it.retT > 0) && !flyers.length;
      let pt = pTarget;
      if (pt < pNow && !lidControlledByPlayer && !stowed && pNow > 0.86) { pt = Math.max(pt, 0.9); STOW = true; } else if (stowed) STOW = false;
      if (lidControlledByPlayer) {
        if (Math.abs(lidMotion.to-pt)>0.0001) {
          lidMotion.from=pNow;lidMotion.to=pt;lidMotion.elapsed=0;
          lidMotion.duration=pt>pNow?Math.max(0.85,3.0*Math.abs(pt-pNow)):Math.max(0.42,1.6*Math.abs(pt-pNow));
        }
        // Use real elapsed frame time for consistent physical timing.
        lidMotion.elapsed=Math.min(lidMotion.duration,lidMotion.elapsed+foregroundFrameTime);
        const alpha=ease.smooth(clamp(lidMotion.elapsed/lidMotion.duration));
        pNow=lidMotion.from+(lidMotion.to-lidMotion.from)*alpha;
      } else {
        pNow+=(pt-pNow)*(1-Math.exp(-5.2*Math.min(0.12,actualFrameTime)));
        lidMotion.to=pNow;lidMotion.from=pNow;lidMotion.elapsed=0;
      }
    } CASE_SOUND.sync(pNow,pTarget,lidControlledByPlayer); setLid(pNow); updateRoamButtonHint();
    // Only prewarm after the physical lid has finished opening and WebGL is ready.
    if (!roomPrewarmRequested && !ROAMS.on && !document.hidden &&
        frameVisible && lidOpen > 0.985 && !entryDolly.active) {
      roomPrewarmRequested = true;
      setTimeout(prewarmRoamingProps, 120);
    } oledSet(lidOpen < 0.03 ? 'CERRADO' : gateK > 0.95 ? 'ABIERTO' : 'ABRIENDO'); if (lidOpen < 0.6) CK.forEach((k) => (compG[k].userData.open = 0));
    const busy = (k) => open.some((g) => g.it.comp === k && g.m > 0.04) || items.some((it) => it.comp === k && ((it.kind === 'mut' && it.T > 0.04) || (it.g && (it.kk || 0) > 0.04))) || (k === 'hw' && HW && ((HW.T || 0) > 0.05 || (HW.u || 0) > 0.03));
    CK.forEach((k) => { if (compG[k].userData.open && lidOpen > 0.95) return; open.forEach((g) => { if (g.it.comp === k && !g.closing) { g.it.was = 1; g.closing = true; g.pin = false; g.manual = 0; } }); items.forEach((it) => { if (it.comp !== k) return; if (it.kind === 'mut' && it.tgt) { it.was = it.tgt; it.tgt = 0; } if (it.g && it.on) { it.was = 1; it.on = 0; } }); if (k === 'hw' && HW) HW.tg = 0; if (SEL && ((SEL.type === 'cap' && SEL.g.it.comp === k) || (SEL.it && SEL.it.comp === k) || (SEL.type === 'hw' && k === 'hw'))) SEL = null; });
    CK.forEach((k) => { if (!(compG[k].userData.open && compG[k].userData.t > 0.97)) return; items.forEach((it, i) => { if (it.comp !== k || !it.was) return; const w = it.was; it.was = 0; setTimeout(() => { if (it.kind === 'cap') openGear(it, true); else if (it.kind === 'mut') it.tgt = w; else if (it.g) it.on = 1; }, 200 + (i % 8) * 180); }); });
    CK.forEach((k) => { const u = compG[k].userData; u.t = clamp(u.t + (u.open && lidOpen > 0.95 ? dt * 0.55 : busy(k) ? 0 : -dt * 2)); compG[k].position.y = -0.34 * (1 - ease.smooth(clamp((u.t - 0.7) / 0.3))); });
    HATCH.forEach((H) => { const k2 = ease.smooth(clamp((compG[H.k].userData.t - 0.45) / 0.25)); H.pl.forEach((p) => (p.scale.x = Math.max(0.02, 1 - k2))); H.hole.scale.x = Math.max(0.01, k2); H.hole.visible = k2 > 0.01; });
    gateK = Math.max(...CK.map((k) => compG[k].userData.t)); gates.forEach((G) => { const e = compG[G.k].userData.t;
      if (G.type === 'dome') { const a = ease.smooth(clamp(e / 0.45)), b = ease.smooth(clamp((e - 0.42) / 0.33)); G.segs.forEach((s0, i) => { s0.rotation.y = -i * TAU / 8 * a; s0.position.set(0, 0, 0); const fb = ease.smooth(b); s0.scale.set(1 - 0.25 * fb, Math.max(0.02, 1 - fb), 1 - 0.25 * fb); s0.rotation.z = Math.sin(fb * Math.PI) * 0.18 * (i % 2 ? 1 : -1); s0.visible = b < 0.99; }); G.g.children.forEach((ch) => { if (!G.segs.includes(ch)) ch.visible = b < 0.9; }); G.ed.material = e > 0.3 ? LEDG : G.ed.userData.m || (G.ed.userData.m = G.ed.material); if (e > 0.85 && !G.boom) { G.boom = 1; boom(); } if (e < 0.1) G.boom = 0; return; }
      const s2 = ease.smooth(clamp(e * 1.6)) * (G.d + 0.06); G.list.forEach((g) => { let z = g.userData.z - s2, y = 0.115, r = 0; if (z < G.c.z0) { const ex = G.c.z0 - z; z = G.c.z0 - 0.012; y = 0.115 - ex; r = -H2 * Math.min(1, ex / 0.05); } g.position.set(g.position.x, y, z); g.rotation.x = r; g.visible = y > -0.45; }); });
    lidBtn.userData.dome.material.emissiveIntensity = allOpen() ? 0.15 : 0.45 + 0.35 * Math.sin(t * 3); if(window.__ringB)window.__ringB.scale.setScalar(1.45*(1+0.1*Math.sin(t*3)));
    const lk = clamp(gateK * 1.25); laser.visible = false; laser.position.set(-CW / 2 + 0.1 + lk * (CW - 0.2), 0.14, 0); 
    if (lidOpen < 0.5 && ALL) { ALL = false; } if(window.__hexPan)window.__hexPan.material.emissiveIntensity=0.25+0.2*Math.max(0,Math.sin(t*1.5+1))+0.5*clamp(lidOpen*3); if (window.__fd) window.__fd.material.emissiveIntensity = lidOpen < 0.3 ? 0.6 + 0.5 * Math.sin(t * 4) : 0.2; plate.material.emissiveIntensity = lidOpen < 0.3 ? 0.12 + 0.12 * Math.sin(t * 3) : 0;
    ELEV.a += (lerp(0.55, view.gd > view.D0 * 1.25 ? 0.32 : zoomed() || CINE.on ? 0.98 : 0.6, ease.smooth(clamp(lidOpen * 1.15))) - ELEV.a) * 0.2; ORB.az += (ORB.gaz - ORB.az) * 0.15; ORB.de += (ORB.gde - ORB.de) * 0.15; const el = clamp(ELEV.a + ORB.de, 0.12, 1.5); DIR.set(Math.sin(ORB.az) * Math.cos(el), Math.sin(el), Math.cos(ORB.az) * Math.cos(el));
    if (zoomed() && mouse.in && !drag && !knobDrag && performance.now() - mouse.t < 4000) { const ez = (v) => (Math.abs(v) > 0.6 ? (v - Math.sign(v) * 0.6) / 0.4 : 0), a = ez(mouse.nx), b = ez(mouse.ny), ca = Math.cos(ORB.az), sa = Math.sin(ORB.az); view.gx = clamp(view.gx + (a * ca + b * sa) * view.dist * 0.8 * dt, -CW / 2, CW / 2); view.gz = clamp(view.gz + (-a * sa + b * ca) * view.dist * 0.8 * dt, -CD / 2, CD / 2); }
    cv.classList.toggle('dive', zoomed());
    if (lidOpen < 0.98 && !MEMO && (open.length || items.some((it) => it.T > 0.5 || it.on) || (HW && HW.tg > 0) || CK.some((k) => compG[k].userData.open))) MEMO = { comps: CK.filter((k) => compG[k].userData.open && k !== 'hw'), caps: open.filter((g) => !g.closing).map((g) => g.it), muts: items.filter((it) => it.kind === 'mut' && it.tgt > 0), devs: items.filter((it) => it.on), hw: false };
    if (lidOpen > 0.97 && MEMO && pTarget > 0.97) { const M2 = MEMO; MEMO = null; M2.comps.forEach(openComp); setTimeout(() => { M2.caps.forEach((it) => openGear(it, true)); M2.muts.forEach((it) => (it.tgt = 3)); M2.devs.forEach((it) => (it.on = 1)); if (M2.hw && HW) HW.tg = 3.6; }, 1600); }
    if (lidOpen < 0.98 && MEGA) megaOff();
    if (lidOpen < 0.9) { CK.forEach((k) => { const u = compG[k].userData; u.open = 0; u.t = Math.min(u.t, Math.max(0, (lidOpen - 0.2) / 0.7)); }); if (HW) { HW.T = Math.max(0, (HW.T || 0) - dt * 4); HW.u = Math.min(HW.u || 0, Math.max(0, (lidOpen - 0.3) / 0.6)); } items.forEach((it) => { if (it.W && it.home && !it.retT) { it.W.position.lerp(it.home, 0.2); it.W.rotation.set(0, 0, 0); } }); }
    if (lidOpen < 0.98 || STOW) { if (HW) HW.equip = false; CK.forEach((k) => { compG[k].userData.open = 0; }); if (CINE.on) CINE.on = false; open.forEach((g) => { g.closing = true; g.pin = false; }); items.forEach((it) => { if (it.kind === 'mut') it.tgt = 0; if (it.g) it.on = 0; }); if (HW) { HW.tg = 0; HW.closeGate = 1; } SEL = null; MV = null; } if (lidOpen < 0.85 && (open.length || A.using)) { closeAll(true); stopAll(); }
    if(entryDolly.active&&!ROAMS.on){
      entryDolly.elapsed=Math.min(entryDolly.duration,entryDolly.elapsed+foregroundFrameTime);
      const u=ease.smooth(clamp(entryDolly.elapsed/entryDolly.duration));
      view.dist=entryDolly.from+(entryDolly.to-entryDolly.from)*u;
      if(u>=1){entryDolly.active=false;if(entryDolly.openAfter){entryDolly.openAfter=false;pTarget=1;}}
    }else{view.dist+=(view.gd-view.dist)*(1-Math.exp(-6*Math.min(.12,actualFrameTime)));}
    view.tx += (view.gx - view.tx) * 0.14; view.tz += (view.gz - view.tz) * 0.14;
    if (!open.length && !items.some((it) => it.kind === 'mut' && it.T > 2.5) && RADIO.st.on) { idleT += dt; if (idleT > 1.6) RADIO.stop(); } else idleT = 0;
    const playing = !!(RADIO.st.on || A.using); if (playing !== lastPlaying) { lastPlaying = playing; parentPost({ playing }); }
    liftY += ((CINE.on && CINE.o && CINE.y != null ? CINE.y : robot ? robot.R.root.position.y * 0.8 : 0) - liftY) * 0.12; if (!CINE.on) CINE.o = null;
    const zo = Math.min(1.35, view.dist / view.D0), ty = HB + liftY + 0.25 * zo ** 2 + 0.7 * lidOpen * zo ** 2;
    cam.position.set(view.tx, ty, view.tz).addScaledVector(DIR, view.dist * (1 + 0.1 * lidOpen * zo * zo)); if (view.shake > 0) { view.shake = Math.max(0, view.shake - dt); cam.position.x += (Math.random() - 0.5) * 0.04 * view.shake; cam.position.y += (Math.random() - 0.5) * 0.04 * view.shake; } cam.lookAt(view.tx, ty, view.tz); cam.near = Math.max(0.02, view.dist * 0.05); // One camera profile for offline and online: slightly wider in normal play,
    // smoothly widening as thruster speed increases. Never use a fish-eye FOV.
    const thrusterK = ROAMS.on && ROAMS.fly && !ROAMS.mini
      ? clamp(((ROAMS.spd || 0) - 85) / 700, 0, 1) : 0;
    ROAMS.camBoost = (ROAMS.camBoost || 0) + (thrusterK - (ROAMS.camBoost || 0)) * Math.min(1, dt * 3.6);
    const baseFov = ROAMS.on ? (ROAMS.mini ? 70 : 83 + 9 * ROAMS.camBoost) : 30;
    // Modest panoramic gameplay on wide screens, with a bounded portrait
    // correction. Keep straight architecture natural, not a fish-eye lens.
    const portraitCorrection = cam.aspect < 1 ? Math.min(1.18, 1 + (1 - cam.aspect) * 0.28) : 1;
    const desiredFov = Math.min(98, baseFov * portraitCorrection);
    const nextFov = cam.fov + (desiredFov - cam.fov) * Math.min(1, dt * 4.2);
    if (Math.abs(cam.fov - nextFov) > 0.005) {
      cam.fov = nextFov;
      cam.updateProjectionMatrix(); // FOV changes must reach the GPU, not only the property.
    } window.__roam = ROAMS.on || view.gd > view.D0 * 1.2; if (ROAMS.on) { const K = CASE_VIEW.on || NANO_CINEMA.busy() ? {} : ROAMS.k; if (K.ArrowUp || K.ArrowDown) ROAMS.tgt = null; const fw = REC.on ? 0 : (K.ArrowUp || K.w ? 1 : 0) - ((K.ArrowDown || K.s) && !ROAMS.fly ? 1 : 0), sd2 = REC.on ? 0 : (K.ArrowRight || K.d ? 1 : 0) - (K.ArrowLeft || K.a ? 1 : 0); if (ROAMS.cy == null) ROAMS.cy = ROAMS.yaw; const GTA = ((ROAMS.mode || '3p') === '3p' || ROAMS.mode === '3pl' || ROAMS.mode === '2p'); ROAMS.run = false;
      // One continuous propulsion sample drives translation, climb and camera
      // for the whole frame. HUD refreshes do not create a second flight speed.
      const flightProp = window.ATM_OUT && ROAMS.fly && window.__PROP
        ? clamp(window.__PROP(), 1, 8) : 1;
      ROAMS.propEffective = flightProp;
      if (fw || sd2) { ROAMS.tgt = null; ROOM.R.userData.camTrack = null; const ms = avatarProfile().speedScale; const SPD = (K.Shift ? 1.8 : K.Alt ? 0.5 : 1) * (window.ATM_OUT ? 1.55 : 0.78) * (ROAMS.perkV || 1);
        if (GTA) { const dir = ROAMS.yaw + Math.atan2(sd2, fw), y0 = ROAMS.yaw; ROAMS.cy = angL(ROAMS.cy, dir, Math.min(1, dt * 10)); ROAMS.yaw = ROAMS.cy; const wet = window.ATM_OUT && !(window.__LAND ? window.__LAND(ROAMS.p.x, ROAMS.p.z) : Math.hypot(ROAMS.p.x, ROAMS.p.z) < 258) && !(ROAMS.h > (ROAMS.fl || 0) + 8) && !ROAMS.fly; let sl = 1; if (wet && window.__WAVE) { const dx2 = Math.sin(dir) * 4, dz2 = -Math.cos(dir) * 4; sl = clamp(1 - (window.__WAVE(ROAMS.p.x + dx2, ROAMS.p.z + dz2, t) - window.__WAVE(ROAMS.p.x, ROAMS.p.z, t)) * 0.22, 0.7, 1.6); } ROAMS.surfV = (ROAMS.surfV || 1) + (sl - (ROAMS.surfV || 1)) * Math.min(1, dt * 2); const vv0 = 34 * ms * SPD * (wet ? (ROAMS.board ? 1.9 * ROAMS.surfV : 1.15) : 1) * (ROAMS.fly ? (window.ATM_OUT ? 2.6 * flightProp : 1.4) : 1); const vv = NANO_CINEMA.cruise(vv0, flightProp, !!K.Shift, !!K.Alt); ROAMS.run = vv > 18 * ms && !wet; ROAMS.wet = wet; ROAMS.vvS = ROAMS.fly ? (ROAMS.vvS || vv) + (vv - (ROAMS.vvS || vv)) * (1 - Math.exp(-3.2 * dt)) : vv; const ox = ROAMS.p.x, oz = ROAMS.p.z; roamMove(dt * ROAMS.vvS, 0); ROAMS.wd = (ROAMS.wd || 0) + Math.hypot(ROAMS.p.x - ox, ROAMS.p.z - oz); ROAMS.yaw = y0; if (fw >= 0) ROAMS.yaw = angL(ROAMS.yaw, ROAMS.cy, Math.min(1, dt * (sd2 ? 1.2 : 2.6))); }
        else if (ROAMS.mode === '1p') { ROAMS.yaw += sd2 * dt * 2.0; ROAMS.cy = ROAMS.yaw; const wet = window.ATM_OUT && !(window.__LAND ? window.__LAND(ROAMS.p.x, ROAMS.p.z) : true) && !(ROAMS.h > (ROAMS.fl || 0) + 8) && !ROAMS.fly; const vv0 = 34 * ms * SPD * (wet ? 2.0 : 1) * (ROAMS.fly ? (window.ATM_OUT ? 2.6 * flightProp : 1.4) : 1); const vv = NANO_CINEMA.cruise(vv0, flightProp, !!K.Shift, !!K.Alt); ROAMS.run = vv > 18 * ms && !wet; ROAMS.wet = wet; ROAMS.vvS = ROAMS.fly ? (ROAMS.vvS || vv) + (vv - (ROAMS.vvS || vv)) * (1 - Math.exp(-3.2 * dt)) : vv; const ox = ROAMS.p.x, oz = ROAMS.p.z; roamMove(fw * dt * ROAMS.vvS * (fw < 0 ? 0.6 : 1), 0); ROAMS.wd = (ROAMS.wd || 0) + Math.hypot(ROAMS.p.x - ox, ROAMS.p.z - oz); } else { ROAMS.cy = ROAMS.yaw; roamMove(fw * dt * 44 * ms * SPD, sd2 * dt * 34 * ms * SPD); } } ROAMS.moving = !!(fw || sd2);
      { if (ROAMS.h == null) { ROAMS.h = 0; ROAMS.vy = 0; } const fl = (() => { if (window.ATM_OUT) { if (Math.abs(ROAMS.p.x) < 82 && ROAMS.p.z > -18 && ROAMS.p.z < 98 && -8.9 + (ROAMS.h || 0) > 25) { const inDome = Math.hypot(ROAMS.p.x, ROAMS.p.z - 40) < 37 && window.__DOME && window.__DOME.open > 0.6; if (!inDome) return 26.6 + 8.9 + 0.2; return 0; } if (window.__SKYDEV && (ROAMS.h || 0) > 40) { for (const o of window.__SKYDEV()) { if (!o.visible) continue; const s = o.scale.x, top = o.position.y + s * 0.45; if (Math.hypot(ROAMS.p.x - o.position.x, ROAMS.p.z - o.position.z) < s * 0.7 && top + 9 <= ROAMS.h + 2 && top + 9 > ROAMS.h - 60) { ROAMS.onDevN = o; return top + 9; } } } { const ih = window.__ISLE_H ? window.__ISLE_H(ROAMS.p.x, ROAMS.p.z) : null; if (ih != null) return ih + 9; } if (window.__WAVE && window.__LAND && !window.__LAND(ROAMS.p.x, ROAMS.p.z)) { return window.__WAVE(ROAMS.p.x, ROAMS.p.z, t) - (ROAMS.board ? -1.1 : 0.85); } let g = 0; for (const B of COLLISION(window.__OBSTO, ROAMS.p.x, ROAMS.p.z, 1)) if (B.y1 != null && ROAMS.p.x > B.x0 + 0.9 && ROAMS.p.x < B.x1 - 0.9 && ROAMS.p.z > B.z0 + 0.9 && ROAMS.p.z < B.z1 - 0.9 && B.y1 + 9 <= ROAMS.h + 0.6) g = Math.max(g, B.y1 + 9); return g; } if (!window.__OBST) return 0; let g = 0; const p = ROAMS.p; for (const B of COLLISION(window.__OBST, ROAMS.p.x, ROAMS.p.z, 1)) if (B.y1 != null && p.x > B.x0 + 0.9 && p.x < B.x1 - 0.9 && p.z > B.z0 + 0.9 && p.z < B.z1 - 0.9 && B.y1 + 8.9 <= ROAMS.h + 0.6 * (ROAMS.mini ? NANO_SCALE : 1)) g = Math.max(g, B.y1 + 8.9); return g; })(); ROAMS.fl = fl; { const o = ROAMS.onDevN; ROAMS.onDevN = null; const onTop = o && (ROAMS.h || 0) <= fl + 1.5; if (onTop) { if (ROAMS.devObj === o && ROAMS.devPrev) { ROAMS.p.x += o.position.x - ROAMS.devPrev.x; ROAMS.p.z += o.position.z - ROAMS.devPrev.z; } ROAMS.devObj = o; ROAMS.devPrev = o.position.clone(); if (ROAMS.landedOn !== o) { ROAMS.landedOn = o; let n = 0; try { n = (+localStorage.getItem('unfire_skyland') || 0) + 1; localStorage.setItem('unfire_skyland', String(n)); } catch (e) {} if (n % 3 === 0) { try { window.__REWARD('Landed on ' + n + ' plugins gigantes'); } catch (e) {} } else say(n % 3 === 0 ? '' : '🛬 You landed on a giant plugin! (' + n + ') · land on three to complete the mission · hold SPACE to take off'); hap(0.5); } } else { ROAMS.devObj = null; if (!o) ROAMS.landedOn = (ROAMS.h || 0) > 60 ? ROAMS.landedOn : null; } } if (ROAMS.board && ROAMS.wet && K[' '] && ROAMS.spDown && performance.now() - ROAMS.spDown > 450 && !ROAMS.fly) { ROAMS.fly = true; ROAMS.climbV = 0; ROAMS.flyT = 0; ROAMS.trick = null; }
        ROAMS.wet = !!window.ATM_OUT && !(window.__LAND ? window.__LAND(ROAMS.p.x, ROAMS.p.z) : Math.hypot(ROAMS.p.x, ROAMS.p.z) < 258) && !ROAMS.fly; ROAMS.wk = (ROAMS.wk || 0) + ((ROAMS.fly ? 1 : 0) - (ROAMS.wk || 0)) * Math.min(1, dt * 3); if (ROAMS.fly) { const miniFlight = ROAMS.mini && window.ATM_OUT ? Math.max(0.64, avatarProfile().speedScale) : avatarProfile().speedScale; const hov = Math.max(fl, (window.ATM_OUT ? 22 : 9)*miniFlight); ROAMS.flyT = (ROAMS.flyT || 0) + dt; const sink = window.ATM_OUT ? Math.min(420, 10 + (ROAMS.h || 0) * 0.14) : 5; ROAMS.climbV = K[' '] ? Math.min(Math.max(ROAMS.climbV || 0, 0) + dt * (window.ATM_OUT ? 150 : 22) * (ROAMS.perkF || 1), (window.ATM_OUT ? 380 : 12) * (ROAMS.perkF || 1)) : K.f ? -Math.min(window.ATM_OUT ? 1200 : 18, Math.abs(ROAMS.climbV || 0) + dt * 1500) : (K.s || K.ArrowDown) ? (ROAMS.climbV || 0) + (-Math.max(window.ATM_OUT ? 60 : 8, sink * 1.6) - (ROAMS.climbV || 0)) * Math.min(1, dt * 3) : (ROAMS.climbV || 0) * Math.max(0, 1 - dt * 4); // Vertical thrust follows the selected propulsion, while preserving fine landing control.
        const propLevel = flightProp;
        const verticalBoost = window.ATM_OUT ? Math.min(3.1,1+(Math.sqrt(propLevel)-1)*0.62) : 1;
        const roof = window.__DOME;
        const domeDistance = roof && roof.c ? Math.hypot(ROAMS.p.x-roof.c.x,ROAMS.p.z-roof.c.z) : Infinity;
        const domeApproach = !!(window.ATM_OUT && roof && roof.c && domeDistance<43 &&
          ROAMS.h>roof.c.y+0.9 && ROAMS.h<145 &&
          (K.f||K.s||K.ArrowDown||ROAMS.climbV<-1));
        const domeWaiting = domeApproach && roof.open<0.75;
        const climb = clamp(ROAMS.climbV*miniFlight*verticalBoost,-760,760);
        const safeClimb = domeApproach && climb<0 ? Math.max(-22,climb) : climb;
        const up = miniFlight * (fw ? Math.sin(ROAMS.pitch) * (window.ATM_OUT ? 260 : 30) * fw * (K.Shift ? 2 : 1) : 0) * Math.sqrt(propLevel) + safeClimb;
        const inDomeI = !window.ATM_OUT && Math.hypot(ROAMS.p.x, ROAMS.p.z - 40) < 36; ROAMS.flyH = Math.max(domeWaiting ? Math.max(fl,roof.c.y+8.9+6) : fl,
          Math.min(window.ATM_OUT ? 8000 : inDomeI ? 60 : 14, (ROAMS.flyH == null ? hov : ROAMS.flyH) + up * dt));
        // No periodic altitude wobble: a camera following this physics looked
        // like the player was bouncing, especially at x3/x8.
        ROAMS.vy = (ROAMS.flyH - ROAMS.h) * 6;
        if (window.ATM_OUT) {
          // Brake BEFORE reaching the roof or a landing surface; never tunnel
          // through a closed dome when high thrust or a long frame is involved.
          if (ROAMS.vy<0) {
            const clearance=Math.max(0,ROAMS.h-fl);
            const maxDown=domeApproach ? 18 : Math.min(ROAMS.mini ? 210 : 650,Math.max(14,clearance*2.8));
            ROAMS.vy=Math.max(ROAMS.vy,-maxDown);
          } else ROAMS.vy=Math.min(ROAMS.vy,ROAMS.mini ? 230 : 650);
        }
        if (ROAMS.flyT > 1.2 && !K[' '] && ROAMS.flyH <= fl + 0.3 && ROAMS.h <= fl + 0.6) { ROAMS.fly = false; ROAMS.climbV = 0; say('🦶 Aterrizado'); } } else { ROAMS.flyH = null; ROAMS.vy -= dt * (ROAMS.h > fl + 40 ? 300 : avatarProfile().gravity); if (ROAMS.vy < -700) ROAMS.vy = -700; if (ROAMS.h < fl + 30 && ROAMS.vy < -40) ROAMS.vy += (-40 - ROAMS.vy) * Math.min(1, dt * 4); } ROAMS.h += ROAMS.vy * dt; const inDomeT = !window.ATM_OUT && Math.hypot(ROAMS.p.x, ROAMS.p.z - 40) < 36; const top = window.ATM_OUT ? 8000 : inDomeT ? 60 : 14; if (ROAMS.h > top) { ROAMS.h = top; ROAMS.vy = Math.min(ROAMS.vy, 0); } if (!ROAMS.fly && !ROAMS.wet && ROAMS.vy <= 0 && ROAMS.h > fl && ROAMS.h - fl < (ROAMS.mini ? 0.08 : 1.6)) { ROAMS.h = fl; ROAMS.vy = 0; } if (ROAMS.h < fl) { ROAMS.h = ROAMS.wet ? ROAMS.h + (fl - ROAMS.h) * Math.min(1, dt * 10) : fl; ROAMS.vy = 0; } ROAMS.air = ROAMS.h > fl + (ROAMS.mini ? 0.05 : 0.9); } { const CT = ROOM.R.userData.camTrack; if (CT && !(fw || sd2)) { const CD0 = ROOM.R.userData.camTrackDir; const d = CD0 ? V(CD0.x, 0, CD0.z) : V(cam.position.x - CT.x, 0, cam.position.z - CT.z); if (d.lengthSq() < 0.01) d.set(0, 0, 1); d.normalize(); const side = V(-d.z, 0, d.x); const p = V(CT.x + d.x * 12 + side.x * 9, CT.y + 2.2, CT.z + d.z * 12 + side.z * 9); const lx = CT.x - p.x, lz = CT.z - p.z; ROAMS.tgt = { p, yaw: Math.atan2(lx, -lz), pitch: Math.atan2(CT.y - p.y, Math.hypot(lx, lz)) }; } } if (ROAMS.tgt) { const T0 = ROAMS.tgt; const dx = T0.p.x - ROAMS.p.x, dz = T0.p.z - ROAMS.p.z, d = Math.hypot(dx, dz); if (d > 1.2) { let dir = Math.atan2(dx, -dz); if ((ROAMS.stkN || 0) > 6) { if (!ROAMS.avoidS) ROAMS.avoidS = Math.random() < 0.5 ? 1 : -1; dir += ROAMS.avoidS * 1.2; } else if ((ROAMS.stkN || 0) === 0) ROAMS.avoidS = 0; ROAMS.cy = angL(ROAMS.cy == null ? dir : ROAMS.cy, dir, Math.min(1, dt * 8)); const sp = Math.min(d, (d > 25 ? 42 : 24) * dt * (window.ATM_OUT ? 1.6 : 1)); const y0 = ROAMS.yaw; ROAMS.yaw = ROAMS.cy; const ox = ROAMS.p.x, oz = ROAMS.p.z; roamMove(sp, 0); ROAMS.yaw = y0; ROAMS.wd = (ROAMS.wd || 0) + Math.hypot(ROAMS.p.x - ox, ROAMS.p.z - oz); ROAMS.moving = true; ROAMS.run = d > 25; ROAMS.yaw = angL(ROAMS.yaw, ROAMS.cy, Math.min(1, dt * 4)); } else { ROAMS.avoidS = 0; ROAMS.p.y += (T0.p.y - ROAMS.p.y) * 0.1; ROAMS.yaw = angL(ROAMS.yaw, T0.yaw, 0.1); } ROAMS.pitch += (T0.pitch - ROAMS.pitch) * 0.1; } if (K.q) ROAMS.yaw -= dt * 1.9; if (K.e) ROAMS.yaw += dt * 1.9; const cp = Math.cos(ROAMS.pitch); if (!ROAMS.av) { try { const r0 = ROBOT.build(Object.assign({}, MUTANTS.list[(ROAMS.myType == null ? 4 : ROAMS.myType) % MUTANTS.list.length], { n: ROAMS.myNum || 27 })); r0.update(3.7, 0.016, {}); if (ROAMS.myCol && window.__tintAvatar) window.__tintAvatar(r0.root, ROAMS.myCol); if(window.__applyRobotStyle)window.__applyRobotStyle(r0.root); const w = new THREE.Group(); w.add(r0.root); const bb = new THREE.Box3().setFromObject(r0.root); w.scale.setScalar(10.5 / Math.max(bb.getSize(V(0, 0, 0)).y, 0.001)); r0.root.position.y -= bb.min.y; S.scene.add(w); const WG = new THREE.Group(); const s0 = w.scale.x || 1; w.rotation.order = 'YXZ'; WG.position.set(0, 10.5 * 0.62 / s0, -1.0 / s0); let bodyMat = null; r0.root.traverse((o) => { if (!bodyMat && o.isMesh && o.material && o.material.color && (o.material.metalness || 0) > 0.3) bodyMat = o.material; }); const bladeM = bodyMat ? bodyMat : new THREE.MeshPhysicalMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.18, clearcoat: 1 }); const acc = new THREE.Color((MUTANTS.list[4 % MUTANTS.list.length].accent) || '#ff2a4a'); const tipM = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 1.1, toneMapped: false });
          const wingM = new THREE.MeshPhysicalMaterial({ color: 0x3fd65a, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }); const stripeM = new THREE.MeshPhysicalMaterial({ color: 0xf4f6fa, metalness: 0.7, roughness: 0.2, clearcoat: 1 });
          const side = (sg) => { const root = new THREE.Group(); const pod = mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.5, 16), bodyMat || stripeM); pod.rotation.z = Math.PI / 2; pod.position.x = sg * 0.55; root.add(pod);
            const hinge = new THREE.Group(); hinge.position.x = sg * 0.9; root.add(hinge);
            // ala de avión barrida (estilo planeador de Ratchet): perfil con flecha, punta con winglet y franja blanca
            const sh = new THREE.Shape(); sh.moveTo(0, 0.55); sh.lineTo(5.2, -0.35); sh.lineTo(5.6, -0.95); sh.lineTo(5.0, -1.25); sh.lineTo(0, -0.75); sh.closePath(); const wg = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }); wg.rotateX(Math.PI / 2); if (sg < 0) wg.scale(-1, 1, 1);
            const wing = new THREE.Mesh(wg, wingM); wing.castShadow = true; hinge.add(wing); const strip = mesh(new THREE.BoxGeometry(4.2, 0.26, 0.18), stripeM); strip.position.set(sg * 2.6, 0.17, -0.1); strip.rotation.y = sg * 0.17; hinge.add(strip);
            const wl2 = mesh(new THREE.BoxGeometry(0.16, 1.0, 0.75), wingM); wl2.position.set(sg * 5.35, 0.45, -0.85); hinge.add(wl2); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), tipM); tip.position.set(sg * 5.4, 0.98, -0.85); hinge.add(tip);
            const eng = mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.4, 14), stripeM); eng.rotation.x = Math.PI / 2; eng.position.set(sg * 2.2, -0.25, 0.2); hinge.add(eng); const glow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), tipM); glow.position.set(sg * 2.2, -0.25, -0.52); glow.rotation.y = Math.PI; hinge.add(glow);
            return { root, hinge, sg, bl: [] }; };
          const wl = side(1), wr = side(-1); WG.add(wl.root, wr.root); WG.scale.setScalar(0.001 / s0); w.add(WG); const TH = new THREE.Group(); const thM = new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); [-1, 1].forEach((sx) => { const piv = new THREE.Group(); piv.position.set(sx * 1.0 / s0, 0.05 / s0, 0); const c = new THREE.Mesh(new THREE.ConeGeometry(0.55 / s0, 3.2 / s0, 16, 1, true), thM); c.rotation.x = Math.PI; c.position.y = -1.6 / s0; piv.add(c); TH.add(piv); }); TH.visible = false; w.add(TH); const BRD = new THREE.Group(); { const bt = ((f) => { const c = Y2K.cnv(256, 64); f(c.getContext('2d')); return Y2K.toTex(c, { color: true }); })((g) => { g.fillStyle = '#fefefe'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#ff2fb0'; g.fillRect(0, 26, 256, 12); g.fillStyle = '#3d8bff'; g.fillRect(0, 20, 256, 4); g.fillRect(0, 40, 256, 4); g.fillStyle = '#111'; g.font = '900 22px Impact'; g.fillText('UNFIRE 27', 90, 34); }); const bg = new THREE.SphereGeometry(1, 28, 12); const bm = new THREE.Mesh(bg, new THREE.MeshPhysicalMaterial({ map: bt, roughness: 0.25, clearcoat: 1 })); bm.scale.set(1.5 / s0, 0.2 / s0, 5.2 / s0); bm.castShadow = true; BRD.add(bm); const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06 / s0, 0.5 / s0, 0.5 / s0), new THREE.MeshStandardMaterial({ color: 0x222222 })); fin.position.set(0, -0.35 / s0, 3.8 / s0); BRD.add(fin); } BRD.visible = false; w.add(BRD); if (ROAMS.myCol && window.__tintAvatar) { window.__tintAvatar(WG, ROAMS.myCol); window.__tintAvatar(BRD, ROAMS.myCol); } ROAMS.av = { w, r0, ph: 0, WG, wl, wr, TH, BRD }; } catch (e) { ROAMS.av = { w: null }; } }
      NANO_CINEMA.tick(dt); const AV = ROAMS.av; const fx = Math.sin(ROAMS.yaw), fz = -Math.cos(ROAMS.yaw); const MODE = REC.on ? '3p' : ROAMS.mode === 'libre' ? '3p' : ROAMS.mode || '3p'; if ((MODE !== '3p' && MODE !== '3pl' && MODE !== '2p' && MODE !== '1p') ) { if (AV.w) AV.w.visible = false; const eye = MODE === '1p' && !ROAMS.mini ? (window.ATM_OUT ? -9 : -8.9) + 9.6 + (ROAMS.h || 0) : ROAMS.p.y; if (!ROAMS.cp) ROAMS.cp = cam.position.clone(); ROAMS.cp.lerp(V(ROAMS.p.x, eye, ROAMS.p.z), MODE === '1p' ? 0.5 : 0.25); cam.position.copy(ROAMS.cp); cam.lookAt(cam.position.x + fx * cp, cam.position.y + Math.sin(ROAMS.pitch), cam.position.z + fz * cp); cam.near = ROAMS.mini ? 0.006 : 0.1; } else { if (AV.w) { AV.w.visible = true; if (!AV.baseScale) AV.baseScale = AV.w.scale.x; AV.w.scale.setScalar(AV.baseScale*(ROAMS.mini?NANO_SCALE:1)*NANO_CINEMA.avatarFactor()); AV.w.position.set(ROAMS.p.x, -8.9 + (ROAMS.h || 0), ROAMS.p.z); if (AV.WG) { const k = ROAMS.wk || 0, s0 = AV.baseScale || 1; AV.WG.scale.setScalar(Math.max(0.001, Math.min(1, k * 3)) / s0); AV.WG.visible = k > 0.01; const fl2 = Math.sin(t * (ROAMS.moving ? 7 : 3)) * 0.18 * k; [AV.wl, AV.wr].forEach((S2) => { const kk = Math.max(0, Math.min(1, k * 1.4 - 0.2)), e = kk * kk * (3 - 2 * kk); S2.hinge.rotation.y = S2.sg * (1 - e) * 1.45; S2.hinge.rotation.z = S2.sg * ((1 - e) * -0.9 + e * 0.08 + fl2 * 0.25 - (AV.bank || 0) * 0.25 * S2.sg); S2.hinge.scale.setScalar(0.25 + 0.75 * Math.min(1, k * 1.3)); }); { const yr = ROAMS.cy - (AV.lyaw == null ? ROAMS.cy : AV.lyaw); AV.lyaw = ROAMS.cy; AV.bank = (AV.bank || 0) * 0.9 + Math.max(-0.6, Math.min(0.6, -Math.atan2(Math.sin(yr), Math.cos(yr)) * 8)) * 0.1; const tp = ROAMS.fly ? (ROAMS.moving ? 1.25 : ((ROAMS.climbV || 0) > 5 ? -0.05 : 0.12)) : 0; AV.tilt = (AV.tilt || 0) + (tp - (AV.tilt || 0)) * Math.min(1, dt * 3); AV.w.rotation.x = AV.tilt + (ROAMS.fly ? Math.sin(t * 2.3) * 0.04 + Math.sin(t * 5.1) * 0.015 : 0); AV.w.rotation.z = ROAMS.fly ? AV.bank + Math.sin(t * 1.7) * 0.05 : 0; if (AV.TH) { AV.TH.visible = k > 0.05; AV.TH.children.forEach((c, i) => { c.scale.set(1, (0.6 + Math.random() * 0.5 + ((ROAMS.climbV || 0) > 5 || ROAMS.moving ? 0.8 : 0)) * k, 1); }); } } if (ROAMS.wet && !ROAMS.fly) { AV.w.rotation.x = ROAMS.moving ? 0.22 : 0.05; AV.w.rotation.z = Math.sin(t * 1.7) * 0.07; } } const cyy = ROAMS.cy == null ? ROAMS.yaw : ROAMS.cy; AV.w.rotation.y = Math.atan2(Math.sin(cyy), -Math.cos(cyy));
        // SURF: tabla bajo los pies en el agua, postura de lado, trucos con ESPACIO (360, flip, grab, superman) y puntuación con récord
        { const surf = !!(window.ATM_OUT && ROAMS.wet && !ROAMS.fly && ROAMS.board); AV.bk = (AV.bk || 0) + ((surf || ROAMS.trick ? 1 : 0) - (AV.bk || 0)) * Math.min(1, dt * 5); if (AV.BRD) { AV.BRD.visible = AV.bk > 0.02; const e3 = AV.bk; AV.BRD.scale.set(e3, 1, Math.max(0.05, e3 * e3)); AV.BRD.rotation.y = (1 - e3) * 3.0; } AV.st = (AV.st || 0) + ((surf ? 1 : 0) - (AV.st || 0)) * Math.min(1, dt * 6); if (AV.r0 && AV.r0.root) AV.r0.root.rotation.y = AV.st * 1.25 * (1 - (ROAMS.trick && ROAMS.trick.k === 'SUPERMAN' ? 1 : 0)); window.__T = t; if (surf && window.__WAVE) { const W1 = window.__WAVE, px = ROAMS.p.x, pz = ROAMS.p.z, fx = Math.sin(cyy), fz = -Math.cos(cyy), e = 3; const sF = (W1(px + fx * e, pz + fz * e, t) - W1(px - fx * e, pz - fz * e, t)) / (2 * e), sS = (W1(px - fz * e, pz + fx * e, t) - W1(px + fz * e, pz - fx * e, t)) / (2 * e); AV.sp0 = (AV.sp0 || 0) + (Math.atan(sF) - (AV.sp0 || 0)) * Math.min(1, dt * 6); AV.sr0 = (AV.sr0 || 0) + (Math.atan(sS) - (AV.sr0 || 0)) * Math.min(1, dt * 6); AV.w.rotation.x = -AV.sp0 * 0.9; AV.w.rotation.z = (AV.bank || 0) * 1.6 + AV.sr0 * 0.9 + Math.sin(t * 1.3) * 0.04; }
          const TK = ROAMS.trick; if (!TK && AV.w.rotation.order !== 'YXZ') AV.w.rotation.order = 'YXZ'; if (TK) { TK.t += dt; const u = Math.min(1, TK.t / (TK.d || 0.95)), e = u * u * (3 - 2 * u), sn = Math.sin(u * Math.PI); AV.w.rotation.order = 'YXZ';
            /* giros alrededor del centro del cuerpo (no de los pies), como en las películas de surf */ if (!AV.hcm) { try { const bb = new THREE.Box3().setFromObject(AV.r0.root); AV.hcm = Math.max(0.1, (bb.max.y - bb.min.y) / 2 / Math.max(1e-3, AV.w.scale.y)); } catch (e4) { AV.hcm = 4; } }
            if (TK.k === '360' || TK.k === '720') { AV.w.rotation.y += TK.sd * e * TAU * (TK.k === '720' ? 2 : 1); AV.w.rotation.z += sn * 0.25 * TK.sd; }
            else if (TK.k === 'BACKFLIP') AV.w.rotation.x -= e * TAU;
            else if (TK.k === 'FRONTFLIP' || TK.k === 'FLIP') AV.w.rotation.x += e * TAU;
            else if (TK.k === 'CORKSCREW') { AV.w.rotation.x -= e * TAU; AV.w.rotation.y += TK.sd * e * TAU; }
            else if (TK.k === 'TAILWHIP') { if (AV.BRD) AV.BRD.rotation.y += TK.sd * e * TAU; AV.w.rotation.z += sn * 0.18 * TK.sd; }
            else if (TK.k === 'GRAB') { AV.w.rotation.z += sn * 0.7 * TK.sd; AV.w.rotation.y += sn * 0.5 * TK.sd; }
            else AV.w.rotation.x -= sn * 1.3;
            { const hc = AV.hcm * AV.w.scale.y, pv = new THREE.Vector3(0, hc, 0).applyEuler(AV.w.rotation); AV.w.position.x += -pv.x; AV.w.position.y += hc - pv.y; AV.w.position.z += -pv.z; }
            if (TK.t > 0.35 && !ROAMS.air) { const ok = u >= 0.8; ROAMS.trick = null; if (ok) { const P0 = { '360': 500, '720': 900, FLIP: 800, BACKFLIP: 850, FRONTFLIP: 850, CORKSCREW: 1200, TAILWHIP: 600, GRAB: 300, SUPERMAN: 650 }[TK.k] || 400; ROAMS.combo = (performance.now() - (ROAMS.lastTrick || 0) < 4000 ? (ROAMS.combo || 1) + 1 : 1); ROAMS.lastTrick = performance.now(); ROAMS.surfPts = (ROAMS.surfPts || 0) + P0 * ROAMS.combo; let best = 0; try { best = +localStorage.getItem('unfire_surf_best') || 0; if (ROAMS.surfPts > best) { best = ROAMS.surfPts; localStorage.setItem('unfire_surf_best', String(best)); } } catch (e2) {} say('🏄 ' + TK.k + '! +' + P0 + (ROAMS.combo > 1 ? ' ×' + ROAMS.combo : '') + ' · ' + ROAMS.surfPts + ' pts · récord ' + best); hap(0.5); } else { ROAMS.combo = 0; say('🌊 ¡Wipeout! Casi…'); } } } }  let lk = ROAMS.yaw - cyy; lk = Math.atan2(Math.sin(lk), Math.cos(lk)); GS.foot(AV, STEPPH(ROAMS.wd || 0, 10.5*(ROAMS.mini?avatarProfile().speedScale:1), ROAMS.run), ROAMS.air || ROAMS.fly || ROAMS.wet || !ROAMS.moving ? null : (ROAMS.run ? 'run' : 'walk'), null, ROAMS.wet ? 'water' : window.ATM_OUT ? 'out' : 'in'); AV.r0.update(3.7, dt, { act: ROAMS.air && !ROAMS.wet ? 'fly' : ROAMS.wet ? null : ROAMS.moving ? (ROAMS.run ? 'run' : 'walk') : null, ph: ROAMS.moving ? STEPPH(ROAMS.wd || 0, 10.5*(ROAMS.mini?avatarProfile().speedScale:1), ROAMS.run) : t, mood: 'happy', look: clamp(-lk, -0.9, 0.9) }); }
      const sx = -fz * (MODE === '2p' ? 3.6 : 1.3), sz = fx * (MODE === '2p' ? 3.6 : 1.3); const inPyr = window.ATM_OUT && Math.abs(ROAMS.p.x - 600) < 97 && Math.abs(ROAMS.p.z) < 97 && (ROAMS.h || 0) < 24; const FAR = MODE === '3pl' && !inPyr, boost = window.ATM_OUT && ROAMS.fly ? (ROAMS.camBoost || 0) : 0, CD2 = MODE === '2p' ? 6.8 : inPyr ? 5 : FAR ? 20 : 11.5 + boost * 2.5, CH2 = (MODE === '2p' ? 10.2 : inPyr ? 9.5 : FAR ? 17 : 12.2 + boost * 1.2) + (ROAMS.h || 0); const miniCameraRatio = ROAMS.mini ? NANO_SCALE : 1; const want = V(ROAMS.p.x - fx * CD2 * miniCameraRatio + sx * miniCameraRatio, -8.9 + (CH2-(ROAMS.h||0))*miniCameraRatio + (ROAMS.h||0) - Math.sin(ROAMS.pitch) * 3 * miniCameraRatio, ROAMS.p.z - fz * CD2 * miniCameraRatio + sz * miniCameraRatio);
      // la cámara nunca atraviesa paredes: dentro se queda dentro, fuera se queda fuera (se acerca al personaje como en GTA)
      { const inside = (x, z) => Math.abs(x) < 81 && z > -17.5 && z < 97.5; const pin = !window.ATM_OUT; for (let k = 0; k < 12; k++) { const ok = pin ? (Math.abs(want.x) < 78 && want.z > -14.5 && want.z < 94.5) : !inside(want.x, want.z) || (Math.abs(want.x + 30) < 4.5 && want.z > 92); if (ok) break; want.x += (ROAMS.p.x - want.x) * 0.2; want.z += (ROAMS.p.z - want.z) * 0.2; } if (pin) want.y = Math.min(want.y, 24); } if (!ROAMS.cp) ROAMS.cp = cam.position.clone(); {
        const distance = ROAMS.cp.distanceTo(want);
        if (distance > 350) ROAMS.cp.copy(want); // teleport/world transition
        else {
          // Exponential camera damping avoids the x8 hard-snap (alpha=1)
          // when frame time spikes; bound the lag without shaking the lens.
          const rate = (ROAMS.mini ? 14 : 11) + Math.min(16, (ROAMS.vvS || 0) / 100);
          ROAMS.cp.lerp(want, 1 - Math.exp(-rate * dt));
          const lag = ROAMS.cp.distanceTo(want);
          const maxLag = (ROAMS.mini ? 0.9 : 21) +
            Math.min(70, (ROAMS.vvS || 0) * 0.035);
          if (lag > maxLag) ROAMS.cp.lerp(want, (lag - maxLag) / lag);
        }
      }
      // NANO: la cámara sigue de cerca al robot diminuto también al volar (nunca se queda lejos)
      if (ROAMS.mini) { const ap = V(ROAMS.p.x, -8.9 + (ROAMS.h || 0) + 0.14, ROAMS.p.z); const maxD = Math.max(0.42, CD2 * miniCameraRatio * 1.35); const dd = ROAMS.cp.distanceTo(ap); if (dd > maxD) ROAMS.cp.sub(ap).multiplyScalar(maxD / dd).add(ap); } cam.position.copy(ROAMS.cp); cam.lookAt(ROAMS.p.x + (fx * 14 * cp + sx * 0.6)*miniCameraRatio, -8.9 + (FAR ? 5 : 9.4)*miniCameraRatio + (ROAMS.h || 0) + Math.sin(ROAMS.pitch) * 10*miniCameraRatio, ROAMS.p.z + (fz * 14 * cp + sz * 0.6)*miniCameraRatio); cam.near = ROAMS.mini ? 0.006 : window.ATM_OUT ? 1.0 : 0.1; } }
    // Real flight speed is measured every frame, even if the ambient audio bus
    // was never activated. Joining a session or teleporting must not spike the lens.
    {
      const P = ROAMS.p, height = ROAMS.h || 0, outside = !!window.ATM_OUT;
      const sample = ROAMS._cameraSpeed;
      if (!ROAMS.on || !ROAMS.fly || ROAMS.mini || !sample || sample.out !== outside) {
        ROAMS._cameraSpeed = { x: P.x, z: P.z, h: height, out: outside };
        ROAMS.spd = (ROAMS.spd || 0) * Math.exp(-dt * 6);
      } else {
        const d = Math.hypot(P.x - sample.x, P.z - sample.z, height - sample.h);
        const measured = Number.isFinite(d) && d < 250 ? Math.min(d / Math.max(dt, 0.01), 1300) : 0;
        ROAMS.spd = (ROAMS.spd || 0) + (measured - (ROAMS.spd || 0)) * Math.min(1, dt * 4);
        sample.x = P.x; sample.z = P.z; sample.h = height;
      }
    }
    if (ROAMS.on && ROAMS.av && ROAMS.av.w) { const AV = ROAMS.av, hd = AV.r0 && AV.r0.J && AV.r0.J.head ? AV.r0.J.head.g : null; const FP = (ROAMS.mode === '1p') && !REC.on;
      if (hd) hd.visible = !FP;
      // 1ª persona de verdad: la cámara va en los ojos del 27; ves tus brazos, tu cuerpo y tus alas al mirar abajo
      if (FP) { AV.w.updateMatrixWorld(true); const hp = hd ? hd.getWorldPosition(V(0, 0, 0)) : V(ROAMS.p.x, -8.9 + 9.6 + (ROAMS.h || 0), ROAMS.p.z); const fx2 = Math.sin(ROAMS.yaw), fz2 = -Math.cos(ROAMS.yaw); const eye = V(hp.x + fx2 * (ROAMS.mini?0.20:1.25), hp.y + (ROAMS.mini?0.08:0.25), hp.z + fz2 * (ROAMS.mini?0.20:1.25)); if (!ROAMS.ep || ROAMS.ep.distanceTo(eye) > 6) ROAMS.ep = eye.clone(); ROAMS.ep.lerp(eye, Math.min(1, dt * 22)); cam.position.copy(ROAMS.ep); const pc = Math.cos(ROAMS.pitch); cam.lookAt(cam.position.x + fx2 * pc, cam.position.y + Math.sin(ROAMS.pitch), cam.position.z + fz2 * pc); cam.near = ROAMS.mini ? 0.006 : window.ATM_OUT ? 0.12 : 0.07; ROAMS.cp = cam.position.clone(); }
      if (REC.on) REC.tick(dt); }
    camB.style.display = ROAMS.on ? 'block' : 'none'; recB.style.display = ROAMS.on ? 'block' : 'none'; if (window.__onlB) window.__onlB.style.display = ROAMS.on && !(window.ONLINE_ON && window.ONLINE_ON()) ? 'block' : 'none'; if (window.__nimB) window.__nimB.style.display = ROAMS.on ? 'block' : 'none'; if (window.__surfB) { const SB = window.__surfB; SB.k = (SB.k || 0) + 1; if (SB.k % 8 === 0) { let nw = false; if (ROAMS.on && window.ATM_OUT && window.__LAND && (ROAMS.h || 0) < (ROAMS.fl || 0) + 18) { const px = ROAMS.p.x, pz = ROAMS.p.z; nw = !window.__LAND(px, pz) || [0, 1, 2, 3, 4, 5].some((i) => !window.__LAND(px + Math.cos(i * 1.047) * 9, pz + Math.sin(i * 1.047) * 9)); } if (nw && !SB.shown) { SB.style.animation = 'none'; void SB.offsetWidth; SB.style.animation = 'surfPop .45s cubic-bezier(.3,1.6,.5,1)'; if (!SB.told) { SB.told = 1; say('🏄 ¡Estás en el agua! Pulsa TABLA (o B) para surfear'); } } SB.shown = nw; SB.style.display = nw ? 'block' : 'none'; } } if (window.UNFIRE_COINS) window.UNFIRE_COINS.tick(dt,t); MIX.tick(); ATM.tick(dt, t); $('tip').style.visibility = ROAMS.on ? 'hidden' : ''; cam.updateProjectionMatrix();
    // colisiones: tu robot no atraviesa muebles ni máquinas (cajas de colisión de lo que está en el suelo)
    if (ROAMS.on && !ROAMS.mini && !window.ATM_OUT) { try { if (!window.__OBST && window.__PROPS) { window.__OBST = window.__buildObst(); }
      const p = ROAMS.p, ft = -8.9 + (ROAMS.h || 0); for (const B of COLLISION(window.__OBST, p.x, p.z, 1)) { if (p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1 && ft < B.y1 - 0.4) { const dl = p.x - B.x0, dr = B.x1 - p.x, db = p.z - B.z0, df = B.z1 - p.z, mn = Math.min(dl, dr, db, df); if (mn === dl) p.x = B.x0; else if (mn === dr) p.x = B.x1; else if (mn === db) p.z = B.z0; else p.z = B.z1; } }
      const GL = window.__GROW && window.__GROW.list; if (GL) GL.forEach((g) => { if (!g.w || !g.w.visible) return; const dx = p.x - g.w.position.x, dz = p.z - g.w.position.z, d = Math.hypot(dx, dz), R0 = 4.5; if (d < R0 && d > 0.01) { p.x += dx / d * (R0 - d); p.z += dz / d * (R0 - d); } }); } catch (e) {} }
    { const GL = window.__GROW && window.__GROW.list; if (GL && GL.length > 1) for (let i = 0; i < GL.length; i++) for (let j = i + 1; j < GL.length; j++) { const a = GL[i].w, b = GL[j].w; if (!a || !b || !a.visible || !b.visible) continue; const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, d = Math.hypot(dx, dz), R0 = 7; if (d < R0 && d > 0.01) { const o = (R0 - d) / 2; a.position.x -= dx / d * o; a.position.z -= dz / d * o; b.position.x += dx / d * o; b.position.z += dz / d * o; } } }
    // nada atraviesa nada: objetos entre sí, objetos contra muebles, Nimbo contra muebles y contra ti
    if (ROAMS.on && !ROAMS.mini && !window.ATM_OUT && window.__PROPS) { try { const PR = window.__PROPS, OB = window.__OBST || []; const cen = (q) => [q.o.position.x + q.off.x, q.o.position.z + q.off.z];
      for (let i = 0; i < PR.length; i++) for (let j = i + 1; j < PR.length; j++) { const a = PR[i], b = PR[j], [ax, az] = cen(a), [bx, bz] = cen(b), dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), R0 = a.r + b.r; if (d < R0 && d > 0.001) { const o = (R0 - d) / 2, nx = dx / d, nz = dz / d; a.o.position.x -= nx * o; a.o.position.z -= nz * o; b.o.position.x += nx * o; b.o.position.z += nz * o; const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { a.vx += rv * nx * 0.8; a.vz += rv * nz * 0.8; b.vx -= rv * nx * 0.8; b.vz -= rv * nz * 0.8; } } }
      for (const q of PR) { const [cx, cz] = cen(q); for (const B of COLLISION(OB, cx, cz, q.r + 2)) { const x0 = B.x0 + 1.6 - q.r, x1 = B.x1 - 1.6 + q.r, z0 = B.z0 + 1.6 - q.r, z1 = B.z1 - 1.6 + q.r; if (cx > x0 && cx < x1 && cz > z0 && cz < z1) { const dl = cx - x0, dr = x1 - cx, db = cz - z0, df = z1 - cz, mn = Math.min(dl, dr, db, df); if (mn === dl) { q.o.position.x -= dl; q.vx = -Math.abs(q.vx) * 0.5; } else if (mn === dr) { q.o.position.x += dr; q.vx = Math.abs(q.vx) * 0.5; } else if (mn === db) { q.o.position.z -= db; q.vz = -Math.abs(q.vz) * 0.5; } else { q.o.position.z += df; q.vz = Math.abs(q.vz) * 0.5; } } } }
      const hp = HOST.pos; if (hp && HOST.visible) {
        // Keep Nimbo away from the player without pushing him THROUGH furniture.
        const dx = hp.x - ROAMS.p.x, dz = hp.z - ROAMS.p.z, d = Math.hypot(dx, dz);
        if (d < 4.5 && d > 0.01) {
          const away = { x: dx / d * (4.5 - d), z: dz / d * (4.5 - d) };
          const body = { radius: 2.8, height: 6.4 };
          const boxes = COLLISION(OB, hp.x, hp.z, 9);
          const moved = NANO_PHYSICS.move2D({ x: hp.x, z: hp.z }, away,
            boxes, body, { footY: hp.y - 3.2, prePadding: 1.1 });
          hp.x = moved.x; hp.z = moved.z;
        }
      } } catch (e) {} }
    // física: los objetos pequeños del suelo se empujan al pasar (cubos, pufs, macetas…)
    if (ROAMS.on && !ROAMS.mini && !window.ATM_OUT) { try { if (!window.__PROPS) { const L = []; const bb = new THREE.Box3(), sz = new THREE.Vector3(), c0 = new THREE.Vector3(); ROOM.R.children.forEach((o) => { if (!o.visible || o.isLight || o.userData.noPush) return; bb.setFromObject(o); if (bb.isEmpty()) return; bb.getSize(sz); bb.getCenter(c0); if (sz.y < 5.8 && Math.max(sz.x, sz.z) < 6.5 && bb.min.y < -7.6 && Math.hypot(c0.x, c0.z) > 9 && Math.abs(c0.x) < 76 && c0.z < 93) L.push({ o, r: Math.max(sz.x, sz.z) * 0.5, off: V(c0.x - o.position.x, 0, c0.z - o.position.z), vx: 0, vz: 0, sp: 0 }); }); window.__PROPS = L; }
      const pr = window.__PROPS, px = ROAMS.p.x, pz = ROAMS.p.z; for (const q of pr) { const cx = q.o.position.x + q.off.x, cz = q.o.position.z + q.off.z, dx = cx - px, dz = cz - pz, d = Math.hypot(dx, dz), R0 = q.r + 2.2; if (d < R0 && d > 0.01) { const push = (R0 - d); q.vx += dx / d * push * 9; q.vz += dz / d * push * 9; q.sp += (Math.random() - 0.5) * push * 3; } if (q.vx || q.vz) { q.o.position.x += q.vx * dt; q.o.position.z += q.vz * dt; q.o.rotation.y += q.sp * dt; const f = Math.exp(-dt * 3.2); q.vx *= f; q.vz *= f; q.sp *= f; if (Math.abs(q.vx) + Math.abs(q.vz) < 0.02) { q.vx = q.vz = 0; } const nx = q.o.position.x + q.off.x, nz = q.o.position.z + q.off.z; if (Math.abs(nx) > 76) { q.o.position.x -= (nx - Math.sign(nx) * 76); q.vx *= -0.5; } if (nz > 93 || nz < -13) { q.o.position.z -= nz - clamp(nz, -13, 93); q.vz *= -0.5; } if (Math.hypot(nx, nz) < 9) { const s = 9 / Math.max(0.01, Math.hypot(nx, nz)); q.o.position.x += nx * (s - 1); q.o.position.z += nz * (s - 1); } } } } catch (e) {} }
    // al alejarte del maletín hacia la casa: pasas directamente a controlar a tu robot (cámara GTA)
    if (!ROAMS.on && !VIEW.on && lidOpen > 0.95 && !CINE.on && view.gd > view.D0 * 1.25) { view.gd = view.D0; view.dist = Math.min(view.dist, view.D0 * 1.1); enterRoam(); }
    if (window.__FACADE) { const F = window.__FACADE, c = cam.position, outC = c.x < F.box.X0 + 0.5 || c.x > F.box.X1 - 0.5 || c.z < F.box.Z0 + 0.5 || c.z > F.box.Z1 - 0.5 || c.y > 26.5; F.WALLS.forEach((w) => (w.visible = !outC)); }
    if (ROAMS.on && window.ATM_OUT && window.__OUTGIANTS) { for (const G2 of window.__OUTGIANTS) { const p = G2.w.position, dx = ROAMS.p.x - p.x, dz = ROAMS.p.z - p.z, d = Math.hypot(dx, dz), R0 = (G2.h || 26) * 0.22 + 2; if (d < R0 && d > 0.01) { ROAMS.p.x += dx / d * (R0 - d); ROAMS.p.z += dz / d * (R0 - d); } } }
    // ===== PELOTAS con física de verdad: gravedad, rebote, rodar, chocar entre ellas y con todo; tú y los robots las chutáis =====
    if (ROAMS.on) { try { if (!window.__BALLS) { const L = []; const mk = (x, z, r, out, hue) => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); const cols = ['#ff2a4a', '#ffffff', '#ffd21a', '#ffffff', '#3d8bff', '#ffffff']; for (let i = 0; i < 6; i++) { g.fillStyle = cols[(i + hue) % 6]; g.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); } const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshPhysicalMaterial({ map: tx, roughness: 0.3, clearcoat: 1 })); b.castShadow = true; b.position.set(x, (out ? -9 : -8.9) + r, z); S.scene.add(b); L.push({ b, r, out, v: V(0, 0, 0) }); };
        mk(20, 30, 1.4, false, 0); mk(-20, 60, 1.4, false, 2); mk(30, 75, 1.4, false, 4); [[-40, 130], [-10, 140], [20, 120], [60, 150], [-70, 110], [0, 180]].forEach(([x, z], i) => mk(x, z, 2.4, true, i)); window.__BALLS = L; }
        const BL = window.__BALLS, inH = (x, z) => Math.abs(x) < 81 && z > -17.5 && z < 97.5; const kickers = [{ p: ROAMS.p, v: ROAMS.moving ? 30 : 12, y: -8.9 + (ROAMS.h || 0) }]; try { (window.__GROW && window.__GROW.list || []).forEach((g) => g.w && g.w.visible && kickers.push({ p: g.w.position, v: 18, y: g.w.position.y, R: 3.5 })); (window.__OUTGIANTS || []).forEach((G2) => kickers.push({ p: G2.w.position, v: 26, y: -9, R: (G2.h || 26) * 0.2 })); } catch (e) {}
        for (const q of BL) { const P = q.b.position, fy = (q.out ? -9 : -8.9) + q.r; if (!q.out === !!window.ATM_OUT && false) continue;
          for (const k of kickers) { const dx = P.x - k.p.x, dz = P.z - k.p.z, d = Math.hypot(dx, dz), RR = q.r + (k.R || 2.2); if (d < RR && d > 0.01 && P.y - k.y < 9) { const nx = dx / d, nz = dz / d; P.x += nx * (RR - d); P.z += nz * (RR - d); const vn = q.v.x * nx + q.v.z * nz; if (vn < k.v) { GS.kick(P, k.v - vn); q.v.x += nx * (k.v - vn); q.v.z += nz * (k.v - vn); q.v.y = Math.max(q.v.y, 6 + Math.random() * 10); } } }
          q.v.y -= 40 * dt; P.addScaledVector(q.v, dt); if (P.y < fy) { P.y = fy; if (q.v.y < -6) GS.bounce(P, -q.v.y); if (q.v.y < -3) q.v.y *= -0.62; else q.v.y = 0; q.v.x *= Math.pow(0.35, dt); q.v.z *= Math.pow(0.35, dt); }
          if (!q.out) { const lim = (v, a, b, ax) => { if (P[ax] < a) { P[ax] = a; q.v[ax] = Math.abs(q.v[ax]) * 0.7; } else if (P[ax] > b) { P[ax] = b; q.v[ax] = -Math.abs(q.v[ax]) * 0.7; } }; lim(0, -78 + q.r, 78 - q.r, 'x'); lim(0, -14.5 + q.r, 94.5 - q.r, 'z'); if (Math.hypot(P.x, P.z - 1) < 8.5 + q.r) { const dx = P.x, dz = P.z - 1, d = Math.hypot(dx, dz) || 1, s = (8.5 + q.r) / d; P.x = dx * s; P.z = dz * s + 1; const vn = (q.v.x * dx + q.v.z * dz) / d; if (vn < 0) { q.v.x -= 1.7 * vn * dx / d; q.v.z -= 1.7 * vn * dz / d; } } }
          else { if (inH(P.x, P.z)) { const dl = P.x + 81, dr = 81 - P.x, db = P.z + 17.5, df = 97.5 - P.z, mn = Math.min(dl, dr, db, df); if (mn === dl) { P.x = -81 - q.r; q.v.x = -Math.abs(q.v.x) * 0.7; } else if (mn === dr) { P.x = 81 + q.r; q.v.x = Math.abs(q.v.x) * 0.7; } else if (mn === db) { P.z = -17.5 - q.r; q.v.z = -Math.abs(q.v.z) * 0.7; } else { P.z = 97.5 + q.r; q.v.z = Math.abs(q.v.z) * 0.7; } } const rr = Math.hypot(P.x, P.z); if (rr > 228) { P.x *= 228 / rr; P.z *= 228 / rr; q.v.x *= -0.6; q.v.z *= -0.6; } }
          for (const B of COLLISION(q.out ? window.__OBSTO : window.__OBST, P.x, P.z, q.r + 2)) { const x0 = B.x0 + 1.1 - q.r, x1 = B.x1 - 1.1 + q.r, z0 = B.z0 + 1.1 - q.r, z1 = B.z1 - 1.1 + q.r; if (P.x > x0 && P.x < x1 && P.z > z0 && P.z < z1 && P.y - q.r < B.y1) { const dl = P.x - x0, dr = x1 - P.x, db = P.z - z0, df = z1 - P.z, mn = Math.min(dl, dr, db, df); if (mn === dl) { P.x = x0; q.v.x = -Math.abs(q.v.x) * 0.6; } else if (mn === dr) { P.x = x1; q.v.x = Math.abs(q.v.x) * 0.6; } else if (mn === db) { P.z = z0; q.v.z = -Math.abs(q.v.z) * 0.6; } else { P.z = z1; q.v.z = Math.abs(q.v.z) * 0.6; } } }
          const sp = Math.hypot(q.v.x, q.v.z); if (sp > 0.01) { const ax = V(q.v.z, 0, -q.v.x).normalize(); q.b.rotateOnWorldAxis(ax, sp * dt / q.r); } }
        for (let i = 0; i < BL.length; i++) for (let j = i + 1; j < BL.length; j++) { const a = BL[i], b = BL[j]; if (a.out !== b.out) continue; const d = a.b.position.distanceTo(b.b.position), R0 = a.r + b.r; if (d < R0 && d > 0.001) { const n = b.b.position.clone().sub(a.b.position).divideScalar(d), o = (R0 - d) / 2; a.b.position.addScaledVector(n, -o); b.b.position.addScaledVector(n, o); const rv = b.v.clone().sub(a.v).dot(n); if (rv < 0) { a.v.addScaledVector(n, rv * 0.9); b.v.addScaledVector(n, -rv * 0.9); } } } } catch (e) {} }
    governGraphics(now,actualFrameTime);
    window.__idleT = ROAMS.moving || ROAMS.fly ? 0 : (window.__idleT || 0) + dt;
    if (window.__DOME) {
      const dome = window.__DOME;
      const radius = Math.hypot(ROAMS.p.x - dome.c.x, ROAMS.p.z - dome.c.z);
      const altitude = ROAMS.h || 0;
      // Open in advance when ascending from the room as well as approaching from outside.
      const approaching = ROAMS.on && !ROAMS.mini && radius < 90 &&
        (window.ATM_OUT ? altitude > 20 : ROAMS.fly && altitude > 10);
      dome.open += ((approaching ? 1 : 0) - dome.open) * Math.min(1, dt * 2);
      // Warm exterior collision boxes in small timed batches while still inside.
      // The outdoor switch itself must not perform a costly synchronous traversal.
      if (approaching && !window.ATM_OUT && !window.__obstWarmReady &&
          !window.__obstWarmPending && window.__warmOutsideObstacles) {
        window.__warmOutsideObstacles();
      }
      dome.PET.forEach((p, i) => { p.rotation.z = -dome.open * (1.75 + Math.sin(i) * 0.05); });
      if (ROAMS.on && !ROAMS.mini && dome.open > 0.6 && radius < 34) {
        const worldY = -8.9 + altitude;
        if (!window.ATM_OUT && ROAMS.fly && worldY > dome.c.y + 1.5) {
          // Keep avatar/camera position and flight state; don't reload the scene.
          ATM.setOut(true);
          ROAMS.flyH = Math.max(ROAMS.flyH || altitude, altitude);
          ROAMS.vy = Math.max(0, ROAMS.vy || 0);
        } else if (window.ATM_OUT && worldY < dome.c.y - 1) {
          // Different thresholds prevent immediate indoor/outdoor oscillation.
          ATM.setOut(false);
          // Descend naturally through the roof opening, without a 20m teleport.
          ROAMS.flyH = 12;
          say('🏠 You entered through the dome');
        }
      }
    }
    // sonido de mar y viento fuera (más fuerte en la orilla y en el agua, viento al volar alto)
    try { ensureSeaAmbience();
      if (window.__SEA) { const S0 = window.__SEA, out = ROAMS.on && window.ATM_OUT, r = Math.hypot(ROAMS.p.x, ROAMS.p.z); const shore = out ? (ROAMS.wet ? 1 : Math.max(0.25, 1 - Math.abs(r - 256) / 160)) : 0; const hi = out ? Math.min(1, (ROAMS.h || 0) / 400) : 0; const mus = ((window.__WRADIO && window.__WRADIO.on) || (RADIO.st && RADIO.st.on) ? 0.4 : 1) * (window.speechSynthesis && speechSynthesis.speaking ? 0.3 : 1); const wave = 0.55 + 0.45 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1); S0.g.gain.value += ((out ? 0.13 * shore * wave * (1 - hi * 0.8) * mus : 0) - S0.g.gain.value) * Math.min(1, dt * 2); if (window.__RAING) window.__RAING.gain.value = 0.012 * mus * (window.ATM_OUT ? 1 - hi * 0.7 : 0.6); S0.lp.frequency.value = (mus < 1 ? 380 : 500) + wave * (mus < 1 ? 500 : 900);  const wz = Math.tanh((ROAMS.spd || 0) / 500); S0.g2.gain.value += ((out ? Math.min(0.022, 0.008 + hi * 0.012 + (ROAMS.fly ? Math.min(wz, 0.35) * 0.012 : 0)) * mus : 0) - S0.g2.gain.value) * Math.min(1, dt * 1.5); if (S0.bp) { S0.bp.frequency.value = 600 + 300 * Math.min(wz, 0.5); } if (S0.wl) S0.wl.frequency.value = 1400 + 400 * Math.min(wz, 0.5); } } catch (e) {}
    // lo que no se ve no existe: dentro de la casa, el mundo de fuera (Atlantis, desierto, moáis, pirámide) se apaga
    if (window.__EXT) { const c = cam.position, inside = !window.ATM_OUT && Math.abs(c.x) < 81 && c.z > -17.5 && c.z < 97.5 && c.y < 27; if (inside !== window.__EXTin) { window.__EXTin = inside; window.__EXT.forEach((o) => { if (!o.userData.tall) o.visible = !inside; }); } }
    if (window.__SKY) window.__SKY.position.set(cam.position.x, cam.position.y - 20, cam.position.z);
    try { VIEW.apply(dt); } catch (e) {}
    { const imm = !!(ROAMS.on || (lidOpen > 0.95 && view.gd > view.D0 * 1.2) || VIEW.on); if (imm !== window.__immS) { window.__immS = imm; parentPost({ immersive: imm }); } }
    _cp.copy(cam.position);
    // cápsula más cercana → se abre y se transforma al acercarte
    if (false) { ALL.done = 1; items.filter((x) => x.kind === 'cap').slice(0, 4).forEach((it, i) => setTimeout(() => openGear(it, true), 350 * i)); }
    for (const g of open) { const d = planar(g.it); if (!g.pin) g.closing = true;
      let dd = 0; if (g.closing) { const h = g.it.tok.position, p = g.dev.root.position; dd = Math.hypot(p.x - h.x, p.z - h.z); if (dd > 0.01) { p.x = lerp(p.x, h.x, 0.12); p.z = lerp(p.z, h.z, 0.12); } }
      const target = g.closing ? (dd > 0.03 ? g.m : 0) : g.manual || 2; g.dev.root.position.y += ((A.g === g && !g.closing ? 0.16 : 0.03) - g.dev.root.position.y) * 0.08; g.m += clamp(target - g.m, -dt * 0.7, dt * 0.5);
      if (g.prev < 0.9 && g.m >= 0.9 && !g.closing) activate(g); g.prev = g.m;
      const act = A.g === g; let scope = null, spc = null;
      if (act) { const an = A.engine && A.engine.post ? A.engine.post.analyser : (UA.bus && UA.bus.out); if (an && UA.ctx) { an.getByteTimeDomainData(tb); an.getByteFrequencyData(fb); scope = tb; spc = fb; let s = 0; for (let k = 0; k < tb.length; k += 8) { const x = (tb[k] - 128) / 128; s += x * x; } level += (Math.min(1, Math.sqrt(s / 128) * 3) - level) * 0.25; } }
      g.lift = lerp(g.lift || 0, A.g === g && !g.closing ? 1 : 0, 0.06); g.dev.root.position.y = 0.03 + 0.14 * g.lift;
      if (g.boost > 0) { g.boost -= dt; g.dev.root.rotation.y += dt * 4; } else g.dev.root.rotation.y *= 0.92;
      g.dev.update(g.m, dt, { level: act ? level : 0.1, scope, spectrum: spc, values: act ? A.values : null, using: act && A.using, msg: act && A.msgT > 0 ? A.msg : '', song: A.song }); }
    A.msgT -= dt; sweep();
    // robot más cercano → se transforma al acercarte
    if (compG.mut.userData.t > 0.6) { const nb = items.find((x) => x.kind === 'mut' && !x.R); if (nb) { nb.R = ROBOT.build(nb.spec); nb.W = new THREE.Group(); nb.W.position.copy(nb.tok.position); compG.mut.add(nb.W); nb.W.add(nb.R.root); nb.home = nb.tok.position.clone(); nb.R.update(0, 0.016, {}); const bb = new THREE.Box3().setFromObject(nb.R.root), sz = bb.getSize(V(0, 0, 0)); nb.W.scale.setScalar(0.24 / Math.max(sz.x, sz.y, sz.z, 0.001)); nb.R.root.position.y -= bb.min.y; nb.P = plat3D({ type: 'mut', it: nb }, 0.13, nb.spec.id ? nb.spec.id.length % 3 : 1); nb.P.scale.setScalar(1 / nb.W.scale.x); nb.P.position.y = -0.012 / nb.W.scale.x; nb.W.add(nb.P); nb.tok.children.forEach((c) => (c.visible = false)); nb.T = 0; nb.tgt = CINE.on || MEGA ? 3 : 0; nb.R.update(0, 0.016, { beat: 0, playing: false, react: 0, happy: false, look: 0 }); } }
    for (const it of items) { if (it.kind !== 'mut' || !it.R) continue; it.rise = Math.min(1, (it.rise || 0) + dt * 0.9); it.W.position.y = it.tok.position.y + 0.03 - 0.32 * (1 - ease.smooth(it.rise)); const tg = it.tgt; if (tg === 0) { it.W.position.x = lerp(it.W.position.x, it.home.x, 0.12); it.W.position.z = lerp(it.W.position.z, it.home.z, 0.12); } if (Math.abs(tg - it.T) < 0.002 && it.T < 0.01) continue; if (it.T > 2.5 && RADIO.st.on) idleT = 0; it.T += clamp(tg - it.T, -dt * 1.2, dt * 0.8);  { const px = it.W.position.x, pz = it.W.position.z; it.wd = (it.wd || 0) + (it.lpx == null ? 0 : Math.hypot(px - it.lpx, pz - it.lpz)); it.lpx = px; it.lpz = pz; } const WA = it.cn && CINE.on ? it.cn.act : it.retT > 0 ? 'walk' : null; if ((WA === 'walk' || WA === 'run') && !it.hgt) it.hgt = HGT(it.R.root) / Math.max(1e-3, it.W.parent.getWorldScale(V(0, 0, 0)).y); it.R.update(it.T, dt, { beat: RADIO.st.on ? (t * (RADIO.bpm || 100) / 60) % 1 : 0, playing: !!RADIO.st.on && it.T > 2.5, react: RADIO.st.on ? 0.6 : 0, happy: it.T > 2.8, look: it.cn && CINE.on ? 0 : Math.sin(t * 0.7) * 0.4, act: it.cn && CINE.on ? it.cn.act : MEGA && it.T > 2.6 ? ['fly', 'dance', 'cheer', 'fly', 'dance'][items.indexOf(it) % 5] : it.retT > 0 ? 'walk' : it.T > 2.9 && RADIO.st.on ? ['dance', 'dance', 'cheer', 'play'][items.indexOf(it) % 4] : null, mood: it.cn && CINE.on ? it.cn.mood : MEGA ? ['star', 'happy', 'love', 'wow', 'cheer'][items.indexOf(it) % 5] : null, talk: !!(it.cn && CINE.on && it.cn.talk), ph: (WA === 'walk' || WA === 'run') && it.hgt ? STEPPH(it.wd, it.hgt, WA === 'run') + (it.ph0 || 0) : t + (it.ph0 || 0) }); }
    if (robot) { const d = eff(robot.it), tgt = 3 * ease.smooth(clamp((3.0 - d) / 1.6)) + (robot.boost ? 1 : 0); robot.T += clamp(tgt - robot.T, -dt * 1.4, dt * 0.9); robot.R.root.position.y = 0.02 + 0.3 * ease.smooth(clamp(robot.T / 1.5)); robot.R.update(robot.T, dt, { beat: 0, playing: false, react: 0, happy: robot.T > 2.8, look: 0 }); }
    // HYPERWAVE: se abre al acercarte
    if (HW) { if (compG.hw.userData.t < 0.9) HW.tg = 0; HW.T = (HW.T || 0) + clamp(HW.tg - (HW.T || 0), -dt * 1.4, dt * 0.9); const hp = HW.root.position; HW.root.scale.setScalar(lerp(HW.root.scale.x, HW.equip ? 0.62 : 0.27, 0.08)); if (HW.P) HW.P.visible = !HW.equip && (HW.u || 0) > 0.3; if (HW.equip) { hp.x = lerp(hp.x, 0, 0.08); hp.z = lerp(hp.z, 3.75, 0.08); hp.y = lerp(hp.y, -HB + 0.02, 0.1); HW.u = 1; } else if (HW.tg === 0) { hp.x = lerp(hp.x, HW.home.x, 0.12); hp.z = lerp(hp.z, HW.home.z, 0.12); } HW.u = clamp((HW.u || 0) + (compG.hw.userData.t > 0.95 && compG.hw.userData.open && lidOpen > 0.95 ? dt * 0.35 : (HW.T || 0) < 0.4 ? -dt * 0.9 : 0)); if (!HW.equip) hp.y = -0.42 + 0.73 * ease.smooth(HW.u); if (HW.autoT && HW.u > 0.97) { HW.autoT = 0; HW.tg = 3.6; say('HYPERWAVE 2000 · ready to play (keys A–L)'); } HW.root.visible = HW.u > 0.01 || compG.hw.userData.t > 0.05; HW.vt = (HW.vt || 0) - dt; const scrOn = (HW.T || 0) > 2.2; if (HW.vfd && (scrOn || HW.vOn) && HW.vt <= 0) { HW.vt = 0.08; HW.vOn = scrOn; try { HYPERWAVE.drawVFD(HW.vfd.canvas, { boot: clamp(((HW.T || 0) - 2.2) / 0.8), patch: 0, patchName: CINE.on ? 'ROBOT JAM' : 'UNFIRE 2000', bpm: Math.round(RADIO.bpm || 120), T: HW.T, demo: !!RADIO.st.on, wave: tb, spec: fb, waveName: 'SUPERSAW', oct: 0, arp: false, hold: false, voices: HV.size, edit: HW.lock || null }); } catch (er) {} } HW.update(HW.T, dt, { params: {}, level: 0.2 + LV, screenDirty: (HW.T || 0) > 2.2 || HW.vOn }); if (HW.closeGate && HW.T < 0.05) { HW.closeGate = 0; compG.hw.userData.open = 0; } }
    // tarjetas 2D: se levantan hacia ti al acercarte
    items.forEach((it) => { if (!it.g) return; it.kk = clamp((it.kk || 0) + (it.on ? dt * 1.1 : -dt * 1.4)); const k = ease.back(it.kk), hv = HOV === it ? 1 : 0;
      if (!it.on && it.home) { it.g.position.x = lerp(it.g.position.x, it.home.x, 0.12); it.g.position.z = lerp(it.g.position.z, it.home.z, 0.12); }
      const mt = it.m && it.m.material; if (mt && mt.emissive) { if (!mt.userData.gl) { mt.userData.gl = 1; if (mt.transparent) { mt.alphaTest = 0.4; mt.depthWrite = true; } mt.emissive.set(0xffffff); mt.emissiveMap = mt.map; mt.needsUpdate = true; } mt.emissiveIntensity = lerp(mt.emissiveIntensity || 0.5, 0.6 + 0.8 * hv + 1.0 * it.kk + 0.08 * Math.sin(t * 2 + it.pos.x * 3), 0.15); }
      if (it.fr) { const tg2 = 0.45 + 0.45 * hv + 0.5 * it.kk + LV * 0.6 + 0.08 * Math.sin(t * 2.4 + it.pos.x * 3); it.fr.material.opacity = lerp(it.fr.material.opacity, Math.min(1, tg2), 0.15); it.fr.scale.setScalar(1 + 0.06 * hv + 0.05 * LV); it.m.material.color.setScalar(lerp(it.m.material.color.r, 1.0 + 0.25 * hv + 0.3 * it.kk + LV * 0.2, 0.15)); }
      if (it.laptop) { it.laptop.rotation.x = -1.85 * ease.smooth(it.kk); it.g.rotation.x = lerp(0, 0.35, k); it.g.position.y = 0.03 + k * 0.1; return; }
      it.g.rotation.x = lerp(0, it.kind === 'fx' ? 0.42 : H2 - 0.45, k); const cy = it.comp && compG[it.comp] ? compG[it.comp].position.y : 0; it.g.position.y = (it.kind === 'fx' ? 0.05 : 0.02) + cy + k * (it.kind === 'fx' ? 0.07 : 0.42); it.g.visible = cy > -0.3; });
    // HUD
    const zoomK = 1 - view.dist / view.D0; $('hud').classList.toggle('on', zoomK > 0.05); const bi = zoomK > 0.55 ? items.reduce((b, it) => (planar(it) < (b ? planar(b) : 0.45) ? it : b), null) : null; const bk = bi ? ({ fx: 'fx-' + bi.id, hyper: 'hyper', synth: 'synth', cap: 'club', mut: 'club', archer: 'archer' })[bi.kind] : null; $('buy').classList.toggle('on', !!bk && !window.UNFIRE_APP); if (bk && !window.UNFIRE_APP) { $('buy').dataset.k = bk; $('buy').textContent = (bk === 'archer' ? 'VIEW ON THE APP STORE · ' : 'ADD TO BAG · ') + bi.name; }
    let near = null, nd = 1e9; for (const it of items) { const d = Math.hypot(it.pos.x - view.tx, it.pos.z - view.tz); if (d < nd) { nd = d; near = it; } }
    const comp = Object.values(COMP).find((c) => view.tx >= c.x0 - 0.1 && view.tx <= c.x1 + 0.1 && view.tz >= c.z0 - 0.1 && view.tz <= c.z1 + 0.1);
    $('crumb').innerHTML = 'CASE' + (comp && zoomK > 0.25 ? ' › ' + comp.name.toUpperCase() : '') + (near && zoomK > 0.6 ? ' › <b>' + near.name + '</b>' : '');
    const tip = lidOpen < 0.05 ? 'Tap the butterfly button · or scroll down a little' : lidOpen < 0.9 ? '' : zoomK < 0.05 ? (allOpen() ? 'Scroll over the case to zoom in · outside to scroll the page' : 'Scroll over a compartment to open it · outside for all · or tap OPEN ALL') : open.some((g) => g.m > 0.9) ? 'Tap the butterfly to transform · drag the controls' : near && ['fx', 'archer', 'hyper', 'synth'].includes(near.kind) && zoomK > 0.6 ? 'Click to try it' : 'Drag to rotate · move the cursor to the edge to navigate · zoom in to open';
    // Touch-first HUD: no long translucent instruction banners over the avatar,
    // the suitcase, or the mobile action controls. Desktop keeps full hints.
    const mobileTip = window.__UNFIRE_AUTOCALIB && window.__UNFIRE_AUTOCALIB.touch
      ? (!ROAMS.on && lidOpen < 0.05 ? 'TAP THE BUTTERFLY' : '')
      : tip;
    $('tip').textContent = mobileTip; $('tip').classList.toggle('on', !!mobileTip);
    if (!(frameN++ % 6)) { const pts = []; for (const x of [-CW / 2 - 0.1, CW / 2 + 0.1]) for (const z of [-CD / 2 - 0.1, CD / 2 + 0.25]) { pts.push(V(x, 0, z), V(x, HB + 0.1, z)); pts.push(lid.localToWorld(V(x, HL, z))); } let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { p.project(cam); const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      parentPost({ rect: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)], lv: Math.round(LV * 100) / 100, open: lidOpen > 0.9, zoom: zoomed() || !!drag || !!knobDrag }); }
    if (SEL && SEL.type === 'cap' && !open.includes(SEL.g)) SEL = null;
    if (SEL) { const o = SEL.type === 'cap' ? SEL.g.dev.root : SEL.type === 'mut' ? SEL.it.W : SEL.type === 'dev' ? SEL.it.g : HW.root, wp = o.getWorldPosition(V(0, 0, 0)); wp.y += SEL.type === 'hw' ? 0.5 : 0.36; wp.project(cam); $('tb').style.transform = `translate(${(wp.x + 1) / 2 * innerWidth}px,${(1 - wp.y) / 2 * innerHeight}px) translate(-50%,-100%)`; $('tb').classList.toggle('on', wp.z < 1); $('tb').firstChild.querySelector('small').textContent = SEL.type === 'dev' ? (SEL.it.on ? 'PROBAR' : 'ABRIR') : 'TRANSFORM'; } else $('tb').classList.remove('on');
    if (HW && HW.P) HW.P.visible = (HW.u || 0) > 0.3; { const hideP = MEGA || CINE.on; items.forEach((it) => { if (it.P) it.P.visible = !hideP && it.T > 0.1; }); open.forEach((g) => { const sk = g.dev.root.userData.sock; if (sk) sk.visible = !hideP; }); flyers.forEach((f) => { const sk = f.dev.root.userData.sock; if (sk) sk.visible = false; }); }
    { let vu = 0; const an = UA.bus && UA.bus.out; if (an && UA.ctx && UA.ctx.state === 'running') { an.getByteTimeDomainData(tb); let s2 = 0; for (let k = 0; k < tb.length; k += 8) { const x = (tb[k] - 128) / 128; s2 += x * x; } vu = Math.min(1, Math.sqrt(s2 / 128) * 4); } VU.forEach((v) => { v.m.material.emissiveIntensity = vu * 9 > v.i ? 2.2 : 0.05; }); LV = vu; }
    if (MEGA) { const bt = t * (RADIO.bpm || 100) / 60 * Math.PI; open.forEach((g, i) => { const h = g.it.tok.position, p = g.dev.root.position; p.x = h.x + Math.cos(t * 0.8 + i) * 0.07; p.z = h.z + Math.sin(t * 0.8 + i) * 0.07; p.y = 0.26 + 0.06 * Math.abs(Math.sin(bt + i)); g.dev.root.rotation.y += dt * 1.2; });
      open.forEach((g) => { const sk = g.dev.root.userData.sock; if (sk) sk.visible = false; });
      items.forEach((it, i) => { if (it.W && it.R && !CINE.on) { if (it.P) it.P.visible = false; const h = it.home || it.tok.position, k = Math.min(1, (it.fly = (it.fly || 0) + dt * 0.4)), ph = i * 0.9, gx = Math.sin(t * 0.23 + ph) * CW * 0.62 + Math.sin(t * 0.7 + ph * 2) * 0.3, gz = Math.cos(t * 0.19 + ph * 1.3) * CD * 0.55, gy = 0.55 + 0.35 * Math.sin(t * 0.5 + ph) + 0.08 * Math.sin(bt + i); it.W.position.x = lerp(h.x, gx, k); it.W.position.z = lerp(h.z, gz, k); it.W.position.y = lerp(it.tok.position.y, gy, k); it.W.rotation.y = Math.atan2(Math.cos(t * 0.23 + ph), -Math.sin(t * 0.19 + ph * 1.3)) + Math.sin(t * 2 + i) * 0.4; it.W.rotation.z = Math.sin(t * 1.7 + i) * 0.45; it.W.rotation.x = (i % 3 === 0 ? Math.sin(t * 1.1 + i) * 0.8 : Math.sin(t * 0.9 + i) * 0.2); } });
      if (!CINE.on) separate(items.filter((it) => it.W && it.R), 0.2, false);
      flyers.forEach((f, i) => { f.m = Math.min(2, f.m + dt * 0.5); f.a += dt * 0.22; f.dev.root.position.set(Math.cos(f.a) * (CW / 2 - 0.4), 0.8 + 0.12 * Math.sin(bt + i), Math.sin(f.a) * (CD / 2 - 0.35)); f.dev.root.rotation.y = -f.a; f.dev.update(f.m, dt, { level: 0.3 }); }); }
    document.body.classList.toggle('cine', CINE.on && lidOpen > 0.95);
    scrT -= dt; if (scrT <= 0) { scrT = 0.25; drawScr(t, A.song, CINE.on); }
    if (CINE.on !== DRC.was) { DRC.was = CINE.on; try { CINE.on ? cineStart() : cineStop(); } catch (er) { console.warn(er); } }
    if (CINE.on && lidOpen > 0.95) DIRECTOR(dt, t);
    rings.forEach((r) => { r.m.rotation.y += dt * (0.4 + r.i * 0.3 + LV * 3) * r.sx * (r.i % 2 ? -1 : 1); r.m.scale.setScalar(1 + LV * 0.12 * (3 - r.i)); r.m.material.emissiveIntensity = 1 + LV * 4; });
    rtPlane.visible = !!SEL && lidOpen > 0.9; if (!MAP.expandedOpen && rtPlane.visible && !(frameN % (window.__LOWFPS ? 10 : 4))) { const o = SEL.type === 'cap' ? SEL.g.dev.root : SEL.type === 'mut' ? SEL.it.W : SEL.type === 'dev' ? SEL.it.g : HW.root, wp = o.getWorldPosition(V(0, 0, 0)), d = { cap: 0.5, mut: 0.42, hw: 1.3, dev: 0.75 }[SEL.type];
      wp.y += d * 0.25; rtCam.position.set(wp.x + Math.sin(t * 0.6) * d, wp.y + d * 0.55, wp.z + Math.cos(t * 0.6) * d); rtCam.lookAt(wp); rtPlane.visible = false; S.renderer.setRenderTarget(RT); S.renderer.render(S.scene, rtCam); S.renderer.setRenderTarget(null); rtPlane.visible = true; }
    btns.forEach((b) => { b.p = Math.max(0, b.p - dt * 4); b.cap.position.y = 0.04 * b.p; const hv = HOVB === b ? 0.6 : 0; let ei = (SEL && b.a !== 'super' && b.a !== 'cine' ? 0.45 + 0.25 * Math.sin(t * 4) : 0.25) + b.p + hv; if (b.a === 'super') { ei = (MEGA ? 1.3 : 0.75) + 0.3 * Math.sin(t * 3) + b.p + hv + LV * 0.6; b.halo.material.opacity = (MEGA ? 0.55 : 0.28) + 0.12 * Math.sin(t * 3) + LV * 0.3; b.orb.rotation.y += dt * (MEGA ? 3 : 0.8); b.orb.children.forEach((o, k) => { o.position.y = -0.06 - 0.03 * Math.abs(Math.sin(t * 4 + k)); o.rotation.y += dt * 4; }); }
      if (b.a === 'cine' && b.orb) b.orb.rotation.y -= dt * (CINE.on ? 2.5 : MEGA ? 1.4 : 0.4); if (b.a === 'cine') { const bl = MEGA && !CINE.on; const on = bl ? Math.sin(t * 14) > 0 : CINE.on; ei = on ? 2.6 : 0.3; b.halo.material.opacity = bl ? (on ? 1 : 0) : CINE.on ? 0.5 : 0; b.halo.scale.setScalar(bl ? 1.3 : 0.9); } b.cap.material.emissiveIntensity = ei; b.ring.material.color.setHex(b.cap.material.color.getHex()).multiplyScalar(0.6 + Math.min(1.4, ei * 0.5)); });
    for (let q = flyers.length - 1; q >= 0; q--) { const f = flyers[q]; if (!f.out) continue; const r0 = f.dev.root; r0.scale.multiplyScalar(1 - Math.min(0.9, dt * 3)); r0.position.y += dt * 1.5; r0.rotation.y += dt * 4; if (r0.scale.x < 0.004) { caseG.remove(r0); flyers.splice(q, 1); } }
    items.forEach((it) => { if (it.retT > 0 && it.W && it.home && !MEGA && !CINE.on) { it.retT -= dt; const p = it.W.position; p.lerp(it.home, Math.min(1, dt * 2.2)); const dx = it.home.x - p.x, dz = it.home.z - p.z; if (Math.hypot(dx, dz) > 0.02) it.W.rotation.y = Math.atan2(dx, dz); it.W.rotation.x *= 0.9; it.W.rotation.z *= 0.9; if (it.retT <= 0) { p.copy(it.home); it.W.rotation.set(0, 0, 0); } } });
    if (UA.ctx && UA.bus && !STOW && !A.shutting) { const n = open.length + (HW && (HW.T || 0) > 2.5 ? 1 : 0) + (items.some((it) => it.kind === 'mut' && it.T > 2.5) ? 1 : 0) + (A.using ? 1 : 0); const gt = 0.72 / Math.sqrt(1 + 0.22 * n) * (A.duck ? 0.35 : 1); if (Math.abs((A.mg || 0.85) - gt) > 0.01) { A.mg = gt; try { UA.bus.master.gain.setTargetAtTime(gt, UA.ctx.currentTime, 0.4); } catch (er) {} } }
    // Resolution is managed only by window.__perf above; avoid conflicting DPR changes.
    if (RADIO.st.on && !HVA) vaSync(); if (HVA && HVA.set && (A.vaT = (A.vaT || 0) - dt) <= 0) { A.vaT = 0.5; const busy2 = open.length + (A.using ? 1 : 0); try { HVA.set('volume', RADIO.st.on ? clamp(0.62 - busy2 * 0.04, 0.38, 0.62) : 0.78); LVA.set('volume', clamp(0.5 - busy2 * 0.04, 0.3, 0.5)); } catch (e) {} } if (RADIO.st.on && RADIO.pump) RADIO.pump();
    LAVA.draw(dt, LV || 0); window.__LVL = LV || 0; ROOM.tick(dt, t, LV || 0);
    try { OUTTALK.tick(dt, t); SIDE.tick(); BANDS.tick(); SPEEDL.tick(dt); GS.tick(dt); try { FEST.tick(dt, t); BATTLE.tick(); } catch (e) {} CAPS.tick(dt); SECRETS.tick(dt, t); SKYBOTS.tick(dt, t); ONLINE.tick(dt, t); SURFBOTS.tick(dt, t); TITANS.tick(dt, t); FAR.tick(dt, t); } catch (e) {} ROBOT_STEPS.tick(dt); GROW.tick(dt, t); /* Ambient GROW robots no longer mirror player altitude. */ try { HOST.tick(dt, t); MAP.tick(); if (STORY) STORY.chatter(dt, lidOpen > 0.95 && !CINE.on && (!ROAMS.on || (window.__idleT || 0) > 14)); if (STORY) STORY.tick({ open: lidOpen > 0.95 && !CINE.on, far: view.gd > view.D0 * 1.08 || ROAMS.on }); if (HW && (HW.T || 0) > 3) { if (!window.__hwEv) { window.__hwEv = 1; window.UEV('hwopen'); } } else window.__hwEv = 0; } catch (e) {} MEGALIT.tick(dt, t, LV || 0); try { HAND.tick(dt); } catch (e) {} if (HW && (HW.u || 0) > 0.3 && HW.root) { HWAUTO.bbT = (HWAUTO.bbT || 0) - dt; if (HWAUTO.bbT <= 0) { HWAUTO.bbT = 0.8; const bb = new THREE.Box3().setFromObject(HW.root), sz = bb.getSize(V(0, 0, 0)); HWAUTO.c = bb.getCenter(V(0, 0, 0)); HWAUTO.r = Math.max(sz.x, sz.z) * 0.55; }
      bots().forEach((it) => { const par = it.W.parent; if (!par || !HWAUTO.c) return; const ws = par.getWorldScale(V(1, 1, 1)).x || 1, hl = par.worldToLocal(HWAUTO.c.clone()), R0 = HWAUTO.r / ws + 0.12, p = it.W.position, dx = p.x - hl.x, dz = p.z - hl.z, d = Math.hypot(dx, dz) || 0.01; if (d < R0) { const k = R0 / d; p.x = hl.x + dx * k; p.z = hl.z + dz * k; if (it.cn) { it.cn.x = p.x; it.cn.z = p.z; const tx = it.cn.tx - hl.x, tz = it.cn.tz - hl.z, td = Math.hypot(tx, tz) || 0.01; if (td < R0) { it.cn.tx = hl.x + tx / td * R0 * 1.2; it.cn.tz = hl.z + tz / td * R0 * 1.2; } } } }); }
    bots().forEach((it, i) => { const u = it.W.userData; if (u.s0 == null) u.s0 = it.W.scale.x; const tg = MEGA && i % 2 === 0 ? u.s0 * 1.9 : u.s0; if (Math.abs(it.W.scale.x - tg) > 1e-4) it.W.scale.setScalar(lerp(it.W.scale.x, tg, 0.04)); }); WRADIO.tick(dt, !!(RADIO.st.on || A.using || A.duck || (window.__kLast && performance.now() - window.__kLast < 4000))); try { XFX.tick(dt, t, MEGA, LV || 0); { const pl = performance.now() - (window.__kLast || 0) < 1600; if (pl !== HWAUTO.pl) { HWAUTO.pl = pl; try { const B = RADIO.buses; if (B && B.out) B.out.gain.setTargetAtTime(pl ? 0.5 : 0.85, UA.ctx.currentTime, pl ? 0.05 : 0.7); } catch (e) {} XFX.makeup(pl ? (MEGA ? 1.9 : 1.6) : 1.25); } } if (HVA && MEGA) { HWAUTO.pT = (HWAUTO.pT == null ? 20 : HWAUTO.pT) - dt; if (HWAUTO.pT <= 0) { HWAUTO.pT = 24 + Math.random() * 16; const pool = [0, 1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15]; const pi = pool[Math.floor(Math.random() * pool.length)]; try { const pr = HVA.preset(pi); say('🎛️ HYPERWAVE · sonido: ' + pr.name); } catch (e) {} } } if (HVA) { HWAUTO.t -= dt; if (HWAUTO.t <= 0) { HWAUTO.t = 0.25; const sc = HVA.scope ? HVA.scope().level : 0; HWAUTO.k += ((sc > 0.8 ? 0.8 : sc < 0.25 && performance.now() - (window.__kLast || 0) < 2000 ? 1.12 : 1) * (RADIO.st.on ? 0.92 + 0.12 * (RADIO.st.energy || 0.5) : 1) - HWAUTO.k) * 0.3; const v = clamp(HWVOL * HWAUTO.k, 0, 1); if (Math.abs(v - HWAUTO.last) > 0.01) { HWAUTO.last = v; HVA.set('volume', v); } } { HWAUTO.fx = (HWAUTO.fx || 0) - dt; if (HWAUTO.fx <= 0) { HWAUTO.fx = 0.5; const sc2 = HVA.scope ? HVA.scope().level : 0, en = (RADIO.st && RADIO.st.energy) || 0.5, busy = performance.now() - (window.__kLast || 0) < 1500, tt = performance.now() / 1000; const P = { cutoff: clamp(0.5 + 0.2 * Math.sin(tt * 0.07) + (busy ? 0.08 : 0) - sc2 * 0.1, 0.35, 0.8), delay: clamp(0.16 + 0.1 * en - (busy ? 0.04 : 0), 0.1, 0.3), reverb: clamp(0.28 + 0.12 * (1 - sc2), 0.2, 0.42) }; HWAUTO.P = HWAUTO.P || {}; for (const k in P) { const o = HWAUTO.P[k] == null ? P[k] : HWAUTO.P[k], nv = o + (P[k] - o) * 0.35; HWAUTO.P[k] = nv; try { HVA.set(k, nv); } catch (e) {} } } } } } catch (e) {} lidArt.material.emissiveIntensity = 0.9 + (LV || 0) * 2.6 + 0.15 * Math.sin(t * 2);
    // Native case switch breathes while closed to invite the first tap.
    // Same scene and materials, no extra timers, sprites or render pass.
    { const parts=window.__unfireOpenButtonParts;
      if(parts&&parts[2]&&parts[2].material){
        const prompt=!ROAMS.on&&lidOpen<0.08&&!lidControlledByPlayer&&!document.hidden;
        
        const beat=prompt?(REDUCED_MOTION_CASE_CUE?0.42:Math.pow(Math.max(0,Math.sin(t*3.4)),4)):0;
        const dome=parts[2].material;
        dome.emissiveIntensity=prompt?0.55+1.4*beat:0.6;
        const ring=parts[0]&&parts[0].material;
        if(ring&&typeof ring.emissiveIntensity==='number')
          ring.emissiveIntensity=prompt?2.4+3.2*beat:3;
      } }
    if (KEYC) KEYC(dt, t); hovLT += (( mouse.in && performance.now() - mouse.t < 1500 ? 1 : 0) - hovLT) * 0.15; HOVL.intensity = hovLT * 1.4;
    if (DOMEG) DOMEG.g.scale.y = 0.04 + 0.96 * ease.smooth(clamp((lidOpen - 0.35) / 0.6));
    // A 90 km depth range combined with sub-centimetre near planes causes
    // flickering/z-fighting indoors. Use deep view only while truly outside.
    const targetFar = ROAMS.on && window.ATM_OUT ? 90000 : 4000;
    if (cam.far !== targetFar) { cam.far = targetFar; cam.updateProjectionMatrix(); }
    // Render case camera last, after player movement and third-person camera updates.
    // All existing raycast controls therefore use the same case camera on the next input.
    if(CASE_VIEW.on&&ROAMS.on&&!carryingCase&&caseG.visible){
      const a=CASE_VIEW.angle,d=CASE_VIEW.dist,el=CASE_VIEW.elevation;
      cam.position.set(caseG.position.x+Math.sin(a)*Math.cos(el)*d,caseG.position.y+Math.sin(el)*d,caseG.position.z+Math.cos(a)*Math.cos(el)*d);
      cam.lookAt(caseG.position.x,caseG.position.y+0.4,caseG.position.z);
      cam.near=0.05;const panoramic=window.ATM_OUT;cam.fov=panoramic?(cam.aspect<1?Math.min(70,56+(1-cam.aspect)*18):56):(cam.aspect<1?Math.min(62,48+(1-cam.aspect)*24):48);cam.updateProjectionMatrix();
    }
    // An opaque 2D map covers the scene: skip WebGL rendering behind it.
    if (!MAP.expandedOpen) S.renderer.render(S.scene, cam);
  }
  addEventListener('message', (e) => { const d = e.data || {}; if(d.unfire && d.entryStart){window.__unfireCaseEntryStarted=true;
      // The host is already edge-to-edge. Animate the lid *here*, without
      // teleporting to the robot or replacing the maletín inspection camera.
      frameVisible=true;lidControlledByPlayer=true;
      carryingCase=false;caseG.visible=true;
      pTarget=0;ROOM.AMB.mute=false;
      if(ROAMS.on)exitRoam();CASE_VIEW.on=false;
      // Glide toward the physical case, then open the lid in place. Never jump to robot camera.
      entryDolly.active=true;entryDolly.from=view.dist;entryDolly.to=view.D0*.96;
      entryDolly.elapsed=0;entryDolly.openAfter=false;view.gd=entryDolly.to;pTarget=1;
      updateCarryUI();
    }
    if (d.unfire && d.p != null && !lidControlledByPlayer) pTarget = d.p; if (d.unfire && d.legacyCaseClose) closeCaseInGame(); if(d.unfire && d.releaseCaseControl){CAPS.cancel();lidControlledByPlayer=false;carryingCase=false;caseG.visible=true;caseG.scale.setScalar(1);caseG.position.copy(originalCasePosition);caseG.rotation.y=0;updateCarryUI();} if (d.unfire && d.stop) { closeAll(true); stopAll(); ROOM.AMB.mute = true; } if (d.unfire && d.p > 0.5) ROOM.AMB.mute = false; if (d.unfire && 'vis' in d) { frameVisible = !!d.vis; if(frameVisible && ROOM.AMB)ROOM.AMB.mute=false; window.__gameVisible = frameVisible; ONLINE.voiceVisibility(frameVisible); } if (d.unfire && d.vis === false) { closeAll(true); setRobot(null); stopAll(); CINE.on = false; if (MEGA) megaOff(); CK.forEach((k) => { compG[k].userData.open = 0; compG[k].userData.t = 0; }); if (HW) { HW.T = 0; HW.u = 0; HW.tg = 0; } items.forEach((it) => { if (it.kind === 'mut') { it.tgt = 0; it.T = 0; } if (it.g) { it.on = 0; it.kk = 0; } if (it.W && it.home) { it.W.position.copy(it.home); it.W.rotation.set(0, 0, 0); it.retT = 0; } }); view.gd = view.D0; view.gx = 0; view.gz = 0.15; ORB.gaz = ORB.gde = 0; } if (d.unfire && d.audio) { try { UA.init(); } catch (er) {} } });
  window.__UNFIRE_CASE_QA = {
    get closed(){return pTarget<0.5},
    get carrying(){return carryingCase},
    get portableUnlocked(){return portableUnlocked()},
    get capsuleFlying(){return CAPS.flying},
    // CI software WebGL may render at fewer than one frame per second.
    // Use the identical capsule simulation in deterministic localhost-only steps.
    advanceCapsuleInLocalTest(steps=16){
      if (!['localhost','127.0.0.1','[::1]'].includes(location.hostname)) return false;
      const n = Math.min(32,Math.max(0,Number.isFinite(steps)?Math.floor(steps):0));
      for(let i=0;i<n && CAPS.flying;i++) CAPS.tick(0.06);
      return !CAPS.flying;
    },
    get caseVisible(){return caseG.visible},
    get inspecting(){return CASE_VIEW.on},
    get lid(){return lidOpen},
    get mission(){return typeof SIDE!=='undefined' && SIDE.cur ? SIDE.cur.t : null},
    get roam(){return ROAMS.on},
    get originalButterfly(){return !!lidBtn && lidBtn.children.length>0},
    get originalLidButton(){return !!window.__ringB && window.__ringB.parent===lid && window.__ringB.geometry.type==='TorusGeometry'},
    get casePos(){return [caseG.position.x,caseG.position.y,caseG.position.z]},
    get playerPos(){return [ROAMS.p.x,ROAMS.p.y,ROAMS.p.z]},
    get openControl(){return getComputedStyle(carryButton).display},
    get scrollLock(){return lidControlledByPlayer}
  };
  window.__mal = { t: { openEverything, openAllComp, act, openGear, setSel: (x) => (SEL = x), compG, HW },  open: (i) => openGear(items.filter((x) => x.kind === 'cap')[i], true),  setP: (p) => { pTarget = pNow = p; lidMotion.from=lidMotion.to=p; lidMotion.elapsed=0; setLid(p); }, requestOpen: () => openCaseInGame(), startGame:()=>{if(ROAMS.on)exitRoam();openCaseInGame();}, showCaseView, showRobotView, packCapsule: () => CAPS.pack(), throwCapsule: () => CAPS.throwIt(), toggleCase: toggleCaseInGame, view, zoomBy, flyTo, items, S, snap() { view.dist = view.gd; view.tx = view.gx; view.tz = view.gz; }, go(it) { flyTo(it); view.dist = view.gd; view.tx = view.gx; view.tz = view.gz; } };
  // A direct-link visitor can tap the button before the heavy 3D scene is initialized.
  if (parent === window && window.__unfireDirectOpenPending) {
    lidControlledByPlayer=true;carryingCase=false;caseG.visible=true;
    pTarget = 1;ROOM.AMB.mute=false;
    const direct = document.getElementById('directOpen');
    if (direct) direct.hidden = true;
  }
  addEventListener('pointerdown', () => { try { UA.init(); } catch (e) {} }, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
  $('buy').onclick = () => { const k = $('buy').dataset.k; if (k === 'archer') parentPost({ open: 'archer' }); else if (k) parentPost({ buy: k }); };
  try { if (window.UNFIRE_COINS_BOOT) window.UNFIRE_COINS_BOOT({ROAMS,THREE,S,MUTANTS}); } catch (e) { console.warn('Coins module unavailable', e); }
  Y2K.fonts().then(() => {}); resize(); view.dist = view.gd = view.D0;
  S.fit(new THREE.Box3(V(-CW / 2, 0, -CD / 2), V(CW / 2, HB + 2, CD / 2)));
  // Prime movable indoor props during the already-interactive case view, NOT
  // on the first walking frame. Work is bounded and never hides collision data:
  // if the player starts early, the original synchronous fallback still runs.
  let roomPrewarmRequested = false;
  function prewarmRoamingObstacles() {
    if (ROAMS.on || !window.__PROPS || window.__OBST || document.hidden) return;
    const roots = ROOM.R.children.slice(), excluded = new Set(window.__PROPS.map(q => q.o));
    const pending = [], found = [];
    const bounds = new THREE.Box3(), size = new THREE.Vector3();
    let rootIndex = 0;
    const scanSlice = () => {
      if (ROAMS.on || window.__OBST || document.hidden ||
          ROOM.R.children.length !== roots.length) return;
      const end = performance.now() + 2.5;
      let processed = 0;
      while (processed < 32 && performance.now() < end &&
             (pending.length || rootIndex < roots.length)) {
        if (!pending.length) {
          const top = roots[rootIndex++];
          if (!top.visible || top.isLight || excluded.has(top) || top.userData.noCollide) continue;
          top.updateMatrixWorld(true);
          pending.push(top);
        }
        const o = pending.pop(); processed++;
        if (!o.visible) continue;
        if (o.children) for (let i = o.children.length - 1; i >= 0; i--) pending.push(o.children[i]);
        if (!o.isMesh || o.isSprite || o.isPoints || (o.material &&
            ((o.material.transparent && o.material.opacity < 0.5) ||
             o.material.blending === THREE.AdditiveBlending))) continue;
        bounds.setFromObject(o);
        if (bounds.isEmpty()) continue;
        bounds.getSize(size);
        if (bounds.min.y > -1.4 || bounds.max.y < -8.2) continue;
        if (Math.max(size.x, size.z) > 60 || (size.x > 30 && size.z > 30)) continue;
        if (Math.min(size.x, size.z) < 0.05 && Math.max(size.x, size.z) < 0.5) continue;
        found.push({x0: bounds.min.x-1.1, x1: bounds.max.x+1.1,
          z0: bounds.min.z-1.1, z1: bounds.max.z+1.1, y1: bounds.max.y});
      }
      if (pending.length || rootIndex < roots.length) setTimeout(scanSlice, 26);
      else if (!ROAMS.on && !window.__OBST && !document.hidden)
        window.__OBST = found.filter(B =>
          !(0 > B.x0 && 0 < B.x1 && 24 > B.z0 && 24 < B.z1) &&
          !(-30 > B.x0 - 3 && -30 < B.x1 + 3 && B.z1 > 84) &&
          Math.abs(B.x1 - B.x0) < 70);
    };
    setTimeout(scanSlice, 26);
  }
  function prewarmRoamingProps() {
    if (ROAMS.on || window.__PROPS || document.hidden) return;
    const roots = ROOM.R.children.slice(), found = [];
    const bounds = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
    let index = 0;
    const scanSlice = () => {
      if (ROAMS.on || window.__PROPS || document.hidden) return;
      const end = performance.now() + 2.5;
      let processed = 0;
      while (index < roots.length && processed < 6 && performance.now() < end) {
        const o = roots[index++]; processed++;
        if (!o.visible || o.isLight || o.userData.noPush) continue;
        bounds.setFromObject(o);
        if (bounds.isEmpty()) continue;
        bounds.getSize(size); bounds.getCenter(center);
        if (size.y < 5.8 && Math.max(size.x, size.z) < 6.5 &&
            bounds.min.y < -7.6 && Math.hypot(center.x, center.z) > 9 &&
            Math.abs(center.x) < 76 && center.z < 93) {
          found.push({ o, r: Math.max(size.x, size.z) * 0.5,
            off: V(center.x - o.position.x, 0, center.z - o.position.z),
            vx: 0, vz: 0, sp: 0 });
        }
      }
      if (index < roots.length) setTimeout(scanSlice, 26);
      else if (!ROAMS.on && !window.__PROPS && !document.hidden &&
               ROOM.R.children.length === roots.length) {
        window.__PROPS = found;
        prewarmRoamingObstacles();
      }
    };
    setTimeout(scanSlice, 26);
  }
  const VER = /ver=(\d+)/.exec(location.search + location.hash);
  if (VER) { caseG.visible = false; ROOM.R.visible = false; ['hud', 'tip', 'buy', 'tb'].forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
    const spec = PLUGINS.list[+VER[1] % PLUGINS.list.length], dev = GEAR4.build(spec, kindOf(spec), Object.keys(ENGINES.PARAMS[spec.engine]).slice(0, 4).map((k) => k.toUpperCase())); dev.root.scale.setScalar(0.42); S.scene.add(dev.root);
    let m = 0, a = 0, vd = null; let lastPreviewFrame = 0; const vloop = (ts = 0) => {
      if (document.hidden) { clock.getDelta(); setTimeout(() => requestAnimationFrame(vloop), 180); return; }
      if (ts && lastPreviewFrame && ts - lastPreviewFrame < 32) { requestAnimationFrame(vloop); return; }
      lastPreviewFrame = ts;
      const dt = Math.min(0.05, clock.getDelta()) * (window.__dts || 1); m = Math.min(2, m + dt * 0.4); if (!vd) a += dt * 0.3; cam.aspect = innerWidth / innerHeight; cam.position.set(Math.sin(a) * 4.4, 2.6, Math.cos(a) * 4.4); cam.lookAt(0, 0.75, 0); cam.near = 0.05; cam.updateProjectionMatrix(); dev.update(m, dt, { level: 0.25 }); S.renderer.render(S.scene, cam); requestAnimationFrame(vloop); };
    cv.addEventListener('pointerdown', (e) => { vd = e.clientX; }); addEventListener('pointermove', (e) => { if (vd != null) { a -= (e.clientX - vd) * 0.01; vd = e.clientX; } }); addEventListener('pointerup', () => { vd = null; });
    S.renderer.setSize(innerWidth, innerHeight, false); requestAnimationFrame(vloop); }
  else { requestAnimationFrame(frame);
    // Do not prewarm during boot or the first case tap: GPU/CPU first paint wins.
    // No hidden-scene precompile: compiling every hidden model and all cached gadgets
    // in the same frame caused large GPU memory spikes and a freeze on room exit.
    // Devices already load lazily as their compartments are opened.
  }
})();

