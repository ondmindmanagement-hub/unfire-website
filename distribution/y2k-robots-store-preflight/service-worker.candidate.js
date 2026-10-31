/* Y2K ROBOTS · opt-in Microsoft Store/PWA candidate only.
 * This file is INERT while kept under /distribution/ and is NOT registered.
 * The game owner must review and integrate at /audio/y2k-service-worker.js
 * with an explicit /audio/ registration after game QA.
 * Intentionally caches NOTHING (no music, avatars, online rooms, personal data).
 * Network access remains essential. Never advertise offline gameplay.
 * No skipWaiting/clients.claim to avoid silently replacing active game sessions.
 */
self.addEventListener('install', () => {});
self.addEventListener('activate', () => {});
