# EIC Pathfinder DeepRAP — Bolt
# Technical Evidence

Status:
CURRENT TECHNICAL BASELINE

This file separates existing Bolt evidence from proposed future research.

---

# 1. Existing software baseline

Verified Bolt working copy:

/Users/omarbaro/Developer/BOLT

Original project source also exists under the previous Desktop workspace, but the Developer copy is the verified build/test location.

## Current source modules

- BOLTApp
- BoltApprovalEngine
- BoltCore
- BoltCredentials
- BoltGit
- BoltLedger
- BoltMVP
- BoltPolicyEngine
- BoltProviderProtocol
- BoltProviders
- BoltRouter
- BoltSandbox
- BoltTransport
- BoltVerifier

## Current test modules

- BoltApprovalEngineTests
- BoltCoreTests
- BoltCredentialsTests
- BoltGitTests
- BoltMVPTests
- BoltPolicyEngineTests
- BoltProviderProtocolTests
- BoltProvidersTests
- BoltRouterTests
- BoltTransportTests

## Codebase scale

Current verified inventory:

- 55 Swift source files
- 52 Swift test files

---

# 2. Verified build status

Verified release build result:

Build complete! (37.00 s)

This build was executed from:

/Users/omarbaro/Developer/BOLT

The Developer path was used to avoid code-signing contamination from synced Desktop metadata.

---

# 3. Verified automated tests

Verified results:

35 tests in 6 suites passed.

16 tests in 1 suite passed.

Exit code:

0

---

# 4. Security and authorization properties already tested

The existing Bolt prototype includes tests for properties such as:

- approved content changes invalidate authorization;
- denied actions cannot be upgraded into executable actions;
- pre-issued grants cannot be reused;
- execution authorization is action-specific;
- execution authorization is target-specific;
- expired grants are rejected;
- failed verification can block approval;
- human rejection issues no execution authority;
- authorization from another engine is rejected;
- trust-bearing types are restricted;
- privileged application paths are constrained.

Representative existing test names include:

- grantFailsIfApprovedContentChanges
- aGrantCannotUpgradeADeniedAction
- preIssuedGrantIsAcceptedOnceAndCannotBeReused
- onlyBoltCoreCallsTheApplier
- sealedTypesAreOnlyConstructedInsideTheirOwningModule
- trustBearingTypesAreNotCodable
- failedVerificationBlocksApprovalEvenForRequireHuman
- verdictFromAnotherActionIsRejected
- allowVerdictDoesNotIssueGrant
- denyVerdictCanNeverBeApproved
- grantCannotBeUsedForDifferentAction
- grantRedeemsOnceThenCannotBeReused
- humanRejectionIssuesNothing
- approvalFailsIfTargetChangesButContentDoesNot
- grantFromAnotherEngineIsRejected
- grantIsExpiredAtExactlyExpiryInstant
- expiredGrantIsRejectedAndBurned
- approvalFailsIfApprovedContentChanges
- eachApprovalIsIndependent

---

# 5. Existing application artifact

A signed Bolt application artifact exists from the current development baseline.

Previously verified bundle information:

Identifier:
local.bolt.app

Version:
0.1.0

Build:
1

The current Pathfinder proposal must not present this application as the final research outcome.

It is evidence that an experimental software platform already exists and can support research validation.

---

# 6. Existing technical themes

The current Bolt prototype already contains practical experimentation around:

- approval control;
- explicit authorization;
- policy enforcement;
- execution routing;
- provider abstraction;
- credentials;
- Git operations;
- sandbox concepts;
- execution transport;
- verification;
- ledgers;
- orchestration;
- controlled execution state.

These existing components provide a technical starting point for DeepRAP research.

---

# 7. What is NOT yet claimed as achieved

The following belong to the proposed Pathfinder research and must not be described as already solved:

- formal scientific model of reasoning-to-execution;
- experimentally validated reduction in model-to-model communication;
- general cognitive-AI reasoning abstraction;
- formal proof of safe long-horizon autonomy;
- scientifically validated autonomous repair framework;
- cross-domain execution benchmarks;
- full provenance standard;
- large-scale trustworthy cognitive AI deployment;
- TRL advancement claimed without evidence;
- regulatory certification.

---

# 8. Proposed research gap

The current prototype demonstrates that constrained authorization and verification mechanisms can be implemented in working software.

The Pathfinder research question is substantially broader:

Can a cognitive AI system transform high-level reasoning into long-horizon autonomous execution while maintaining explicit permissions, verifiable provenance, bounded recovery and reproducible evidence?

This gap separates the existing prototype from the proposed research programme.

---

# 9. Existing internal evidence snapshot

Existing technical evidence snapshot:

funding/nlnet/evidence/snapshots/bolt-technical-evidence.txt

This evidence can be reused as a source for the Pathfinder dossier after manual review.

---

# 10. Evidence still required

Before submission:

- [ ] fresh release build log;
- [ ] fresh complete test log;
- [ ] exact Swift version;
- [ ] exact macOS/Xcode environment;
- [ ] architecture diagram;
- [ ] module dependency diagram;
- [ ] screenshots of Bolt prototype;
- [ ] reproducible benchmark scenario;
- [ ] test-count confirmation;
- [ ] Git commit hash for submitted technical baseline;
- [ ] inventor/developer CV;
- [ ] project ownership/IP evidence;
- [ ] participant legal documentation.

---

# 11. Evidence integrity rule

Every technical statement submitted to EIC must be traceable to:

- source code;
- build output;
- automated test output;
- repository history;
- technical documentation;
- or another reproducible artifact.

Do not claim capabilities that have not been demonstrated.
