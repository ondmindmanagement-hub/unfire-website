#!/usr/bin/env python3
"""Bring ARCHER for iPhone & iPad back onto the public pages in one step.

Use when the updated iPhone/iPad build is live: removes every
data-archer-mobile-pending marker, restores the parked catalogue items and the
original titles/meta/JSON-LD, and sets the registry edition public again.
Then run: build-ecosystem-pages.py, apply-global-bar.py, check-product-registry.py.
"""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ATTR = " data-archer-mobile-pending hidden"
STYLE = "<style data-archer-mobile-pending-style>[data-archer-mobile-pending]{display:none!important}</style>\n"
TEXT = json.loads((ROOT / "scripts/restore-archer-mobile.json").read_text(encoding="utf-8"))

for f in sorted(ROOT.glob("**/*.html")):
    s = f.read_text(encoding="utf-8")
    if "data-archer-mobile-pending" not in s:
        continue
    rel = f.relative_to(ROOT).as_posix()
    s = re.sub(r"<span data-archer-mobile-pending hidden>([\s\S]*?)<!--/archer-mobile-pending--></span>", r"\1", s)
    s = re.sub(r"/\* data-archer-mobile-pending \(restore when the iPhone/iPad release is ready\): ([\s\S]*?) \*/", r"\1", s)
    s = s.replace(STYLE, "").replace(ATTR, "")
    for old, new in TEXT.get(rel, []):
        if old == "@@LD@@":
            if new not in s:
                k = s.find("}}]</script>")
                s = s[:k + 2] + new + s[k + 2:]
        else:
            s = s.replace(old, new)
    f.write_text(s, encoding="utf-8")
    print("restored", rel)

reg = ROOT / "assets/data/unfire-products.json"
r = json.loads(reg.read_text(encoding="utf-8"))
for p in r["products"]:
    for ed in p["editions"]:
        if ed.get("public") is False and p["id"] == "archer":
            ed.pop("public"); ed.pop("note", None)
reg.write_text(json.dumps(r, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("registry: ARCHER iPhone & iPad edition public again")
