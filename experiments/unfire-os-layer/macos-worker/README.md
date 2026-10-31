# Unfire OS · macOS Native Worker Research

**Not an installed app, deployed agent, OS kernel, production sandbox service or Unfire OS release.**

This directory holds a minimal Swift executable, a single App Sandbox entitlement, and a macOS-only hosted CI verification script.

## Files

- `Worker.swift`: bounded standard-input JSON parser for three deterministic operations: uppercase, word count, and SHA-256. It performs no external calls and has no general file/process execution API.
- `Worker.entitlements`: only `com.apple.security.app-sandbox = true`. No file, network, camera, microphone or system automation grants.
- `verify-sandbox.sh`: compiles a synthetic research binary, signs it with an ad-hoc signature, verifies embedded entitlements, and tests whether the signed process is denied access to a **synthetic** home-directory file and a **synthetic** loopback listener. An unsigned control binary must be permitted access to both, avoiding false positives.

## Execution and review

The CI workflow `native-macos-sandbox` runs on an **ephemeral GitHub-hosted macOS runner** for the public repository. It cleans the scratch build directory and temporary synthetic home-directory file. It does **not** run on the user's Mac, install software, access personal files, invoke AI agents, open project files, or publish artifacts.

The probes are deliberate denial tests, not general capabilities available to a model. If either synthetic denial does not hold, the test fails: no unsandboxed fallback or silently expanding entitlements.

## Security limits

A signed command-line test executable is not yet an approved Xcode app/helper distribution design. Before real integration, provide a separately reviewed signed Xcode target or XPC service, verified identity, input/output validation and scope, inherited descriptor audit, reliable cancellation, credential separation, resource budgets and release/security verification. Terminal/CI permissions and sandbox behavior may differ across macOS versions. Re-run real OS denial tests for each supported target system.

The unified in-process research coordinator, its operator STOP and its fenced result journal are **not connected** to this native worker. There is no real model-provider adapter or automated execution. No cross-platform Windows/Linux enforcement is claimed.

Official Apple guidance:
- https://developer.apple.com/documentation/security/app-sandbox
- https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox

Owner: research issue #247, draft PR #248. No production merge or distribution authorization.
