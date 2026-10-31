# Unfire OS · Signed Synthetic Preview Gate

**Status: isolated engineering research. Not a production authorization service, human identity system, secure agent runtime or tool-use adapter.**

## Purpose

A language model can *suggest* something, but its text, confidence and self-reported quality are not permission to perform external actions. This small prototype separates five concepts:

1. An untrusted model output under a fixed public test fixture.
2. An independently computed exact-answer or JSON-schema quality result.
3. A proposal that may be reviewed.
4. A cryptographically verified decision under a pinned Ed25519 **public key**, scoped to precisely that proposal.
5. A one-time **synthetic preview event**. No real action, write, HTTP request, shell command or account access is ever performed.

Only `synthetic.preview` exists in this module. There is no real execution capability to authorize. The model's previous tiny local test scored **2/3** and failed strict JSON. A failed fixture stays `BLOCKED_QUALITY` and cannot be signed into passing.

## Files

- `approval.mjs`: private in-memory state, independent fixture checks, one-time signed review, expiry, replay prevention, STOP and metadata-only audit.
- `approval.test.mjs`: a set of adversarial and lifecycle tests using **ephemeral keys created solely inside the tests**. No private signing key is committed or written to the repository.

## Protocol

A caller supplies an exact proposal:

```js
{
  id: "task_a",
  fixtureId: "arithmetic",
  modelOutput: "42",
  operation: "synthetic.preview"
}
```

The trusted integrator injects an Ed25519 verification key from outside any model-produced content. The gate computes the independent fixture result, and if valid, creates a domain-separated challenge signed over:

```
domain · proposalId · proposalDigest · nonce · expiresAt · decision
```

A valid signature for `APPROVE` is **not** valid for `DENY`, another proposal, another session, another digest or another nonce. The proposal is approved once and can be consumed once. A preview event returns only an identifier, digest, `simulated: true`, and `externalActionAllowed: false`. Neither the source nor its tests provide an adapter capable of performing side effects.

The clock is **injected by the test caller** and checked for expiration and non-regression across the synthetic approval. The 60-second test expiry and nonce tracking are **in-memory only**.

## Run

Node.js v22 or later; no packages or model processes required:

```sh
node --test experiments/unfire-approval-gate/approval.test.mjs
```

No Ollama invocation, model download, API call, real file edit, email, publication or model spending is needed for this stage.

## Observed security properties in the synthetic scope

The tests reject: corrupted JSON and duplicate keys, incorrect outputs, text posing as instructions, unknown operations, unrecognized proposal fields, stolen signatures from another public-key pair, cross-proposal and cross-session replay, expiry, clock rollback, a signed DENY presented as APPROVE, incorrect Ed25519 encoding, excessive proposal counts, extra action fields, duplicate approvals and STOP bypass attempts.

**These tests do not prove complete security.** In particular:

- A signature verifies possession of a private key, **not that a person physically reviewed or consented**. A trusted approval UI, identity and secure signing-device/key storage must be designed and audited separately.
- The key and clock are injected by the host program, which is assumed trusted. If a malicious model controls these inputs or the host process, this toy gate is not a security boundary.
- Approval nonces and states are held in memory. A restart loses them. Real authorization would require secure, durable transactional storage, replay protection and revocation.
- The quality fixture contains only three trivial public tasks. It is not a reliable model benchmark, semantic assurance or prompt-injection-proof evaluation.
- Ed25519 authorization does **not** make a worker, model, tool, output or filesystem action safe. This module intentionally has no effectful adapter.
- Tests cannot attest to external action completion, because none occurred.
- Keep sensitive data, human signing credentials, production secrets and customer approvals outside this repository and outside any model prompt.

## Decision

Remain **DRAFT / UNMERGED / NOT DEPLOYED** pending coordination with #247. Do not wire this to Apple applications, Gmail, financial services, code publishing or any other external tools. The next real engineering gate requires an independently designed human confirmation interface, strong authentication, secure key custody, policy-scoped sandbox, immutable audit storage, restart recovery and explicit user consent before any side effect.
