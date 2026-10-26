// UNFIRE · voces neuronales pregrabadas (Kokoro, Apache-2.0) para todos los personajes.
// Intercepta speechSynthesis.speak: si la frase existe pregrabada en el idioma actual, la reproduce
// con la voz del personaje; si no (frases dinámicas con nombres, etc.), usa la voz del sistema.
(() => {
  const SS = window.speechSynthesis; if (!SS || window.__NEURAL_VOX) return;
  // navegadores automatizados (QA/CI sin altavoz): se mantiene la voz del sistema tal cual
  if (navigator.webdriver && !/[?&]neuralvox=1/.test(location.search)) return;
  let MAN = null;
  fetch('vox/manifest.json?v=20261026a').then((r) => r.json()).then((j) => { MAN = {}; for (const L in j) MAN[L] = new Set(j[L]); }).catch(() => {});
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const SLOT = { ARI: 'a', LEO: 'b', GEMI: 'c', NIMBO: 'd', UNFIRE: 'e' };
  const slotFor = (n) => { n = String(n || '').toUpperCase(); if (SLOT[n]) return SLOT[n]; let h = 0; for (const c of n) h = (h * 33 + c.charCodeAt(0)) | 0; return 'acbe'[Math.abs(h) % 4]; };
  let who = null;
  const wrapVF = () => { const vf = window.__voiceFor; if (!vf || vf.__nv) return; const w = function (n, ...a) { who = n; return vf.call(this, n, ...a); }; w.__nv = 1; window.__voiceFor = w; };
  wrapVF(); addEventListener('load', wrapVF); setTimeout(wrapVF, 3000);
  const orig = SS.speak.bind(SS), origCancel = SS.cancel.bind(SS);
  const Q = []; let cur = null;
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(SS), 'speaking');
  try { Object.defineProperty(SS, 'speaking', { configurable: true, get: () => !!cur || Q.length > 0 || (desc ? desc.get.call(SS) : false) }); } catch (e) {}
  const call = (fn) => { try { fn && fn({}); } catch (e) {} };
  const next = () => {
    cur = null; const it = Q.shift(); if (!it) return;
    cur = it; const a = it.a; let done = false;
    // red de seguridad: si el audio no avisa de que ha terminado (sin altavoz, pestaña en segundo plano...), la frase se da por dicha igualmente
    const finish = (ok) => { if (done) return; done = true; clearTimeout(guard); if (ok) call(it.u.onend); else { cur = null; orig(it.u); } next(); };
    const guard = setTimeout(() => { try { a.pause(); } catch (e) {} finish(true); }, 1800 + Math.min(14000, String(it.u.text || '').length * 95));
    a.onended = () => finish(true);
    a.onerror = () => finish(false);
    call(it.u.onstart);
    a.play().catch(() => finish(false));
  };
  SS.cancel = () => { Q.length = 0; if (cur) { try { cur.a.pause(); } catch (e) {} cur = null; } origCancel(); };
  SS.speak = (u) => {
    try {
      const L = window.__LANG === 'en' ? 'en' : 'es';
      let t = norm(u.text); if (L === 'en' && window.T) t = norm(window.T(t));
      const k = hash(t);
      if (MAN && MAN[L] && MAN[L].has(k)) {
        const a = new Audio(`vox/${L}/${slotFor(who)}/${k}.mp3`); a.preload = 'auto'; a.volume = Math.max(0, Math.min(1, u.volume == null ? 1 : u.volume));
        Q.push({ a, u }); if (!cur) next(); return;
      }
    } catch (e) {}
    return orig(u);
  };
  window.__NEURAL_VOX = { slotFor, hash, get ready() { return !!MAN; } };
})();
