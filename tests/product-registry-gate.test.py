#!/usr/bin/env python3
"""Negative tests: each registry defect must be caught by scripts/check-product-registry.py."""
import copy, json, os, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
GATE = ROOT / "scripts/check-product-registry.py"
BASE = json.loads((ROOT / "assets/data/unfire-products.json").read_text())


def run(reg):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(reg, f)
    r = subprocess.run([sys.executable, str(GATE), "--today", "2026-11-22"], capture_output=True, text=True,
                       env={**os.environ, "UNFIRE_REGISTRY": f.name})
    os.unlink(f.name)
    return r.returncode, r.stdout


def prod(reg, pid):
    return next(p for p in reg["products"] if p["id"] == pid)


CASES = []
def case(name, code):
    def deco(fn): CASES.append((name, code, fn)); return fn
    return deco

@case("duplicate product id", "[DEDUP] duplicate id")
def _(r): r["products"].append(copy.deepcopy(prod(r, "bolt")))

@case("variant registered as a second product", "[DEDUP] name/alias")
def _(r):
    p = copy.deepcopy(prod(r, "unfire-mutants")); p.update(id="y2k-robots", name="Y2K ROBOTS", aliases=[], url="/games/y2k-robots/"); r["products"].append(p)

@case("two products share a primary URL", "[DEDUP] url")
def _(r): prod(r, "file-prep")["url"] = "/apps/privacy-lens/"

@case("broken internal link", "[LINKS]")
def _(r): prod(r, "power")["url"] = "/apps/power-does-not-exist/"

@case("available without store evidence", "[TRUTH]")
def _(r): prod(r, "unfire-control")["editions"][0]["status"] = "available"

@case("stale store verification", "days old")
def _(r): prod(r, "archer")["editions"][0]["store"]["verified_on"] = "2026-01-01"

@case("non-store host as store", "approved store host")
def _(r): prod(r, "bolt")["editions"][0]["store"]["url"] = "https://example.com/bolt"

@case("claim missing from target page", "not found on")
def _(r): prod(r, "pilot")["claims_on_target"] = ["€99"]

@case("retired capture reused", "[CAPTURES]")
def _(r): prod(r, "archer")["visual"]["src"] = "/assets/products/archer-mac.webp"

@case("unknown status", "unknown status")
def _(r): prod(r, "signals")["editions"][0]["status"] = "launched"

@case("internal edition on listed product", "[TRUTH]")
def _(r): prod(r, "gods-lamp")["listed"] = True; prod(r, "gods-lamp")["url"] = "/privacy/gods-lamp/"

@case("unlisted product name leaks into hubs", "[LEAKS]")
def _(r): prod(r, "continuum")["name"] = "BOLT"; prod(r, "continuum")["id"] = "continuum"; prod(r, "bolt")["aliases"] = []

@case("catalog links a product missing from the registry", "[CATALOG]")
def _(r): r["products"] = [p for p in r["products"] if p["id"] != "power-web"]

@case("catalog links a product the registry keeps unlisted", "[LEAKS]")
def _(r): prod(r, "file-prep")["listed"] = False

@case("catalog card claims a platform the registry did not verify", "[PLATFORMS]")
def _(r): prod(r, "pocket-capture")["editions"][0]["platforms"] = ["iphone"]


@case("catalog says Available for a product the registry does not list as available", "[STATUS]")
def _(r): prod(r, "power")["editions"][0].update(status="preview"); prod(r, "power")["editions"][0].pop("store", None)

def main():
    rc, out = run(BASE)
    assert rc == 0, "baseline registry must pass:\n" + out
    print("ok   baseline passes")
    fails = 0
    for name, code, fn in CASES:
        reg = copy.deepcopy(BASE); fn(reg)
        rc, out = run(reg)
        ok = rc == 1 and code in out
        fails += not ok
        print(("ok  " if ok else "FAIL"), name, "" if ok else "\n" + out)
    print(f"{len(CASES) - fails}/{len(CASES)} negative cases caught")
    sys.exit(1 if fails else 0)

main()
