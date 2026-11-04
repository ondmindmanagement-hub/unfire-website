# Y2K ROBOTS · Google Play Data Safety evidence and review gate

Status **NOT A COMPLETED PLAY DATA SAFETY FORM** · 31 October 2026 · read-only review, no store account action, no personal user data read.

## Exact source-based indicators

Static scan of local authorized `FilmStudio/game/audio` web source (`audio/index.html`, `audio/maletin/**` and `audio/js/**`) found references to:
- `getUserMedia` in four source files: potential optional camera/microphone permissions;
- `Peer(` / `peerjs` in four source files each: browser-based peer connections/signaling that may involve participant identifiers and IP/network metadata;
- `localStorage` in six source files: on-device settings, potential progress and choices;
- `fetch(` in seven source files: potential third-party or game-host requests;
- Referenced external domains in the selected host/engine sample: `unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `www.googleapis.com`, `www.youtube.com`, `www.youtube-nocookie.com`. Presence does **not** prove every resource/feature is used on every platform.

Existing `audio/privacy.html` (public policy titled Y2K Robots: Island Adventure, last updated 27 October 2026) discusses local storage, optional PeerJS/WebRTC communication, optional camera/mic features, external videos/resources, support and player reports. **The statement of policy does not establish actual runtime data flow** or whether a wrapper and its web dependencies qualify for specific Play Console declarations.

## Required checks on the exact signed Android package

1. Trace every optional camera/microphone permission prompt and whether Android TWA browser permissions are requested, denied and respected. Core game must remain usable on denial where designed.
2. Prove what is sent by the real hosted TWA under no-account single-player, online play, audio/video and report/support workflows. Record endpoints/provider, type of data, purpose, retention, encryption, opt-out/deletion and whether transfer is direct device-to-peer or via a third-party server.
3. Confirm private chat/room codes, IP/session identifiers, support data, minors' access and user-generated content safety; do not categorically claim no personal data is collected while optional P2P and support functions may send it.
4. Review linked external services, scripts, fonts, analytics and age classification separately; do not assume the absence of the literal word `analytics` proves no tracking. Verify SDK contents and generated AndroidManifest permissions after the AAB is built.
5. Reconcile written privacy policy, app display name, package ID, support URL, actual signed Android build, Google Play Data Safety, data deletion and target audience declarations with the game/legal owners (#13/#140).
6. Use only authentic screenshots of actual Android behavior. Do not enable payments, ads, advertising IDs or external tracking to speed up review.

## Release decision

**BLOCK DATA SAFETY SUBMISSION** until a person responsible for legal/privacy and an Android release integrator verify the real behavior with network inspection and real Android device testing. This is a conservative source inventory, **not** a legal conclusion or claim that sensitive data is or is not transmitted.

No game scripts, permission flags, online features, customer account, connected service, privacy page, website or Play Console settings were modified. No user data, passwords or identities are included here.
