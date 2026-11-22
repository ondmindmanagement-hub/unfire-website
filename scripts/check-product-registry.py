#!/usr/bin/env python3
"""Unfire product registry gate.

Fails (exit 1) on:
  TRUTH        unknown status; 'available' without a verified store link; stale store checks;
               claims_on_target text missing from the target page
  DEDUP        duplicate ids, names, aliases or primary URLs among products
  LINKS        internal url/evidence/edition/route paths that do not exist in the repo;
               internal hrefs in generated hubs that do not resolve
  CAPTURES     visuals missing on disk or retired in assets/products/source-provenance.json
  LEAKS        unlisted (listed=false) product names appearing in generated hubs
  BRAND        generated hubs not English (lang), legal-entity claims, external scripts,
               inline styles/scripts (CSP), browser storage
  SYNC         generated hubs out of date with the registry
Usage: python3 scripts/check-product-registry.py [--today YYYY-MM-DD]
"""
import datetime as dt, json, pathlib, re, subprocess, sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
import os
REG = pathlib.Path(os.environ.get("UNFIRE_REGISTRY", ROOT / "assets/data/unfire-products.json"))
PROV = ROOT / "assets/products/source-provenance.json"
HUBS = ["ai-systems/index.html", "unfire-audio/index.html"]
CATALOG = "apps/index.html"  # global directory (owned separately); checked, never generated
STORE_HOSTS = ("https://apps.apple.com/", "https://play.google.com/")
STORE_MAX_AGE_DAYS = 120
KINDS = {"app", "web-app", "extension", "game", "service", "research"}
PLATFORMS = {"mac", "iphone", "ipad", "android", "web"}
# Claims Unfire must not make about itself (README: not separately incorporated).
FORBIDDEN = [r"\bS\.L\.?\b", r"\bLtd\b", r"\bInc\.", r"\bGmbH\b", r"\bholding company\b",
             r"\bconglomerate\b", r"\bsubsidiar(y|ies)\b", r"\bcertified\b", r"\btestimonial",
             r"\btrusted by\b", r"\bcustomers worldwide\b"]

errors = []
def err(code, msg): errors.append(f"[{code}] {msg}")


def resolve(path):
    """Map a site path like /apps/power/ to a repo file; None if absent."""
    path = path.split("#")[0].split("?")[0]
    if not path.startswith("/"):
        return None
    p = ROOT / path.lstrip("/")
    for cand in ([p / "index.html"] if path.endswith("/") else [p, p / "index.html"]):
        if cand.is_file():
            return cand
    return None


def text_of(file):
    h = file.read_text(encoding="utf-8", errors="ignore")
    h = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", h)
    return " ".join(re.sub(r"<[^>]+>", " ", h).split()).replace("&amp;", "&")


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.hrefs = []; self.srcs = []; self.inline_style = 0; self.inline_script = 0; self.ext_script = []
        self._in_script = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "style" in a: self.inline_style += 1
        if tag == "style": self.inline_style += 1
        if tag == "a" and a.get("href"): self.hrefs.append(a["href"])
        if tag in ("img", "source") and a.get("src"): self.srcs.append(a["src"])
        if tag == "link" and a.get("href"): self.srcs.append(a["href"])
        if tag == "script":
            if a.get("src"):
                self.srcs.append(a["src"])
                if a["src"].startswith(("http:", "https:", "//")): self.ext_script.append(a["src"])
            else:
                self._in_script = True
    def handle_data(self, d):
        if self._in_script and d.strip(): self.inline_script += 1
    def handle_endtag(self, tag):
        if tag == "script": self._in_script = False


def main():
    today = dt.date.today()
    if "--today" in sys.argv:
        today = dt.date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])
    reg = json.loads(REG.read_text(encoding="utf-8"))
    statuses = reg["statuses"]
    fams = {f["id"]: f for f in reg["families"]}
    retired = {i["web_asset"] for i in json.loads(PROV.read_text())["images"] if i.get("retired_from_public_web")}

    for f in fams.values():
        if not resolve(f["hub"]): err("LINKS", f"family {f['id']}: hub {f['hub']} missing")

    seen_id, seen_name, seen_url = {}, {}, {}
    for p in reg["products"]:
        pid = p.get("id", "?")
        for k in ("id", "name", "family", "kind", "listed", "summary", "editions", "evidence"):
            if k not in p: err("SCHEMA", f"{pid}: missing '{k}'")
        if p.get("family") not in fams: err("SCHEMA", f"{pid}: unknown family {p.get('family')}")
        if p.get("kind") not in KINDS: err("SCHEMA", f"{pid}: unknown kind {p.get('kind')}")
        # DEDUP
        if pid in seen_id: err("DEDUP", f"duplicate id {pid}")
        seen_id[pid] = 1
        for nm in [p["name"]] + p.get("aliases", []):
            key = re.sub(r"[^a-z0-9]", "", nm.lower())
            if key in seen_name and seen_name[key] != pid:
                err("DEDUP", f"name/alias '{nm}' used by {seen_name[key]} and {pid}")
            seen_name[key] = pid
        if p.get("listed"):
            u = p.get("url")
            if not u: err("SCHEMA", f"{pid}: listed product needs url")
            elif u in seen_url: err("DEDUP", f"url {u} is primary for {seen_url[u]} and {pid}")
            else: seen_url[u] = pid
            if all(ed["status"] == "internal" for ed in p["editions"]):
                err("TRUTH", f"{pid}: listed but every edition is internal")
            if not p["evidence"]: err("TRUTH", f"{pid}: listed without evidence")
        # LINKS
        paths = [p.get("url")] + p.get("evidence", []) + p.get("routes", []) + [ed.get("url") for ed in p["editions"]]
        for path in filter(None, paths):
            if path.startswith("/") and not resolve(path):
                err("LINKS", f"{pid}: {path} does not exist in the repository")
        # TRUTH — editions
        for ed in p["editions"]:
            s = ed.get("status")
            if s not in statuses: err("TRUTH", f"{pid}/{ed.get('label')}: unknown status {s}")
            if s == "internal" and p.get("listed"): err("TRUTH", f"{pid}/{ed['label']}: internal edition on a listed product")
            for pl in ed.get("platforms", []):
                if pl not in PLATFORMS: err("SCHEMA", f"{pid}: unknown platform {pl}")
            st = ed.get("store")
            if s == "available":
                if not st: err("TRUTH", f"{pid}/{ed['label']}: 'available' requires a verified store entry")
            if st:
                if not st.get("url", "").startswith(STORE_HOSTS): err("TRUTH", f"{pid}: store url not an approved store host")
                try:
                    age = (today - dt.date.fromisoformat(st["verified_on"])).days
                    if age > STORE_MAX_AGE_DAYS: err("TRUTH", f"{pid}/{ed['label']}: store check is {age} days old — re-verify")
                    if age < 0: err("TRUTH", f"{pid}: verified_on is in the future")
                except Exception:
                    err("TRUTH", f"{pid}/{ed['label']}: store entry needs verified_on YYYY-MM-DD")
        # TRUTH — claims must appear on the target page
        tgt = resolve(p["url"]) if p.get("url") else None
        if tgt:
            body = text_of(tgt).lower()
            for c in p.get("claims_on_target", []):
                if c.lower() not in body: err("TRUTH", f"{pid}: claim '{c}' not found on {p['url']}")
        # CAPTURES
        v = p.get("visual")
        if v:
            f = resolve(v["src"])
            if not f: err("CAPTURES", f"{pid}: visual {v['src']} missing")
            if pathlib.Path(v["src"]).name in retired: err("CAPTURES", f"{pid}: visual {v['src']} is retired in source-provenance.json")
            if v.get("type") not in ("icon", "capture"): err("CAPTURES", f"{pid}: visual.type must be icon or capture")
            if not v.get("alt"): err("CAPTURES", f"{pid}: visual needs alt text")

    unlisted = [p for p in reg["products"] if not p["listed"]]
    for rel in HUBS:
        f = ROOT / rel
        if not f.exists(): err("SYNC", f"{rel} missing"); continue
        h = f.read_text(encoding="utf-8")
        if not h.startswith("<!doctype html>\n<html lang=\"en\">"): err("BRAND", f"{rel}: must be lang=en")
        if 'http-equiv="refresh"' in h: err("BRAND", f"{rel}: redirect left in hub")
        t = text_of(f)
        for pat in FORBIDDEN:
            if re.search(pat, t, re.I): err("BRAND", f"{rel}: forbidden claim /{pat}/")
        for p in unlisted:
            if re.search(r"\b" + re.escape(p["name"]) + r"\b", t, re.I):
                err("LEAKS", f"{rel}: unlisted product '{p['name']}' is visible")
        if re.search(r"localStorage|sessionStorage|document\.cookie", h): err("PRIVACY", f"{rel}: browser storage")
        L = Links(); L.feed(h)
        if L.inline_style: err("BRAND", f"{rel}: {L.inline_style} inline style(s) break the page CSP")
        if L.inline_script: err("BRAND", f"{rel}: inline script breaks the page CSP")
        if L.ext_script: err("SECURITY", f"{rel}: external scripts {L.ext_script}")
        for href in L.hrefs + L.srcs:
            if href.startswith(("mailto:", "#")) or href.startswith(STORE_HOSTS): continue
            if href.startswith("https://unfire.technology/"): href = href[len("https://unfire.technology"):]
            if href.startswith(("http:", "https:", "//")):
                err("LINKS", f"{rel}: unexpected external link {href}"); continue
            if not resolve(href): err("LINKS", f"{rel}: {href} does not resolve")
    # CATALOG — every product route linked from /apps/ must be a registered, listed product or edition,
    # and products the registry calls non-available must not be labelled "Available" in their /apps/ card.
    cat = ROOT / CATALOG
    if cat.exists():
        known = {}
        for p in reg["products"]:
            for u in [p.get("url")] + p.get("routes", []) + [ed.get("url") for ed in p["editions"]]:
                if u: known[u] = p
        ch = cat.read_text(encoding="utf-8", errors="ignore")
        L = Links(); L.feed(ch)
        site_paths = {h for h in L.hrefs if h.startswith("/") and h.count("/") >= 2
                      and not h.startswith(("/assets/", "/contact/", "/early-access/", "/terms", "/software-license", "/refunds", "/privacy"))}
        for h in sorted(site_paths):
            hp = h.split("#")[0]
            if hp not in known:
                err("CATALOG", f"{CATALOG} links {hp}, which is not in the product registry")
            elif not known[hp]["listed"]:
                err("LEAKS", f"{CATALOG} links unlisted product {known[hp]['name']}")
    # SYNC
    r = subprocess.run([sys.executable, str(ROOT / "scripts/build-ecosystem-pages.py"), "--check"], capture_output=True, text=True)
    if r.returncode: err("SYNC", (r.stdout + r.stderr).strip()[-600:])

    listed_n = sum(1 for p in reg["products"] if p["listed"])
    if errors:
        print(f"Product registry gate FAILED ({len(errors)} issues):"); print("\n".join("  " + x for x in errors)); sys.exit(1)
    print(f"Product registry gate passed: {len(reg['products'])} entries ({listed_n} listed, {len(unlisted)} tracked unlisted), {len(fams)} families, {len(HUBS)} hubs.")


if __name__ == "__main__":
    main()
