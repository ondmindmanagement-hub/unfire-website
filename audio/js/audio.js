/* UNFIRE · núcleo de audio (Web Audio API).
   Muestras: VCSL (CC0). Síntesis y DSP: código propio. */
const UA = (() => {
  let ctx = null;
  const bus = {};
  const cache = new Map();
  const listeners = [];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    bus.master = ctx.createGain(); bus.master.gain.value = 0.85;
    bus.limiter = ctx.createDynamicsCompressor();
    bus.limiter.threshold.value = -3; bus.limiter.knee.value = 2; bus.limiter.ratio.value = 18;
    bus.limiter.attack.value = 0.002; bus.limiter.release.value = 0.15;
    bus.out = ctx.createAnalyser(); bus.out.fftSize = 2048; bus.out.smoothingTimeConstant = 0.72;
    bus.master.connect(bus.limiter); bus.limiter.connect(bus.out); bus.out.connect(ctx.destination);
    // Bus de fuente (lo que entra al efecto) con su propio analizador
    bus.src = ctx.createGain();
    bus.srcAn = ctx.createAnalyser(); bus.srcAn.fftSize = 2048;
    bus.src.connect(bus.srcAn);
    listeners.forEach((f) => f(ctx));
    return ctx;
  }
  const onInit = (f) => { listeners.push(f); if (ctx) f(ctx); };

  // ---------- Carga de muestras ----------
  function findOnset(b) {
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.0015) return Math.max(0, i - 24) / b.sampleRate;
    return 0;
  }
  function buffer(file) {
    if (!cache.has(file)) {
      cache.set(file, fetch('samples/' + file)
        .then((r) => { if (!r.ok) throw new Error('No se pudo cargar ' + file); return r.arrayBuffer(); })
        .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then((b) => ({ b, off: findOnset(b) })));
    }
    return cache.get(file);
  }
  function reversed(z) {
    if (z.rev) return z.rev;
    const b = z.b, r = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), d = r.getChannelData(c); for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i]; }
    z.rev = r; return r;
  }

  // ---------- Instrumento muestreado (multinota) ----------
  class Sampler {
    constructor(key, dest, opts = {}) {
      this.key = key; this.def = SAMPLES[key]; this.dest = dest;
      this.release = opts.release ?? (this.def.sustain ? 0.35 : 0.8);
      this.zones = [];
      this.ready = Promise.all((this.def.zones || [{ f: this.def.f, root: 60 }]).map(async (z) => ({ root: z.root, ...(await buffer(z.f)) })))
        .then((zs) => { this.zones = zs; return this; });
    }
    zoneFor(midi) { let z = this.zones[0]; for (const c of this.zones) if (Math.abs(c.root - midi) < Math.abs(z.root - midi)) z = c; return z; }
    play(midi, t, o = {}) {
      if (!this.zones.length) return null;
      const z = this.zoneFor(midi);
      const src = ctx.createBufferSource();
      src.buffer = o.reverse ? reversed(z) : z.b;
      src.playbackRate.value = Math.pow(2, (midi - z.root + (o.detune || 0) / 100) / 12) * (o.rate || 1);
      const g = ctx.createGain();
      const amp = (o.gain ?? 1) * (0.3 + 0.7 * (o.vel ?? 0.8));
      const atk = o.attack ?? 0.003;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + atk);
      src.connect(g); g.connect(o.dest || this.dest);
      src.start(t, o.reverse ? 0 : z.off);
      const rel = o.release ?? this.release;
      const v = { src, g, stop: (t2) => { try { g.gain.cancelScheduledValues(t2); g.gain.setTargetAtTime(0, t2, rel / 4); src.stop(t2 + rel * 1.6 + 0.05); } catch (e) {} } };
      if (o.dur != null) v.stop(t + o.dur);
      src.onended = () => { g.disconnect(); };
      return v;
    }
  }

  // Golpe suelto (batería y texturas)
  const kitCache = {};
  function hit(key, t, dest, o = {}) {
    const z = kitCache[key];
    if (!z) return;
    const src = ctx.createBufferSource(); src.buffer = o.reverse ? reversed(z) : z.b;
    src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.gain ?? 1;
    if (o.decay) { g.gain.setValueAtTime(o.gain ?? 1, t); g.gain.setTargetAtTime(0, t + o.decay * 0.3, o.decay / 3); }
    src.connect(g); g.connect(dest); src.start(t, o.reverse ? 0 : z.off);
    if (o.decay) src.stop(t + o.decay * 2 + 0.1);
    src.onended = () => g.disconnect();
  }
  async function loadKit(keys) {
    await Promise.all(keys.map(async (k) => { if (!kitCache[k]) kitCache[k] = await buffer(SAMPLES[k].f); }));
  }
  // Refuerzo de sub-grave sintetizado para el bombo
  function sub(t, dest, gain = 0.9, f0 = 120, f1 = 46, d = 0.32) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.02);
  }

  // ---------- Reloj con planificación anticipada ----------
  class Clock {
    constructor(stepDur, len, fn, start = 0) { this.stepDur = stepDur; this.len = len; this.fn = fn; this.pos = start; this.timer = null; }
    start() {
      this.next = ctx.currentTime + 0.06;
      const tick = () => {
        while (this.next < ctx.currentTime + 0.15) {
          this.fn(this.pos, this.next, this.stepDur);
          this.next += this.stepDur * (this.swingAt ? this.swingAt(this.pos) : 1);
          this.pos = (this.pos + 1) % this.len;
        }
      };
      tick(); this.timer = setInterval(tick, 25);
    }
    stop() { clearInterval(this.timer); this.timer = null; }
  }

  // ---------- Fuentes de demostración (grabaciones reales CC0) ----------
  const GROOVE = {
    kick:  [0, 10, 16, 23, 26],
    snare: [4, 12, 20, 28],
    ghost: [7, 15, 25, 31],
    hat:   [0, 2, 4, 6, 8, 10, 12, 16, 18, 20, 22, 24, 26, 28],
    open:  [14, 30],
  };
  const LATIN = { cajon: [0, 8, 11], congaslap: [4, 12, 14], conga: [6, 7, 15], shaker: [0, 2, 4, 6, 8, 10, 12, 14, 1, 5, 9, 13], cowbell: [0, 3, 6, 10, 12], claves: [0, 3, 6, 10, 12] };
  const SOURCES = {
    drums: { name: 'Batería acústica', detail: 'Bombo, caja y charles reales · 92 BPM', kit: ['kick', 'snare', 'hat', 'hatopen', 'tomh'] },
    latin: { name: 'Percusión latina', detail: 'Cajón, congas, cencerro y shaker', kit: ['cajon', 'congaslap', 'conga', 'shaker', 'cowbell', 'claves'], latin: true },
    piano: { name: 'Piano de cola', detail: 'Für Elise · Beethoven', inst: 'piano', song: 'furElise' },
    sax:   { name: 'Saxo tenor', detail: 'Amazing Grace · tradicional', inst: 'sax', song: 'amazingGrace' },
    vibes: { name: 'Vibráfono', detail: 'Gymnopédie n.º 1 · Satie', inst: 'vibes', song: 'gymnopedie' },
    harmonica: { name: 'Armónica', detail: 'Oda a la alegría · Beethoven', inst: 'harmonica', song: 'odeToJoy' },
    ocarina: { name: 'Ocarina', detail: 'La mañana · Grieg', inst: 'ocarina', song: 'morningMood' },
  };
  class Source {
    constructor(id) { this.id = id; this.def = SOURCES[id]; this.clock = null; this.voices = []; this.fileNode = null; }
    async start(dest) {
      this.stop();
      const d = this.def;
      if (d.latin) {
        await loadKit(d.kit);
        this.clock = new Clock(60 / 100 / 4, 16, (s, t) => {
          for (const [k, steps] of Object.entries(LATIN)) if (steps.includes(s)) hit(k, t, dest, { gain: k === 'shaker' ? 0.3 : k === 'cajon' ? 0.95 : 0.55 });
        });
        this.clock.start();
      } else if (d.kit) {
        await loadKit(d.kit);
        const sd = 60 / 92 / 4;
        this.clock = new Clock(sd, 32, (s, t) => {
          if (GROOVE.kick.includes(s)) { hit('kick', t, dest, { gain: 0.9, rate: 1.18, decay: 0.32 }); sub(t, dest, 0.55); }
          if (GROOVE.snare.includes(s)) hit('snare', t, dest, { gain: 0.95 });
          if (GROOVE.ghost.includes(s)) hit('snare', t, dest, { gain: 0.18, rate: 1.05 });
          if (GROOVE.hat.includes(s)) hit('hat', t, dest, { gain: s % 4 === 0 ? 0.42 : 0.26, decay: 0.12 });
          if (GROOVE.open.includes(s)) hit('hatopen', t, dest, { gain: 0.3, decay: 0.3 });
          if (s === 31) hit('tomh', t, dest, { gain: 0.5 });
        });
        this.clock.swingAt = (s) => (s % 2 === 0 ? 1.12 : 0.88);
        this.clock.start();
      } else if (d.inst) {
        const inst = await new Sampler(d.inst, dest).ready;
        const song = SONGS[d.song];
        const roots = inst.zones.map((z) => z.root), ns = song.notes.map((n) => n[1]);
        const shift = Math.round(((Math.min(...roots) + Math.max(...roots)) / 2 - (Math.min(...ns) + Math.max(...ns)) / 2) / 12) * 12;
        this.clock = new Clock(song.step, song.len, (s, t, sd) => {
          for (const n of song.notes) if (n[0] === s) inst.play(n[1] + (d.inst === 'piano' || d.inst === 'sax' ? 0 : shift), t, { vel: n[3], dur: n[2] * sd * 0.98 });
        }, song.start);
        this.clock.start();
      }
    }
    async startFile(file, dest) {
      this.stop();
      const ab = await file.arrayBuffer();
      const b = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(dest); s.start();
      this.fileNode = s;
    }
    stop() {
      if (this.clock) this.clock.stop();
      this.clock = null;
      if (this.fileNode) { try { this.fileNode.stop(); } catch (e) {} this.fileNode.disconnect(); this.fileNode = null; }
    }
  }

  // ---------- Utilidades DSP ----------
  function curve(fn, n = 4096) {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = fn(x); }
    return c;
  }
  const db = (v) => Math.pow(10, v / 20);
  const smooth = (param, v, tc = 0.03) => { param.setTargetAtTime(v, ctx.currentTime, tc); };

  return {
    init, onInit, get ctx() { return ctx; }, bus, Sampler, hit, loadKit, sub, Clock, Source, SOURCES, curve, db, smooth, buffer,
  };
})();
