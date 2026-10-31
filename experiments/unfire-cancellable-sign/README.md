# Unfire OS · Cancellable Synthetic Signing Research

**Research only. No real user authentication, protected key use, or external actions.**

This new isolated Swift package exercises the cancellation boundary identified in the preceding consent-session research. It introduces:

- `StopFence`: an independently callable, lock-protected, irreversible stop bit, available even when the MainActor is waiting on an asynchronous signer.
- `SyntheticSigningWorker`: asynchronous signing interface with synchronous cancellation.
- `InterruptibleContextWorker`: performs a host-supplied operation on a background dispatch queue, not the UI actor, and calls Apple's `LAContext.invalidate()` when cancelled. **There is no production key or default signing operation in this module.**
- `CancellableReviewFlow`: composes the existing signed issuer + immutable review + SQLite nonce-reservation session. A user's explicit click reserves the signed request before an async signing attempt. STOP closes the fence **before** attempting to invalidate the authentication context and schedule SQLite STOP; all delayed results are discarded. Failure to persist STOP is reported rather than declared successful.
- 14 mock-only XCTest cases covering cancellation before or during a blocked worker, background STOP, delayed success, wrong key, expiry, clock rollback, duplicate clicks, failure and stored STOP, without invoking any real biometric prompt.

## Verification and a known unfinished source fix

The implementation target **compiled successfully** on the authorized Mac using Swift 6.4.2. The originally committed XCTest helper has one Swift 6 actor-isolation annotation missing:

```diff
-        func session(at:Int64=100) throws->SyntheticConsentSession {
+        @MainActor func session(at:Int64=100) throws->SyntheticConsentSession {
```

A fresh **disposable checkout** with precisely this one-line change passed **14/14 new XCTest cases**, 0 failures, process exit 0. The checkout and compiled files were automatically removed. **This one-line correction is NOT committed to this branch** because the GitHub file-write operation was blocked during this session; therefore do **not** claim that tests pass on the published branch. Until the exact source line is updated, the newly committed test target fails under Swift 6. This must be resolved and rerun before any merge, CI or acceptance. The research module is not production ready.

## What cancellation does and does not guarantee

Apple's documented `LAContext.invalidate()` stops pending policy evaluations and renders that context unusable. We **do not** claim this guarantees instant interruption of every blocked Secure Enclave cryptographic operation, nor do we claim to have measured STOP latency with real hardware. Test workers deliberately simulate uninterruptible callbacks. The independent STOP fence discards a late result; the existing SQLite journal attempts to persist STOP. A disk failure may leave that durable state unverified.

No Secure Enclave key was created, enrolled, loaded or signed, no Touch ID/password/macOS account dialog was displayed, no app launched, no real signing operation performed and no external capability granted. Mock tests use ephemeral software P-256 signing keys for a fixed public no-effect arithmetic fixture. The background-worker closure is test infrastructure, **not an audited production signing service**.

A product implementation still requires a user-driven, code-signed trusted UI, independently enrolled hardware key and trusted issuer, authentic consent over an exact request, a cancellable hardware signer with controlled OS prompts, durable STOP with independently enforced revocation, trusted clocks/audit, sandboxed limited tools, and independent device/UX/security testing.

**Draft-only. Unmerged. Not deployed. Zero external operations.**

Apple documentation: [LAContext.invalidate()](https://developer.apple.com/documentation/localauthentication/lacontext/invalidate%28%29) and [Secure Enclave P-256 signing key](https://developer.apple.com/documentation/cryptokit/secureenclave/p256/signing/privatekey).
