/* Optional, lightweight, consent-first bridge for Unfire Audio's EXISTING host.
   Never tracks or changes gameplay by itself. Load only after endpoint approval.
   It cannot certify unique humans or actual purchase conversions. */
(function (root) {
  'use strict';
  if (!root || !root.document || !root.UnfireAudioMetrics) return;
  const endpoint = root.__UNFIRE_AUDIO_METRICS_ENDPOINT;
  if (typeof endpoint !== 'string') return;
  const tracker = root.UnfireAudioMetrics.create({ endpoint: endpoint });
  if (!tracker.isEnabled()) {
    // If consent has not yet been accepted, keep the passive bridge ready,
    // but the tracker still blocks ALL traffic until consent is explicitly given.
  }

  const doc = root.document;
  let frame, pin, body, observer;
  let openState = 'unknown';

  function checkEntry() {
    if (body && pin && body.classList.contains('immOn') &&
        pin.classList.contains('scene-ready')) {
      tracker.track('game_enter', { once: true });
    }
  }

  function refresh() {
    tracker.track('page_view', { once: true });
    checkEntry();
  }

  function onMessage(event) {
    if (!frame || !frame.contentWindow || event.source !== frame.contentWindow ||
        event.origin !== root.location.origin || !event.data ||
        event.data.unfire !== 1) return;
    const state = event.data.caseState;
    if (state === 'closed') {
      openState = 'closed';
      return;
    }
    if (state === 'open' && openState !== 'open') {
      openState = 'open';
      tracker.track('briefcase_open');
    }
  }

  function onExplicitMetric(event) {
    const name = event && event.detail && event.detail.event;
    // The engine/checkout owner alone should emit match_start or checkout_click
    // AFTER the corresponding operation is confirmed, never for 'purchase'.
    if (name === 'match_start' || name === 'checkout_click') tracker.track(name);
  }

  function ready() {
    frame = doc.getElementById('malFrame');
    pin = doc.getElementById('heroPin');
    body = doc.body;
    refresh();
    if (!frame || !pin || !body) return;
    if (typeof root.MutationObserver === 'function') {
      observer = new root.MutationObserver(checkEntry);
      observer.observe(body, { attributes: true, attributeFilter: ['class'] });
      observer.observe(pin, { attributes: true, attributeFilter: ['class'] });
    }
  }

  root.addEventListener('message', onMessage, { passive: true });
  root.addEventListener('unfire:metrics', onExplicitMetric);
  // The consent UI must emit this event when the visitor explicitly accepts.
  root.addEventListener('unfire:consent-updated', refresh);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();

  // Diagnostic method exposes ONLY boolean, no identifiers, no server access.
  root.__UNFIRE_AUDIO_METRICS_ENABLED = () => tracker.isEnabled();
})(typeof window !== 'undefined' ? window : undefined);
