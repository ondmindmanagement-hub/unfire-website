/* UNFIRE AUDIO — passive device/network quality hints.
 * No network probes, device fingerprint, telemetry, timers or independent RAF loop.
 * Integration is opt-in; this file alone does not change the running game.
 */
(function (root) {
  'use strict';
  function numberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  }
  function network(navigatorLike) {
    const nav = navigatorLike || {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (nav.onLine === false) return { kind: 'offline', known: true, saveData: Boolean(conn && conn.saveData) };
    if (!conn) return { kind: 'unknown', known: false, saveData: false };
    const type = typeof conn.effectiveType === 'string' ? conn.effectiveType.toLowerCase() : '';
    const downlink = numberOrNull(conn.downlink);
    const rtt = numberOrNull(conn.rtt);
    const saveData = Boolean(conn.saveData);
    let kind = 'unknown';
    if (saveData || type === 'slow-2g' || type === '2g' || type === '3g' ||
        (downlink !== null && downlink < 1.5) || (rtt !== null && rtt >= 600)) kind = 'constrained';
    else if ((downlink !== null && downlink < 3) || (rtt !== null && rtt >= 250)) kind = 'moderate';
    else if (type || downlink !== null || rtt !== null) kind = 'good';
    return { kind, known: Boolean(type || downlink !== null || rtt !== null || saveData), saveData };
  }
  function profile(input) {
    const p = input || {};
    const net = network(p.navigator);
    const cores = numberOrNull(p.navigator && p.navigator.hardwareConcurrency);
    const memory = numberOrNull(p.navigator && p.navigator.deviceMemory);
    const dpr = numberOrNull(p.dpr) || 1;
    const fps = numberOrNull(p.stableFps);
    const economy = (cores !== null && cores <= 4) || (memory !== null && memory <= 3);
    // Network must not lower visual detail: bandwidth and GPU power are independent.
    let render = economy ? 'economy' : 'balanced';
    if (!economy && cores !== null && cores >= 8 && (memory === null || memory >= 6)) render = 'high';
    if (fps !== null && fps < 42) render = 'economy';
    else if (fps !== null && fps < 55 && render === 'high') render = 'balanced';
    // Do not upgrade above a known weak hardware hint purely on a short FPS sample.
    const maxDpr = Math.min(dpr, render === 'high' ? 1.65 : render === 'balanced' ? 1.35 : 1);
    const largeAssets = net.kind === 'good';
    const assetPolicy = net.kind === 'constrained' || net.kind === 'offline' ? 'on-demand' :
      net.kind === 'good' ? 'preload-nearby' : 'essential-first';
    return Object.freeze({
      render, maxDpr, assetPolicy, allowLargePreloads: largeAssets,
      reducedMotion: Boolean(p.reducedMotion), network: net.kind,
      networkKnown: net.known, saveData: net.saveData
    });
  }
  function capture(env, stableFps) {
    const w = env || root;
    let motion = false;
    try { motion = Boolean(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) {}
    return profile({
      navigator: w.navigator || {},
      dpr: w.devicePixelRatio || 1,
      reducedMotion: motion, stableFps
    });
  }
  // Passive notifications only, no polling. Caller is responsible for disposing.
  function observe(onChange, env) {
    const w = env || root;
    if (typeof onChange !== 'function') throw new TypeError('onChange required');
    const conn = w.navigator && (w.navigator.connection || w.navigator.mozConnection || w.navigator.webkitConnection);
    const media = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)');
    let oldKey = '';
    const update = () => {
      const p = capture(w);
      const key = [p.render, p.maxDpr, p.assetPolicy, p.reducedMotion, p.network].join('|');
      if (key !== oldKey) { oldKey = key; onChange(p); }
    };
    if (w.addEventListener) { w.addEventListener('online', update); w.addEventListener('offline', update); }
    if (conn && conn.addEventListener) conn.addEventListener('change', update);
    if (media && media.addEventListener) media.addEventListener('change', update);
    update();
    return () => {
      if (w.removeEventListener) { w.removeEventListener('online', update); w.removeEventListener('offline', update); }
      if (conn && conn.removeEventListener) conn.removeEventListener('change', update);
      if (media && media.removeEventListener) media.removeEventListener('change', update);
    };
  }
  const api = Object.freeze({ network, profile, capture, observe });
  root.UnfireClientQuality = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
