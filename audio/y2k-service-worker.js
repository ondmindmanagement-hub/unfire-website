/**
 * Y2K ROBOTS / Unfire. Network-only PWA navigation service worker.
 * Does not cache game, audio, user content or multiplayer data.
 * No offline-play claim; browser/network errors remain visible.
 * No skipWaiting or clients.claim: do not take over live gameplay sessions.
 */
'use strict';

self.addEventListener('install', () => {
  // Deliberately do not precache or change the install lifecycle.
});

self.addEventListener('activate', () => {
  // Do not claim other tabs or delete unrelated caches.
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/audio/')) return;
  event.respondWith(fetch(request));
});
