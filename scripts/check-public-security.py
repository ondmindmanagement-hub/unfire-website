#!/usr/bin/env python3
"""Static, dependency-free gate for accidentally published credentials.

It is intentionally conservative: only high-confidence credential signatures and
obviously secret file paths fail CI. Warnings identify further manual work without
blocking unrelated website/game development. Never print matched secret material.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
MAX_TEXT_BYTES = 2_000_000
TEXT_EXTS = {".html", ".js", ".mjs", ".cjs", ".json", ".txt", ".md",
             ".yaml", ".yml", ".xml", ".py", ".css", ".sh", ".svg", ".webmanifest"}
SENSITIVE_NAMES = {".env", ".env.production", ".env.local", "id_rsa",
                   "id_ed25519", "credentials.json", "service-account.json",
                   "service_account.json", "google-services.json"}
SENSITIVE_SUFFIXES = {".p12", ".pfx", ".pem", ".p8", ".jks", ".keystore", ".kdbx",
                      ".sqlite", ".sqlite3", ".db"}
# Distribution samples contain placeholders, not deployable secrets.
SAFE_ENV_EXAMPLES = {".env.example", ".env.sample", ".env.template", ".env.dist"}
CREDENTIAL_SIGNATURES = (
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("GitHub personal token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{35,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{50,}\b")),
    ("AWS access key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("Stripe live secret", re.compile(r"\bsk_live_[A-Za-z0-9]{20,}\b")),
    ("OpenAI project key", re.compile(r"\bsk-proj-[A-Za-z0-9_-]{35,}\b")),
    ("Slack bot token", re.compile(r"\bxoxb-[0-9]{10,}-[A-Za-z0-9-]{15,}\b")),
)
BACKUP_NAME = re.compile(r"(?:^|/)(?:index[-_.].*(?:MASTER|PRE-PUBLISH|FINAL-TEXT)|.*(?:backup|before).*\.(?:html|txt))", re.I)
WINDOW_BLANK = re.compile(r"<a\b[^>]*\btarget\s*=\s*['\"]?_blank\b[^>]*>", re.I)
REL_SAFE = re.compile(r"\brel\s*=\s*['\"][^'\"]*(?:noopener|noreferrer)", re.I)
HTTP_REMOTE_SCRIPT = re.compile(r"<script\b[^>]*\bsrc\s*=\s*['\"]http://", re.I)

def sensitive_file_path(name: PurePosixPath) -> bool:
    """Block secret-bearing file paths without inspecting or printing values."""
    basename = name.name.lower()
    return (
        basename in SENSITIVE_NAMES
        or (basename.startswith(".env.") and basename not in SAFE_ENV_EXAMPLES)
        or name.suffix.lower() in SENSITIVE_SUFFIXES
    )


def tracked_files():
    output = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [p.decode("utf-8", "replace") for p in output.split(b"\0") if p]

def inspect():
    errors = []
    warnings = []
    checked = 0
    for relative in tracked_files():
        path = ROOT / relative
        if not path.is_file() or path.is_symlink():
            continue
        name = PurePosixPath(relative)
        if sensitive_file_path(name):
            errors.append(f"{relative}: sensitive filename tracked in public repository")
        if BACKUP_NAME.search(relative):
            warnings.append(f"{relative}: legacy or backup content is publicly published")
        if path.stat().st_size > MAX_TEXT_BYTES or path.suffix.lower() not in TEXT_EXTS:
            continue
        try:
            contents = path.read_text("utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        checked += 1
        for label, signature in CREDENTIAL_SIGNATURES:
            if signature.search(contents):
                errors.append(f"{relative}: possible {label}; revoke and rotate if genuine")
        if path.suffix.lower() == ".html":
            if HTTP_REMOTE_SCRIPT.search(contents):
                errors.append(f"{relative}: insecure HTTP script source")
            for link in WINDOW_BLANK.findall(contents):
                if not REL_SAFE.search(link):
                    warnings.append(f"{relative}: a new-window link lacks noopener/noreferrer review")
                    break
    security_file = ROOT / ".well-known/security.txt"
    if not security_file.is_file():
        errors.append(".well-known/security.txt: missing security reporting channel")
    else:
        text = security_file.read_text("utf-8")
        if not re.search(r"^Contact:\s*mailto:", text, re.M):
            errors.append(".well-known/security.txt: missing email contact")
        match = re.search(r"^Expires:\s*(\S+)", text, re.M)
        if not match:
            errors.append(".well-known/security.txt: missing expiry")
        else:
            try:
                expiry = datetime.fromisoformat(match.group(1).replace("Z", "+00:00"))
                if expiry <= datetime.now(timezone.utc):
                    errors.append(".well-known/security.txt: expired")
            except ValueError:
                errors.append(".well-known/security.txt: invalid expiry")
    print(f"Checked {checked} public text files; {len(errors)} blocking findings; {len(warnings)} manual-review warnings.")
    # Keep CI concise and avoid listing credential values (which are never printed).
    for item in errors[:30]:
        print("ERROR:", item, file=sys.stderr)
    for item in warnings[:12]:
        print("REVIEW:", item)
    if len(warnings) > 12:
        print(f"REVIEW: {len(warnings)-12} additional warnings omitted.")
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(inspect())
