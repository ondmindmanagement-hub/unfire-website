# Unfire Continuum Enterprise · System Blueprint v0.1

**3 November 2026. Research/design specification only. Not a shipped private OS, integrated application suite, licensed enterprise service, security certification, or customer contract.**

## North star

An organisation-specific **private, controlled AI work environment** with continuous, evidence-based coordination. Use the customer's existing macOS, Windows and Linux systems. Optional isolated Linux deployment can be evaluated after real platform tests. Do not build a kernel, promise a universal 1,000x speedup, or require a company to replace its existing OS.

**Product contract:** coordinate work continuously **when an explicitly authorized service is running**, within stated resource/quota, identity, availability and approval limits. No indefinite autonomous work claim.

## Product roles · reuse before building

| Capability | Existing Unfire direction | Boundary / decision |
| --- | --- | --- |
| Continuous operations | **Unfire Continuum** | Canonical task index, ownership, claim/lease, handoff, portfolio status and resource-aware scheduling. One existing index writer; do not spawn a duplicate supervisor |
| AI-guided task execution | **Unfire Autonomy** | Plan and carry out only capability-scoped, explicit and authorized tasks; cannot approve its own privileged actions |
| Human overview | **Mission Control** | Evidence-backed work queue, progress, approvals, failures and STOP; never count planned work as completed |
| Permission and oversight | **Permissions + Bolt** | Policy checks, human review, audit, STOP/rollback where technically supported; production trust boundaries not yet certified |
| Optional integrations | **Unfire Bridge / Exchange** | Customer-authorized adapters for apps, services and workspaces; default off, no silent access |
| Efficiency | **DC Boost + AI Fuel** | Diagnostic evidence, model-routing/caching/cost evaluation and budgets; do not manipulate another app or promise universal hardware acceleration |
| Verification | **Unfire Assurance** | Independently check outcomes and reconcile exceptions before a workflow becomes VERIFIED |
| Agent coordination | **Nexus / Mission Ops** | Reuse existing agents, ownership and handoff services; do not create rival role directories or duplicate indexes |
| Optional interaction | **Unfire Control** | Alternative local input mode only with consent, privacy, accessibility and device validation |

**Inventory caveat:** app/module names denote existing research directions or local products, not proof of a production-connected suite. Native signing/notarisation, cross-product APIs and platform QA have unresolved gates (#242).

## Canonical responsibility model

1. **Continuum owns** task lifecycle, deduplication, source provenance, dependency DAG, ownership leases, handoffs, evidence state and bounded continuous scheduling. Existing 13-category Operations Center index is the canonical read-only overview; protect its single-writer invariant.
2. **Autonomy owns** AI reasoning and explicit tool proposals. It requests capabilities; it never asserts authorization by itself.
3. **Permissions and Bolt own** authorization and safety decisions. A capability is task-, actor-, tenant-, resource- and time-scoped. High-impact operations require human presence and separately authenticated consent.
4. **Execution layer owns** a verified operation adapter with OS-enforced confinement. Prefer direct typed APIs over remote desktop clicks when legitimate. No raw arbitrary shell from model output.
5. **Bridge owns** optional transport to expressly enrolled systems. Default-deny outbound connections, no cross-customer data flow.
6. **Assurance owns** result verification. A task is only marked complete after independently checkable output and agreed criteria; idempotency and crash recovery need durable evidence.
7. **Enterprise control plane owns** tenant policy, SSO integration, tenant-owned encryption keys and deployment profile. The synthetic policy lab implements ONLY non-authoritative eligibility checking.

## Tenant isolation and data flows

- Every organisation must have an independently authenticated tenant identity, identity provider integration where practical, encrypted tenant data store, versioned policy, key boundary, auditable entitlements, retention/deletion rules and isolated workloads. Tenant name equality in JSON **does not create security isolation**.
- Four deployment models to evaluate: local single-organisation application, customer-hosted isolated infrastructure, dedicated cloud installation with customer-managed policy, and (later) hardened managed Linux environment.
- Do not advertise multi-tenancy secure until actual OS/container/VM/process identity, filesystem/network isolation, secret storage and destructive tests are independently reviewed.
- Offline local workflow can operate only with previously authorized local capabilities; reconcile and obtain fresh approval when reconnecting.
- Use service-to-service mutual authentication and authenticated event contracts, not an unsecured all-powerful Desktop Commander bridge.

## Continuum contract (future adapters, no live connector here)

A **read-only** snapshot may expose: tenant-scoped opaque task id, owner role, claim expiry, status, evidence receipt identifiers, resource budget class, cost estimate, local STOP epoch, dependency identifiers, and bounded summary health. It must not expose raw user prompts, email bodies, personal file paths, credentials or private customer content.

Status transition: PLANNED → CLAIMED → RUNNING → EVIDENCE_READY → VERIFIED. FAILED, BLOCKED, CANCELLED and STOPPED are distinct; queued/assigned work is never represented as finished. A source owner retains the authoritative state. Adapter writes require authenticated, revision-pinned transactions, consent, one-writer ownership and idempotent delivery.

The adapter must refuse stale revisions, unknown fields, cross-tenant task references, missing evidence, unsafe replay, revoked consent and STOP. Lost network or unclear identity fails closed instead of assuming success.

## Additional developer modules · build only where a verified gap exists

**P0 · Enterprise Policy Pack (in progress).** Pure eligibility validator now; later signed policy distribution, revoke/STOP and actual isolated enforcement. Avoid a second Permissions app.

**P1 · Unfire Evidence Vault.** A module within Assurance/Continuum for immutable, minimal, tenant-bound evidence receipts, provenance and retention. Scope first: synthetic signatures and independently testable replay checks. Do not duplicate Bolt ledger or store raw customer data by default.

**P1 · Unfire Workflow Benchmark Kit.** Portable reproducible harness comparing identical tasks, output quality, time, CPU/RAM, tokens and cost. Keep it a developer module inside DC Boost/AI Fuel, not another paid desktop utility.

**P2 · Unfire Adapter SDK.** Typed capability contracts, scopes, consent schemas, STOP/cancel handshake and test mocks for Bridge. No arbitrary browser/terminal control, vendor secrets or live integrations until reviewed.

**P2 · Unfire Recovery Kit.** Continuum/Mission Ops recovery verification, one-writer reconciliation, crash-safe leases, restore drills and non-destructive snapshots. Do not add another always-on daemon.

**P3 · Unfire Enterprise Design System.** Shared UI tokens, screen contracts and accessibility gates for Continuum/Autonomy/Mission Control, not a fourth separate control panel.

Promote any candidate to a new standalone app only when a product owner documents a unique customer problem, independent UX, code ownership, maintenance budget, no overlap and validated benefit.

## Information architecture · truthful console

The existing Continuum 13-category index remains the organisational substrate. Enterprise should provide **one consolidated console**, not a proliferation of disconnected dashboards:

- **Overview:** verifiable work state, owner, data freshness, system health, critical BLOCKED counts. Show "Not connected" when unavailable, never zeros that imply inactivity.
- **Work:** tasks, dependencies, owners, approvals, handoffs, batch status and evidence links.
- **Agents:** authenticated providers, real running vs configured, reserved resources, task traces.
- **Trust:** tenant policies, scopes, revocation, STOP, audit and recovery readiness.
- **Systems:** explicitly connected local/remote apps via Bridge with per-system consent.
- **Performance:** baseline vs measured results, quality/cost/energy impact, p50/p95.
- **Administration:** data retention, identity providers, access reviews, release version and update gates.

Map the remaining Continuum Operations Center categories through its current source schema without overwriting or renaming the canonical index.

## Visual direction · "beauty absolute" as measurable quality

- One recognisable Unfire language, preserving approved icons and artwork. Interface and all public developer docs in **English**; no em dash typography in public text.
- Quiet enterprise design: high contrast, neutral surfaces, measured accent, strong hierarchy, generous spacing, clear typography and restrained motion.
- Primary decision per screen; visible global STOP that cannot be confused with a decorative button. Source timestamps adjacent to all real metrics.
- Desktop keyboard first; accessible tablet and narrow mobile layouts. Respect reduced motion, Dynamic Type, VoiceOver/assistive labels and WCAG contrast.
- Reproduce loading, offline, stale, partial failure, denied approval, STOP, quota exhausted, no data and empty states.
- No fabricated charts, runtime speed, customers, certifications, "live" labels or app preview screenshots. Use clear prototype data labels.
- Design review: 1440 px, 1024 px, 768 px, 390 px and 320 px snapshots, keyboard, high contrast, screen reader, no overflow, stable CPU while Logic or other critical apps are active.

## Security & privacy acceptance

1. Legitimate hardware/tenant identity and minimum-role permissions.
2. Authenticated policy/approval signing with tenant-separated keys.
3. OS-enforced sandboxing, per-adapter allowlists and no shared execution secrets.
4. Durable, replay-resistant evidence, revocations and revocation-on-restart.
5. Actual STOP tested during in-flight operations and crash recovery; prevent stale callbacks from committing.
6. No network by default; access log, security updates and safe rollback, enterprise backup/restore.
7. Data minimisation and documented customer-controlled retention; legal review for GDPR and AI Act applicability.
8. Red team invalid input, confused-deputy attacks, prompt injection, lateral movement and resource exhaustion.
9. Host OS and software release codesigning/notarisation verified where appropriate.
10. No employee surveillance or automated high-stakes HR decisions without a separate legal/safety assessment.

## Coordination decisions from private inspection · 3 November 2026

Read-only inventory of the authorized Mac revealed existing Continuum engine modules for operations, dispatcher, parallel engines, provider fallback, AI orchestration, workspaces, risk, signing inbox, signature workflows, bridge, test suites and several candidate builds. No files were edited. Previous recorded remediation addressed competing writers of the Operations Center index and a restart loop. An installed app or a candidate build is **not** equivalent to distributed enterprise readiness; independent integrated app QA is still missing.

**Do not touch** the occupied \`Desktop/Unfire/Products/UnfireContinuum_20261101/\` source or installed apps from this research branch. Coordination links: global #78; Continuum private workspace; OS Layer #247; enterprise policy #279; AI efficiency #242; Nexus #193; product catalogue #173.

## Sequence

- **R0:** inventory and responsibility map, synthetic policy engine + tests, architecture, benchmark methodology (this branch).
- **R1:** read-only typed Continuum snapshot adapter on synthetic fixtures, owner-approved contracts and exact revision.
- **R2:** separately authenticated sandboxed local operation proof, real STOP and consent, no production data.
- **R3:** signed and reproducible integrated macOS pilot with real measured baseline and independent threat review.
- **R4:** real Windows/Linux testing, explicit customer-owned deployment, data contracts, paid pilot only if legally and commercially cleared.

**No merge, live deployments, paid services, contacts, signing, publication or modifications to currently running Continuum processes by this document.**
