# Enterprise Benchmark Plan · Unfire Continuum + Autonomy + Execution Engine

**Planning document only. No speedup or enterprise integration measured by this plan.**

## Measurement rules

Compare a baseline and an Unfire candidate on the same:
1. Hardware, CPU/GPU allocation, physical device and OS build.
2. AI model/endpoint/version and deterministic task dataset.
3. Network conditions, output quality criteria and privacy policy.
4. Cold and warm cache modes, recorded separately.
5. Worker concurrency and approved resource budgets, with fairness disclosures.

Report 30+ repeats per configuration where feasible, and raw machine-readable observations. Each run must include outcome validation, wall-clock elapsed time, p50/p95, throughput (verified units/hour), retries, false completions, CPU, resident memory, disk use, network calls, tokens and real currency cost (when a paid API is actually involved). Record whether a result is simulation, local fixture or real workload.

## Proposed benchmark suites

| Suite | Baseline | Candidate | Hard correctness gate |
| --- | --- | --- | --- |
| Document reconciliation | Sequential deterministic synthetic transforms | Bounded parallel independent transforms | Identical verified hashes and totals |
| Continuum task handoff | Manual duplicate-prone synthetic events | Indexed unique claims + evidence receipts | No duplicate completion, correct handoff |
| AI API workflow | Naive repeated calls on consented test account | Cache+batch+route if quality can be verified | Same or better task success, accurate spend |
| File/app bridge | Supported manually authorized test workflow | Explicit per-task adapter | No writes outside allowlist, STOP and revocation |
| Tenant boundary | Invalid cross-tenant fixture | Signed, actual isolated test deployment later | Every attempted cross-tenant read/write blocked by OS or service |
| Crash recovery | Kill isolated synthetic worker | Durable retry + fenced lease (future) | No double-execution, no unverified completion |
| High resource load | Audio app under baseline load | Identical audio app plus Unfire services | No avoidable glitches, app closures or thermal excess |

## Gate ordering

- Gate 0: pure simulation and unit tests. Shows program logic only.
- Gate 1: verified service contract, stop/restart, permission and identity tests in disposable local sandbox.
- Gate 2: isolated macOS signed/notarized application, independently reviewed security.
- Gate 3: Windows/Linux end-to-end tests on real target devices, no assumed portability.
- Gate 4: optional customer-authorized on-prem private pilot after data protection agreements.
- Gate 5: only then publish reproducible performance or security claims.

## Acceleration analysis

Parallel independent tasks can improve throughput, but CPU/GPU/API rate limits, memory bandwidth, network latency, model generation rate, serial dependencies and coordination overhead may dominate. For any reported speedup S = baseline verified-work elapsed time / candidate verified-work elapsed time, disclose confidence interval, test conditions, number of workers and completion quality.

No automatic assertion of "1,000x faster", "zero risk", "infinite work", "24/7" or "100% secure". Continuous operations require a real authorized running service, explicit budgets, cancellation and monitoring.
