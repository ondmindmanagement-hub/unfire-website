/* Unfire Browser Sound Lab: offline-compatible Web Audio demo. No telemetry. */
(() => {
  "use strict";
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const keys = Array.from(document.querySelectorAll(".key[data-semitone]"));
  const status = document.getElementById("status");
  const wave = document.getElementById("wave");
  const octave = document.getElementById("octave");
  const volume = document.getElementById("volume");
  if (!status || !wave || !octave || !volume || keys.length !== 12) return;
  if (!AudioContextClass) {
    status.textContent = "Web Audio is unavailable in this browser.";
    keys.forEach(key => { key.disabled = true; });
    return;
  }
  let ctx = null, master = null;
  const active = new Map();
  const pending = new Set();
  const keyMap = "awsedftgyhuj";
  const noteAt = semitone => 12 * (Number(octave.value) + 1) + semitone;
  const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
  async function ready() {
    if (!ctx) {
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = Number(volume.value) / 100 * 0.18;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.knee.value = 15;
      limiter.ratio.value = 10;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      master.connect(limiter);
      limiter.connect(ctx.destination);
    }
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") throw new Error("Audio engine unavailable");
    status.textContent = "Audio enabled. Hold notes or try another waveform.";
  }
  function stop(source) {
    pending.delete(source);
    const voice = active.get(source);
    if (!voice || !ctx) return;
    active.delete(source);
    const now = ctx.currentTime;
    const end = Math.max(now, voice.start + 0.10);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.00001, end, 0.045);
    try { voice.osc.stop(end + 0.25); } catch (_) { /* already stopped */ }
    voice.osc.onended = () => { try { voice.osc.disconnect(); voice.gain.disconnect(); } catch (_) {} };
    voice.button.classList.remove("is-down");
  }
  async function start(source, button) {
    if (active.has(source) || pending.has(source) || !button) return;
    pending.add(source);
    try {
      await ready();
      if (!pending.has(source) || active.has(source)) return;
      pending.delete(source);
      const midi = noteAt(Number(button.dataset.semitone));
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = wave.value;
      osc.frequency.setValueAtTime(frequency(midi), now);
      envelope.gain.setValueAtTime(0.00001, now);
      envelope.gain.exponentialRampToValueAtTime(0.85, now + 0.018);
      osc.connect(envelope);
      envelope.connect(master);
      active.set(source, { osc, gain: envelope, start: now, button });
      button.classList.add("is-down");
      osc.start(now);
    } catch (_) {
      pending.delete(source);
      status.textContent = "Audio could not start. Try interacting with a key again or check browser audio permissions.";
    }
  }
  keys.forEach(button => {
    button.addEventListener("pointerdown", event => {
      if (!event.isPrimary && event.pointerType === "mouse") return;
      event.preventDefault();
      const source = "pointer:" + event.pointerId;
      if (button.setPointerCapture) { try { button.setPointerCapture(event.pointerId); } catch (_) {} }
      void start(source, button);
    });
    for (const kind of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(kind, event => stop("pointer:" + event.pointerId));
    }
    button.addEventListener("click", event => {
      // Keyboard activation of the focused button (Enter/Space).
      if (event.detail !== 0) return;
      const source = "click:" + button.dataset.semitone;
      void start(source, button).then(() => { window.setTimeout(() => stop(source), 320); });
    });
  });
  window.addEventListener("keydown", event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName)) return;
    const index = keyMap.indexOf(event.key.toLowerCase());
    if (index < 0) return;
    event.preventDefault();
    void start("keyboard:" + index, keys[index]);
  });
  window.addEventListener("keyup", event => {
    const index = keyMap.indexOf(event.key.toLowerCase());
    if (index >= 0) stop("keyboard:" + index);
  });
  volume.addEventListener("input", () => {
    if (master && ctx) master.gain.setTargetAtTime(Number(volume.value) / 100 * 0.18, ctx.currentTime, 0.015);
  });
  octave.addEventListener("change", () => { Array.from(active.keys()).forEach(stop); });
  window.addEventListener("blur", () => { Array.from(active.keys()).forEach(stop); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Array.from(active.keys()).forEach(stop);
  });
})();