#!/usr/bin/env python3
"""Audit the static gh-pages sitemap without changing or submitting any URL."""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://unfire.technology"
OUTPUT = ROOT / "artifacts" / "site-seo"


class PageHead(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.in_title = False
        self.title_in_head = False
        self.title_bits: list[str] = []
        self.h1_count = 0
        self.description = ""
        self.canonical = ""
        self.robots = ""
        self.og_title = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = {k.lower(): (v or "") for k, v in attrs}
        if tag == "head":
            self.in_head = True
        if tag == "title":
            self.in_title = True
            self.title_in_head = self.in_head
        if tag == "h1":
            self.h1_count += 1
        if not self.in_head:
            return
        if tag == "meta":
            name = values.get("name", "").lower()
            prop = values.get("property", "").lower()
            if name == "description":
                self.description = values.get("content", "")
            if name == "robots":
                self.robots = values.get("content", "")
            if prop == "og:title":
                self.og_title = values.get("content", "")
        if tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonical = values.get("href", "")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False
        if tag.lower() == "head":
            self.in_head = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_bits.append(data)

    @property
    def title(self) -> str:
        return " ".join(" ".join(self.title_bits).split())


def file_for_url(raw_url: str, root: Path = ROOT) -> Path:
    u = urlsplit(raw_url)
    if u.scheme != "https" or u.netloc != "unfire.technology" or u.query or u.fragment:
        raise ValueError(f"Invalid sitemap URL: {raw_url}")
    p = unquote(u.path)
    if not p.startswith("/") or "\\" in p or "//" in p:
        raise ValueError(f"Invalid path: {raw_url}")
    parts = Path(p.lstrip("/")).parts
    if ".." in parts or "." in parts:
        raise ValueError(f"Traversal path: {raw_url}")
    filename = "index.html" if p == "/" else (p.lstrip("/") + "index.html" if p.endswith("/") else p.lstrip("/"))
    location = (root / filename).resolve()
    if location != root.resolve() and root.resolve() not in location.parents:
        raise ValueError(f"Outside repository: {raw_url}")
    return location


def inspect_html(content: str, url: str) -> tuple[dict, list[str], list[str]]:
    p = PageHead()
    p.feed(content)
    warnings: list[str] = []
    critical: list[str] = []
    if not p.title or not p.title_in_head:
        warnings.append("missing_or_misplaced_head_title")
    if not p.description.strip():
        warnings.append("missing_meta_description")
    if p.canonical != url:
        warnings.append("missing_or_mismatched_canonical")
    if p.h1_count != 1:
        warnings.append(f"h1_count_{p.h1_count}")
    if not p.og_title:
        warnings.append("missing_og_title")
    if "noindex" in p.robots.lower():
        critical.append("noindex_url_in_public_sitemap")
    data = {
        "title": p.title,
        "head_title_valid": bool(p.title and p.title_in_head),
        "description": bool(p.description.strip()),
        "canonical": p.canonical,
        "h1_count": p.h1_count,
        "og_title": bool(p.og_title),
        "robots": p.robots,
    }
    return data, warnings, critical


def audit(root: Path = ROOT) -> dict:
    xml = ET.parse(root / "sitemap.xml")
    urls = [
        (node.text or "").strip()
        for node in xml.getroot().iter()
        if node.tag.rsplit("}", 1)[-1] == "loc"
    ]
    counts = Counter(urls)
    duplicates = sorted(u for u, n in counts.items() if n > 1)
    pages: list[dict] = []
    hard_errors: list[str] = [f"duplicate_sitemap_url:{u}" for u in duplicates]
    for u in urls:
        entry: dict = {"url": u, "warnings": [], "critical": []}
        try:
            target = file_for_url(u, root)
        except ValueError as e:
            entry["critical"].append(str(e))
            pages.append(entry)
            hard_errors.extend(f"{u}: {x}" for x in entry["critical"])
            continue
        if not target.is_file():
            entry["critical"].append("missing_published_file")
        else:
            content = target.read_text(encoding="utf-8", errors="replace")
            data, warnings, critical = inspect_html(content, u)
            entry.update(data)
            entry["warnings"] = warnings
            entry["critical"] = critical
        if entry["critical"]:
            hard_errors.extend(f"{u}: {x}" for x in entry["critical"])
        pages.append(entry)
    return {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "domain": SITE,
        "sitemap_count": len(urls),
        "unique_sitemap_count": len(counts),
        "critical_count": len(hard_errors),
        "critical_errors": hard_errors,
        "warnings_count": sum(len(p["warnings"]) for p in pages),
        "pages": pages,
    }


def main() -> int:
    report = audit()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "inventory.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Unfire sitemap integrity audit",
        "",
        f"Generated UTC: {report['generated_utc']}",
        f"Site: {report['domain']}",
        f"Sitemap entries: {report['sitemap_count']}, unique: {report['unique_sitemap_count']}",
        f"Critical: {report['critical_count']}; nonblocking SEO warnings: {report['warnings_count']}",
        "",
        "## Issues (critical must be fixed; legacy metadata warnings are review-only)",
        "",
    ]
    for row in report["pages"]:
        findings = row["critical"] + row["warnings"]
        if findings:
            lines.append(f"- {row['url']}: {', '.join(findings)}")
    if report["critical_errors"]:
        lines.append("\n## Critical errors\n")
        lines.extend(f"- {e}" for e in report["critical_errors"])
    (OUTPUT / "inventory.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Audited {report['sitemap_count']} URLs: {report['critical_count']} critical, {report['warnings_count']} metadata warnings.")
    print(f"Outputs: {OUTPUT / 'inventory.json'}; {OUTPUT / 'inventory.md'}")
    for e in report["critical_errors"]:
        print("CRITICAL:", e, file=sys.stderr)
    return 1 if report["critical_errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
