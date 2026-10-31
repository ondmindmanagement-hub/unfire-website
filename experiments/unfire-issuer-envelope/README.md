# Unfire OS · Signed Local Issuer Envelope

**Research only · No authenticated production controller · No user consent · No external action capabilities**

This experiment closes one specific gap from the prior [review-binding lab](../unfire-review-binding/README.md): the Swift reader previously verified that the displayed public fixture matched the **received bytes**, but could not tell whether the **message originated from the intended controller**.

It now requires an **independently signed issuer envelope** around the existing `UNFIRE-P256-V1` canonical request, pinned to a separately provided issuer public key, before accepting the fixed public review. This is a cryptographic key-possession test only. Production issuer identity, code signing, protected provisioning and trusted user consent are **not** present.

## Local protocol and security logic

The issued message is **ASCII UTF-8 with an exact final newline**, maximum 4 KiB. Its format is:

```text
UNFIRE-ISSUER-ENVELOPE-V1
algorithm=ECDSA-P256-SHA256
issuerId=unfire-local-controller
nonce=<48 lowercase hexadecimal characters>
expiresAt=<nonnegative canonical milliseconds>
challengeB64=<canonical Base64 of exact underlying UNFIRE-P256-V1 bytes>
signatureDER=<canonical Base64 DER ECDSA P-256/SHA-256 signature>
```

The signature covers **the first six newline-terminated lines only**, with the last `signatureDER` field excluded. The underlying canonical request remains the independently defined `UNFIRE-P256-V1` request, and both layers are strictly validated, including the fixed `synthetic.preview` operation and its digest.

The issuer signing key in tests is a **temporary software P-256 key created by the Node test process**, never persisted, enrolled or exported privately. The trusted test harness passes its public SPKI DER key to the Swift process independently of the signed envelope; Swift CryptoKit verifies the signature. The host controls the chosen verifier key, clock and SQLite database path, **not the generated model message**.

The receiving Swift component stores the issuer public-key fingerprint and consumed envelope nonce in a local SQLite journal, using `BEGIN IMMEDIATE` atomic transactions. It rejects key replacement, duplicate nonce, duplicate use from a new process, and backward test clock. STOP persists across restart. There is **no capability to execute a real task**.

## Files

- `Package.swift` · standalone Swift package, with the previously tested canonical review parser as a local package dependency.
- `Sources/IssuerEnvelopeCore/IssuerEnvelope.swift` · strict issuer signature verification, canonical message checks, independent fixed-review check, SQLite replay/STOP journal.
- `Sources/IssuerEnvelopeCLI/main.swift` · one-shot local process receiver using **stdin** as the transport, with a trusted host-supplied key, time and database path. Clean status-2 rejection, without echoing raw untrusted content.
- `Tests/IssuerEnvelopeTests/IssuerEnvelopeTests.swift` · unit tests for tampering, spoofed keys, unknown issuer, injected fields, altered scope, expiration, replay, rollback, STOP and key replacement.
- `interop.mjs` · real Node SQLite-issued challenge, signed by a fresh ephemeral issuer P-256 key, sent over a local stdin pipe to a compiled Swift process. The harness verifies both acceptance and all negative cases, including two parallel receiver processes.
- `README.md` · scope, reproducibility and unimplemented gates.

## Reproduction

On macOS with Swift 6, Xcode and Node v26, from repository root:

```sh
cd experiments/unfire-issuer-envelope
swift test --disable-automatic-resolution --jobs 2
swift build --product IssuerEnvelopeCLI --jobs 2
cd ../..
node experiments/unfire-issuer-envelope/interop.mjs \
  "$(pwd)/experiments/unfire-issuer-envelope/.build/debug/IssuerEnvelopeCLI"
```

No third-party packages, actual user prompts, network, account services or model runtimes are needed. The cross-language test creates one temporary SQLite journal directory and **removes it on exit**. The software signing keys exist only in the test processes.

## Verified results, 31 Oct 2026

On the authorized Mac, Node v26.8.2, Swift 6.4.2, macOS 27.0.1:

- **12/12 new Swift XCTest cases passed.** This includes persisted replay refusal after reopening SQLite, altered challenge and issuer signature, wrong verifier key, wrong decision, expiry, STOP and schema-injection rejection.
- One full **Node to compiled Swift local process IPC** integration completed successfully. The trusted test key was pinned independently, exact issuer signature verified, and a single synthetic preview was accepted. Forged signer, altered envelope, expiration, wrong decision, forbidden `email.send` operation, persistent STOP and replay were all rejected. **Two concurrent Swift processes using the same journal resulted in exactly one acceptance and one rejection.**
- No real operation was executed. Output is always `externalActionAllowed:false`, `humanConsentProven:false` and `trustedProductionIdentityProven:false`.
- These are **not** evidence of an audited production trust root. They do not constitute independent certification or Github Actions CI.

A complete parent-regression verification is required before this PR is considered ready for owner review.

## Security boundaries and next gates

1. **No trusted production identity.** The test creates and pins a software key in the **same trusted harness**. A malicious host or attacker controlling how the application is launched could supply a different key and create an apparently valid signed message. Real verification key provisioning must be anchored independently to an authenticated Unfire controller, reviewed signed app identity and protected key storage.
2. **The stdin pipe is a local test transport**, not a Unix-socket daemon, hardened XPC service or separately authenticated controller channel. The signature protects received bytes against substitution given a trusted pin; it does not authenticate the host operating system or process.
3. **No real user approval.** The Swift CLI does not show a window, ask Touch ID, call LocalAuthentication or sign the review with a Secure Enclave key. The earlier UI and protected signer are **still not joined** in one audited, trusted session.
4. **SQLite is not encrypted or tamper-proof.** Host-supplied database path, non-rollback-safe file storage, supplied clock, filesystem permissions, backup, power loss, concurrent hostile processes and cross-device replay require further engineering. Local nonce consumption proves test replay behavior only under a cooperative host.
5. **Only one public arithmetic fixture** is accepted. The envelope has no production identity, recipient, external target, data scope, budget, irreversible action or real-world postcondition. Do not use it to authorize Gmail, app submission, GitHub writes, financial transactions, remote computers or actual OS operations.
6. **No cloud calls or paid providers** in this lab. Local CPU/electricity still consumes resources; do not infer monetary savings.
7. The present lab does **not** establish secure device enrollment, organizational SSO, permission revocation across distributed machines, production CI, adversarial audit or autonomous agent reliability.

**Recommendation:** keep this work in a **DRAFT, UNMERGED, NOT DEPLOYED** child PR. The next real integration gate is a code-signed native macOS controller with independently provisioned issuer trust, a trusted exact-request review UI and **explicit user-driven Secure Enclave signature**, followed by durable nonce/STOP enforcement and a separately security-reviewed adapter for one precisely scoped external action. No step should grant agents automatic privileges.
