# Synthetic workflow benchmark · Unfire

**Research / reproduction only. Not proof of faster AI models or Mac hardware.**

This standard-library-only Python experiment measures the exact-input deduplication overhead and potential advantage in a **synthetic CPU-bound placeholder** that simulates repeated work. It does **not** call a language model, infer tokens, send network traffic, access credentials, or incur API costs.

## Run

```sh
python3 -B synthetic_workflow.py --trials 24 --output result.json
```

Optional `--trials` range: 10–100. One-shot execution only; no agent services or background polling.

## Protocol

- **Case A · repeated:** 12 operations per trial, with 6 exact duplicates. Baseline recomputes each operation. Deduplicated version reuses only same-tenant, model, configuration and exact-prompt results.
- **Case B · negative control:** 12 unique operations. Both paths perform all 12 calculations; no speedup is expected.
- 24 paired trials per variant, alternating baseline/deduplicated order, on the same machine and run, with per-trial fresh caches.
- Report p50 and interpolated p95 end-to-end wall time, average CPU time, number of compute calls, correctness equivalence.
- Built-in tests verify that tenant/model/config changes do not accidentally share cached responses.

## Internal Mac result · 30 Oct 2026

| Case | p50 baseline | p50 deduplicated | p95 baseline | p95 deduplicated | Actual compute calls (base → dedup) | Correctness |
|---|---:|---:|---:|---:|---:|---|
| 6 repeated inputs of 12 total | 17.039 ms | 8.488 ms | 18.271 ms | 8.932 ms | 12 → 6 | exact match |
| 12 unique inputs | 16.357 ms | 16.423 ms | 16.901 ms | 16.741 ms | 12 → 12 | exact match |

The repeated-work median time reduction was approximately **50.2%**, as expected from executing half as many placeholder calculations. The unique-input negative control shows no material improvement. Variability is machine- and load-dependent. **These numbers are NOT actual LLM/AI response speed, cost savings, released application performance, customer return on investment, or a general acceleration claim.**

## Next tests required before any performance claim

1. Identify a **consented, non-production** task with a real locally hosted model or authorised API whose spend is bounded in advance.
2. Collect repeat trials with stable model, hardware, versions, input, cache scope, quality checks, failures, p50/p95 and real token counts.
3. Validate correctness and identical semantics before interpreting speed; caching must not reuse stale or privacy-unsafe responses.
4. Test true unique-input and changed-model negative controls, including fallback/retry conditions.
5. Measure against a representative enterprise workflow with consent and contractual safeguards before sale.

**Warning:** the Mac was observed under other workloads; no local model service was started or application terminated. Avoid heavy inference while unrelated owners are building or running audio and browser QA.

Original coordination: [Unfire Performance & AI Efficiency #242](https://github.com/ondmindmanagement-hub/unfire-website/issues/242).