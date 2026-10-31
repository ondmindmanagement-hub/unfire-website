# Unfire OS · Protected P-256 Signing Boundary

**RESEARCH-ONLY · COMPILE-TESTED · NO KEY ENROLLMENT OR HUMAN AUTHENTICATION PERFORMED**

This is the next isolated laboratory after [the P-256 Swift-to-Node signed preview](../unfire-p256-bridge/README.md). It prepares a macOS Secure Enclave-backed signer API while **deliberately refusing to enroll or use a protected key during unattended tests**.

## Actual implementation

- `CanonicalPreview.swift` parses the **exact UTF-8 bytes** of the existing `UNFIRE-P256-V1` canonical challenge with a final newline. It accepts only `synthetic.preview`, 64 lowercase hex digest characters, 48 lowercase hex nonce characters, a bounded lowercase task ID, a nonnegative unambiguous millisecond expiry and an explicit APPROVE/DENY. It rejects extra/newline-injected fields, changed algorithm/domain, malformed timestamp, invalid UTF-8 and non-ASCII.
- `PreviewReviewSession` is a **local-memory-only** review state machine with a one-time ticket, pinned P-256 verifier public key, decision validation, expiry, clock non-regression, DENY and STOP, and signature verification over exactly the original challenge bytes. A software-key signature can drive a **simulated preview only**, never an external task. It always returns `externalActionAllowed:false` and `humanConsentCryptographicallyProven:false`.
- `ProtectedSigner.swift` compiles a guarded, native `SecureEnclave.P256.Signing.PrivateKey` adapter. An actual **trusted, user-driven** enrolment call could create a P-256 private key protected by `SecAccessControl` flags `privateKeyUsage` and `userPresence`. Its device-local opaque key reference is stored in a distinct Keychain record; signing explicitly reloads that reference with the authentication context and signs the exact validated bytes.
- The signer adapter is **not wired to any app, UI, model, Node process or external tool**. Neither the enrolment method nor the signing method is invoked with `explicitlyConfirmed:true` by test code. There is no executable product entrypoint and **no test that exercises actual Secure Enclave hardware**.
- The protected-key methods reject unconfirmed requests before any Keychain or hardware check. Tests exercise those denial paths using disposable authentication contexts, without requesting user authentication.
- No real filesystem, browser, network, Gmail, GitHub, payment, model API or other effectful adapter exists.

## Reproduction

On macOS with Xcode and Swift 6, no third-party packages:

```sh
cd experiments/unfire-enclave-gate
swift test --disable-automatic-resolution --jobs 2
```

**Observed on the authorized Mac (macOS 27.0.1, Swift 6.4.2):** the stand-alone Swift package compiled with Apple's `CryptoKit`, `Security` and `LocalAuthentication` APIs, and all **18/18 XCTest checks passed**. Tests use ephemeral **software P-256 keys** for strict parser/verification behavior, plus negative checks that hardware enrolment/signing require explicit permission. Test sources and build products were held in a uniquely named disposable checkout removed after use.

The validated research runtime source is on its dedicated branch under `experiments/unfire-enclave-gate/`. A full parent Node + Swift regression and PR review are still required before acceptance. **No GitHub Actions CI pass is asserted.**

## Architectural boundaries that remain open

1. **No human presence was proven.** Source code compiles, but no macOS authentication prompt was actually displayed or accepted. `explicitlyConfirmed: true` is a software input and is **not proof of consent**; the intended protected key's `userPresence` access control must be exercised in a separately authorized hardware test.
2. **Not yet bound to the trusted UI.** The earlier native SwiftUI prototype #266 shows a fixed mock request and can request local account authentication. It does **not** call this protected signer or display a live immutable challenge provided by the #270 SQLite journal.
3. **Secure Enclave availability varies.** Enrolment and signing can fail on unsupported hardware, revoked biometric/passcode state, absent Keychain entitlements, locked accounts, or a device without the required policy. No automatic fallback to a software private key is allowed.
4. **User-presence policy details matter.** Apple's `userPresence` can use biometric or device credentials; **it does not imply Touch ID only**. Real authentication UI, factors, fallback and accessibility must be reviewed with the owner. Keychain access and Secure Enclave permissions must be independently tested in the actual signed and sandboxed macOS app.
5. **Proof of exact intent remains missing.** The current canonical message signs a synthetic operation, ID, digest, nonce, expiry and decision. No real target, recipients, org, amounts, privacy classes, risk, consent scope, cost ceiling or effectful tool is encoded. It cannot authorize a production action.
6. **Signing key enrollment and recovery not evaluated.** The compile-only key storage code requires production review for access groups, migration, key rotation, secure backup policy, tamper/rollback resistance, revocation and user experience. No protected key was created or saved by this research.
7. **Node journal remains a research component.** SQLite atomic single-use approvals and STOP are tested for toy previews; secure time, evidence provenance, power failures, malicious host/database, trusted app identity and robust audit are not solved.

## Recommended integration gate

Before the first hardware signing experiment, ensure the app has a verifiable signed identity, a **trusted review UI showing the exact immutable challenge**, explicit consent for a specific synthetic signature, independently pinned enrolled verifier key and a reliable per-device policy. A real user must initiate that interaction; any key enrolment, biometric prompt or Secure Enclave use is excluded from unattended research.

After that, test the **actual Secure Enclave-produced DER ECDSA P-256 signature** with the trusted Node verifier from #270, single-use durable STOP across restarts, cancellation while a prompt is open, wrong-key substitution, tampered/expired scopes, privacy and full audit. Only then consider any restricted tool capability behind another independently reviewed permission boundary.

**Current status: DRAFT · UNMERGED · NOT DEPLOYED · NO KEYS ENROLLED · NO EXTERNAL EFFECTS.**

Official references:
- [Apple CryptoKit Secure Enclave P-256 signing private key](https://developer.apple.com/documentation/cryptokit/secureenclave/p256/signing/privatekey)
- [Apple Secure Enclave P-256 initializer with access control and authentication context](https://developer.apple.com/documentation/cryptokit/secureenclave/p256/signing/privatekey/init%28compactrepresentable%3Aaccesscontrol%3Aauthenticationcontext%3A%29)
- [Apple Security access control flags](https://developer.apple.com/documentation/security/secaccesscontrolcreateflags)
