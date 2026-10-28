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
# Preserve every original nested path, including 18+ playable songs and credits.
# A partial top-level-only media copy caused the world/radio to go missing in WKWebView.
cp -Rp "$ROOT/audio/media/." "$STAGE/audio/media/"
cp -p "$ROOT/audio/media-credits.html" "$STAGE/audio/media-credits.html"
python3 - "$ROOT/audio/media" "$STAGE/audio/media" <<'PY'
from pathlib import Path
import sys
src, dst = (Path(p) for p in sys.argv[1:])
missing = [str(p.relative_to(src)) for p in src.rglob('*') if p.is_file() and not (dst / p.relative_to(src)).is_file()]
if missing: raise SystemExit('Missing native media after staging: '+', '.join(missing))
print('Native media staging verified:', sum(p.is_file() for p in src.rglob('*')), 'source files, none missing')
PY
echo "Original attributed game media staged into $STAGE/audio/media"
