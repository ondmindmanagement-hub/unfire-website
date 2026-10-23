/* Unfire Audio: explicitly opt-in, no cookies or persistent visitor identifiers.
   Load after an approved HTTPS collector exists. Does not instrument gameplay by itself. */
(function (root) {
  'use strict';
  const EVENTS = new Set(['page_view', 'game_enter', 'match_start', 'briefcase_open', 'checkout_click']);
  const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function safeConsent() {
    try { return root.localStorage.getItem('unfire-cookie-consent') === 'accepted'; }
    catch (_) { return false; }
  }

  function create(options) {
    options = options || {};
    const endpoint = options.endpoint;
    const consent = typeof options.consent === 'function' ? options.consent : safeConsent;
    const sender = typeof options.sender === 'function'
      ? options.sender
      : (url, payload) => root.fetch(url, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
    const id = root.crypto && typeof root.crypto.randomUUID === 'function'
      ? root.crypto.randomUUID()
      : '';
    const once = new Set();
    let validURL = false;
    try {
      const url = new URL(endpoint);
      validURL = url.protocol === 'https:' && !!url.host && url.username === '' && url.password === '';
    } catch (_) {}
    const available = validURL && ID_PATTERN.test(id);

    function track(event, opts) {
      if (!available || !EVENTS.has(event) || !consent()) return false;
      const onceKey = opts && opts.once ? event : '';
      if (onceKey && once.has(onceKey)) return false;
      if (onceKey) once.add(onceKey);
      // Only event names and a random in-memory tab/session ID; never IP, email,
      // URL, query string, user agent, fingerprint, checkout details or order data.
      try {
        Promise.resolve(sender(endpoint, { event: event, session: id })).catch(() => {});
        return true;
      } catch (_) { return false; }
    }
    return Object.freeze({
      track: track,
      isEnabled: () => available && consent(),
      events: Object.freeze(Array.from(EVENTS))
    });
  }

  root.UnfireAudioMetrics = Object.freeze({ create: create });
})(typeof window !== 'undefined' ? window : globalThis);
