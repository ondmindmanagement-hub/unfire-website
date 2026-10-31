# Unfire OS · macOS Native Worker Research

**Not an installed app, deployed agent, OS kernel, production sandbox service or Unfire OS release.**

This directory holds a minimal Swift executable, a single App Sandbox entitlement, a macOS-only hosted CI verification script, and tests of a trusted local Node broker. The test-only broker connects the synthetic worker to the in-process research coordinator without exposing a public HTTP endpoint.

## Files

- `Worker.swift`: bounded standard-input JSON parser for three deterministic operations: uppercase, word count, and SHA-256. It performs no external calls and has no general file/process execution API.
- `Worker.entitlements`: only `com.apple.security.app-sandbox = true`. No file, network, camera, microphone or system automation grants.
- `verify-sandbox.sh`: compiles a synthetic research binary, signs it with an ad-hoc signature, verifies embedded entitlements, and tests whether the signed process is denied access to a **synthetic** home-directory file and a **synthetic** loopback listener. An unsigned control binary must be permitted access to both, avoiding false positives.

## Execution and review

The CI workflow `native-macos-sandbox` runs on an **ephemeral GitHub-hosted macOS runner** for the public repository. It cleans the scratch build directory and temporary synthetic home-directory file. It does **not** run on the user's Mac, install software, access personal files, invoke AI agents, open project files, or publish artifacts.

The probes are deliberate denial tests, not general capabilities available to a model. If either synthetic denial does not hold, the test fails: no unsandboxed fallback or silently expanding entitlements.

## Trusted local broker (v0.7)

- `../secure-broker.mjs` accepts only the fixed, canonical `UnfireResearchWorker.app` bundle path from a **trusted local caller**, not from a task. It checks the macOS code signature and requires exactly one entitlement: `com.apple.security.app-sandbox = true`. It pins a digest of the executable and rejects detected changes before launching it.
- Child execution uses `spawn` with fixed `transform` mode, **no shell**, a minimal environment, bounded stdout/stderr, and timeouts (100 to 5000 ms). It does not enable arbitrary Swift commands, the worker's denial probes, file access or network.
- `../pure-verifier.mjs` is a separate deterministic verifier. Inputs are printable ASCII strings, at most 512 characters. It recomputes uppercase, word count or SHA-256 from the original input and rejects incorrect, excessive or unexpected worker output. **This is not a general quality, security or AI-output verifier.**
- `executeAndAttest` requires an existing research mission, explicit short-lived credential, scoped artifact lease and STOP-free control-plane state. Only a result that passes deterministic verification is hashed by the trusted broker and submitted to the journal. A racing operator STOP blocks subsequent attestation; earlier accepted events are not retroactively undone.
- GitHub-hosted macOS CI runs 13 negative and integration checks from `../secure-broker.test.mjs`: signature checks, unsigned path rejection, modified binary detection, permission failures, aborted/invalid tasks, STOP and correctly scoped digest attestation. All actions use disposable synthetic data.
- The Node broker itself runs as a trusted process **outside App Sandbox**. It is not safe to expose as a remote service. Signature pinning does not eliminate all file-replacement races, nor does the test enforce CPU/RAM quotas, model identity, evidence provenance for arbitrary work, or real-world file publishing.

## Security limits

A signed command-line test executable is not yet an approved Xcode app/helper distribution design. Before real integration, provide a separately reviewed signed Xcode target or XPC service, verified identity, input/output validation and scope, inherited descriptor audit, reliable cancellation, credential separation, resource budgets and release/security verification. Terminal/CI permissions and sandbox behavior may differ across macOS versions. Re-run real OS denial tests for each supported target system.

The unified in-process research coordinator, its operator STOP and its fenced result journal **are connected to this native worker only by the explicit trusted local research broker**. The existing browser Mission Console uses a different journal and is not connected to this broker. There is no real model-provider adapter or automated execution. No cross-platform Windows/Linux enforcement is claimed.

Official Apple guidance:
- https://developer.apple.com/documentation/security/app-sandbox
- https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox

Owner: research issue #247, draft PR #248. No production merge or distribution authorization.
