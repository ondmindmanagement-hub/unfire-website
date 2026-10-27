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
  // Castilian cast (same voices as the approved Spanish trailer); every robot keeps one voice.
  const GIANTS = /BALUARTE|ECLIPSE|ASTRALIA|CRONOS|TIT[AÁ]N|GIGANTE|CAPRICORNIO/;
  const slotFor = (name) => {
    const n = String(name || '').toUpperCase();
    if (slotMap[n]) return slotMap[n];
    if (window.__LANG !== 'en' && GIANTS.test(n)) return 'i';
    let h = 0;
    for (const ch of n) h = (h * 33 + ch.charCodeAt(0)) | 0;
    const variants = window.__LANG === 'en' ? 'acb' : 'fghjkc';
    return variants[Math.abs(h) % variants.length];
  };
  const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  // Must match canon() in the Spanish voice generator: emoji and symbols are not spoken.
  const canon = (s) => normalize(String(s || '').replace(/[^\p{L}\p{N}_\s¿?¡!.,;:…'"()%-]/gu, ' ')).replace(/^[\s,;:-]+|[\s,;:-]+$/g, '');
  const sentences = (s) => (s.match(/[^.!?…]+(?:[.!?…]+|$)/g) || []).map((p) => canon(p)).filter((p) => /[\p{L}\p{N}]/u.test(p));
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
  let esSlots = {};
  let catalogueReady = false;
  Promise.all([
    fetch(root + 'manifest.json?v=20261027es1').then((r) => {
      if (!r.ok) throw new Error('voice manifest unavailable');
      return r.json();
    }),
    fetch(root + 'slots.json?v=20261027es1').then((r) => {
      if (!r.ok) throw new Error('voice slot manifest unavailable');
      return r.json();
    }).catch(() => ({})) // optional index must not mute EN or other ES voices
  ]).then(([phrases, slots]) => {
    catalogue.en = new Set(Array.isArray(phrases.en) ? phrases.en : []);
    catalogue.es = new Set(Array.isArray(phrases.es) ? phrases.es : []);
    for (const [k, v] of Object.entries(slots?.es || {})) esSlots[k] = new Set(Array.isArray(v) ? v : []);
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
    const list = item.audios && item.audios.length ? item.audios : [item.audio];
    let idx = 0;
    item.guard = setTimeout(() => {
      try { item.audio.pause(); } catch (_) {}
      finish();
    }, 7000 + Math.min(33000, String(item.utterance.text || '').length * 135));
    const playNext = () => {
      if (completed || current !== item) return;
      if (idx >= list.length) { finish(); return; }
      const audio = list[idx++];
      item.audio = audio;
      audio.onended = () => { if (idx < list.length) setTimeout(playNext, 90); else finish(); };
      audio.onerror = () => playNext(); // a missing sentence stays silent, the rest still plays
      try {
        const result = audio.play();
        if (result && typeof result.catch === 'function') result.catch(finish);
      } catch (_) { finish(); }
    };
    playNext();
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
  const ES_FALLBACK = { f: 'fd', g: 'ga', h: 'hc', i: 'ie', j: 'jb', k: 'ka', c: 'ca', a: 'a', b: 'b', d: 'd', e: 'e' };
  const esClip = (slot, text) => {
    const key = hash(text);
    for (const s2 of (ES_FALLBACK[slot] || slot) + 'de') if (esSlots[s2] && esSlots[s2].has(key)) return 'es/' + s2 + '/' + key;
    // Slot index unavailable: the shared manifest still lists the core cast (a-e).
    if (!Object.keys(esSlots).length && catalogue.es.has(key)) return 'es/' + ('abcde'.includes(slot) ? slot : 'd') + '/' + key;
    return null;
  };
  const clip = (url, volume) => {
    const a = new Audio(root + url + '.mp3?v=20261027es1');
    a.preload = 'auto';
    a.volume = volume;
    return a;
  };
  SS.speak = (utterance) => {
    if (!utterance) return;
    const audios = [];
    try {
      const lang = window.__LANG === 'en' ? 'en' : 'es';
      const vol = Math.max(0, Math.min(1, utterance.volume == null ? 1 : utterance.volume));
      const name = Date.now() - speakerAt <= 2000 ? speaker : 'UNFIRE';
      const slot = slotFor(name);
      if (lang === 'es') {
        // The player's own name is shown in the caption but not spoken: the recorded
        // lines are the pieces around it, exactly as they are written in the game.
        let nm = '';
        try { nm = normalize(window.__STORYNAME && window.__STORYNAME()); } catch (_) {}
        const text = String(utterance.text || '');
        const pieces = nm && nm.length > 1 && text.includes(nm) ? text.split(nm) : [text];
        for (const piece of pieces) {
          const whole = esClip(slot, canon(piece));
          if (whole) { audios.push(clip(whole, vol)); continue; }
          // Lines built at runtime (names, chapters, chat): play sentence by sentence.
          for (const p of sentences(piece)) { const u = esClip(slot, p); if (u) audios.push(clip(u, vol)); }
        }
      } else if (catalogueReady) {
        let phrase = normalize(utterance.text);
        if (typeof window.T === 'function') phrase = normalize(window.T(phrase));
        const key = hash(phrase);
        if (catalogue.en.has(key)) audios.push(clip('en/' + slot + '/' + key, vol));
        else {
          const parts = (phrase.match(/[^.!?…]+(?:[.!?…]+|$)/g) || []).map(normalize).filter((p) => /\w/.test(p)).map(hash);
          if (parts.length && parts.every((k) => catalogue.en.has(k))) parts.forEach((k) => audios.push(clip('en/' + slot + '/' + k, vol)));
        }
      }
    } catch (_) { /* no audio means caption-only; gameplay still advances */ }
    queue.push({ utterance, audios, audio: audios[0] || null, guard: null });
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
