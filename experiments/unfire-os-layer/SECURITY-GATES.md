# Unfire OS Layer · Agent Isolation and Portability Gates

**Status: research design, not an installed sandbox or OS.** The current project has an offline scheduler, local journal, operator session and optional explicitly provisioned short-lived research identities. **No actual AI provider, model, chat account, tool execution or operating-system worker is connected.**

## Trust boundaries

| Boundary | Current behavior | Required before real workloads |
|---|---|---|
| Operator browser → local service | Temporary bearer token, local binding and strict origin on writes | Trusted local operator identity, secure session lifecycle, private route review, no shared-host assumption |
| Research client → local service | Random 256-bit credential, digest stored in-memory, explicit action/artifact scope, 30-minute max TTL, in-process revocation | Provisioning from a verified operating-system principal, binding to a worker instance and key rotation |
| Agent output → mission memory | Strict event types and names, owner attribution from token | Separate evidence provenance, task ID, content hash and independent verification |
| Mission memory → host filesystem | Owner-private dedicated directory, append-only journal and exclusive writer lock | OS-enforced isolation, no symlink or TOCTOU escapes, backups, per-tenant isolation and signed audit |
| Multi-agent artifact access | Exclusive claim checked by local journal | Durable leases with fencing tokens, optimistic revision checks, crash recovery and one writer per path |
| Execution boundary | **No subprocess or untrusted code execution exists** | Disposable sandboxes with limits, exit/timeout/STOP enforcement and zero ambient credentials |
| Remote bridge | **Not implemented** | mTLS and explicitly paired devices, precise service scopes, revocation, offline fallback |

## Baseline security policy

1. The default configuration provisions **zero** agent credentials. A trusted local developer must explicitly issue a role with only necessary capabilities.
2. No research agent can grant permissions, create a mission, press STOP, publish, pay, send messages or call an operating-system command.
3. Agent bearer credentials are not proof that a specific AI provider or model is on the other end. Avoid describing them as certified identities.
4. The current local service never exposes an HTTP token-issuance endpoint. Revocation is an in-process operator/developer action.
5. All incoming tool output, files, web data and model responses are untrusted even when the agent has a valid credential. Agent text cannot override permission policy.
6. STOP takes precedence over queued tasks. For future external side effects use cooperative cancellation and explicit compensation workflows. Do not promise unconditional rollback.
7. No repository filesystem write, private customer data, credentials, camera, audio, desktop control, mass outreach or app publishing until an OS-enforced sandbox and security review pass.

## Host-specific implementation research

- **macOS:** explore a separately signed, hardened and sandboxed helper with entitlement-scoped resources and user-selected document access. Apple App Sandbox is an OS-enforced permission boundary; a Node token registry is not. Source: https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox
- **Windows:** explore AppContainer or equivalent restricted worker identities and appropriate broker APIs; distinguish desktop Win32 security from general arbitrary process automation. Source: https://learn.microsoft.com/en-us/windows/security/book/application-security/application-isolation
- **Linux:** explore user namespaces, process isolation and supported Landlock filesystem/network limits where available. Kernel capability and Landlock ABI must be feature-checked on each device. Source: https://docs.kernel.org/userspace-api/landlock.html
- **Bridge:** preserve the host OS. macOS, Windows and Linux run their own approved adapters and exchange _tasks_, not native executable formats. No implicit control of university or enterprise systems; pairing must be opt-in.

## Security acceptance tests before any real model/tool connector

- Cross-agent identity impersonation and token theft/replay.
- Unauthorized read, write, release, publish and STOP actions.
- Arbitrary filesystem path traversal, symlinks and locked artifacts.
- Revocation/expiry during outstanding work; tasks must fail closed.
- Concurrency, journal corruption and crash recovery with fencing.
- Untrusted prompt injection in documents and responses, tool-command laundering and data exfiltration.
- Denial-of-service, resource exhaustion, cancellation, audio-workload coexistence, and bounded execution.
- Cross-platform tests on real supported hardware. Never infer support from a VM or simulated environment alone.
- Accessibility checks for reduced motion, screen-reader announcements, keyboard navigation, human approval and emergency STOP.

## Performance acceptance tests

Use the **same task, model/provider, hardware, quality rubric and evidence**. Compare one worker versus bounded multi-agent dispatch. Record p50/p95 completion time, correct completion rate, conflicted edits, discarded research, model tokens and API costs, CPU/RAM/thermal load, concurrency saturation, and time to human approval. A larger agent count is not automatically faster.

## Release and compliance

Research owner: issue #247, draft PR #248; benchmarks #242, global coordination #78, legal #140, release #215. The UI must accurately distinguish _simulated_, _provisioned_ and _connected_. A green test means the isolated test passed, **not** that an AI OS, enterprise integration, secure kernel sandbox or live agent network exists. No public deployment, fees or release without separate verification.
