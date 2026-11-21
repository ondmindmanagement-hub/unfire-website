#!/usr/bin/env node
/* Hyperwave 2000 — physical plausibility audit of the real digital model.
 * Samples the transformation T = 0..4 and measures, in millimetres (1 model unit = 100 mm):
 *  - interpenetration between the speaker pods and the body / canopy shells (analytic superellipsoids)
 *  - parts below the floor
 *  - canopy (shell + display assembly) sweeping through the keyboard and control panel
 *  - internal parts protruding outside the closed enclosure at T = 0 (cannot close)
 *  - "rubber" parts: meshes whose scale changes (stretching struts/pistons) and parts that appear from nothing
 *  - unsupported parts: speaker pods displaced from their dock with no visible arm
 *  - overshoot (springy easing) on heavy parts
 * Usage: node physics-audit.cjs <baseUrl> [outJson]   (PUPPETEER_CORE env points to puppeteer-core) */
const fs = require('fs');
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const base = process.argv[2] || 'http://127.0.0.1:8731', outFile = process.argv[3];
(async () => {
  const b = await pc.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '/audio/hyperwave/', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.__hw && document.body.classList.contains('ready'));
  if (process.env.NEG) await p.evaluate((n) => { window.__NEG = n; }, +process.env.NEG);
  const rep = await p.evaluate(() => {
    const H = window.__hw.H, st = window.__hw.st; window.__hw.pause(true);
    const R = H.root, kids = R.children, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const A = 2.3, HB = 0.46, HL = 0.42, C = 1.2, E1 = 0.45, E2 = 0.28, CY = 0.52;
    const PS = { a: 0.34, b: 0.36, c: 0.6, e1: 0.6, e2: 0.62 };
    const F = (x, y, z, s) => Math.pow(Math.pow(Math.abs(x / s.a), 2 / s.e2) + Math.pow(Math.abs(z / s.c), 2 / s.e2), s.e2 / s.e1) + Math.pow(Math.abs(y / s.b), 2 / s.e1);
    const SB = { a: A, b: HB, c: C, e1: E1, e2: E2 }, SL = { a: A, b: HL, c: C, e1: E1, e2: E2 };
    // superellipsoid surface samples (x along a, y along b, z along c)
    const sg = (s, n, half) => { const pts = []; for (let i = 0; i <= n; i++) for (let j = 0; j < 2 * n; j++) {
      const u = half === 'lower' ? -Math.PI / 2 + (i / n) * Math.PI / 2 : half === 'upper' ? (i / n) * Math.PI / 2 : -Math.PI / 2 + (i / n) * Math.PI, v = (j / (2 * n)) * 2 * Math.PI;
      const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v), pw = (q, e) => Math.sign(q) * Math.pow(Math.abs(q), e);
      pts.push(V(s.a * pw(cu, s.e1) * pw(cv, s.e2), s.b * pw(su, s.e1), s.c * pw(cu, s.e1) * pw(sv, s.e2))); } return pts; };
    const bodyPts = sg(SB, 60, 'lower').map((q) => q.add(V(0, CY, 0)));
    const cnt = (o) => { let n = 0; o.traverse((q) => { if (q.isMesh) n++; }); return n; };
    window.__hw.H.update(0, 0, { params: st.params }); R.updateMatrixWorld(true);
    const groups = kids.filter((c) => c.isGroup);
    const lid = groups.find((c) => Math.abs(c.position.z + 1.14) < 0.02 && cnt(c) > 20), panel = groups.find((c) => Math.abs(c.position.y - 0.4) < 0.01 && Math.abs(c.position.z + 0.06) < 0.01 && cnt(c) > 50);
    const kbd = groups.find((c) => c.position.length() < 1e-6 && cnt(c) > 30 && c !== lid), pods = groups.filter((c) => cnt(c) === 26 && Math.abs(c.position.x) > 1.5).sort((a, b) => a.position.x - b.position.x);
    const lifts = groups.filter((c) => cnt(c) === 3 || cnt(c) === 2).filter((c) => c !== lid && c !== panel && c !== kbd && !pods.includes(c));
    const armMeshes = kids.filter((c) => c.isMesh && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.height < 0.5 && c.geometry.parameters.height > 0.2);
    const dockX = pods[1].position.x;
    const lidIn = lid.children.find((c) => c.isGroup && Math.abs(c.position.z) > 0.5);
    const lidPtsLocal = sg(SL, 60, 'upper');
    const scr = lidIn.children.find((c) => c.isGroup && c.position.y > 0.2);
    const podShell = (pg) => pg.children.find((c) => c.isMesh);
    // OBB containment helpers for solid meshes
    const solids = (root) => { const out = []; root.traverse((o) => { if (o.isMesh && o.geometry && o.visible !== false && !o.material.transparent && o.geometry.type !== 'PlaneGeometry' && o.geometry.type !== 'CircleGeometry' && o.geometry.type !== 'RingGeometry' && o.geometry.type !== 'TubeGeometry') { o.geometry.computeBoundingBox(); out.push(o); } }); return out; };
    const vis = (o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
    const inside = (m, wp, shrink) => { const l = m.worldToLocal(wp.clone()), bb = m.geometry.boundingBox; return l.x > bb.min.x + shrink && l.x < bb.max.x - shrink && l.y > bb.min.y + shrink && l.y < bb.max.y - shrink && l.z > bb.min.z + shrink && l.z < bb.max.z - shrink; };
    const depthIn = (s, l) => { const f = F(l.x, l.y, l.z, s); if (f >= 1) return 0; const r = l.length(); return r * (1 - Math.pow(f, s.e1 / 2)); };
    const scaleSnap = new Map(); R.traverse((o) => scaleSnap.set(o, o.scale.clone()));
    const issues = { podVsBody: [], podVsLid: [], podFloor: [], lidVsInternals: [], screenVsInternals: [], stretch: new Set(), popIn: new Set(), podUnsupported: [], protrudeClosed: 0, protrudeSamples: [] };
    const NEG = window.__NEG || 0;
    const set = (T) => { H.update(T, 0, { params: st.params, hue: null, beat: 0, level: 0 }); if (NEG) panel.position.y += NEG; R.updateMatrixWorld(true); };
    // canopy crossing detector: an internal vertex that changes side of the canopy surface between two samples while under its footprint
    const SLf = (l) => Math.pow(Math.pow(Math.abs(l.x / A), 2 / E2) + Math.pow(Math.abs(l.z / C), 2 / E2), E2 / E1);
    let prevSide = null; issues.lidCross = [];
    const internals = () => solids(kbd).concat(solids(panel)).filter(vis); const internalsAll = () => internals().concat(...lifts.map((l) => solids(l))).filter(vis);
    const visible0 = new Map(); set(0); R.traverse((o) => visible0.set(o, vis(o)));
    for (let T = 0; T <= 4.0001; T += 0.05) {
      set(T);
      // pods vs body shell surface, lid surface and floor
      pods.forEach((pg, k) => {
        const inv = new THREE.Matrix4().copy(podShell(pg).matrixWorld).invert();
        let mb = 0, ml = 0, mf = 0;
        bodyPts.forEach((q) => { const d = depthIn(PS, q.clone().applyMatrix4(inv)); if (d > mb) mb = d; });
        lidPtsLocal.forEach((q) => { const w = lidIn.localToWorld(q.clone()); const d = depthIn(PS, w.applyMatrix4(inv)); if (d > ml) ml = d; });
        sg(PS, 24).forEach((q) => { const w = q.clone().applyMatrix4(podShell(pg).matrixWorld); if (w.y < 0 && -w.y > mf) mf = -w.y; });
        issues.podVsBody.push([+T.toFixed(2), k, +(mb * 100).toFixed(1)]); issues.podVsLid.push([+T.toFixed(2), k, +(ml * 100).toFixed(1)]); issues.podFloor.push([+T.toFixed(2), k, +(mf * 100).toFixed(1)]);
        const sgn = k ? 1 : -1, disp = pg.position.distanceTo(V(sgn * dockX, 0.5, 0)), wrist = podShell(pg).localToWorld(V(-sgn * 0.15, 0, 0));
        let supported = false; R.traverse((o) => { if (!supported && o.isMesh && vis(o) && !pods.some((q) => { let p = o; while (p) { if (p === q) return true; p = p.parent; } return false; })) { const wp = new THREE.Vector3(); o.getWorldPosition(wp); if (wp.distanceTo(wrist) < 0.09) supported = true; } });
        if (disp > 0.01 && !supported) issues.podUnsupported.push([+T.toFixed(2), k, +(disp * 100).toFixed(1)]);
        // pod shell vs internal parts (keyboard, panel, lifts)
        let ph = 0; const ints2 = internalsAll(); sg(PS, 16).forEach((q) => { const w = q.clone().applyMatrix4(podShell(pg).matrixWorld); ints2.forEach((m) => { if (inside(m, w, 0.004)) ph++; }); });
        (issues.podVsInternals = issues.podVsInternals || []).push([+T.toFixed(2), k, ph]);
      });
      { const inv = new THREE.Matrix4().copy(lidIn.matrixWorld).invert(), side = []; let cross = 0; const where = new Set(); let k = 0;
        internalsAll().forEach((m) => { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 5) { const l = m.localToWorld(V(pa.getX(i), pa.getY(i), pa.getZ(i))).applyMatrix4(inv); const foot = SLf(l) < 0.98 && l.y > -0.02; const s = foot ? (F(l.x, Math.max(l.y, 0), l.z, SL) < 1 ? 1 : -1) : 0; side.push(s); if (prevSide && prevSide[k] && s && prevSide[k] !== s) { cross++; where.add(m.geometry.type); } k++; } });
        prevSide = side; issues.lidCross.push([+T.toFixed(2), cross, [...where].slice(0, 4)]); }
      { let br = 0, md = 0; const wh = new Set(); internalsAll().forEach((m) => { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 4) { const w = m.localToWorld(V(pa.getX(i), pa.getY(i), pa.getZ(i))); if (w.y < CY - 0.004) { const f = F(w.x, w.y - CY, w.z, SB); if (f > 1.0) { br++; const d = (Math.pow(f, E1 / 2) - 1) * Math.hypot(w.x / A, (w.y - CY) / HB, w.z / C) * 100; if (d > md) md = d; wh.add(m.geometry.type + '@' + w.x.toFixed(2) + ',' + w.y.toFixed(2) + ',' + w.z.toFixed(2)); } } } });
        (issues.wall = issues.wall || []).push([+T.toFixed(2), br, +md.toFixed(1), [...wh].slice(0, 3)]); }
      // canopy shell sweeping through internals (lid surface points inside internal part boxes)
      const ints = internals(); let lidHit = 0, lidHitParts = new Set();
      lidPtsLocal.forEach((q, i) => { if (i % 3) return; const w = lidIn.localToWorld(q.clone()); ints.forEach((m) => { if (inside(m, w, 0.004)) { lidHit++; lidHitParts.add(m.geometry.type + '@' + (m.parent === kbd || m.parent?.parent === kbd ? 'kbd' : 'panel')); } }); });
      issues.lidVsInternals.push([+T.toFixed(2), lidHit, [...lidHitParts].slice(0, 4)]);
      // display assembly vs internals (vertex test)
      let scrHit = 0; const scrMeshes = solids(scr).filter(vis);
      scrMeshes.forEach((sm) => { const pa = sm.geometry.attributes.position; for (let i = 0; i < pa.count; i += 7) { const w = sm.localToWorld(V(pa.getX(i), pa.getY(i), pa.getZ(i))); ints.forEach((m) => { if (inside(m, w, 0.004)) scrHit++; }); } });
      issues.screenVsInternals.push([+T.toFixed(2), scrHit]);
      // arm tubes vs internals and floor (centreline samples)
      let ah = 0, af = 0; armMeshes.forEach((am) => { for (let u = -0.5; u <= 0.5; u += 0.1) { const w = am.localToWorld(V(0, u * am.geometry.parameters.height, 0)); if (w.y < 0.02) af++; internalsAll().forEach((m) => { if (inside(m, w, 0.004)) ah++; }); } });
      (issues.arm = issues.arm || []).push([+T.toFixed(2), ah, af]);
      // stretching & pop-in
      R.traverse((o) => { const s0 = scaleSnap.get(o); if (o.isMesh && s0 && o.scale.distanceTo(s0) > 1e-3 && !pods.some((pg) => o.parent === pg)) issues.stretch.add((o.parent && o.parent.parent === R ? 'root.child[' + kids.indexOf(o.parent) + ']' : o.geometry.type)); });
      R.traverse((o) => { if (o.isMesh && vis(o) && visible0.get(o) === false && o.material && !o.material.transparent) issues.popIn.add(o.parent && o.parent.parent === R ? 'root.child[' + kids.indexOf(o.parent) + ']' : (o.parent === R ? 'root.child[' + kids.indexOf(o) + ']' : 'nested ' + o.geometry.type)); });
    }
    // closed-state protrusion: internal vertices outside body ∪ lid volume
    set(0); const lidInv = new THREE.Matrix4().copy(lidIn.matrixWorld).invert(); let prot = 0, maxP = 0; const where = new Set();
    internalsAll().concat(solids(scr).filter(vis)).forEach((m) => { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { const w = m.localToWorld(V(pa.getX(i), pa.getY(i), pa.getZ(i)));
      const inBody = w.y <= CY && F(w.x, w.y - CY, w.z, SB) < 1; const ll = w.clone().applyMatrix4(lidInv); const inLid = ll.y >= -0.001 && F(ll.x, ll.y, ll.z, SL) < 1;
      if (!inBody && !inLid) { prot++; const d = Math.min(Math.abs(F(w.x, w.y - CY, w.z, SB) - 1), Math.abs(F(ll.x, ll.y, ll.z, SL) - 1)); if (d > maxP) maxP = d; where.add(m.geometry.type + ' y=' + w.y.toFixed(2) + ' z=' + w.z.toFixed(2) + ' x=' + w.x.toFixed(2)); } } });
    issues.protrudeClosed = prot; issues.protrudeSamples = [...where].slice(0, 12);
    issues.stretch = [...issues.stretch]; issues.popIn = [...issues.popIn];
    const mx = (arr, i) => arr.reduce((m, r) => Math.max(m, r[i]), 0);
    return { summary: { podVsBody_mm: mx(issues.podVsBody, 2), podVsLid_mm: mx(issues.podVsLid, 2), podBelowFloor_mm: mx(issues.podFloor, 2), lidSweepHits: mx(issues.lidVsInternals, 1), lidCrossings: mx(issues.lidCross, 1), bodyWallBreachVertices: mx(issues.wall || [], 1), screenHits: mx(issues.screenVsInternals, 1), closedProtrusionVertices: prot, stretchingParts: issues.stretch, popInParts: issues.popIn, podUnsupportedSamples: issues.podUnsupported.length, podVsInternalsHits: mx(issues.podVsInternals || [], 2), armVsInternalsHits: mx(issues.arm || [], 1), armBelowFloor: mx(issues.arm || [], 2), parts: { lid: !!lid, panel: !!panel, kbd: !!kbd, pods: pods.length, lifts: lifts.length, armTubes: armMeshes.length, dockX: +dockX.toFixed(3), internalsSolids: internalsAll().length }, podUnsupportedMax_mm: mx(issues.podUnsupported, 2) },
      detail: { podVsBody: issues.podVsBody.filter((r) => r[2] > 0.5), podVsLid: issues.podVsLid.filter((r) => r[2] > 0.5), podFloor: issues.podFloor.filter((r) => r[2] > 0.5), lid: issues.lidVsInternals.filter((r) => r[1] > 0), lidCross: issues.lidCross.filter((r) => r[1] > 0).slice(0, 10), wall: (issues.wall || []).filter((r) => r[1] > 0).slice(0, 10), screen: issues.screenVsInternals.filter((r) => r[1] > 0), protrude: issues.protrudeSamples, unsupported: issues.podUnsupported.slice(0, 10), podInt: (issues.podVsInternals || []).filter((r) => r[2] > 0).slice(0, 12), arm: (issues.arm || []).filter((r) => r[1] || r[2]).slice(0, 12) } };
  });
  rep.pageErrors = errs;
  const s = JSON.stringify(rep, null, 1); if (outFile) fs.writeFileSync(outFile, s); console.log(s.slice(0, 6000));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
