#!/usr/bin/env python3
"""Insert or refresh the shared Unfire global bar on every public page.

The bar is a static block between markers, placed right after the page's skip link
(or right after <body>), plus one stylesheet link before </head>. It never replaces a
page's own header: that header remains the product's local navigation.

Usage:
  python3 scripts/apply-global-bar.py           apply to all target pages
  python3 scripts/apply-global-bar.py --check   exit 1 if any target page is missing or stale
"""
import html, importlib.util, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = "/assets/css/unfire-global-bar-20261122.css?v=1"
START, END = "<!-- unfire-global-bar:start -->", "<!-- unfire-global-bar:end -->"
CSS_TAG = f'<link rel="stylesheet" href="{CSS}" data-unfire-global-bar>'

# Pages with their own copy of the global navigation, or out of scope.
EXCLUDE_EXACT = {"index.html", "ai-systems/index.html", "unfire-audio/index.html"}
EXCLUDE_PREFIX = ("audio/", "tests/", "docs/", "research/benchmarks/", "assets/", ".github/", "node_modules/")
# Pages whose own header is absolutely positioned at the top of the page: the bar is in flow,
# so their header is shifted below it instead of being hidden underneath.
OFFSET_HEADER = {"archer/index.html", "mutants/index.html"}
ROOT_PAGES = ["privacy.html", "cookies.html", "legal.html", "terms.html", "refunds.html",
              "software-license.html", "audio-shield-privacy.html", "gods-lamp-privacy.html",
              "portable-synth-privacy.html"]

spec = importlib.util.spec_from_file_location("eco", ROOT / "scripts/build-ecosystem-pages.py")
eco = importlib.util.module_from_spec(spec); spec.loader.exec_module(eco)
NAV = eco.NAV
REG = json.loads((ROOT / "assets/data/unfire-products.json").read_text(encoding="utf-8"))
FAMILY_NAV = {"ai-systems": "/ai-systems/", "apps-tools": "/apps/", "audio": "/unfire-audio/",
              "games": "/games/", "research": "/about/", "business": "/enterprise/"}
SECTION_PREFIX = [("/enterprise/", "/enterprise/"), ("/pilot/", "/enterprise/"), ("/freelance/", "/enterprise/"),
                  ("/audit/", "/enterprise/"), ("/education/", "/enterprise/"), ("/early-access/", "/enterprise/"),
                  ("/games/", "/games/"), ("/mutants/", "/games/"), ("/contact/", "/contact/"),
                  ("/support/", "/contact/"), ("/apps/", "/apps/")]


def targets():
    out = []
    for f in sorted(ROOT.glob("**/index.html")):
        rel = f.relative_to(ROOT).as_posix()
        if rel in EXCLUDE_EXACT or rel.startswith(EXCLUDE_PREFIX):
            continue
        out.append(rel)
    out += [p for p in ROOT_PAGES if (ROOT / p).exists()]
    keep = []
    for rel in out:
        h = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        if 'http-equiv="refresh"' in h.lower() or "<body" not in h.lower():
            continue
        keep.append(rel)
    return keep


def route(rel):
    if rel.endswith("index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def section(path):
    """Which global item is current for a page path."""
    best = None
    for p in REG["products"]:
        for u in [p.get("url")] + p.get("routes", []) + [ed.get("url") for ed in p["editions"]]:
            if u and path.startswith(u) and (best is None or len(u) > len(best[0])):
                best = (u, FAMILY_NAV[p["family"]])
    if best:
        return best[1]
    for pre, nav in SECTION_PREFIX:
        if path.startswith(pre):
            return nav
    return "/about/"   # company, press, public record, research, legal pages


def bar(path, offset=False):
    cur = section(path)
    def li(label, href):
        ac = ' aria-current="true"' if href == cur else ""
        return f'<li><a href="{href}"{ac}>{html.escape(label)}</a></li>'
    items = "".join(li(l, h) for l, h in NAV)
    return (f'{START}<div id="unfire-global-bar" data-section="{cur}"{" data-offset-header" if offset else ""}><div class="ugb-in">'
            f'<a class="ugb-brand" href="/" aria-label="Unfire home">UNFIRE</a>'
            f'<nav class="ugb-links" aria-label="Unfire">' f"<ul>{items}</ul></nav>"
            f'<details class="ugb-menu"><summary>Unfire menu</summary><nav aria-label="Unfire (compact)"><ul>{items}</ul></nav></details>'
            f"</div></div>{END}")


def allow_self_styles(h):
    """The bar's stylesheet is same-origin. Where a page CSP blocks same-origin styles,
    add 'self' to style-src (the narrowest change); nothing else in the policy changes."""
    def fix(m):
        pol = m.group(2)
        d = {k.split()[0]: k for k in [x.strip() for x in pol.split(";") if x.strip()]}
        if "style-src" in d:
            if "'self'" not in d["style-src"].split():
                pol = pol.replace(d["style-src"], d["style-src"].replace("style-src", "style-src 'self'", 1))
        elif "default-src" in d and "'self'" not in d["default-src"].split():
            pol = pol.rstrip("; ") + "; style-src 'self'"
        return m.group(1) + pol + m.group(3)
    return re.sub(r'(http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")', fix, h, flags=re.I)


def render(h, path, offset=False):
    h = allow_self_styles(h)
    h = re.sub(r"\n?" + re.escape(START) + r"[\s\S]*?" + re.escape(END) + r"\n?", "", h)
    h = h.replace(CSS_TAG + "\n", "").replace(CSS_TAG, "")
    lower = h.lower()
    i = lower.find("</head>")
    if i < 0:
        raise ValueError("no </head>")
    h = h[:i] + CSS_TAG + "\n" + h[i:]
    b = re.search(r"<body[^>]*>", h, re.I)
    pos = b.end()
    # Keep an existing skip link first so keyboard users still reach it first.
    m = re.match(r"\s*(<a[^>]*class=\"[^\"]*skip[^\"]*\"[^>]*>[\s\S]*?</a>)", h[pos:], re.I)
    if m:
        pos += m.end()
    return h[:pos] + "\n" + bar(path, offset) + "\n" + h[pos:]


def main():
    check = "--check" in sys.argv
    stale = []
    for rel in targets():
        f = ROOT / rel
        h = f.read_text(encoding="utf-8")
        out = render(h, route(rel), rel in OFFSET_HEADER)
        if out != h:
            if check:
                stale.append(rel)
            else:
                f.write_text(out, encoding="utf-8")
    if check and stale:
        print("Global bar missing or stale (run scripts/apply-global-bar.py):", *stale, sep="\n  ")
        sys.exit(1)
    print(("checked " if check else "applied to ") + f"{len(targets())} pages")


if __name__ == "__main__":
    main()
