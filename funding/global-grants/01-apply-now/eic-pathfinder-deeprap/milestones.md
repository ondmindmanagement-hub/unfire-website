# EIC Pathfinder DeepRAP — Bolt
# Milestones and Work Packages

Status:
WORKING DRAFT

Provisional project duration:
36 months

Final duration:
[CONFIRM]

---

# Project objective

Research and validate a trustworthy cognitive-AI execution architecture that converts high-level reasoning and planning into bounded, inspectable and verifiable real-world actions.

The project investigates the interface between probabilistic cognitive AI and controlled execution.

---

# WP1 — Scientific model and system architecture

Duration:
M1–M6

Objectives:

- define the reasoning-to-execution research model;
- define system boundaries;
- define trust assumptions;
- define failure modes;
- define security and permission model;
- define evaluation methodology.

Tasks:

T1.1 Cognitive planning model
T1.2 Execution-state representation
T1.3 Threat and failure model
T1.4 Permission model
T1.5 Benchmark design

Deliverables:

D1.1 Scientific architecture specification
D1.2 Threat and failure model
D1.3 Evaluation framework

Milestone:

M1 — Research architecture frozen

Target:
Month 6

Evidence:

- architecture specification;
- threat model;
- initial benchmark suite;
- reproducible technical documentation.

---

# WP2 — Permission-bounded execution

Duration:
M4–M14

Objectives:

- transform plans into bounded executable actions;
- enforce explicit permissions;
- prevent execution outside approved scope;
- maintain deterministic execution state where possible.

Tasks:

T2.1 Action schema
T2.2 Permission grants
T2.3 Action identity and integrity
T2.4 Execution constraints
T2.5 Policy enforcement

Deliverables:

D2.1 Action representation
D2.2 Permission engine
D2.3 Execution-policy prototype
D2.4 Automated verification tests

Milestone:

M2 — Controlled execution prototype

Target:
Month 14

Success criteria:

- an approved action cannot be silently changed;
- authorization cannot be reused for unrelated actions;
- denied actions cannot become executable;
- expired authorization is rejected.

---

# WP3 — Provenance and verification

Duration:
M8–M20

Objectives:

- create traceable links between AI plans and real actions;
- preserve execution evidence;
- verify outputs and state transitions;
- support reproducibility.

Tasks:

T3.1 Provenance schema
T3.2 Execution ledger
T3.3 Evidence capture
T3.4 Verification engine
T3.5 Integrity validation

Deliverables:

D3.1 Provenance specification
D3.2 Execution ledger prototype
D3.3 Verification framework
D3.4 Integrity benchmark

Milestone:

M3 — Verifiable execution chain demonstrated

Target:
Month 20

---

# WP4 — Controlled repair and retry

Duration:
M14–M26

Objectives:

- investigate safe autonomous recovery;
- prevent uncontrolled retry loops;
- maintain policy constraints during repairs;
- minimize unnecessary model calls.

Tasks:

T4.1 Failure classification
T4.2 Repair policies
T4.3 Retry boundaries
T4.4 Independent verification
T4.5 Escalation to human operator

Deliverables:

D4.1 Repair-loop architecture
D4.2 Failure-handling prototype
D4.3 Safety evaluation

Milestone:

M4 — Bounded autonomous recovery demonstrated

Target:
Month 26

---

# WP5 — Cognitive AI efficiency and autonomy

Duration:
M18–M30

Objectives:

- measure reduction in AI-to-AI interaction;
- reduce unnecessary human confirmations;
- measure reliability under increasing autonomy;
- investigate one-plan / deep-execution workflows.

Tasks:

T5.1 Baseline agent comparison
T5.2 Model-call efficiency metrics
T5.3 Human-intervention metrics
T5.4 Long-horizon task experiments
T5.5 Cost/reliability analysis

Deliverables:

D5.1 Benchmark dataset
D5.2 Comparative evaluation
D5.3 Autonomy-efficiency report

Milestone:

M5 — Long-horizon execution benchmark completed

Target:
Month 30

---

# WP6 — Demonstrators

Duration:
M22–M34

Demonstration domains:

- software-development workflows;
- repository modification;
- build and test automation;
- controlled terminal actions;
- reproducible repair workflows.

Potential future demonstrators:

- scientific workflows;
- enterprise operations;
- infrastructure management.

Deliverables:

D6.1 Software-engineering demonstrator
D6.2 Controlled-computer-execution demonstrator
D6.3 Technical evaluation report

Milestone:

M6 — End-to-end demonstrator validated

Target:
Month 34

---

# WP7 — Dissemination and exploitation

Duration:
M1–M36

Objectives:

- protect relevant IP;
- publish appropriate research results;
- prepare interoperability strategy;
- establish exploitation route;
- prepare future commercialisation.

Deliverables:

D7.1 Dissemination plan
D7.2 IP and exploitation plan
D7.3 Final technical report
D7.4 Post-project roadmap

Milestone:

M7 — Final Pathfinder research package

Target:
Month 36

---

# Global project milestones

| Milestone | Month | Result |
|---|---:|---|
| M1 | 6 | Scientific architecture validated |
| M2 | 14 | Permission-bounded execution prototype |
| M3 | 20 | Verifiable execution chain |
| M4 | 26 | Controlled repair system |
| M5 | 30 | Cognitive autonomy benchmark |
| M6 | 34 | End-to-end demonstrator |
| M7 | 36 | Final research and exploitation package |

---

# Preliminary KPIs

These values are provisional and must be scientifically justified before submission.

- 100% rejection of intentionally invalid authorization in security tests;
- complete provenance chain for executed benchmark actions;
- measurable reduction in unnecessary model calls versus baseline multi-agent execution;
- measurable reduction in repetitive human approval events;
- deterministic reproduction of selected execution workflows;
- containment of failed repair attempts within explicit retry limits;
- no privilege expansion during automated recovery.

---

# Important

Do not present these KPIs as achieved results.

They are target research metrics for the proposed project.
