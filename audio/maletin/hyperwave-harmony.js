/* UNFIRE HYPERWAVE — conservative harmonic musical director.
 * Pure JS; no generated assets, AI models, sample uploads or timers.
 * The host RADIO step clock drives the optional phrase generator.
 */
(function (root, factory) {
  'use strict';
  const harmony = factory();
  if (typeof module === 'object' && module.exports) module.exports = harmony;
  if (root) root.UNFIRE_HARMONY = harmony;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODES = Object.freeze({
    mayor: [0, 2, 4, 5, 7, 9, 11],
    menor: [0, 2, 3, 5, 7, 8, 10],
    dorico: [0, 2, 3, 5, 7, 9, 10],
    penta: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10]
  });
  const pc = (n) => ((Math.round(n) % 12) + 12) % 12;
  const finiteMidi = (n) => Number.isFinite(n) && n >= 0 && n <= 127;
  function chordClasses(chord, count = 3) {
    if (!Array.isArray(chord)) return [];
    return [...new Set(chord.filter(finiteMidi).slice(0, count).map(pc))];
  }
  function nearest(midi, allowed, low = 36, high = 84, previous) {
    if (!Number.isFinite(midi) || !allowed.length) return null;
    const clamp = (x) => Math.min(high, Math.max(low, x));
    const target = clamp(midi);
    let best = null, score = Infinity;
    for (let n = low; n <= high; ++n) {
      if (!allowed.includes(pc(n))) continue;
      // Preserve the player's intended register. Break ties using voice-leading.
      const distance = Math.abs(n - target);
      const motion = Number.isFinite(previous) ? Math.abs(n - previous) * 0.008 : 0;
      const s = distance + motion + (n > target ? 0.00001 : 0);
      if (s < score) { score = s; best = n; }
    }
    return best;
  }
  function snap(midi, options = {}) {
    if (!Number.isFinite(midi)) return null;
    // Unknown songs (including user uploads) have no trusted key/BPM metadata.
    // Avoid an arbitrarily pitched melody that could clash with the master.
    if (options.externalPlaying && !options.generatedPlaying) return null;
    const chord = options.generatedPlaying ? chordClasses(options.chord) : [];
    if (chord.length) return nearest(midi, chord, 36, 84, options.previous);
    const mode = MODES[options.mode] ? options.mode : (options.fallbackMode || 'menor');
    const tonic = Number.isFinite(options.key) && options.key >= 0
      ? options.key : Number.isFinite(options.root) ? options.root : 48;
    const allowed = MODES[mode].map((d) => pc(tonic + d));
    return nearest(midi, allowed, 36, 84, options.previous);
  }
  // 4-8 bar call-and-response; constrained to root/third/fifth and generous rests.
  // No fixed wall-clock timer: RADIO invokes this on the exact scheduled 16th.
  const PHRASES = [
    [0, 4, 8, 12], [0, 6, 10, 14],
    [0, 3, 8, 12], [0, 8],
    [0, 4, 7, 10, 13], [0, 6, 12],
    [0, 2, 8, 10], [0, 8, 14]
  ];
  function phrase(bar, step, chord, options = {}) {
    if (!Number.isInteger(bar) || !Number.isInteger(step) || step < 0 || step > 15) return null;
    if (!options.generatedPlaying || options.externalPlaying || !Array.isArray(chord) || chord.length < 3) return null;
    if (options.heldKeys || options.mega || options.muted || options.section === 'intro' || options.section === 'break') return null;
    // Alternate a little breathing room with arpeggios, never force all 16 steps.
    const style = Number.isInteger(options.style) ? options.style : 0;
    const bars = ((bar + (style % 4)) % 8 + 8) % 8;
    const pattern = PHRASES[bars];
    const idx = pattern.indexOf(step);
    if (idx < 0) return null;
    const order = [0, 1, 2, 1, 0, 2, 1];
    const degree = order[(idx + Math.floor(bar / 2) + style) % order.length];
    const base = chord[degree];
    if (!finiteMidi(base)) return null;
    const reg = Number.isFinite(options.register) ? options.register : 67;
    const note = nearest(reg + ((idx % 3) - 1) * 3, [pc(base)], 60, 82);
    // Force source chord tone, no passing chromatics or out-of-key detuning.
    if (note === null) return null;
    const next = pattern[idx + 1];
    const durationSteps = Math.max(1, Math.min(4, (next == null ? 16 : next) - step));
    return {
      midi: note,
      velocity: (idx === 0 ? 0.43 : 0.32) * (options.section === 'drop' || options.section === 'drop2' ? 1 : 0.75),
      durationSteps
    };
  }
  return Object.freeze({ MODES, chordClasses, nearest, snap, phrase });
});
