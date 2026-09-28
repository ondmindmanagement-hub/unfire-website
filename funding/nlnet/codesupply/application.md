# Unfire / Bolt — CodeSupply Application Draft

## Project title
Open AI Build Provenance

## Applicant
Omar Baró
Founder — Unfire
hello@unfire.technology
https://unfire.technology

## Requested funding
EUR 35,000

## Project summary
Open AI Build Provenance is an open-source project for generating
machine-readable provenance metadata for software changes produced inside
AI-assisted development workflows.

The project would record relationships between:

- source repositories;
- dependencies;
- tool executions;
- generated or modified artifacts;
- build commands;
- tests;
- package metadata;
- software versions;
- resulting binaries or releases.

The objective is to improve transparency and security of modern software
supply chains without tying developers to a specific AI vendor.

## Problem
AI coding tools introduce another layer into the software supply chain.

A resulting artifact may have passed through:

- one or several AI systems;
- command-line tools;
- package managers;
- build systems;
- dependency resolution;
- automated repair loops;
- human changes.

Much of this provenance is currently fragmented or unavailable in a
standardised machine-readable form.

That makes it harder to answer:

- Where did this artifact come from?
- Which dependencies were involved?
- Which commands produced it?
- What changed during the workflow?
- Which checks were actually run?
- Can the build process be independently inspected?

## Proposed solution
Build an open provenance toolkit capable of transforming development
execution events into structured software supply-chain metadata.

## Technical objectives
1. Define an open provenance event format.
2. Capture build/tool/dependency relationships.
3. Connect artifacts to their originating operations.
4. Generate machine-readable manifests.
5. Provide adapters for common developer tooling.
6. Build validation tools.
7. Provide an open CLI/library.
8. Produce reference data/examples.
9. Publish documentation and tests.

## Relationship with CodeSupply
CodeSupply focuses on comprehensive software metadata, provenance,
licensing, vulnerabilities and quality information.

This project would contribute an additional source of provenance metadata
from AI-assisted and automated development workflows.

The output is intended to complement existing packaging and software
metadata ecosystems rather than replace them.

## Relationship with Unfire / Bolt
Unfire is developing Bolt, a controlled AI orchestration and execution
system.

During that development, a need emerged for stronger traceability between
automated actions and resulting software artifacts.

The proposed CodeSupply project extracts that problem into an independent,
open-source component.

No proprietary orchestration logic or confidential Bolt internals need to
be published as part of the project.

## Open-source commitment
The funded implementation, schemas, documentation and reference data will
be released under recognised open/free licences.

## Human-led development
Architecture, implementation choices, security analysis, testing and code
review will be controlled and verified by the applicant.

AI development tools may assist where allowed, but the deliverables will
not consist primarily of automatically generated code.

## Expected impact
The project could improve software supply-chain transparency for:

- open-source maintainers;
- AI coding tools;
- CI/CD systems;
- package ecosystems;
- organisations auditing generated software;
- security researchers;
- public-sector software procurement.

## Sustainability
The provenance format and implementation will remain independently usable.

Unfire can continue contributing because better provenance also benefits
Bolt, while third parties can integrate the open implementation without
using any Unfire product.

## Website
https://unfire.technology
