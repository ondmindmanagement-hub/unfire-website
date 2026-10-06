#!/usr/bin/env python3
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "https://data.brreg.no/enhetsregisteret/api"
UA = "Unfire-Signalpost/0.1 (+https://unfire.technology; hello@unfire.technology)"


def now():
    return datetime.now(timezone.utc).isoformat()


def source(url):
    return {"url": url, "retrieved_at": now()}


def get_json(session, url, params=None):
    r = session.get(url, params=params, timeout=20)
    if r.status_code == 410:
        return "not_available", None, r.url
    if r.status_code == 404:
        return "not_available", None, r.url
    r.raise_for_status()
    return "available", r.json(), r.url


def read_orgs(path):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if p.suffix.lower() == ".jsonl":
        rows = [json.loads(x) for x in text.splitlines() if x.strip()]
        vals = [str(x.get("organisation_number") or x.get("organisasjonsnummer") or x.get("org") or "").strip() for x in rows]
    elif p.suffix.lower() == ".json":
        obj = json.loads(text)
        rows = obj if isinstance(obj, list) else obj.get("organisations", [])
        vals = [str(x if isinstance(x, str) else x.get("organisation_number") or x.get("organisasjonsnummer") or "").strip() for x in rows]
    else:
        vals = [x.strip() for x in text.splitlines() if x.strip()]
    out = []
    for v in vals:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 9:
            raise ValueError(f"Invalid Norwegian organisation number: {v}")
        out.append(digits)
    return out


def claim(value, url, reporting_period=None):
    if value is None or value == "" or value == []:
        return {"state": "not_available", "value": None, "evidence": []}
    ev = source(url)
    if reporting_period:
        ev["reporting_period"] = reporting_period
    return {"state": "available", "value": value, "evidence": [ev]}


def compact_address(a):
    if not isinstance(a, dict):
        return None
    return {
        "address": a.get("adresse"),
        "postal_code": a.get("postnummer"),
        "city": a.get("poststed"),
        "municipality": a.get("kommune"),
        "municipality_number": a.get("kommunenummer"),
        "country": a.get("land"),
        "country_code": a.get("landkode"),
    }


def research_one(session, org):
    entity_url = f"{BASE}/enheter/{org}"
    state, ent, resolved = get_json(session, entity_url)
    if state != "available":
        return {
            "organisation_number": org,
            "state": state,
            "retrieved_at": now(),
            "claims": {},
            "errors": []
        }

    claims = {}
    claims["legal_name"] = claim(ent.get("navn"), resolved)
    claims["organisation_form"] = claim((ent.get("organisasjonsform") or {}).get("kode"), resolved)
    claims["industry_primary"] = claim(ent.get("naeringskode1"), resolved)
    claims["industry_secondary"] = claim([x for x in [ent.get("naeringskode2"), ent.get("naeringskode3")] if x], resolved)
    claims["business_address"] = claim(compact_address(ent.get("forretningsadresse")), resolved)
    claims["postal_address"] = claim(compact_address(ent.get("postadresse")), resolved)
    claims["employees"] = claim(ent.get("antallAnsatte"), resolved)
    claims["website"] = claim(ent.get("hjemmeside"), resolved)
    claims["registered_vat"] = claim(ent.get("registrertIMvaregisteret"), resolved)
    claims["bankrupt"] = claim(ent.get("konkurs"), resolved)
    claims["under_liquidation"] = claim(ent.get("underAvvikling"), resolved)
    claims["founded_date"] = claim(ent.get("stiftelsesdato"), resolved)

    errors = []

    roles_url = f"{BASE}/enheter/{org}/roller"
    try:
        rs, roles, rr = get_json(session, roles_url)
        claims["registered_roles"] = claim(roles if rs == "available" else None, rr)
    except Exception as e:
        claims["registered_roles"] = {"state": "failed", "value": None, "evidence": []}
        errors.append({"source": roles_url, "error": type(e).__name__})

    sub_url = f"{BASE}/underenheter"
    try:
        ss, subs, sr = get_json(session, sub_url, params={"overordnetEnhet": org, "size": 100})
        items = []
        if ss == "available" and isinstance(subs, dict):
            items = ((subs.get("_embedded") or {}).get("underenheter") or [])
        claims["registered_subunits"] = claim(items, sr)
    except Exception as e:
        claims["registered_subunits"] = {"state": "failed", "value": None, "evidence": []}
        errors.append({"source": sub_url, "error": type(e).__name__})

    return {
        "organisation_number": org,
        "state": "available",
        "retrieved_at": now(),
        "claims": claims,
        "refresh": {"previous_snapshot": None, "material_changes": []},
        "errors": errors,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--organisations", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    orgs = read_orgs(args.organisations)
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "application/json"})

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    with out.open("w", encoding="utf-8") as f:
        for org in orgs:
            try:
                row = research_one(session, org)
            except Exception as e:
                row = {
                    "organisation_number": org,
                    "state": "failed",
                    "retrieved_at": now(),
                    "claims": {},
                    "errors": [{"error": type(e).__name__, "message": str(e)[:300]}],
                }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
