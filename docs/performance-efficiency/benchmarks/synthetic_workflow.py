#!/usr/bin/env python3
"""Unfire research: synthetic orchestration benchmark. No AI model/API calls.

This tests exact-input deduplication around a deterministic CPU placeholder.
It is NOT an AI inference performance benchmark or a product speed claim.
"""
import argparse
import hashlib
import json
import random
import statistics
import time
from datetime import datetime, timezone


def synthetic_compute(prompt):
    """Deterministic CPU workload only; explicitly NOT an LLM."""
    return hashlib.pbkdf2_hmac("sha256", prompt.encode("utf-8"),
                              b"unfire-synthetic-v1", 5500).hex()


def run_workflow(tasks, use_cache):
    cache = {}
    outputs = []
    calls = 0
    started = time.perf_counter()
    cpu_start = time.process_time()
    for item in tasks:
        # Cache scope contains the tenant, model version, configuration AND prompt.
        key = (item["tenant"], item["model"], item["config"], item["prompt"])
        if use_cache and key in cache:
            output = cache[key]
        else:
            output = synthetic_compute(item["prompt"])
            calls += 1
            if use_cache:
                cache[key] = output
        outputs.append(output)
    return {"seconds": time.perf_counter() - started,
            "cpu_seconds": time.process_time() - cpu_start,
            "calls": calls, "outputs": outputs}


def tasks_for(case):
    if case == "repeated":
        prompts = [f"synthetic-task-{i}-text-based-classification" for i in range(6)] * 2
    else:
        prompts = [f"synthetic-task-{i}-text-based-classification" for i in range(12)]
    return [{"tenant": "synthetic-tenant", "model": "CPU_PLACEHOLDER_v1",
             "config": "deterministic", "prompt": prompt} for prompt in prompts]


def percentile(values, percentile_value):
    x = sorted(values)
    idx = (len(x)-1) * (percentile_value/100)
    low = int(idx)
    high = min(low+1, len(x)-1)
    return x[low] + (x[high]-x[low]) * (idx-low)


def one_case(case, repetitions):
    tasks = tasks_for(case)
    stats = {label: [] for label in ("baseline", "deduplicated")}
    cpu = {label: [] for label in ("baseline", "deduplicated")}
    calls = {}
    matched = True
    for n in range(repetitions):
        order = ("baseline", "deduplicated") if n % 2 == 0 else ("deduplicated", "baseline")
        results = {}
        for label in order:
            result = run_workflow(tasks, use_cache=(label == "deduplicated"))
            stats[label].append(result["seconds"] * 1000)
            cpu[label].append(result["cpu_seconds"] * 1000)
            calls[label] = result["calls"]
            results[label] = result["outputs"]
        matched = matched and results["baseline"] == results["deduplicated"]
    return {
        "case": case, "tasks_per_trial": len(tasks), "trials_per_variant": repetitions,
        "correctness_equal_all_trials": matched,
        "measurements": {label: {
            "p50_ms": round(percentile(v, 50), 3),
            "p95_ms": round(percentile(v, 95), 3),
            "mean_ms": round(statistics.mean(v), 3),
            "mean_cpu_ms": round(statistics.mean(cpu[label]), 3),
            "compute_calls_per_trial": calls[label],
        } for label, v in stats.items()},
    }


def run_self_tests():
    p = "synthetic-query"
    x = [{"tenant": "A", "model": "m1", "config": "c", "prompt": p},
         {"tenant": "A", "model": "m1", "config": "c", "prompt": p},
         {"tenant": "B", "model": "m1", "config": "c", "prompt": p},
         {"tenant": "A", "model": "m2", "config": "c", "prompt": p},
         {"tenant": "A", "model": "m1", "config": "c2", "prompt": p}]
    base = run_workflow(x, use_cache=False)
    opt = run_workflow(x, use_cache=True)
    assert base["outputs"] == opt["outputs"]
    assert base["calls"] == 5 and opt["calls"] == 4
    assert run_workflow(tasks_for("unique"), True)["calls"] == 12
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trials", type=int, default=24)
    ap.add_argument("--output", default="")
    args = ap.parse_args()
    if not 10 <= args.trials <= 100:
        ap.error("trials must be between 10 and 100")
    assert run_self_tests()
    result = {
        "study": "UNFIRE synthetic orchestration only",
        "measured_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "CPython standard-library PBKDF2 CPU placeholder, NOT AI inference",
        "confidentiality": "fully synthetic; no network, model API calls or personal input",
        "optimization": "exact-input per-tenant/model/config response deduplication",
        "cost_usd": 0,
        "quality_check": "exact output equivalence plus tenant/model/config isolation",
        "limitations": [
            "CPU placeholder is not a language model and results cannot predict real model latency or fees.",
            "No actual model tokens, output quality, privacy deployment or enterprise workload are measured.",
            "Wall clock can vary with simultaneous macOS activity.",
            "Caching is useful only when repeated work is genuinely reusable.",
        ],
        "cases": [one_case("repeated", args.trials), one_case("unique", args.trials)],
    }
    assert all(c["correctness_equal_all_trials"] for c in result["cases"])
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()