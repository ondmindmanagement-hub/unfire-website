# Unfire OS · Transactional Synthetic Approval Journal

**Status: isolated research prototype · not production authorization or an agent runtime.**

This narrow experiment closes an important limitation of the preceding in-memory signed-preview gate: approved requests were forgotten at restart. It uses Node.js built-in `node:sqlite` with an explicitly supplied trusted `DatabaseSync` connection, atomic `BEGIN IMMEDIATE` transitions, and a caller-supplied pinned Ed25519 public verification key. A SQLite file can be reopened by another process or connection without allowing an already consumed preview to be consumed again.

## Security properties actually implemented

- The model can propose only `synthetic.preview`, using one of the existing three fixed public quality fixtures. Unknown operations, extra proposal fields, injected model instructions, invalid JSON and incorrect results are rejected or blocked.
- The host decides which local SQLite database and verifier public key to open. Untrusted model content cannot set file paths, keys, clocks or operation permissions.
- The verifier's SHA-256 public-key fingerprint is pinned **inside the same SQLite database**, preventing accidental key substitution on reopen, assuming the underlying file is trusted.
- A challenge contains a domain separator, exact synthetic proposal ID, digest of the original proposal, unique random nonce, 60-second test expiry and the explicit `APPROVE` or `DENY` choice. A valid Ed25519 signature cannot be applied to another proposal or decision.
- `BEGIN IMMEDIATE` serializes writes. Approving, denying, consuming a preview, revoking an approval, and setting persistent STOP update the journal inside a database transaction. A second connection cannot consume the same approval after the first has done so.
- A persisted last-seen **test clock value** prevents the trusted caller from moving backward across restarts. This is not a trusted real-time clock: the caller still supplies each time value.
- STOP and revocations remain effective after reopening. Only proposal ID, fixture ID, digest, nonce, timestamps, states and state-transition metadata are written. **No model input/output, private signing key, personal information or user prompt is stored** in this database by the module.
- A successful signed approval produces **one inert `SIMULATED_PREVIEW` receipt**. Every public result has `externalActionAllowed:false`. No network, file, OS, email, payment, code-deployment or tool-use adapter exists.

## Files and reproduction

- `durable-preview.mjs` · standalone, deliberately scoped SQLite state machine.
- `durable-preview.test.mjs` · ephemeral test key pairs and, where necessary, uniquely named temporary local SQLite databases automatically removed after each test.

Node.js v26 on macOS was used to validate `node:sqlite`. With no extra packages:

```sh
node --test experiments/unfire-durable-approval/durable-preview.test.mjs
```

The tests cover valid/invalid signatures, DENY versus APPROVE, mismatched proposal, SQL/JSON injection shapes, explicit revocation, expiry, signed decision reuse, persistent STOP, monotonic clock checks, same-file double-consume through **two separate database connections**, reopening an actual temporary SQLite file, pinned-key replacement rejection, exact request shapes, strict proposal budgets, and metadata-only audit.

**Measured local verification on the authorized Mac:** 25/25 tests passed, 0 failed, on the research branch at source SHA `9c01e64e1d2f0c83b8766d4a68d4a038ca2c131a` (Node v26.8.2). A separate integrated test run should also be completed before acceptance. These are Node tests, not GitHub Actions CI or a security certification.

## Limits and remaining blockers

- A software signature authenticates a private key, **not the presence, identity, informed consent or direct action of a human**. This module has no trusted confirmation window, biometrics, Keychain/Secure Enclave integration or legal consent process. Test private keys are ephemeral only; never put a real private key in GitHub.
- A signed preview is *not* authorization to execute something externally. There is deliberately no real tool adapter here. A malicious or incorrectly designed host with filesystem access could bypass or mutate the database. **SQLite does not cryptographically authenticate or encrypt the database file**.
- The persisted clock prevents regression *relative to stored inputs*, but is not an independently trusted wall clock. Loss/corruption/rollback of the database, file locking by hostile processes, OS permission boundaries, backups, power failure, secure storage, data retention, audit immutability and transaction recovery across actual power interruptions are not validated.
- Two database connections are tested, but this does not constitute a complete hostile concurrent-process or fault-injection assessment.
- A second caller who has internal access to an already approved proposal can attempt to consume its inert preview. Before ever connecting real capabilities, binding the **consumer identity and precise allowed target operation** is mandatory.
- The standalone module is not yet wired into the original synthetic scheduler; integration tests confirm no regressions but do not prove a deployed end-to-end approval system.
- Previous local Qwen evaluation remains **2/3** trivial prompts correct and therefore quality-gated as BLOCKED; this journal does not make model answers trustworthy.

## Decision

Remain **draft, unmerged, disconnected and unpaid**. Require a trusted human approval UI, secure identity/key custody, capability-specific policy enforcement, user permission and consent, secure backup/restart and tamper-evident audit, representative real quality tests, and independent security/code review before any production application integration. No autonomous access to Gmail, GitHub releases, financial accounts, system files or Unfire apps is permitted by this research.
