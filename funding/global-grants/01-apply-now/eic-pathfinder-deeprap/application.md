# EIC Pathfinder Challenge 2026 — DeepRAP

## Project title

Bolt — Verifiable Autonomous Execution for Trustworthy Cognitive AI

## Applicant

Unfire

## Contact

hello@unfire.technology

## Project concept

Bolt is a software architecture for trustworthy cognitive AI execution.

The research objective is to investigate how high-level AI reasoning and planning can be transformed into bounded, inspectable and verifiable execution pipelines while preserving human control, explicit permissions and reproducible evidence.

Rather than relying on continuous opaque AI-to-AI interaction, Bolt explores an architecture in which a planning model produces a structured plan and the execution layer carries out permitted actions through deterministic mechanisms, verification gates and auditable state transitions.

The project focuses on the transition from reasoning to action.

## Problem

Modern AI systems are increasingly capable of reasoning, planning and generating complex solutions.

However, when these systems are allowed to act on computers, software repositories or operational systems, several problems emerge:

- plans may change during execution;
- actions may exceed the intended permission scope;
- failures can create uncontrolled retry loops;
- results may be difficult to reproduce;
- provenance between a model decision and a real-world action can be lost;
- human operators may be forced to approve excessive numbers of low-level actions.

This creates a bottleneck between increasingly capable cognitive AI and trustworthy real-world execution.

## Proposed research

Bolt will investigate a verifiable execution architecture that separates:

1. reasoning and planning;
2. permission-bounded execution;
3. verification;
4. repair and retry;
5. provenance;
6. human intervention.

A primary AI model may reason about a task and construct a plan.

Bolt then converts the approved plan into controlled execution steps.

Each action is associated with:

- explicit permissions;
- expected inputs;
- expected outputs;
- verification criteria;
- execution evidence;
- failure state;
- retry boundaries.

The objective is to reduce unnecessary AI-to-AI communication and repetitive human approval without removing human authority over sensitive actions.

## Research objectives

1. Define a formal representation connecting cognitive AI plans to bounded executable actions.

2. Develop mechanisms for explicit action permissions and execution constraints.

3. Investigate verifiable action provenance and evidence.

4. Develop controlled repair and retry loops that preserve policy boundaries.

5. Evaluate whether deterministic execution can reduce unnecessary AI interaction while maintaining task quality.

6. Measure reliability, reproducibility and failure containment.

7. Demonstrate the architecture on real software-development workflows.

## Innovation

The proposed research does not focus on creating another conversational AI agent.

Its focus is the infrastructure between cognitive reasoning and real-world execution.

The central research question is:

How can increasingly capable reasoning systems execute long multi-step tasks with high autonomy while keeping execution bounded, inspectable, reproducible and under human authority?

Bolt investigates this through a separation between probabilistic planning and controlled execution.

## Current technical basis

A working Bolt software prototype already exists.

Current technical work includes modules for:

- approval control;
- policy enforcement;
- provider routing;
- credential handling;
- sandboxed execution;
- Git operations;
- execution transport;
- verification;
- ledgers;
- core orchestration.

Automated tests already exercise security properties such as:

- grants cannot be reused;
- approval cannot be transferred to a different action;
- modified approved content invalidates authorization;
- denied actions cannot be upgraded;
- expired grants are rejected;
- verification failure blocks approval;
- human rejection produces no execution grant.

These prototypes provide experimental infrastructure for the proposed research rather than representing the final research result.

## Proposed work packages

### WP1 — Scientific and technical model

Define the reasoning-to-execution model, trust assumptions, failure modes and research hypotheses.

### WP2 — Permission-bounded execution

Research action representations, permission boundaries and execution policies.

### WP3 — Provenance and verification

Develop mechanisms for linking plans, actions, outputs and verification evidence.

### WP4 — Controlled repair loops

Investigate retry and repair strategies that preserve permissions and provenance.

### WP5 — Experimental evaluation

Evaluate reliability, reproducibility, failure containment and human-intervention requirements.

### WP6 — Demonstrators

Validate the research through representative software-development and computer-execution scenarios.

### WP7 — Dissemination and exploitation

Prepare research dissemination, future interoperability work and pathways toward commercial deployment.

## Expected results

- formal reasoning-to-execution model;
- verifiable action representation;
- permission and approval architecture;
- execution provenance mechanism;
- controlled repair-loop framework;
- experimental benchmarks;
- reference demonstrators;
- technical documentation;
- exploitation roadmap.

## Expected impact

The project aims to contribute to trustworthy cognitive AI systems capable of moving beyond recommendation and conversation toward controlled real-world execution.

Potential future applications include:

- software engineering;
- computer automation;
- enterprise operations;
- scientific workflows;
- regulated environments;
- infrastructure management;
- AI-assisted development.

## Intellectual property

Only the research components required by the grant will be disclosed.

Confidential commercial orchestration logic, proprietary heuristics and unrelated Unfire technology will remain outside the funded project's public deliverables unless disclosure is explicitly required.

## Funding

Target grant request:

[TO BE DEFINED AFTER OFFICIAL BUDGET MODEL]

Maximum call reference:

Up to approximately EUR 4 million, subject to the official call conditions and justified project scope.

## Duration

[TO BE DEFINED]

## Status

WORKING DRAFT — NOT READY FOR SUBMISSION

Before submission:

- official eligibility must be reverified;
- applicant legal status must be confirmed;
- payment and pre-financing conditions must be checked;
- budget must be built;
- TRL position must be justified;
- technical evidence must be attached;
- human review required.
