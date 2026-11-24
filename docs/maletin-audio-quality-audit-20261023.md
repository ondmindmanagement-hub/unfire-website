# Unfire Audio — soundbank QA and non-destructive mastering notes

Audit date: 2026-10-23. Independent soundbank QA for the interactive maletín and HYPERWAVE. **No audio was generated with AI, replaced, re-encoded, deleted, or uploaded from local Splice.** No game engine, layout, renderer or UI was edited in this branch.

## Objective findings

- The existing bank includes **206 MP3 samples**, mapped across **95 sample definitions**. All 206 are present and referenced by the live `SAMPLES` manifest. No missing or unused MP3s were found.
- **206/206 decoded successfully** using FFmpeg. None had mean playback level below −40 dBFS (a screening threshold, not a proof of audibility).
- Two existing mono percussion assets approach 0 dBFS **sample peak**:
  - `st_kick.mp3`: sample peak 0.0 dBFS; FFmpeg EBU R128 reconstruction estimated **+1.0 dBTP**.
  - `st_snare.mp3`: sample peak 0.0 dBFS; reconstructed estimated **+0.4 dBTP**.
- Other samples have less than 0 dBFS digital sample peaks in this measurement. **No evidence that all others are artistically flawless**; missing listening checks remain.
- Original Web Audio output graph includes a limiter, low-frequency high-pass, compression, and EQ; this is not a substitute for asset-level headroom or a measured full-scene mix.

True peaks above 0 dBTP are an **intersample peak warning**, not conclusive proof of audible distortion. Playback attenuation before summing voices is recommended; preserve the original MP3 byte-for-byte.

## Non-destructive fix to apply by the designated game-audio integrator

After the PR that owns `audio/maletin/index.html` completes, review **only** the existing `UA.hit` envelope for the two `st_` transients:

- `st_kick`: playback trim approximately `0.79` (−2.0 dB).
- `st_snare`: playback trim approximately `0.85` (−1.4 dB).

Both numbers are starting recommendations to target around −1 dBTP **per solo sample**, before any game mix. Apply trim consistently to the initial `g.gain.value` and the `setValueAtTime` branch when `o.decay` is used, never only one. Recheck EBU true peak with the final playback path, the master bus, concurrent sounds and mobile output. Do **not** bake fresh lossy MP3 copies or alter original CC0 source assets. Ensure that a shared `hit` path respects explicit user-controlled gain and all drum variants.

For the musical director, validate the currently sounding chord against the audio clock rather than a *look-ahead* chord. Do not assume the musical key of user-supplied recordings or radio tracks with no vetted tonal metadata. Manual performance must silence competing automatic arpeggios, and long notes must always receive their paired note-off on focus loss or interruption.

## Required listening/functional sign-off (not completed by this audit)

Compare headphone and low-volume mobile speakers, with radio + HYPERWAVE + drum pads + case effects at realistic simultaneous activity. Listen for clicks at preset changes, harsh resonance or feedback, frequency masking, transient distortion, phase issues when inside vs outside the house, and voice ducking. Re-test Safari/iOS, Chrome/Android and desktop with interactions, sleep/resume, orientation changes and rapid retriggering. Measure integrated loudness and true peak of a **full recorded game performance** before calling the mix mastered.

## Reproduce

- `node tests/maletin-audio-assets.test.cjs`: fast manifest, source and master-chain integrity
- `python3 scripts/audit-maletin-audio.py`: fast manifest scan (Python standard library)
- `python3 scripts/audit-maletin-audio.py --decode --all`: decode all 206 existing MP3s and report level/true-peak warning flags (FFmpeg needed)

These commands are read-only. The CI workflow performs the full decode audit on audio-related PRs and can be re-run manually.
