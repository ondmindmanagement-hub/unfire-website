#!/usr/bin/env python3
"""Makes the Hyperwave 2000 digital transformation physically buildable (audio/hyperwave/index.html).
Each replacement must match exactly once. Run from the repository root:  python3 hyperwave-hardware/tools/patch-physical-model.py [dock]
Changes (see hyperwave-hardware/ENGINEERING_DESIGN_v0.1.md):
 1. Speaker pods dock OUTSIDE the body ends instead of intersecting the shell and canopy.
 2. Pods are carried at all times by a 4-stage telescopic arm with fixed-length tubes (no stretching, no pop-in).
 3. Arm attaches at a wrist inside the pod (pod electronics moved clear of the arm channel).
 4. Final pod pose keeps the arm in the x-y plane (2-DOF arm + 2-DOF wrist).
 5. Keyboard and panel lifts become scissor mechanisms (rigid bars) instead of stretching pistons; panel gets front scissors.
 6. Heavy parts use minimum-jerk (no overshoot) profiles; light parts decelerate without bouncing.
"""
import sys, re, pathlib
DOCK = float(sys.argv[1]) if len(sys.argv) > 1 else 2.66
P = pathlib.Path('audio/hyperwave/index.html'); src = P.read_text()
def rep(old, new, count=1):
    global src
    n = src.count(old)
    if n != count: raise SystemExit(f'expected {count} match(es), found {n}: {old[:90]!r}')
    src = src.replace(old, new)

# 1+4. pods: dock position, smooth physical path, final z keeps the arm planar
rep("const k = s < 0 ? 'L' : 'R', g = new THREE.Group(); g.position.set(s * 2.12, 0.5, 0); root.add(g); pods[k] = g;",
    f"const k = s < 0 ? 'L' : 'R', g = new THREE.Group(); g.position.set(s * POD_DOCK, 0.5, 0); root.add(g); pods[k] = g;")
rep("anim(g, [{ t: 0, p: [s * 2.12, 0.5, 0], r: [0, 0, 0] }, { t: 1.0 }, { t: 1.4, p: [s * 2.46, 0.5, 0], e: 'back' }, { t: 3.0 }, { t: 3.45, p: [s * 2.9, 0.6, 0], e: 'out' }, { t: 3.95, p: [out, 1.02, 0.18], r: [-0.12, -s * Math.PI / 2, 0], e: 'back' }]);",
    "anim(g, [{ t: 0, p: [s * POD_DOCK, 0.5, 0], r: [0, 0, 0] }, { t: 1.0 }, { t: 1.4, p: [s * (POD_DOCK + 0.1), 0.5, 0], e: 'smooth' }, { t: 3.0 }, { t: 3.45, p: [s * 2.96, 0.66, 0], e: 'smooth' }, { t: 3.95, p: [out, 1.02, POD_WRIST], r: [-0.12, -s * Math.PI / 2, 0], e: 'smooth' }]);")
rep("    const podMat = Y2K.polycarb('#ff5a00', { opacity: 0.72 }), pods = {};",
    f"    // FÍSICA: los altavoces se acoplan FUERA de los extremos de la carcasa (antes la atravesaban) y viajan sobre un brazo telescópico real.\n    const POD_DOCK = {DOCK}, POD_WRIST = 0.15, ARM_ROOT = 2.08, ARM_Y = 0.47, ARM_STAGE = 0.34, ARM_OVERLAP = 0.03;\n    const podMat = Y2K.polycarb('#ff5a00', {{ opacity: 0.72 }}), pods = {{}};")
# 3. pod electronics clear of the arm channel (PCB moved between wrist housing and driver)
rep("g.add(at(mesh(Y2K.rbox(0.05, 0.4, 0.6, 0.02), M.pcb), -s * 0.12, 0, 0));",
    "g.add(at(mesh(Y2K.rbox(0.03, 0.34, 0.5, 0.012), M.pcb), s * 0.135, 0, 0));")
# 2. telescopic arm made of rigid nested tubes
rep("for (const s of [-1, 1]) { const st = new THREE.Group(); root.add(st); const t1 = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 20), M.chrome), t2 = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 20), M.graphite); st.add(t1, t2); const b1 = mesh(new THREE.SphereGeometry(0.09, 24, 16), M.chrome), b2 = mesh(new THREE.SphereGeometry(0.08, 24, 16), M.chrome); root.add(b1, b2); struts.push({ st, t1, t2, s, b1, b2 }); }",
    "for (const s of [-1, 1]) { const tubes = [0.07, 0.058, 0.047, 0.037].map((r, i) => { const t = mesh(new THREE.CylinderGeometry(r, r, ARM_STAGE, 24), i === 0 ? M.graphite : M.chrome); root.add(t); return t; }); const b1 = mesh(new THREE.SphereGeometry(0.085, 24, 16), M.chrome), b2 = mesh(new THREE.SphereGeometry(0.06, 24, 16), M.chrome); root.add(b1, b2); struts.push({ tubes, s, b1, b2 }); }")
rep("struts.forEach(({ st: g, t1, t2, s, b1, b2 }) => { const k = s < 0 ? 'L' : 'R'; pods[k].getWorldPosition(_w); root.worldToLocal(_w); const a0 = V(s * 2.0, 0.47, 0.0); stretch(g, a0, _w, t1, t2); g.visible = hyp > 0.02; b1.position.copy(a0); b2.position.copy(_w).lerp(a0, 0.12); b1.visible = b2.visible = g.visible; });",
    "struts.forEach(({ tubes, s, b1, b2 }) => { const k = s < 0 ? 'L' : 'R'; _w.set(-s * POD_WRIST, 0, 0); pods[k].localToWorld(_w); root.worldToLocal(_w); const a0 = V(s * ARM_ROOT, ARM_Y, 0); telescope(tubes, a0, _w); b1.position.copy(a0); b2.position.copy(_w); });")
rep("    function stretch(g, p0, p1, t1, t2) {",
    "    // brazo telescópico: tubos rígidos de longitud fija que se deslizan unos dentro de otros (no se estiran)\n    function telescope(tubes, p0, p1) { _v.subVectors(p1, p0); const L = _v.length(), n = tubes.length; _q.setFromUnitVectors(_up, _v.clone().normalize());\n      const ext = clamp((L - ARM_STAGE) / (n - 1) / (ARM_STAGE - ARM_OVERLAP)) * (ARM_STAGE - ARM_OVERLAP);\n      tubes.forEach((t, i) => { t.quaternion.copy(_q); t.position.copy(p0).addScaledVector(_v.clone().normalize(), i * ext + ARM_STAGE / 2); }); }\n    // tijera rígida: dos barras de longitud fija que se cruzan; la altura sale del ángulo\n    function scissor(sc, x, y0, h, z) { const a = Math.asin(clamp(h / sc.L, 0, 0.98)); sc.g.position.set(x, y0 + h / 2, z); sc.b1.rotation.z = a; sc.b2.rotation.z = -a; sc.g.visible = true; }\n    function stretch(g, p0, p1, t1, t2) {")
# 5. scissor lifts
rep("for (const [x, z, tgt] of [[-1.3, 0.55, 'kbd'], [1.3, 0.55, 'kbd'], [-1.6, -0.85, 'panel'], [1.6, -0.85, 'panel']]) { const g = new THREE.Group(); root.add(g); const a = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 16), M.chrome), b = mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 16), M.graphite); g.add(a, b); pistons.push({ g, a, b, x, z, tgt }); }",
    "for (const [x, z, tgt, L] of [[-1.3, 0.55, 'kbd', 0.34], [1.3, 0.55, 'kbd', 0.34], [-1.6, -0.85, 'panel', 0.5], [1.6, -0.85, 'panel', 0.5], [-1.6, -0.25, 'panel', 0.5], [1.6, -0.25, 'panel', 0.5]]) { const g = new THREE.Group(); root.add(g); const b1 = mesh(Y2K.rbox(L, 0.022, 0.03, 0.008), M.chrome), b2 = mesh(Y2K.rbox(L, 0.022, 0.03, 0.008), M.graphite); b2.position.z = 0.032; const pin = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 12), M.chrome); pin.rotation.x = Math.PI / 2; pin.position.z = 0.016; g.add(b1, b2, pin); pistons.push({ g, b1, b2, x, z, tgt, L }); }")
rep("pistons.forEach((p) => { const tgtY = p.tgt === 'kbd' ? kbd.position.y + KY : (panelH.position.y + Math.sin(panelH.rotation.x) * (-p.z - 0.06)) - 0.0; stretch(p.g, V(p.x, 0.37, p.z), V(p.x, tgtY + 0.0, p.z + (p.tgt === 'kbd' ? kbd.position.z : 0)), p.a, p.b); p.g.visible = tgtY - 0.37 > 0.03; });",
    "pistons.forEach((p) => { const tgtY = p.tgt === 'kbd' ? kbd.position.y + KY : (panelH.position.y + Math.sin(panelH.rotation.x) * (-p.z - 0.06)) - 0.0; scissor(p, p.x, 0.37, Math.max(0, tgtY - 0.37), p.z + (p.tgt === 'kbd' ? kbd.position.z : 0)); });")
# 6. motion profiles: no bouncing of heavy parts
rep("{ t: 0.95, p: [0, CY, -C + 0.06], r: [-1.6, 0, 0], e: 'back' }", "{ t: 0.95, p: [0, CY, -C + 0.06], r: [-1.6, 0, 0], e: 'smooth' }")
rep("{ t: 1.7, p: [0, 0.14, 0.08], e: 'back' }", "{ t: 1.7, p: [0, 0.14, 0.08], e: 'smooth' }")
rep("{ t: 2.7, r: [0.2, 0, 0], e: 'back' }", "{ t: 2.7, r: [0.2, 0, 0], e: 'smooth' }")
rep("{ t: 1.55 + idx * 0.022, p: [x, piv.position.y, KZ0], e: 'back' }", "{ t: 1.55 + idx * 0.022, p: [x, piv.position.y, KZ0], e: 'out' }")
rep("{ t: 1.8, p: [0, 0.02, 0], e: 'back' }", "{ t: 1.8, p: [0, 0.02, 0], e: 'out' }")
rep("{ t: 2.5 + ki * 0.07, p: [0, 0, 0], r: [0, -TAU, 0], e: 'back' }", "{ t: 2.5 + ki * 0.07, p: [0, 0, 0], r: [0, -TAU, 0], e: 'out' }")
rep("{ t: 2.9, p: [0, 0, 0], r: [0, TAU, 0], e: 'back' }", "{ t: 2.9, p: [0, 0, 0], r: [0, TAU, 0], e: 'out' }")
src = re.sub(r"(anim\(cap, \[\{ t: 0, p: \[0, -0\.0\d+, 0\] \}, \{ t: [^}]+\}, \{ t: [^}]+?), e: 'back' \}", r"\1, e: 'out' }", src)
P.write_text(src); print('patched, POD_DOCK =', DOCK)
