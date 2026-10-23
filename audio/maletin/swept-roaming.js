/* Collision sweep for very fast roam/flight movement.
 * Pure geometry: no WebGL, timers, allocations per collider, or device assumptions.
 * Boxes already contain the game's avatar collision padding.
 */
(function (root) {
  'use strict';
  const EPS = 0.025;
  function sweep(x, z, dx, dz, boxes, feet) {
    if (![x, z, dx, dz, feet].every(Number.isFinite)) return { x, z, blocked: false };
    if (!Array.isArray(boxes) || !boxes.length) return { x: x + dx, z: z + dz, blocked: false };
    let blocked = false;
    // Maximum three slide passes: prevent long loops on mobile CPUs.
    for (let pass = 0; pass < 3 && (Math.abs(dx) > 1e-8 || Math.abs(dz) > 1e-8); pass++) {
      let first = Infinity, normal = null;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (!b || !Number.isFinite(b.y1) || feet >= b.y1 - 0.4 ||
            !Number.isFinite(b.x0) || !Number.isFinite(b.x1) ||
            !Number.isFinite(b.z0) || !Number.isFinite(b.z1) ||
            b.x1 <= b.x0 || b.z1 <= b.z0) continue;
        // If already inside a solid due to spawn/network motion, permit escape;
        // never "unstick" by teleporting through a second wall.
        if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) continue;

        let tx0 = -Infinity, tx1 = Infinity, tz0 = -Infinity, tz1 = Infinity;
        if (Math.abs(dx) < 1e-9) {
          if (x <= b.x0 || x >= b.x1) continue;
        } else {
          tx0 = ((dx > 0 ? b.x0 : b.x1) - x) / dx;
          tx1 = ((dx > 0 ? b.x1 : b.x0) - x) / dx;
        }
        if (Math.abs(dz) < 1e-9) {
          if (z <= b.z0 || z >= b.z1) continue;
        } else {
          tz0 = ((dz > 0 ? b.z0 : b.z1) - z) / dz;
          tz1 = ((dz > 0 ? b.z1 : b.z0) - z) / dz;
        }
        const enter = Math.max(tx0, tz0), leave = Math.min(tx1, tz1);
        if (enter < 0 || enter > 1 || enter > leave || leave < 0) continue;
        if (enter < first) {
          first = enter;
          normal = tx0 >= tz0 ? 'x' : 'z';
        }
      }
      if (normal === null) { x += dx; z += dz; break; }
      blocked = true;
      const length = Math.hypot(dx, dz);
      const travel = Math.max(0, first - EPS / Math.max(length, 1e-6));
      x += dx * travel;
      z += dz * travel;
      const remaining = 1 - travel;
      // Slide tangentially rather than freezing both axes at a wall.
      if (normal === 'x') { dx = 0; dz *= remaining; }
      else { dz = 0; dx *= remaining; }
    }
    return { x, z, blocked };
  }
  const api = Object.freeze({ sweep });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UnfireSweptMotion = api;
})(typeof window === 'object' ? window : null);
