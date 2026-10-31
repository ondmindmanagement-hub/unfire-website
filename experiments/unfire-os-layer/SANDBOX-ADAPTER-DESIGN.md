# Unfire OS · Host-enforced worker isolation gate

**Status: architecture candidate only, not a deployed sandbox.** This file defines acceptance conditions before Unfire can run real agent-authored tools or untrusted workloads. The existing Node research services and fenced result ledger are not operating-system security boundaries.

## Safe design

Keep the **Control Plane** (mission identity, permissions, append-only events, STOP, fencing generations) outside worker sandboxes. A **Worker Plane** receives a single approved, immutable job specification, a temporary scoped input directory and a constrained output channel. Workers never receive broad host credentials, all-project filesystem access or unapproved shell tools. A separate human-controlled **Review Plane** checks digest, source provenance, tests, resource usage and task quality before promoting an output.

**Important:** The current `fenced-results.mjs` records only a claimed SHA-256 digest and a lease generation. A digest does not prove a task succeeded, a model ran, a source is accurate or a file is safe. No untrusted worker is connected.

## Platform evaluation

| Host | OS isolation approach to investigate | Proof required before saying "sandboxed" |
|---|---|---|
| macOS | Build a new **signed and sandbox-entitled** native helper in a separate Xcode target, with only user-approved folders and necessary entitlements; inspect Activity Monitor Sandbox state, codesign and entitlement output. | OS-enforced denial of unrelated files, other apps, network and protected devices; real macOS test, stop and resource limits; notarization and rights review before distribution |
| Windows | Test packaged **AppContainer** process isolation with explicit capabilities and broker, ideally including separate identity and per-worker filesystem grants. | Real Windows test with denied host folders, process/registry/network reachability, revocation and update validation; do not mistake ordinary MSIX virtualization for AppContainer |
| Linux | Probe the installed kernel's **Landlock ABI** and support; combine restrictive Landlock filesystem/network controls with independently tested process isolation, resource quotas, capability drops and seccomp as appropriate. | Host-specific syscall/ABI detection and actual denial tests. If the policy cannot be enforced, fail closed and mark worker unsupported; never silently run unsandboxed |

Official references:
- Apple: https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox
- Apple: https://developer.apple.com/documentation/security/app-sandbox
- Microsoft: https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation
- Microsoft: https://learn.microsoft.com/en-us/windows/msix/msix-containerization-overview
- Linux kernel: https://docs.kernel.org/userspace-api/landlock.html

## Non-negotiable rejection tests

1. A worker without permissions cannot access any project outside its exact assigned workspace; symlink, traversal, opened descriptor and inherited-handle attacks must be examined.
2. A worker has zero ambient cloud/API, mailbox, GitHub, or payment secrets; approved network access must be explicitly restricted by destination and purpose.
3. A STOP request prevents new jobs, revokes future leases, and cancels active jobs within a documented timeout. External side effects cannot be assumed reversible.
4. Fencing generation is validated by the authoritative **commit/promotion service**, not only by workers. Stale result submission must fail after the output's lease expires or is replaced.
5. The output validator receives **untrusted** results through a bounded channel, scans types and size, hashes exact content, and requires separate quality checks.
6. Resource budgets must protect the host's interactive workloads: low-priority queue, concurrent limit, per-worker memory/CPU limits, I/O and disk quotas. A workspace must not degrade Logic Pro or recording audio.
7. The adapter must be independently tested on macOS, Windows and Linux before advertising cross-platform compatibility. A Linux-only CI green test is not a macOS security certification.

## Ordered implementation gates

- **G0 · Completed in research:** default-off scoped role tokens; local journal; operator STOP; independent fenced claim/result ledger with increasing generations and SHA-256 digests.
- **G1 · Next:** integrate fenced results into operator STOP and agent identity in a **single serialized control-plane transaction**. Avoid race between STOP and an in-flight result; fail closed when synchronization is uncertain.
- **G2 · After G1:** implement the macOS sandbox helper as a separate isolated Xcode target, with minimal entitlements and zero network by default.
- **G3 · After OS-denial tests:** connect one **real, low-risk** agent to a synthetic task with bounded inputs. Require a real verifier, explicit human approval and no host-file writes.
- **G4 · Validation:** compare a single verified agent with bounded parallel agents for p50/p95 latency, correct completion, conflicts, resource usage and total cost. No marketing acceleration claims before reproducible evidence.
- **G5 · Only after release gates:** design an optional authenticated Unfire Bridge for approved cross-OS devices. Never replace the host OS without a separate product decision.

This is an independent research design for #247 / draft PR #248. Keep implementation isolated from app releases, game, camera/microphone, university systems and customer data. No new purchases, backend accounts, runtime installations, external publication or auto-deployment.
