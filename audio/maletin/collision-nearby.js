/* Unfire Audio — static scene obstacle broadphase.
 * Exact collision tests remain in the engine; this only narrows the candidate
 * boxes. Never changes controls, hitboxes, world geometry or render quality.
 */
(function (root) {
  'use strict';
  const CELL = 28, MAX_BUCKETS = 24000, MAX_PER_BOX = 256;
  const known = new WeakMap();
  const gridCell = (v) => Math.floor(v / CELL);
  const key = (x, z) => x + ':' + z;

  function makeIndex(boxes) {
    const cells = new Map(), huge = [];
    let total = 0;
    for (const box of boxes) {
      if (!box || ![box.x0,box.x1,box.z0,box.z1].every(Number.isFinite) ||
          box.x0 > box.x1 || box.z0 > box.z1) return null;
      const x0 = gridCell(box.x0), x1 = gridCell(box.x1);
      const z0 = gridCell(box.z0), z1 = gridCell(box.z1);
      const cellsForBox = (x1 - x0 + 1) * (z1 - z0 + 1);
      if (!Number.isSafeInteger(cellsForBox) || cellsForBox > MAX_PER_BOX) {
        huge.push(box);
        continue;
      }
      total += cellsForBox;
      if (total > MAX_BUCKETS) return null; // Fail open, never omit a collider.
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const k = key(x, z);
          let arr = cells.get(k);
          if (!arr) { arr = []; cells.set(k, arr); }
          arr.push(box);
        }
      }
    }
    return { cells, huge, count: boxes.length, cache: new Map() };
  }

  function nearby(boxes, x, z, padding) {
    if (!Array.isArray(boxes) || boxes.length < 24 ||
        !Number.isFinite(x) || !Number.isFinite(z) ||
        !Number.isFinite(padding) || padding < 0 || padding > 512) {
      return boxes || [];
    }
    const x0 = gridCell(x-padding), x1 = gridCell(x+padding);
    const z0 = gridCell(z-padding), z1 = gridCell(z+padding);
    if ((x1-x0+1)*(z1-z0+1) > 64) return boxes;
    let index = known.get(boxes);
    if (!index || index.count !== boxes.length) {
      index = makeIndex(boxes);
      if (!index) return boxes;
      known.set(boxes, index);
    }
    const queryKey = x0 + ',' + x1 + ',' + z0 + ',' + z1;
    const found = index.cache.get(queryKey);
    if (found) return found;
    const unique = new Set(index.huge);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const bucket = index.cells.get(key(cx, cz));
        if (bucket) for (const box of bucket) unique.add(box);
      }
    }
    const out = Array.from(unique);
    // Bounded cache: long journeys do not retain every visited map cell.
    if (index.cache.size >= 48) index.cache.delete(index.cache.keys().next().value);
    index.cache.set(queryKey, out);
    return out;
  }

  root.UnfireCollisionNearby = Object.freeze({
    nearby,
    diagnostics(boxes) {
      const index = boxes && known.get(boxes);
      return { cellSize: CELL, indexed: !!index, buckets: index ? index.cells.size : 0,
        cachedQueries: index ? index.cache.size : 0 };
    }
  });
})(window);
