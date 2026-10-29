/* Workshop (TALLER) showcase camera: while the customiser is open, frame the
 * player's robot from the front, whole body visible, in the free part of the
 * screen next to the panel, and never behind a wall or column. */
(() => {
  'use strict';
  if (!window.THREE) return;
  const V3 = THREE.Vector3;
  const ray = new THREE.Raycaster();
  const st = { pos: null, look: null, dist: 0, lastRay: 0, on: false };

  function isAvatar(o, w) { for (let p = o; p; p = p.parent) if (p === w) return true; return false; }
  function solid(o) {
    if (!o.isMesh || !o.visible) return false;
    for (let p = o; p; p = p.parent) if (p.visible === false) return false;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    return !(m && m.transparent && m.opacity < 0.5);
  }
  // Robots and props are made of small parts; only walls, columns and furniture block the view.
  const _s = new THREE.Vector3();
  function big(o, h) {
    const g = o.geometry; if (!g) return false;
    if (!g.boundingSphere) g.computeBoundingSphere();
    o.getWorldScale(_s);
    return g.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) > h * 0.35;
  }
  function freeCentre() {
    const panel = document.querySelector('#onl .b') || document.querySelector('#onl > div:not(style)');
    const W = innerWidth, H = innerHeight;
    if (!panel) return [0, 0, 1, 1];
    const r = panel.getBoundingClientRect();
    const areas = [
      { a: Math.max(0, W - r.right) * H, x: (r.right + W) / 2, y: H / 2, fw: (W - r.right) / W, fh: 1 },
      { a: Math.max(0, r.left) * H, x: r.left / 2, y: H / 2, fw: r.left / W, fh: 1 },
      { a: Math.max(0, r.top) * W, x: W / 2, y: r.top / 2, fw: 1, fh: r.top / H },
      { a: Math.max(0, H - r.bottom) * W, x: W / 2, y: (r.bottom + H) / 2, fw: 1, fh: (H - r.bottom) / H }
    ].sort((a, b) => b.a - a.a);
    const best = areas[0];
    if (best.a < W * H * 0.12) return [0, 0, 1, 1];
    return [best.x / W * 2 - 1, -(best.y / H * 2 - 1), best.fw, best.fh];
  }

  function frame(scene, cam, R0) {
    const w = R0.av.w;
    const box = new THREE.Box3().setFromObject(w);
    if (box.isEmpty()) return;
    const c = box.getCenter(new V3()), size = box.getSize(new V3());
    // Skinned robot parts animate beyond their bind-pose box: frame a little larger and higher.
    const h = Math.max(size.y, size.x * 0.8, 0.01) * 1.3;
    c.y += size.y * 0.12;
    const fov = (st.fov0 != null ? st.fov0 : cam.fov) * Math.PI / 180, aspect = cam.aspect || innerWidth / innerHeight;
    const [xn, yn, fw, fh] = freeCentre();
    // Whole robot inside the free part of the screen (85% of it), height and width.
    const t = Math.tan(fov / 2);
    const want = Math.max(h / (2 * t * 0.72 * fh), (size.x * 0.9 + 0.01) / (2 * t * aspect * 0.72 * fw), h * 0.9);
    // The robot's own facing (local +Z) so we always see its front, on every device and camera mode.
    const face = new V3(); w.getWorldDirection(face); face.y = 0;
    if (face.lengthSq() < 1e-6) face.set(Math.sin(R0.yaw || 0), 0, -Math.cos(R0.yaw || 0));
    face.normalize();
    const side = new V3(-face.z, 0, face.x);
    const dir = face.clone().multiplyScalar(0.88).addScaledVector(side, 0.3).setY(0.16).normalize();
    const now = performance.now();
    if (!st.dist || now - st.lastRay > 220) {
      st.lastRay = now;
      ray.set(c, dir); ray.far = want + h * 0.5; ray.near = h * 0.25;
      let d = want;
      try {
        const hits = ray.intersectObjects(scene.children, true);
        for (const hit of hits) { if (!isAvatar(hit.object, w) && solid(hit.object) && big(hit.object, h)) { d = Math.min(want, Math.max(h * 0.75, hit.distance - h * 0.18)); break; } }
      } catch (_) {}
      st.target = d;
    }
    st.dist = st.dist ? st.dist + (st.target - st.dist) * Math.min(1, 0.12 * Math.max(1, (now - (st.t || now)) / 16)) : st.target;
    if (st.fov0 == null) { st.fov0 = cam.fov; st.fov = null; }
    const needFov = Math.min(Math.max(st.fov0, 100), Math.max(st.fov0, 2 * Math.atan(h / (2 * 0.72 * fh * st.dist)) * 180 / Math.PI));
    st.fov = st.fov == null ? cam.fov : st.fov + (needFov - st.fov) * Math.min(1, 0.15 * Math.max(1, (now - (st.t || now)) / 16));
    cam.fov = st.fov;
    const pos = c.clone().addScaledVector(dir, st.dist);
    const halfH = Math.tan(cam.fov * Math.PI / 360) * st.dist, halfW = halfH * aspect;
    const fwd = c.clone().sub(pos).normalize();
    const right = new V3().crossVectors(fwd, new V3(0, 1, 0)).normalize();
    const up = new V3().crossVectors(right, fwd).normalize();
    const look = c.clone().addScaledVector(right, -xn * halfW).addScaledVector(up, -yn * halfH);
    if (!st.on || !st.pos) { st.pos = cam.position.clone(); st.look = look.clone(); }
    const dt = Math.min(0.5, Math.max(0.001, (now - (st.t || now)) / 1000)); st.t = now;
    const k = 1 - Math.exp(-dt * 7);
    st.pos.lerp(pos, k); st.look.lerp(look, k);
    cam.position.copy(st.pos); cam.lookAt(st.look);
    cam.near = Math.min(cam.near, 0.02); cam.updateProjectionMatrix();
    st.on = true;
  }

  function hook() {
    const api = window.__roamAPI, mal = window.__mal;
    if (!api || !mal || !mal.S || !mal.S.scene) { setTimeout(hook, 600); return; }
    const scene = mal.S.scene;
    if (scene.__workshopCam) return;
    scene.__workshopCam = true;
    const isOpen = () => { const ui = document.getElementById('onl'), R0 = api.ROAMS; return !!(ui && ui.classList.contains('on') && ui.classList.contains('workshop') && R0 && R0.on && R0.av && R0.av.w); };
    // Runs inside every render of the world, whatever path the device uses to draw it.
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (renderer, sc, cam, target) {
      try { if (typeof prev === 'function') prev.apply(this, arguments); } catch (_) {}
      try {
        if (cam && cam.isPerspectiveCamera && isOpen()) { frame(sc, cam, api.ROAMS); cam.updateMatrixWorld(true); }
        else if (cam && cam.isPerspectiveCamera) { if (st.fov0 != null) { cam.fov = st.fov0; cam.updateProjectionMatrix(); st.fov0 = null; } st.on = false; st.dist = 0; st.t = 0; }
      } catch (e) { window.__wsErr = String(e && e.stack || e).slice(0, 300); }
    };
  }
  hook();
})();
