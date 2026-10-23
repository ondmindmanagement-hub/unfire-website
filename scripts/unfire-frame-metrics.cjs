'use strict';
// Pure frame interval statistics for diagnostic QA. No device fingerprinting or telemetry.
function percentile(sorted, q) {
  if (!Array.isArray(sorted) || !sorted.length) return null;
  if (!(q >= 0 && q <= 1)) throw new RangeError('percentile must be [0,1]');
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos), f = pos - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * f;
}
function summarizeFrames(intervals, targetFps = 60) {
  if (!Array.isArray(intervals)) throw new TypeError('intervals must be an array');
  if (!Number.isFinite(targetFps) || targetFps < 1 || targetFps > 240)
    throw new RangeError('targetFps must be from 1 to 240');
  const ms = intervals.filter(n => Number.isFinite(n) && n > 0 && n <= 120000).sort((a,b)=>a-b);
  if (!ms.length) return { samples: 0, avgFps: null, p50Ms: null, p95Ms: null, p99Ms: null, overBudgetPct: null, stutters50ms: 0, stalls100ms: 0, discarded: intervals.length };
  const mean = ms.reduce((s,n)=>s+n,0)/ms.length;
  const budget = 1000/targetFps;
  const round = v => Math.round(v * 100) / 100;
  return {
    samples: ms.length,
    avgFps: round(1000 / mean),
    p50Ms: round(percentile(ms, .50)),
    p95Ms: round(percentile(ms, .95)),
    p99Ms: round(percentile(ms, .99)),
    overBudgetPct: round(100*ms.filter(x=>x>budget*1.25).length/ms.length),
    stutters50ms: ms.filter(x=>x>=50).length,
    stalls100ms: ms.filter(x=>x>=100).length,
    discarded: intervals.length-ms.length,
    targetFps
  };
}
module.exports = { percentile, summarizeFrames };
