# Unfire / Bolt — Restack Application Draft

## Project title
Bolt Open Execution Ledger

## Applicant
Omar Baró
Founder — Unfire
hello@unfire.technology
https://unfire.technology

## Requested funding
EUR 40,000

## Project summary
Bolt Open Execution Ledger is a proposed open-source component for
recording, validating and exporting trustworthy execution traces from
AI-assisted and automated software workflows.

The component is intentionally separated from Bolt's confidential
commercial orchestration layer.

Its purpose is to provide an interoperable, local-first and vendor-neutral
way to record:

- which operation was requested;
- which tools were invoked;
- which files or resources were changed;
- which permissions were used;
- which validations and tests were performed;
- what result was produced;
- whether the operation completed, failed or was rejected.

The resulting records can be stored locally and exported using an open,
documented data format.

## Problem
AI-assisted development and automation increasingly involve multiple
models, tools, APIs, local processes and cloud services.

Users often lack a portable and independently inspectable record of what
actually happened during an automated task.

Execution history is frequently locked inside proprietary products,
provider dashboards or transient model conversations.

This creates problems for:

- auditability;
- interoperability;
- reproducibility;
- security review;
- migration between tools;
- organisational governance;
- user control.

## Proposed solution
Develop an open-source execution-ledger layer that applications and
automation tools can integrate independently of any single AI provider.

The project will define:

1. An open event schema for execution records.
2. A local storage format.
3. A permission and action representation.
4. A validation and integrity mechanism.
5. A reference implementation.
6. Export/import tooling.
7. Developer documentation.
8. Automated tests.
9. Example integrations.

## European dimension
The project supports European digital autonomy by reducing dependence on
proprietary execution histories and vendor-specific AI orchestration
platforms.

Any compatible application should be able to generate and consume the
same open execution records.

This allows European developers, SMEs, public organisations and
individual users to retain control of their own operational history.

## Relationship with Unfire / Bolt
Bolt is being developed by Unfire as software for controlled AI
orchestration and computer execution.

The proposed Restack project is not a request to open-source Bolt's full
commercial architecture.

Instead, Unfire proposes to extract and independently develop a useful
technical commons from that work: the execution ledger and its open
interchange specification.

Bolt may later consume the same open standard as any other application.

## Technical objectives
- Define versioned execution-event schema.
- Define identities for tasks, actions and artifacts.
- Represent permissions and approval states.
- Represent command/tool execution without storing credentials.
- Provide integrity verification.
- Support local-first storage.
- Support JSON-based interchange.
- Implement reference CLI/library.
- Build automated tests.
- Produce integration examples.
- Publish full developer documentation.

## Open-source commitment
All software produced under this funded project will be released under a
recognised free/open-source licence.

The specification and documentation will be freely reusable.

The funded deliverable will remain technically separable from proprietary
Unfire products.

## Human-led development
The project architecture, implementation decisions, security model,
testing, validation and final code review will be directed and verified
by the applicant.

AI-assisted tools may be used as supporting development instruments where
permitted, but the funded work will not consist primarily of automatically
generated code.

All relevant development decisions and verification work will be
traceable.

## Expected impact
The project could provide a reusable building block for:

- local-first AI tools;
- developer automation;
- agent orchestration;
- reproducible software workflows;
- public-sector AI systems;
- security-sensitive automation;
- multi-provider AI environments.

## Sustainability
After the funded period, the open component can continue as an independent
open-source project.

Unfire has a commercial incentive to maintain compatibility because Bolt
can use the same specification.

Other projects would remain free to implement the specification without
using Bolt or Unfire services.

## Current status
Unfire already has working software-development activity and an existing
Bolt prototype/product direction involving controlled execution,
permissions, auditing and AI orchestration.

The grant would fund the extraction, formalisation and implementation of
the open component rather than financing a concept with no prior work.

## Website
https://unfire.technology
