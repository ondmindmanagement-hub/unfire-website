# Unfire OS · Human Approval Security Handoff

## Executive architecture decision

A model proposal and a macOS LocalAuthentication success must **never** independently authorize a real tool. The trusted application and a durable policy store must bind the **same immutable request** to the **same user action** and then prove that a cryptographic authorization came from an enrolled, protected key. The model must never choose the verification key, clock, target app, scope or UI text.

This is a design for a future review, **not an implemented or validated secure approval protocol**.

## Proposed end-to-end boundary

1. **Canonical proposal creation.** The trusted Unfire policy engine accepts only a defined action schema. It identifies organization, device, action type, target identifier, narrowly scoped arguments, data classification, expiry, projected cost cap, reversibility and expected proof. Generated text can suggest a proposal but cannot set trusted identity/approval fields.
2. **Independent policy screen.** A separate trusted view fetches an immutable challenge from an authenticated local control service. It displays the exact action, scope, cost, data exposure, recipient and STOP/rollback consequences. Any change creates a new proposal digest and invalidates the previous challenge.
3. **Human confirmation.** The user explicitly chooses Deny or Approve. The app requests an OS authentication factor after the user click, not in advance, and never silently downgrades an authentication failure to approval.
4. **Challenge-bound signing.** A hardware- or Keychain-protected private key signs a versioned, domain-separated canonical challenge, including request digest, policy version, authenticated subject and organization, device identity, nonce, expiry, approved scope and decision. Only the trusted verifier has the enrolled public key.
5. **Durable verification and consumption.** Validate signature algorithm, key enrollment/revocation, expiry, policy version, identity and consent. Consume the authorization once in a transactional store, rejecting concurrent duplicates, restarts and stale STOP epochs.
6. **Isolated executor.** A separately scoped tool adapter receives a short-lived, single-use capability for exactly the permitted action. It must reject expanded targets, extra arguments, prompt-injected instructions, unavailable audit, excess spend and any STOP state.
7. **Independent evidence.** Verify the real-world result through the tool/provider's trusted response and postconditions; append redacted, tamper-evident audit metadata. Never mark execution as verified because a model said it succeeded.

## Native Apple specifics to resolve before implementation

The current #258 journal verifies **Ed25519**. Apple CryptoKit Secure Enclave signing uses **P-256 ECDSA** and supports an `LAContext` and `SecAccessControl`. These schemes are **not interchangeable**. There is no automatic mechanism by which the current SwiftUI LocalAuthentication result could produce a valid Ed25519 signature for #258.

To use Secure Enclave P-256, version the whole signing protocol and implement new canonical P-256 verification, enrolment, key rotation and migration tests. Alternatively, design a protected Ed25519 signing process with explicit Keychain restrictions and acknowledge its different security properties. Evaluate the Apple entitlement, signing and sandbox prerequisites on the actual target platforms. No key has been generated or enrolled here.

`deviceOwnerAuthentication` can use Touch ID, Apple Watch or macOS password; it is **not a biometric-only guarantee**. An account-authentication result is not proof that the real user saw or understood the full approved action.

## High-priority adversarial cases

| Threat | Required defense and test |
| --- | --- |
| Malicious prompt asks for a more privileged action | Tool adapter independently checks canonical signed scope and rejects unknown fields |
| A model changes the displayed recipient after review | Digest-bound immutable request; generate fresh challenge for every change |
| Fake or overlay window captures user approval | Signed and independently reviewed app identity, trusted origin, secure UI anti-spoofing review |
| Previously valid authorization is replayed | Durable unique nonce, atomic consumption, request ID and STOP/revocation epoch |
| Multiple agents race to use one approval | Atomic reservation and enforced single-use capability in the executor |
| Real action fails after authorization | Independent status and rollback/reconciliation; no success until verified |
| App is killed during action or device reboots | Crash-recovery state model, explicit idempotency keys, conservative fail-closed default |
| User loses authorization key or device | Enrolment and key rotation with manual revocation, trusted audit and recovery |
| Database or binary is replaced by an attacker | OS file protection, app code signing, hardened runtime, integrity checks, review |
| Model sends private content to external provider | Explicit data classification, deny-by-default network egress, separate consent |
| Budget is exhausted or STOP is pressed | Durable budget/STOP epoch, enforcement inside the actual executor, not only UI |

## Acceptance criteria for a real human approval experiment

- Trustworthy, code-signed and auditable native app UI. Keyboard, screen-reader, contrast and localization review.
- No automatic authentication on opening the app. One deliberate click per sensitive action.
- Signature created only after successful interactive authentication, cryptographically bound to the **specific** immutable challenge.
- Signer cannot be called directly by untrusted model input.
- Persistent, replay-safe, revocable approvals across restarts and parallel workers, including multi-process fault injection and stale clock handling.
- No hidden keys or user personal data in telemetry, screenshots, GitHub or logs.
- Tool adapters absent until separately scoped and reviewed. A preview never writes to accounts, files, payments or websites.
- Test code on real Mac hardware with user-driven interactive consent and synthetic scopes, then independent security/UX review before any live operation.

## Current verified and unverified evidence

**Implemented:** policy-only SwiftUI review prototype with macOS LocalAuthentication call attached to a user-facing button; compile and 15 XCTest state-machine tests passed. In separate existing #258 research, SQLite single-use signed preview and persisted STOP passed Node tests. Neither is wired to the other.

**Not verified:** actual human prompt displayed, user approved, signed challenge generated, Keychain/Secure Enclave keys, real tool capability, end-to-end binding, third-party auditor or production release. Never conflate the previous Ed25519 test gate and this unsigned Swift UI.

**Apple reference documentation:** CryptoKit `SecureEnclave.P256.Signing.PrivateKey`, LocalAuthentication `LAPolicy.deviceOwnerAuthentication`, and Security `SecAccessControlCreateFlags`. Use official up-to-date APIs and security guidance during implementation.
