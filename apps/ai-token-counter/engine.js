/* Unfire Token Counter Web — local-only, model-agnostic estimate and cost engine.
 * No tokenization claims: estimated counts do not replace provider usage.
 */
(function (root) {
  "use strict";
  const MAX_TEXT = 250000;
  const MAX_TOKENS = 1000000000;
  const MAX_CALLS = 1000000;
  const MAX_RATE = 100000;
  function finiteNumber(value, min, max, label) {
    if (value === "" || value == null) throw new RangeError(label + " is required.");
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max)
      throw new RangeError(label + " must be between " + min + " and " + max + ".");
    return parsed;
  }
  function integer(value, min, max, label) {
    const parsed = finiteNumber(value, min, max, label);
    if (!Number.isSafeInteger(parsed)) throw new RangeError(label + " must be an integer.");
    return parsed;
  }
  function exactCount(value, label) {
    if (value === "" || value == null) return null;
    return integer(value, 0, MAX_TOKENS, label);
  }
  function optionalRate(value, label) {
    if (value === "" || value == null) return null;
    return finiteNumber(value, 0, MAX_RATE, label);
  }
  function textMetrics(value, charsPerToken) {
    if (typeof value !== "string" || value.length > MAX_TEXT)
      throw new RangeError("Text must be at most " + MAX_TEXT.toLocaleString("en-US") + " UTF-16 code units.");
    const factor = finiteNumber(charsPerToken, 1, 12, "Characters per estimated token");
    let codePoints = 0;
    for (const _ of value) codePoints++;
    const words = (value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
    const lines = value.length ? value.split(/\r\n|\n|\r/).length : 0;
    return {
      characters: codePoints,
      units: value.length,
      words,
      lines,
      estimate: codePoints ? Math.ceil(codePoints / factor) : 0
    };
  }
  function calculate(data) {
    if (!data || typeof data !== "object") throw new TypeError("A data object is required.");
    const factor = finiteNumber(data.charsPerToken, 1, 12, "Characters per estimated token");
    const input = textMetrics(data.inputText || "", factor);
    const output = textMetrics(data.outputText || "", factor);
    const exactInput = exactCount(data.exactInput, "Exact input tokens");
    const exactOutput = exactCount(data.exactOutput, "Exact output tokens");
    const calls = integer(data.calls, 1, MAX_CALLS, "Calls per month");
    const inputRate = optionalRate(data.inputRate, "Input rate");
    const outputRate = optionalRate(data.outputRate, "Output rate");
    const inputTokens = exactInput === null ? input.estimate : exactInput;
    const outputTokens = exactOutput === null ? output.estimate : exactOutput;
    const priced = inputRate !== null && outputRate !== null;
    const price = priced ? {
      input: inputTokens * inputRate / 1000000,
      output: outputTokens * outputRate / 1000000,
      total: (inputTokens * inputRate + outputTokens * outputRate) / 1000000,
      monthly: (inputTokens * inputRate + outputTokens * outputRate) * calls / 1000000
    } : null;
    return {
      factor, input, output, inputTokens, outputTokens,
      inputExact: exactInput !== null, outputExact: exactOutput !== null,
      inputRate, outputRate, calls, priced, price
    };
  }
  function money(value) {
    if (value == null) return "Not set";
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Invalid cost.");
    if (value === 0) return "$0.00";
    if (value < 0.000001) return "<$0.000001";
    const digits = value >= 1 ? 2 : value >= .01 ? 4 : 6;
    return "$" + value.toLocaleString("en-US", {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    });
  }
  function report(result) {
    if (!result || typeof result !== "object") throw new TypeError("Result is required.");
    const number = v => String(v);
    const lines = [
      ["Metric", "Value"],
      ["Input characters", number(result.input.characters)],
      ["Output characters", number(result.output.characters)],
      ["Input word count", number(result.input.words)],
      ["Output word count", number(result.output.words)],
      ["Characters per estimated token", number(result.factor)],
      ["Input token count", number(result.inputTokens)],
      ["Input count source", result.inputExact ? "Exact count supplied by user" : "Heuristic estimate"],
      ["Output token count", number(result.outputTokens)],
      ["Output count source", result.outputExact ? "Exact count supplied by user" : "Heuristic estimate"],
      ["Input price (USD per million tokens)", result.inputRate === null ? "Not set" : number(result.inputRate)],
      ["Output price (USD per million tokens)", result.outputRate === null ? "Not set" : number(result.outputRate)],
      ["Calls per month", number(result.calls)],
      ["Estimated cost per call (USD)", result.price ? number(result.price.total) : "Not set"],
      ["Estimated monthly cost (USD)", result.price ? number(result.price.monthly) : "Not set"]
    ];
    // Every field is fixed or numeric; source text is intentionally excluded.
    return lines.map(row => row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(",")).join("\r\n") + "\r\n";
  }
  const api = Object.freeze({ MAX_TEXT, MAX_TOKENS, MAX_CALLS, MAX_RATE, textMetrics, calculate, money, report });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.UnfireTokenEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
