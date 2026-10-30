# Unfire OS Layer · Mission Control · Research v0.1

**State: isolated offline prototype.** Not a native operating system, installed service, connected ChatGPT workspace, multi-agent deployment, AI model, remote bridge or shipping application.

## Vision
One coordinator can plan work for multiple specialist agents using one or more approved models. Specialists operate in **Discover, Build, Verify, Deliver** lanes, with explicit dependencies, scoped permissions, single-writer artifact reservations and a final human release gate.

This prototype only simulates the schedule and performs allowlisted pure transformations. It performs **zero model calls, zero network requests and zero OS operations on behalf of an agent**.

## Run in a disposable local workspace
- Prerequisite: recent Node.js runtime. No additional packages or subscription.
- Tests: `node --test experiments/unfire-os-layer/core.test.mjs experiments/unfire-os-layer/superchat.test.mjs`
- Visual dashboard: `node experiments/unfire-os-layer/serve.mjs`; open `http://127.0.0.1:4177/` on the same machine.
- Stop local preview manually with Ctrl+C. No installation, daemon, privileged changes or auto-start.
- The preview binds to loopback, has a fixed allowlist of static read-only assets and forbids outgoing browser connections with its CSP. No persistence or telemetry.

## What works today (research only)
- Strict manifest validation, deterministic task dependency ordering, detection of cycles/duplicate IDs/unknown operations.
- Allowlisted synthetic functions: uppercase, word count, numeric sum.
- Explicit approval flag for synthetic tasks and a STOP callback before each pure step.
- Research mission template with **7 roles and 4 lanes**.
- Offline capacity planning: 1–8 *virtual* concurrent slots, dependencies, artifact reservations, and distinct write/release authorization gates.
- Interactive accessible dashboard with mission input, concurrency setting, simulated approval, STOP, sequential wave simulation, event log and mobile layout.
- Audit events only exist in volatile UI memory; they are **not** durable, tamper-evident or independently verified.

## What is not implemented
- Real agents, ChatGPT session coordination, LLM inference, live web searches or third-party tools.
- Shared persistent memory, GitHub write locks, authentication, identity federation, OS process scheduling or remote device control.
- True concurrency; waves describe *possible* parallel work, but the demo executes no workers.
- Production access policies, background daemons, deployment, provider credentials, payments or public release.
- Measured speedups or independent benchmarks.

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
Branch `research/unfire-os-layer-20261030`, all files under `experiments/unfire-os-layer/`. This is an independent proposal for issue #247. Global #78; AI research #242; safety/legal #140; release #215. No merge or production publication. One authorized integrator if a release is eventually considered.
