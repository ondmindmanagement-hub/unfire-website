# Unfire Research — RB-001: Approval and Safety Decisions

**Release:** 0.1.0 · 20 November 2026  
**Status:** Public experimental *methodology and synthetic fixture*, not a peer-reviewed result or independent product validation.  
**Cost:** €0 to run the included offline evaluator.  
**Maintainer:** Unfire Research — https://unfire.technology/research/

## Research question

Given the same proposed action and surrounding authorization context, how consistently do AI assistants distinguish between actions they may perform, actions that require explicit human approval, and actions that should be refused?

This initial release includes 16 short, **fictional scenarios** and a deterministic evaluation script. The labels are a **declared teaching policy**, not a universal security standard, legal decision or statement about the behavior of a commercial system.

### Run the example (Node.js 18+)

```sh
node evaluate.mjs cases.json sample-responses.json
```

The included `sample-responses.json` is a **hand-authored synthetic fixture** with intentional mistakes. The score produced by this command merely checks that the scoring workflow works. **No GPT, Claude, Grok, Gemini, DeepSeek, BOLT, Unfire Control or other real model/product has been evaluated here.**

### Inputs

- `cases.json`: benchmark version, public reference labels, category and scenario text.
- `sample-responses.json`: fabricated example decisions in the format expected by the evaluator.
- `evaluate.mjs`: a no-dependency, read-only evaluator. It does not call a model, upload data, send messages or connect to any service.

Outputs include total case count, submitted coverage, match to reference labels, unsafe `allow` decisions, overblocking and a category-level breakdown. Missing cases are counted against total accuracy. Duplicate or unknown case IDs are rejected.

## Protocol for a future actual comparison

1. **Pre-register:** fix scenario set, exact system and user prompts, scoring, exclusions, expected permissions and the stop conditions before observing outputs.
2. **Configure fairly:** document the exact provider, model identifier/version/date, client, system settings, temperature, seed if supported, token limits, tool access and independent trial count. Use the same eligible actions, user context, and limits for all systems.
3. **Run safely:** test decisions in a sandbox that cannot send real email, modify production systems, access private accounts, or spend money. Compare text decisions only. Do not give an agent tools with live side effects for this benchmark.
4. **Repeat:** evaluate multiple independently sampled runs per scenario, preserve raw decisions, identify variance, and log failures or refusals rather than silently removing them.
5. **Measure:** report accuracy against the reference policy, false permission rate, requests for approval, overblocking, coverage, time, token count and actual price when available. Separate task metrics from safety metrics; confidence bounds and sample size are necessary for substantive claims.
6. **Audit:** use a second human reviewer for ambiguous cases, report inter-reviewer disagreement, benchmark contamination risks, model updates, and limitations. Publish prompts, sanitized outputs, evaluator version, data hashes and reproducible commands.
7. **Label evidence:** distinguish `protocol only`, `internal experiment`, `independently reproduced` and `peer reviewed`. A comparison must never imply certification or endorsement by NIST or any other institution.

**Important limitations:** Sixteen public examples cannot establish general agent safety. Public labels are susceptible to benchmark gaming. Different providers' terms, tools and runtime environments can make direct comparisons misleading. A sandbox judgment is not proof of production behavior.

## Future research tracks

- RB-002: reliability of handoffs, cancellations and bounded agent work
- RB-003: gesture/voice accessibility and unintended activation rates (supervised, with consent)
- RB-004: resource limits, backpressure and rollback under controlled load

These are research proposals, **not completed studies**.

## Method references

- NIST, *Practices for Automated Benchmark Evaluations of Language Models* (NIST AI 800-2, **initial public draft**, Jan. 2026): https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.800-2.ipd.pdf
- NIST, *AI Risk Management Framework*: https://www.nist.gov/itl/ai-risk-management-framework

This project is an independent Unfire research prototype; the cited institutions have not reviewed, approved, or endorsed it.

## Security and publication

Use only synthetic or licensed data. Never commit credentials, real customer data, unpublished game assets, secret implementation details or proprietary models. For research collaboration, contact **hello@unfire.technology** in writing.
