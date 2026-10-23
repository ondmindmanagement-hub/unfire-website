/* UNFIRE AUDIO — passive device/network quality hints.
 * No network probes, device fingerprint, telemetry, timers or independent RAF loop.
 * Integration is opt-in; this file alone does not change the running game.
 */
(function (root) {
  'use strict';
  function numberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  }
  // Uses only completed same-origin transfers already recorded by the browser.
  // This is a coarse throughput observation, NEVER an exact Wi-Fi speed test.
  function estimateResourceMbps(env) {
    const perf = env && env.performance;
    const origin = env && env.location && env.location.origin;
    if (!perf || typeof perf.getEntriesByType !== 'function' || typeof origin !== 'string') return null;
    let entries, now;
    try {
      entries = perf.getEntriesByType('resource');
      now = typeof perf.now === 'function' ? perf.now() : Number.POSITIVE_INFINITY;
    } catch (_) { return null; }
    if (!Array.isArray(entries)) return null;
    const rates = [];
    for (let i = entries.length - 1, visited = 0;
      i >= 0 && visited < 40 && rates.length < 12; i--, visited++) {
      const r = entries[i];
      if (!r || typeof r.name !== 'string' || !r.name.startsWith(origin + '/')) continue;
      const ms = r.responseEnd - r.responseStart;
      // Exclude cached/opaque/small/old transfers and implausible timing data.
      if (!(r.transferSize >= 32768 && r.responseStart > 0 && ms >= 40 &&
        ms <= 20000 && r.responseEnd <= now &&
        now - r.responseEnd <= 60000)) continue;
      const mbps = (r.transferSize * 8) / (ms * 1000);
      if (Number.isFinite(mbps) && mbps > 0 && mbps < 10000) rates.push(mbps);
    }
    if (rates.length < 3) return null;
    rates.sort((a,b)=>a-b);
    return rates[Math.floor(rates.length / 2)];
  }
  function network(navigatorLike, observedMbps) {
    const nav = navigatorLike || {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
    if (nav.onLine === false) return { kind: 'offline', known: true, saveData: Boolean(conn.saveData) };
    const type = typeof conn.effectiveType === 'string' ? conn.effectiveType.toLowerCase() : '';
    const downlink = numberOrNull(conn.downlink);
    const rtt = numberOrNull(conn.rtt);
    const saveData = Boolean(conn.saveData);
    const observed = numberOrNull(observedMbps);
    let kind = 'unknown';
    if (saveData || type === 'slow-2g' || type === '2g' || type === '3g' ||
        (downlink !== null && downlink < 1.5) || (rtt !== null && rtt >= 600)) kind = 'constrained';
    else if ((downlink !== null && downlink < 3) || (rtt !== null && rtt >= 250)) kind = 'moderate';
    else if (type || downlink !== null || rtt !== null) kind = 'good';
    // Observed transfer rates can downgrade optimistic cellular/network hints.
    if (observed !== null) {
      const measuredKind = observed < 1.5 ? 'constrained' : observed < 4 ? 'moderate' : 'good';
      const rank = { unknown: 3, good: 2, moderate: 1, constrained: 0 };
      if (kind === 'unknown' || rank[measuredKind] < rank[kind]) kind = measuredKind;
    }
    return { kind, known: Boolean(type || downlink !== null || rtt !== null || saveData || observed !== null), saveData };
  }
  function profile(input) {
    const p = input || {};
    const net = network(p.navigator, p.observedMbps);
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
      reducedMotion: motion, stableFps,
      observedMbps: estimateResourceMbps(w)
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
    if (w.addEventListener) {
      w.addEventListener('online', update); w.addEventListener('offline', update);
      w.addEventListener('load', update);
    }
    if (conn && conn.addEventListener) conn.addEventListener('change', update);
    if (media && media.addEventListener) media.addEventListener('change', update);
    update();
    return () => {
      if (w.removeEventListener) {
        w.removeEventListener('online', update); w.removeEventListener('offline', update);
        w.removeEventListener('load', update);
      }
      if (conn && conn.removeEventListener) conn.removeEventListener('change', update);
      if (media && media.removeEventListener) media.removeEventListener('change', update);
    };
  }
  const api = Object.freeze({ estimateResourceMbps, network, profile, capture, observe });
  root.UnfireClientQuality = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
