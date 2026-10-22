/* UNFIRE · motor de síntesis analógica virtual (Web Audio). Polifónico, 24 dB/oct, supersierra,
   FM, arpegiador, rueda de tono y modulación, delay ping-pong y reverb. Todo sintetizado en tiempo real. */
const VA = (() => {
  const PRESETS = [
    { name: 'Trance Lead', wave: 'super', detune: 0.45, cutoff: 0.66, reso: 0.22, env: 0.42, attack: 0.02, release: 0.32, delay: 0.38, reverb: 0.36, decay: 0.6, sustain: 0.75, drive: 0.25, oct: 0 },
    { name: 'Hoover 2000', wave: 'super', detune: 0.95, cutoff: 0.55, reso: 0.12, env: 0.3, attack: 0.05, release: 0.35, delay: 0.18, reverb: 0.3, decay: 0.9, sustain: 0.85, drive: 0.4, oct: -1, glide: 0.08 },
    { name: 'Acid Line', wave: 'saw', detune: 0.04, cutoff: 0.22, reso: 0.86, env: 0.78, attack: 0.0, release: 0.12, delay: 0.3, reverb: 0.15, decay: 0.22, sustain: 0.25, drive: 0.65, oct: -1, arp: true },
    { name: 'Dream Pad', wave: 'super', detune: 0.62, cutoff: 0.46, reso: 0.1, env: 0.22, attack: 0.62, release: 0.75, delay: 0.32, reverb: 0.72, decay: 1.5, sustain: 0.9, drive: 0.1, oct: 0 },
    { name: 'Pluck Stab', wave: 'square', detune: 0.25, cutoff: 0.32, reso: 0.4, env: 0.88, attack: 0.0, release: 0.24, delay: 0.46, reverb: 0.3, decay: 0.2, sustain: 0.0, drive: 0.3, oct: 0 },
    { name: 'FM Bells', wave: 'fm', detune: 0.2, cutoff: 0.9, reso: 0.05, env: 0.2, attack: 0.0, release: 0.62, delay: 0.3, reverb: 0.55, decay: 1.2, sustain: 0.0, drive: 0.0, oct: 1 },
    { name: 'Sub Bass', wave: 'square', detune: 0.08, cutoff: 0.24, reso: 0.25, env: 0.25, attack: 0.0, release: 0.15, delay: 0.0, reverb: 0.05, decay: 0.4, sustain: 0.8, drive: 0.35, oct: -2 },
    { name: 'Crystal Arp', wave: 'fm', detune: 0.3, cutoff: 0.75, reso: 0.3, env: 0.5, attack: 0.0, release: 0.28, delay: 0.55, reverb: 0.5, decay: 0.3, sustain: 0.1, drive: 0.1, oct: 1, arp: true },
  ];
  const WAVE_NAME = { super: 'SUPSAW', saw: 'SAW', square: 'SQUARE', fm: 'FM' };
  const KNOB_FMT = {
    detune: (v) => Math.round(v * 60) + ' CENT', cutoff: (v) => Math.round(60 * Math.pow(2, v * 8.3)) + ' HZ', reso: (v) => 'Q ' + (0.7 + v * 16).toFixed(1), env: (v) => Math.round(v * 100) + ' %',
    attack: (v) => (0.002 + Math.pow(v, 3) * 2.5).toFixed(3) + ' S', release: (v) => (0.03 + v * v * 3).toFixed(2) + ' S', delay: (v) => Math.round(v * 100) + ' %', reverb: (v) => Math.round(v * 100) + ' %', volume: (v) => Math.round(v * 100) + ' %',
  };
  function create() {
    const ctx = UA.init(), T0 = () => ctx.currentTime;
    const P = { ...PRESETS[0], volume: 0.8, bend: 0, mod: 0, ribbon: null };
    const out = ctx.createGain(); out.gain.value = 0.64;
    const vbus = ctx.createGain(); vbus.gain.value = 0.32;
    const drive = ctx.createWaveShaper(); drive.oversample = '2x';
    const setDrive = (d) => { const n = 1024, c = new Float32Array(n), k = 1 + d * 6; for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } drive.curve = c; };
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
    vbus.connect(drive); drive.connect(hp);
    const dry = ctx.createGain(); hp.connect(dry); dry.connect(out);
    // delay ping-pong (corchea con puntillo)
    const dSend = ctx.createGain(), dl = ctx.createDelay(2), dr = ctx.createDelay(2), dfb = ctx.createGain(), dlf = ctx.createBiquadFilter(), mrg = ctx.createChannelMerger(2), dOut = ctx.createGain();
    dlf.type = 'lowpass'; dlf.frequency.value = 3800; hp.connect(dSend); dSend.connect(dl); dl.connect(dlf); dlf.connect(dr); dr.connect(dfb); dfb.connect(dl);
    dl.connect(mrg, 0, 0); dr.connect(mrg, 0, 1); mrg.connect(dOut); dOut.connect(out);
    // reverb
    const rSend = ctx.createGain(), rv = ctx.createConvolver(), rOut = ctx.createGain(); rv.buffer = ENGINES.makeIR({ dur: 3.4, pre: 0.02, bright: 0.58, early: 6 }); hp.connect(rSend); rSend.connect(rv); rv.connect(rOut); rOut.connect(out);
    // ensanchador estéreo suave
    out.connect(UA.bus.master);
    const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.75; out.connect(an);
    // fuentes de modulación globales (en cents)
    const bend = ctx.createConstantSource(); bend.offset.value = 0; bend.start();
    const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain(); lfo.frequency.value = 5.6; lfoAmt.gain.value = 0; lfo.connect(lfoAmt); lfo.start();
    let bpm = 138;
    function applyFx() {
      const t = T0(); out.gain.setTargetAtTime(Math.pow(P.volume, 1.6) * 0.9, t, 0.03);
      const step = (60 / bpm) * 0.75; dl.delayTime.setTargetAtTime(step, t, 0.05); dr.delayTime.setTargetAtTime(step, t, 0.05);
      dSend.gain.setTargetAtTime(P.delay * 0.55, t, 0.03); dfb.gain.setTargetAtTime(0.18 + P.delay * 0.4 + (P.ribbon != null ? P.ribbon * 0.25 : 0), t, 0.03); dOut.gain.value = 0.9;
      rSend.gain.setTargetAtTime(P.reverb * 0.85, t, 0.03); rOut.gain.value = 0.8; dry.gain.value = 1;
      setDrive(P.drive || 0);
    }
    applyFx();
    const voices = new Map(); let vid = 0, lastF = 0;
    const cutHz = (cut, midi) => Math.min(19000, 60 * Math.pow(2, cut * 8.3) * Math.pow(2, ((midi - 60) / 12) * 0.35));
    const effCut = () => (P.ribbon != null ? G3.lerp(P.cutoff, P.ribbon, 0.85) : P.cutoff);
    function noteOn(midi, vel = 0.85, when, tag) {
      const t = Math.max(T0(), when || 0) + 0.003; if (voices.size >= 12) { const [k, v] = voices.entries().next().value; kill(v, t); voices.delete(k); }
      const note = midi + 12 * P.oct, f = 440 * Math.pow(2, (note - 69) / 12);
      const mix = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), vg = ctx.createGain(); f1.type = f2.type = 'lowpass';
      const oscs = [], mods = [];
      const add = (type, det, gain, ratio = 1) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f * ratio; o.detune.value = det; g.gain.value = gain; bend.connect(o.detune); lfoAmt.connect(o.detune);
        if (P.glide && lastF) { o.frequency.setValueAtTime(lastF * ratio, t); o.frequency.exponentialRampToValueAtTime(f * ratio, t + P.glide); }
        o.connect(g); g.connect(mix); oscs.push(o); return o; };
      const sp = P.detune * 60;
      if (P.wave === 'super') { [-1, -0.62, -0.3, 0, 0.3, 0.62, 1].forEach((k, i) => add('sawtooth', k * sp, i === 3 ? 0.32 : 0.2)); add('sine', -1200, 0.25); }
      else if (P.wave === 'saw') { add('sawtooth', -sp * 0.2, 0.5); add('sawtooth', sp * 0.2, 0.5); }
      else if (P.wave === 'square') { add('square', -sp * 0.15, 0.42); add('square', sp * 0.15, 0.42); add('square', -1200, 0.3); }
      else { const car = add('sine', 0, 0.7), car2 = add('sine', sp * 0.1 + 1200, 0.12), m = ctx.createOscillator(), mg = ctx.createGain(); m.frequency.value = f * 3.5; m.detune.value = sp * 0.2; bend.connect(m.detune);
        mg.gain.setValueAtTime(f * 7, t); mg.gain.setTargetAtTime(f * 0.6, t, 0.12 + P.decay * 0.25); m.connect(mg); mg.connect(car.frequency); mg.connect(car2.frequency); mods.push(m); }
      lastF = f;
      const base = cutHz(effCut(), note), peak = Math.min(19500, base * Math.pow(2, P.env * 6)), A = 0.002 + Math.pow(P.attack, 3) * 2.5, R = 0.03 + P.release * P.release * 3;
      f1.Q.value = 0.7 + P.reso * 16; f2.Q.value = 0.6; f2.frequency.value = Math.min(19500, peak * 1.4);
      f1.frequency.setValueAtTime(base, t); f1.frequency.linearRampToValueAtTime(peak, t + Math.max(0.004, A * 0.6)); f1.frequency.setTargetAtTime(base + (peak - base) * P.sustain * 0.4, t + A * 0.6, Math.max(0.02, P.decay / 3));
      const amp = 0.55 * (0.35 + 0.65 * vel);
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(amp, t + A); vg.gain.setTargetAtTime(amp * Math.max(0.0001, P.sustain), t + A, Math.max(0.03, P.decay / 3));
      mix.connect(f1); f1.connect(f2); f2.connect(vg); vg.connect(vbus);
      oscs.forEach((o) => o.start(t)); mods.forEach((o) => o.start(t));
      const v = { id: ++vid, midi, tag, oscs, mods, f1, vg, R, base, t, note };
      if (P.sustain <= 0.001) { const end = t + A + P.decay * 3 + 0.2; [...oscs, ...mods].forEach((o) => o.stop(end + R)); }
      oscs[0].onended = () => { mix.disconnect(); vg.disconnect(); voices.delete(v.key); };
      v.key = midi + ':' + (tag || 'u') + ':' + v.id; voices.set(v.key, v); fire(midi, true, tag); return v;
    }
    function kill(v, t) { try { v.vg.gain.cancelScheduledValues(t); v.vg.gain.setTargetAtTime(0, t, 0.01); [...v.oscs, ...v.mods].forEach((o) => o.stop(t + 0.06)); } catch (e) {} }
    function noteOff(midi, when, tag) {
      const t = Math.max(T0(), when || 0);
      for (const [k, v] of voices) if (v.midi === midi && (v.tag || 'u') === (tag || 'u') && !v.off) { v.off = true; try { v.vg.gain.cancelScheduledValues(t); if (v.vg.gain.cancelAndHoldAtTime) v.vg.gain.cancelAndHoldAtTime(t); v.vg.gain.setTargetAtTime(0, t, v.R / 4); [...v.oscs, ...v.mods].forEach((o) => o.stop(t + v.R * 1.6 + 0.08)); } catch (e) {} fire(midi, false, tag); }
    }
    function allOff() { const t = T0(); for (const [, v] of voices) kill(v, t); voices.clear(); held.clear(); arpNotes = []; }
    // cambios en vivo del filtro
    function liveFilter() { const t = T0(); for (const [, v] of voices) { if (v.off) continue; const b = cutHz(effCut(), v.note); v.f1.frequency.cancelScheduledValues(t); v.f1.frequency.setTargetAtTime(b * (1 + P.env * P.sustain), t, 0.03); v.f1.Q.setTargetAtTime(0.7 + P.reso * 16, t, 0.03); } }
    const listeners = []; const fire = (m, on, tag) => listeners.forEach((f) => f(m, on, tag));
    // ---------- arpegiador ----------
    const held = new Set(); let arpNotes = [], arpOn = false, hold = false, arpIdx = 0, timer = null, nextT = 0, step16 = 0, demo = null;
    function startClock() { if (timer) return; nextT = T0() + 0.05; timer = setInterval(sched, 25); }
    function stopClock() { clearInterval(timer); timer = null; }
    function sched() {
      const dur = 60 / bpm / 4;
      while (nextT < T0() + 0.12) {
        if (arpOn && arpNotes.length) { const seq = [...arpNotes].sort((a, b) => a - b), n = seq.length, pat = []; for (let o = 0; o < 2; o++) seq.forEach((m) => pat.push(m + o * 12)); for (let i = pat.length - 2; i > 0; i--) pat.push(pat[i]);
          const m = pat[arpIdx % pat.length]; arpIdx++; noteOn(m, 0.8, nextT, 'arp'); noteOff(m, nextT + dur * 0.62, 'arp'); }
        if (demo) demo(step16, nextT, dur);
        step16++; nextT += dur;
      }
      if (!arpOn && !demo) stopClock();
    }
    let arpReleasedAll = false;
    function keyDown(m, vel) {
      if (!arpOn) { noteOn(m, vel); return; }
      if (hold && arpReleasedAll) { arpNotes = []; arpReleasedAll = false; }
      held.add(m); if (!arpNotes.includes(m)) arpNotes.push(m); startClock(); fire(m, true, 'key');
    }
    function keyUp(m) {
      if (!arpOn) { noteOff(m); return; }
      held.delete(m); if (!hold) arpNotes = arpNotes.filter((x) => x !== m); else if (held.size === 0) arpReleasedAll = true; fire(m, false, 'key');
    }
    function setArp(on) { arpOn = on; arpNotes = on ? [...held] : []; arpIdx = 0; if (on) startClock(); else { for (const [, v] of voices) if (v.tag === 'arp') noteOff(v.midi, 0, 'arp'); } }
    function setHold(on) { hold = on; if (!on) { arpNotes = arpNotes.filter((m) => held.has(m)); arpReleasedAll = false; } }
    // ---------- DEMO: progresión del Canon de Pachelbel (dominio público) en clave trance ----------
    const CHORDS = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [54, 57, 61], [55, 59, 62], [50, 54, 57], [55, 59, 62], [57, 61, 64]];
    function setDemo(on) {
      if (!on) { demo = null; return; }
      UA.loadKit(['kick', 'hat', 'clap', 'hatopen']);
      const dbus = ctx.createGain(); dbus.gain.value = 0.55; dbus.connect(UA.bus.master);
      const bass = (m, t, d) => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = o2.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o2.detune.value = -1200; f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(1600, t); f.frequency.setTargetAtTime(220, t, 0.05); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.005); g.gain.setTargetAtTime(0, t + d * 0.7, 0.02); o.connect(f); o2.connect(f); f.connect(g); g.connect(dbus); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1); };
      step16 = 0;
      demo = (s, t, d) => {
        const bar = Math.floor(s / 16) % 8, i = s % 16, ch = CHORDS[bar];
        if (i % 4 === 0) { UA.hit('kick', t, dbus, { gain: 0.9 }); UA.sub(t, dbus, 0.7); }
        if (i % 4 === 2) UA.hit('hatopen', t, dbus, { gain: 0.22, decay: 0.12 }); else UA.hit('hat', t, dbus, { gain: 0.12 + (i % 2 ? 0 : 0.06) });
        if (i === 4 || i === 12) UA.hit('clap', t, dbus, { gain: 0.35 });
        if (i % 4 === 2) bass(ch[0] - 24, t, d * 1.6);
        if (!arpOn || !arpNotes.length) { const pat = [0, 1, 2, 1, 0, 2, 1, 2]; const m = ch[pat[i % 8]] + (i >= 8 ? 12 : 0) + 12; noteOn(m, 0.7, t, 'demo'); noteOff(m, t + d * 0.55, 'demo'); }
      };
      startClock();
    }
    function set(k, v) { P[k] = v; if (['cutoff', 'reso'].includes(k)) liveFilter(); if (['volume', 'delay', 'reverb', 'drive'].includes(k)) applyFx(); }
    function preset(i) { const p = PRESETS[i]; Object.assign(P, p, { volume: P.volume, bend: P.bend, mod: P.mod }); P.glide = p.glide || 0; applyFx(); return p; }
    function setBend(v) { P.bend = v; bend.offset.setTargetAtTime(v * 200, T0(), 0.01); }
    function setMod(v) { P.mod = v; lfoAmt.gain.setTargetAtTime(v * 38, T0(), 0.03); }
    function setRibbon(v) { P.ribbon = v; liveFilter(); applyFx(); }
    const tbuf = new Uint8Array(1024), fbuf = new Uint8Array(1024);
    function scope() { an.getByteTimeDomainData(tbuf); an.getByteFrequencyData(fbuf); let s = 0; for (let i = 0; i < tbuf.length; i += 4) { const x = (tbuf[i] - 128) / 128; s += x * x; } return { wave: tbuf, spec: fbuf, level: Math.min(1, Math.sqrt(s / 256) * 3.2) }; }
    return { P, noteOn, noteOff, keyDown, keyUp, allOff, set, preset, setBend, setMod, setRibbon, setArp, setHold, setDemo, scope, onNote: (f) => listeners.push(f), get voices() { return voices.size; }, get bpm() { return bpm; }, get arp() { return arpOn; }, get hold() { return hold; }, get demo() { return !!demo; } };
  }
  return { create, PRESETS, WAVE_NAME, KNOB_FMT };
})();
