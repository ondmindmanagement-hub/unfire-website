# Unfire OS Layer · Mission Control and Local Memory · Research v0.2

**State: isolated offline prototype.** Not a native operating system, installed service, connected ChatGPT workspace, multi-agent deployment, AI model, remote bridge or shipping application.

## Vision
One coordinator can plan work for multiple specialist agents using one or more approved models. Specialists operate in **Discover, Build, Verify, Deliver** lanes, with explicit dependencies, scoped permissions, single-writer artifact reservations and a final human release gate.

The planner simulates waves and pure transformations. The new **separate** Mission Memory console sends authenticated *loopback* HTTP requests for a limited journal API. It performs **zero model calls, zero external network requests and zero OS operations on behalf of an agent**.

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
- True concurrency; waves describe *possible* parallel work, but the demo executes no workers.
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
- QA does not certify security, accessibility compliance, physical devices, cross-OS interoperability or performance improvements. No production changes, merges or installations.

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
