/* UNFIRE — one song at a time.
 * The house radio (RADIO), the world radio / "your music" (__WRADIO) and the
 * YouTube computer never play over each other: the last one you start wins.
 * Only the DJ desk (two decks + crossfader, window.__djOn) may mix songs on purpose. */
(() => {
  'use strict';
  const R = () => (typeof RADIO !== 'undefined' ? RADIO : null);
  const W = () => window.__WRADIO || null;
  const radioOn = () => { const r = R(); return !!(r && r.st && r.st.on); };
  const worldOn = () => { const w = W(); return !!(w && w.st && w.st.on); };
  const tubeOn = () => { const t = document.getElementById('tube'), f = document.getElementById('tubeF'); return !!(t && f && t.style.display !== 'none' && getComputedStyle(t).display !== 'none' && f.src && f.src !== 'about:blank'); };
  const dj = () => !!window.__djOn;
  let last = '';
  const stopRadio = () => { try { const r = R(); if (r && r.st && r.st.on) r.stop(); } catch (_) {} };
  const stopWorld = () => { try { const w = W(); if (w && w.st && w.st.on) w.toggle(); } catch (_) {} };
  function claim(who) {
    last = who;
    if (dj()) return;
    if (who !== 'radio') stopRadio();
    if (who !== 'world') stopWorld();
  }
  window.__MUSIC = { claim, get last() { return last; } };
  function wrap() {
    const r = R(), w = W();
    if (!r || !w) { setTimeout(wrap, 700); return; }
    if (r.__arbiter) return;
    r.__arbiter = true;
    const rs = r.start.bind(r);
    r.start = function () { claim('radio'); return rs.apply(this, arguments); };
    const wt = w.toggle, wn = w.next, wl = w.loadFile;
    w.toggle = function () { const res = wt.apply(this, arguments); if (w.st.on) claim('world'); return res; };
    if (wn) w.next = function () { const res = wn.apply(this, arguments); if (w.st.on) claim('world'); return res; };
    if (wl) w.loadFile = function () { claim('world'); return wl.apply(this, arguments); };
    // Safety net for automatic starts (first walk outside, story scenes…):
    // if two songs are ever on together, keep only the one started last.
    let pr = radioOn(), pw = worldOn();
    setInterval(() => {
      const ro = radioOn(), wo = worldOn();
      if (ro && !pr) last = 'radio';
      if (wo && !pw) last = 'world';
      pr = ro; pw = wo;
      if (dj()) return;
      if (tubeOn()) { if (ro) stopRadio(); if (wo) stopWorld(); return; }
      if (ro && wo) { if (last === 'radio') stopWorld(); else stopRadio(); }
    }, 300);
  }
  wrap();
})();
