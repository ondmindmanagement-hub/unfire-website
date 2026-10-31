# Unfire OS · Dual-Key Synthetic Authorization Handoff

**ISOLATED RESEARCH ONLY · NO REAL HUMAN SIGNATURE · NO EXTERNAL CAPABILITY**

This lab takes two previously separate verified research components and tests a **single synthetic path** through both:

1. The Node `P256PreviewJournal` creates a fixed public `synthetic.preview` challenge for the arithmetic fixture `17 + 25 = 42`.
2. An **ephemeral P-256 software issuer key** signs the existing exact `UNFIRE-ISSUER-ENVELOPE-V1` envelope containing that same challenge.
3. A **separate Swift process** with the existing `IssuerEnvelopeCLI` verifies the issuer signature against its host-pinned public key, checks the fixed review scope and consumes the envelope nonce in a durable SQLite test journal.
4. **Only after the Swift receiver accepts the envelope**, the Node **test harness** simulates the reviewer-signing step by producing a P-256 ECDSA signature of the same exact canonical challenge using a **second, distinct, ephemeral SOFTWARE test key**.
5. `dual-key.mjs` independently checks that the issuer and test-reviewer keys are distinct, validates both signatures over their exact domains, and ensures the controller envelope and review refer to the **identical canonical request**.
6. Node's existing `P256PreviewJournal` verifies the second signature and atomically consumes one **inert preview**. The journal is reopened from disk and a replay attempt is refused.

This is a cryptographic *simulation of a future reviewed consent flow*. **No person saw or approved the request, no LocalAuthentication or Secure Enclave key was involved, and the reviewer signature was generated automatically by a test harness.** The terms `reviewer` and `approval` describe separate cryptographic test identities, **not legal authorization, human identity, device attestation or consent**.

## Files

- `dual-key.mjs`: pure dual-signature verifier requiring two independent pinned EC P-256 SPKI public keys, strict field whitelist, strict ASCII/UTF-8 envelope, versioned domain, immutable canonical fixed `synthetic.preview` challenge, exact byte equality, P-256 DER signatures, expiry and no-effect return.
- `dual-key.test.mjs`: 16 standalone Node security tests covering wrong issuer and reviewer, same-key impersonation, modified challenge or nonce, denied/expired scope, injected extra fields, bad UTF-8, replay and STOP enforcement by the existing journal.
- `integration.mjs`: real Node-to-Swift local stdin protocol and P-256 SQLite journal test using two distinct ephemeral software keys. Does not run a model, authentication prompt, browser or other privileged task.
- `README.md`: verified findings and prohibitions.

## Reproduction

Requires Node v26, Xcode and Swift 6 on macOS. No paid services, third-party dependencies or permanent signing credentials are needed.

```sh
node --test experiments/unfire-dual-authorization/dual-key.test.mjs

cd experiments/unfire-issuer-envelope
swift build --product IssuerEnvelopeCLI --jobs 2
cd ../..

node experiments/unfire-dual-authorization/integration.mjs \
  "$(pwd)/experiments/unfire-issuer-envelope/.build/debug/IssuerEnvelopeCLI"
```

The CLI is compiled but no user-facing UI is launched. Integration creates two unique temporary on-disk SQLite journals and automatically removes them. All keys exist only in test process memory.

## Tested properties

On the authorized Mac, the new unit test suite passed **16/16** and the real Node/Swift two-key synthetic handoff passed at code SHA `703515b2c4d6216303528e0d86a90e7ed1ee212c` (prior to the final README). Specifically:

- Distinct issuer/test-reviewer P-256 keys verified. No shared key can satisfy the separation rule.
- A signed controller message must contain the exact Node-generated proposal bytes, not an altered recipient, operation, decision or request digest.
- The Swift receiver rejects a second use of the issuer envelope.
- The Node durable approval journal remains PENDING after issuer verification. **Controller-origin authentication alone does not move the approval forward**.
- An automatically signed test-reviewer proof is independently checked, then consumed only once by the Node journal.
- After closing and reopening the actual Node SQLite journal, a replay remains rejected.
- A wrong test-reviewer signature fails verification, and persistent Swift STOP refuses subsequent issuer requests.
- All outputs contain `externalActionAllowed:false`. No privileged action is executed.

The previous issuer envelope lab's additional negative tests cover spoofed signing keys, expired messages, malformed scopes, STOP and simultaneous Swift processes. This new lab does **not** independently reproduce all those cases; it composes the previously verified dependencies.

A final integrated parent regression must still pass before marking this research PR ready for owner review. Local test results are not equivalent to GitHub Actions CI, independent security review, production identity or reliability claims.

## Security boundaries still open

**Do not connect this code to user accounts, email, GitHub publishing, finance, app deployment, OS tools or personal data.**

- **No genuine human consent.** The test-harness software key signs automatically. It must not be treated as a user-present key, secure biometric confirmation or trusted authorizer. The earlier SwiftUI review mock and Secure Enclave compile-only adapter are **not** integrated here.
- **No trusted production identity.** The test harness provisions both public-key pins and chooses SQLite files. An attacker controlling the host can replace that entire trust anchor; this is not a code-signed Unfire service/XPC identity.
- **No trusted UI-to-signer continuity.** There is no hardware-backed challenge signing, authenticated session handoff, anti-spoofing UI protection, or independently verified human decision. The Swift process is a noninteractive verifier.
- **No tamper-resistant audit.** SQLite protects atomic update within the cooperative host tests, but not against rollback, hostile database substitution, power-loss damage or a compromised administrator. Trusted clock and secure user/device enrollment are absent.
- **No real action schema or executor.** The only fixed operation is `synthetic.preview`. There is no target, financial amount, organizational identity, cost cap, real tool adapter, reversible effect or postcondition verification. Real agents remain disallowed.
- **No production cross-platform support.** The prototype has been tested on one authorized macOS machine; Node and Swift are local research tools, not verified macOS/Windows/Linux product compatibility.

## Required next reviewed gate

1. Authenticate the actual **signed Unfire controller** and provision a trusted issuer verification key outside model-controlled input.
2. Bind a signed, accessible SwiftUI review window to the exact verified, immutable request.
3. Enroll a true user-controlled P-256 signing key with reviewed Keychain/Secure Enclave policies. Require explicit **user-driven** device authentication and obtain a real signature only after the user inspects the intended action. Never auto-enroll or auto-confirm in tests.
4. Verify that human-bound signature against a separately enrolled key and consume a durable one-time challenge with reliable STOP and revocation.
5. Audit app identity, model/tool isolation, privacy, data retention, clock, restart and crash behavior, resource caps, budget and actual operation safety. Enable real adapters only after separate explicit permission and independent security review.

**Decision:** DRAFT, UNMERGED, NOT DEPLOYED. No additional provider charges or external actions in this lab.
