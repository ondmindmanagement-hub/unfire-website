# Unfire OS · Bounded Concurrency Lab

**Research-only prototype · No AI agents · No model provider access · No production permissions**

This small laboratory tests the difference between *synthetic scheduling* and **actual concurrent calculation**. It extends existing evidence-runner research without changing its owned files or connecting a real assistant, Mac application, cloud account or network service.

## What actually runs

- Real Node.js `worker_threads`, limited to 1, 2, 4 or 8 local workers.
- One fixed, allowlisted `synthetic.hashFold` integer workload; strict manifests of `id`, `operation`, `rounds`, `salt`.
- Maximum **32** jobs; at most **150,000** loop rounds per job and at most 8 threads; 32 MB old-generation and 8 MB young-generation heap limits configured per worker. These are not full process or CPU security boundaries.
- Each worker message is independently **recomputed and compared** by the coordinator before its local status becomes `VERIFIED`. This proves equality of a synthetic result, **not** the worker's identity, security or performance of external actions.
- Timeout for dispatched tasks, `AbortSignal` cancellation, callback failure cleanup, worker error/exit cleanup, and no persistent workers after completion.

No arbitrary scripts, user supplied source files, models, remote APIs, network operations, credentials or personal data are accepted as task input.

## Reproduction

From repository root on Node.js v22 or later:

```sh
node --test experiments/unfire-concurrency-lab/pool.test.mjs
node experiments/unfire-concurrency-lab/bench.mjs
```

The benchmark runs 24 fixed jobs with 90,000 rounds each, recomputes every result, and repeats each configuration 3 times. All times include worker creation/cleanup. It reports raw measurements and medians for a synchronous sequential reference and 1/2/4/8 worker threads.

## Design decision

Do not assume higher lane count improves performance. For very small tasks, worker startup, message passing, verification, and scheduling overhead may dominate. Choose a strategy *per workload* using verified success, total wall-clock time, memory/thermal impact and error rates, not simply maximum agent count.

**Caveats:** Worker threads are not a secure sandbox for third-party code. Main-thread verification still consumes CPU. This toy operation is not a real AI model or agent, real distributed concurrency, external attestations, encrypted storage or recoverable leases. The brief 3-repeat benchmark is exploratory and cannot establish a stable machine-wide speed claim. Only one small isolated test run has been performed.

## Integration gates

- Main issue #247, OS prototype #248, QA #250 and synthetic evidence runner #252 remain separate owners.
- This lab only adds `experiments/unfire-concurrency-lab/`; it does not modify the files belonging to those PRs.
- Keep the child PR as draft, **not merged**. No production deployment, downloads, subscriptions, agent integrations, user content or permissions.
- Next steps require workload-representative tests, measurements of memory/CPU/thermal load, durable progress/evidence, explicit capability isolation and human approval for real side effects.

The aim is verified useful work per time and resource budget, not a large number of workers.
