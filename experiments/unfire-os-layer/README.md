# Unfire OS Layer · Mission Control and Local Memory · Research v0.9

**State: isolated offline prototype.** Not a native operating system, installed service, connected ChatGPT workspace, multi-agent deployment, AI model, remote bridge or shipping application.

## Vision
One coordinator can plan work for multiple specialist agents using one or more approved models. Specialists operate in **Discover, Build, Verify, Deliver** lanes, with explicit dependencies, scoped permissions, single-writer artifact reservations and a final human release gate.

The planner simulates waves. The separate Mission Memory console sends authenticated *loopback* HTTP requests for a limited journal API. A further **trusted, local-only broker** executes one genuinely sandboxed native Swift worker for three pure, synthetic operations, currently only in ephemeral macOS CI. There are **zero model calls, zero remote agents, zero production file mutations and zero public network connections**.

## Run in a disposable local workspace
- Prerequisite: recent Node.js runtime. No additional packages or subscription.
- Tests: `node --test experiments/unfire-os-layer/core.test.mjs experiments/unfire-os-layer/superchat.test.mjs experiments/unfire-os-layer/memory.test.mjs experiments/unfire-os-layer/mission-service.test.mjs`
- Visual dashboard: `node experiments/unfire-os-layer/serve.mjs`; open `http://127.0.0.1:4177/` on the same machine.
- Separate **local memory console** (manual, not installed): `node experiments/unfire-os-layer/mission-service.mjs /absolute/dedicated/private/workspace demo`. Copy the printed one-time URL from the local terminal into the same machine's browser. This URL includes a temporary secret in its fragment. Do not share it. Choose an empty, explicitly dedicated workspace, not an existing user project folder.
- The memory console binds only to `127.0.0.1:4178` and requires a fresh 256-bit session token for all memory API requests, checks the request Host and POST Origin, accepts only JSON operations from a strict allowlist, and expires access after 2 hours. The client hides the token from the address bar after loading and retains it in that tab's `sessionStorage` for reloads. This is **not** OS-user authentication or remote agent identity.
- Stop either local preview manually with Ctrl+C. No installation, daemon, privileged changes or auto-start.
- The preview binds to loopback, has a fixed allowlist of static read-only assets and forbids outgoing browser connections with its CSP. No persistence or telemetry.

## What works today (research only)
- Strict manifest validation, deterministic task dependency ordering, detection of cycles/duplicate IDs/unknown operations.
- Allowlisted synthetic functions: uppercase, word count, numeric sum.
- Explicit approval flag for synthetic tasks and a STOP callback before each pure step.
- Research mission template with **7 roles and 4 lanes**.
- Offline capacity planning: 1–8 *virtual* concurrent slots, dependencies, artifact reservations, and distinct write/release authorization gates.
- Interactive accessible dashboard with mission input, concurrency setting, simulated approval, STOP, sequential wave simulation, event log and mobile layout.
- The original simulation dashboard's event log remains volatile. The **separate** manual Mission Memory console now connects to `memory.mjs` through the local session-gated service. The owner-private journal supports SHA-256 hash chaining, state replay, a single-writer lock and capability policy. It is not connected to the simulated agents, nor tamper-proof against a same-user attacker.

## What is not implemented
- Real agents, ChatGPT session coordination, LLM inference, live web searches or third-party tools.
- Authenticated shared memory across multiple real agents or devices, OS-user identity, GitHub write locks, identity federation, OS process scheduling or remote device control.
- Real multiagent concurrency; waves describe *possible* parallel work. Only the separate trusted broker can start a single, tightly allowlisted synthetic macOS worker in test environments.
- Production access policies, background daemons, deployment, provider credentials, payments or public release.
- Measured speedups or independent benchmarks.

## New local memory research module
- `LocalMissionMemory.open(absoluteWorkspaceDirectory)` creates or opens an explicit owner-private workspace (0700) and an append-only event journal (0600), with no telemetry or network access.
- Events: mission creation, artifact claim/release, task completion and persistent mission STOP; strict identifiers and bounded payloads.
- The journal uses a SHA-256 hash chain to detect accidental corruption and simple tampering, and rejects broken state transitions. A same-user attacker can rewrite and rehash it: **not a signature or production audit guarantee**.
- A directory-based exclusive lock rejects simultaneous append attempts rather than retrying. If a process crashes with a stale lock, writes intentionally fail closed until an operator reviews and clears it. No automatic lock theft.
- `MemoryPolicy` checks actor, mission, action, optional artifact and expiry. The HTTP service fixes the actor to `operator` server-side; callers cannot choose an agent identity, but this only authenticates possession of the temporary session token. OS user identity, cross-agent permissions and multi-tenant isolation are **not** implemented. Direct local code that can access the store could bypass the service policy.
- The console and memory work only for a **single manual operator**; it does not authorize remote agents. No private customer, founder or API-key content should be stored in this research version.

## Verification performed
- 31 October 2026: Node tests on the authorized Mac in a temporary directory: **66 passed, 0 failed** as of the initial service commit, including 14 HTTP security and persistence cases, 18 memory cases and 34 existing planner/runtime cases; no additional package installation. Later changes are subject to the dedicated CI workflow.
- Chrome headless with a temporary profile: the **original offline simulation dashboard** passed DOM, responsive overflow and interaction assertions at 1440×900, 390×844 and 320×740. Seven agents remain **simulated**, not connected. The new connected memory console has a dedicated optional browser QA script; a complete passing browser QA result for this new console is not yet recorded.
- QA does not certify production security, accessibility compliance, physical devices, cross-OS interoperability or performance improvements. No production changes, merges or installations.

## Research agent credentials (v0.3, not actual AI agents)

- `agent-identity.mjs` provides an in-memory registry for short-lived, random 256-bit bearer credentials. Only a trusted local caller can provision a research actor; there is no HTTP issuance route. SHA-256 token digests, not original secrets, are retained in the registry. A credential expires after at most 30 minutes and can be revoked by the trusted caller.
- Research roles are **disabled by default** (`agentSpecs: []`). At most eight roles may be explicitly provisioned. Each has an action allowlist (`state:read`, `artifact:claim`, `artifact:release`, `task:complete`) and optional explicit artifact names. Roles with artifact write permissions require at least one specific artifact.
- `mission-service.mjs` offers `GET /api/agent/state` with the scoped mission summary, and `POST /api/agent/events` for narrowly granted claim/release/manual task checkpoints. It fixes the actor name from the credential, never from submitted JSON. Only the human operator session may create or STOP a mission.
- Operator STOP still invalidates further task events from research agents. No OS command, web search, repository file write, local process, AI model or chat session is executed by the gateway.
- **Crucial:** A token is not a verified AI identity and is not bound to an OS sandbox, model provider or particular client binary. A holder can act under its limited pseudonymous role, including fabricating a manual task-completion claim; this is not independently validated work. Do not distribute agent tokens to third-party clients or use production information in this experiment.
- The prototype remains a single-machine manual research API. **Do not deploy or expose outside loopback.** Real identity, delegated consent, sandbox, per-agent memory filtering, independent evidence and durable distributed leases remain future work.
- Threat model and host-specific acceptance gates: `experiments/unfire-os-layer/SECURITY-GATES.md`.

## Fenced research results (v0.4, journal-only)

- `fenced-results.mjs` stores short-lived **exclusive artifact leases** in a separate owner-private, hash-linked append-only journal, with atomic fail-closed file locking.
- Each new lease increments an artifact's **fencing generation**, so an old holder cannot submit or release a newer holder's artifact. Leases expire after at most five minutes and require an unguessable 256-bit lease token.
- `submit()` records only a task identifier plus the claimed SHA-256 digest of a synthetic output, never the raw output or token. Duplicate, expired, stale-generation and wrong-owner submissions are denied. Journal replay reconstructs the lease state across restarts.
- A claimed digest is **not** proof of successful execution, source truthfulness, software safety or human review. No real agent, model or repository file has been allowed to write an artifact.
- **Not yet coupled to the operator STOP journal or to HTTP agent APIs.** Do not use as a production concurrency lock: crash recovery is manual, and OS-user processes may bypass the code by writing directly to files.
- OS isolation design and explicit macOS/Windows/Linux acceptance gates: `experiments/unfire-os-layer/SANDBOX-ADAPTER-DESIGN.md`.

## Unified local coordinator (v0.5, in-process research only)

- `control-plane.mjs` is a **new, independent single journal** for mission creation, operator STOP, short-lived artifact leases, increasing fencing generations, and claimed SHA-256 result digests. These operations are ordered by the same exclusive local writer lock, removing the research-only two-journal race within this module.
- `coordinator.mjs` connects the existing **default-off**, explicitly provisioned research credential registry to this local control plane. A scoped role must have both artifact-claim and task-complete permissions to attest a result, and an exact release scope to release its lease. The agent identity is assigned from its token, not supplied by the client.
- **No live HTTP API or agent adapters are connected to this unified module.** The existing `mission-service.mjs` still uses the previous independent journal and is **not** the unified control plane. Do not infer that the browser's STOP now covers this separate research journal.
- A race between operator STOP and result acceptance is serialized. If STOP is committed first, subsequent acquisitions, attestations and releases fail. If an attestation commits first, a later STOP cannot undo that prior record. When the lock is occupied, the request fails closed; the caller must inspect state and retry deliberately.
- The log records **claims about digests**, not independently verified content or completed work. No code executes, no files are promoted, no model is called, and no cross-chat integration exists. Same-user filesystem access and stale lock recovery remain outside an OS-enforced security boundary.
- Future work: migrate only after security review to one authoritative service, implement independent evidence validation, OS-enforced worker sandbox, durable recovery/revocation, and reproducible one-agent-vs-parallel benchmarks. No production deployment or user data.
- Tests: `node --test experiments/unfire-os-layer/control-plane.test.mjs experiments/unfire-os-layer/coordinator.test.mjs`. The isolated CI workflow runs all research suites.

## Signed native macOS worker and trusted broker (v0.6–v0.7)

- `macos-worker/Worker.swift` compiles into a minimally entitled, signed background test bundle. The App Sandbox bit is verified by `codesign`. A differential denial test proves the *signed test worker* cannot read a synthetic home-directory file or connect to a synthetic localhost listener, while an unsigned baseline can. Three pure transforms still work.
- `secure-broker.mjs` is a **trusted Node parent**, not itself in App Sandbox. It verifies the exact signed test bundle and minimal entitlements, pins the executable hash, spawns only the fixed `transform` mode **without a shell**, limits input/output/time and refuses arbitrary commands. It does not accept a worker path from tasks.
- `pure-verifier.mjs` independently recomputes bounded printable-ASCII uppercase/word-count/SHA-256 results and fails closed for malformed, fabricated or unsupported output.
- For **explicitly provisioned** test credentials, the broker obtains an exclusive artifact lease through the in-process coordinator, checks the synthetic worker output, computes its digest and attests it within the same STOP/fencing journal. It does not connect ChatGPT sessions, third-party model APIs, the browser Mission Console, real repositories or customer files.
- The `macos-worker/verify-sandbox.sh` check runs only on an ephemeral GitHub-hosted macOS 15 runner. It also launches the 13-case `secure-broker.test.mjs` suite. The separate Ubuntu Node suite includes the 10-case `pure-verifier.test.mjs`.
- **Verified at commit `714865ab0add2253f3600018368200e640f0ba3b`:** 148/148 Node tests passed, 13/13 macOS broker integration tests passed, Chrome console QA passed and signed macOS sandbox file/network denial tests passed. Evidence: https://github.com/ondmindmanagement-hub/unfire-website/actions/runs/41212937705 . Subsequent documentation-only commits do not change test code but should also receive green CI.
- The validation is limited to synthetic operations on the hosted macOS runner. **Not production security:** the trusted parent remains unsandboxed; signature/hash check may have file-replacement races; there is no hard memory/CPU quota, arbitrary-code isolation, multi-agent credential issuer, independent quality assessment of AI outputs, authenticated provider, cross-platform proof or released signed application. Do not deploy the broker on an untrusted host or present it as a finished operating system.

## Broker hardening (v0.8 · synthetic research only)

- **One active worker per trusted broker instance:** an immediate second invocation fails closed. This is not a global system-wide concurrency controller and does not coordinate separate broker processes.
- The signed macOS worker applies kernel `RLIMIT_CPU=2s`, `RLIMIT_NOFILE=32`, and `RLIMIT_FSIZE=65536 bytes`. Effective limits and sandbox file/network denials were rechecked in hosted macOS CI. **RAM, GPU, total I/O, OS process trees and other machines are NOT quota-controlled by this prototype.**
- Every broker execution re-verifies the signed app and exact single App Sandbox entitlement, hashes the selected executable before and after running, and rejects detected changes. The parent still runs outside the sandbox; its checks do not fully defeat same-user filesystem replacement / time-of-check-to-time-of-use races.
- **Accepted operator STOP notifies same-process broker subscribers**; the broker can abort or SIGKILL its active synthetic child. Even if cancellation races with completion, the same-journal commit rejects a result accepted after STOP. A STOP written in a separate process is not immediately broadcast. Timeouts/cancellation cannot roll back outside side effects, though these test operations have none.
- **Verified implementation before documentation changes:** 151/151 Node tests, 17/17 hosted macOS signed-broker tests, effective worker resource limits, sandbox differential denials, and Chrome QA all passed: https://github.com/ondmindmanagement-hub/unfire-website/actions/runs/41215043658 .
- No live AI provider, arbitrary shell access, real project data, user Mac installation, release, app publication, or observed acceleration. The code stays in an unmerged research PR.

## v0.9 · Journal-observed STOP and bounded RSS supervision

- The trusted broker now polls the authoritative single-journal state while its signed synthetic macOS worker is running, in addition to receiving same-process STOP callbacks. A STOP committed by an **independent local Node process sharing the same private journal** is observable and triggers cancellation. A final attestation still requires the authoritative STOP/fencing journal to accept the record.
- The broker samples the **one known child PID** with macOS `/bin/ps` RSS in KiB every ~80 ms. The default threshold is 192 MiB, and test-only calls can select 1–512 MiB. The worker is killed and the output rejected on an observed overage or inspection error while running.
- This is **a soft, sampled memory watchdog**, NOT a kernel-enforced RAM quota: peaks between samples may escape, and this does not control the trusted broker's own RAM, descendant processes, shared memory, GPU or other hosts. Existing native Swift CPU, file descriptor and file size limits remain distinct.
- The fixed, synthetic `slow_uppercase` operation sleeps one second to exercise cancellation. It remains bounded, independent of user-selected duration and has no filesystem, network or external model access; independent verifier recomputes the output.
- Tests cover external-process STOP during a running signed worker, invalid memory-budget values, small sampled-RSS threshold cancellation and successful bounded delayed output. All happen in ephemeral CI; no local Mac installation.
- Still not production-ready: identity and signature hardening, hard memory budgets, multi-host authenticated STOP, atomic executable launch, independent evidence of AI work and a real model connection remain open. Do not promise real-time cancellation latency or universal memory safety.

## Design rules for a future secure version
1. **Single mission truth:** goal, project, scoped task IDs, dependencies, outputs, hashes, version and responsible agent.
2. **One writer per artifact:** exclusive lease keyed by project, repository/path and revision; conflict detection, lease renewal, expiry and recovery.
3. **Permission boundaries:** task-specific capability tokens; agent/tool allowlists; least privilege; separate permission for publishing, payments, messages and destructive changes.
4. **Structured evidence handoffs:** source provenance, confidence/limitations, test outcomes, exceptions and verifier signature. A second agent checks important claims without copying untrusted instructions.
5. **Queueing and resources:** bounded worker pools, priority classes, memory/GPU budgets, cancellation, timeouts, retries only for idempotent tasks, and cost ceilings.
6. **Safe execution:** isolated, disposable workers with OS-enforced sandbox and scoped credentials. Never allow unrestricted LLM-generated shell execution or global computer permissions.
7. **Portability:** adapters for macOS/Windows/Linux separately tested; do not claim programs from one OS run directly on another.
8. **Human final authority:** STOP, approval, audit and rollback where technically possible. Checkpoints before external side effects.
9. **Quality evaluation:** compare 1 coordinator / 1 worker with multi-agent strategies at equivalent task quality. Track p50/p95 latency, task success, error/rework rate, tokens/cost, CPU/RAM, conflict rate and time-to-evidence.
10. **Accessible premium UX:** English UI, keyboard interaction, reduced motion, responsive columns and clear "simulated" versus "connected" status.

## Research references
- MCP Authorization Security Considerations (2026-07-28): https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx
- A2A Task lifecycle: https://github.com/a2aproject/A2A/blob/main/docs/topics/life-of-a-task.md
- Temporal workflow tasks/durability: https://docs.temporal.io/tasks
- OWASP MCP Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html

## Ownership and release boundaries
Branch `research/unfire-os-layer-20261030`, implementation files under `experiments/unfire-os-layer/` and one standalone read-only CI workflow under `.github/workflows/unfire-os-layer-research.yml`. This is an independent proposal for issue #247. Global #78; AI research #242; safety/legal #140; release #215. No merge or production publication. One authorized integrator if a release is eventually considered.
