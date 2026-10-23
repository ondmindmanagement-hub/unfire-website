# Unfire Audio — Mobile and Multiplayer QA (23 October 2026)

Shared team board: https://github.com/ondmindmanagement-hub/unfire-website/issues/13

## Verified against public release main 20f063e
- PR #15 passed structure, desktop integration and mobile Chrome emulation. Portrait/landscape rotation retains mission and touch controls.
- The actual 3D case and "ABRIR MALETÍN" button rendered in mobile Safari on an iPhone SE (2nd generation) **iOS 18.6 simulator**.
- Real PeerJS signaling connected two independent Chrome browser contexts: room create/join, two peers visible, both names synchronized, guest departure, guest rejoining the same room, and the host leaving with guest cleanup. No JS exceptions during that test.
- A separate worktree was used; no original captain's files were touched.

## Not yet verified
- End-to-end gameplay on any **physical** phone/tablet. Paired physical devices were discovered but unrelated active screens prevented safe game validation; no consent dialogs/settings were changed.
- Physical Android browsers; no Android hardware was connected.
- Long-session heat, memory, 3D frame pacing on real devices, mobile data handoffs, accessibility, full 12-chapter story and simultaneous multiplayer across actual phones.
- The online rooms depend on a live host and public PeerJS signaling; they are not permanent server-hosted rooms.

## Reproducing the online test
The test `tests/maletin-two-players-qa.cjs` uses two independent browser contexts and the actual external signaling provider. The optional manually dispatched workflow `Unfire multiplayer live QA` runs it in GitHub Actions using the repo's public/free plan. It is intentionally not mandatory for every release: an unrelated public signaling outage should not silently block gameplay fixes.

To run locally (with Playwright and Chromium available):

```sh
python3 -m http.server 8769 --bind 127.0.0.1 &
UNFIRE_MULTIPLAYER_URL=http://127.0.0.1:8769/audio/maletin/index.html node tests/maletin-two-players-qa.cjs
```

Always review main, the shared board and PR #6/#7 conflicts before working. No assertion of universal bug-free operation is warranted without physical testing.
