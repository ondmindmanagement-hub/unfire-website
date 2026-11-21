import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "audit_site_seo.py"
SPEC = importlib.util.spec_from_file_location("unfire_site_seo", MODULE)
assert SPEC and SPEC.loader
seo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(seo)

GOOD = """<!doctype html><html lang="en"><head>
<meta content="A truthful page description" name="description">
<meta content="index,follow" name="robots">
<link href="https://unfire.technology/demo/" rel="canonical">
<meta content="Demo product" property="og:title"><title>Demo product</title>
</head><body><main><h1>Demo product</h1></main></body></html>"""


class TestSeoAudit(unittest.TestCase):
    def test_order_independent_meta_and_self_canonical(self):
        page, warnings, critical = seo.inspect_html(GOOD, "https://unfire.technology/demo/")
        self.assertEqual(warnings, [])
        self.assertEqual(critical, [])
        self.assertEqual(page["h1_count"], 1)

    def test_title_outside_head_is_flagged(self):
        broken = GOOD.replace("<title>Demo product</title>", "").replace("<body>", "<body><title>Demo product</title>")
        page, warnings, _ = seo.inspect_html(broken, "https://unfire.technology/demo/")
        self.assertFalse(page["head_title_valid"])
        self.assertIn("missing_or_misplaced_head_title", warnings)

    def test_noindex_and_missing_page_are_critical(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "demo").mkdir()
            (root / "demo" / "index.html").write_text(GOOD.replace("index,follow", "noindex,nofollow"), encoding="utf-8")
            (root / "sitemap.xml").write_text(
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                '<url><loc>https://unfire.technology/demo/</loc></url>'
                '<url><loc>https://unfire.technology/missing/</loc></url>'
                '</urlset>', encoding="utf-8")
            result = seo.audit(root)
            self.assertEqual(result["sitemap_count"], 2)
            self.assertEqual(result["critical_count"], 2)

    def test_rejects_external_and_traversal_urls(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for u in [
                "https://example.org/demo/", 
                "https://unfire.technology/%2e%2e/secrets/",
                "http://unfire.technology/demo/",
                "https://unfire.technology/demo/?token=secret",
            ]:
                with self.assertRaises(ValueError):
                    seo.file_for_url(u, root)

    def test_duplicate_sitemap_urls_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text(GOOD.replace("/demo/", "/"), encoding="utf-8")
            (root / "sitemap.xml").write_text(
                '<urlset><url><loc>https://unfire.technology/</loc></url>'
                '<url><loc>https://unfire.technology/</loc></url></urlset>', encoding="utf-8")
            result = seo.audit(root)
            self.assertEqual(result["critical_count"], 1)
            self.assertEqual(result["unique_sitemap_count"], 1)


if __name__ == "__main__":
    unittest.main()
