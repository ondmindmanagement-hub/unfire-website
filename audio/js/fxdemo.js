/* UNFIRE AUDIO · demos en el navegador (Web Audio).
   Versiones reducidas de cada efecto para probar el carácter del sonido. No son los plugins completos. */
const DEMO = (() => {
  const TAU = Math.PI * 2;
  const lin = (v, a, b) => a + (b - a) * v;
  const lg = (v, a, b) => a * Math.pow(b / a, v);
  const db = (d) => Math.pow(10, d / 20);
  const curve = (f, n = 2048) => { const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = f((i / (n - 1)) * 2 - 1); return c; };
  let ctx = null;
  const ir = (sec, damp) => {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let y = 0, s = 7 + c * 13;
      for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; const r = s / 1073741823.5 - 1; y += (r - y) * (0.9 - damp * 0.8); d[i] = y * Math.pow(1 - i / n, 2.6); } }
    return b;
  };
  const sp = (fn, ch = 2) => { const p = ctx.createScriptProcessor(1024, ch, ch); p.onaudioprocess = fn; return p; };
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const bq = (type, f, q = 0.7, gain = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = gain; return n; };
  const set = (p, v) => p.setTargetAtTime(v, ctx.currentTime, 0.03);
  const mixer = (input, wet, out) => { const dry = g(1), w = g(0); input.connect(dry); dry.connect(out); wet.connect(w); w.connect(out); return (m) => { set(dry.gain, Math.cos(m * Math.PI / 2)); set(w.gain, Math.sin(m * Math.PI / 2)); }; };
  const lfo = (f, amt, ...targets) => { const o = ctx.createOscillator(), a = g(amt); o.frequency.value = f; o.connect(a); targets.forEach((t) => a.connect(t)); o.start(); return { o, a }; };

  // Cada efecto: tres mandos 0..1 en el mismo orden que el plugin
  const B = {
    clipper(i, o) { const pre = g(), sh = ctx.createWaveShaper(), post = g(); sh.oversample = '4x'; i.connect(pre); pre.connect(sh); sh.connect(post); post.connect(o);
      let c = 0.7; const mk = () => { sh.curve = curve((x) => Math.max(-c, Math.min(c, x))); };
      return [(v) => set(pre.gain, db(v * 24)), (v) => { c = lin(v, 0.08, 1); mk(); }, (v) => set(post.gain, db(lin(v, -18, 6)))]; },
    saturator(i, o) { const pre = g(), sh = ctx.createWaveShaper(), lp = bq('lowpass', 8000), wet = g(); sh.curve = curve((x) => Math.tanh(x * 2.4) / Math.tanh(2.4)); sh.oversample = '4x';
      i.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(wet); const mix = mixer(i, wet, o);
      return [(v) => set(pre.gain, db(v * 26)), (v) => set(lp.frequency, lg(v, 1200, 18000)), mix]; },
    delay(i, o) { const d = ctx.createDelay(2), fb = g(0.4), lp = bq('lowpass', 5000); i.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); const mix = mixer(i, lp, o);
      return [(v) => set(d.delayTime, lin(v, 0.06, 1)), (v) => set(fb.gain, v * 0.88), mix]; },
    reverb(i, o) { const cv = ctx.createConvolver(), lp = bq('lowpass', 9000), wet = g(); cv.buffer = ir(2.4, 0.4); i.connect(cv); cv.connect(lp); lp.connect(wet); const mix = mixer(i, wet, o);
      let t = null; return [(v) => { clearTimeout(t); t = setTimeout(() => { cv.buffer = ir(lin(v, 0.5, 6), 0.4); }, 150); }, (v) => set(lp.frequency, lg(1 - v, 1500, 16000)), mix]; },
    compressor(i, o) { const c = ctx.createDynamicsCompressor(), mk = g(); c.knee.value = 6; c.release.value = 0.18; i.connect(c); c.connect(mk); mk.connect(o);
      return [(v) => { const th = lin(v, 0, -48); set(c.threshold, th); set(mk.gain, db(-th * 0.45)); }, (v) => set(c.ratio, lin(v, 1, 20)), (v) => set(c.attack, lg(v, 0.001, 0.2))]; },
    eq(i, o) { const f = bq('peaking', 1000, 1, 0); i.connect(f); f.connect(o); return [(v) => set(f.gain, lin(v, -15, 15)), (v) => set(f.frequency, lg(v, 40, 16000)), (v) => set(f.Q, lg(v, 0.3, 12))]; },
    filter(i, o) { const f = bq('lowpass', 2000, 4); i.connect(f); const mix = mixer(i, f, o); return [(v) => set(f.frequency, lg(v, 80, 18000)), (v) => set(f.Q, lin(v, 0.5, 22)), mix]; },
    limiter(i, o) { const pre = g(), c = ctx.createDynamicsCompressor(), post = g(); c.ratio.value = 20; c.knee.value = 0; c.attack.value = 0.001; i.connect(pre); pre.connect(c); c.connect(post); post.connect(o);
      return [(v) => { set(c.threshold, lin(v, -24, 0)); set(post.gain, db(-lin(v, -24, 0) * 0.7)); }, (v) => set(c.release, lg(v, 0.01, 1)), (v) => set(pre.gain, db(lin(v, -6, 18)))]; },
    chorus(i, o) { const a = ctx.createDelay(0.1), b = ctx.createDelay(0.1), wet = g(0.7); a.delayTime.value = 0.018; b.delayTime.value = 0.026; i.connect(a); i.connect(b); a.connect(wet); b.connect(wet);
      const l1 = lfo(0.8, 0.003, a.delayTime), l2 = lfo(0.6, -0.004, b.delayTime); const mix = mixer(i, wet, o);
      return [(v) => { set(l1.o.frequency, lin(v, 0.1, 6)); set(l2.o.frequency, lin(v, 0.08, 4.6)); }, (v) => { set(l1.a.gain, v * 0.008); set(l2.a.gain, -v * 0.009); }, mix]; },
    flanger(i, o) { const d = ctx.createDelay(0.05), fb = g(0.7); d.delayTime.value = 0.004; i.connect(d); d.connect(fb); fb.connect(d); const l = lfo(0.3, 0.003, d.delayTime); const mix = mixer(i, d, o);
      return [(v) => set(l.o.frequency, lin(v, 0.05, 4)), (v) => set(l.a.gain, v * 0.0038), mix]; },
    phaser(i, o) { let n = i; const ap = []; for (let k = 0; k < 6; k++) { const f = bq('allpass', 800, 0.6); n.connect(f); n = f; ap.push(f); }
      const l = lfo(0.4, 600, ...ap.map((f) => f.frequency)); const mix = mixer(i, n, o);
      return [(v) => set(l.a.gain, v * 1400), (v) => set(l.o.frequency, lin(v, 0.05, 5)), mix]; },
    imager(i, o) { const s = ctx.createChannelSplitter(2), m = ctx.createChannelMerger(2), L = g(), R = g(), xL = g(0), xR = g(0), pan = ctx.createStereoPanner(), dl = ctx.createDelay(0.05); dl.delayTime.value = 0.012;
      i.connect(s); s.connect(L, 0); s.connect(R, 1); s.connect(dl, 1); dl.connect(xR); s.connect(xL, 0); L.connect(m, 0, 0); xR.connect(m, 0, 0); R.connect(m, 0, 1); xL.connect(m, 0, 1);
      m.connect(pan); pan.connect(o); const l = lfo(0.2, 0, pan.pan);
      return [(v) => { set(xR.gain, -v * 0.7); set(xL.gain, v * 0.35); }, (v) => { set(L.gain, 1 + v * 0.3); set(R.gain, 1 + v * 0.3); }, (v) => { set(l.a.gain, v * 0.8); set(l.o.frequency, 0.1 + v * 0.5); }]; },
    transient(i, o) { const c = ctx.createDynamicsCompressor(), inv = g(-1), tr = g(0), su = g(0); c.attack.value = 0.03; c.release.value = 0.12; c.ratio.value = 6; i.connect(o); i.connect(c); c.connect(inv);
      i.connect(tr); inv.connect(tr); tr.connect(o); c.connect(su); su.connect(o);
      return [(v) => set(tr.gain, lin(v, -1, 2.5)), (v) => set(su.gain, lin(v, -0.8, 1.6)), (v) => set(c.threshold, lin(v, -6, -48))]; },
    deesser(i, o) { const lo = bq('lowpass', 6000), hi = bq('highpass', 6000), c = ctx.createDynamicsCompressor(); c.attack.value = 0.002; c.release.value = 0.06; c.knee.value = 3;
      i.connect(lo); lo.connect(o); i.connect(hi); hi.connect(c); c.connect(o);
      return [(v) => { set(lo.frequency, lg(v, 3000, 10000)); set(hi.frequency, lg(v, 3000, 10000)); }, (v) => set(c.threshold, lin(v, -10, -50)), (v) => set(c.ratio, lin(v, 1, 20))]; },
    exciter(i, o) { const hp = bq('highpass', 2500), pre = g(), sh = ctx.createWaveShaper(), air = bq('highshelf', 9000, 0.7, 0), wet = g(); sh.curve = curve((x) => Math.tanh(x * 5)); i.connect(o);
      i.connect(hp); hp.connect(pre); pre.connect(sh); sh.connect(air); air.connect(wet); wet.connect(o);
      return [(v) => set(pre.gain, db(v * 24)), (v) => set(air.gain, v * 12), (v) => set(wet.gain, v * 0.8)]; },
    pitch(i, o) { const N = 8192, buf = [new Float32Array(N), new Float32Array(N)], W = Math.floor(ctx.sampleRate * 0.06); let w = 0, ph = 0, ratio = 1;
      const p = sp((e) => { const ins = [e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(e.inputBuffer.numberOfChannels - 1)], outs = [e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1)];
        for (let k = 0; k < ins[0].length; k++) { buf[0][w] = ins[0][k]; buf[1][w] = ins[1][k]; ph += (1 - ratio) / W; ph -= Math.floor(ph);
          for (let c = 0; c < 2; c++) { let s = 0; for (const off of [0, 0.5]) { const q = (ph + off) % 1, pos = w - 2 - q * W, pi = Math.floor(pos), f = pos - pi, a = ((pi % N) + N) % N; s += (buf[c][a] * (1 - f) + buf[c][(a + 1) % N] * f) * Math.sin(Math.PI * q); } outs[c][k] = s * 0.8; }
          w = (w + 1) % N; } });
      const tone = bq('highshelf', 3000, 0.7, 0); i.connect(p); p.connect(tone); const mix = mixer(i, tone, o);
      return [(v) => { ratio = Math.pow(2, Math.round(lin(v, -12, 12)) / 12); }, (v) => set(tone.gain, lin(v, -9, 9)), mix]; },
    granular(i, o) { const N = ctx.sampleRate * 3 | 0, buf = new Float32Array(N), grains = []; let w = 0, clock = 0, size = 0.12, dens = 12;
      const p = sp((e) => { const a = e.inputBuffer.getChannelData(0), L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1);
        for (let k = 0; k < a.length; k++) { buf[w] = a[k]; if (--clock <= 0) { clock = ctx.sampleRate / dens | 0; if (grains.length < 40) grains.push({ p: w - Math.random() * ctx.sampleRate * 1.5, len: size * ctx.sampleRate | 0, age: 0, r: [1, 1, 2, 0.5, 1.5][Math.random() * 5 | 0], pan: Math.random() }); }
          let l = 0, r = 0; for (let j = grains.length - 1; j >= 0; j--) { const G = grains[j], env = 0.5 - 0.5 * Math.cos(TAU * G.age / G.len), pos = ((G.p + G.age * G.r) % N + N) % N, s = buf[pos | 0] * env * 0.5; l += s * (1 - G.pan); r += s * G.pan; if (++G.age >= G.len) grains.splice(j, 1); }
          L[k] = l; R[k] = r; w = (w + 1) % N; } }, 1);
      i.connect(p); const mix = mixer(i, p, o);
      return [(v) => { size = lin(v, 0.02, 0.4); }, (v) => { dens = lin(v, 3, 60); }, mix]; },
    crusher(i, o) { let bits = 8, hold = 4, cnt = 0, last = [0, 0];
      const p = sp((e) => { for (let c = 0; c < 2; c++) { const a = e.inputBuffer.getChannelData(Math.min(c, e.inputBuffer.numberOfChannels - 1)), b = e.outputBuffer.getChannelData(c), q = Math.pow(2, bits - 1); let n = cnt;
        for (let k = 0; k < a.length; k++) { if (n++ % hold === 0) last[c] = Math.round(a[k] * q) / q; b[k] = last[c]; } if (c === 1) cnt = n; } });
      i.connect(p); const mix = mixer(i, p, o);
      return [(v) => { bits = Math.round(lin(v, 2, 16)); }, (v) => { hold = Math.max(1, Math.round(lg(1 - v, 1, 40))); }, mix]; },
    gate(i, o) { let th = 0.05, depth = 1, att = 0.002, env = 0, gain = 1;
      const p = sp((e) => { const ins = [e.inputBuffer.getChannelData(0), e.inputBuffer.getChannelData(e.inputBuffer.numberOfChannels - 1)], L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1), sr = ctx.sampleRate, ka = 1 - Math.exp(-1 / (att * sr)), kr = 1 - Math.exp(-1 / (0.08 * sr));
        for (let k = 0; k < L.length; k++) { const x = Math.max(Math.abs(ins[0][k]), Math.abs(ins[1][k])); env += (x - env) * (x > env ? 0.2 : 0.002); const tgt = env > th ? 1 : 1 - depth; gain += (tgt - gain) * (tgt > gain ? ka : kr); L[k] = ins[0][k] * gain; R[k] = ins[1][k] * gain; } });
      i.connect(p); p.connect(o);
      return [(v) => { th = db(lin(v, -60, -6)); }, (v) => { depth = v; }, (v) => { att = lg(v, 0.0005, 0.2); }]; },
    tape(i, o) { const pre = g(), sh = ctx.createWaveShaper(), d = ctx.createDelay(0.05), lp = bq('lowpass', 7000), hs = bq('lowshelf', 120, 0.7, 3); sh.curve = curve((x) => Math.atan(x * 2.5) / Math.atan(2.5)); d.delayTime.value = 0.008;
      i.connect(pre); pre.connect(sh); sh.connect(d); d.connect(lp); lp.connect(hs); hs.connect(o); const l = lfo(0.7, 0.0008, d.delayTime);
      return [(v) => set(pre.gain, db(v * 18)), (v) => { set(l.a.gain, v * 0.0028); set(l.o.frequency, 0.4 + v * 1.4); }, (v) => set(lp.frequency, lg(1 - v, 1800, 16000))]; },
    archer(i, o) { const pre = g(), sh = ctx.createWaveShaper(), cv = ctx.createConvolver(), wet = g(0), hs = bq('highshelf', 8000, 0.7, 0); sh.oversample = '4x'; cv.buffer = ir(1.6, 0.3);
      let t = 0.6; const mk = () => { sh.curve = curve((x) => Math.max(-t, Math.min(t, Math.tanh(x * 1.4)))); }; mk();
      i.connect(pre); pre.connect(sh); sh.connect(hs); hs.connect(o); hs.connect(cv); cv.connect(wet); wet.connect(o);
      return [(v) => set(pre.gain, db(v * 30)), (v) => { t = lin(v, 0.05, 1); mk(); }, (v) => { set(wet.gain, v * 0.5); set(hs.gain, v * 6); }]; },
  };

  // Fuentes de prueba: grabaciones reales CC0 (VCSL) y melodías de dominio público
  const GROOVE = { kick: [0, 7, 10, 16, 23, 26], snare: [4, 12, 20, 28], hat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28], open: [30], shaker: [1, 3, 5, 9, 11, 13, 17, 19, 21, 25, 27, 29] };
  let srcBus = null, an = null, clocks = [], fx = null, fxIn = null, fxOut = null, bypass = null, wetBus = null, timer = null, until = 0;
  const LIMIT = 45;
  async function startSource(kind) {
    clocks.forEach((c) => c.stop()); clocks = [];
    const t0 = 60 / 96 / 4;
    if (kind === 'drums' || kind === 'mix') {
      await UA.loadKit(['kick', 'snare', 'hat', 'hatopen', 'shaker']);
      const c = new UA.Clock(t0, 32, (s, t) => {
        if (GROOVE.kick.includes(s)) { UA.hit('kick', t, srcBus, { gain: 0.9 }); UA.sub(t, srcBus, 0.45); }
        if (GROOVE.snare.includes(s)) UA.hit('snare', t, srcBus, { gain: 0.85 });
        if (GROOVE.hat.includes(s)) UA.hit('hat', t, srcBus, { gain: s % 4 ? 0.22 : 0.36, decay: 0.1 });
        if (GROOVE.open.includes(s)) UA.hit('hatopen', t, srcBus, { gain: 0.3, decay: 0.3 });
        if (kind === 'drums' && GROOVE.shaker.includes(s)) UA.hit('shaker', t, srcBus, { gain: 0.2 });
      }); c.start(); clocks.push(c);
    }
    if (kind === 'piano' || kind === 'sax' || kind === 'mix') {
      const inst = await new UA.Sampler(kind === 'sax' ? 'sax' : 'piano', srcBus).ready;
      const song = SONGS[kind === 'sax' ? 'amazingGrace' : kind === 'mix' ? 'canon' : 'furElise'];
      const c = new UA.Clock(song.step, song.len, (s, t, sd) => { for (const n of song.notes) if (n[0] === s) inst.play(n[1], t, { vel: n[3], dur: n[2] * sd * 0.98, gain: kind === 'mix' ? 0.7 : 1 }); }, song.start);
      c.start(); clocks.push(c);
    }
  }
  function ensure() {
    ctx = UA.init();
    if (!srcBus) {
      srcBus = ctx.createGain(); wetBus = ctx.createGain(); bypass = ctx.createGain(); bypass.gain.value = 0;
      an = ctx.createAnalyser(); an.fftSize = 2048; wetBus.connect(an); bypass.connect(an); an.connect(UA.bus.master);
      srcBus.connect(bypass);
    }
    return ctx;
  }
  function load(type) {
    ensure();
    if (fxIn) { try { srcBus.disconnect(fxIn); } catch (e) {} fxIn.disconnect(); fxOut.disconnect(); }
    fxIn = ctx.createGain(); fxOut = ctx.createGain(); srcBus.connect(fxIn); fxOut.connect(wetBus);
    fx = B[type](fxIn, fxOut);
    return fx;
  }
  return {
    types: Object.keys(B),
    load,
    setParam(i, v) { fx && fx[i] && fx[i](v); },
    setBypass(on) { if (!wetBus) return; set(wetBus.gain, on ? 0 : 1); set(bypass.gain, on ? 1 : 0); },
    async play(kind, onEnd) { ensure(); await startSource(kind); until = ctx.currentTime + LIMIT; clearInterval(timer);
      timer = setInterval(() => { if (ctx.currentTime >= until) { this.stop(); onEnd && onEnd(true); } }, 250); },
    stop() { clocks.forEach((c) => c.stop()); clocks = []; clearInterval(timer); },
    remaining() { return ctx ? Math.max(0, until - ctx.currentTime) : LIMIT; },
    get analyser() { return an; },
    LIMIT,
  };
})();
