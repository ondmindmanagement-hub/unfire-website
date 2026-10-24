/* UNFIRE Audio — deferred, non-blocking first-party local cache bootstrap. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !('serviceWorker' in navigator)) return;
  let started = false;
  const register = () => {
    if (started) return;
    started = true;
    navigator.serviceWorker.register('./unfire-local-sw.js', {
      scope: './', updateViaCache: 'none'
    }).catch(() => {
      // No storage/network/permission means the ordinary website still works.
    });
  };
  const defer = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(register, { timeout: 4000 });
    } else {
      window.setTimeout(register, 1800);
    }
  };
  if (document.readyState === 'complete') defer();
  else window.addEventListener('load', defer, { once: true });
})();
