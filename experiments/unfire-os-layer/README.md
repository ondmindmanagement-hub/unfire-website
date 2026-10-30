# Unfire OS Layer · Research Prototype 0.1

**State:** isolated synthetic prototype. No agent backend, operating-system service, third-party connectivity, privileged adapter, file access, shell access, or network access. Not a native operating system or shipping product.

## Objective
Investigate a portable coordination model built around tasks, dependencies, explicit approval, default-deny capability policies, STOP, audit and resource-aware scheduling. The future interface can integrate verified local or remote agents only after consent, isolation, authentication and security reviews.

## Run
- **Tests:** `node --test experiments/unfire-os-layer/core.test.mjs`
- **Dashboard:** `node experiments/unfire-os-layer/serve.mjs` then visit `http://127.0.0.1:4177/`.
- **No external Node packages required.** Server binds to loopback only, serves a strict fixed allowlist of static files, has no endpoints that execute commands and no telemetry.
- To keep the host untouched, run only if you deliberately choose to; no installer, daemon, auto-start or permission prompts.

## Architecture
1. **Workspace (planned):** projects, immutable task specifications, versions and evidence.
2. **Planner (implemented subset):** DAG validation, up to 16 deterministic demo operations, strict operation allowlist.
3. **Policy (implemented subset):** task approval gate and synchronous STOP checks. Future adapters require per-tool, per-path and per-domain authorization, not a global switch.
4. **Execution (demo only):** text uppercase, word count and numerical sum. No actual LLM, subprocess, filesystem, UI automation or OS resource controls.
5. **Audit (demo only):** local volatile event records, downloadable user-initiated JSON export. Not tamper-resistant.
6. **Adapters (not implemented):** OS-specific connectors, authenticated MCP tools and A2A agent links, all disabled by default.

## Threat model
- Treat natural-language instructions, project files and remote agent output as untrusted.
- Model approval as explicit, scoped, expiring and revocable authorization. The demo checkbox is **not production authorization**.
- Require an OS-enforced sandbox for real code execution; JavaScript policy checks by themselves are not a security boundary.
- Build proper identity, per-agent permissions, authenticated cross-platform transport, signed updates, secret isolation, quotas, retries and replay protection **before** enabling real integrations.
- Enforce workspace isolation, a single writer per artifact, checkpoints and rollback options for future worktrees.
- Collect no sensitive data in this demo. Do not enter keys or personal information into sample inputs. No cloud costs are incurred.

## Product requirements for future research
- Usability: keyboard navigation, responsive layout, readable type, understandable human approvals and STOP.
- Reliability: reproducible p50/p95 job time, task success/quality and error recovery against a same-hardware baseline.
- Resource budgets: preserve audio/desktop responsiveness; no heavy builds while Logic is recording.
- Portability: macOS, Windows and Linux implementations must be independently tested. "One workspace" does not mean arbitrary cross-platform executable compatibility.
- Research a Linux VM only after independent proof of value. Never replace or modify the host boot chain.

## Ownership
Dedicated branch `research/unfire-os-layer-20261030`, new files within this directory only. Issue #247. Links: global #78; AI performance #242; legal #140; release #215; Unfire Control #50. No merge or public product announcement from this prototype.
