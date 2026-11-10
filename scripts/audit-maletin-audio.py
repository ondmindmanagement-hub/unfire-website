#!/usr/bin/env python3
"""Inspect original game audio assets without altering or uploading them.
No AI, no audio rendering, and no third-party Python dependencies.
Non-zero status on damaged/missing assets; high peaks are review flags, not automatic bans.
"""
import json, pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "audio/maletin/samples"
HTML = (ROOT / "audio/maletin/index.html").read_text(encoding="utf-8")
m = re.search(r"const SAMPLES = (\{[^\n]*\});", HTML)
if not m:
    raise SystemExit("ERROR: SAMPLES manifest missing")
samples = json.loads(m.group(1))
references = {}
for key, spec in samples.items():
    for zone in spec.get("zones") or [spec]:
        file = zone.get("f")
        if file:
            references.setdefault(file, []).append(key)
available = {p.name for p in SAMPLE_DIR.glob("*.mp3")}
missing = sorted(set(references) - available)
unused = sorted(available - set(references))
bad = [(x, (SAMPLE_DIR / x).stat().st_size) for x in available if (SAMPLE_DIR / x).stat().st_size < 512]
if missing or bad:
    print(json.dumps({"error": "missing/corrupt samples", "missing": missing, "bad": bad}, indent=2))
    sys.exit(1)
print(json.dumps({"sample_definitions": len(samples), "files_total": len(available),
                  "files_referenced": len(references), "unreferenced": unused}, indent=2))
if '--decode' not in sys.argv:
    sys.exit(0)
if not shutil.which("ffmpeg"):
    raise SystemExit("ffmpeg required for optional decode QA")
# Validate a representative risk-weighted set first; pass --all for the complete set.
terms = ("kick", "snare", "hat", "clap", "crash", "808", "siren", "gong",
         "piano_", "fmpiano_", "vibes_", "glock_", "sax_", "organ_", "bells_")
items = sorted(available) if '--all' in sys.argv else sorted({
    x for term in terms for x in sorted(available) if term in x
})[:55]
results = []
for i, name in enumerate(items, 1):
    proc = subprocess.run(
        ["nice", "-n", "10", "ffmpeg", "-nostdin", "-hide_banner", "-nostats",
         "-i", str(SAMPLE_DIR / name), "-af", "volumedetect", "-f", "null", "-"],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, timeout=15)
    stderr = proc.stderr
    def metric(label):
        mt = re.search(r"\b" + re.escape(label) + r":\s*(-?inf|-?\d+(?:\.\d+)?)\s*dB", stderr)
        return float(mt.group(1)) if mt else None
    d = {"sample": name, "decoded": proc.returncode == 0,
         "mean_dbfs": metric("mean_volume"), "sample_peak_dbfs": metric("max_volume")}
    if d["decoded"] and d["sample_peak_dbfs"] is not None and d["sample_peak_dbfs"] >= -0.2:
        # 4x-ish oversampled measurement through FFmpeg ebur128 true-peak.
        extra = subprocess.run(
            ["nice", "-n", "10", "ffmpeg", "-nostdin", "-hide_banner", "-nostats",
             "-i", str(SAMPLE_DIR / name), "-filter_complex", "ebur128=peak=true",
             "-f", "null", "-"],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, timeout=15)
        mt = re.search(r"True peak:\s*Peak:\s*([-+]?\d+(?:\.\d+)?) dBFS", extra.stderr)
        d["true_peak_dbfs"] = float(mt.group(1)) if mt else None
    results.append(d)
    if i % 25 == 0:
        print(f"decoded {i}/{len(items)}", file=sys.stderr)
if '--json' in sys.argv:
    pathlib.Path(sys.argv[sys.argv.index('--json')+1]).write_text(json.dumps(results, indent=2))
fail = [x for x in results if not x["decoded"] or x["sample_peak_dbfs"] is None]
very_hot = [x for x in results if x["sample_peak_dbfs"] is not None and x["sample_peak_dbfs"] >= -0.20]
very_quiet = [x for x in results if x["mean_dbfs"] is not None and x["mean_dbfs"] <= -40]
true_peak_warnings = [x for x in very_hot if (x.get("true_peak_dbfs") or 0) > 0]
print(json.dumps({"decoded": len(results), "decode_failures": fail, "near_full_scale": very_hot,
                  "true_peak_above_zero": true_peak_warnings, "very_quiet": very_quiet}, indent=2))
sys.exit(1 if fail else 0)
