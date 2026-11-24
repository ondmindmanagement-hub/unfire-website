#!/usr/bin/env python3
"""The published Unfire global bar must be regenerated without cosmetic regressions."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("unfire_global_bar", ROOT / "scripts/apply-global-bar.py")
bar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bar)


class GlobalBarGenerationTests(unittest.TestCase):
    def test_all_published_targets_match_generator(self):
        pages = bar.targets()
        self.assertGreaterEqual(len(pages), 70)
        for rel in pages:
            with self.subTest(page=rel):
                content = (ROOT / rel).read_text(encoding="utf-8")
                self.assertEqual(content, bar.render(content, bar.route(rel), rel in bar.OFFSET_HEADER))
                self.assertEqual(content.count(bar.START), 1)
                self.assertEqual(content.count(bar.END), 1)
                self.assertEqual(content.count("data-unfire-global-bar>"), 1)

    def test_stale_css_does_not_duplicate_stylesheets(self):
        sample = '<!doctype html><html><head><link rel="stylesheet" href="/assets/css/unfire-global-bar-20261122.css?v=1" data-unfire-global-bar>\n</head><body><main>Hello</main></body></html>'
        once = bar.render(sample, "/about/")
        twice = bar.render(once, "/about/")
        self.assertEqual(once, twice)
        self.assertIn('unfire-global-bar-20261122.css?v=3', once)
        self.assertNotIn('unfire-global-bar-20261122.css?v=1', once)
        self.assertEqual(once.count('data-unfire-global-bar>'), 1)

    def test_published_brand_audio_link_and_accessible_current_item(self):
        html = bar.bar("/hyperwave-hardware/")
        self.assertIn('class="ugb-brand notranslate"', html)
        self.assertIn('src="/assets/logo/unfire-logo-white.png"', html)
        self.assertIn('href="/audio/" aria-current="true"', html)
        self.assertNotIn('href="/unfire-audio/"', html)
        self.assertEqual(html.count('aria-current="true"'), 2)

    def test_hyperwave_embedded_3d_does_not_show_site_bar(self):
        html = (ROOT / "hyperwave-hardware/index.html").read_text(encoding="utf-8")
        self.assertIn('html.embed #unfire-global-bar', html)
        self.assertIn('data-unfire-global-bar>', html)


if __name__ == "__main__":
    unittest.main()
