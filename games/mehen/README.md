# MEHEN · The Eternal Serpent
An original, experimental browser game by Unfire Games. All UI text is English.

## Play locally
Open `index.html` in a modern browser. The game itself has no build process and works offline against the AI or with two people sharing a device. For strict browser module loading (e.g. Safari file:// CORS), instead serve this folder with `python3 -m http.server 8080` and open `http://localhost:8080/`.

## Multiplayer prototype
Choose **ONLINE**, then **CREATE A ROOM**. Share the invite link or ten-character code. Your friend opens the same page, enters the code and chooses **JOIN**. The host controls the game state; the guest controls the Lapis side. If players open the standalone `file://` edition, **both must have a copy of the HTML game** and share the room code. A shareable invitation URL is only offered when the game is hosted on a public site. Player-to-player traffic uses WebRTC DataConnections via PeerJS 1.5.5 (MIT), loaded from the pinned jsDelivr CDN and using the publicly provided PeerJS Cloud signaling service. PeerJS is an optional external dependency; offline play works without it. No accounts, analytics or chat.

**Limitations:** This is a casual P2P prototype, not a secure competitive server. It has not been fully verified across distinct real networks, restrictive NATs, guest reconnection, or all mobile browsers. The signaling service can change or be unavailable. Host can see and control the entire game state. No persistent matchmaking, rankings or anti-cheat. Do not call this production multiplayer until tested and moved to an appropriate production signaling/relay setup.

## Original game rules · Modern interpretation
The exact rules of ancient Mehen are unknown. This **is not** a claim to recreate the original game.
- Gold moves first; each side controls 3 lions.
- Roll 1–4. Select one lion to advance that many spaces.
- A lion at the tail enters on the first roll. A lion must reach the heart by an exact roll.
- Landing on a rival lion resets it to the tail, except on sanctuaries.
- Own lions cannot share a non-finished space.
- First to bring 2 lions to the heart wins; if no legal moves exist, the turn passes.

## Development
`node --test tests/*.test.mjs`

No museum images, proprietary game artwork, font files, audio, trackers or third-party assets are distributed. The serpent board and UI are procedural SVG/CSS authored for this project.

## Archaeological references
- Fitzwilliam Museum, *Mehen Game Board* https://fitzmuseum.cam.ac.uk/explore-our-collection/highlights/EGA44641943
- British Museum, *game-board* EA66216 https://www.britishmuseum.org/collection/object/Y_EA66216

## Release gate
This folder is independent from Unfire Audio and the site host. Prototype branch must not be merged/published without static checks, engine tests, local 2-browser online smoke test, reconnection and device QA. See GitHub issue #276.
