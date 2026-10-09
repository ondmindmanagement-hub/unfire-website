/*
 * Unfire / BOLT synthetic buyer exercise.
 * 100% illustrative, deterministic standalone JavaScript.
 * NO proprietary macOS BOLT source, model inference, storage, or external access.
 */
(function (root) {
  "use strict";
  const fixtures = Object.freeze([
    Object.freeze({
      id: "SYN-001",
      name: "Matching inventory snapshot",
      problem: "A read-only order status summary is requested.",
      wmsUnits: 24, orderUnits: 24, action: "draft_read_only_summary",
      note: "All displayed counts are fictional."
    }),
    Object.freeze({
      id: "SYN-002",
      name: "Discrepant inventory",
      problem: "WMS and order records disagree; an update is proposed.",
      wmsUnits: 24, orderUnits: 21, action: "change_inventory",
      note: "A human would need to investigate; none has approved anything."
    }),
    Object.freeze({
      id: "SYN-003",
      name: "Refund request",
      problem: "A customer refund is proposed based on an exception.",
      wmsUnits: 24, orderUnits: 24, action: "issue_refund",
      note: "No payment or refund is possible in this static demo."
    }),
    Object.freeze({
      id: "SYN-004",
      name: "Personal-data export",
      problem: "An external export of private customer records is proposed.",
      wmsUnits: 21, orderUnits: 21, action: "export_personal_records",
      note: "There are no customer records on this page."
    })
  ]);

  function evaluate(candidate) {
    // Incomplete or unrecognized inputs do NOT get an 'allow' outcome.
    const base = { policy: "illustrative-policy-0.1", simulated: true, executed: false };
    if (!candidate || typeof candidate !== "object" ||
        !Number.isSafeInteger(candidate.wmsUnits) ||
        !Number.isSafeInteger(candidate.orderUnits) ||
        candidate.wmsUnits < 0 || candidate.orderUnits < 0 ||
        typeof candidate.action !== "string") {
      return { ...base, decision: "BLOCK", reason: "Malformed or missing synthetic inputs.", next: "Do not proceed. Check source records." };
    }
    if (candidate.action === "issue_refund" || candidate.action === "export_personal_records") {
      return { ...base, decision: "BLOCK", reason: "Financial transfers and personal-data exports are forbidden in the illustrative policy.", next: "Handle through separate authorized procedures." };
    }
    if (candidate.wmsUnits !== candidate.orderUnits) {
      return { ...base, decision: "REVIEW", reason: "Warehouse and order counts disagree. No automatic reconciliation is allowed.", next: "Ask a human owner to review the discrepancy." };
    }
    if (candidate.action === "draft_read_only_summary") {
      return { ...base, decision: "ALLOW", reason: "Counts agree and the proposed output is read-only.", next: "Prepare a draft summary only; do not modify external systems." };
    }
    return { ...base, decision: "REVIEW", reason: "Action is not explicitly approved for automatic handling.", next: "Request written human approval before proceeding." };
  }
  root.UnfireSyntheticDemo = { fixtures, evaluate };
  if (typeof module !== "undefined" && module.exports) module.exports = { fixtures, evaluate };
})(typeof globalThis !== "undefined" ? globalThis : this);

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    "use strict";
    const demo = globalThis.UnfireSyntheticDemo;
    const scenarioList = document.getElementById("scenarios");
    const detail = document.getElementById("detail");
    const output = document.getElementById("output");
    const run = document.getElementById("run");
    const email = document.getElementById("email");
    let selection = 0;

    function choose(index) {
      selection = index;
      demo.fixtures.forEach((item, i) => {
        const button = scenarioList.children[i];
        button.setAttribute("aria-pressed", String(i === index));
      });
      const item = demo.fixtures[index];
      detail.textContent = item.problem + " Fictional quantities: warehouse " + item.wmsUnits +
        ", order record " + item.orderUnits + ". Proposed: " +
        item.action.replaceAll("_", " ") + ".";
      output.textContent = "Select 'Run the example' to inspect the decision and evidence.";
      output.dataset.decision = "unset";
      email.href = "mailto:hello@unfire.technology?subject=" +
        encodeURIComponent("BOLT — written scenario enquiry " + item.id) +
        "&body=" + encodeURIComponent("Hello Unfire,\n\nPlease send the written feasibility scope for " +
        item.id + ". We would like to discuss a similar non-confidential workflow without sharing customer data or credentials.\n\nPlease reply only by email.");
    }
    demo.fixtures.forEach((item, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scenario";
      b.setAttribute("aria-pressed", "false");
      b.textContent = item.id + " · " + item.name;
      b.addEventListener("click", () => choose(i));
      scenarioList.appendChild(b);
    });
    run.addEventListener("click", function () {
      const input = demo.fixtures[selection];
      const result = demo.evaluate(input);
      output.dataset.decision = result.decision.toLowerCase();
      output.textContent =
        "DECISION: " + result.decision + "\n" +
        "WHY: " + result.reason + "\n" +
        "NEXT: " + result.next + "\n\n" +
        "Evidence\n" + JSON.stringify({
          case_id: input.id,
          fictional_data: true,
          policy: result.policy,
          proposed_action: input.action,
          compared_quantities: { warehouse: input.wmsUnits, orders: input.orderUnits },
          decision: result.decision,
          reason: result.reason,
          next_step: result.next,
          executed: false,
          actual_human_approval: false,
          inference_model_used: false
        }, null, 2);
    });
    choose(0);
  });
}
