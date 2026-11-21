/**
 * Owner-review-only helper. This file does nothing until a game-host
 * integrator explicitly includes it in /audio/index.html after release QA.
 * Registration starts after the page load to protect initial game launch.
 */
(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  const trustedProduction = location.protocol === 'https:' && location.hostname === 'unfire.technology';
  const trustedLocalTest = location.protocol === 'http:' &&
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
  if (!(trustedProduction || trustedLocalTest) || !location.pathname.startsWith('/audio/')) return;

  const register = () => {
    navigator.serviceWorker.register('/audio/y2k-service-worker.js', { scope: '/audio/' })
      .catch(() => {
        // Registration must never stop a playable browser session.
      });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
})();
