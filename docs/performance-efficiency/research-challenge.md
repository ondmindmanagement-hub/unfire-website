# Faculty-led research challenge · Efficient and dependable AI workflows

**Proposal only · Not an accepted university project or partnership**

## Proposed question

**Can cache-aware, human-supervised AI workflow orchestration reduce unnecessary work and median/tail latency without sacrificing output correctness, safety or transparent cost reporting?**

## Academic scope

A faculty-led team defines a narrow set of synthetic, non-sensitive tasks, a simple unoptimised baseline, and up to two reversible candidate improvements, such as deterministic deduplication of identical work or smarter bounded retries. No production systems, student personal data, private customer information, credential access, or unpublished proprietary assets are required.

## Comparative research design

- Fix hardware, OS, tool and model versions, task set, seed, network conditions and model pricing assumptions where relevant; randomise execution order to reduce drift.
- Compare output equivalence and independent success checks before performance comparisons.
- Run sufficient repeated trials to report median, p95, variability and failures; disclose cold versus warm cache and the effect of any mock/dry-run model.
- Track wall time, successful tasks per unit time, peak/average memory where measurable, CPU activity, number of calls, tokens and estimated rather than invoiced API cost.
- Record unintended actions, retries, approval burden and recovery behaviour.
- Include failure and negative-result analysis. No \"universal speedup\" or learning outcome claims are implied.

## Optional deliverables

1. Public methodology and reproducible synthetic workload.
2. Aggregate benchmark results with limitations and quality gates.
3. Independent feasibility report with recommendations.
4. Optional non-confidential presentation; no obligation to ship a commercial application.

## Participation safeguards

- Academic independence, supervision, authorship, publication, IP and software licensing require **written agreement** before work starts.
- No expectation of free commercial development or undisclosed labour; research is for education and validation.
- Remote, written and asynchronous participation is preferred. Fee-free eligibility and any required meetings must be verified for each programme.
- Unfire is an independent founder-led initiative, not represented as an incorporated company.
- No university logos or partnership announcements without written permission.

**Contact:** hello@unfire.technology

Reference coordination: Unfire Performance & AI Efficiency issue #242 and existing education outreach issue #50.