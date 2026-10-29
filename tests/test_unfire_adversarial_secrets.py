"""Synthetic negative/positive tests of the existing public credential gate.

No real credentials, network access, live targets or persistent test artifacts.
"""
import contextlib
import importlib.util
import io
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "check-public-security.py"
spec = importlib.util.spec_from_file_location("unfire_credential_guard_under_test", SOURCE)
security = importlib.util.module_from_spec(spec)
spec.loader.exec_module(security)


class AdversarialCredentialBoundaryTests(TestCase):
    def test_attacker_like_secret_paths_are_rejected(self):
        rejected = (
            ".env", ".env.production", ".env.staging.local",
            "nested/.env.anything", "keys/signing.p8", "keys/signing.p12",
            "keys/debug.jks", "keys/transfer.keystore", "keys/vault.kdbx",
            "credentials.json", "secrets/id_ed25519",
        )
        for name in rejected:
            with self.subTest(name=name):
                self.assertTrue(security.sensitive_file_path(PurePosixPath(name)))

    def test_harmless_templates_and_public_files_remain_allowed(self):
        allowed = (
            ".env.example", ".env.sample", ".env.template", ".env.dist",
            "docs/README.md", "assets/icon.webp", "config/example.json",
        )
        for name in allowed:
            with self.subTest(name=name):
                self.assertFalse(security.sensitive_file_path(PurePosixPath(name)))

    def test_defender_fails_closed_without_printing_synthetic_key_material(self):
        with TemporaryDirectory(prefix="unfire-synthetic-credential-") as directory:
            temp_root = Path(directory)
            (temp_root / ".well-known").mkdir()
            (temp_root / ".well-known" / "security.txt").write_text(
                "Contact: mailto:security@example.invalid\n"
                "Expires: 2035-01-01T00:00:00Z\n", encoding="utf-8"
            )
            # Assemble a recognizable marker at runtime; never store a real key.
            marker = "-----BEGIN " + "PRIVATE KEY-----"
            fake_value = "SYNTHETIC_NOT_A_KEY_AND_NOT_A_SECRET"
            (temp_root / "index.html").write_text(
                marker + "\n" + fake_value + "\n", encoding="utf-8"
            )
            standard, errors = io.StringIO(), io.StringIO()
            with patch.object(security, "ROOT", temp_root), patch.object(
                security, "tracked_files", return_value=["index.html"]
            ), contextlib.redirect_stdout(standard), contextlib.redirect_stderr(errors):
                result = security.inspect()
            combined = standard.getvalue() + errors.getvalue()
            self.assertEqual(result, 1, "A synthetic credential marker must block release")
            self.assertIn("possible private key", combined)
            self.assertNotIn(marker, combined, "Never print detected key material")
            self.assertNotIn(fake_value, combined, "Never print candidate secret content")

    def test_verifier_accepts_clean_isolated_fixture(self):
        with TemporaryDirectory(prefix="unfire-clean-fixture-") as directory:
            temp_root = Path(directory)
            (temp_root / ".well-known").mkdir()
            (temp_root / ".well-known" / "security.txt").write_text(
                "Contact: mailto:security@example.invalid\n"
                "Expires: 2035-01-01T00:00:00Z\n", encoding="utf-8"
            )
            (temp_root / "index.html").write_text(
                "<!doctype html><title>Safe example</title>", encoding="utf-8"
            )
            with patch.object(security, "ROOT", temp_root), patch.object(
                security, "tracked_files", return_value=["index.html"]
            ), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                result = security.inspect()
            self.assertEqual(result, 0, "Valid clean fixtures should not block a release")
