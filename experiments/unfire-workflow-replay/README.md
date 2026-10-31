# Unfire OS · Synthetic Workflow Trace Replay

**Research only · Offline · No external AI, HTTP, accounts or actual providers**

This experiment explores shapes of AI-style workflows without executing AI operations. It uses a deliberately limited four-stage task DAG with tasks named `retrieve`, `draft`, `audit` and `release`. **These names are metaphors:** `retrieve` waits on a local timer, `draft` computes a deterministic integer hash, `audit` checks a hash, and `release` produces only another synthetic digest. There is **no actual information retrieval, content creation, security audit, release, publication or AI quality evaluation**.

## Controlled workflow

- Four independent chains, each with four dependent stages (16 total tasks). Each stage becomes eligible only after its predecessor is VERIFIED. The workflow is bounded at 24 tasks and eight async scheduling lanes.
- The runner allows only exact, validated task fields and stage labels. It rejects missing dependencies, duplicate IDs, cycles, unbounded waits, extra keys and unsupported operations.
- One deterministic transient failure forces one bounded retry in each baseline benchmark. Retries count toward the synthetic credit budget. Failed/missing evidence never counts as success.
- A task's result is deterministically recomputed before VERIFIED. This is a self-check, **not** model quality, an independent auditor or a cryptographic proof of any real-world action.
- `AbortSignal`, an event-handler error or an exhausted artificial budget abort the run without falsely reporting verified completion.
- `lanes` means **simultaneously scheduled asynchronous tasks**, NOT CPU threads or agents. All calculations still execute on the same JavaScript main thread. Async waits are local timers and **not HTTP/model requests**.
- In a four-chain workflow, at most four tasks are ready at once, so requesting eight lanes creates no additional parallelism.

## Reproduction

From repository root, Node v22+ with no external modules:

```sh
node --test experiments/unfire-workflow-replay/replay.test.mjs
node experiments/unfire-workflow-replay/bench.mjs
```

The benchmark runs three task shapes: waiting dominated (18 ms timer/task), mixed waiting and CPU work (8 ms/task), and CPU-only (0 ms timer). It warms each configuration first, then uses four balanced lane orders (1,2,4,8) to minimize timing/order bias. The median includes all per-batch scheduling, retries and local verification. All modes must deliver the **same** 16 verified digests, use identical input DAGs, and consume the **same** abstract credit units.

Synthetic credit units are simple fictional counters (eight units per attempt), not API tokens, billing data or dollar prices. Costs in a real AI deployment depend on model choice, prompts, context, retries, token rates, network and storage.

## Observed first results

See `BENCHMARK_FINDINGS.md` for raw timings and interpretation.

- If most work is **waiting**, overlapping independent work is helpful in this toy DAG.
- If work is **CPU-bound** on one JavaScript thread, changing async lane count does not create more CPU processing capacity. Small timing differences are measurement/JIT noise.
- Four independent chains do not benefit from an eight-lane setting merely because eight is higher.
- Correctness and credit consumption were the same across lane counts. This is **not** a claim about generative AI output quality or production economics.

## Security and integration boundaries

No customer content, credentials, external APIs, actual AI agents, external downloads or installs. Research-only, no real monetary charges. No durable storage, signed attestations, OS sandbox, live worker identities, external STOP/rollback or security authorization. No release performed.

Original #247 Unfire OS prototype (#248), QA (#250), evidence runner (#252), actual local Node threads (#253), and fixed CPU adaptive decision (#254) retain separate ownership. This experiment adds only files under `experiments/unfire-workflow-replay/`; leave its child PR draft and unmerged until integrated tests, real-world workload benchmarks and security reviews confirm any path to deployment.

**Next gate:** use authorized, anonymized real task telemetry and an explicit no-money sandbox to characterize actual wait, quality, retries, cost and cancellation before any real agent adapter. A synthetic timer benchmark cannot justify customer-facing speed claims.
