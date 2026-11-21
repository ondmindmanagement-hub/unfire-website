/* Unfire AI Token Counter — UI only. No network requests, storage or text export. */
(() => {
  "use strict";
  const engine = window.UnfireTokenEngine;
  const el = id => document.getElementById(id);
  const formatter = new Intl.NumberFormat("en-US");
  const inputs = [
    "input-text", "output-text", "chars-per-token", "exact-input", "exact-output",
    "input-rate", "output-rate", "calls"
  ];
  let last = null;
  let debounce = null;
  function status(message, kind = "info") {
    el("status").textContent = message;
    el("status").dataset.kind = kind;
  }
  function numbers(result) {
    for (const part of ["input", "output"]) {
      el(part + "-chars").textContent = formatter.format(result[part].characters);
      el(part + "-words").textContent = formatter.format(result[part].words);
      el(part + "-lines").textContent = formatter.format(result[part].lines);
    }
    el("input-tokens").textContent = formatter.format(result.inputTokens);
    el("output-tokens").textContent = formatter.format(result.outputTokens);
    el("combined-tokens").textContent = formatter.format(result.inputTokens + result.outputTokens);
    el("input-source").textContent = result.inputExact ? "User-supplied exact" : "Heuristic estimate";
    el("output-source").textContent = result.outputExact ? "User-supplied exact" : "Heuristic estimate";
    el("usage-label").textContent = result.inputExact || result.outputExact
      ? "SCENARIO TOKEN COUNTS" : "HEURISTIC TOKEN ESTIMATE";
  }
  function costs(result) {
    const current = result.price;
    el("per-call-cost").textContent = current ? engine.money(current.total) : "Add both rates";
    el("input-cost").textContent = current ? engine.money(current.input) : "—";
    el("output-cost").textContent = current ? engine.money(current.output) : "—";
    el("monthly-cost").textContent = current ? engine.money(current.monthly) : "—";
  }
  function invalid(error) {
    last = null;
    el("combined-tokens").textContent = "—";
    el("input-tokens").textContent = "—";
    el("output-tokens").textContent = "—";
    el("per-call-cost").textContent = "Check settings";
    el("monthly-cost").textContent = "—";
    el("input-cost").textContent = "—";
    el("output-cost").textContent = "—";
    el("copy-report").disabled = true;
    el("download-report").disabled = true;
    status(error.message || "Invalid input.", "error");
  }
  function calculate() {
    try {
      const result = engine.calculate({
        inputText: el("input-text").value,
        outputText: el("output-text").value,
        charsPerToken: el("chars-per-token").value,
        exactInput: el("exact-input").value,
        exactOutput: el("exact-output").value,
        inputRate: el("input-rate").value,
        outputRate: el("output-rate").value,
        calls: el("calls").value
      });
      last = result;
      numbers(result); costs(result);
      el("copy-report").disabled = false;
      el("download-report").disabled = false;
      if (el("status").dataset.kind === "error") status("");
    } catch (error) { invalid(error); }
  }
  function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(calculate, 120);
  }
  for (const id of inputs) el(id).addEventListener("input", schedule);
  el("reset").addEventListener("click", () => {
    clearTimeout(debounce);
    for (const id of ["input-text", "output-text", "exact-input", "exact-output", "input-rate", "output-rate"])
      el(id).value = "";
    el("chars-per-token").value = "4";
    el("calls").value = "1";
    calculate();
    status("All fields cleared. No text was saved.", "success");
    el("input-text").focus();
  });
  el("example").addEventListener("click", () => {
    clearTimeout(debounce);
    el("input-text").value = "Create a concise checklist for reviewing a new web app before release. Include accessibility, privacy and browser compatibility.";
    el("output-text").value = "Release checklist:\n1. Check keyboard navigation and labels.\n2. Verify that private data stays local.\n3. Test browser imports and exports.\n4. Confirm responsive layout and error handling.";
    el("exact-input").value = "";
    el("exact-output").value = "";
    calculate();
    status("Sample loaded locally. Rates remain unchanged.", "success");
  });
  el("copy-report").addEventListener("click", async () => {
    if (!last) return;
    const r = last;
    const summary = [
      "Unfire AI Token Counter — local scenario",
      "Input tokens: " + formatter.format(r.inputTokens) + (r.inputExact ? " (user-supplied exact)" : " (rough estimate)"),
      "Output tokens: " + formatter.format(r.outputTokens) + (r.outputExact ? " (user-supplied exact)" : " (rough estimate)"),
      "Price per exchange: " + (r.price ? engine.money(r.price.total) : "Not set"),
      "Monthly scenario: " + (r.price ? engine.money(r.price.monthly) : "Not set"),
      "Provider tokenization, actual prices and extra charges must be verified."
    ].join("\n");
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText)
        throw new Error("Clipboard API not available in this browser context.");
      await navigator.clipboard.writeText(summary);
      status("Summary copied. No source text included.", "success");
    } catch (error) {
      status("Copy unavailable: " + error.message + " You can export CSV instead.", "error");
    }
  });
  el("download-report").addEventListener("click", () => {
    if (!last) return;
    try {
      const csv = engine.report(last);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "unfire-token-scenario.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status("CSV download requested. Source text was excluded.", "success");
    } catch (error) { status("Export failed: " + error.message, "error"); }
  });
  calculate();
})();
