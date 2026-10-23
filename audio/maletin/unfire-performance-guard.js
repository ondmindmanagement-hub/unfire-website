/* Unfire Audio — GPU texture sampler budget.
 * One-time, renderer-local cap on anisotropic texture filtering at upload.
 * Complements (never replaces) DPR/frame pacing, culling and secondary RT budgets.
 * Safe on Safari where navigator.deviceMemory is unavailable.
 */
(function initUnfirePerformanceGuard(global) {
  'use strict';

  const attached = new WeakMap();
  const tiers = Object.freeze({ compact: 2, balanced: 4 });
  const defaultInfo = () => ({
    enabled: false, reason: 'not-attached', tier: 'desktop',
    hardwareMaxAnisotropy: null, effectiveMaxAnisotropy: null
  });
  let lastInfo = defaultInfo();

  function attach(renderer, device) {
    const caps = renderer && renderer.capabilities;
    const tier = device && typeof device.tier === 'string' ? device.tier : 'desktop';
    if (!caps || typeof caps.getMaxAnisotropy !== 'function') {
      lastInfo = {
        ...defaultInfo(), tier,
        reason: 'renderer-not-supported'
      };
      return lastInfo;
    }
    const prior = attached.get(renderer);
    if (prior) {
      lastInfo = prior;
      return prior;
    }

    const original = caps.getMaxAnisotropy;
    let hardwareMax;
    try {
      hardwareMax = Math.max(1, Number(original.call(caps)) || 1);
    } catch (_) {
      lastInfo = { ...defaultInfo(), tier, reason: 'capability-unavailable' };
      return lastInfo;
    }

    const requested = Object.prototype.hasOwnProperty.call(tiers, tier)
      ? tiers[tier] : hardwareMax;
    const max = Math.min(hardwareMax, requested);
    let enabled = false;
    if (max < hardwareMax) {
      try {
        // Three.js consults this method when setting EXT_texture_filter_anisotropic
        // on a newly uploaded texture. No scene scan, no texture reupload, no RAF.
        caps.getMaxAnisotropy = function unfireCappedAnisotropy() {
          return Math.min(max, Number(original.call(this)) || 1);
        };
        enabled = caps.getMaxAnisotropy !== original;
      } catch (_) {
        // Read-only capabilities / alternate render engines: fail open.
      }
    }
    const info = Object.freeze({
      enabled, tier,
      reason: enabled ? 'capped-at-upload' : 'native-default',
      hardwareMaxAnisotropy: hardwareMax,
      effectiveMaxAnisotropy: enabled ? max : hardwareMax
    });
    attached.set(renderer, info);
    lastInfo = info;
    return info;
  }

  global.UnfirePerformanceGuard = Object.freeze({
    attach,
    getInfo() { return lastInfo; }
  });
})(window);
