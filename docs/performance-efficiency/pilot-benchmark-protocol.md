# Measurement protocol · Unfire Performance & AI Efficiency

**Version:** 0.1 · 30 October 2026 · **Status:** prospective; no enterprise pilot validated

## Rule 1 · Do not optimise without baseline evidence

Define the user-visible task and its correctness criteria. Record exact platform, hardware, OS, compiler/AI runtime, model and versions, input dataset, cache state, connectivity assumptions, power state and background load. Separate the following distinct mechanisms:

| Claim type | Evidence needed | What is NOT implied |
| --- | --- | --- |
| Compiler-cache repeat | Real source, identical build flags and cacheable inputs, byte-identical output, cold/miss/hit measurements | Entire build is faster |
| AI API efficiency | Same task quality, fewer calls/tokens, comparable provider conditions, real billing basis if claimed | The computer itself is faster |
| Task automation | E2E time including human intervention, completion quality, approvals and failure recovery | Unsupervised autonomy is safer |
| Desktop performance | Repeated real-device resource/latency measurements against baseline | Universal battery, CPU or GPU acceleration |

## Rule 2 · Reproducibility and negative results

1. Define pass/fail thresholds *before* applying changes.
2. Use fixed synthetic test data; do not expose secrets or real customer records.
3. Run at least 10 paired trials for exploratory timing (more as needed for noise). Alternate ordering when possible. Record every run, warm/cold state and failures.
4. Report mean only as secondary; use **p50 and p95**, spread, successful-task throughput, errors, accuracy and RAM/CPU/thermal pressure.
5. Show the same workload and hardware or clearly explain changes. Re-check every source SHA and dependency version for compile cache claims.
6. Validate correctness with tests; reject an optimisation that breaks audio stability, accessibility, privacy, resource safety or approval gates.
7. Include cost per successfully completed task, not only cost per model call. Label **estimate** versus provider invoice.

## Existing evidence · Scope and limits

On **29 October 2026**, the private local Unfire Performance Lab documented **four isolated ARCHER C++ translation units**, 12/12 successful compilation passes, cache-hit objects byte-identical to cache-miss objects. Aggregate direct compile time **5.920s**, initial miss **6.731s**, exact same-input cache-hit repeat **0.154s** (approximately **43.7x compared with the initial miss**, not with an entire native application build). This is a historical local developer benchmark. Never advertise this factor as a shipped Unfire or AI acceleration result. Private raw paths and diagnostics are not redistributed.

## Safety gates

- Read-only diagnostics by default; no persistent pollers, app restarts, bulk cache eviction, simulator deletion, kernel changes or elevated privileges.
- No unknown background task termination. Preserve owners' branches, BOLT/Logic workspaces and ongoing Apple submission work.
- Require explicit consent before any file deletion, installation, data transmission or privileged optimisation.
- External pilots require appropriate software signing/notarisation, privacy assessment, data-processing agreement if needed, written scope and authority to contract.

## Acceptance record template

```text
Test ID:
Date/time and timezone:
Environment and versions:
Input/checksum:
Baseline / candidate:
Warm or cold:
N, p50, p95, spread:
Successful outputs / failures:
CPU, memory, disk / thermal:
Calls, tokens, cost basis:
Human approvals, STOP and rollback:
Correctness/regression tests:
Risks, confounders, negative results:
Approved external claim (if any):
```

Until this record passes review, every marketing statement remains exploratory.