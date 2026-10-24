/* Unfire Audio | size-aware free-play robot physics and camera policies.
 * Pure calculations. No DOM, WebGL, storage, listeners or global background work.
 * Integrate via the existing ROAMS owner; never add a second movement loop.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UnfireNanoPhysics = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const NORMAL_HEIGHT = 10.5;
  const NANO_HEIGHT = 0.24;
  const CAMERA_MODES = Object.freeze(['3p', '2p', '1p']);
  const TAU = Math.PI * 2;
  const EPSILON = 0.00001;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;
  const expLerp = (rate, dt) => 1 - Math.exp(-rate * clamp(finite(dt, 0), 0, 0.05));

  function profile(isNano, options) {
    const opt = options || {};
    const normalHeight = Math.max(0.1, finite(opt.normalHeight, NORMAL_HEIGHT));
    const height = isNano ? Math.max(0.03, finite(opt.nanoHeight, NANO_HEIGHT)) : normalHeight;
    const scale = height / normalHeight;
    // Cubic-root-like navigation budget makes the tiny avatar usable in a large room,
    // without turning it into a full-size character that clips through small gaps.
    const speedScale = isNano ? clamp(Math.pow(scale, 0.34), 0.20, 0.55) : 1;
    return {
      nano: !!isNano, normalHeight, height, scale, speedScale,
      radius: isNano ? clamp(height * 0.25, 0.045, 0.22) : 1.1,
      walkSpeed: 34 * speedScale,
      runSpeed: 34 * speedScale * 1.8,
      flightSpeed: 40 * speedScale,
      climbSpeed: 24 * speedScale,
      gravity: 38 * Math.sqrt(scale),
      terminalFall: 60 * Math.sqrt(scale),
      eyeHeight: height * 0.82,
      cameraNear: clamp(height * 0.025, 0.004, 0.1)
    };
  }

  function nextCameraMode(current) {
    const old = current === '3pl' || current === 'libre' ? '3p' : current;
    const i = CAMERA_MODES.indexOf(old);
    return CAMERA_MODES[(i + 1 + CAMERA_MODES.length) % CAMERA_MODES.length];
  }

  function cameraPose(mode, state, shape) {
    const p = shape || profile(!!state.nano);
    const kind = mode === '3pl' || mode === 'libre' ? '3p' : mode;
    if (CAMERA_MODES.indexOf(kind) < 0) throw new RangeError('Unknown robot camera mode');
    const x = finite(state.x, 0), z = finite(state.z, 0);
    const footY = finite(state.footY, -8.9);
    const yaw = finite(state.yaw, 0), pitch = clamp(finite(state.pitch, 0), -1.25, 1.25);
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    const h = p.height, eye = footY + p.eyeHeight;
    const forward = Math.max(h * 2, 0.4);
    const look = { x: x + fx * forward, y: eye + Math.tan(pitch) * forward, z: z + fz * forward };
    let position;
    if (kind === '1p') position = { x, y: eye, z };
    else if (kind === '2p') {
      position = { x: x - fx * h * 0.75 + rx * h * 0.45,
        y: footY + h * 0.95, z: z - fz * h * 0.75 + rz * h * 0.45 };
    } else {
      position = { x: x - fx * h * 1.25, y: footY + h * 1.35, z: z - fz * h * 1.25 };
    }
    return { mode: kind, position, target: look, near: p.cameraNear,
      showAvatar: kind !== '1p', fieldOfView: kind === '1p' ? 80 : 75 };
  }

  function obstacleBounds(box, extra) {
    // Current game obstacles are already padded by 1.1 world units. Undo padding
    // before re-expanding by the actual capsule radius; otherwise NANO is giant.
    const pad = Math.max(0, finite(extra, 0));
    let x0 = finite(box.x0, 0) + pad, x1 = finite(box.x1, 0) - pad;
    let z0 = finite(box.z0, 0) + pad, z1 = finite(box.z1, 0) - pad;
    if (x0 > x1) { const mid = (x0 + x1) * 0.5; x0 = mid; x1 = mid; }
    if (z0 > z1) { const mid = (z0 + z1) * 0.5; z0 = mid; z1 = mid; }
    return { x0, x1, z0, z1, y0: finite(box.y0, -Infinity), y1: finite(box.y1, Infinity) };
  }

  function collisionDepth(x, z, box, radius, footY, height, prePadding) {
    const b = obstacleBounds(box, prePadding);
    if (footY + height <= b.y0 + EPSILON || footY >= b.y1 - EPSILON) return 0;
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    const dist = Math.hypot(x - cx, z - cz), r = Math.max(0, radius);
    if (dist >= r) return 0;
    if (dist > 0) return r - dist;
    // Position inside a box: return penetration that grows toward its center,
    // so an already-spawned avatar can escape a poorly marked asset.
    return r + Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
  }

  function penetration(x, z, obstacles, p, footY, prePadding) {
    let depth = 0;
    for (const box of obstacles || []) {
      if (!box) continue;
      depth = Math.max(depth, collisionDepth(x, z, box, p.radius, footY, p.height, prePadding));
    }
    return depth;
  }

  function move2D(start, delta, obstacles, p, options) {
    const opt = options || {};
    const footY = finite(opt.footY, -8.9);
    const prePadding = finite(opt.prePadding, 1.1);
    const dx = finite(delta.x, 0), dz = finite(delta.z, 0);
    const length = Math.hypot(dx, dz);
    const nominalStep = Math.max(0.08, p.radius * 0.7);
    // Fixed upper bound avoids infinite loops on stalled main threads; caller
    // must split large physics timesteps instead of teleporting.
    const count = clamp(Math.ceil(length / nominalStep), 1, 80);
    const limit = nominalStep * 80;
    const fraction = length > limit ? limit / length : 1;
    const stepX = dx * fraction / count, stepZ = dz * fraction / count;
    let x = finite(start.x, 0), z = finite(start.z, 0), blocked = false;
    for (let i = 0; i < count; i++) {
      const prior = penetration(x, z, obstacles, p, footY, prePadding);
      const can = (xx, zz) => {
        const next = penetration(xx, zz, obstacles, p, footY, prePadding);
        return next < EPSILON || (prior > EPSILON && next < prior - EPSILON);
      };
      const nx = x + stepX, nz = z + stepZ;
      if (can(nx, nz)) { x = nx; z = nz; continue; }
      blocked = true;
      // Sliding along one wall axis preserves movement without walking through it.
      if (can(nx, z)) x = nx;
      if (can(x, nz)) z = nz;
    }
    return { x, z, blocked, distance: Math.hypot(x - start.x, z - start.z),
      truncated: length > limit };
  }

  function updateWalk(state, intent, p, dt, options) {
    const opt = options || {};
    const t = clamp(finite(dt, 0), 0, 0.05);
    const ix = finite(intent.x, 0), iz = finite(intent.z, 0);
    const size = Math.hypot(ix, iz), inputX = size > 1 ? ix / size : ix, inputZ = size > 1 ? iz / size : iz;
    const maxSpeed = (intent.run ? p.runSpeed : p.walkSpeed) * (intent.slow ? 0.5 : 1);
    const maxFactor = size < 0.02 ? 0 : Math.min(size, 1);
    const rate = expLerp(maxFactor ? 12 : 17, t);
    const vx = finite(state.vx, 0) + (inputX * maxSpeed - finite(state.vx, 0)) * rate;
    const vz = finite(state.vz, 0) + (inputZ * maxSpeed - finite(state.vz, 0)) * rate;
    const move = move2D(state, { x: vx * t, z: vz * t }, opt.obstacles, p, opt);
    return { ...move, vx: move.blocked && Math.abs(move.x - state.x) < EPSILON ? 0 : vx,
      vz: move.blocked && Math.abs(move.z - state.z) < EPSILON ? 0 : vz,
      moving: size >= 0.02 };
  }

  function updateVertical(state, controls, p, dt) {
    const t = clamp(finite(dt, 0), 0, 0.05);
    const floor = finite(controls.floor, 0);
    const ceiling = Math.max(floor + p.height, finite(controls.ceiling, 8000));
    const h = clamp(finite(state.h, floor), floor, ceiling - p.height);
    const fly = !!controls.fly;
    let vy = finite(state.vy, 0);
    if (fly) {
      const up = clamp(finite(controls.up, 0) - finite(controls.down, 0), -1, 1);
      const goal = up * p.climbSpeed;
      vy += (goal - vy) * expLerp(up ? 14 : 18, t);
      if (!up && Math.abs(vy) < 0.02) vy = 0;
    } else {
      vy = Math.max(-p.terminalFall, vy - p.gravity * t);
    }
    const nh = clamp(h + vy * t, floor, ceiling - p.height);
    if ((nh === floor && vy < 0) || (nh === ceiling - p.height && vy > 0)) vy = 0;
    return { h: nh, vy, fly, grounded: nh <= floor + EPSILON, ceilingHit: nh >= ceiling - p.height - EPSILON };
  }

  function safeMorphPosition(origin, candidateProfile, obstacles, options) {
    const opt = options || {};
    const y = finite(opt.footY, -8.9), padding = finite(opt.prePadding, 1.1);
    const free = (x, z) => penetration(x, z, obstacles, candidateProfile, y, padding) < EPSILON;
    if (free(origin.x, origin.z)) return { x: origin.x, z: origin.z, moved: false, safe: true };
    const stride = Math.max(0.15, candidateProfile.radius * 0.7);
    const maxRadius = Math.max(3, candidateProfile.height * 2.5);
    for (let r = stride; r <= maxRadius + EPSILON; r += stride) {
      const segments = Math.max(12, Math.ceil(TAU * r / stride));
      for (let i = 0; i < segments; i++) {
        const a = i * TAU / segments;
        const x = origin.x + Math.cos(a) * r, z = origin.z + Math.sin(a) * r;
        if (free(x, z)) return { x, z, moved: true, safe: true };
      }
    }
    // A failed morph must remain small rather than spawn a normal robot in a wall.
    return { x: origin.x, z: origin.z, moved: false, safe: false };
  }

  function missionsEnabled(mode) {
    // Free-play robot and NANO exploration do not advance story or side quests.
    return mode !== 'robot' && mode !== 'nano' && mode !== 'minirobot';
  }

  return Object.freeze({
    NORMAL_HEIGHT, NANO_HEIGHT, CAMERA_MODES, profile, nextCameraMode,
    cameraPose, obstacleBounds, collisionDepth, penetration, move2D,
    updateWalk, updateVertical, safeMorphPosition, missionsEnabled
  });
});
