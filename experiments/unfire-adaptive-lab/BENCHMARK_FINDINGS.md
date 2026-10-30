# Unfire OS · Adaptive Concurrency · First Exploratory Results

**Date:** 30 Oct 2026 · **Node:** v26.8.2 · **Platform:** authorized macOS / Apple Silicon (darwin arm64).

## Method

The same 24 deterministic, synthetic, integer-computation tasks were executed in each candidate mode with **three repetitions**. The coordinator independently recomputed outputs, and every candidate verified **24/24 tasks**. Worker creation, communication and shutdown were included in the elapsed per-batch measurements. No AI provider, network task, customer data, disk workload or real AI agent was involved.

The explicit calibration used 1 sequential reference (no extra threads) and 1/2/4/8 Node worker threads. Only a profile with the same exact task signature, matching outputs and at least three samples can be used to choose threaded execution. A threaded choice must save at least 15% **and** 5 ms versus the sequential baseline. The same-run calibration overhead is excluded from the medians but reported separately and is **not free**.

## Reproducible first measurements

| Workload | Iterations/task | Sequential median | 1 worker | 2 workers | 4 workers | 8 workers | Chosen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Tiny | 4,000 | **0.76 ms** | 14.09 ms | 14.69 ms | 16.82 ms | 21.49 ms | Sequential |
| Medium | 60,000 | **9.39 ms** | 22.57 ms | 19.47 ms | 19.86 ms | 34.14 ms | Sequential |
| Bounded-large | 150,000 | **22.36 ms** | 62.57 ms | 55.51 ms | 58.78 ms | 62.38 ms | Sequential |

Calibration wall-clock costs: **220.83 ms tiny**, **310.26 ms medium**, **792.94 ms bounded-large**. It would be counterproductive to calibrate automatically when performing a one-off job. The calibration results are synthetic local evidence, not authenticated, durable or representative of user workloads.

## What the result does and does not mean

For these three **short, fixed** workloads, extra threads increase wall-clock time, largely due to worker setup, communication, bookkeeping and verification. **No worker variant beats sequential**. The adaptive choice therefore correctly makes no additional worker. The data **does not** demonstrate that parallelism is never useful, nor does it prove that Unfire OS AI agents run faster or slower with any particular architecture.

The experiments did not measure RAM, CPU energy, thermal conditions, provider token consumption, streamed model latency, I/O-bound tasks, resident worker pools, high-duration work, heterogeneous GPUs, real agent output quality, queue fairness or p95 latency. Only three repeats were used. Future results must be independently reproducible with more repeats and actual workloads before drawing general conclusions.

## Safety observation

There was an initial test design that selected 8 threads on a close tie and accepted a partially malformed synthetic timing profile. We tightened the gate: invalid submitted measurements now reject the **entire** profile, and near-tied performance favors fewer workers. All corrected adaptive tests passed in Node before integration.

## Next gate

Do not enable adaptive concurrency in BOLT, Unfire Control or the OS prototype based on this alone. First require workloads that represent real product tasks, explicit secure worker capabilities, signed/checked human permissions, persistent evidence where needed, performance budgets, restart/STOP correctness, and stable quality. The research PR stays draft and separate from existing code owners.
