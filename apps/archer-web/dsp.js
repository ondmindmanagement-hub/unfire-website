/* Archer Web Lab DSP — original browser-specific soft clipper; not a JUCE/desktop port. */
(function (root) {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function settings(input) {
    const gainDb = Number(input && input.gainDb);
    const thresholdDb = Number(input && input.thresholdDb);
    const mix = Number(input && input.mix);
    if (![gainDb, thresholdDb, mix].every(Number.isFinite)
        || gainDb < -12 || gainDb > 12 || thresholdDb < -24 || thresholdDb > 0
        || mix < 0 || mix > 1) throw new RangeError("Invalid audio settings");
    return { gainDb, thresholdDb, mix };
  }
  function factors(input) {
    const p = settings(input);
    const drive = Math.pow(10, -p.thresholdDb / 20);
    return { inputGain: Math.pow(10, p.gainDb / 20), drive, normalizer: Math.tanh(drive), mix: p.mix };
  }
  function softClip(input, d) {
    const sample = Number.isFinite(input) ? input : 0;
    return Math.tanh(clamp(sample * d.inputGain, -1, 1) * d.drive) / d.normalizer;
  }
  function processSample(input, params) {
    const d = factors(params);
    const dry = Number.isFinite(input) ? input : 0;
    return clamp(dry * (1 - d.mix) + softClip(dry, d) * d.mix, -1, 1);
  }
  function curve(params, points) {
    const d = factors(params), count = points || 4097;
    if (!Number.isInteger(count) || count < 3 || count > 65537) throw new RangeError("Invalid curve");
    const output = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const input = i / (count - 1) * 2 - 1;
      output[i] = Math.tanh(input * d.drive) / d.normalizer;
    }
    return output;
  }
  function encodeWav(audioBuffer, params) {
    const d = factors(params);
    if (!audioBuffer || !Number.isInteger(audioBuffer.numberOfChannels) ||
        audioBuffer.numberOfChannels < 1 || audioBuffer.numberOfChannels > 2)
      throw new Error("Only mono and stereo audio are supported");
    const channels = audioBuffer.numberOfChannels;
    const frames = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    if (!Number.isInteger(frames) || frames < 1 || frames > 12000000 ||
        !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000)
      throw new Error("Unsupported audio size or sample rate");
    const bytes = frames * channels * 2;
    if (bytes > 80000000) throw new Error("Audio exceeds browser export memory limit");
    const input = [];
    for (let c = 0; c < channels; c++) {
      const data = audioBuffer.getChannelData(c);
      if (!data || data.length !== frames) throw new Error("Invalid source audio");
      input.push(data);
    }
    const array = new ArrayBuffer(44 + bytes);
    const view = new DataView(array);
    const word = (at, value) => { for (let k = 0; k < 4; k++) view.setUint8(at + k, value.charCodeAt(k)); };
    word(0, "RIFF"); view.setUint32(4, 36 + bytes, true); word(8, "WAVE");
    word(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
    word(36, "data"); view.setUint32(40, bytes, true);
    let at = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const dry = Number.isFinite(input[c][i]) ? input[c][i] : 0;
        const wet = softClip(dry, d);
        const mixed = clamp(dry * (1 - d.mix) + wet * d.mix, -1, 1);
        view.setInt16(at, mixed < 0 ? Math.round(mixed * 32768) : Math.round(mixed * 32767), true);
        at += 2;
      }
    }
    return array;
  }
  const api = Object.freeze({ settings, factors, softClip, processSample, curve, encodeWav });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ArcherDSP = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
