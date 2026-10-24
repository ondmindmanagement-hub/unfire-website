#!/bin/zsh
# Use only after the complete 17-minute *real* video is exported and audited.
set -euo pipefail
film="${1:-}"
if [[ -z "$film" || ! -f "$film" ]]; then echo 'Se requiere un MP4 terminado'; exit 2; fi
if [[ "${film:l}" != *.mp4 ]]; then echo 'El archivo debe ser MP4'; exit 2; fi
sec=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "$film")
python3 - "$sec" <<'PYD'
import sys
length=float(sys.argv[1]);assert 1018<=length<=1022,f'La película no dura 17 minutos: {length:.2f}s'
PYD
osascript - "$film" <<'AS'
on run argv
  set clipPath to item 1 of argv
  tell application "Photos"
    activate
    import {POSIX file clipPath as alias} skip check duplicates yes
  end tell
end run
AS
open "$film"
