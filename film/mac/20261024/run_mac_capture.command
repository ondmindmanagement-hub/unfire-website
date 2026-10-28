#!/bin/zsh
# Unfire FilmStudio - isolated, nonpublishing recording on the owner's Mac.
# Launch from Terminal with: zsh film/mac/20261024/run_mac_capture.command
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HOME/Desktop/Unfire/FilmStudio/CinemaReview_20261024"
GAME="$ROOT/game-readonly"
OUT="$ROOT/real-footage"
mkdir -p "$ROOT" "$OUT"
echo "UNFIRE / CINE: check tools and isolated game copy"
command -v git >/dev/null || { echo "Missing git"; exit 1; }
command -v node >/dev/null || { echo "Missing Node.js"; exit 1; }
command -v python3 >/dev/null || { echo "Missing python3"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Missing ffmpeg"; exit 1; }
test -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" || { echo "Install/open Google Chrome, hardware GPU required."; exit 1; }
if [[ ! -d "$GAME/.git" ]]; then
 git clone --depth=1 --single-branch --branch main \
  https://github.com/ondmindmanagement-hub/unfire-website.git "$GAME"
else
 # Only mutates this independent FilmStudio scratch checkout, never the active game.
 git -C "$GAME" diff --quiet || { echo "Isolated game copy has local changes. Refusing overwrite."; exit 1; }
 git -C "$GAME" fetch --depth=1 origin main
 git -C "$GAME" checkout --detach FETCH_HEAD
fi
echo "Game SHA: $(git -C "$GAME" rev-parse HEAD)"
cd "$ROOT"
if [[ ! -d node_modules/playwright ]]; then
 npm install --no-save --no-package-lock playwright@1.56.1
fi
echo "Recording real engine Cinema mode with a new Chrome profile."
NODE_PATH="$ROOT/node_modules" node "$HERE/record_cine_mac.cjs" "$GAME" "$OUT"
echo "Cinematic camera shots finished. Recording independent continuous robot gameplay."
NODE_PATH="$ROOT/node_modules" node "$HERE/record_gameplay_mac.cjs" "$GAME" "$OUT"
echo "Both real-game video sources captured to: $OUT"
echo "Files have NOT been published."
