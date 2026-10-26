/* Unfire: playback of the approved, pre-recorded character voices.
 * Keep captions and story flow working even when a recording is unavailable.
 * Never replace a missing neural recording with an unrelated OS voice.
 */
(() => {
  'use strict';
  const SS = window.speechSynthesis;
  if (!SS || window.__NEURAL_VOX) return;
  // CI browsers without real audio still use the existing lightweight test stub.
  if (navigator.webdriver && !/[?&]neuralvox=1/.test(location.search)) return;

  const originalCancel = SS.cancel.bind(SS);
  const root = 'vox/';
  const slotMap = { ARI: 'a', LEO: 'b', GEMI: 'c', NIMBO: 'd', UNFIRE: 'e' };
  const slotFor = (name) => {
    const n = String(name || '').toUpperCase();
    if (slotMap[n]) return slotMap[n];
    let h = 0;
    for (const ch of n) h = (h * 33 + ch.charCodeAt(0)) | 0;
    // Unknown NPCs use complete ES cast slots; avoid the partial ES/e library.
    const variants = window.__LANG === 'en' ? 'acbe' : 'acbd';
    return variants[Math.abs(h) % variants.length];
  };
  const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const hash = (s) => {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const call = (fn) => { try { if (typeof fn === 'function') fn({}); } catch (_) {} };

  // The original catalogue has a per-language phrase list. In Spanish only
  // 43 of those phrases have a dedicated UNFIRE (slot e) recording.
  // A slot-specific allow-list avoids requesting the 280 non-existent assets.
  const catalogue = { en: new Set(), es: new Set() };
  let esSlotE = new Set();
  let catalogueReady = false;
  Promise.all([
    fetch(root + 'manifest.json?v=20261026voicesafety1').then((r) => {
      if (!r.ok) throw new Error('voice manifest unavailable');
      return r.json();
    }),
    fetch(root + 'slots.json?v=20261026voicesafety1').then((r) => {
      if (!r.ok) throw new Error('voice slot manifest unavailable');
      return r.json();
    }).catch(() => ({ es: { e: [] } })) // optional index must not mute EN or other ES voices
  ]).then(([phrases, slots]) => {
    catalogue.en = new Set(Array.isArray(phrases.en) ? phrases.en : []);
    catalogue.es = new Set(Array.isArray(phrases.es) ? phrases.es : []);
    esSlotE = new Set(Array.isArray(slots?.es?.e) ? slots.es.e : []);
    catalogueReady = true;
  }).catch(() => { catalogueReady = true; /* safe, caption-only on failed load */ });

  // __voiceFor() is invoked just before character narration. A timestamp
  // prevents ambient speech from accidentally inheriting the previous robot.
  let speaker = null, speakerAt = 0;
  const wrapSpeaker = () => {
    const fn = window.__voiceFor;
    if (!fn || fn.__neuralCastWrapped) return;
    const wrapped = function (name, ...args) {
      speaker = name;
      speakerAt = Date.now();
      return fn.call(this, name, ...args);
    };
    wrapped.__neuralCastWrapped = true;
    window.__voiceFor = wrapped;
  };
  wrapSpeaker();
  addEventListener('load', wrapSpeaker);
  setTimeout(wrapSpeaker, 3000);

  const queue = [];
  let current = null;
  const pump = () => {
    if (current || !queue.length) return;
    const item = queue.shift();
    current = item;
    let completed = false;
    const finish = () => {
      if (completed || current !== item) return;
      completed = true;
      clearTimeout(item.guard);
      if (item.audio) {
        item.audio.onended = null;
        item.audio.onerror = null;
      }
      current = null;
      call(item.utterance.onend);
      pump();
    };
    call(item.utterance.onstart);
    if (!item.audio) {
      item.guard = setTimeout(finish, 600 + Math.min(4200, String(item.utterance.text || '').length * 45));
      return;
    }
    const audio = item.audio;
    audio.onended = finish;
    audio.onerror = finish; // stay silent rather than switching to OS speech
    item.guard = setTimeout(() => {
      try { audio.pause(); } catch (_) {}
      finish();
    }, 7000 + Math.min(33000, String(item.utterance.text || '').length * 135));
    try {
      const result = audio.play();
      if (result && typeof result.catch === 'function') result.catch(finish);
    } catch (_) { finish(); }
  };

  SS.cancel = () => {
    queue.length = 0;
    if (current) {
      const item = current;
      current = null;
      clearTimeout(item.guard);
      try {
        if (item.audio) {
          item.audio.onended = null;
          item.audio.onerror = null;
          item.audio.pause();
        }
      } catch (_) {}
    }
    originalCancel();
  };
  SS.speak = (utterance) => {
    if (!utterance) return;
    let audio = null;
    try {
      const lang = window.__LANG === 'en' ? 'en' : 'es';
      let phrase = normalize(utterance.text);
      if (lang === 'en' && typeof window.T === 'function') phrase = normalize(window.T(phrase));
      const key = hash(phrase);
      const name = Date.now() - speakerAt <= 2000 ? speaker : 'UNFIRE';
      const slot = slotFor(name);
      const exists = catalogueReady && catalogue[lang].has(key) &&
        (lang !== 'es' || slot !== 'e' || esSlotE.has(key));
      if (exists) {
        audio = new Audio(root + lang + '/' + slot + '/' + key + '.mp3');
        audio.preload = 'auto';
        audio.volume = Math.max(0, Math.min(1, utterance.volume == null ? 1 : utterance.volume));
      }
    } catch (_) { /* no audio means caption-only; gameplay still advances */ }
    queue.push({ utterance, audio, guard: null });
    pump();
  };
  try {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(SS), 'speaking');
    Object.defineProperty(SS, 'speaking', {
      configurable: true,
      get: () => !!current || queue.length > 0 || !!(desc && desc.get && desc.get.call(SS))
    });
  } catch (_) {}
  window.__NEURAL_VOX = {
    slotFor, hash,
    get ready() { return catalogueReady; },
    get queued() { return queue.length + (current ? 1 : 0); }
  };
})();
