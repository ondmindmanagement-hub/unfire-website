# Worker Threads · First Reproducible Measurement

**Date:** 2026-10-30 · **Hardware:** authorized Mac, arm64 · **Node:** v26.8.2 · **Status:** first bounded synthetic research benchmark.

## Workload

- 24 deterministic `synthetic.hashFold` jobs, 90,000 integer rounds per job.
- Both the sequential and threaded paths recompute the deterministic expected output before reporting VERIFIED.
- Three independent repetitions per configuration. Worker startup and teardown time included.
- Baseline: sequential execution (no additional thread).
- Experimental variants: 1, 2, 4 or 8 actual `worker_threads`.
- Measurements are total elapsed milliseconds per batch. **No real AI/model/provider calls, tokens, network tasks or external work.**

| Mode | Trials in ms | Median ms | Verified jobs |
| --- | --- | ---: | ---: |
| Sequential | 9.54 · 8.77 · 9.01 | 9.01 | 24/24 |
| 1 thread | 24.19 · 21.05 · 22.54 | 22.54 | 24/24 |
| 2 threads | 18.87 · 19.59 · 17.92 | 18.87 | 24/24 |
| 4 threads | 19.37 · 19.48 · 19.13 | 19.37 | 24/24 |
| 8 threads | 23.16 · 21.85 · 22.11 | 22.11 | 24/24 |

**Result for this workload:** sequential wins; 2 threads are fastest among the tested thread-based configurations but still slower than sequential (18.87 vs 9.01 ms medians). 8 is slower than 2. It would be misleading to claim Unfire OS is faster through agent proliferation or to generalize these numbers to other hardware or longer-running tasks.

## Why extra threads may lose

Thread initialization, postMessage transfers, coordinator verification, and termination add overhead. Meanwhile the fixed synthetic tasks are so short that this overhead dominates. Results may differ for longer independent operations, actual I/O-bound tasks, resident pools, caches, memory pressure, and actual provider APIs; these are **untested**.

## Trust and feasibility boundaries

- The new `pool.mjs` allows STOP through an AbortSignal, validates strict input fields, and compares reported output with local recomputation.
- Tests verify cancellation, failure cleanup, valid/invalid inputs and identical outputs for all lane counts.
- A real Node worker is **not** an externally authenticated agent, isolated process or safe sandbox for user-controlled source code. All work is synthetic, bounded, and predetermined.
- The benchmark does not collect hardware temperature, memory energy, real model token use, cost or task quality.
- Only three repeats; this is initial exploration, not statistical proof or a production performance guarantee.

## Recommendation

Prioritize a **cost-aware adaptive scheduler**: start sequential for small tasks and allow concurrency only when a workload-specific measured improvement exceeds overhead and all evidence gates remain satisfied. Any further benchmark should compare representative workloads with identical inputs, model versions, warm/cold states, p50/p95 latency, error/retry rates, CPU/memory impact, and explicit stop/permissions (see #242).

No production merge, release, API integrations or system modifications are justified by this experiment alone.
