# Unfire Bridge · Phase 0 Synthetic Interoperability

**Status: research-only simulation. NOT a network bridge, operating-system port, SSO integration, deployed agent, or installable product.**

This dependency-free JavaScript module demonstrates the **contract** for optional federation across synthetic macOS, Windows and Linux nodes. It executes only pure in-memory `synthetic.echo` and `synthetic.uppercase` transformations. A platform label is not a real OS interoperability test.

## Design contract

- Standalone by default. `enrollNode` keeps devices disconnected until a second explicit `connectNode` consent flag.
- Two-sided permission: the sender needs an unexpired `synthetic.send` grant, while the receiver needs its own unexpired `synthetic.receive` grant.
- Tenant-scoped routing rejects foreign nodes and grants; IDs, operation names and payload length are validated and operations default-denied.
- `disconnectNode`, `revokeNode`, `revokeGrant` and sticky `stopTenant` prohibit subsequent simulated deliveries. Duplicate message IDs are denied.
- Simulated delivery returns `transport: 'none'` and `externalActionAllowed: false`. No API, OS, filesystem, subprocess, network, credential, student/research record, or real AI model is touched.
- Snapshots expose only synthetic metadata. All state is ephemeral in memory and disappears on process exit.

## Testing

With Node.js 20+ (no install or third-party dependencies):

```bash
node --test experiments/unfire-bridge-contract/bridge.test.mjs
```

Tests cover consent, macOS/Windows/Linux labels, per-node grants, tenant isolation, bounds, replay, STOP, disconnect, revocation, strict input checks and synthetic relay success. Running the tests on one OS is **not** cross-OS validation.

## Important trust limitations

All caller-supplied approvals, tenant IDs, node labels, grants and timestamps are untrusted **simulated claims**. This module provides **no real authentication, authorization boundary, crypto, TLS/mTLS, device attestation, OS sandbox, trusted clock, journal persistence, power-loss safety, or rollback of real-world actions**. It must not accept actual confidential data or be connected to customer systems.

Before live integration: institutional OIDC/SSO and strong device identities, user-facing consent and revocation, server-enforced tenant ACLs, authenticated transport, sandboxed adapters, cryptographic evidence, durable transactional replay/STOP records, rate/resource quotas, secure key custody, and adversarial security review. Validate on actual macOS, Windows and Linux test hosts, including offline failure and performance before making compatibility claims.

**Coordination:** GitHub issue #247 (Unfire OS), #242 (benchmarks), #78 (global). This directory has a separate owner/branch; existing Unfire OS PRs and production app assets remain untouched. No automatic merge or deployment.
