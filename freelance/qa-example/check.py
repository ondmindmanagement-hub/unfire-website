#!/usr/bin/env python3
"""Unfire self-site smoke test, standard library only, no credentials.

This example tests nine selected public website routes for HTTP status and
basic HTML metadata. It is NOT a WCAG or security audit. Each run is a new
observation; the public November 21 snapshot is not a live guarantee.

Usage: python3 check.py
"""
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json

BASE = "https://unfire.technology"
ROUTES = (
    "/", "/freelance/", "/pilot/", "/pilot/kit/", "/pilot/intake/",
    "/pilot/partners/", "/pilot/evidence/", "/research/", "/contact/",
)

class PageFacts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title_parts = []
        self.in_title = False
        self.h1_count = 0
        self.viewport = False
        self.canonical = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta" and attributes.get("name", "").lower() == "viewport":
            self.viewport = True
        elif tag == "link" and "canonical" in attributes.get("rel", "").lower().split():
            self.canonical = bool(attributes.get("href"))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)

def inspect(route):
    url = BASE + route
    req = Request(url, headers={"User-Agent": "Unfire-OwnSite-QA-Sample/1.0"})
    try:
        with urlopen(req, timeout=12) as response:
            status = response.status
            media_type = response.headers.get("Content-Type", "")
            content = response.read(250_000).decode("utf-8", "replace")
        parser = PageFacts()
        parser.feed(content)
        return {
            "route": route,
            "status": status,
            "html": "text/html" in media_type.lower(),
            "has_title": bool("".join(parser.title_parts).strip()),
            "h1_count": parser.h1_count,
            "has_viewport": parser.viewport,
            "has_canonical": parser.canonical,
        }
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        return {"route": route, "error": type(exc).__name__, "detail": str(exc)[:130]}

def is_pass(row):
    return (
        row.get("status") == 200
        and row.get("html") is True
        and row.get("has_title") is True
        and row.get("h1_count") == 1
        and row.get("has_viewport") is True
        and row.get("has_canonical") is True
    )

def main():
    results = [inspect(route) for route in ROUTES]
    print(json.dumps({
        "scope": "self-site basic HTTP and HTML metadata smoke only",
        "host": BASE,
        "passed": sum(is_pass(row) for row in results),
        "total": len(results),
        "results": results,
    }, indent=2, ensure_ascii=False))
    return 0 if all(is_pass(row) for row in results) else 1

if __name__ == "__main__":
    raise SystemExit(main())
