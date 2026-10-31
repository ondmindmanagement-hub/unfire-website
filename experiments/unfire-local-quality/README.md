# Unfire OS · Local-Only AI Quality Gate

**Research-only · Explicit opt-in · No external AI API · No production action**

This laboratory is the first small Unfire OS experiment using a **real existing on-device language model** instead of a toy calculation or a simulated timer. It tests only three public, deterministic fixtures, evaluated against independently specified expected outputs.

## Scope and safety

- Model allowlist: `qwen2.5:1.5b` **only**, already installed. **No model downloads, updates or installation**.
- Exact endpoint allowlist: `http://127.0.0.1:11499/api/generate`. The test script does not launch or configure a server. An operator may start a temporary localhost-only Ollama server if the machine is not overloaded.
- Explicit opt-in required: `UNFIRE_EXPLICIT_LOCAL_TEST=YES` in the **test process only**; `LocalQualitySession` refuses use unless `explicitlyApproved:true` is supplied.
- At most **3** attempted requests per session. Failed requests still consume an attempt. **No retries and no cloud fallback**.
- Output limited to 48 generated tokens/request, 512 context tokens, request time limit 20 seconds, temperature 0 and seed 7. This does not fully limit RAM, CPU or model compute by itself.
- The only prompts are three hardcoded **public** examples: arithmetic (42), uppercase identifier (AX-7B), and strict two-field JSON schema. No user document, project secret, personal message or chat content is sent.
- The only quality check is an independent exact-match/schema comparison. **No model may declare itself verified.**
- `qualityGate: BLOCKED` if **any** fixture fails. `externalActionAllowed: false` **always**. No file, email, browser, finance, publishing, tool-use or operating-system capability is available to the model.
- No provider token charges or cloud API calls are made by this workflow. **Local electricity/computation are not zero cost**.
- The worker is not a secure isolation boundary. `fetchFn` is injectable for unit tests and cannot be considered a secure sandbox against malicious code controlling the process.

## How to test

Node.js v22+ and an **already installed** local Ollama model are prerequisites.

Unit test (no model or server required):
```sh
node --test experiments/unfire-local-quality/local-adapter.test.mjs
```

Actual local model evaluation, only after a separate temporary Ollama server has been explicitly authorized and started at **127.0.0.1:11499**:
```sh
UNFIRE_EXPLICIT_LOCAL_TEST=YES node experiments/unfire-local-quality/run-local.mjs
```

The runner itself cannot start the service, download models or fall back to another endpoint. The server should be isolated to loopback, constrained to one loaded small model and one concurrent execution, run with low CPU priority, stopped in a cleanup trap, and never left resident after the test.

## Observed research result · 31 Oct 2026

At the exact temporary source SHA `007974e256e37bf4413f3367bd3587b76379fc97`, authorized Mac, Node v26.8.2, on-device `qwen2.5:1.5b`:

- Arithmetic: **PASS**, 4,228.65 ms elapsed, 3 reported output tokens.
- Uppercase identifier: **PASS**, 660.05 ms, 5 tokens.
- Strict JSON schema: **FAIL**, 827.51 ms, 20 tokens.
- **2/3** correct; the model's JSON did not satisfy the strict exact schema. No false success should be declared.
- 3 local requests, **0 external provider API requests**, **$0 provider API charges**. No estimated hardware/electricity cost was measured.
- The isolated Ollama server stopped after the run. A later loopback check confirmed that port 11499 was closed and no Ollama server/runner process remained.

The subsequently added `qualityGate` flag must be **BLOCKED** for this measured 2/3 result, and all versions must prohibit external side effects regardless of pass count.

## Limitations

This is **not** reliable multi-agent coordination, a controlled language-model benchmark, independent model security certification, a test of generative task quality, real-world data-processing accuracy, safe code generation, a production authorization or privacy proof. Three simple examples cannot represent a business workflow, and latency includes local setup/warmup effects. The tiny result is insufficient to evaluate Qwen 2.5 generally or compare it fairly with other models. No checks were performed against the larger installed model due to resource caution.

A valid next integration must have source provenance, explicitly scoped user permission, trusted identities, privacy classification, high-quality independent benchmarks, real resource measurements, robust failure/STOP and restart behavior, and a reviewed zero-spend policy. The current laboratory is **draft-only and should not be merged or published as a live feature**.
