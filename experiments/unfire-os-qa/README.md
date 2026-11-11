# Unfire OS · Independent Scheduler Regression QA

**Status:** isolated, synthetic research tests. This is not an agent runtime, security certification, new application or production deployment.

**Source:** draft Unfire OS PR #248, issue #247. These tests live in a separate QA-only folder and import the existing prototype without modifying its owned files.

## Run

From the repository root, with an installed Node.js version supporting the built-in test runner:

```sh
node --test experiments/unfire-os-layer/core.test.mjs experiments/unfire-os-layer/superchat.test.mjs experiments/unfire-os-qa/scheduler-invariants.test.mjs
```

## Coverage

- 512 deterministic, reproducible pseudo-random synthetic dependency graphs (1–24 tasks, 1–8 virtual slots)
- Dependencies scheduled before dependents; every scheduled task appears once
- Same-wave exclusive artifact reservations
- Approval gates, unsupported capabilities, STOP before subsequent work, cycle rejection
- Honest **simulation-only** status: planned waves do not prove actual agent execution

These assertions are safety and correctness regression checks for the *offline scheduler*. They do not show that tasks completed, artifacts were committed, any live workers executed, that cross-process leases exist, or that the implementation is production-safe.

## Known limitations and decision gate

The current planner marks tasks finished **within the planning simulation** to form subsequent waves. A future real runner must not infer real completion or release authorization from scheduling alone. A real task requires evidence, verification, independent tests, durable revision checks and scoped approval. Persistent locks, cancellation across processes, provider integration, privacy, accessibility and release QA remain separate gated work.

No external packages, provider credentials, network requests, customer data or background services are required. Keep this PR draft until the owner of #247 reviews and integrates it.
