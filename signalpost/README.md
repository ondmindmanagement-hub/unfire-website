# Unfire Signalpost Agent

Original Unfire entry scaffold for Builderr's Signalpost company intelligence challenge.

## Current scope

This branch contains a reproducible Python agent that accepts Norwegian organisation numbers and returns one terminal JSON object per input.

Version 0 uses Brønnøysundregistrene Open Data as the authoritative identity source and retrieves:

- legal identity;
- organisation form;
- industry codes;
- registered address;
- employee count when published;
- VAT / bankruptcy / liquidation flags;
- public registered roles;
- registered sub-units;
- company website when the registry publishes one.

Every published claim carries a source URL and retrieval timestamp. Missing data is never converted to zero.

## Run

```bash
python3 signalpost/agent.py --organisations signalpost/sample_orgs.txt --output signalpost/out.jsonl
```

The runner accepts a text file with one 9-digit organisation number per line, JSON, or JSONL.

## Source rights

Brønnøysundregistrene Open Data is published under the Norwegian Licence for Open Government Data (NLOD) 2.0.

## Status

Preparation branch only. Do not treat this branch as a frozen competition submission until the required smoke test, 1,000-profile artifact, source policy review, and evaluator contract checks are complete.
