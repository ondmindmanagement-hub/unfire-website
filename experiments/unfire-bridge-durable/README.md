# Unfire Bridge · Durable synthetic security-state research

**Status · offline research only. NOT a deployed bridge, secure institution login, or real device federation.**

This child research phase follows the TLS 1.3 localhost laboratory (draft PR #268). It introduces a small standalone SQLite-backed policy store to explore durable permission and STOP handling. It is **not yet connected to any HTTP server**, and it never runs OS commands or sends network requests.

## Implemented research contract

- Each synthetic institution has a tenant scope and sticky, database-persisted STOP state. A revoked or stopped node cannot rejoin simply by reopening the program.
- Enrollment records a **synthetic** 64-character SHA-256-format certificate fingerprint per node (no actual device attestation). A fingerprint cannot be duplicated across tenants.
- Each node starts disconnected. The trusted test harness must explicitly set an approval flag to connect and issue independent short-lived send/receive grants.
- Replayed synthetic message IDs are rejected across restarts and across separate SQLite connections. The replay ledger has a fixed hard cap of 1,000 accepted messages per tenant and **fails closed** at capacity instead of silently discarding critical anti-replay information.
- Grant revocation, node revocation, monotonic synthetic time, and accepted message metadata are persisted atomically using SQLite `BEGIN IMMEDIATE` transactions. Denied transactions roll back.
- An accepted decision records only metadata, returns `externalActionAllowed:false`, and does **not transmit or execute** the payload. Synthetic message contents and keys are never persisted.

## Run test suite

Node.js 22+ with built-in `node:sqlite`:

```bash
node --test experiments/unfire-bridge-durable/durable-policy.test.mjs
```

The tests exclusively create temporary SQLite files with synthetic fixtures, exercise persistence/reopen and a second Node process, and clean their working directories. No extra packages are installed.

## Critical security limitations

This experiment **does not establish real institutional or human identity**: `approved:true`, the fingerprint and the clock are supplied by trusted test code, not an authenticated institution or secure device. The database path is an arbitrary **trusted local test path** and must never point to actual account/app data. SQLite does not defend against malicious local filesystem access, power failure at unsupported durability settings, disk corruption or credential compromise. Its local file protections vary across OSs.

Further work before even a limited real bridge: secure enrollment ceremony tied to real SSO/organization admins; OS-protected key custody; cryptographically verified certificate and tenant binding; independent threat model and audit; explicit certificate rotation/revocation; secure time source; encrypted durable state and backup policy; schema migration; tamper-evident logs; reliable STOP propagation to worker processes; isolation sandbox; transport integration with mTLS and approved multi-machine test hosts. **None of these are shipped by this phase.**

## Coordination

Unfire OS owner [#247](https://github.com/ondmindmanagement-hub/unfire-website/issues/247). Global [#78](https://github.com/ondmindmanagement-hub/unfire-website/issues/78). Parent lab [PR #268](https://github.com/ondmindmanagement-hub/unfire-website/pull/268). Use a separate branch and review-only draft PR, keep existing apps/release work untouched and never treat simulated test approval as genuine user consent.
