#!/usr/bin/env python3
"""Prevent high-risk third-party trademark claims in public Unfire content.

Apple product/platform names are permitted for accurate compatibility references,
App Store links, and attribution. This guard does not ban those references.
"""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
tracked = subprocess.check_output(['git', '-C', str(ROOT), 'ls-files'], text=True).splitlines()
files = []
for relative in tracked:
    path = ROOT / relative
    if not path.is_file() or path.suffix.lower() not in {'.html', '.js', '.txt', '.md', '.json'}:
        continue
    if 'backup' in relative.lower():
        continue
    if path.stat().st_size > 4_000_000:
        continue
    files.append(path)

prohibited_copy = re.compile(
    r'(?i)\b(?:built\s+for\s+apple(?:\s+platforms)?|made\s+for\s+apple|'
    r'(?:developed|designed|created|powered)\s+by\s+apple|'
    r'apple[\s-]+(?:certified|approved|powered)|official\s+apple\s+partner)\b'
)
product_title = re.compile(
    r'(?i)\b(?:ARCHER(?:\s+Clipper)?|BOLT|Unfire\s+Control|'
    r'Pocket\s+Capture|Power\s+Energy\s+Prices)\s+for\s+'
    r'(?:Mac|MacBook(?:\s+(?:Air|Pro))?)\b'
)
errors = []
for path in files:
    relative = path.relative_to(ROOT)
    for lineno, line in enumerate(path.read_text(encoding='utf-8', errors='replace').splitlines(), 1):
        if prohibited_copy.search(line):
            errors.append(f'{relative}:{lineno}: prohibited endorsement/platform slogan')
        # Only app names / social title metadata; factual compatibility in body is allowed.
        if re.search(r'<title\b|og:title|<h1\b|class="name"', line, re.I) and product_title.search(line):
            errors.append(f'{relative}:{lineno}: Mac trademark in product-title context')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(files)} public text assets checked for high-risk trademark use.')
