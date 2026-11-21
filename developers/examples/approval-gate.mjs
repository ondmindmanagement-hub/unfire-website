/**
 * Unfire Developer Platform · synthetic approval gate REFERENCE EXAMPLE ONLY.
 * SPDX-License-Identifier: MIT (see LICENSE.txt in this directory)
 * Not a production Unfire Bolt or Unfire Control SDK.
 * No external operations, remote calls, credentials, telemetry or persistence.
 */
const supported = new Set(["read", "draft", "simulate"]);
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

/**
 * @param {{id:string, kind:"read"|"draft"|"simulate",scope:"synthetic"}} action
 * @param {string[]} approvalIds - IDs separately approved by a human in a trusted context.
 * @returns {{status:"allow"|"review"|"deny", reason:string}}
 */
export function evaluateAction(action, approvalIds = []) {
  if (!action || !validId(action.id) || !supported.has(action.kind)) {
    return { status: "deny", reason: "invalid-action" };
  }
  if (action.scope !== "synthetic") {
    return { status: "deny", reason: "outside-synthetic-scope" };
  }
  if (action.kind === "simulate" && (!Array.isArray(approvalIds) || !approvalIds.includes(action.id))) {
    return { status: "review", reason: "explicit-approval-required" };
  }
  return { status: "allow", reason: "within-synthetic-scope" };
}
/** Keeps an in-memory audit trail; NOT tamper-resistant, durable or externally audited. */
export function appendRecord(records, action, decision) {
  if (!Array.isArray(records) || !action || !validId(action.id) ||
      !decision || !["allow", "review", "deny"].includes(decision.status)) {
    throw new TypeError("Invalid local audit record");
  }
  return [...records, Object.freeze({
    id: action.id,
    kind: String(action.kind || ""),
    status: decision.status,
    reason: String(decision.reason || "")
  })];
}
