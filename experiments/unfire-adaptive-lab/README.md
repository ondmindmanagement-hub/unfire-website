# Unfire OS · Workload-Aware Adaptive Scheduler Lab

**Research-only · Synthetic workloads · No external agents or production deployment**

This prototype prevents a common performance mistake: increasing the number of workers without evidence that it helps. It extends the existing fixed-operation `worker_threads` research (#253) without changing that branch's owned files.

## Design

The default is always **sequential**, which does not create worker threads.

A calibration profile can propose 1, 2, 4 or 8 real Node worker threads **only** when it contains at least three successful, equal-result local timing samples for the exact synthetic task signature, including the sequential baseline. A selected threaded mode must beat the sequential median by at least **15% AND 5 milliseconds**. Comparably fast threaded modes within **3%** of the best are biased toward fewer workers. All samples are bounded, and stale, malformed, inconsistent or missing evidence falls back to sequential.

The workload signature includes task IDs, the fixed allowlisted operation, iteration counts and salts. A changed task cannot reuse a prior calibration by accident. The SHA-256 signature/digest is a **consistency check, not authentication**.

The empirical profile is intentionally **NOT trustworthy as a production permission or speed guarantee**. Anyone controlling a test profile could fabricate timings; it cannot authorize a real model, network connection, OS operation, data access or spend.

## Files

- `decision.mjs`: deterministic, conservative, measurable selection rules.
- `adaptive.mjs`: explicit bounded calibration, verification and adaptive selection.
- `adaptive.test.mjs`: profile validity, cancellation, correctness, tie/threshold cases and real-thread sample run.
- `bench.mjs`: three distinct fixed CPU workloads (tiny, medium, bounded-large), with 3 repetitions per configuration.
- `BENCHMARK_FINDINGS.md`: observed measurements and negative results.

## Reproduce

From repository root (Node v22+ and no third-party packages):

```sh
node --test experiments/unfire-adaptive-lab/adaptive.test.mjs
node experiments/unfire-adaptive-lab/bench.mjs
```

**Important:** The benchmark **explicitly** calibrates; normal `runAdaptive()` does not automatically calibrate. Calibration is often slower than executing a short task once; it must not be run automatically against user/customer workloads. Benchmark measurements include thread start-up, completion and verification. Every output is independently checked against the deterministic expected result.

## Boundaries

- Maximum 32 fixed synthetic tasks, maximum 150,000 integer loop rounds each, at most 8 real Node worker threads.
- `AbortSignal` and timeouts operate through the thread-pool implementation, but synchronous sequential work cannot be interrupted mid-loop by the event loop. For real expensive tasks, chunking and cooperative cancellation would be needed.
- The calibration and selector are **not** a live service and do not persist performance profiles.
- No arbitrary code, live AI provider, actual privileged computer work, remote network access, filesystem task access, credentials, personal content, paid services, production installs or app changes.
- Node worker threads are **not** a security sandbox for malicious untrusted code. Model calls, identity, durable leases, STOP of OS processes, security and true independent evidence remain separate blockers.
- No GitHub Actions CI pass is claimed. No real-world speedup can be asserted from this CPU toy benchmark.

**Engineering conclusion:** favor the simplest safe executor unless representative, repeated workload evidence proves a meaningful, sustained advantage under matched quality, resource and security conditions. Keep this PR draft and unmerged, routed to the #247 owner for review.
