# Unfire OS · Native Human Review Research

**Status: standalone macOS research prototype. Not production authorization, identity proof, signing, deployment or permission to execute a tool.**

This experiment introduces a macOS SwiftUI approval preview using Apple LocalAuthentication. It is deliberately limited to a **single immutable synthetic demonstration**. It does not connect to Ollama, the Unfire operating-system planner, the persisted SQLite approval journal, Gmail, GitHub publishing, files, device control, payments or network services.

## Implemented

- A native SwiftUI window with a clean, high-contrast visual hierarchy, accessible controls and explicit labels for exact operation, target, effect, request fingerprint and limitations.
- The only operation displayed is `synthetic.preview` with a public arithmetic fixture. The request is embedded in code, and the state machine rejects modified operation, target, description, digest or expiry.
- The **Confirm preview** button requests macOS `LAContext.evaluatePolicy(.deviceOwnerAuthentication)`, which may use Touch ID, Apple Watch or password depending on device configuration. No biometric information enters the application.
- Device authentication can **only be initiated from the button handler**, never automatically on launch or from generated model text.
- A private one-time UI ticket prevents wrong, repeated or delayed callbacks from confirming another attempt. Deny, STOP, bad clock ordering, timeouts, expired review and authentication failure are fail-closed.
- Even a successful device-authentication callback produces only the label `Preview confirmed`. Every policy state returns `externalActionAllowed = false` and `signedAuthorizationProduced = false`.
- No signing key is created or loaded, no Secure Enclave key is provisioned and **no user authentication prompt was actually triggered** by automated compile/unit tests.

## Build and test

Requires macOS with Xcode/Swift 6 and SwiftUI. No third-party dependencies.

```sh
cd experiments/unfire-human-review
swift test --disable-automatic-resolution --jobs 2
```

The test runner compiles the executable without launching its window. Run `swift run UnfireHumanReview` only in an explicitly authorized interactive test. **Do not run this executable as an unattended background service.** The UI authentication interaction has not been manually audited.

**Observed:** on the authorized Mac, Swift 6.4.2 and macOS 27.0.1, all **15 of 15 XCTest cases passed** with no compiler errors at research SHA `990bfd7a2637b7f0243683893cbd6d4b2a7b6122`. This covers pure policy state transitions and does **not** prove a real Touch ID prompt, keychain signing, UI authenticity or safe human consent.

## Why this is not yet joined to #258

The existing durable gate #258 verifies **Ed25519** signatures over a canonical approval payload that includes a digest, nonce, expiry and decision. This SwiftUI demonstration authenticates a local macOS account but **does not sign that payload**. Its displayed SHA-256 digest is an illustrative, fixed demonstration fingerprint, **not** the trusted SQLite challenge digest or an authorized signature. Never treat `LAContext.evaluatePolicy == true` as an Ed25519 approval.

Apple's CryptoKit Secure Enclave signing API exposes **P-256 ECDSA**, which is a different algorithm from the Ed25519 verifier in #258. Future work must choose and independently review either:
- A versioned **P-256** verifier with Secure Enclave-backed key, access controls and a secure signing handoff, or
- An **Ed25519** signing key protected through an appropriately designed Keychain mechanism, recognizing this is not the same as a Secure Enclave P-256 private key.

Neither exists in this prototype. **Do not hardcode production keys or private key material in the repository.**

## Remaining gates

See `SECURITY_HANDOFF.md` for a proposed protected integration protocol. Before any real action permission, we need trusted application code signing and developer identity, a secure UI bound to the exact immutable journal challenge, true user-presence-bound cryptographic signing, verified key custody, pinned verifier algorithm and key, secure per-action scopes, durable single-use approval, audit provenance, reliable STOP and safe rollback, sandboxed individual tool adapters, no unrequested access to personal data, professional review, and reproducible CI.

This project owns only `experiments/unfire-human-review/`. Keep its child PR in **draft, unmerged and unpublished**. Do not assume this authorizes any real model or app operation. Public documentation and UI are English-only.
