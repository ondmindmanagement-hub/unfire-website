#!/usr/bin/env bash
# Copy original, attributed audio media into clean unsigned native staging ONLY.
set -euo pipefail
if [ "$#" -ne 1 ]; then echo "Usage: $0 <native-staging-site-dir>" >&2; exit 64; fi
STAGE="$1"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ ! -d "$STAGE/audio/maletin" ]; then echo "Not a native staging site: $STAGE" >&2; exit 65; fi
python3 - "$ROOT/audio/media/credits.json" "$ROOT/audio/media" <<'PY'
import json,sys
from pathlib import Path
a=json.loads(Path(sys.argv[1]).read_text())
for k in ('v_jelly','v_reef','v_steens','v_waves'):
    m=a.get(k,{})
    assert all(m.get(f) for f in ('lic','src','art')),f'{k}: missing attribution'
    assert (Path(sys.argv[2])/(k+'.mp4')).stat().st_size>1000, f'{k}: missing video'
print('Original video licensing manifest and files present')
PY
mkdir -p "$STAGE/audio/media"
find "$ROOT/audio/media" -maxdepth 1 -type f \( -name '*.mp4' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' -o -name 'credits.json' \) -exec cp -p {} "$STAGE/audio/media/" \;
cp -p "$ROOT/audio/media-credits.html" "$STAGE/audio/media-credits.html"
echo "Original attributed game media staged into $STAGE/audio/media"
