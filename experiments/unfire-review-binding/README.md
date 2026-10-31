# Unfire OS · Exact Review Binding

**Standalone macOS research prototype · No authenticated issuer · No user signing · No external effects**

This experiment closes a specific user-interface consistency gap: the human-facing review must **verify what it displays against the exact canonical bytes supplied for cryptographic approval**, rather than paraphrase untrusted model text.

It builds on the existing `UNFIRE-P256-V1` protocol and reuses the **actual** canonical Swift parser from `../unfire-enclave-gate` as a local Swift Package dependency. It does not create a separate, incompatible parser or alter the parent approval prototypes.

## What has been implemented

- `ReviewBindingCore/Binding.swift`: a strict synthetic public manifest for the single arithmetic fixture. It recomputes the exact Node `JSON.stringify(["UNFIRE-P256-V1", id, "arithmetic", "synthetic.preview", "42"])` SHA-256 digest independently using Swift `JSONSerialization` + CryptoKit. Only if the digest, proposal ID, decision, canonical format and expiry match can a review be displayed.
- `UnfireReviewBinding/main.swift`: native SwiftUI high-contrast **local mock** review window. Shows operation, target, exact effect, expiry, request digest, challenge fingerprint and explicit warnings. Buttons only acknowledge, deny or STOP a local preview state. No prompt, signing, accounts, system access, app-control capability or download.
- `UnfireReviewBindingCLI/main.swift`: a read-only command-line interop probe that reports match/no-match for a fixed public fixture. Rejects invalid input with a clean nonzero exit. It has no executor.
- `ReviewBindingTests.swift`: 18 local Swift tests including altered request digest, wrong ID, invalid decision, expired scope, changed display text, fake model answer, STOP, denial, clock rollback and inability to manufacture signed consent.
- `interop-check.mjs`: real **Node SQLite-issued** canonical P-256 challenge checked by the compiled Swift CLI. Confirms Swift accepts the exact request and rejects tampered digest, DENY presented for approval, expiry and unrelated operation. The Node ledger and verifier use an ephemeral software test key, but **no signature is produced in this interop test**.

## How to reproduce

On macOS, with existing Swift 6 and Node v26, no third-party libraries:

```sh
cd experiments/unfire-review-binding
swift test --disable-automatic-resolution --jobs 2
swift build --product UnfireReviewBindingCLI --jobs 2

cd ../..
node experiments/unfire-review-binding/interop-check.mjs \
  "$(pwd)/experiments/unfire-review-binding/.build/debug/UnfireReviewBindingCLI"
```

The SwiftUI target is compiled during Swift tests but the window is **not launched** in unattended testing. `swift run UnfireReviewBinding` would launch an optional mock review screen, but only a user-driven interactive session should do that.

## Security boundaries

- **No trusted issuer authentication yet.** The Node-generated challenge is used in local tests, but the Swift UI has no protected channel or authentication of a trusted Unfire policy engine. A compromised host can supply fraudulent canonical challenges. A matching hash proves the displayed fixed manifest matches bytes, **not that those bytes originate from a trusted human or server**.
- **No real human authorization.** The Confirm preview button makes only a local state transition. It does **not** invoke LocalAuthentication, Secure Enclave, Keychain, P-256 signing or the durable journal's `decide` API. The laboratory always sets `externalActionAllowed:false`, `signedHumanConsentProven:false` and `trustedIssuerAuthenticated:false`.
- **The UI's local mock is not a Node-issued database request.** It generates a synthetic canonical-shaped message in memory solely for visual exploration. The separate CLI interop test does use an actual Node SQLite-issued challenge, but its result is read-only.
- **No external tools.** No email, browser, Github, Apple publishing, payments, OS settings, model provider API or personal file actions are available.
- **A digest is not a full authorization.** The current protocol is fixed to `synthetic.preview`; there is no real target/recipient, organization, policy version, user role, cost, data exposure or real action proof encoded into the signed bytes.
- **Time and device security are not proven.** Expiry uses the supplied timestamp and cannot prove a trusted clock. No code-signing app identity, protected enrollment, OS sandbox or tamper-evident audit exists here.
- **Human-readable text can be misleading** if it differs from a signed request. This prototype solves that problem only for a *single fixed public manifest*. Arbitrary operations and dynamic multi-model content remain explicitly disallowed.

## Evidence and deployment

Initial Swift build and **18/18 local policy tests PASS**. The Node → compiled Swift CLI interop has also **PASS** for valid match and **four negative cases**, after correcting an unhandled CLI error into a clean nonzero denial. A full parent-branch integration run must still be performed on the final source commit before claiming cumulative counts.

Keep this PR **DRAFT, UNMERGED and NOT DEPLOYED**. Next reviewed gates: authenticated host-to-UI challenge transport; trusted native signed app; exact effectful request schema; direct user consent; hardware-protected P-256 signing; matching trusted verifier key enrollment; persistent policy/STOP/nonce enforcement; real sandboxed executor and independent postcondition checks. Hardware enrollment or a biometrics prompt must not occur during unattended research.
