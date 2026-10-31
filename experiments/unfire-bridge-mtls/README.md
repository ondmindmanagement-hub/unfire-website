# Unfire Bridge · Mutual TLS localhost research

**Status: research only · NOT a production multi-device bridge or university integration.**

This standalone Phase 3 experiment follows the offline synthetic contract (draft PR #265) and signed plaintext localhost experiment (draft PR #267). It adds **TLS 1.3 with mutual certificate verification** to an isolated synthetic HTTPS relay. It does not replace, merge, or edit its parent research owners.

## What this does

- Uses the Node.js built-in HTTPS/TLS stack. Server binds only to `127.0.0.1` on an ephemeral port, requires a valid client X.509 certificate from a temporary trusted test CA, and supports TLS 1.3 only.
- An **out-of-band trusted test harness** pins the enrolled client's certificate SHA-256 fingerprint to exactly one synthetic node/tenant and retains disconnected-by-default enrollment, separate sender/receiver capabilities and explicit consent flags.
- Routes only bounded, versioned `synthetic.echo` and `synthetic.uppercase` JSON messages. Validates host/path/HTTP method/size, grants, message expiry, replay, disconnect, revoke and STOP.
- Refuses external network URLs in its client API. All responses keep `externalActionAllowed:false`.
- Test suite creates a throwaway CA, server certificate and multiple client certificates via locally available OpenSSL, runs requests over an actual loopback TLS socket, and removes the complete temporary key directory afterward. **No private keys are committed**.

## Run research tests

Node.js 22+ and an installed OpenSSL CLI are required in the test environment:

```bash
node --test experiments/unfire-bridge-mtls/mtls.test.mjs
```

The GitHub Actions research workflow tests the exact code on standard hosted Ubuntu, Windows and macOS runners when the OpenSSL toolchain is available. Results must be inspected for the exact commit before claiming portability.

## Security boundaries, not yet solved

A local test process can call `enroll`, `connect`, `grant`, `stop` directly and supply `approved:true`. **This is not proof of a human approving, an enrolled physical device, an institution-controlled identity, or a secure privileged execution sandbox.** Client key custody, certificate issuance/revocation/rotation, institution SSO (OIDC), durable anti-replay and STOP across restarts, encrypted durable logs, security review, network firewall rules, server-side administrative policy and real multi-host testing are missing.

The module exposes only a synthetic simulator and is **not safe for private/student/research data or real customer networks**. The transport identity applies to a locally issued test certificate only. A single host, even on three operating systems, does not validate communication between physical machines. Real-world irreversible side effects and AI-driven tools are expressly absent.

## Project coordination

Canonical Unfire OS owner issue #247 · Global #78 · Phase 1 contract PR #265 · Phase 2 localhost PR #267. This phase lives exclusively under `experiments/unfire-bridge-mtls/` and one isolated read-only CI workflow. It should remain DRAFT and UNMERGED until security review and authorisation. Zero paid services, installations on the owner's Mac or production deployment.
