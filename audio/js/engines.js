/* Motores DSP de los 100 plugins UNFIRE. Todo el procesado es código propio sobre Web Audio. */
const ENGINES = (() => {
  const U = UA, TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pct = (v) => Math.round(v * 100) + ' %';
  const dbf = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
  const semi = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' st';
  const sec = (v) => (v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s');
  const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz');
  const DIVS = ['1/1', '1/2', '1/4', '1/8', '1/16'];

  // Rangos de cada control por motor
  const PARAMS = {
    saturator: { gain: [0, 36, 12, 0.1, (v) => '+' + v.toFixed(1) + ' dB'], thresh: [-24, 0, -6, 0.1, dbf], color: [-1, 1, 0, 0.01, (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + ' %'], mix: [0, 1, 1, 0.01, pct], output: [-18, 6, 0, 0.1, dbf] },
    timewarp: { div: [0, 4, 2, 1, (v) => DIVS[Math.round(v)]], density: [0, 1, 0.5, 0.01, pct], pitch: [-12, 12, 0, 1, semi], mix: [0, 1, 0.85, 0.01, pct], chaos: [0, 1, 0.25, 0.01, pct] },
    space: { time: [0.05, 1.2, 0.36, 0.01, sec], feedback: [0, 0.95, 0.42, 0.01, pct], mix: [0, 1, 0.45, 0.01, pct], decay: [0.3, 2, 1, 0.01, (v) => '×' + v.toFixed(2)], tone: [1200, 16000, 7500, 10, hz] },
    voice: { pitch: [-12, 12, 0, 1, semi], formant: [-12, 12, 0, 0.1, semi], character: [0, 1, 0.4, 0.01, pct], mix: [0, 1, 1, 0.01, pct], air: [0, 1, 0.35, 0.01, pct] },
    link: { amount: [0, 1, 0.5, 0.01, pct], rate: [0.05, 8, 0.6, 0.01, (v) => v.toFixed(2) + ' Hz'], depth: [0, 1, 0.6, 0.01, pct], mix: [0, 1, 0.35, 0.01, pct], shape: [0, 3, 0, 1, (v) => ['SINE', 'TRI', 'SAW', 'SQUARE'][Math.round(v)]] },
    sampler: { attack: [0.002, 1.5, 0.004, 0.001, sec], release: [0.05, 4, 1.2, 0.01, sec], tone: [600, 18000, 14000, 10, hz], space: [0, 1, 0.28, 0.01, pct], echo: [0, 1, 0.12, 0.01, pct] },
    granular: { size: [0.02, 0.5, 0.14, 0.005, sec], density: [2, 60, 18, 1, (v) => Math.round(v) + ' g/s'], pitch: [-12, 12, 0, 1, semi], spread: [0, 1, 0.5, 0.01, pct], space: [0, 1, 0.45, 0.01, pct] },
    drums: { tempo: [60, 180, 92, 1, (v) => Math.round(v) + ' BPM'], swing: [0, 0.4, 0.12, 0.01, pct], tune: [-12, 12, 0, 0.5, semi], decay: [0.1, 1, 0.8, 0.01, pct], crush: [0, 1, 0, 0.01, pct] },
    synth: { cutoff: [100, 16000, 2400, 10, hz], reso: [0.5, 20, 6, 0.1, (v) => 'Q ' + v.toFixed(1)], release: [0.05, 4, 0.5, 0.01, sec], detune: [0, 50, 18, 0.5, (v) => v.toFixed(1) + ' ct'], space: [0, 1, 0.3, 0.01, pct] },
  };

  // ---------- Respuestas al impulso generadas (reverbs) ----------
  const irCache = new Map();
  function makeIR({ dur = 2.5, pre = 0.01, bright = 0.5, early = 0, swell = false, eerie = false }) {
    const key = JSON.stringify(arguments[0]);
    if (irCache.has(key)) return irCache.get(key);
    const ctx = U.ctx, sr = ctx.sampleRate, n = Math.floor(sr * (dur + pre)), b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let y = 0; let seed = 99 + ch * 31;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
      const p0 = Math.floor(pre * sr);
      for (let i = p0; i < n; i++) {
        const t = (i - p0) / sr, u = t / dur;
        const a = 0.05 + bright * 0.9 * Math.exp(-t * (2.2 - bright * 1.6));
        y += (r() - y) * a;
        let env = swell ? Math.pow(u, 1.6) * (u < 0.9 ? 1 : (1 - u) / 0.1) : Math.exp(-6.9 * u);
        let v = y * env;
        if (eerie) v += env * 0.12 * (Math.sin(TAU * 440 * 1.5 * t + ch) * Math.sin(TAU * 0.3 * t) + Math.sin(TAU * 660 * t * (1 + 0.002 * Math.sin(t * 3))) * 0.6);
        d[i] = v;
      }
      for (let k = 0; k < early; k++) { const i = p0 + Math.floor((0.007 + k * 0.011 + (ch ? 0.003 : 0)) * sr); if (i < n) d[i] += (k % 2 ? -1 : 1) * 0.8 * Math.pow(0.82, k); }
    }
    irCache.set(key, b); return b;
  }
  // Cola compartida de espacio (reverb + eco) para instrumentos
  function tail(dest) {
    const ctx = U.ctx;
    const n = { in: ctx.createGain(), dry: ctx.createGain(), rev: ctx.createConvolver(), revG: ctx.createGain(), dl: ctx.createDelay(2), fb: ctx.createGain(), dlLP: ctx.createBiquadFilter(), dlG: ctx.createGain() };
    n.rev.buffer = makeIR({ dur: 2.8, pre: 0.015, bright: 0.55, early: 6 });
    n.dl.delayTime.value = 0.49; n.fb.gain.value = 0.38; n.dlLP.type = 'lowpass'; n.dlLP.frequency.value = 4200;
    n.in.connect(n.dry); n.dry.connect(dest);
    n.in.connect(n.rev); n.rev.connect(n.revG); n.revG.connect(dest);
    n.in.connect(n.dl); n.dl.connect(n.dlLP); n.dlLP.connect(n.fb); n.fb.connect(n.dl); n.dlLP.connect(n.dlG); n.dlG.connect(dest);
    n.dlG.connect(n.rev);
    return {
      input: n.in,
      space(v) { U.smooth(n.revG.gain, v * 0.9); },
      echo(v) { U.smooth(n.dlG.gain, v * 0.7); },
      dispose() { Object.values(n).forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // ---------- Cadena final: HYPER (ancho + excitador) y OMEGA (cola infinita) ----------
  function postChain() {
    const ctx = U.ctx;
    const n = {
      in: ctx.createGain(), out: ctx.createGain(), an: ctx.createAnalyser(),
      split: ctx.createChannelSplitter(2), merge: ctx.createChannelMerger(2), hz: ctx.createDelay(0.05), hyG: ctx.createGain(), dryG: ctx.createGain(),
      exHP: ctx.createBiquadFilter(), exSh: ctx.createWaveShaper(), exG: ctx.createGain(),
      om: ctx.createConvolver(), omG: ctx.createGain(),
    };
    n.an.fftSize = 2048; n.an.smoothingTimeConstant = 0.78;
    n.in.connect(n.dryG); n.dryG.connect(n.out);
    n.in.connect(n.split); n.split.connect(n.merge, 0, 0); n.split.connect(n.hz, 1); n.hz.connect(n.merge, 0, 1); n.hz.delayTime.value = 0.014;
    n.merge.connect(n.hyG); n.hyG.connect(n.out); n.hyG.gain.value = 0;
    n.exHP.type = 'highpass'; n.exHP.frequency.value = 3200; n.exSh.curve = U.curve((x) => Math.tanh(x * 4)); n.exG.gain.value = 0;
    n.in.connect(n.exHP); n.exHP.connect(n.exSh); n.exSh.connect(n.exG); n.exG.connect(n.out);
    n.om.buffer = makeIR({ dur: 9, pre: 0.03, bright: 0.45 }); n.omG.gain.value = 0;
    n.in.connect(n.om); n.om.connect(n.omG); n.omG.connect(n.out);
    n.out.connect(n.an); n.out.connect(U.bus.master);
    const buf = new Float32Array(2048), fbuf = new Uint8Array(1024);
    return {
      input: n.in, analyser: n.an,
      stage(h, o) { U.smooth(n.hyG.gain, h * 0.55, 0.2); U.smooth(n.dryG.gain, 1 - h * 0.25, 0.2); U.smooth(n.exG.gain, h * 0.22, 0.2); U.smooth(n.omG.gain, o * 0.55, 0.4); },
      wave(arr) { n.an.getFloatTimeDomainData(arr); },
      spectrum() { n.an.getByteFrequencyData(fbuf); return fbuf; },
      level() { n.an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < 2048; i += 2) s += buf[i] * buf[i]; return Math.sqrt(s / 1024); },
      dispose() { Object.values(n).forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // ======================================================================
  // 1 · SATURADOR
  function saturator(spec, out) {
    const ctx = U.ctx;
    const n = {
      input: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain(), sum: ctx.createGain(),
      drive: ctx.createGain(), pre: ctx.createBiquadFilter(), bump: ctx.createBiquadFilter(),
      wow: ctx.createDelay(0.05), wowLfo: ctx.createOscillator(), wowAmt: ctx.createGain(),
      shaper: ctx.createWaveShaper(), crush: ctx.createWaveShaper(), post: ctx.createBiquadFilter(), dc: ctx.createBiquadFilter(), makeup: ctx.createGain(),
    };
    n.pre.type = 'highshelf'; n.pre.frequency.value = 2400; n.bump.type = 'peaking'; n.bump.frequency.value = 85; n.bump.Q.value = 0.9;
    n.wow.delayTime.value = 0.005; n.wowLfo.frequency.value = 0.6; n.wowAmt.gain.value = 0; n.wowLfo.connect(n.wowAmt); n.wowAmt.connect(n.wow.delayTime); n.wowLfo.start();
    n.shaper.oversample = '4x'; n.post.type = 'lowpass'; n.post.Q.value = 0.55; n.dc.type = 'highpass'; n.dc.frequency.value = 16;
    n.input.connect(n.dry); n.dry.connect(n.sum);
    n.input.connect(n.drive); n.drive.connect(n.pre); n.pre.connect(n.bump); n.bump.connect(n.wow); n.wow.connect(n.shaper);
    n.shaper.connect(n.crush); n.crush.connect(n.post); n.post.connect(n.dc); n.dc.connect(n.makeup); n.makeup.connect(n.wet); n.wet.connect(n.sum);
    n.sum.connect(out);
    const p = { gain: 12, thresh: -6, color: 0, mix: 1, output: 0, bias: 0.08, mode: 'tube' };
    const custom = [0.34, 0.6, 0.8, 0.93, 1.0];
    const shapes = {
      tube: (x) => { const k = 3.2, b = p.bias; return (Math.tanh(k * (x + b)) - Math.tanh(k * b)) / (1 + Math.tanh(k * b) * 0.45); },
      tape: (x) => Math.atan(2.6 * x) / Math.atan(2.6),
      transient: (x) => { const z = Math.abs(x) * 3; const y = z < 0.85 ? z : 0.85 + 0.15 * Math.tanh((z - 0.85) / 0.15); return Math.sign(x) * y; },
      destroy: (x) => Math.sin(x * Math.PI * 2.25) * 0.85 + Math.tanh(x * 6) * 0.15,
      custom: (x) => {
        const a = Math.abs(x), pts = [0, ...custom], seg = Math.min(4, Math.floor(a * 5)), f = a * 5 - seg;
        const y0 = pts[Math.max(0, seg - 1)], y1 = pts[seg], y2 = pts[seg + 1], y3 = pts[Math.min(5, seg + 2)];
        const y = y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0)));
        return Math.sign(x) * clamp(y, 0, 1);
      },
    };
    const rebuild = () => { const T = U.db(p.thresh), f = shapes[p.mode]; n.shaper.curve = U.curve((x) => T * f(x)); n.crush.curve = p.mode === 'destroy' ? U.curve((x) => Math.round(x * 12) / 12, 2048) : null; };
    const update = () => {
      const s = U.smooth;
      s(n.drive.gain, U.db(p.gain) * 0.25); s(n.pre.gain, p.color * 7 + (p.mode === 'transient' ? 3 : 0));
      const lp = p.color < 0 ? 2600 * Math.pow(12000 / 2600, 1 + p.color) : 12000 * Math.pow(20000 / 12000, p.color);
      s(n.post.frequency, p.mode === 'tape' ? lp * 0.72 : lp); s(n.bump.gain, p.mode === 'tape' ? 2.8 : 0); s(n.wowAmt.gain, p.mode === 'tape' ? 0.0011 : 0);
      s(n.makeup.gain, U.db(-p.thresh * 0.55 - p.gain * 0.22 + p.output + (p.mode === 'destroy' ? -3 : 0)));
      s(n.dry.gain, Math.cos(p.mix * Math.PI / 2)); s(n.wet.gain, Math.sin(p.mix * Math.PI / 2));
    };
    rebuild(); update();
    return {
      input: n.input, custom, kind: 'fx',
      set(id, v) { p[id] = v; if (id === 'thresh') rebuild(); update(); },
      setMode(m) { p.mode = m; rebuild(); update(); },
      setCustom(i, v) { custom[i] = clamp(v, 0.02, 1); rebuild(); },
      transfer(x) { return U.db(p.thresh) * shapes[p.mode](x); },
      info() { return { mode: p.mode }; },
      dispose() { try { n.wowLfo.stop(); } catch (e) {} Object.values(n).forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // 2 · MANIPULADOR DE TIEMPO (buffer circular en un ScriptProcessor)
  function timewarp(spec, out) {
    const ctx = U.ctx, sr = ctx.sampleRate;
    const input = ctx.createGain(), sp = ctx.createScriptProcessor(2048, 2, 2);
    input.connect(sp); sp.connect(out);
    const N = Math.floor(sr * 6), rb = [new Float32Array(N), new Float32Array(N)];
    let w = 0;
    const p = { div: 2, density: 0.5, pitch: 0, mix: 0.85, chaos: 0.25, mode: 'reverse', tempo: 92 };
    let segLen = 1, segPos = 1, segStart = 0, segMode = 'reverse', rate = 1, stutLen = 1024, stutStart = 0, grainClock = 0, seg = 0;
    const grains = [];
    const read = (b, pos) => { pos %= N; if (pos < 0) pos += N; const i = pos | 0, f = pos - i; return b[i] * (1 - f) + b[i + 1 === N ? 0 : i + 1] * f; };
    const fade = (k, len) => Math.min(1, k / 220, (len - k) / 220);
    function newSeg() {
      segLen = Math.max(512, Math.floor((60 / p.tempo) * 4 / Math.pow(2, Math.round(p.div)) * sr)); segPos = 0; seg++;
      let m = p.mode;
      if (m === 'chaos') m = ['reverse', 'stutter', 'grain', 'normal', 'dimension'][(Math.random() * 5) | 0];
      else if (Math.random() < p.chaos * 0.6) m = ['reverse', 'stutter', 'grain', 'normal'][(Math.random() * 4) | 0];
      segMode = m; segStart = w; rate = Math.pow(2, p.pitch / 12);
      stutLen = Math.max(512, Math.floor(segLen / (2 + Math.round(p.density * 6)))); stutStart = w - stutLen;
    }
    sp.onaudioprocess = (e) => {
      const iL = e.inputBuffer.getChannelData(0), iR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : iL;
      const oL = e.outputBuffer.getChannelData(0), oR = e.outputBuffer.getChannelData(1);
      const mix = p.mix;
      for (let i = 0; i < iL.length; i++) {
        rb[0][w] = iL[i]; rb[1][w] = iR[i];
        if (segPos >= segLen) newSeg();
        let wl = iL[i], wr = iR[i];
        if (segMode === 'reverse') {
          const pos = segStart - 1 - segPos * rate, env = fade(segPos, segLen);
          wl = read(rb[0], pos) * env; wr = read(rb[1], pos) * env;
        } else if (segMode === 'stutter') {
          const k = segPos % stutLen, env = fade(k, stutLen) * (k < stutLen * 0.88 ? 1 : 0.15), pos = stutStart + k * rate;
          wl = read(rb[0], pos) * env; wr = read(rb[1], pos) * env;
        } else if (segMode === 'grain' || segMode === 'dimension') {
          if (--grainClock <= 0) {
            grainClock = Math.floor(sr / (6 + p.density * 44));
            if (grains.length < 32) {
              const shift = segMode === 'dimension' ? [0, 12, 7, -12, 19][(Math.random() * 5) | 0] : (Math.random() - 0.5) * 0.4;
              grains.push({ pos: w - (0.05 + Math.random() * 1.4) * sr, len: Math.floor((0.05 + (1 - p.density) * 0.18) * sr), age: 0, r: Math.pow(2, (p.pitch + shift) / 12), pan: Math.random() });
            }
          }
          wl = 0; wr = 0;
          for (let g = grains.length - 1; g >= 0; g--) {
            const G = grains[g], env = 0.5 - 0.5 * Math.cos((TAU * G.age) / G.len), pos = G.pos + G.age * G.r;
            const s = (read(rb[0], pos) + read(rb[1], pos)) * 0.5 * env * 0.55;
            wl += s * (1 - G.pan * 0.6); wr += s * (0.4 + G.pan * 0.6);
            if (++G.age >= G.len) grains.splice(g, 1);
          }
          if (segMode === 'dimension') { rb[0][w] += wl * 0.3; rb[1][w] += wr * 0.3; }
        }
        oL[i] = iL[i] * (1 - mix) + wl * mix; oR[i] = iR[i] * (1 - mix) + wr * mix;
        segPos++; w = w + 1 === N ? 0 : w + 1;
      }
    };
    return {
      input, kind: 'fx',
      set(id, v) { p[id] = v; },
      setMode(m) { p.mode = m; segPos = segLen; },
      info() { return { mode: segMode, pos: segPos / segLen, seg, grains: grains.length, div: DIVS[Math.round(p.div)] }; },
      dispose() { sp.onaudioprocess = null; try { input.disconnect(); sp.disconnect(); } catch (e) {} },
    };
  }

  // 3 · ESPACIO (eco + reverbs de convolución)
  const SPACES = {
    hall: { dur: 3.4, pre: 0.028, bright: 0.35, early: 8 }, plate: { dur: 2.4, pre: 0.002, bright: 0.85, early: 0 },
    chamber: { dur: 1.2, pre: 0.008, bright: 0.55, early: 12 }, infinite: { dur: 10, pre: 0.02, bright: 0.45, early: 4 },
    otherworld: { dur: 4.5, pre: 0.01, bright: 0.6, swell: true, eerie: true },
  };
  function space(spec, out) {
    const ctx = U.ctx;
    const n = { input: ctx.createGain(), dry: ctx.createGain(), dl: ctx.createDelay(2.5), fb: ctx.createGain(), dlLP: ctx.createBiquadFilter(), dlG: ctx.createGain(),
      conv: ctx.createConvolver(), tone: ctx.createBiquadFilter(), revG: ctx.createGain(), sum: ctx.createGain() };
    n.dlLP.type = 'lowpass'; n.tone.type = 'lowpass';
    n.input.connect(n.dry); n.dry.connect(n.sum);
    n.input.connect(n.dl); n.dl.connect(n.dlLP); n.dlLP.connect(n.fb); n.fb.connect(n.dl); n.dlLP.connect(n.dlG); n.dlG.connect(n.sum);
    n.input.connect(n.conv); n.dlG.connect(n.conv); n.conv.connect(n.tone); n.tone.connect(n.revG); n.revG.connect(n.sum);
    n.sum.connect(out);
    const p = { time: 0.36, feedback: 0.42, mix: 0.45, decay: 1, tone: 7500, mode: 'hall' };
    let irT = null;
    const setIR = () => { const s = SPACES[p.mode]; n.conv.buffer = makeIR({ ...s, dur: Math.round(s.dur * p.decay * 10) / 10 }); };
    const update = () => {
      const s = U.smooth;
      s(n.dl.delayTime, p.time, 0.08); s(n.fb.gain, p.mode === 'infinite' ? Math.max(0.88, p.feedback) : p.feedback);
      s(n.dlLP.frequency, p.tone * 0.7); s(n.tone.frequency, p.tone);
      s(n.dry.gain, Math.cos(p.mix * Math.PI / 2)); s(n.revG.gain, Math.sin(p.mix * Math.PI / 2) * 1.1); s(n.dlG.gain, Math.sin(p.mix * Math.PI / 2) * 0.55);
    };
    setIR(); update();
    return {
      input: n.input, kind: 'fx',
      set(id, v) { p[id] = v; if (id === 'decay') { clearTimeout(irT); irT = setTimeout(setIR, 180); } update(); },
      setMode(m) { p.mode = m; setIR(); update(); },
      info() { return { mode: p.mode, time: p.time, fb: p.feedback }; },
      dispose() { Object.values(n).forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // Desplazador de tono por granos solapados (para voz)
  function pitchShifter(ctx) {
    const sp = ctx.createScriptProcessor(1024, 1, 1), sr = ctx.sampleRate, N = 8192, b = new Float32Array(N), W = Math.floor(sr * 0.05);
    let w = 0, ph = 0, ratio = 1;
    sp.onaudioprocess = (e) => {
      const x = e.inputBuffer.getChannelData(0), y = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < x.length; i++) {
        b[w] = x[i];
        ph += (1 - ratio) / W; ph -= Math.floor(ph);
        let s = 0;
        for (const o of [0, 0.5]) {
          const q = (ph + o) % 1, d = 2 + q * W, pos = w - d, pi = Math.floor(pos), f = pos - pi;
          const i0 = (pi % N + N) % N, i1 = (i0 + 1) % N;
          s += (b[i0] * (1 - f) + b[i1] * f) * Math.sin(Math.PI * q);
        }
        y[i] = s * 0.75; w = (w + 1) % N;
      }
    };
    return { node: sp, set(semi) { ratio = Math.pow(2, semi / 12); }, dispose() { sp.onaudioprocess = null; try { sp.disconnect(); } catch (e) {} } };
  }

  // 4 · PROCESADOR VOCAL
  function voice(spec, out) {
    const ctx = U.ctx;
    const n = {
      input: ctx.createGain(), hp: ctx.createBiquadFilter(), comp: ctx.createDynamicsCompressor(), f1: ctx.createBiquadFilter(), f2: ctx.createBiquadFilter(), f3: ctx.createBiquadFilter(),
      sat: ctx.createWaveShaper(), lo: ctx.createBiquadFilter(), band: ctx.createBiquadFilter(), airF: ctx.createBiquadFilter(), main: ctx.createGain(),
      ring: ctx.createGain(), ringOsc: ctx.createOscillator(), ringDepth: ctx.createGain(), crush: ctx.createWaveShaper(),
      harmG: ctx.createGain(), slap: ctx.createDelay(0.5), slapG: ctx.createGain(), chA: ctx.createDelay(0.05), chB: ctx.createDelay(0.05), chG: ctx.createGain(),
      lfo: ctx.createOscillator(), lfoA: ctx.createGain(), lfoB: ctx.createGain(), plate: ctx.createConvolver(), plateG: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain(), sum: ctx.createGain(),
    };
    const ps = pitchShifter(ctx);
    n.hp.type = 'highpass'; n.hp.frequency.value = 90;
    [n.f1, n.f2, n.f3].forEach((f, i) => { f.type = 'peaking'; f.Q.value = 3.2; f.frequency.value = [700, 1220, 2600][i]; });
    n.lo.type = 'lowshelf'; n.lo.frequency.value = 180; n.band.type = 'lowpass'; n.band.frequency.value = 18000; n.airF.type = 'highshelf'; n.airF.frequency.value = 9000;
    n.ringOsc.frequency.value = 110; n.ringOsc.connect(n.ringDepth); n.ringDepth.connect(n.ring.gain); n.ringOsc.start();
    n.lfo.frequency.value = 0.8; n.lfo.connect(n.lfoA); n.lfo.connect(n.lfoB); n.lfoA.connect(n.chA.delayTime); n.lfoB.connect(n.chB.delayTime); n.lfo.start();
    n.chA.delayTime.value = 0.013; n.chB.delayTime.value = 0.019; n.lfoA.gain.value = 0.0012; n.lfoB.gain.value = -0.0015;
    n.slap.delayTime.value = 0.11; n.plate.buffer = makeIR({ dur: 1.8, pre: 0.004, bright: 0.85 });
    // cadena principal
    n.input.connect(n.dry); n.dry.connect(n.sum);
    n.input.connect(n.hp); n.hp.connect(n.comp); n.comp.connect(n.f1); n.f1.connect(n.f2); n.f2.connect(n.f3); n.f3.connect(n.sat); n.sat.connect(n.lo); n.lo.connect(n.band); n.band.connect(n.airF);
    n.airF.connect(n.ring); n.ring.connect(n.crush); n.crush.connect(n.main);
    n.airF.connect(ps.node); ps.node.connect(n.harmG); n.harmG.connect(n.main);
    n.main.connect(n.wet); n.main.connect(n.slap); n.slap.connect(n.slapG); n.slapG.connect(n.wet);
    n.main.connect(n.chA); n.main.connect(n.chB); n.chA.connect(n.chG); n.chB.connect(n.chG); n.chG.connect(n.wet);
    n.main.connect(n.plate); n.plate.connect(n.plateG); n.plateG.connect(n.wet);
    n.wet.connect(n.sum); n.sum.connect(out);
    const p = { pitch: 0, formant: 0, character: 0.4, mix: 1, air: 0.35, mode: 'natural' };
    const M = {
      natural: { comp: [-20, 3], harm: 0.4, slap: 0, ch: 0, plate: 0.12, band: 18000, ring: 0, crush: 0, lo: 1 },
      modern: { comp: [-28, 8], harm: 0.55, slap: 0, ch: 0.35, plate: 0.18, band: 18000, ring: 0, crush: 0, lo: 0 },
      vintage: { comp: [-22, 5], harm: 0.25, slap: 0.35, ch: 0, plate: 0.05, band: 3600, ring: 0, crush: 0, lo: -6 },
      robotic: { comp: [-24, 6], harm: 0.5, slap: 0, ch: 0, plate: 0.1, band: 14000, ring: 1, crush: 1, lo: 0 },
      soul: { comp: [-20, 4], harm: 0.35, slap: 0.1, ch: 0.45, plate: 0.32, band: 12000, ring: 0, crush: 0, lo: 4 },
    };
    const update = () => {
      const m = M[p.mode], s = U.smooth, fs = Math.pow(2, p.formant / 12);
      n.comp.threshold.value = m.comp[0]; n.comp.ratio.value = m.comp[1];
      [700, 1220, 2600].forEach((f, i) => { s([n.f1, n.f2, n.f3][i].frequency, f * fs); s([n.f1, n.f2, n.f3][i].gain, 4 + p.character * 4); });
      n.sat.curve = U.curve((x) => Math.tanh(x * (1 + p.character * 5)) / Math.tanh(1 + p.character * 5));
      s(n.lo.gain, m.lo); s(n.band.frequency, m.band); s(n.airF.gain, p.air * 10);
      if (m.ring) { s(n.ring.gain, 0); s(n.ringDepth.gain, 1); s(n.ringOsc.frequency, 110 * Math.pow(2, p.pitch / 12)); ps.set(0); }
      else { s(n.ring.gain, 1); s(n.ringDepth.gain, 0); ps.set(p.pitch === 0 && p.mode === 'modern' ? 0.15 : p.pitch); }
      n.crush.curve = m.crush ? U.curve((x) => Math.round(x * 10) / 10, 2048) : null;
      s(n.harmG.gain, p.pitch === 0 && p.mode !== 'modern' ? 0 : m.harm); s(n.slapG.gain, m.slap); s(n.chG.gain, m.ch); s(n.plateG.gain, m.plate);
      s(n.dry.gain, 1 - p.mix); s(n.wet.gain, p.mix * 0.9);
    };
    update();
    return {
      input: n.input, kind: 'fx',
      set(id, v) { p[id] = v; update(); },
      setMode(m) { p.mode = m; update(); },
      info() { return { mode: p.mode, pitch: p.pitch, formant: p.formant }; },
      dispose() { ps.dispose(); try { n.ringOsc.stop(); n.lfo.stop(); } catch (e) {} Object.values(n).forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // 5 · ROUTER DE MODULACIÓN
  function link(spec, out) {
    const ctx = U.ctx;
    const n = { input: ctx.createGain(), filt: ctx.createBiquadFilter(), drive: ctx.createWaveShaper(), pan: ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(),
      pump: ctx.createGain(), dl: ctx.createDelay(2), fb: ctx.createGain(), dlG: ctx.createGain(), sum: ctx.createGain(),
      lfo: ctx.createOscillator(), lfoF: ctx.createGain(), lfoP: ctx.createGain() };
    n.input.connect(n.filt); n.filt.connect(n.drive); n.drive.connect(n.pan); n.pan.connect(n.pump); n.pump.connect(n.sum);
    n.pump.connect(n.dl); n.dl.connect(n.fb); n.fb.connect(n.dl); n.dl.connect(n.dlG); n.dlG.connect(n.sum); n.sum.connect(out);
    n.lfo.connect(n.lfoF); n.lfoF.connect(n.filt.frequency); if (n.pan.pan) { n.lfo.connect(n.lfoP); n.lfoP.connect(n.pan.pan); } n.lfo.start();
    const p = { amount: 0.5, rate: 0.6, depth: 0.6, mix: 0.35, shape: 0, mode: 'macros' };
    const beat = 60 / 92; let step = 0, timer = null, nextT = 0;
    const GATE = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
    function sched() {
      while (nextT < ctx.currentTime + 0.12) {
        const g = n.pump.gain, sixteenth = beat / 4;
        if (p.mode === 'sidechain' || p.mode === 'unlimited') {
          if (step % 4 === 0) { g.cancelScheduledValues(nextT); g.setValueAtTime(1 - p.depth * 0.92, nextT); g.linearRampToValueAtTime(1, nextT + beat * 0.85); }
        } else if (p.mode === 'midi gate') {
          g.cancelScheduledValues(nextT); g.setTargetAtTime(GATE[step % 16] ? 1 : 1 - p.depth, nextT, 0.006);
        }
        nextT += beat / 4; step++;
      }
    }
    const update = () => {
      const s = U.smooth, m = p.mode, a = p.amount;
      n.lfo.type = ['sine', 'triangle', 'sawtooth', 'square'][Math.round(p.shape)];
      s(n.lfo.frequency, p.rate);
      const macro = m === 'macros' || m === 'unlimited';
      n.filt.type = m === 'signal flow' ? 'bandpass' : 'lowpass';
      const base = macro ? 18000 * Math.pow(400 / 18000, a) : m === 'signal flow' ? 1400 : 16000;
      s(n.filt.frequency, base); s(n.filt.Q, macro ? 0.7 + a * 9 : m === 'signal flow' ? 2.5 : 0.7);
      s(n.lfoF.gain, (m === 'signal flow' || m === 'unlimited') ? base * 0.8 * p.depth : macro ? base * 0.3 * p.depth : 0);
      if (n.lfoP.gain) s(n.lfoP.gain, (m === 'signal flow' || m === 'unlimited') ? p.depth * 0.8 : 0);
      n.drive.curve = U.curve((x) => Math.tanh(x * (1 + (macro ? a * 4 : 0.5))) / Math.tanh(1 + (macro ? a * 4 : 0.5)));
      s(n.dl.delayTime, m === 'signal flow' ? beat * 0.75 : beat * 0.5); s(n.fb.gain, 0.35 + (macro ? a * 0.3 : 0.1)); s(n.dlG.gain, p.mix * (macro ? 0.4 + a * 0.6 : 1));
      if (m !== 'sidechain' && m !== 'midi gate' && m !== 'unlimited') { n.pump.gain.cancelScheduledValues(ctx.currentTime); s(n.pump.gain, 1); }
    };
    update(); nextT = ctx.currentTime + 0.05; timer = setInterval(sched, 25);
    return {
      input: n.input, kind: 'fx',
      set(id, v) { p[id] = v; update(); },
      setMode(m) { p.mode = m; update(); },
      info() { return { mode: p.mode, step: step % 16, gate: GATE, lfo: (ctx.currentTime * p.rate) % 1 }; },
      dispose() { clearInterval(timer); try { n.lfo.stop(); } catch (e) {} Object.values(n).forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // 6 · INSTRUMENTO REAL MUESTREADO
  function sampler(spec, out) {
    const ctx = U.ctx;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.4;
    const T = tail(out); tone.connect(T.input);
    const inst = new U.Sampler(spec.inst, tone);
    const p = { attack: 0.004, release: SAMPLES[spec.inst].sustain ? 0.6 : 1.2, tone: 14000, space: 0.28, echo: 0.12, mode: 'natural' };
    const held = new Map(), recent = [];
    const lo = Math.min(...SAMPLES[spec.inst].zones.map((z) => z.root)), hi = Math.max(...SAMPLES[spec.inst].zones.map((z) => z.root));
    const voicesFor = (m) => ({ natural: [[0, 1]], octaves: [[0, 1], [12, 0.45], [-12, 0.3]], chord: [[0, 1], [4, 0.6], [7, 0.6]], reverse: [[0, 1]], shimmer: [[0, 1], [12, 0.35], [19, 0.18]] }[p.mode]);
    function noteOn(m, vel = 0.85, t = ctx.currentTime, dur) {
      const vs = voicesFor(m).map(([d, g]) => inst.play(m + d, t, { vel, gain: g * 0.9, attack: p.attack, release: p.release, reverse: p.mode === 'reverse', dur }));
      if (dur == null) held.set(m, vs);
      recent.push({ m, t: performance.now() + (t - ctx.currentTime) * 1000, d: (dur || 0.4) * 1000 }); if (recent.length > 64) recent.shift();
    }
    function noteOff(m) { const vs = held.get(m); if (vs) { vs.forEach((v) => v && v.stop(ctx.currentTime)); held.delete(m); } }
    // demo: melodía de dominio público transpuesta a la tesitura del instrumento
    let clock = null;
    const song = SONGS[spec.song || 'furElise'];
    const notes = song.notes.map((n) => n[1]); const mid = (Math.min(...notes) + Math.max(...notes)) / 2;
    const shift = Math.round(((lo + hi) / 2 - mid) / 12) * 12;
    const update = () => { U.smooth(tone.frequency, p.tone); T.space(p.mode === 'shimmer' ? Math.max(0.7, p.space) : p.space); T.echo(p.echo); };
    update();
    return {
      kind: 'inst', ready: inst.ready, range: [lo, hi], noteOn, noteOff, song,
      set(id, v) { p[id] = v; update(); },
      setMode(m) { p.mode = m; update(); },
      get playing() { return !!clock; },
      start() {
        if (clock) return; clock = new U.Clock(song.step, song.len, (s, t, sd) => { for (const n of song.notes) if (n[0] === s) noteOn(n[1] + shift, n[3], t, n[2] * sd * 0.98); }, song.start); clock.start();
      },
      stop() { if (clock) clock.stop(); clock = null; },
      info() { return { mode: p.mode, recent, held: [...held.keys()], range: [lo, hi] }; },
      dispose() { this.stop(); held.forEach((vs) => vs.forEach((v) => v && v.stop(ctx.currentTime))); T.dispose(); try { tone.disconnect(); } catch (e) {} },
    };
  }

  // 7 · TEXTURA GRANULAR
  function granular(spec, out) {
    const ctx = U.ctx;
    const T = tail(out); const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(T.input);
    const def = SAMPLES[spec.inst];
    const file = def.zones ? def.zones[Math.floor(def.zones.length / 2)].f : def.f;
    const root = def.zones ? def.zones[Math.floor(def.zones.length / 2)].root : 60;
    let buf = null, off = 0;
    const ready = U.buffer(file).then((z) => { buf = z.b; off = z.off; });
    const p = { size: 0.14, density: 18, pitch: 0, spread: 0.5, space: 0.45, mode: 'cloud' };
    const clouds = new Map(); const parts = []; let scan = 0, demo = null, demoIdx = 0, timer = null, nextT = 0;
    const DRONE = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]];
    function grain(rateSemi, t) {
      if (!buf) return;
      const dur = buf.duration - off;
      let pos;
      if (p.mode === 'freeze') pos = 0.32 * dur + (Math.random() - 0.5) * 0.02;
      else if (p.mode === 'drift') pos = (scan % 1) * dur * 0.9 + Math.random() * 0.05;
      else pos = Math.random() * dur * 0.92;
      let semi = rateSemi + p.pitch + (Math.random() - 0.5) * 0.15;
      if (p.mode === 'scatter') semi += [0, 12, -12, 7][(Math.random() * 4) | 0];
      if (p.mode === 'shimmer') semi += Math.random() < 0.5 ? 12 : 0;
      const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = Math.pow(2, semi / 12);
      const g = ctx.createGain(), size = p.size * (0.7 + Math.random() * 0.6);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + size * 0.45); g.gain.linearRampToValueAtTime(0, t + size);
      let node = g;
      if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = (Math.random() * 2 - 1) * p.spread; g.connect(pn); node = pn; }
      s.connect(g); node.connect(bus); s.start(t, off + Math.max(0, pos)); s.stop(t + size + 0.02);
      s.onended = () => { try { node.disconnect(); g.disconnect(); } catch (e) {} };
      parts.push({ x: pos / dur, y: semi, t: performance.now() + (t - ctx.currentTime) * 1000, life: size * 1000 }); if (parts.length > 160) parts.shift();
    }
    function sched() {
      const now = ctx.currentTime; scan += 0.002;
      while (nextT < now + 0.1) {
        const active = [...clouds.keys()];
        if (demo) active.push(...DRONE[demoIdx % 4]);
        const per = 1 / p.density;
        active.forEach((m) => { if (Math.random() < 0.9) grain(m - root, nextT + Math.random() * per); });
        nextT += per;
      }
    }
    const update = () => T.space(p.mode === 'shimmer' ? Math.max(0.75, p.space) : p.space);
    update(); nextT = ctx.currentTime + 0.05; timer = setInterval(sched, 20);
    let demoTimer = null;
    return {
      kind: 'inst', ready, noteOn(m) { clouds.set(m, 1); }, noteOff(m) { clouds.delete(m); },
      set(id, v) { p[id] = v; update(); }, setMode(m) { p.mode = m; update(); },
      get playing() { return !!demo; },
      start() { demo = true; demoIdx = 0; demoTimer = setInterval(() => demoIdx++, 7000); },
      stop() { demo = false; clearInterval(demoTimer); },
      info() { return { mode: p.mode, parts }; },
      dispose() { clearInterval(timer); clearInterval(demoTimer); T.dispose(); try { bus.disconnect(); } catch (e) {} },
    };
  }

  // 8 · CAJA DE RITMOS (kits de percusión real)
  const GROOVES = {
    'boom bap': { bpm: 90, swing: 0.14, v: [[0, 7, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [14], [11], [6], [15], []] },
    '2-step': { bpm: 132, swing: 0.24, v: [[0, 10], [4, 12], [0, 2, 3, 6, 8, 10, 11, 14], [7], [5, 13], [2], [9], [0]] },
    breakbeat: { bpm: 124, swing: 0.06, v: [[0, 2, 10, 11], [4, 7, 12, 15], [0, 2, 4, 6, 8, 10, 12, 14], [6], [3], [9, 13], [14], [0]] },
    dembow: { bpm: 96, swing: 0.02, v: [[0, 4, 8, 12], [3, 6, 11, 14], [2, 6, 10, 14], [15], [0, 8], [5, 13], [10], []] },
    'idm glitch': { bpm: 112, swing: 0.0, v: [[0, 3, 9, 13], [4, 11], [0, 1, 2, 4, 6, 7, 8, 10, 12, 13, 14, 15], [5], [2, 14], [7], [10, 11], [8]] },
  };
  function drums(spec, out) {
    const ctx = U.ctx;
    const crush = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), room = ctx.createConvolver(), roomG = ctx.createGain(), bus = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 20000; comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.006;
    room.buffer = makeIR({ dur: 0.8, pre: 0.004, bright: 0.6, early: 10 }); roomG.gain.value = 0.12;
    bus.connect(crush); crush.connect(lp); lp.connect(comp); comp.connect(out); comp.connect(room); room.connect(roomG); roomG.connect(out);
    const kit = spec.drumKit;
    const ready = U.loadKit(kit);
    const p = { tempo: 92, swing: 0.12, tune: 0, decay: 0.8, crush: 0, mode: (spec.groove || 'Boom bap').toLowerCase() };
    const G0 = GROOVES[p.mode]; p.tempo = G0.bpm; p.swing = G0.swing;
    const hits = new Array(8).fill(0); let step = 0, clock = null;
    const GAIN = [1, 0.9, 0.42, 0.42, 0.6, 0.6, 0.55, 0.5];
    function hit(i, t = ctx.currentTime + 0.005, vel = 1) {
      const key = kit[i]; const rate = Math.pow(2, p.tune / 12) * (i === 0 ? 1.15 : 1);
      const long = /crash|gong|ride|timpani|ratchet|sleigh|vibraslap/.test(key);
      U.hit(key, t, bus, { gain: GAIN[i] * vel, rate, decay: long ? 0.6 + p.decay * 2 : 0.08 + p.decay * 0.6, reverse: p.mode === 'idm glitch' && i === 7 });
      if (i === 0 && /kick/.test(key)) U.sub(t, bus, 0.6 * vel, 110 * rate, 44 * rate, 0.22 + p.decay * 0.2);
      hits[i] = performance.now() + (t - ctx.currentTime) * 1000;
    }
    const update = () => { n_crush(); };
    function n_crush() {
      const bits = 16 - p.crush * 12; const q = Math.pow(2, bits - 1);
      crush.curve = p.crush > 0.01 ? U.curve((x) => Math.round(x * q) / q, 4096) : null;
      U.smooth(lp.frequency, 20000 - p.crush * 14000);
    }
    update();
    return {
      kind: 'drums', ready, kit, hit,
      set(id, v) { p[id] = v; if (id === 'crush') n_crush(); if (clock && id === 'tempo') clock.stepDur = 60 / p.tempo / 4; },
      setMode(m) { p.mode = m; const G = GROOVES[m]; p.tempo = G.bpm; p.swing = G.swing; if (clock) clock.stepDur = 60 / p.tempo / 4; return { tempo: p.tempo, swing: p.swing }; },
      get playing() { return !!clock; },
      start() {
        if (clock) return;
        clock = new U.Clock(60 / p.tempo / 4, 16, (s, t) => {
          step = s; const G = GROOVES[p.mode];
          G.v.forEach((steps, i) => { if (steps.includes(s)) hit(i, t, s % 4 === 0 ? 1 : 0.78); });
          if (p.mode === 'idm glitch' && Math.random() < 0.25) for (let r = 1; r < 4; r++) hit(2, t + r * (clock.stepDur / 4), 0.5);
        });
        clock.swingAt = (s) => (s % 2 === 0 ? 1 + p.swing : 1 - p.swing);
        clock.start();
      },
      stop() { if (clock) clock.stop(); clock = null; },
      info() { return { mode: p.mode, step, hits, grid: GROOVES[p.mode].v, playing: !!clock }; },
      dispose() { this.stop(); [crush, lp, comp, room, roomG, bus].forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  // 9 · SINTETIZADOR (osciladores, sin muestras)
  function synth(spec, out) {
    const ctx = U.ctx;
    const T = tail(out); const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; const crush = ctx.createWaveShaper(); const vca = ctx.createGain(); vca.gain.value = 0.5;
    filt.connect(crush); crush.connect(vca); vca.connect(T.input);
    const p = { cutoff: 2400, reso: 6, release: 0.5, detune: 18, space: 0.3, mode: (spec.synthMode || 'Supersaw').toLowerCase() };
    const voices = new Map(), recent = [];
    let pulse = null;
    function pulseWave() { if (pulse) return pulse; const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25); pulse = ctx.createPeriodicWave(re, im); return pulse; }
    function noteOn(m, vel = 0.8, t = ctx.currentTime, dur) {
      const f = 440 * Math.pow(2, (m - 69) / 12), g = ctx.createGain(), oscs = [];
      const mode = p.mode;
      const A = mode === 'pad' ? 0.6 : 0.005, peak = 0.22 * vel;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + A);
      if (mode === 'fm bell') g.gain.setTargetAtTime(peak * 0.25, t + A, 0.5);
      const vf = ctx.createBiquadFilter(); vf.type = 'lowpass'; vf.Q.value = p.reso;
      const env = mode === 'acid' ? 6 : mode === 'supersaw' ? 2 : 1.4;
      vf.frequency.setValueAtTime(Math.min(18000, p.cutoff * env), t); vf.frequency.setTargetAtTime(p.cutoff, t + 0.01, mode === 'acid' ? 0.09 : 0.25);
      if (mode === 'supersaw') for (let k = 0; k < 7; k++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (k - 3) * p.detune * 0.9; oscs.push(o); }
      else if (mode === 'acid') { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; oscs.push(o); }
      else if (mode === 'chip') { const o = ctx.createOscillator(); o.setPeriodicWave(pulseWave()); o.frequency.value = f; oscs.push(o); }
      else if (mode === 'pad') { for (const [type, d] of [['sawtooth', -p.detune], ['sawtooth', p.detune], ['triangle', 0]]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = d; oscs.push(o); } }
      else { // FM
        const c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(); c.frequency.value = f; mo.frequency.value = f * 2;
        mg.gain.setValueAtTime(f * 2.2, t); mg.gain.setTargetAtTime(f * 0.22, t, 0.25); mo.connect(mg); mg.connect(c.frequency); mo.start(t); oscs.push(c); c._mod = mo;
      }
      const mix = ctx.createGain(); mix.gain.value = 1 / Math.sqrt(oscs.length);
      oscs.forEach((o) => { o.connect(mix); o.start(t); });
      mix.connect(vf); vf.connect(g); g.connect(filt);
      const v = { stop: (t2) => { g.gain.cancelScheduledValues(t2); g.gain.setTargetAtTime(0, t2, p.release / 4); oscs.forEach((o) => { o.stop(t2 + p.release * 1.6 + 0.05); if (o._mod) o._mod.stop(t2 + p.release * 1.6 + 0.05); }); } };
      if (dur != null) v.stop(t + dur); else { if (voices.has(m)) voices.get(m).stop(t); voices.set(m, v); }
      recent.push({ m, t: performance.now() + (t - ctx.currentTime) * 1000, d: (dur || 0.4) * 1000 }); if (recent.length > 64) recent.shift();
      oscs[0].onended = () => { try { g.disconnect(); } catch (e) {} };
    }
    function noteOff(m) { const v = voices.get(m); if (v) { v.stop(ctx.currentTime); voices.delete(m); } }
    const ACID = [[0, 36, 1], [2, 48, 1], [3, 36, 1], [5, 39, 1], [6, 36, 1], [8, 43, 1], [10, 36, 1], [11, 46, 1], [12, 48, 2], [14, 41, 1], [15, 36, 1]];
    const SONG = { supersaw: 'canon', 'fm bell': 'twinkle', chip: 'turkishMarch', pad: 'gymnopedie' };
    let clock = null;
    const update = () => {
      U.smooth(filt.frequency, p.mode === 'chip' ? 7000 : 20000); filt.Q.value = 0.5;
      crush.curve = p.mode === 'chip' ? U.curve((x) => Math.round(x * 8) / 8, 2048) : null;
      T.space(p.space); T.echo(p.mode === 'acid' ? 0.25 : 0.1);
    };
    update();
    return {
      kind: 'inst', ready: Promise.resolve(), noteOn, noteOff, range: [24, 96],
      set(id, v) { p[id] = v; update(); }, setMode(m) { p.mode = m; update(); if (clock) { this.stop(); this.start(); } },
      get playing() { return !!clock; },
      start() {
        if (clock) return;
        if (p.mode === 'acid') { clock = new U.Clock(60 / 128 / 4, 16, (s, t, sd) => { for (const n of ACID) if (n[0] === s) noteOn(n[1] + 12, s % 4 === 0 ? 1 : 0.7, t, n[2] * sd * 0.8); }); }
        else { const song = SONGS[SONG[p.mode]]; clock = new U.Clock(song.step, song.len, (s, t, sd) => { for (const n of song.notes) if (n[0] === s) noteOn(n[1], n[3], t, n[2] * sd * 0.95); }, song.start); }
        clock.start();
      },
      stop() { if (clock) clock.stop(); clock = null; },
      info() { return { mode: p.mode, recent, held: [...voices.keys()] }; },
      dispose() { this.stop(); voices.forEach((v) => v.stop(ctx.currentTime)); T.dispose(); [filt, crush, vca].forEach((x) => { try { x.disconnect(); } catch (e) {} }); },
    };
  }

  const MAKERS = { saturator, timewarp, space, voice, link, sampler, granular, drums, synth };
  // Crea motor + cadena final
  function create(spec) {
    const post = postChain();
    const core = MAKERS[spec.engine](spec, post.input);
    return Object.assign(core, { post, wave: (a) => post.wave(a), level: () => post.level(), spectrum: () => post.spectrum(),
      disposeAll() { core.dispose(); post.dispose(); } });
  }
  return { create, PARAMS, saturator, makeIR, GROOVES };
})();
