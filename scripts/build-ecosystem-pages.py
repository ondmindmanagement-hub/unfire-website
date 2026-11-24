#!/usr/bin/env python3
"""Generate Unfire ecosystem hub pages from assets/data/unfire-products.json.

Outputs (static, no build step needed at runtime):
  ai-systems/index.html    Unfire AI & Systems hub
  unfire-audio/index.html  Unfire Audio hub (replaces the old redirect; /audio/ is untouched)

Usage:
  python3 scripts/build-ecosystem-pages.py           write pages
  python3 scripts/build-ecosystem-pages.py --check   exit 1 if pages are out of date
Only listed=true products are rendered.
"""
import html, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REG = ROOT / "assets/data/unfire-products.json"
CSS = "/assets/css/unfire-ecosystem-20261122.css?v=2"
SITE = "https://unfire.technology"
EMAIL = "hello@unfire.technology"

NAV = [
    ("Products", "/apps/"),
    ("AI & Systems", "/ai-systems/"),
    ("Audio", "/unfire-audio/"),
    ("Games", "/games/"),
    ("For Business", "/enterprise/"),
    ("Company", "/about/"),
    ("Contact", "/contact/"),
]
FAM_VAR = {"ai-systems": "--f-ai", "apps-tools": "--f-apps", "audio": "--f-audio",
           "games": "--f-games", "research": "--f-research", "business": "--f-business"}
PLATFORM = {"mac": "Mac", "iphone": "iPhone", "ipad": "iPad", "android": "Android", "web": "Browser"}

e = lambda s: html.escape(str(s), quote=True)


def load():
    return json.loads(REG.read_text(encoding="utf-8"))


def head(title, desc, path, fam_color):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'; base-uri 'self'; form-action 'none'; object-src 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Unfire">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta name="theme-color" content="#0c1220">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="{CSS}">
</head>
<body data-generated="build-ecosystem-pages.py" data-fam="{e(fam_color)}">
<a class="ue-skip" href="#main">Skip to content</a>
"""


def header(path):
    cur = ' aria-current="page"'
    items = "".join(
        f'<li><a href="{href}"{cur if href == path else ""}>{e(label)}</a></li>'
        for label, href in NAV)
    return f"""<header class="ue-head"><div class="ue-wrap">
<a class="ue-brand" href="/" aria-label="Unfire home"><img src="/favicon.svg" alt="" width="26" height="26">UNFIRE</a>
<nav class="ue-nav" aria-label="Main"><ul>{items}</ul></nav>
<details class="ue-menu"><summary aria-label="Open menu">Menu</summary><nav aria-label="Main (compact)"><ul>{items}</ul></nav></details>
</div></header>
"""


def footer():
    links = [("About Unfire", "/about/"), ("Research", "/research/"), ("Public record", "/public-record/"),
             ("Media & press", "/press/"), ("Support", "/support/"), ("Contact", "/contact/"),
             ("Privacy", "/privacy.html"), ("Cookies", "/cookies.html"), ("Legal", "/legal.html")]
    li = "".join(f'<li><a href="{h}">{e(t)}</a></li>' for t, h in links)
    return f"""<footer class="ue-foot"><div class="ue-wrap">
<div><p><strong>UNFIRE</strong> — One identity. Many possibilities. Built to work.</p>
<p>Unfire is an independent, founder-led technology initiative based in Spain. It is not a separately incorporated company. Product families are an organisational structure, not separate legal entities.</p>
<p>Write to <a href="mailto:{EMAIL}">{EMAIL}</a>. Email only — no calls or meetings required.</p></div>
<ul>{li}</ul>
</div></footer>
</body>
</html>
"""


def spectrum(families, current=None):
    out = []
    for i, f in enumerate(families):
        cur = ' aria-current="page"' if f["hub"] == current else ""
        out.append(f'<li data-fam="{f["id"]}"><a href="{f["hub"]}"{cur}>'
                   f'<strong>{e(f["short"])}</strong><span>{e(f["tagline"])}</span></a></li>')
    return '<ul class="ue-spectrum" aria-label="Unfire product families">' + "".join(out) + "</ul>"


def edition_html(ed, statuses, product=None):
    s = ed["status"]
    parts = [f'<span class="ue-ed-label">{e(ed["label"])}</span>',
             f'<span class="ue-status" data-s="{e(s)}">{e(statuses[s])}</span>']
    if ed.get("price"):
        parts.append(f'<span class="ue-note">{e(ed["price"])}</span>')
    if ed.get("store"):
        st = ed["store"]
        parts.append(f'<a href="{e(st["url"])}" rel="noopener" aria-label="{e(st["listing_name"])} on the {e(st["name"])}">'
                     f'View on the {e(st["name"])}</a>')
    elif ed.get("url"):
        verb = "Open" if s in ("web-lab", "beta") else "Details"
        parts.append(f'<a href="{e(ed["url"])}">{verb}</a>')
    elif product and s in ("web-lab", "beta") and product.get("url"):
        verb = "Play free" if product["kind"] == "game" else "Open in your browser"
        parts.append(f'<a href="{e(product["url"])}">{verb}</a>')
    return "<li>" + "".join(parts) + "</li>"


def row(p, fam, statuses):
    plats = sorted({PLATFORM[x] for ed in p["editions"] if ed.get("public", True) for x in ed["platforms"]})
    v = p.get("visual") or {}
    icon = p.get("icon") or (v.get("src") if v.get("type") == "icon" else None)
    if not icon:
        raise ValueError(f"Missing product icon: {p['id']}")
    mark = f'<img src="{e(icon)}" alt="" width="52" height="52" loading="lazy" decoding="async">'
    eds = "".join(edition_html(ed, statuses, p) for ed in p["editions"] if ed.get("public", True))
    plat_txt = f' <span class="ue-sr">Platforms: {e(", ".join(plats))}.</span>' if plats else ""
    return (f'<li class="ue-row" data-fam="{fam["id"]}">'
            f'<div class="ue-mark" aria-hidden="true">{mark}</div><div>'
            f'<h3><a href="{e(p["url"])}">{e(p["name"])}</a></h3>'
            f'<p>{e(p["summary"])}{plat_txt}</p>'
            f'<ul class="ue-editions" aria-label="{e(p["name"])} editions and status">{eds}</ul></div></li>')


def family_block(fam, products, statuses, heading_level="h2", show_hub=True, title=None, summary=None):
    rows = "".join(row(p, fam, statuses) for p in products)
    hub = (f'<a href="{fam["hub"]}">Explore {e(fam["short"])}</a>' if show_hub else "")
    return (f'<section class="ue-family" id="{fam["id"]}" data-fam="{fam["id"]}" aria-labelledby="h-{fam["id"]}">'
            f'<div class="ue-family-intro"><{heading_level} id="h-{fam["id"]}">{e(title or fam["name"])}</{heading_level}>'
            f'<p>{e(summary or fam["summary"])}</p>{hub}</div>'
            f'<ul class="ue-rows">{rows}</ul></section>')


def listed(reg, fam_id=None):
    return [p for p in reg["products"] if p["listed"] and (fam_id is None or p["family"] == fam_id)]


PRINCIPLES = [
    ("Truth", "No claim without evidence. Status is shown as it is."),
    ("Safety", "Explicit permissions, hard limits and a STOP that always works."),
    ("Privacy", "Collect the minimum. Secrets never leave where they belong."),
    ("Continuity", "Work is preserved and every state can be recovered."),
    ("Deduplication", "No repeated actions, no duplicate processes, no replays."),
    ("Performance", "Careful with CPU, memory, disk and network."),
    ("Beauty", "Clear, calm interfaces that are a pleasure to use."),
    ("Verification", "Real tests, regression checks and kept evidence."),
    ("Reversibility", "Isolated changes with a path back."),
    ("Autonomy", "Take the next safe step — within the limits a person set."),
]


def page_ai(reg):
    fam = next(f for f in reg["families"] if f["id"] == "ai-systems")
    prods = listed(reg, "ai-systems")
    princ = "".join(f"<li><div><strong>{e(a)}</strong><span>{e(b)}</span></div></li>" for a, b in PRINCIPLES)
    body = f"""<main id="main">
<section class="ue-hero"><div class="ue-wrap">
<p class="ue-kicker"><a href="/apps/">Products</a> / AI &amp; Systems</p>
<h1>{e(fam["tagline"])}</h1>
<p class="ue-lede">{e(fam["summary"])} An AI can suggest the next step. Only a person can approve it.</p>
<div class="ue-actions"><a class="ue-btn ue-btn--primary" href="/bolt/">See BOLT for Mac</a><a class="ue-btn" href="/pilot/">Scope a workflow pilot</a></div>
</div></section>
<div class="ue-wrap">{spectrum(reg["families"], "/ai-systems/")}</div>
<div class="ue-wrap">{family_block(fam, prods, reg["statuses"], show_hub=False, title="Products and services", summary="Each entry shows its real release status, edition by edition.")}</div>
<section class="ue-section ue-light" aria-labelledby="h-princ"><div class="ue-wrap">
<h2 id="h-princ">Ten engineering principles</h2>
<p>Every Unfire system is designed against the same ten checks. They describe how we build, not a certification.</p>
<ol class="ue-principles">{princ}</ol>
</div></section>
<section class="ue-section" aria-labelledby="h-conn"><div class="ue-wrap ue-callout">
<div><h2 id="h-conn">No hidden connections</h2>
<p>This website does not connect to your Mac, your terminal or any AI agent. Browser tools listed here run on your device. Any future remote connection will only be offered after authentication, permission and security testing — and it will say so clearly.</p></div>
<div class="ue-actions"><a class="ue-btn" href="/research/">Read the research</a></div>
</div></section>
</main>
"""
    return (head("AI & Systems — Unfire", "Unfire AI & Systems: BOLT for reviewing AI-proposed file changes, Unfire Autonomy workflow feasibility and Unfire Control — built with permissions, human review and STOP controls.", "/ai-systems/", "ai-systems")
            + header("/ai-systems/") + body + footer())


def page_audio(reg):
    fam = next(f for f in reg["families"] if f["id"] == "audio")
    prods = listed(reg, "audio")
    hw = next((p for p in prods if p["id"] == "hyperwave-2000"), None)
    media = ""
    if hw and hw.get("visual"):
        media = (f'<figure class="ue-hero-media"><img src="{e(hw["visual"]["src"])}" alt="{e(hw["visual"]["alt"])}" width="1200" height="686" decoding="async" fetchpriority="high">'
                 f'<figcaption>HYPERWAVE 2000, an interactive synthesizer you can play in the browser.</figcaption></figure>')
    body = f"""<main id="main">
<section class="ue-hero"><div class="ue-wrap">
<p class="ue-kicker ue-audio-brand"><img src="/audio/img/logo-unfire-256.webp?v=20261124butterfly" alt="" width="24" height="24" decoding="async"><span><a href="/apps/">Products</a> / Unfire Audio</span></p>
<h1>{e(fam["tagline"])}</h1>
<p class="ue-lede">{e(fam["summary"])} Native apps for Mac and Android, plus instruments that run directly in your browser.</p>
<div class="ue-actions"><a class="ue-btn ue-btn--primary" href="/archer/">Explore ARCHER</a><a class="ue-btn" href="/audio/">Enter the 3D world</a></div>
{media}
</div></section>
<div class="ue-wrap">{spectrum(reg["families"], "/unfire-audio/")}</div>
<div class="ue-wrap">{family_block(fam, prods, reg["statuses"], show_hub=False, title="Every audio product", summary="Native apps you can download today and instruments you can open right now in your browser.")}</div>
<section class="ue-section" aria-labelledby="h-world"><div class="ue-wrap ue-callout">
<div><h2 id="h-world">The interactive Unfire Audio world</h2>
<p>The original 3D experience — robots, flight, music and HYPERWAVE — still lives at its own address. It loads a full 3D scene, so a desktop browser gives the best result.</p></div>
<div class="ue-actions"><a class="ue-btn ue-btn--primary" href="/audio/">Open the 3D experience</a><a class="ue-btn" href="/games/">Unfire Games</a></div>
</div></section>
</main>
"""
    archer = next((p for p in prods if p["id"] == "archer"), None)
    names = []
    if archer:
        for ed in archer["editions"]:
            if ed.get("public", True):
                names += [PLATFORM[x] for x in ed["platforms"] if PLATFORM[x] not in names]
    archer_where = (", ".join(names[:-1]) + " and " + names[-1]) if len(names) > 1 else (names[0] if names else "Apple platforms")
    desc = f"Unfire Audio: ARCHER clipper for {archer_where}, Portable Synth Daw for Android, browser instruments and the interactive 3D Unfire Audio world."
    return (head("Unfire Audio — Audio software, instruments and experiences", desc, "/unfire-audio/", "audio")
            + header("/unfire-audio/") + body + footer())


PAGES = {"ai-systems/index.html": page_ai, "unfire-audio/index.html": page_audio}


def main():
    reg = load()
    check = "--check" in sys.argv
    stale = []
    for rel, fn in PAGES.items():
        out = fn(reg)
        p = ROOT / rel
        if check:
            if not p.exists() or p.read_text(encoding="utf-8") != out:
                stale.append(rel)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(out, encoding="utf-8")
            print("wrote", rel)
    if stale:
        print("Out of date (run scripts/build-ecosystem-pages.py):", *stale, sep="\n  ")
        sys.exit(1)


if __name__ == "__main__":
    main()
