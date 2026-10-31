# Unfire OS · Signed-Issuer Native Review Session

**ISOLATED RESEARCH · DRAFT ONLY · NOT A PRODUCTION CONSENT OR ACCESS-CONTROL SERVICE**

This standalone macOS Swift package is the first explicit code-level connection between the previously separate signed-issuer receiver, immutable review, and **pre-existing** user-presence-protected P-256 signer. It **does not enroll a key**, authenticate a real Unfire controller, or authorize actual external actions.

## What has genuinely been connected

1. **Signed issuer.** `SyntheticConsentSession` accepts the exact bounded `UNFIRE-ISSUER-ENVELOPE-V1` envelope from the existing `IssuerEnvelopeCore` and verifies its P-256/SHA-256 signature using a host-supplied pinned issuer public key. The issuer ID and signature are verified *relative to this supplied test pin*, not to any production identity/certificate.
2. **Independent reviewer key.** A second P-256 public key must be supplied by the host, different from the issuer public key. A later signature must verify against **that precise second key** and the immutable canonical `UNFIRE-P256-V1` request bytes. A random software key cannot substitute itself as the reviewer.
3. **Exact visible scope.** The previously audited `ReviewBindingCore` validates the public arithmetic fixture `17 + 25 = 42` and compares its independently computed SHA-256 proposal digest with the canonical signed request. The native SwiftUI window shows operation, public target, exact effect, expiry, issuer fingerprint and challenge fingerprint. It does not accept arbitrary model-generated scope descriptions.
4. **Explicit user click before an attempt.** The displayed **Confirm & sign preview** button is the only UI handler that may request signing. It first calls `beginAfterUserClick` and **atomically consumes the signed issuer nonce** in the existing SQLite receiver. No duplicate signing attempt can reuse that nonce after a restart. Simply opening/inspecting the request **does not consume it or request macOS authentication**.
5. **Protected signing adapter.** Only after the click, the code calls the existing `ProtectedP256SigningService.signAfterExplicitUserAction` with a `LAContext`. The signer requires a **previously enrolled device-protected key**. There is **no enrollment button, background enrollment, test enrollment, or software-key fallback** in this package. A normal machine without that pre-enrolled research key should fail closed and burn the preview nonce.
6. **STOP and Deny.** These actions invalidate any currently held `LAContext` and deny subsequent callbacks; STOP is committed to the local issuer SQLite journal when possible. An expired request, clock regression, wrong signature, wrong key, stale ticket or changed scope cannot enter the verified-preview state.
7. **No tool adapter.** There is no handler for filesystem writes, Gmail, app publication, browser, payments, OS control, model tools, network or remote agents. Every phase has `externalActionAllowed:false` and `authenticatedHumanConsentProven:false`, even if a local P-256 signature is valid.

## Files

- `Package.swift` · standalone Swift package with local dependencies on existing `UnfireEnclaveGate`, `UnfireReviewBindingCore` and `IssuerEnvelopeCore`.
- `Sources/ConsentSessionCore/ConsentSession.swift` · immutable issuer-checked request, separately pinned signer key, user-click-gated nonce reservation, exact signature verification, STOP/deny lifecycle.
- `Sources/UnfireConsentSession/main.swift` · English-only SwiftUI readout and explicit click path, **compiled but never launched during unattended verification**.
- `Sources/ConsentSessionProbe/main.swift` · read-only CLI for verifying a Node-signed fixture without user prompt, signature, nonce consumption or tool effect.
- `Tests/ConsentSessionCoreTests/ConsentSessionTests.swift` · ephemeral SOFTWARE P-256 signer tests, key and request spoofing, expiry, STOP and durable replay.
- `interop.mjs` · Node SQLite-issued canonical request, real issuer software P-256 signature, compiled Swift read-only probe; valid, forged, altered operation, expired, matching-key and independent-reviewer cases.
- `README.md` · this explicit risk and acceptance report.

## Reproduce safely

Tests require macOS, Swift 6 / Xcode and Node v26; no package downloads, external provider calls, user data, credentials, Touch ID or Secure Enclave hardware operations.

```sh
cd experiments/unfire-consent-session
swift test --disable-automatic-resolution --jobs 2
swift build --product ConsentSessionProbe --jobs 2
cd ../..
node experiments/unfire-consent-session/interop.mjs \
  "$(pwd)/experiments/unfire-consent-session/.build/debug/ConsentSessionProbe"
```

The **user-facing executable must not be launched unattended**. Its research launch arguments include a signed public test envelope and independently pinned public-key inputs supplied by a trusted local harness. It has no authenticated provisioning mechanism. In this research, the user has not authorized creating a Keychain or Secure Enclave key or issuing a macOS authentication prompt.

## Actual local checks

On the authorized Mac running Swift 6.4.2, macOS 27.0.1, the new standalone Swift package compiled and **15/15 new XCTest cases passed**. Node-to-Swift read-only signed-request interoperability also passed: exact digest and issuer verification accepted; forged issuer, substituted key, altered operation and expiration were rejected; and merely displaying the review left **zero** consumed nonces. All test keys were ephemeral software keys and all journal files were created in automatically removed temporary directories.

A full parent Node/Swift regression on final committed source is required before claiming an aggregate test count. Local test results are **not** GitHub Actions CI or independent security assurance.

## Blockers and especially important limitations

- **Production issuer identity is not authenticated.** The local test harness supplies the issuer public-key pin and database path; an attacker controlling the host could substitute them. No code-signed Unfire controller, authenticated XPC channel, protected enrollment or trusted organizational identity has been validated.
- **No actual hardware/user consent has been tested.** The existing Secure Enclave adapter compiles. No device-protected key was enrolled or loaded, no Touch ID/password or other macOS authentication prompt was triggered, and **no person approved a real challenge** in these tests. Software P-256 test signatures do not demonstrate user presence.
- **The UI is not certified trusted.** No released or code-signed binary, real user-driven acceptance test, accessibility audit or macOS Keychain entitlement audit exists. Passing a test public key through launch arguments is not production provisioning.
- **STOP during a macOS prompt is not yet independently verified.** The research signer method is synchronous on the main actor; a real OS authentication flow could temporarily prevent processing the STOP button until the call returns. The code tries to invalidate its `LAContext`, but it is **not** evidence of a preemptive, independently enforced cancellation boundary. A production signer should use an audited cancellable asynchronous workflow with STOP enforced in the signer/executor itself.
- **Denial persistence may fail under disk faults.** The local Deny action attempts to consume the issuer nonce and always closes the current UI session; a SQLite write failure is not yet represented as durable denial across a separate process. Persistent STOP similarly reports a storage error honestly but is not a production guarantee.
- **Reviewer key is a host-supplied test pin.** No secure reviewer enrollment, key rotation, migration, recovery, revocation, device binding or attestation exists. A correct signature alone cannot establish a real human's informed consent.
- **The only operation is a public synthetic preview.** No real recipient, app, file, personal data, cost amount, policy scope, rollback procedure, permissions or postcondition can be approved by this protocol.
- **No production durability.** The underlying SQLite research journal is neither cryptographically tamper-proof nor backed by a trusted wall clock or independently protected filesystem. No real restart-in-flight / power-loss / malicious-host fault testing has been completed.

## Acceptance gate before any real capability

A trusted app identity and protected issuer/reviewer provisioning, security-reviewed UI displaying the complete real effect, explicit user-controlled enrollment, authenticated user-presence-bound hardware signing, **cancelable** signer with independent STOP, durable anti-replay and revocation, secure clock/audit, strong access-control sandbox, high-quality agent verification, and independent real-device tests are required. These must be approved before connecting tools or performing actual effects.

**Status: DRAFT · UNMERGED · NOT DEPLOYED.** Do not infer production readiness from this lab.
