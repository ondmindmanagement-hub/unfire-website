# Evidence Runner · Privacy-Preserving Journal Research

**Research-only. No production storage, live agents, credentials or automatic resume.**

## What changed

This laboratory adds a deterministic event-metadata codec, `journal.mjs`, plus `journal.test.mjs`. It works with the events already emitted by the synthetic `EvidenceRunner`. It stores only:

- Global sequence number
- Strict synthetic task ID
- State-transition label and state
- Revision and fencing-generation counters
- Journal version, previous checksum and current SHA-256 checksum

**It does not store the task specification, input, output, worker identity, approval signer, passwords, access tokens, authorization documents or user content.** All reader/writer operations must stay in a separate, explicitly controlled persistence layer.

## Why the restart test matters

A test writes a synthetic journal to a uniquely named temporary file with mode `0600`, reopens it, verifies the metadata integrity chain and constructs a **read-only** audit summary. The test removes the directory when it finishes.

Replaying journal metadata **never restores permission flags, worker leases, in-flight work, trusted identities or authority to execute a task**. A historically recorded `VERIFIED` means only that the original local synthetic test reported verification.

## Limits and attack considerations

- SHA-256 without a trusted signing key is a **checksum**, not an authenticated proof. Anyone who can rewrite the journal can generate a new valid hash chain.
- Partial-line truncation and many accidental edits are rejected. **Deleting entire trailing records can produce a valid shorter chain** unless a trusted final checksum/count is stored separately and verified. This experiment does not implement that trust anchor.
- A local file round-trip is not a crash-consistent, encrypted or access-controlled event database. The library is not a secure audit store.
- No secrets should be written to a public repository, logs or these synthetic journals.
- A resumed future system must require fresh authorization, sandboxed worker credentials, durable revision/lease checks and independent evidence verification.
- Benchmarks against actual task/workload traces, disk failures and concurrent writers are separate research gates.

## Verification

Integrated with the existing Unfire OS scheduler and QA branch on the authorized Mac, in a temporary checkout automatically removed after execution:

```sh
node --test --test-reporter=dot \
  experiments/unfire-os-layer/core.test.mjs \
  experiments/unfire-os-layer/superchat.test.mjs \
  experiments/unfire-os-qa/scheduler-invariants.test.mjs \
  experiments/unfire-execution-lab/runner.test.mjs \
  experiments/unfire-execution-lab/journal.test.mjs
```

**Observed 30 Oct 2026:** Node v26.8.2, 83/83 integrated tests passed, exit code 0. The 12 journal cases also passed separately (12/12), and the synthetic runner demo verified 3/3 tasks. This was run on the combined temporary checkout of PR #252 and QA PR #250; the journal code is committed on #252. These checks are **not** GitHub Actions CI or real-worker end-to-end integration.

## Deployment decision

Keep PR #252 in draft. Do not connect a real model, enable OS control, claim external verification, or integrate a persistent authenticated store until the main owner #247 approves a specific security and correctness design.
