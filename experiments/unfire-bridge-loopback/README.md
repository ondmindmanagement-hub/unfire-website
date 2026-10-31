# Unfire Bridge · Phase 2 Loopback Transport Research

**Status · Draft research only. Not a released OS bridge, secure institutional connector, or remote-control system.**

This dependency-free Node.js experiment demonstrates *actual HTTP communication between separate processes on the SAME host* through an ephemeral port bound exclusively to `127.0.0.1`. It does not connect two physical computers or universities. All operations are allowlisted synthetic transformations (`synthetic.echo` and `synthetic.uppercase`). There is no file, shell, OS, AI provider, external network or account integration.

## Design

- **Local-only transport:** the service binds to numeric IPv4 loopback, rejects wrong Host, Origin, Content-Type, oversize payloads and unknown routes. No localhost alias or redirect allowed by the client helper. The listener is started explicitly and closed by every test.
- **Proof-of-possession (research scope):** Ed25519 signatures over a versioned, domain-separated canonical packet. Each permitted test node's public key is pinned via a **trusted in-process test harness**, never enrolled over the HTTP endpoint. Private keys are ephemeral and not stored in this repository. The child-process fixture generates its own ephemeral key pair.
- **Explicit simulated consent:** host-side enrollment creates a disconnected node. Separate host-side `connect()` and sender/receiver capability grants must be approved. These booleans are supplied by the trusted test harness; they are **not a secure UI or real consent**.
- **Limits and fail-closed behavior:** short packet lifetime, trusted-host clock checks, grant expiry, tenant namespace, signed source identity, once-per-message replay cache, node/grant revocation, and sticky tenant STOP. Invalid types, operations, signatures, or extensions are denied.
- **No real side effects:** success is always marked `externalActionAllowed: false` and `transport: real_loopback_http`. Output is a deterministic synthetic transformation.
- **Separation of concerns:** no production integration with Unfire OS, agents, BOLT, Gmail, GitHub publishing or Apple services.

## Run isolated tests

Requires Node.js 22+, no installation of external packages:

```sh
node --test experiments/unfire-bridge-loopback/loopback.test.mjs
```

The tests spawn a child Node process **only for a test-only signed loopback relay**. All keys are generated in ephemeral process memory, all network traffic is restricted to this host's loopback interface, and the child and server are closed during test teardown. No daemon, account, device discovery, credentials, or installation remains.

## Security limitations · blockers to any actual multi-host rollout

1. **HTTP loopback is not TLS/mTLS.** It provides no encrypted multi-host transport or authenticated server response. A signed message proves only possession of a test private key, not human/device/institutional identity or physical attestation.
2. **Host-provided consent is synthetic.** A trusted consent UI, device identity verification, OIDC/SSO integration, separately managed signing keys, enrollment/recovery, tenant RBAC/ABAC and administrator-approved scoping are not implemented.
3. **Volatile grants/replay/STOP are not crash-safe.** Restart loses security state; no durable transaction log, distributed replay denial, atomic cross-host revocation or in-flight cancellation guarantees exist.
4. **Local processes can bypass the module.** OS sandboxing, resource quotas, secure secret custody, signed audit evidence, rate limits, secure updates and penetration testing are not implemented. A compromised local user could tamper with the host.
5. **Client responses are not cryptographically signed.** No real confidentiality, trustworthy remote result attestation or secure cross-institution data sharing is provided. Tests use public synthetic data only.
6. **Proof limited to a single container runtime.** Passing on Linux does not establish the same real-transport behavior on macOS or Windows. Run exact-source multi-OS CI as a later independent gate; do not claim production readiness.

**Related:** Unfire OS issue #247, global coordination #78, Phase 1 synthetic contract PR #265. This child branch edits only `experiments/unfire-bridge-loopback/`, remains DRAFT and unmerged, and does not start permanent services or authorize contacting institutions.