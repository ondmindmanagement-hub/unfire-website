/* UNFIRE Audio — progressive local asset cache.
   Owns ONLY the /audio/maletin/ scope. No executable, terminal, background mining,
   private user data, P2P state, commerce or third-party assets are cached.
*/
'use strict';
const PREFIX = 'unfire-maletin-local-';
const SHELL = PREFIX + 'shell-20261024-v1';
const ASSETS = PREFIX + 'assets-20261024-v1';
const PAGE_URL = new URL('./index.html', self.registration.scope).href;
const MAX_ASSETS = 48;
const MAX_BYTES_PER_ASSET = 1024 * 1024;
const STATIC_PATHS = ['/audio/maletin/', '/audio/js/', '/audio/img/', '/assets/'];
const STATIC_FILE = /\.(?:js|mjs|css|wasm|png|jpe?g|webp|avif|svg|woff2?|ttf|otf)$/i;
const ALLOWED_QUERY = new Set(['v', 'rev', 'version', 'hash']);
function isLocalStatic(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate' || request.headers.has('Range') ||
      request.headers.has('Authorization')) return false;
  if (!STATIC_PATHS.some(prefix => url.pathname.startsWith(prefix))) return false;
  if (!STATIC_FILE.test(url.pathname)) return false;
  for (const key of url.searchParams.keys()) if (!ALLOWED_QUERY.has(key)) return false;
  return true;
}
function isGamePage(request, url) {
  return request.method === 'GET' && request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    (url.pathname === '/audio/maletin/' || url.pathname === '/audio/maletin/index.html') &&
    !url.searchParams.has('token') && !url.searchParams.has('session');
}
async function storeAsset(cache, request, response) {
  try {
    if (!response.ok || response.type !== 'basic') return;
    const control = (response.headers.get('Cache-Control') || '').toLowerCase();
    if (/no-store|private/.test(control)) return;
    const type = (response.headers.get('Content-Type') || '').toLowerCase();
    if (type.includes('text/html') || type.includes('application/json') ||
        type.startsWith('audio/') || type.startsWith('video/')) return;
    const length = Number(response.headers.get('Content-Length'));
    if (!Number.isFinite(length) || length < 1 || length > MAX_BYTES_PER_ASSET) return;
    await cache.put(request, response);
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) {
      await cache.delete(old);
    }
  } catch (_) { /* Quota/blocked storage: network remains authoritative. */ }
}
async function staticFirst(event) {
  const request = event.request;
  try {
    const cache = await caches.open(ASSETS);
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    event.waitUntil(storeAsset(cache, request, response.clone()));
    return response;
  } catch (_) {
    return fetch(request);
  }
}
async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      try {
        const cache = await caches.open(SHELL);
        await cache.put(PAGE_URL, response.clone());
      } catch (_) { /* Storage is optional. */ }
    }
    return response;
  } catch (_) {
    try {
      const cache = await caches.open(SHELL);
      const saved = await cache.match(PAGE_URL);
      if (saved) return saved;
    } catch (_) {}
    return Response.error();
  }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // One small first-party game shell only; no blanket pre-download.
    try {
      const response = await fetch(PAGE_URL, {cache: 'reload'});
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(SHELL);
        await cache.put(PAGE_URL, response);
      }
    } catch (_) { /* A first visit still works over the network. */ }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      for (const name of names) {
        if (name.startsWith(PREFIX) && name !== SHELL && name !== ASSETS)
          await caches.delete(name);
      }
    } catch (_) {}
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (isGamePage(request, url)) {
    event.respondWith(networkFirstPage(request));
  } else if (isLocalStatic(request, url)) {
    event.respondWith(staticFirst(event));
  }
});
