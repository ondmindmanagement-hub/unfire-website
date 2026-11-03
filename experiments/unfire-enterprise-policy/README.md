# Unfire Enterprise Private Edition · Tenant Policy Lab

**Status: experimental / synthetic only / no external actions.** This is not a native operating system, authenticated enterprise service, production security boundary, customer deployment or integrated DC Boost / Bridge / Bolt release.

## Purpose

Research a narrow, dependency-free and portable eligibility check for private enterprise AI automation. Complements Unfire OS Layer (#247, draft PR #248) and AI Performance & Efficiency (#242). It **does not duplicate the scheduler or execute tasks**.

The module accepts fictional JSON-like fixtures: tenant policy, task request, simulated approval, simulated tenant snapshot and fixed timestamp. It rejects malformed inputs and mismatched privileges. It never contacts or reads external systems. Every decision includes **externalActionAllowed: false**, even when a synthetic fixture passes.

## Reproduce

Run on Node 22 or later from this directory:

- node --test policy.test.mjs
- node demo.mjs

Tests are synthetic policy-unit tests, not a real tenant isolation, SSO or human approval test.

## Implemented gates

- Strict schema and fail-closed validation; unknown fields and operations denied.
- Tenant ID consistency across all four inputs; pinned policy revision.
- Exact principal, operation, resource and request ID match.
- Fictional grant with a maximum five-minute window.
- STOP, revoked request IDs and consumed request IDs gate.
- Per-request and tenant-unit ceilings checked against a caller-supplied snapshot.
- No mutations, access tokens, subprocess, filesystem, network, AI provider, OS adapter or customer access.

**Critical limitation:** caller-supplied approvals, clocks, STOP state, counters and consumed IDs are untrusted. An attacker could forge them. This package is intentionally *not* suitable for authorising actual actions.

## Future enterprise architecture (not built here)

Customer SSO / device identity
→ signed policy authority and durable revocations
→ independent quota and atomic grant consumption
→ OS/hypervisor enforced tenant sandbox
→ Unfire OS execution coordinator
→ optional customer-authorised Unfire Bridge adapters
→ tenant-owned encrypted audit store and backup

A customer-controlled private deployment may reduce data disclosure but cannot guarantee perfect security. Each deployment model (on-premises, isolated cloud tenant, local app) needs an independently reviewed threat model. Compatibility with macOS, Windows and Linux has **not** been tested for this prototype. A new OS kernel is not planned.

## Threat model · examples

| Threat | Lab response | Production requirement |
| --- | --- | --- |
| Cross-tenant access | Exact fictional tenant mismatch denied | Actual process/VM isolation, authenticated service identities and keys |
| Unapproved actions | Exact in-memory grant required | Cryptographically bound approvals and real identity |
| Replay / revoked approval | Caller-provided lists checked | Atomic durable replay ledger and signed revocation |
| STOP during execution | Only pre-admission STOP checked | Authenticated remote/OS kill switch, in-flight cancellation, recovery |
| Excessive CPU / API cost | Fictional integer budgets checked | Hard resource ceilings, durable accounting, billing controls |
| Data exfiltration | No external adapters exist | Default-deny network policy, DLP, audit and data governance |
| Malicious model output | No model calls allowed | Validated tool schemas, independent authorization and sandbox |

## Mandatory production gates

1. Independent source and security review before any live adapter.
2. OS-level tenant isolation and least-privilege service accounts.
3. Signed/versioned policies, identity and key management, authenticated audit evidence.
4. Durable transactional consent, STOP, revocation and replay prevention across crashes.
5. Real device testing and matched p50/p95 performance-quality-cost benchmarks (see BENCHMARK_PLAN.md).
6. Licensing, GDPR and contract review before use of real company data.

**Coordination:** #279 owns only new files under experiments/unfire-enterprise-policy/. Keep the PR draft and unmerged. No app, website, releases, external integrations, deployment, outreach or spending.
