/* Archer Web Lab controller. All audio remains on the user's device. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const dsp = window.ArcherDSP;
  const choose = $("audio-file"), drop = $("dropzone"), play = $("play"), stop = $("stop");
  const exportBtn = $("export"), reset = $("reset");
  const wave = $("waveform"), filename = $("filename"), meta = $("meta");
  const state = $("state"), time = $("time"), progress = $("playhead");
  const controls = ["gain", "threshold", "mix"];
  const settings = { gainDb: 0, thresholdDb: -9, mix: 1 };
  let context = null, buffer = null, source = null, chain = null;
  let startedAt = 0, progressFrame = 0, exporting = false, sourceName = "audio", loadVersion = 0;

  function announce(message, kind = "info") {
    state.textContent = message;
    state.dataset.kind = kind;
  }
  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function refreshControls() {
    settings.gainDb = Number($("gain").value);
    settings.thresholdDb = Number($("threshold").value);
    settings.mix = Number($("mix").value) / 100;
    $("gain-out").textContent = (settings.gainDb > 0 ? "+" : "") + settings.gainDb + " dB";
    $("threshold-out").textContent = settings.thresholdDb + " dB";
    $("mix-out").textContent = Math.round(settings.mix * 100) + "%";
    if (chain) {
      chain.pre.gain.value = Math.pow(10, settings.gainDb / 20);
      chain.shaper.curve = dsp.curve(settings);
      chain.wet.gain.value = settings.mix;
      chain.dry.gain.value = 1 - settings.mix;
    }
  }
  controls.forEach(id => $(id).addEventListener("input", refreshControls));
  reset.addEventListener("click", () => {
    $("gain").value = 0; $("threshold").value = -9; $("mix").value = 100;
    refreshControls();
    announce("Controls reset. Your source file is unchanged.");
  });
  function setReady(ready) {
    play.disabled = !ready;
    exportBtn.disabled = !ready || exporting;
    stop.disabled = !source;
  }
  function disconnect(nodes) {
    if (!nodes) return;
    Object.values(nodes).forEach(node => { try { node.disconnect(); } catch (_) {} });
  }
  function stopPlayback() {
    const old = source; source = null;
    if (old) { old.onended = null; try { old.stop(); } catch (_) {} try { old.disconnect(); } catch (_) {} }
    disconnect(chain); chain = null;
    cancelAnimationFrame(progressFrame);
    progress.style.width = "0%";
    time.textContent = buffer ? "0:00 / " + formatTime(buffer.duration) : "0:00 / 0:00";
    play.textContent = "Play preview";
    setReady(!!buffer);
  }
  function tick() {
    if (!source || !buffer || !context) return;
    const elapsed = Math.min(buffer.duration, context.currentTime - startedAt);
    time.textContent = formatTime(elapsed) + " / " + formatTime(buffer.duration);
    progress.style.width = (100 * elapsed / buffer.duration) + "%";
    progressFrame = requestAnimationFrame(tick);
  }
  play.addEventListener("click", async () => {
    if (!buffer) return;
    stopPlayback();
    try {
      await context.resume();
      const playing = context.createBufferSource();
      const pre = context.createGain(), shaper = context.createWaveShaper();
      const wet = context.createGain(), dry = context.createGain();
      playing.buffer = buffer;
      chain = { pre, shaper, wet, dry };
      pre.gain.value = Math.pow(10, settings.gainDb / 20);
      shaper.curve = dsp.curve(settings);
      wet.gain.value = settings.mix; dry.gain.value = 1 - settings.mix;
      playing.connect(pre); pre.connect(shaper); shaper.connect(wet);
      wet.connect(context.destination); playing.connect(dry); dry.connect(context.destination);
      source = playing;
      playing.onended = () => {
        if (source !== playing) return;
        source = null; disconnect(chain); chain = null;
        cancelAnimationFrame(progressFrame);
        progress.style.width = "100%";
        time.textContent = formatTime(buffer.duration) + " / " + formatTime(buffer.duration);
        play.textContent = "Play again";
        setReady(true);
      };
      startedAt = context.currentTime;
      playing.start();
      play.textContent = "Restart preview";
      setReady(true); tick();
      announce("Preview playing. Adjust controls live.");
    } catch (error) {
      stopPlayback(); announce("Audio playback unavailable: " + error.message, "error");
    }
  });
  stop.addEventListener("click", () => {
    stopPlayback();
    announce("Playback stopped.");
  });
  function renderWave() {
    const rect = wave.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    wave.width = width; wave.height = height;
    const ctx = wave.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#75d9f7"); gradient.addColorStop(0.55, "#aa99ff"); gradient.addColorStop(1, "#d4c4ff");
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(194, 210, 235, .18)";
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    if (!buffer) return;
    const data = buffer.getChannelData(0), length = data.length;
    ctx.fillStyle = gradient;
    const columns = Math.min(width, 1200);
    for (let x = 0; x < columns; x++) {
      const from = Math.floor((x * length) / columns);
      const to = Math.max(from + 1, Math.floor(((x + 1) * length) / columns));
      const stride = Math.max(1, Math.floor((to - from) / 96));
      let max = 0;
      for (let i = from; i < to; i += stride) max = Math.max(max, Math.abs(data[i] || 0));
      const bar = Math.max(1, Math.min(1, max) * (height * 0.41));
      ctx.fillRect(Math.floor(x * width / columns), height / 2 - bar, Math.ceil(width / columns), bar * 2);
    }
  }
  window.addEventListener("resize", renderWave, { passive: true });
  async function loadFile(file) {
    if (!file) return;
    const version = ++loadVersion;
    if (exporting) { announce("Finish the current export before loading a new file.", "error"); return; }
    stopPlayback(); buffer = null; setReady(false);
    const extension = (file.name.split(".").pop() || "").toLowerCase();
    const supported = ["wav", "mp3", "aif", "aiff", "m4a", "ogg", "flac", "aac"];
    if ((!file.type.startsWith("audio/") && !supported.includes(extension)) || file.size > 30 * 1024 * 1024 || file.size === 0) {
      announce("Select a non-empty audio file no larger than 30 MB.", "error"); return;
    }
    announce("Decoding audio on this device…");
    filename.textContent = file.name;
    meta.textContent = "Analyzing audio…";
    try {
      context = context || new (window.AudioContext || window.webkitAudioContext)();
      const raw = await file.arrayBuffer();
      if (version !== loadVersion) return; // Ignore an outdated file selection.
      const decoded = await context.decodeAudioData(raw);
      if (version !== loadVersion) return;
      const maxPcm = decoded.length * decoded.numberOfChannels * 4;
      if (decoded.duration > 180 || decoded.numberOfChannels > 2 || decoded.sampleRate > 96000 ||
          maxPcm > 80000000 || decoded.length < 1)
        throw new Error("Use mono/stereo audio of up to 3 minutes (96 kHz maximum).");
      buffer = decoded; sourceName = file.name;
      meta.textContent = formatTime(buffer.duration) + " · " + (buffer.sampleRate / 1000).toFixed(1) +
        " kHz · " + (buffer.numberOfChannels === 1 ? "Mono" : "Stereo");
      time.textContent = "0:00 / " + formatTime(buffer.duration);
      setReady(true); renderWave();
      announce("Audio ready. Preview or export a processed WAV.", "success");
    } catch (error) {
      if (version !== loadVersion) return;
      buffer = null; meta.textContent = "No audio loaded";
      filename.textContent = "Choose an audio file";
      setReady(false); renderWave();
      announce("Could not load file. " + (error && error.message ? error.message : "Unsupported format."), "error");
    }
  }
  choose.addEventListener("change", () => loadFile(choose.files && choose.files[0]));
  for (const eventName of ["dragenter", "dragover"]) {
    drop.addEventListener(eventName, event => { event.preventDefault(); drop.classList.add("dragging"); });
  }
  for (const eventName of ["dragleave", "drop"]) {
    drop.addEventListener(eventName, event => { event.preventDefault(); drop.classList.remove("dragging"); });
  }
  drop.addEventListener("drop", event => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) loadFile(file);
  });
  exportBtn.addEventListener("click", () => {
    if (!buffer || exporting) return;
    exporting = true; setReady(true); announce("Rendering 16-bit WAV locally…");
    const sourceBuffer = buffer, params = { ...settings }, originalName = sourceName;
    setTimeout(() => {
      try {
        const wav = dsp.encodeWav(sourceBuffer, params);
        const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
        const a = document.createElement("a");
        const base = originalName.replace(/\.[^./]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 72) || "audio";
        a.href = url; a.download = base + "-archer-web.wav";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        announce("WAV export requested. Check your browser downloads.", "success");
      } catch (error) {
        announce("Export failed: " + error.message, "error");
      } finally {
        exporting = false; setReady(!!buffer);
      }
    }, 35);
  });
  if (!window.AudioContext && !window.webkitAudioContext) {
    announce("This browser does not support Web Audio.", "error"); choose.disabled = true;
  } else announce("Ready. Files stay on this device.");
  refreshControls(); setReady(false); renderWave();
})();
